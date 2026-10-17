"""本次失控改版：確定性反例、守恆、暴力斷柄／修復、真實二維拖移與水災。"""
from datetime import datetime,timedelta,timezone
import functools,http.server,json,math,threading
from support import ROOT,Handler,sync_playwright,check
from phase2_test import prepare,slider

CASES=r'''() => {
 const M=BrewModel,C=BrewControls,P=BrewPreparation,R=BrewRenderer,dt=1/60;
 function run(kind,mode='challenge'){
  const s=M.create({beanId:'huila',mode});
  for(let i=0;i<60*70;i++){
   const t=i*dt,flow=t<40?kind==='violent'?10.5:4:0;
   let x=0,y=0;if(kind==='orbit'){x=.65*Math.cos(t*1.8);y=.65*Math.sin(t*1.8);}
   if(kind==='edge'){x=.98;y=.1;}if(kind==='outside'){x=1.5;y=.4;}
   M.step(s,{flow,x,y,instability:kind==='violent'?.8:0},dt);
  }
  const r=M.finish(s);return {score:r.total,accidents:r.accidents,channel:s.channeling,erosion:s.disturbance,
   wet:s.cells.map(c=>c.wet),dose:s.cells.map(c=>c.dose),table:s.tableWater,miss:s.missedWater,overflow:s.overflow,
   mass:s.totalWater-s.missedWater-s.overflow-s.absorbed-s.poreWater-s.freeWater-s.beverage,
   patchCount:s.tablePatches.length,patchSum:s.tablePatches.reduce((a,p)=>a+p.water,0),rim:s.rimWet.reduce((a,v)=>a+v,0)};
 }
 function grinder(mode,speed){
  const p=P.create('huila',mode);P.load(p);let steps=0;
  while(p.beansRemaining>0&&!p.handleBroken&&steps++<6000){P.grind(p,speed*dt,dt);P.step(p,dt);}
  const broken=p.handleBroken,material=p.beansRemaining+p.grounds,stress=p.grindStress,abuse=p.grindAbuse;
  p.repairHeld=true;for(let i=0;i<100;i++)P.step(p,dt);
  const repaired=!p.handleBroken;p.repairHeld=false;
  while(p.beansRemaining>0&&steps++<12000){P.grind(p,4.2*dt,dt);P.step(p,dt);}
  return {broken,material,stress,abuse,repaired,ready:P.canAdvance(p,'grind'),breaks:p.breakCount,steps};
 }
 function control(flow){const c=C.create();C.setFlow(c,flow);C.step(c,dt);C.begin(c);let max=0;
  for(let i=0;i<180;i++){C.step(c,dt);const k=C.pose(c);max=Math.max(max,Math.hypot(k.landingX,k.landingY));}
  C.setAim(c,1.4,.8);C.step(c,dt);const k=C.pose(c);return {max,lag:Math.hypot(k.aimX-k.landingX,k.aimY-k.landingY),target:[k.aimX,k.aimY]};}
 const all=Object.fromEntries(['orbit','center','edge','outside','violent'].map(k=>[k,run(k)]));
 const formal=grinder('challenge',24),practice=grinder('practice',24),normal=grinder('challenge',4.2);
 return {all,repeat:JSON.stringify(run('violent'))===JSON.stringify(run('violent')),formal,practice,normal,
  gentle:control(4),strong:control(10.5),practicePenalty:run('edge','practice').accidents.penalty};
}'''

def main():
 (ROOT/'tests/artifacts').mkdir(exist_ok=True)
 server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT)))
 threading.Thread(target=server.serve_forever,daemon=True).start()
 try:
  with sync_playwright() as p:
   browser=p.chromium.launch(executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe',headless=True)
   page=browser.new_page(viewport={'width':1440,'height':1100},reduced_motion='reduce')
   page.add_init_script('const NativeAudio=window.AudioContext;window.AudioContext=class extends NativeAudio{createOscillator(){window.crackSounds=(window.crackSounds||0)+1;return super.createOscillator();}};')
   errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto(f'http://127.0.0.1:{server.server_port}/coffee-brewing-game/')
   page.locator('#sound-toggle').click()
   data=page.evaluate(CASES);cases=data['all']
   (ROOT/'tests/artifacts/chaos-model.json').write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
   check(data['repeat'],'失控模型重複相同操作完全一致')
   check(data['normal']['ready'] and not data['normal']['broken'],'合理速度磨豆不斷柄')
   check(data['formal']['broken'] and data['practice']['broken'],'持續暴力可實際斷柄，練習仍有上限')
   check(data['practice']['abuse']>data['formal']['abuse'],'練習斷柄容忍較高')
   check(data['formal']['repaired'] and data['formal']['ready'] and abs(data['formal']['material']-18)<1e-8,'斷柄修復後能完成且豆粉守恆')
   check(data['gentle']['max']<1e-8 and .15<data['strong']['max']<.5,'弱流精準、強流確定性偏移有上限')
   check(data['strong']['lag']>data['gentle']['lag']>0,'快速移動有慣性、強流更難駕馭')
   check(cases['outside']['score']==0 and cases['outside']['table']>150,'全部沖桌子不能高分且實際累積桌面水量')
   check(cases['edge']['rim']>100 and cases['edge']['table']>20 and cases['edge']['accidents']['edgeHits']>0,'濾紙邊緣命中有水痕、漏水與次數')
   check(cases['center']['channel']>.5 and cases['orbit']['channel']<.05,'同點挖坑明顯、繞圈可避免通道')
   check(cases['violent']['erosion']>cases['center']['erosion'],'強流翻攪侵蝕更嚴重')
   check(abs(data['practicePenalty']*2-cases['edge']['accidents']['penalty'])<1e-9,'練習事故額外扣分確實減半')
   check(all(v['patchCount']==48 and abs(v['patchSum']-v['table'])<1e-6 and abs(v['table']-v['miss']-v['overflow'])<1e-6 and abs(v['mass'])<1e-6 for v in cases.values()),'五種事故守恆、水痕總量正確、儲存固定48區')
   page.evaluate('''() => {
    const step=BrewModel.step;BrewModel.step=(s,i,dt)=>{const r=step(s,i,dt);window.chaosProbe={water:s.totalWater,table:s.tableWater,x:i.x,y:i.y,edge:s.edgeHits,channel:s.channeling,event:s.eventId,breaks:s.grinderBreaks,patches:s.tablePatches};return r;};
   }''')
   def violence(stage,pg):
    if stage!='grind_loaded':return
    rect=pg.locator('#grind-scene').bounding_box();scale=rect['width']/960
    pg.mouse.move(rect['x']+625*scale,rect['y']+202*scale);pg.mouse.down()
    for i in range(1,230):
     a=i*.9;pg.mouse.move(rect['x']+(480+math.cos(a)*145)*scale,rect['y']+(202+math.sin(a)*65)*scale)
     if pg.locator('#grinder-repair').is_visible():break
    pg.mouse.up();check(pg.locator('#grinder-repair').is_visible(),'真實快速拖柄觸發斷裂及修復介面')
    check(pg.evaluate('window.crackSounds||0')>0,'斷柄實際觸發合成咔啦音效')
    pg.locator('#sound-toggle').click();check(pg.locator('#sound-toggle').get_attribute('aria-pressed')=='false','事故音效可切換靜音')
    pg.wait_for_timeout(500);pg.screenshot(path=str(ROOT/'tests/artifacts/chaos-broken.png'),full_page=True)
    for width in [390,768]:
     pg.set_viewport_size({'width':width,'height':1100});check(pg.evaluate('document.documentElement.scrollWidth<=innerWidth'),f'{width}px 斷柄修復畫面無水平溢出')
    pg.set_viewport_size({'width':1440,'height':1100})
    button=pg.locator('#repair-handle').bounding_box();pg.mouse.move(button['x']+button['width']/2,button['y']+button['height']/2);pg.mouse.down();pg.wait_for_timeout(1650);pg.mouse.up()
    check(pg.locator('#grinder-repair').is_hidden(),'按住裝回手柄，能接續研磨')
   prepare(page,stage_hook=violence)
   page.clock.install();page.clock.pause_at(datetime.now(timezone.utc)+timedelta(seconds=.3));page.clock.run_for(200)
   for view in ['overview','overhead','close']:
    page.locator(f'.view-controls [data-view="{view}"]').click();page.clock.run_for(100)
    slider(page,'#flow-setting',4);slider(page,'#depth-setting',0)
    page.clock.run_for(100)
    box=page.locator('#kettle').bounding_box();rect=page.locator('#scene').bounding_box();scale=rect['width']/960
    x=box['x']+box['width']*.5;y=box['y']+box['height']*.5
    start=page.evaluate('chaosProbe.y');page.mouse.move(x,y);page.mouse.down();page.mouse.move(x+25*scale,y+22*scale,steps=6);page.clock.run_for(500)
    check(page.evaluate('chaosProbe.y')>start+.12,f'{view} 真實拖壺同時改變前後與左右落點')
    page.mouse.up();page.clock.run_for(100)
   page.locator('.view-controls [data-view="overhead"]').click();page.clock.run_for(100)
   slider(page,'#flow-setting',10.5);slider(page,'#depth-setting',1.4)
   page.locator('#kettle').focus();page.keyboard.down('Space');seen_toast=False
   for _ in range(12):
    page.clock.run_for(500);seen_toast=seen_toast or page.locator('#chaos-toast').is_visible()
   table=page.evaluate('chaosProbe.table');check(table>45,'真實出水灑到外面累積桌面水灘')
   check(seen_toast,'事故發生時出現短暫搞笑提示')
   page.screenshot(path=str(ROOT/'tests/artifacts/chaos-puddles-overhead.png'))
   page.clock.run_for(3000);check(page.evaluate('chaosProbe.table')>table+20,'桌面濕痕持續累積')
   page.keyboard.up('Space');page.clock.run_for(200)
   for view in ['overview','close']:
    page.locator(f'.view-controls [data-view="{view}"]').click();page.clock.run_for(100)
    page.screenshot(path=str(ROOT/f'tests/artifacts/chaos-puddles-{view}.png'))
   page.locator('#finish-button').click()
   check('1 次' in page.locator('#accident-facts').inner_text(),'結算保留這局斷柄事件')
   check('事故額外扣分' in page.locator('#accident-penalty').inner_text(),'結算揭露實際事故扣分與水災評論')
   page.screenshot(path=str(ROOT/'tests/artifacts/chaos-result.png'),full_page=True)
   page.locator('#retry-button').click();check(page.locator('#beans-screen').is_visible(),'事故後仍能正常重新挑戰')
   check(not errors,f'失控整合流程無 JavaScript 錯誤：{errors}')
   browser.close();print('ALL CHAOS TESTS PASSED',flush=True)
 finally:server.shutdown()

if __name__=='__main__':main()
