"""第二階段：正式模型、準備流程、落點補償、水位與真實 Chrome 操作。"""
import functools
import http.server
import json
import math
import threading
from support import ROOT, Handler, sync_playwright, check

MODEL_CASES=r'''() => {
 const M=BrewModel,C=BrewControls,R=BrewRenderer,P=BrewPreparation,dt=1/60;
 function recipe(beanId,options={}) {
   const b=BrewBeans.get(beanId),s=M.create({beanId,grind:options.grind??(b.grindRange[0]+b.grindRange[1])/2,temperature:options.temperature??(b.tempRange[0]+b.tempRange[1])/2,bedQuality:options.bedQuality??1});
   const targets=[46,120,195,270];let phase=0,stop=null;
   for(let i=0;i<60*270;i++){
     let flow=0;
     if(options.continuous){flow=10.5;if(s.elapsed>125)break;}
     else if(phase<4){if(s.totalWater>=targets[phase]){if(stop===null)stop=s.elapsed;const gap=phase===0?(options.noBloom?1:b.bloomWait):8;if(phase===3){if(s.bedWater<.8)break;}else if(s.elapsed-stop>=gap){phase++;stop=null;}}else flow=options.flow??4;}
     const t=i*dt;M.step(s,{flow,x:options.center?0:.67*Math.cos(t*1.8),y:options.center?0:.67*Math.sin(t*1.8)},dt);
   }
   const r=M.finish(s);return {score:r.total,extraction:r.extraction,elapsed:r.elapsed,preparation:r.preparation,metrics:r.metrics,water:r.water,peak:s.waterLevelPeak,temperature:s.temperature,permeability:s.permeability,mass:s.totalWater-s.missedWater-s.overflow-s.absorbed-s.poreWater-s.freeWater-s.beverage};
 }
 const recipes=Object.fromEntries(BrewBeans.all.map(b=>[b.id,recipe(b.id)]));
 const same=Object.fromEntries(BrewBeans.all.map(b=>[b.id,recipe(b.id,{grind:.5,temperature:92})]));
 const cold=recipe('huila',{temperature:58}),hot=recipe('huila',{temperature:94}),coarse=recipe('huila',{grind:.05}),fine=recipe('huila',{grind:.95});
 const none=M.create({dose:0,prepared:false});for(let i=0;i<600;i++)M.step(none,{flow:10,x:0,y:0},dt);
 const water=M.create({beanId:'huila',grind:.8});for(let i=0;i<1500;i++)M.step(water,{flow:7,x:0,y:0},dt);const before=water.freeWater;for(let i=0;i<600;i++)M.step(water,{flow:0,x:0,y:0},dt);const after=water.freeWater;
 const p=P.create();P.load(p);for(let i=0;i<150;i++)P.grind(p,.2);p.stage='dose';p.container={x:540,y:170,tilt:.8,held:true};for(let i=0;i<400;i++)P.step(p,dt);const q0=P.bedQuality(p);for(let i=0;i<140;i++)P.level(p,15);const q1=P.bedQuality(p);
 let error=0;const control=C.create();C.setAim(control,.4,-.3);C.step(control,dt);C.begin(control);for(let f=0;f<=6.5;f+=.25){C.setFlow(control,f);for(let j=0;j<20;j++)C.step(control,dt);const g=R.geometry(C.pose(control));error=Math.max(error,Math.abs(g.x-.4),Math.abs(g.y+.3));}
 const mass=recipes.huila.mass;const frozen=JSON.stringify(water);M.finish(water);const ended=JSON.stringify(water);M.step(water,{flow:9,x:0,y:0},dt);
 return {recipes,same,cold,hot,coarse,fine,empty:M.finish(M.create()).total,noGrounds:M.finish(none).total,noBloom:recipe('huila',{noBloom:true}),continuous:recipe('huila',{continuous:true}),center:recipe('huila',{center:true}),before,after,powder:{remaining:p.grounds,poured:p.poured,total:p.grounds+p.poured,qualityBefore:q0,qualityAfter:q1,ready:P.canAdvance(p,'dose')},error,mass,frozen:ended===JSON.stringify(water)};
}'''

def slider(page,selector,value):
    page.locator(selector).evaluate('(el,value)=>{el.value=String(value);el.dispatchEvent(new Event("input",{bubbles:true}));}',value)


def prepare(page,bean='huila',practice=False,stage_hook=None):
    page.locator('#start-button').click()
    check(page.locator('#beans-next').is_disabled(),'未選豆不能繼續')
    check(page.locator('.bean-card').count()==6,'六款咖啡卡片')
    page.locator(f'[data-detail="{bean}"]').click()
    check(page.locator('.bean-detail-section').count()==4,'完整產地、品種、特色與沖煮介紹')
    page.locator('#bean-dialog [data-close]').first.click()
    if practice:page.locator('[data-mode="practice"]').click()
    page.locator(f'[data-select="{bean}"]').click();page.locator('#beans-next').click()
    if stage_hook:stage_hook('grind',page)
    check(page.locator('#grind-next').is_disabled(),'未研磨不能繼續')
    slider(page,'#grind-setting',50)
    page.locator('#load-beans').click();page.wait_for_function('!document.getElementById("grind-handle").disabled')
    if stage_hook:stage_hook('grind_loaded',page)
    # 真正以指標繞轉手柄，沒有直接填入研磨進度。
    rect=page.locator('#grind-scene').bounding_box();scale=rect['width']/960
    page.mouse.move(rect['x']+625*scale,rect['y']+202*scale);page.mouse.down()
    for i in range(1,145):
        a=i*.18;page.mouse.move(rect['x']+(480+math.cos(a)*145)*scale,rect['y']+(202+math.sin(a)*65)*scale);page.wait_for_timeout(36)
    page.mouse.up();page.wait_for_function('!document.getElementById("grind-next").disabled')
    check(page.locator('#grind-setting').is_disabled(),'實際轉動研磨完成，刻度固定')
    page.screenshot(path=str(ROOT/'tests/artifacts/phase2-grind.png'),full_page=True)
    page.locator('#grind-next').click();check(page.locator('#dose-next').is_disabled(),'未倒粉不能繼續')
    if stage_hook:stage_hook('dose',page)
    page.wait_for_timeout(150);slider(page,'#powder-angle',85)
    box=page.locator('#powder-cup').bounding_box();rect=page.locator('#dose-scene').bounding_box();scale=rect['width']/960
    x=box['x']+box['width']/2;y=box['y']+box['height']/2
    page.mouse.move(x,y);page.mouse.down();page.mouse.move(x+335*scale,y,steps=12)
    page.wait_for_timeout(700);page.screenshot(path=str(ROOT/'tests/artifacts/phase2-powder.png'))
    page.wait_for_function('!document.getElementById("dose-next").disabled',timeout=6500);page.mouse.up()
    page.locator('#level-bed').focus()
    for _ in range(120):page.keyboard.press('ArrowRight')
    page.locator('#dose-next').click();check(page.locator('#heat-next').is_disabled(),'未準備熱水不能繼續')
    if stage_hook:stage_hook('heat',page)
    check(page.locator('#heat-exact').is_visible()==practice,'精確水溫只在練習顯示')
    page.locator('#heater-toggle').click();check(page.locator('#heat-next').is_disabled(),'加熱中不能直接開始手沖')
    page.wait_for_timeout(10800);page.locator('#heater-toggle').click()
    page.wait_for_function('!document.getElementById("heat-next").disabled')
    page.screenshot(path=str(ROOT/'tests/artifacts/phase2-heat.png'),full_page=True)
    page.locator('#heat-next').click();check(page.locator('#game-screen').is_visible(),'完整準備後進入手沖')


def main():
    (ROOT/'tests/artifacts').mkdir(exist_ok=True)
    server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT)))
    threading.Thread(target=server.serve_forever,daemon=True).start()
    try:
      with sync_playwright() as p:
        browser=p.chromium.launch(executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe',headless=True)
        page=browser.new_page(viewport={'width':1440,'height':1100},reduced_motion='reduce',has_touch=True)
        errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto(f'http://127.0.0.1:{server.server_port}/coffee-brewing-game/')
        page.wait_for_function('window.BrewControls && window.BrewPreparation')
        data=page.evaluate(MODEL_CASES)
        (ROOT/'tests/artifacts/phase2-model.json').write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
        print('MODEL',json.dumps({k:v['score'] for k,v in data['recipes'].items()},ensure_ascii=False),flush=True)
        check(data['error']<1e-9,'柔和流量靜止落點精準')
        check(data['empty']==0 and data['noGrounds']==0,'空杯／無粉不能得分')
        check(abs(data['mass'])<1e-6,'水量守恆')
        check(data['frozen'],'結束後模型凍結')
        check(data['fine']['peak']>data['coarse']['peak'],'細研磨比粗研磨更容易積水')
        check(data['after']<data['before'],'停水後上方積水仍下降')
        check(data['hot']['extraction']>data['cold']['extraction']+.1,'水溫實際影響萃取')
        check(len({round(v['extraction'],3) for v in data['same'].values()})>=4,'同樣操作選不同豆改變萃取')
        check(min(v['score'] for v in data['recipes'].values())>=80,'六款合理準備策略皆可高分')
        check(data['noBloom']['score']<85 and data['continuous']['score']<65,'省略悶蒸與猛灌受限')
        check(data['powder']['ready'] and abs(data['powder']['total']-18)<.001,'豆粉轉換與倒粉份量守恆')
        check(data['powder']['qualityAfter']>data['powder']['qualityBefore'],'輕晃確實改善乾粉分布')
        page.evaluate('''() => {const draw=BrewRenderer.Renderer.prototype.draw;BrewRenderer.Renderer.prototype.draw=function(s,k,t){if(!this.preview)window.testBrew={aim:BrewRenderer.geometry(k),free:s.freeWater,pore:s.poreWater,temperature:s.temperature,total:s.totalWater};return draw.call(this,s,k,t);};}''')
        page.locator('#start-button').click();page.screenshot(path=str(ROOT/'tests/artifacts/phase2-beans.png'),full_page=True)
        page.locator('.prep-home').first.click()
        prepare(page,practice=True)
        check(page.locator('#game-temperature').is_visible(),'練習顯示沖煮水溫')
        for view in ['overview','overhead','close']:
            page.locator(f'button[data-view="{view}"]').click()
            kettle=page.locator('#kettle');box=kettle.bounding_box();x=box['x']+box['width']*.55;y=box['y']+box['height']*.5
            page.mouse.move(x,y);page.mouse.down();page.wait_for_timeout(400)
            aim_before=page.evaluate('testBrew.aim')
            before=kettle.evaluate('(el)=>el.style.left');page.mouse.wheel(0,-160);page.wait_for_timeout(350)
            check(float(page.locator('#flow-setting').input_value())>4,f'{view} 滾輪增加流量')
            check(kettle.evaluate('(el)=>el.style.left')!=before,f'{view} 壺身補償旋轉位移')
            check(page.evaluate('testBrew.aim.x')==aim_before['x'] and page.evaluate('testBrew.aim.y')==aim_before['y'],f'{view} 增強流量落點穩定')
            page.mouse.wheel(0,160);page.wait_for_timeout(200)
            check(page.evaluate('testBrew.aim.x')==aim_before['x'] and page.evaluate('testBrew.aim.y')==aim_before['y'],f'{view} 減弱流量落點穩定')
            page.screenshot(path=str(ROOT/f'tests/artifacts/phase2-water-{view}.png'))
            page.mouse.up();check(kettle.get_attribute('aria-pressed')=='false',f'{view} 放開立即停止')
        page.locator('#control-mode').select_option('drag')
        box=page.locator('#kettle').bounding_box();scene=page.locator('#scene').bounding_box();scale=scene['width']/960*1.42
        x=box['x']+box['width']*.55;y=box['y']+box['height']*.5
        page.mouse.move(x,y);page.mouse.down();page.mouse.move(x,y+80*scale,steps=10);page.wait_for_timeout(400)
        check(abs(page.evaluate('testBrew.aim.x'))<1e-8 and abs(page.evaluate('testBrew.aim.y'))<1e-8,'舊式上下拖曳也不偏移落點')
        page.mouse.up();page.locator('#control-mode').select_option('wheel')
        slider(page,'#flow-setting',6)
        page.locator('#kettle').focus();page.keyboard.down('Space');page.wait_for_timeout(17000);page.keyboard.up('Space')
        free_before=page.evaluate('testBrew.free');check(free_before>12,'實際持續注水形成上方自由液面')
        for view in ['overview','overhead','close']:
            page.locator(f'button[data-view="{view}"]').click();page.wait_for_timeout(120)
            page.screenshot(path=str(ROOT/f'tests/artifacts/phase2-pool-{view}.png'))
        page.wait_for_timeout(4000);check(page.evaluate('testBrew.free')<free_before,'實際 UI 停水後水位下降')
        page.locator('#kettle').focus();page.keyboard.down('Space');page.keyboard.down('KeyW');page.wait_for_timeout(350);page.keyboard.up('KeyW');page.keyboard.up('Space')
        check(page.locator('#kettle').get_attribute('aria-pressed')=='false','鍵盤停止注水')
        page.locator('#pause-button').click();check(page.locator('#pause-overlay').is_visible(),'原有暫停正常');page.locator('#resume-button').click()
        page.locator('#game-screen .help-trigger').click();page.locator('#help-dialog [data-close]').last.click();page.wait_for_function('document.getElementById("pause-overlay").hidden')
        page.evaluate("Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'))")
        check(page.locator('#pause-overlay').is_visible(),'分頁隱藏自動暫停')
        page.evaluate("Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'))")
        page.locator('#resume-button').click()
        page.set_viewport_size({'width':390,'height':1000});slider(page,'#flow-setting',4)
        b=page.locator('#kettle').bounding_box();x=b['x']+b['width']*.55;y=b['y']+b['height']*.5
        cdp=page.context.new_cdp_session(page);cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y}]});cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x-8,'y':y}]});page.wait_for_timeout(300)
        check(page.locator('#kettle').get_attribute('aria-pressed')=='true','觸控獨立設定流量後可拖曳注水')
        cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});check(page.locator('#kettle').get_attribute('aria-pressed')=='false','觸控放開停止')
        page.locator('#finish-button').click();check(page.locator('#result-parameters').inner_text().find('水溫')>=0,'結算揭露研磨與溫度')
        page.screenshot(path=str(ROOT/'tests/artifacts/phase2-result.png'),full_page=True)
        check(page.locator('#new-best').is_hidden(),'練習不覆寫正式最佳')
        page.locator('#retry-button').click();check(page.locator('#beans-screen').is_visible() and page.locator('#beans-next').is_disabled(),'重試從選豆完整重設')
        for width in [390,768,1280]:
            page.set_viewport_size({'width':width,'height':1000})
            check(page.evaluate('document.documentElement.scrollWidth<=innerWidth'),f'{width}px 選豆無水平溢出')
        check(not errors,f'第二階段無 JavaScript 錯誤：{errors}')
        browser.close();print('ALL PHASE 2 TESTS PASSED',flush=True)
    finally:server.shutdown()


if __name__=='__main__':main()
