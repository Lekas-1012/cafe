/* 原創 Canvas 器具。所有材料數量、轉動、粉末與蒸氣來自準備狀態。 */
(function(root){
  'use strict';
  const ellipse=(c,x,y,rx,ry,fill,stroke,width=1)=>{c.beginPath();c.ellipse(x,y,Math.max(.01,rx),Math.max(.01,ry),0,0,Math.PI*2);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}};
  const path=(c,fn,fill,stroke,width=1)=>{c.beginPath();fn(c);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}};
  function bean(c,x,y,r,color,angle=0){c.save();c.translate(x,y);c.rotate(angle);ellipse(c,0,0,r*.7,r,color,'#3c281c55');path(c,p=>{p.moveTo(0,-r*.8);p.bezierCurveTo(-r*.5,-r*.2,r*.4,r*.2,0,r*.8);},null,'#d7ad7455',1.3);c.restore();}
  class PreparationRenderer{
    constructor(canvas){this.canvas=canvas;this.ctx=canvas.getContext('2d');this.resize=()=>{const r=canvas.getBoundingClientRect();if(!r.width)return;const d=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(r.width*d);canvas.height=Math.round(r.width*650/960*d);};new ResizeObserver(this.resize).observe(canvas);this.resize();}
    draw(p,stage,t){
      const c=this.ctx;c.setTransform(this.canvas.width/960,0,0,this.canvas.height/650,0,0);c.clearRect(0,0,960,650);c.lineCap='round';c.lineJoin='round';
      const glow=c.createRadialGradient(480,320,20,480,320,300);glow.addColorStop(0,'#faf9ed');glow.addColorStop(1,'#faf9ed00');ellipse(c,480,320,330,290,glow);
      ellipse(c,480,565,240,24,'#36462b18');
      path(c,q=>{q.moveTo(238,540);q.quadraticCurveTo(480,515,722,540);q.lineTo(722,563);q.quadraticCurveTo(480,597,238,563);q.closePath();},'#b58f61');
      ellipse(c,480,541,242,21,'#cfb68c','#ae9168');
      if(stage==='grind')this.grinder(c,p,t);
      if(stage==='dose')this.doser(c,p,t);
      if(stage==='heat')this.heater(c,p,t);
      c.font='9px Georgia,serif';c.fillStyle='#8a937a';c.textAlign='center';c.fillText('ONE BEAN. ONE MOMENT. ONE CUP.',480,612);c.textAlign='left';
    }
    grinder(c,p,t){
      const b=root.BrewBeans.get(p.beanId);
      // 下方透明粉杯：磨出的份量逐步增加。
      path(c,q=>{q.moveTo(408,388);q.lineTo(413,522);q.quadraticCurveTo(480,550,547,522);q.lineTo(552,388);q.closePath();},'#faffea35','#9ca98d',2);
      const fill=p.grounds/p.dose;
      if(fill>0){path(c,q=>{q.moveTo(417,520-fill*82);q.quadraticCurveTo(480,505-fill*82,543,520-fill*82);q.lineTo(541,521);q.quadraticCurveTo(480,544,419,521);q.closePath();},b.color);for(let i=0;i<90*fill;i++){const x=423+(i*37.7)%112,y=516-fill*70+(i*17.3)%(Math.max(1,fill*67));ellipse(c,x,y,1.5,1,b.color);}}
      path(c,q=>{q.moveTo(405,235);q.lineTo(407,390);q.quadraticCurveTo(480,418,553,390);q.lineTo(555,235);q.closePath();},'#334f3e','#263c2d',2);
      const metal=c.createLinearGradient(406,0,554,0);metal.addColorStop(0,'#35523f');metal.addColorStop(.35,'#566e51');metal.addColorStop(.8,'#344d3c');metal.addColorStop(1,'#233d2e');
      path(c,q=>{q.moveTo(411,240);q.lineTo(414,382);q.quadraticCurveTo(480,406,546,382);q.lineTo(550,240);q.closePath();},metal);
      for(let i=0;i<28;i++)path(c,q=>{q.moveTo(415+i*4.8,267);q.lineTo(418+i*4.5,379);},null,i%2?'#adc09a25':'#162c2025');
      ellipse(c,480,237,75,20,'#b49c75','#8b815f',2);ellipse(c,480,234,67,16,'#4d4630');
      const count=p.loaded?Math.ceil(p.beansRemaining*2.2):0;
      for(let i=0;i<count;i++){const a=i*2.4,r=Math.sqrt((i+.5)/42)*52;bean(c,480+Math.cos(a)*r,233+Math.sin(a)*r*.25,5.5,b.color,a);}
      // 尚未放入時，左側保留一份豆子，放入後它消失。
      if(!p.loaded){ellipse(c,275,480,62,17,'#d7c5a3','#aa946e');for(let i=0;i<30;i++){const a=i*2.4,r=Math.sqrt((i+.5)/30)*48;bean(c,275+Math.cos(a)*r,477+Math.sin(a)*r*.28,6,b.color,a);}}
      path(c,q=>{q.moveTo(480,232);q.lineTo(480,201);},null,'#8f9b7f',8);
      const hx=480+Math.cos(p.crankAngle)*145,hy=202+Math.sin(p.crankAngle)*65;
      if(p.handleBroken){
        path(c,q=>{q.moveTo(480,202);q.lineTo(506,206);},null,'#78886b',8);
        const flight=Math.min(1,p.breakAge*2.5),rx=610+Math.sin(flight*2)*70,ry=210+flight*300;
        c.save();c.translate(rx,ry);c.rotate(flight*3.6);path(c,q=>{q.moveTo(-68,0);q.lineTo(48,0);},null,'#78886b',8);ellipse(c,48,0,23,17,'#81552e','#5c3b22',2);c.restore();
        c.font='bold 18px Microsoft JhengHei,sans-serif';c.fillStyle='#aa6239';c.fillText('咔啦！',545,180);
      }else {path(c,q=>{q.moveTo(480,202);q.lineTo(hx,hy);},null,'#78886b',8);path(c,q=>{q.moveTo(480,200);q.lineTo(hx,hy-2);},null,'#c2ccb1',2);ellipse(c,480,202,10,7,'#b7c0a6');ellipse(c,hx,hy,23,17,'#81552e','#5c3b22',2);}
      if(p.grindMotion>.03&&p.grounds>0){for(let i=0;i<34;i++){const v=(t*1.8+i*.073)%1;const x=480+Math.sin(i*31)*19;const y=391+v*112;c.globalAlpha=(1-v)*p.grindMotion;ellipse(c,x,y,1.7,2.2,b.color);}c.globalAlpha=1;}
      c.font='12px "Microsoft JhengHei",sans-serif';c.fillStyle='#7f8d72';c.textAlign='center';c.fillText(p.beansRemaining===0?'這份香氣，已經準備好了。':p.loaded?'繞著中心，轉動木質手柄。':'把豆子放進磨豆機，再開始。',480,125);c.textAlign='left';
    }
    doser(c,p,t){
      const b=root.BrewBeans.get(p.beanId),offset=Math.sin(t*28)*p.shake*7;
      c.save();c.translate(offset,0);
      ellipse(c,460,500,74,12,'#bc9667','#927145');
      path(c,q=>{q.moveTo(334,325);q.lineTo(420,486);q.quadraticCurveTo(460,505,500,486);q.lineTo(586,325);q.closePath();},'#f8faed55','#aebba0',2);
      for(let i=0;i<12;i++){const x=343+i*21;path(c,q=>{q.moveTo(x,332);q.lineTo(440+i*3.4,482);},null,'#c7cfb770',2);}
      ellipse(c,460,325,126,45,'#f6f2e1','#a7b393',2);ellipse(c,460,331,117,37,'#e8dfc7');
      const fill=p.poured/p.dose;
      if(fill>0){
        const avg=p.poured/p.distribution.length;
        for(let i=0;i<350*fill;i++){const a=i*2.39996,r=Math.sqrt((i+.5)/(350*fill));const index=i%p.distribution.length;const height=avg>0?p.distribution[index]/avg:1;
          const x=460+Math.cos(a)*r*109,y=342+Math.sin(a)*r*31-fill*(5+height*5);ellipse(c,x,y,3.5,2,b.color);}
        const uneven=1-root.BrewPreparation.bedQuality(p);
        ellipse(c,460+uneven*20,337-fill*8,36+fill*28,10+uneven*14,b.color);
      }
      c.restore();
      if(p.powderFlow>.01){const cup=p.container,a=-cup.tilt*.85,sx=cup.x-65*Math.cos(a)+15*Math.sin(a),sy=cup.y-65*Math.sin(a)-15*Math.cos(a);
        for(let i=0;i<70;i++){const v=(t*(1.1+p.powderFlow*.14)+i*.037)%1;const x=sx+Math.sin(i*23)*v*18,y=sy+(330-sy)*v;ellipse(c,x,y,1.5+(i%3)*.4,2,b.color);}
      }
      c.font='11px "Microsoft JhengHei",sans-serif';c.fillStyle='#7f8d72';c.textAlign='center';c.fillText(fill<.97?'把粉杯的出粉口，帶到濾杯上方。':'輕晃濾杯，讓粉床平整一些。',460,578);c.textAlign='left';
    }
    heater(c,p,t){
      const glow=p.heaterOn?Math.min(1,.3+p.temperature/140):0;
      if(glow){const light=c.createRadialGradient(480,505,15,480,505,135);light.addColorStop(0,`rgba(201,132,66,${glow*.4})`);light.addColorStop(1,'#c9844200');ellipse(c,480,505,135,45,light);}
      path(c,q=>{q.moveTo(368,492);q.lineTo(368,522);q.quadraticCurveTo(480,552,592,522);q.lineTo(592,492);q.closePath();},'#435442');ellipse(c,480,491,112,31,'#63705a','#485c44',2);ellipse(c,480,491,95,23,p.heaterOn?'#bd906233':'#80916c30');ellipse(c,548,521,4,3,p.heaterOn?'#de9b57':'#72816b');
      const metal=c.createLinearGradient(350,0,585,0);metal.addColorStop(0,'#50694f');metal.addColorStop(.4,'#3d5944');metal.addColorStop(1,'#213c2d');
      path(c,q=>{q.moveTo(553,296);q.bezierCurveTo(665,265,666,455,565,443);},null,'#2d4735',23);
      path(c,q=>{q.moveTo(407,401);q.bezierCurveTo(318,399,352,294,269,292);q.lineTo(264,281);q.bezierCurveTo(366,268,345,343,410,347);q.closePath();},'#566e50','#344d36',2);
      path(c,q=>{q.moveTo(401,290);q.quadraticCurveTo(380,367,383,452);q.bezierCurveTo(398,506,553,506,579,452);q.lineTo(548,289);q.closePath();},metal,'#2c442f',2);
      ellipse(c,476,290,77,16,'#2c4532');path(c,q=>{q.moveTo(415,284);q.quadraticCurveTo(476,240,539,284);},'#50684d','#2d4733',2);path(c,q=>{q.moveTo(465,255);q.lineTo(465,239);q.quadraticCurveTo(478,226,490,239);q.lineTo(490,255);},'#bb9768');
      path(c,q=>{q.moveTo(408,315);q.quadraticCurveTo(396,372,403,438);},null,'#90a27b60',6);
      const steam=Math.max(0,(p.temperature-55)/45);
      for(let i=0;i<6;i++){const phase=(t*.45+i*.173)%1;c.globalAlpha=steam*(1-phase)*.34;const x=452+i*9+Math.sin(t+i)*9;path(c,q=>{q.moveTo(x,269-phase*60);q.bezierCurveTo(x-12,248-phase*90,x+14,229-phase*90,x,210-phase*90);},null,'#91a081',2+steam*2);}c.globalAlpha=1;
      if(p.temperature>97){for(let i=0;i<7;i++){const phase=(t*2+i/7)%1;ellipse(c,425+i*15,442-Math.sin(phase*Math.PI)*3,1.5,1.5,'#a9b99c55');}}
      c.font='11px "Microsoft JhengHei",sans-serif';c.fillStyle='#7f8d72';c.textAlign='center';c.fillText(p.heaterOn?'加熱中 · 看看指針與蒸氣':p.heated?'離開熱源後，水正在慢慢冷卻。':'還沒開啟這段溫度。',480,139);c.textAlign='left';
    }
  }
  root.BrewPreparationRenderer=PreparationRenderer;
})(globalThis);
