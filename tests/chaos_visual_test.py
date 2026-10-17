"""以真正物理狀態比較局部坑洞、水痕與流量畫面，並觀察有限場景繪製成本。"""
import json
from support import ROOT,sync_playwright,check
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe',headless=True)
 page=browser.new_page(viewport={'width':960,'height':650},reduced_motion='reduce')
 page.set_content('<body style="margin:0;background:#eeeee2"><canvas id="view" style="width:960px;height:650px"></canvas></body>')
 for name in ['beans','chaos','model','controls','renderer']:
  page.add_script_tag(path=str(ROOT/'js'/(name+'.js')))
 result=page.evaluate('''() => {
  const M=BrewModel,C=BrewControls,R=BrewRenderer,dt=1/60;
  const dry=M.create(),local=M.create(),flood=M.create();
  for(let i=0;i<3600;i++){
   M.step(local,{flow:i<1500?9:0,x:.15,y:.1,instability:.7},dt);
   M.step(flood,{flow:i<1800?10:0,x:i<800?.98:1.4,y:.2,instability:.8},dt);
  }
  const renderer=new R.Renderer(document.getElementById('view')),control=C.create();
  C.setAim(control,.15,.1);C.step(control,dt);const kettle=C.pose(control),different={};
  window.visualRenderer=renderer;window.visualStates={dry,local,flood};window.visualKettle=kettle;
  for(const view of Object.keys(R.VIEWS)){
   renderer.view=view;renderer.draw(dry,kettle,60);const a=renderer.canvas.toDataURL();
   renderer.draw(local,kettle,60);const b=renderer.canvas.toDataURL();
   renderer.draw(flood,kettle,60);const c=renderer.canvas.toDataURL();different[view]=a!==b&&b!==c;
  }
  renderer.view='overhead';const before=performance.now();
  for(let i=0;i<120;i++)renderer.draw(flood,kettle,60+i/60);
  const millisecondsPerDraw=(performance.now()-before)/120;
  return {different,channel:local.channeling,wetRim:flood.rimWet.reduce((a,b)=>a+b,0),table:flood.tableWater,millisecondsPerDraw};
 }''')
 check(all(result['different'].values()),'三視角區分乾粉、實際侵蝕坑洞與水災水痕')
 check(result['channel']>.5 and result['wetRim']>0 and result['table']>100,'截圖來自真實局部侵蝕、杯緣濕痕與桌面水量')
 for view in ['overview','overhead','close']:
  for state in ['local','flood']:
   page.evaluate('''([view,state])=>{visualRenderer.view=view;visualRenderer.draw(visualStates[state],visualKettle,60);}''',[view,state])
   page.screenshot(path=str(ROOT/f'tests/artifacts/chaos-{state}-{view}.png'))
 # 以正式物理和控制跑出四種流量，不用假資料貼圖比較。
 for flow in [.7,4,7,10.5]:
  page.evaluate('''flow=>{const c=BrewControls.create(),s=BrewModel.create();BrewControls.setFlow(c,flow);BrewControls.begin(c);for(let i=0;i<120;i++){BrewControls.step(c,1/60);const k=BrewControls.pose(c),g=BrewRenderer.geometry(k);BrewModel.step(s,{flow:k.flow,x:g.x,y:g.y},1/60);}visualRenderer.view='overview';visualRenderer.draw(s,BrewControls.pose(c),2);}''',flow)
  page.screenshot(path=str(ROOT/f'tests/artifacts/chaos-flow-{flow}.png'))
 (ROOT/'tests/artifacts/chaos-render.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
 print('OBSERVED ms/draw',round(result['millisecondsPerDraw'],2),'(此機器 headless Canvas，非跨硬體 FPS 保證)',flush=True)
 browser.close();print('ALL CHAOS VISUAL TESTS PASSED')
