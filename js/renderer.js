/* 所有幾何皆採用 960 × 650 的場景座標，避免響應式縮放改變落點。 */
(function (root) {
  'use strict';
  const W = 960, H = 650;
  const BED = { x: 460, y: 324, rx: 120, ry: 35 };
  const TOP_BED = { x: 460, y: 385, rx: 155, ry: 155 };
  const VIEWS = Object.freeze({
    overview: Object.freeze({ label: '全景', scale: 1, tx: 0, ty: 0 }),
    overhead: Object.freeze({ label: '俯視', scale: 1, tx: 0, ty: 0, overhead: true }),
    close: Object.freeze({ label: '近看粉床', scale: 1.42, tx: -215, ty: -58 })
  });
  const clamp = root.BrewModel.clamp;
  function cameraFor(view,s={}){
    const camera=VIEWS[view]||VIEWS.overview;
    if(view!=='close')return camera;
    const fall=clamp((s.dripperDrop||0)/105);
    return {...camera,scale:camera.scale+(1-camera.scale)*fall,tx:camera.tx*(1-fall),ty:camera.ty*(1-fall)};
  }
  function kettleProjection(kettle, view = 'overview',s={}) {
    const camera = cameraFor(view,s);
    const topScale=TOP_BED.rx/BED.rx;
    return camera.overhead ? { x: BED.x + (kettle.x - BED.x) * topScale, y: 140+((kettle.y??156)-156)*topScale, scale: topScale }
      : { x: kettle.x * camera.scale + camera.tx, y: (kettle.y ?? 156) * camera.scale + camera.ty, scale: camera.scale };
  }
  function inputPoint(x, y, view = 'overview',s={}) {
    const camera = cameraFor(view,s);
    const topScale=TOP_BED.rx/BED.rx;
    return camera.overhead ? { x: BED.x + (x - BED.x) / topScale, y: 156+(y-140)/topScale }
      : { x: (x - camera.tx) / camera.scale, y: (y - camera.ty) / camera.scale };
  }
  function bedPoint(x,y,view='overview',s={surfaceHeight:0}){
    if(view==='overhead')return {x:(x-TOP_BED.x)/TOP_BED.rx,y:(y-TOP_BED.y)/TOP_BED.ry};
    const p=inputPoint(x,y,view,s);
    return {x:(p.x-BED.x)/BED.rx,y:(p.y-(BED.y-(s.surfaceHeight||0)*23))/BED.ry};
  }
  function geometry(kettle) {
    const angle = -kettle.tilt * 0.78;
    const sx = kettle.x - 125 * Math.cos(angle) + 39 * Math.sin(angle);
    const sy = (kettle.y ?? 156) - 125 * Math.sin(angle) - 39 * Math.cos(angle);
    const endX = Number.isFinite(kettle.aimX) ? BED.x+(kettle.landingX??kettle.aimX)*BED.rx : sx - 7 - kettle.tilt * 8;
    const aimY = Number.isFinite(kettle.aimY) ? (kettle.landingY??kettle.aimY) : (kettle.tilt - 0.54) * 4.6;
    const endY = BED.y + aimY * BED.ry;
    return { sx, sy, endX, endY, x: (endX - BED.x) / BED.rx, y: aimY, angle };
  }
  function path(ctx, points, fill, stroke, lineWidth = 1) {
    ctx.beginPath(); points(ctx); if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth; ctx.stroke(); }
  }
  function ellipse(ctx, x, y, rx, ry, fill, stroke, width = 1) {
    path(ctx, p => p.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), 0, 0, Math.PI * 2), fill, stroke, width);
  }
  function line(ctx, x1, y1, x2, y2, stroke, width = 1) {
    path(ctx, p => { p.moveTo(x1, y1); p.lineTo(x2, y2); }, null, stroke, width);
  }
  function serverPath(p) {
    p.moveTo(411, 445); p.lineTo(403, 468); p.bezierCurveTo(397, 491, 368, 521, 378, 551);
    p.bezierCurveTo(390, 575, 536, 578, 551, 551); p.bezierCurveTo(561, 528, 530, 487, 523, 468);
    p.lineTo(516, 445); p.closePath();
  }
  class Renderer {
    constructor(canvas, preview = false) {
      this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.preview = preview;
      this.view = 'overview';
      this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.resize = this.resize.bind(this);
      this.observer = new ResizeObserver(this.resize); this.observer.observe(canvas);
      this.resize();
    }
    resize() {
      const rect = this.canvas.getBoundingClientRect();
      if (!rect.width) return;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      this.canvas.width = Math.round(rect.width * ratio);
      this.canvas.height = Math.round(rect.width * H / W * ratio);
    }
    draw(s, kettle, visualTime) {
      const ctx = this.ctx; if (!ctx) return;
      const t = this.reducedMotion ? visualTime * 0.25 : visualTime;
      ctx.setTransform(this.canvas.width / W, 0, 0, this.canvas.height / H, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      if (!this.preview && this.view === 'overhead') { this.drawOverhead(ctx, s, kettle, t); return; }
      const camera = cameraFor(this.preview?'overview':this.view,s);
      ctx.translate(camera.tx, camera.ty); ctx.scale(camera.scale, camera.scale);

      // 背景光暈、枝葉與木質托盤皆由向量繪製，不需外部圖片。
      const glow = ctx.createRadialGradient(455, 330, 40, 455, 330, 300);
      glow.addColorStop(0, '#f8f7ee'); glow.addColorStop(1, '#f8f7ee00');
      ellipse(ctx, 455, 330, 315, 270, glow);
      ctx.save();ctx.globalAlpha = 0.35;
      path(ctx, p => { p.moveTo(194, 430); p.bezierCurveTo(200, 346, 183, 272, 162, 224); }, null, '#849178', 2);
      [[185, 352, -0.6], [174, 301, 0.5], [194, 385, 0.6], [163, 255, -0.5]].forEach(([x,y,r]) => {
        ctx.save();ctx.translate(x,y);ctx.rotate(r);ellipse(ctx,0,-14,10,32,'#a5af94');ctx.restore();
      });ctx.restore();
      ellipse(ctx, 469, 582, 249, 25, '#414b3220');
      path(ctx,p=>{p.moveTo(235,548);p.quadraticCurveTo(235,538,250,538);p.lineTo(701,538);p.quadraticCurveTo(717,539,718,553);p.lineTo(718,578);p.quadraticCurveTo(718,591,700,591);p.lineTo(253,591);p.quadraticCurveTo(235,591,235,578);p.closePath();},'#b99163');
      path(ctx,p=>{p.moveTo(235,547);p.quadraticCurveTo(240,535,255,535);p.lineTo(697,535);p.quadraticCurveTo(711,536,718,547);p.quadraticCurveTo(700,570,475,570);p.quadraticCurveTo(252,569,235,547);},'#cfb58b','#b69a70');
      for(let i=0;i<7;i++)path(ctx,p=>{p.moveTo(264,546+i*2);p.bezierCurveTo(380,539+i*4,539,554-i*2,685,545+i*2);},null,'#ae8f5c35',1);

      this.drawWet(ctx,s,t,false);
      // 器具傾倒的變換讀取物理狀態，直到玩家扶正。
      ctx.save();ctx.translate(464,563);ctx.rotate(s.serverAngle||0);ctx.translate(-464,-563);
      // 分享壺把手先繪製在玻璃後面。
      path(ctx,p=>{p.moveTo(531,471);p.bezierCurveTo(606,450,604,540,549,537);},null,'#bcc4ad',11);
      path(ctx,p=>{p.moveTo(534,472);p.bezierCurveTo(594,458,595,529,551,531);},null,'#fafaf0',5);
      const glass=ctx.createLinearGradient(380,0,550,0);glass.addColorStop(0,'#ffffff66');glass.addColorStop(.3,'#faffed18');glass.addColorStop(.8,'#dfe7d33a');glass.addColorStop(1,'#ffffff85');
      path(ctx, serverPath, glass, '#b5bea5', 2);
      const coffee = clamp(s.beverage / 305);
      if (coffee > 0.0001) {
        ctx.save();path(ctx,serverPath);ctx.clip();
        const top=558-coffee*97;
        const liquid=ctx.createLinearGradient(0,top,0,570);liquid.addColorStop(0,'#98633b');liquid.addColorStop(.3,'#734728');liquid.addColorStop(1,'#482f21');
        ctx.fillStyle=liquid;ctx.fillRect(370,top,195,120);ellipse(ctx,464,top,89,13,'#aa7949');
        line(ctx,393,top+25,393,550,'#e4bd8060',3);ctx.restore();
      }
      path(ctx,p=>{p.moveTo(412,449);p.lineTo(406,468);p.bezierCurveTo(403,490,381,519,385,542);},null,'#ffffffbb',4);
      path(ctx,p=>{p.moveTo(520,487);p.bezierCurveTo(525,505,540,524,540,544);},null,'#ffffff80',3);
      ellipse(ctx,464,446,53,8,'#dce3cf55','#aeb89d',2);
      ctx.restore();
      ctx.save();ctx.translate(460+(s.dripperDrop||0)*.4*(s.knockDirection||1),437+(s.dripperDrop||0));ctx.rotate(s.dripperAngle||0);ctx.translate(-460,-437);
      // 木環與陶瓷濾杯。
      ellipse(ctx,460,437,68,11,'#805a38');ellipse(ctx,460,432,71,11,'#bc9463','#8f714b');
      path(ctx,p=>{p.moveTo(340,304);p.bezierCurveTo(359,339,393,391,428,425);p.quadraticCurveTo(460,439,492,425);p.bezierCurveTo(526,390,561,336,580,304);p.closePath();},'#e3e1ce','#b7bda3',2);
      const ceramic=ctx.createLinearGradient(350,0,570,0);ceramic.addColorStop(0,'#d2ddc56b');ceramic.addColorStop(.3,'#fbffed55');ceramic.addColorStop(.6,'#e4ecd933');ceramic.addColorStop(1,'#c4d1b85e');
      path(ctx,p=>{p.moveTo(344,306);p.quadraticCurveTo(382,367,431,421);p.quadraticCurveTo(460,431,489,421);p.quadraticCurveTo(546,359,577,306);p.closePath();},ceramic);
      for(let i=0;i<10;i++){const x=354+i*23;path(ctx,p=>{p.moveTo(x,318);p.quadraticCurveTo(x+(460-x)*.42,378,444+i*3.5,419);},null,i%2?'#b4bba15c':'#fffdf2cc',3);}
      path(ctx,p=>{p.moveTo(565,332);p.bezierCurveTo(628,310,623,369,552,373);},null,'#c2c9af',11);
      path(ctx,p=>{p.moveTo(571,334);p.bezierCurveTo(611,322,606,357,560,362);},null,'#f5f2df',5);
      ellipse(ctx,460,302,125,46,'#eeebda','#afb99d',2);
      ellipse(ctx,460,300,118,39,'#d4b992');
      ellipse(ctx,460,301,112,35,'#7e5737','#a98456',2);
      // 透明杯壁中的液體截面：只讀取上方自由水量，孔隙含水不冒充液面。
      if(s.freeWater>.05){
        const level=s.surfaceHeight,top=324-level*23;
        ctx.save();path(ctx,p=>{p.moveTo(341,305);p.lineTo(428,424);p.quadraticCurveTo(460,438,492,424);p.lineTo(579,305);p.closePath();});ctx.clip();
        const liquid=ctx.createLinearGradient(0,top,0,382);liquid.addColorStop(0,'#b1966340');liquid.addColorStop(1,'#79543680');ctx.fillStyle=liquid;ctx.fillRect(335,top,250,66+level*14);
        ctx.restore();
      }
      ctx.save();
      path(ctx,p=>{p.moveTo(340,304);p.lineTo(580,304);p.lineTo(492,425);p.quadraticCurveTo(460,438,428,425);p.closePath();p.ellipse(460,302,123,44,0,0,Math.PI*2);});ctx.clip();
      this.drawBed(ctx, s, t, { x: 460, y: 324, rx: 112, ry: 35 });
      ctx.restore();
      path(ctx,p=>p.ellipse(460,302,123,44,0,0,Math.PI),null,'#eee9d6',4);
      path(ctx,p=>p.ellipse(460,302,125,46,0,0,Math.PI),null,'#b2bea1',1.2);
      this.drawRim(ctx,s,t,false);
      this.drawAim(ctx,s,kettle,false);
      ctx.restore();
      this.drawKnockSpray(ctx,s,false);
      // 濾杯下方滴漏，速度及水滴密度由排水量控制。
      if(s.drainage>.08 && s.beverage>0&&!s.dripperTipped&&!s.serverTipped){
        const drops=Math.min(7,Math.ceil(s.drainage*1.2));
        for(let i=0;i<drops;i++){const phase=(t*(1+s.drainage*.12)+i/drops)%1;
          const y=437+phase*(115-coffee*93);ctx.globalAlpha=.45+(1-phase)*.4;
          ellipse(ctx,460+Math.sin(i*17)*1.5,y,1.5,2.5+s.drainage*.25,'#885c35');
        }ctx.globalAlpha=1;
      }
      // 溫熱蒸氣只有在粉床真的濕潤時出現。
      if(s.saturation>.15 && !this.reducedMotion){
        for(let i=0;i<3;i++){ctx.globalAlpha=.1*s.saturation;path(ctx,p=>{p.moveTo(420+i*37,264);p.bezierCurveTo(405+i*37+Math.sin(t+i)*8,242,440+i*30,229,427+i*32,208);},null,'#87967a',2);}ctx.globalAlpha=1;
      }
      if(this.preview) this.drawPreviewKettle(ctx);
      else if(s.flow>0){this.drawStream(ctx,s,kettle,t);}
      // 場景註記是固定器具名稱，沒有量表或最佳時機提示。
      ctx.font='10px "Microsoft JhengHei",sans-serif';ctx.fillStyle='#8c947e';
      line(ctx,606,385,669,399,'#abb298',1);ctx.fillText('玻璃濾杯',680,405);
      line(ctx,373,499,301,507,'#abb298',1);ctx.fillText('玻璃分享壺',231,513);
      ctx.font='8px Georgia,serif';ctx.fillStyle='#8b927c';ctx.fillText('SLOW DOWN. STAY CURIOUS.',361,622);
    }
    drawBed(ctx, s, t, bed) {
      // 各視角共用同一份濕潤分布與氣泡，切換不重建模型。
      const overhead = bed.ry > 100;
      const sx = bed.rx / 112, sy = overhead ? sx : 1;
      ctx.save();ctx.beginPath();ctx.ellipse(bed.x,bed.y,bed.rx,bed.ry,0,0,Math.PI*2);ctx.clip();
      ellipse(ctx,bed.x,bed.y,bed.rx,bed.ry,s.dose===0?'#e8dec5':'#7e5737');
      const roast=s.bean?.color||'#805535',rgb=[1,3,5].map(i=>parseInt(roast.slice(i,i+2),16));
      for(let i=0;i<330;i++) {
        const a=i*2.39996,r=Math.sqrt((i+.5)/330)*1.02;
        const x=Math.cos(a)*r,y=Math.sin(a)*r;
        let closest=s.cells[0],dist=Infinity;
        s.cells.forEach(c=>{const d=(c.x-x)**2+(c.y-y)**2;if(d<dist){dist=d;closest=c;}});
        const wet=closest.wet;
        const swell = overhead ? 1 + wet * s.bloomActivity * .025 : 1;
        const jitter=(closest.agitation||0)*(2+s.flow*.7);
        const px=bed.x+x*bed.rx*swell+Math.sin(t*31+i*8)*jitter*sx,py=bed.y+y*bed.ry*swell-(overhead?0:wet*s.bloomActivity*5+(closest.groundDensity||1)*1.5)+(closest.erosion||0)*(overhead?0:15)+Math.cos(t*25+i)*jitter*(overhead?1:.25);
        const shade=(i%7)*3;
        ctx.fillStyle=`rgb(${Math.max(24,Math.round(rgb[0]-wet*48+shade))},${Math.max(17,Math.round(rgb[1]-wet*32+shade*.7))},${Math.max(10,Math.round(rgb[2]-wet*20+shade*.4))})`;
        ctx.beginPath();ctx.ellipse(px,py,(4+(i%3))*sx,(2+(i%2))*sy,a,0,Math.PI*2);ctx.fill();
      }
      // 每個區域保留實際侵蝕與通道，停水之後坑洞仍然存在。
      s.cells.forEach(c=>{
        if(c.erosion<.025)return;
        const x=bed.x+c.x*bed.rx,y=bed.y+c.y*bed.ry,depth=c.erosion;
        const rx=(9+depth*14)*sx,ry=rx*(overhead?1:.33);
        const crater=ctx.createRadialGradient(x,y,1,x,y,rx);
        crater.addColorStop(0,`rgba(30,22,15,${depth*.9})`);crater.addColorStop(.62,`rgba(41,29,17,${depth*.65})`);crater.addColorStop(1,'#21170f00');
        ellipse(ctx,x,y,rx,ry,crater);
        path(ctx,q=>q.ellipse(x,y,rx,ry,0,Math.PI*.1,Math.PI*.9),null,`rgba(190,143,83,${depth*.8})`,1+depth*2);
        if(c.channel>.2)ellipse(ctx,x,y,2+c.channel*4,(2+c.channel*4)*(overhead?1:.3),'#211c16aa');
      });
      const level=clamp(s.surfaceHeight||0);
      // 過程氣泡由局部濕潤及釋氣強度控制，採固定種子幾何，不改變評分。
      if(s.started) s.cells.forEach((c,i)=>{
        const activity=c.wet*s.bloomActivity;
        if(activity<.12)return;
        const cycle=(t*(.3+(i%4)*.04)+i*.137)%1;
        const radius=(1+Math.sin(cycle*Math.PI)*4)*activity;
        if(cycle>.9)return;
        ctx.globalAlpha=(1-cycle)*activity*.8;
        ellipse(ctx,bed.x+c.x*bed.rx*.94,bed.y+c.y*bed.ry*.9-(overhead?0:level*4),radius*sx,radius*(overhead?1:.55),'#ba925a','#d5b87d',.7);
      });ctx.globalAlpha=1;
      ctx.restore();
      if(level>.005){
        const top=bed.y-(overhead?0:level*23),rx=bed.rx+(overhead?0:level*7),ry=bed.ry+(overhead?0:level*2);
        const water=ctx.createLinearGradient(bed.x-rx,top-ry,bed.x+rx,top+ry);
        water.addColorStop(0,`rgba(181,156,102,${.16+level*.52})`);water.addColorStop(.48,`rgba(122,91,49,${.2+level*.5})`);water.addColorStop(1,`rgba(206,180,124,${.2+level*.55})`);
        ellipse(ctx,bed.x,top,rx,ry,water,'#c6b08099',1+level);
        ctx.save();ctx.beginPath();ctx.ellipse(bed.x,top,rx,ry,0,0,Math.PI*2);ctx.clip();
        for(let i=0;i<3;i++){const phase=(t*(s.flow>.1?1.4:.45)+i/3)%1;ctx.globalAlpha=(1-phase)*clamp(level*2)*.55;const x=bed.x+(s.aimX||0)*bed.rx,y=top+(s.aimY||0)*bed.ry;ellipse(ctx,x,y,5+phase*42,(5+phase*42)*(overhead?1:.3),null,'#e5d5aa',1.2);}
        ctx.globalAlpha=1;path(ctx,p=>p.ellipse(bed.x-rx*.12,top,rx*.72,ry*.8,0,Math.PI*1.08,Math.PI*1.62),null,'#fff6d180',1.5);
        if(s.bloomActivity>.1)for(let i=0;i<9;i++){const a=i*2.4,r=.65*Math.sqrt((i+.5)/9),radius=(2+(i%3))*s.bloomActivity;ellipse(ctx,bed.x+Math.cos(a)*r*rx,top+Math.sin(a)*r*ry,radius*(overhead?1.5:1),radius*(overhead?1.5:.55),'#b89353','#ead6a166');}
        ctx.restore();
      }
      if(!overhead&&s.overflowRate>.01){for(const side of [-1,1]){const x=bed.x+side*122;path(ctx,p=>{p.moveTo(x,bed.y-23);p.bezierCurveTo(x+side*5,360,x+side*10,407,x+side*15,442);},null,'#b69b6280',2.8);}}
    }
    drawOverhead(ctx, s, kettle, t) {
      const b=TOP_BED;
      const glow=ctx.createRadialGradient(b.x,b.y,45,b.x,b.y,290);
      glow.addColorStop(0,'#f9f8ef');glow.addColorStop(1,'#f9f8ef00');
      ellipse(ctx,b.x,b.y,300,260,glow);
      this.drawWet(ctx,s,t,true);
      ctx.save();ctx.translate(b.x+(s.dripperDrop||0)*.7*(s.knockDirection||1),b.y+(s.dripperDrop||0)*.2);ctx.rotate((s.dripperAngle||0)*.5);ctx.scale(1,1-Math.abs(s.dripperAngle||0)*.5);ctx.translate(-b.x,-b.y);
      ellipse(ctx,b.x+4,b.y+10,190,190,'#34462c13');
      ellipse(ctx,b.x,b.y,184,184,'#c8ad82','#aa9067',2);
      for(let i=0;i<5;i++)ellipse(ctx,b.x,b.y,174+i*2,174+i*2,null,'#ead4ab45');
      ellipse(ctx,b.x+185,b.y,33,40,'#d7ddc7','#afb99c',2);
      ellipse(ctx,b.x+185,b.y,18,25,'#eceee3','#b7c1a5',2);
      ellipse(ctx,b.x,b.y,176,176,'#f3f0de','#b6c0a4',2);
      for(let i=0;i<32;i++){
        const a=i/32*Math.PI*2;
        line(ctx,b.x+Math.cos(a)*160,b.y+Math.sin(a)*160,b.x+Math.cos(a)*173,b.y+Math.sin(a)*173,'#cfceb5',2);
      }
      ellipse(ctx,b.x,b.y,160,160,'#d4b992');
      this.drawBed(ctx,s,t,b);
      this.drawRim(ctx,s,t,true);this.drawAim(ctx,s,kettle,true);
      ctx.restore();this.drawKnockSpray(ctx,s,true);
      // 俯視時以同畫面的分享壺小窗保留咖啡累積觀察。
      const cx=172,cy=492,coffee=clamp(s.beverage/305);
      ctx.save();ctx.translate(cx,cy);ctx.rotate((s.serverAngle||0)*.6);ctx.scale(1,1-Math.abs(s.serverAngle||0)*.45);ctx.translate(-cx,-cy);
      ellipse(ctx,cx+64,cy,18,25,null,'#b6c0a5',5);
      ellipse(ctx,cx,cy,57,57,'#ffffff40','#b2bca1',2);
      ctx.save();ctx.beginPath();ctx.arc(cx,cy,49,0,Math.PI*2);ctx.clip();
      if(coffee>0){ctx.fillStyle='#78502e';ctx.fillRect(cx-49,cy+49-coffee*98,98,98);ellipse(ctx,cx,cy+49-coffee*98,49,5,'#ad7c48');}
      ctx.restore();ellipse(ctx,cx,cy,49,49,null,'#ffffff90',2);
      ctx.restore();ctx.font='11px "Microsoft JhengHei",sans-serif';ctx.fillStyle='#7f8973';ctx.textAlign='center';ctx.fillText(s.serverTipped?'分享壺：我先躺一下。':'分享壺 · 咖啡累積',cx,cy+81);
      ctx.fillText('俯視粉床 · 觀察每一處濕潤與氣泡',b.x,611);ctx.textAlign='left';
      if(s.flow>0)this.drawWater(ctx,s,kettle,t,true);
    }
    drawKnockSpray(ctx,s,overhead){
      if(s.knockAge>1.1||s.lastKnockWater<=0)return;
      const age=s.knockAge,b=overhead?TOP_BED:BED,dir=s.knockDirection||1;
      const count=Math.min(32,6+Math.ceil(s.lastKnockWater*.4));
      ctx.save();ctx.globalAlpha=Math.max(0,1-age/1.1);
      for(let i=0;i<count;i++){
        const vx=dir*(35+(i*37)%180),vy=-45-(i*29)%90;
        const x=b.x+vx*age,y=(overhead?b.y:400)+vy*age+150*age*age;
        ellipse(ctx,x,y,2+(i%3),overhead?3:5,'#a17a4baa');
      }ctx.restore();
    }
    drawWet(ctx,s,t,overhead){
      for(const patch of s.tablePatches||[]){
        if(patch.water<.015)continue;
        const x=overhead?TOP_BED.x+patch.x*TOP_BED.rx:BED.x+patch.x*BED.rx;
        const y=overhead?TOP_BED.y+patch.y*TOP_BED.ry:555+patch.y*10;
        const radius=Math.min(65,5+Math.sqrt(patch.water)*7),ry=radius*(overhead?.75:.24);
        const puddle=ctx.createRadialGradient(x,y,0,x,y,radius);
        puddle.addColorStop(0,`rgba(76,88,66,${Math.min(.55,.12+patch.water*.018)})`);puddle.addColorStop(.8,'#67795835');puddle.addColorStop(1,'#67795800');
        ellipse(ctx,x,y,radius,ry,puddle,'#79896c33');
        path(ctx,q=>q.ellipse(x-radius*.12,y-ry*.08,radius*.65,ry*.65,0,Math.PI*1.05,Math.PI*1.7),null,'#f8ffeb99',1.2);
        if(patch.water>5)ellipse(ctx,x+radius*.5,y+ry*.4,3,overhead?2.5:1,'#c6d6af99');
      }
    }
    drawRim(ctx,s,t,overhead){
      (s.rimWet||[]).forEach((water,i)=>{
        if(water<.03)return;const a=(i+.5)/16*Math.PI*2-Math.PI;
        const b=overhead?TOP_BED:BED,x=b.x+Math.cos(a)*b.rx*1.05,y=(overhead?b.y:302)+Math.sin(a)*(overhead?b.ry*1.05:43);
        const wet=Math.min(1,water/8);ellipse(ctx,x,y,overhead?10:7,overhead?11:5,`rgba(110,136,110,${.15+wet*.45})`);
        if(!overhead){
          const length=12+wet*73;
          path(ctx,q=>{q.moveTo(x,y);q.quadraticCurveTo(x+(460-x)*.1,y+length*.5,x+(460-x)*.23,y+length);},null,'#8ea38e80',1+wet*2);
          const age=s.elapsed-(s.rimWetAt?.[i]??s.elapsed);
          if(age<12){const v=(t*.65+i*.19)%1;ctx.globalAlpha=Math.exp(-age/8);ellipse(ctx,x+(460-x)*.23*v,y+v*length,1.3+wet,2.3+wet,'#d7e5cfcc');ctx.globalAlpha=1;}
        }
      });
    }
    drawAim(ctx,s,kettle,overhead){
      if(this.preview||s.dripperTipped||!Number.isFinite(kettle.aimX))return;
      const b=overhead?TOP_BED:BED,x=b.x+kettle.aimX*b.rx,y=b.y+kettle.aimY*b.ry-(overhead?0:s.surfaceHeight*23);
      ctx.save();ctx.setLineDash([3,4]);ellipse(ctx,x,y,overhead?8:7,overhead?8:3,null,'#f7efcfaa',1.3);ctx.restore();
    }
    drawStream(ctx,s,kettle,t){this.drawWater(ctx,s,kettle,t,false);}
    drawWater(ctx,s,kettle,t,overhead){
      const g=geometry(kettle),f=clamp(s.flow/10.5),hit=!s.dripperTipped&&Math.hypot(g.x,g.y)<=1.08;
      const p=overhead?kettleProjection(kettle,'overhead'):null;
      const sx=overhead?p.x+(-125*Math.cos(g.angle)+39*Math.sin(g.angle))*p.scale:g.sx;
      const sy=overhead?p.y+(-125*Math.sin(g.angle)-39*Math.cos(g.angle))*p.scale:g.sy;
      const ex=overhead?TOP_BED.x+g.x*TOP_BED.rx:g.endX;
      const ey=overhead?TOP_BED.y+g.y*TOP_BED.ry:hit?g.endY-s.surfaceHeight*23:555+g.y*10;
      const bx=(sx+ex)*.5+Math.sin(t*27)*f*f*8,by=(sy+ey)*.5;
      const width=.6+Math.pow(f,1.65)*12;
      const water=ctx.createLinearGradient(sx,sy,ex,ey);
      water.addColorStop(0,`rgba(147,184,168,${.38+f*.5})`);water.addColorStop(.7,'#b3d3c3dd');water.addColorStop(1,'#ecffe1');
      ctx.save();if(s.flow<1.3)ctx.setLineDash([2,5]);
      path(ctx,q=>{q.moveTo(sx,sy);q.quadraticCurveTo(bx,by,ex,ey);},null,'#71988088',width+1);
      path(ctx,q=>{q.moveTo(sx,sy);q.quadraticCurveTo(bx,by,ex,ey);},null,water,width);
      ctx.setLineDash([]);path(ctx,q=>{q.moveTo(sx-.5,sy);q.quadraticCurveTo(bx-.5,by,ex,ey);},null,'#f5ffefc0',.4+f*2.2);
      // 行進水滴採相同曲線與落點，大流量明顯更密、更快。
      const count=3+Math.floor(f*15);
      for(let i=0;i<count;i++){
        const v=(t*(.8+f*3.2)+i/count)%1,u=1-v;
        const x=u*u*sx+2*u*v*bx+v*v*ex,y=u*u*sy+2*u*v*by+v*v*ey;
        ellipse(ctx,x,y,.7+f*1.7,1.8+f*3,'#f5ffe5aa');
      }
      const splashCount=2+Math.floor(f*f*22);
      for(let i=0;i<splashCount;i++){
        const v=(t*(1.4+f*2)+i*.137)%1,a=i*2.39996,r=v*(5+f*f*40);
        const x=ex+Math.cos(a)*r,y=ey+Math.sin(a)*r*(overhead?1:.24)-Math.sin(v*Math.PI)*(3+f*f*24);
        ctx.globalAlpha=(1-v)*(.25+f*.6);ellipse(ctx,x,y,.7+f*1.8,1+f*2,hit?'#d8dfb8':'#bfd6c5');
      }
      for(let i=0;i<3;i++){const v=(t*(.9+f*2)+i/3)%1;ctx.globalAlpha=(1-v)*(.2+f*.6);ellipse(ctx,ex,ey,2+v*(8+f*f*40),(2+v*(8+f*f*40))*(overhead?1:.27),null,hit?'#ecd3a0':'#b6d3b6',.7+f*1.3);}
      ctx.restore();
    }
    drawPreviewKettle(ctx){
      ctx.save();ctx.translate(652,166);ctx.rotate(-.22);
      path(ctx,p=>{p.moveTo(64,-24);p.bezierCurveTo(132,-45,132,57,69,45);},null,'#334c3d',15);
      path(ctx,p=>{p.moveTo(-38,31);p.bezierCurveTo(-93,34,-73,-33,-126,-38);p.lineTo(-128,-45);p.bezierCurveTo(-63,-47,-70,0,-29,1);p.closePath();},'#4e6550','#2d4533',2);
      const metal=ctx.createLinearGradient(-50,-30,80,60);metal.addColorStop(0,'#526b55');metal.addColorStop(.6,'#314c3b');metal.addColorStop(1,'#203929');
      path(ctx,p=>{p.moveTo(-43,-24);p.quadraticCurveTo(-57,18,-54,45);p.bezierCurveTo(-35,78,64,78,84,45);p.lineTo(66,-24);p.closePath();},metal,'#2b4432',2);
      ellipse(ctx,12,-24,54,10,'#2c4533');path(ctx,p=>{p.moveTo(-33,-28);p.quadraticCurveTo(11,-60,56,-28);},'#4d654d','#304833',2);
      path(ctx,p=>{p.moveTo(4,-47);p.lineTo(4,-57);p.quadraticCurveTo(12,-65,21,-57);p.lineTo(21,-47);},'#b78f5e');
      path(ctx,p=>{p.moveTo(-34,-8);p.quadraticCurveTo(-42,22,-36,43);},null,'#91a28455',5);ctx.restore();
      // 首頁是器具插畫，沒有與操作脫離的沖煮示範動畫。
    }
  }
  root.BrewRenderer={ Renderer, geometry, kettleProjection, inputPoint, bedPoint, VIEWS, TOP_BED, BED, W, H };
})(globalThis);
