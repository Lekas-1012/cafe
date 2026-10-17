"""三視角幾何與正式水位模型的渲染整合；UI 拖曳另由 browser_test.py 驗證。"""
from support import ROOT,sync_playwright,check
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe',headless=True)
    page=b.new_page(viewport={'width':1200,'height':900},reduced_motion='reduce')
    page.set_content('<canvas id="view" style="width:960px;height:650px"></canvas>')
    for name in ['beans','chaos','model','controls','renderer']:
        page.add_script_tag(path=str(ROOT/'js'/(name+'.js')))
    result=page.evaluate('''() => {
      const C=BrewControls,R=BrewRenderer,M=BrewModel,c=C.create();
      C.setAim(c,.42,-.31);C.step(c,1/60);C.begin(c);let error=0;
      for(let flow=0;flow<=10.5;flow+=.25){
        C.setFlow(c,flow);for(let i=0;i<40;i++)C.step(c,1/60);
        const k=C.pose(c),g=R.geometry(k);
        if(flow<=6.5)error=Math.max(error,Math.abs(g.x-.42),Math.abs(g.y+.31));
        for(const view of Object.keys(R.VIEWS)){
          const a=R.kettleProjection(k,view),p=R.inputPoint(a.x,a.y,view);
          error=Math.max(error,Math.abs(p.x-k.x),Math.abs(p.y-(k.y??156)));
        }
      }
      const renderer=new R.Renderer(document.getElementById('view'));
      const dry=M.create({beanId:'huila'}),wet=M.create({beanId:'huila',grind:.8});
      for(let i=0;i<2000;i++)M.step(wet,{flow:6,x:.42,y:-.31},1/60);
      const different={};
      for(const view of Object.keys(R.VIEWS)){
        renderer.view=view;renderer.draw(dry,C.pose(c),0);const before=renderer.canvas.toDataURL();
        renderer.draw(wet,C.pose(c),33);different[view]=before!==renderer.canvas.toDataURL();
      }
      function simulate(fps){const s=M.create({beanId:'huila',grind:.5});for(let i=0;i<fps*85;i++)M.step(s,{flow:i/fps<25?5:0,x:.3*Math.sin(i/fps),y:.2*Math.cos(i/fps)},1/fps);return {beverage:s.beverage,extraction:s.cells.reduce((a,c)=>a+c.extraction,0)/s.cells.length,total:s.totalWater};}
      const a=simulate(60),b=simulate(30),repeat=simulate(60);
      return {error,different,free:wet.freeWater,dtVolumeError:Math.abs(a.beverage-b.beverage),dtExtractionError:Math.abs(a.extraction-b.extraction),repeat:JSON.stringify(a)===JSON.stringify(repeat)};
    }''')
    check(result['error']<1e-9,'三視角投影一致、柔和流量靜止落點精準')
    check(result['free']>20,'正式模型建立可見積水')
    check(all(result['different'].values()),'三種視角皆隨液面狀態改變畫面')
    check(result['dtVolumeError']<.2 and result['dtExtractionError']<.005,'30／60Hz 物理差異在容許範圍')
    check(result['repeat'],'相同操作重複模擬完全一致')
    b.close()
    print('ALL VIEW TESTS PASSED')
