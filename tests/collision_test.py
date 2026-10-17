"""真碰撞、持續傾倒、液體損失、扶正續玩與三視角，使用正式模型／介面。"""
from datetime import datetime,timedelta,timezone
import functools,http.server,json,threading
from support import ROOT,Handler,sync_playwright,check
from phase2_test import prepare,slider

CASES=r'''() => {
 const M=BrewModel,H=BrewChaos,C=BrewControls,dt=1/60;
 const mass=s=>s.totalWater-s.missedWater-s.overflow-s.absorbed-s.poreWater-s.freeWater-s.beverage;
 function filled(){const s=M.create({beanId:'huila'});for(let i=0;i<1500;i++)M.step(s,{flow:4,x:0,y:0},dt);return s;}
 const a={x:720,y:160,tilt:.45},b={x:460,y:260,tilt:.45};
 const s=filled(),before={beverage:s.beverage,bed:s.bedWater};
 const hit=H.collide(s,a,b,dt,true),penalty=H.assess(s).penalty,spilled=s.knockedWater;
 const after={beverage:s.beverage,bed:s.bedWater,table:s.tableWater};
 for(let i=0;i<60;i++)M.step(s,{flow:4,x:0,y:0},dt);
 const down={beverage:s.beverage,angle:s.dripperAngle,server:s.serverAngle,table:s.tableWater,mass:mass(s)};
 const upright=H.upright(s);for(let i=0;i<90;i++)M.step(s,{flow:4,x:0,y:0},dt);
 const restored={beverage:s.beverage,table:s.tableWater,mass:mass(s),count:s.knockdowns};
 const slow=filled();let prev=a;
 for(let i=1;i<=600;i++){const k={x:a.x+(b.x-a.x)*i/600,y:a.y+(b.y-a.y)*i/600,tilt:.45};H.collide(slow,prev,k,dt,true);M.step(slow,{flow:0},dt);prev=k;}
 const high=filled(),highHit=H.collide(high,{x:720,y:156,tilt:.45},{x:400,y:156,tilt:.45},dt,true);
 const click=filled(),clickHit=H.collide(click,a,b,dt,false);
 const gentle=filled(),gentleHit=H.collide(gentle,{x:540,y:230,tilt:0},{x:535,y:235,tilt:0},dt,true);
 const repeat=filled();H.collide(repeat,a,b,dt,true);
 const practice=filled();practice.mode='practice';H.collide(practice,a,b,dt,true);
 const normal=filled(),c=C.create();C.begin(c);let old=C.pose(c);
 for(let i=0;i<600;i++){C.setAim(c,.67*Math.cos(i*dt*1.8),.67*Math.sin(i*dt*1.8));C.step(c,dt);const k=C.pose(c);H.collide(normal,old,k,dt,true);M.step(normal,{flow:4,x:c.actualX,y:c.actualY},dt);old=k;}
 const stationary=filled(),still=C.create();C.setAim(still,-.8,1.2);C.step(still,dt);C.setFlow(still,10.5);C.begin(still);old=C.pose(still);
 for(let i=0;i<60;i++){C.step(still,dt);const k=C.pose(still);H.collide(stationary,old,k,dt,true);M.step(stationary,{flow:0},dt);old=k;}
 const frozen=JSON.stringify(s);M.finish(s);const ended=JSON.stringify(s);M.step(s,{flow:4},dt);const recovered=H.upright(s);
 return {hit,before,after,spilled,down,upright,restored,slow:slow.knockdowns,highHit,clickHit,gentleHit,
  gentleServer:gentle.serverTipped,normal:normal.knockdowns,stationary:stationary.knockdowns,repeat:Math.abs(repeat.knockedWater-spilled)<1e-9,
  practiceHalf:Math.abs(H.assess(practice).penalty*2-penalty)<1e-9,frozen:ended===JSON.stringify(s)&&!recovered};
}'''

def main():
 server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT)))
 threading.Thread(target=server.serve_forever,daemon=True).start()
 try:
  with sync_playwright() as p:
   b=p.chromium.launch(executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe',headless=True)
   page=b.new_page(viewport={'width':1440,'height':1100},reduced_motion='reduce')
   errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto(f'http://127.0.0.1:{server.server_port}/coffee-brewing-game/')
   data=page.evaluate(CASES);(ROOT/'tests/artifacts/collision-model.json').write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
   check(data['hit'] and abs(data['down']['angle'])>1 and abs(data['down']['server'])>1,'高速撞進杯緣真的撞倒濾杯及分享壺，角度持續保留')
   check(data['after']['beverage']<data['before']['beverage'] and data['after']['bed']<data['before']['bed'] and data['spilled']>10,'床內水與分享壺咖啡實際潑出並累積水灘')
   check(data['down']['beverage']==data['after']['beverage'],'倒下時注水與排水不會偷偷補回分享壺')
   check(data['upright'] and data['restored']['beverage']>data['down']['beverage'] and data['restored']['table']>=data['down']['table'],'扶正後恢復接水，桌上水不會復原')
   check(abs(data['down']['mass'])<1e-6 and abs(data['restored']['mass'])<1e-6,'撞倒、倒下續注及扶正皆水量守恆')
   check(data['slow']==0 and not data['highHit'] and not data['clickHit'] and data['normal']==0 and data['stationary']==0,'慢速接近、空中甩壺、點定位、小圈及只調流量都不會亂撞倒')
   check(data['gentleHit'] and not data['gentleServer'],'較輕撞擊只倒濾杯，猛烈撞擊才連帶倒分享壺')
   check(data['repeat'] and data['practiceHalf'] and data['frozen'],'撞擊確定性、練習扣分減半、結束後停止')
   page.evaluate('''() => {const step=BrewModel.step;BrewModel.step=(s,i,dt)=>{const r=step(s,i,dt);window.collisionProbe={dripper:s.dripperTipped,server:s.serverTipped,table:s.tableWater,beverage:s.beverage,count:s.knockdowns,angle:s.dripperAngle};return r;};}''')
   prepare(page)
   page.clock.install();page.clock.pause_at(datetime.now(timezone.utc)+timedelta(seconds=.3));page.clock.run_for(100)
   page.locator('#kettle').focus();page.keyboard.down('Space');page.clock.run_for(8000);page.keyboard.up('Space');page.clock.run_for(200)
   rect=page.locator('#scene').bounding_box();scale=rect['width']/960;box=page.locator('#kettle').bounding_box()
   x=box['x']+box['width']*.5;y=box['y']+box['height']*.5
   page.mouse.move(x,y);page.mouse.down();page.clock.run_for(32);page.mouse.move(x-96*scale,y+42*scale);page.clock.run_for(300);page.mouse.up()
   check(page.evaluate('collisionProbe.dripper&&collisionProbe.server'),'真實快速拖壺確實撞倒兩件器具')
   check(page.locator('#upright-button').is_visible(),'倒下後顯示可操作的扶正按鈕')
   check(page.evaluate('collisionProbe.table')>5,'UI 撞倒實際增加桌面液體')
   for view in ['overview','overhead','close']:
    page.locator(f'.view-controls [data-view="{view}"]').click();page.clock.run_for(300)
    check(page.evaluate('collisionProbe.dripper'),'切換 '+view+' 不會偷偷扶正器具')
    page.screenshot(path=str(ROOT/f'tests/artifacts/collision-{view}.png'))
   check('器具倒下了' in page.locator('#observation-text').inner_text(),'事故觀察文字正確顯示中文倒下提示')
   page.locator('#pause-button').click();angle=page.evaluate('collisionProbe.angle');page.clock.run_for(1000)
   check(page.evaluate('collisionProbe.angle')==angle,'暫停時傾倒動畫與物理凍結');page.locator('#resume-button').click()
   page.locator('#upright-button').click();page.clock.run_for(800)
   check(not page.evaluate('collisionProbe.dripper||collisionProbe.server'),'真正點扶正後兩件器具恢復')
   page.locator('.view-controls [data-view="overview"]').click();slider(page,'#depth-setting',0);page.clock.run_for(100)
   rect=page.locator('#scene').bounding_box();page.mouse.click(rect['x']+460*rect['width']/960,rect['y']+324*rect['width']/960)
   previous=page.evaluate('collisionProbe.beverage');page.locator('#kettle').focus();page.keyboard.down('Space');page.clock.run_for(3000);page.keyboard.up('Space');page.clock.run_for(300)
   check(page.evaluate('collisionProbe.beverage')>previous,'扶正後仍能繼續操作水壺沖煮')
   page.locator('#finish-button').click();check('撞倒濾杯' in page.locator('#accident-facts').inner_text(),'結算實際揭露撞倒與潑出液體紀錄')
   check(not errors,f'撞倒完整流程無 JavaScript 例外：{errors}')
   b.close();print('ALL COLLISION TESTS PASSED',flush=True)
 finally:server.shutdown()

if __name__=='__main__':main()
