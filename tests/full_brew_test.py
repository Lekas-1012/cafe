"""用正式介面完成全部準備與分段沖煮；只加速測試時鐘，不改寫遊戲狀態。"""
from datetime import datetime,timedelta,timezone
import functools,http.server,math,threading
from support import ROOT,Handler,sync_playwright,check
from phase2_test import prepare,slider

server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe',headless=True)
  page=browser.new_page(viewport={'width':1280,'height':1100},reduced_motion='reduce')
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(f'http://127.0.0.1:{server.server_port}/coffee-brewing-game/')
  page.evaluate('''() => {const original=BrewModel.step;BrewModel.step=(s,i,dt)=>{const result=original(s,i,dt);window.brewProbe={water:s.totalWater,remaining:s.bedWater,aimX:i.x,aimY:i.y};return result;};}''')
  prepare(page,practice=False)
  page.clock.install();page.clock.pause_at(datetime.now(timezone.utc)+timedelta(seconds=.3))
  page.clock.run_for(200)
  theta=0
  scene=page.locator('#scene').bounding_box();scale=scene['width']/960
  for index,target in enumerate([46,120,195,270]):
    box=page.locator('#kettle').bounding_box();x=box['x']+box['width']*.55;y=box['y']+box['height']*.5
    start_aim=page.evaluate('brewProbe.aimX')
    start_depth=page.evaluate('brewProbe.aimY')
    page.mouse.move(x,y);page.mouse.down()
    while page.evaluate('brewProbe.water')<target:
      theta+=.18;aim_x=.67*math.cos(theta);aim_y=.67*math.sin(theta)
      page.mouse.move(x+(aim_x-start_aim)*120*scale,y+(aim_y-start_depth)*35*scale)
      page.clock.run_for(100)
    page.mouse.up()
    if index==0:page.clock.run_for(23000)
    elif index<3:page.clock.run_for(8000)
    else:
      for _ in range(70):
        if page.evaluate('brewProbe.remaining')<.8:break
        page.clock.run_for(1000)
    print('POUR COMPLETED',index+1,flush=True)
  page.locator('#finish-button').click()
  score=int(page.locator('#total-score').inner_text())
  check(score>=85,f'正式介面從豆到杯可達高分：{score}')
  check(page.locator('#result-pulses').inner_text()=='4 段','完整分段確實記入結算')
  check('沖煮平衡' in page.locator('#score-badge').inner_text(),'完整操作得到平衡風味')
  page.screenshot(path=str(ROOT/'tests/artifacts/phase2-full-result.png'),full_page=True)
  page.locator('#home-button').click()
  check(str(score) in page.locator('#home-best').inner_text(),'正式高分寫入最佳成績')
  check(not errors,f'完整沖煮無 JavaScript 錯誤：{errors}')
  browser.close();print('FULL BREW PASSED',flush=True)
finally:server.shutdown()
