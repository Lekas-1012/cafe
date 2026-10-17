"""不用外部套件的交付檔案、編碼與相對資源檢查。"""
from html.parser import HTMLParser
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
REQUIRED = ['index.html','style.css','js/model.js','js/renderer.js','js/game.js',
            'js/chaos.js','js/beans.js','js/controls.js','js/preparation.js','js/preparation-renderer.js',
            'assets/favicon.svg','README.md','docs/SPEC.md','docs/DEVELOPMENT.md',
            'docs/REPORT.md','docs/TESTING.md','.nojekyll','.gitignore']


class Parser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = set()
        self.refs = []
        self.duplicates = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if 'id' in attrs:
            if attrs['id'] in self.ids:
                self.duplicates.append(attrs['id'])
            self.ids.add(attrs['id'])
        for key in ['href','src']:
            if key in attrs:
                self.refs.append(attrs[key])


for name in REQUIRED:
    p = ROOT / name
    assert p.is_file(), f'缺少交付檔案：{name}'
    p.read_text(encoding='utf-8')
parser = Parser()
parser.feed((ROOT/'index.html').read_text(encoding='utf-8'))
assert not parser.duplicates, parser.duplicates
assert all(not ref.startswith('/') for ref in parser.refs), '不可使用根目錄絕對路徑'
for ref in parser.refs:
    if ref.startswith('./'):
        assert (ROOT/ref).is_file(), ref
for script in ['js/game.js']:
    text=(ROOT/script).read_text(encoding='utf-8')
    for element in re.findall(r"\$\('([^']+)'\)",text):
        assert element in parser.ids, f'不存在的 DOM id：{element}'
for doc in [ROOT/'README.md',*(ROOT/'docs').glob('*.md')]:
    for link in re.findall(r'\]\((\./[^)#]+)(?:#[^)]*)?\)',doc.read_text(encoding='utf-8')):
        assert (doc.parent/link).is_file(), f'{doc.name}: {link}'
print('PASS 必要檔案齊全、UTF-8、HTML ID 唯一、相對資源存在、DOM 引用與文件連結有效')
