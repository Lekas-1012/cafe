"""第二階段的加熱暫停、音效、儲存、版面與結算生命週期。"""
import functools,http.server,threading
from support import ROOT,Handler,sync_playwright,check
from phase2_test import prepare
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start()
try:
  with sync_playwright() as p:
    b=p.chromium.launch(executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe',headless=True)
    page=b.new_page(viewport={'width':1440,'height':1100},reduced_motion='reduce')
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.add_init_script('const NativeAudio=window.AudioContext;window.AudioContext=class extends NativeAudio{createGain(){const g=super.createGain();window.testAudioGain=g;return g;}};')
    base=f'http://127.0.0.1:{server.server_port}/coffee-brewing-game/'
    page.goto(base);page.locator('#sound-toggle').click()
    check(page.locator('#sound-toggle').get_attribute('aria-pressed')=='true','音效開關可用')
    def hook(stage,page):
        for width in [390,768]:
            page.set_viewport_size({'width':width,'height':1000})
            check(page.evaluate('document.documentElement.scrollWidth<=innerWidth'),f'{width}px {stage} 無水平溢出')
        page.set_viewport_size({'width':1440,'height':1100})
        if stage=='heat':
            page.locator('#heater-toggle').click();page.wait_for_timeout(400)
            page.locator('#journey-pause').click();temp=page.locator('#heat-exact').inner_text()
            page.wait_for_timeout(600)
            check(page.locator('#heat-exact').inner_text()==temp,'暫停加熱時溫度凍結')
            check(page.evaluate('testAudioGain.gain.value')<.0001,'準備暫停時音效停止')
            page.locator('#prep-resume').click();page.locator('#heater-toggle').click()
    prepare(page,practice=False,stage_hook=hook)
    check(page.locator('#game-temperature').is_hidden(),'正式挑戰不顯示精確溫度')
    page.locator('#kettle').focus();page.keyboard.down('Space');page.wait_for_timeout(2800)
    check(page.evaluate('testAudioGain.gain.value')>.001,'出水驅動真實音量節點')
    page.keyboard.up('Space');page.locator('#pause-button').click();page.wait_for_timeout(450)
    check(page.evaluate('testAudioGain.gain.value')<.0001,'暫停時出水聲停止')
    page.locator('#resume-button').click()
    for width in [390,768,1280]:
        page.set_viewport_size({'width':width,'height':1000})
        check(page.evaluate('document.documentElement.scrollWidth<=innerWidth'),f'{width}px 手沖無水平溢出')
    page.locator('#finish-button').click();page.wait_for_timeout(450)
    for width in [390,768,1280]:
        page.set_viewport_size({'width':width,'height':1000})
        check(page.evaluate('document.documentElement.scrollWidth<=innerWidth'),f'{width}px 結算無水平溢出')
    check(page.evaluate('testAudioGain.gain.value')<.0001,'結算後音效停止')
    score=int(page.locator('#total-score').inner_text())
    check(score>0,'正式沖煮產生實際分數')
    check(page.evaluate('localStorage.getItem("brew-by-feel.best.v3")') is not None,'正式最佳紀錄寫入')
    page.locator('#home-button').click();page.reload()
    check(str(score) in page.locator('#home-best').inner_text(),'重新載入保留最佳紀錄')
    page.locator('#start-button').click();page.locator('[data-select="huila"]').click();page.locator('#beans-next').click()
    check(page.locator('#grind-next').is_disabled(),'新局重設研磨與材料')
    page.locator('#grind-screen .prep-home').click();page.locator('#keep-brewing').click()
    check(page.locator('#grind-screen').is_visible(),'離開對話框可保留進度')
    page.locator('#grind-screen .prep-home').click();page.locator('#confirm-leave').click()
    check(page.locator('#home-screen').is_visible(),'確認離開回首頁')
    blocked=b.new_context(reduced_motion='reduce')
    blocked.add_init_script('Object.defineProperty(Storage.prototype,"getItem",{value(){throw Error("blocked")}});Object.defineProperty(Storage.prototype,"setItem",{value(){throw Error("blocked")}});')
    blocked_page=blocked.new_page();blocked_page.goto(base);blocked_page.locator('#start-button').click()
    check(blocked_page.locator('.bean-card').count()==6,'儲存受限仍可開始選豆')
    direct=b.new_page(reduced_motion='reduce');direct.goto((ROOT/'index.html').as_uri());direct.locator('#start-button').click()
    check(direct.locator('.bean-card').count()==6,'直接開啟 HTML 可運作')
    check(not errors,f'生命週期無 JavaScript 例外：{errors}')
    b.close();print('ALL LIFECYCLE TESTS PASSED')
finally:server.shutdown()
