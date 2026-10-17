"""列出目前六款示範配方的模型策略；不改寫正式參數。"""
import json
from support import ROOT,sync_playwright
from phase2_test import MODEL_CASES
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe',headless=True)
    page=b.new_page();page.goto('about:blank')
    for name in ['beans','chaos','model','controls','renderer','preparation']:
        page.add_script_tag(path=str(ROOT/'js'/(name+'.js')))
    data=page.evaluate(MODEL_CASES)
    print(json.dumps({'recipes':data['recipes'],'same':data['same']},ensure_ascii=False,indent=2))
    b.close()
