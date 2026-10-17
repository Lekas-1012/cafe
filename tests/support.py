"""測試共用的本機 HTTP、瀏覽器與斷言；不被正式網站載入。"""
from pathlib import Path
import http.server
import sys

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'.tools'/'python'))
from playwright.sync_api import sync_playwright

class Handler(http.server.SimpleHTTPRequestHandler):
    def translate_path(self,path):
        if path.startswith('/coffee-brewing-game/'):
            path=path[len('/coffee-brewing-game'):]
        return super().translate_path(path)
    def log_message(self,*args):pass

def check(condition,message):
    if not condition:raise AssertionError(message)
    print('PASS',message,flush=True)
