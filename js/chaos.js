/* 失控仍有因果：所有事故由落點、流量、停留與移動決定，不使用亂數。 */
(function(root){
  'use strict';
  const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
  const average=a=>a.reduce((s,v)=>s+v,0)/(a.length||1);
  function initialize(s,options={}){
    Object.assign(s,{mode:options.mode==='practice'?'practice':'challenge',grindAbuse:Math.max(0,options.grindAbuse||0),
      grinderBreaks:Math.max(0,options.grinderBreaks||0),edgeWater:0,edgeHits:0,spillAccidents:0,tableWater:0,
      splashWater:0,lossRate:0,focusTime:0,channeling:0,disturbance:0,stabilityIntegral:0,
      rimWet:Array(16).fill(0),rimWetAt:Array(16).fill(-100),tablePatches:Array.from({length:48},(_,i)=>({x:Math.cos(i/24*Math.PI*2)*(i<24?1.5:2.05),y:Math.sin(i/24*Math.PI*2)*(i<24?1.5:2.05),water:0})),
      lastSpill:-10,lastEdge:-10,eventId:0,eventKind:'',eventAt:-10,
      rigTime:0,lastCollision:-10,knockdowns:0,serverKnockdowns:0,knockedWater:0,
      dripperTipped:false,serverTipped:false,dripperAngle:0,serverAngle:0,dripperDrop:0,
      knockDirection:1,knockAge:100,lastKnockWater:0});
    s.cells.forEach(c=>Object.assign(c,{erosion:0,agitation:0,channel:0}));return s;
  }
  function event(s,kind,force=false){if(!force&&s.elapsed-s.eventAt<5)return;s.eventId++;s.eventKind=kind;s.eventAt=s.elapsed;}
  function spill(s,water,x=1.5,y=1){
    if(water<=0)return;s.overflow+=water;s.knockedWater+=water;wetTable(s,water,x,y);
  }
  function updateRig(s,dt){
    s.rigTime+=dt;s.knockAge+=dt;
    const follow=1-Math.exp(-dt*9);
    s.dripperAngle+=((s.dripperTipped?s.knockDirection*1.18:0)-s.dripperAngle)*follow;
    s.serverAngle+=((s.serverTipped?s.knockDirection*1.2:0)-s.serverAngle)*follow;
    s.dripperDrop+=((s.dripperTipped?105:0)-s.dripperDrop)*follow;
  }
  function body(k){const a=-k.tilt*.78;return {x:k.x+15*Math.cos(a)-20*Math.sin(a),y:(k.y??156)+15*Math.sin(a)+20*Math.cos(a)};}
  function collide(s,before,after,dt,held){
    if(s.finished||!held||!before||s.dripperTipped||s.rigTime-s.lastCollision<1.4||dt<=0)return false;
    // 只改流量造成的壺身補償不是玩家揮壺，不能憑空撞倒器具。
    if(Number.isFinite(before.aimX)&&Number.isFinite(after.aimX)&&Math.hypot(after.aimX-before.aimX,after.aimY-before.aimY)<dt*1.8)return false;
    const a=body(before),b=body(after),dx=b.x-a.x,dy=b.y-a.y,speed=Math.hypot(dx,dy)/dt;
    // 連續線段對膨脹後的杯緣橢圓測試，快速穿越也不會漏判。
    const ax=(a.x-460)/191,ay=(a.y-306)/110,vx=dx/191,vy=dy/110;
    const u=clamp(-(ax*vx+ay*vy)/Math.max(1e-9,vx*vx+vy*vy));
    if(speed<320||Math.hypot(ax+vx*u,ay+vy*u)>1||(u<.001&&Math.hypot(b.x-460,b.y-306)>=Math.hypot(a.x-460,a.y-306)))return false;
    s.dripperTipped=true;s.knockdowns++;s.lastCollision=s.rigTime;s.knockDirection=dx===0?(b.x<460?-1:1):Math.sign(dx);
    const force=clamp((speed-320)/700),mobile=s.poreWater+s.freeWater,water=mobile*(.65+.25*force);
    const free=Math.min(s.freeWater,water);s.freeWater-=free;s.poreWater-=water-free;
    s.bedWater=s.poreWater+s.freeWater;s.surfaceHeight=Math.pow(clamp(s.freeWater/86),.62);
    let coffee=0;if(speed>900){s.serverTipped=true;s.serverKnockdowns++;coffee=s.beverage*(.45+.35*force);s.beverage-=coffee;}
    s.lastKnockWater=water+coffee;s.knockAge=0;spill(s,water+coffee,s.knockDirection*1.5,1);
    s.spillAccidents++;event(s,s.serverTipped?'domino':'knock',true);return true;
  }
  function upright(s){
    if(s.finished||(!s.dripperTipped&&!s.serverTipped))return false;
    s.dripperTipped=s.serverTipped=false;s.lastCollision=s.rigTime;return true;
  }
  function wetTable(s,water,x,y){
    if(water<=0)return;s.tableWater+=water;
    const radius=Math.hypot(x,y)||1,scale=Math.max(1,1.35/radius);
    x*=scale;y*=scale;
    let nearest=0,distance=Infinity;
    s.tablePatches.forEach((p,i)=>{const d=(x-p.x)**2+(y-p.y)**2;if(d<distance){nearest=i;distance=d;}});
    s.tablePatches[nearest].water+=water;
  }
  function impact(s,input,dt,amount){
    const x=input.x||0,y=input.y||0,radius=Math.hypot(x,y),force=clamp((s.flow-6.5)/4);
    const capture=s.dripperTipped?0:radius<=.88?1:clamp((1.08-radius)/.2);
    const splash=capture*force*force*.055;
    const captured=amount*Math.max(0,capture-splash),lost=amount-captured;
    s.splashWater+=amount*splash;s.missedWater+=lost;s.lossRate=dt>0?lost/dt:0;
    wetTable(s,lost,x,y);
    if(radius>.88&&radius<1.2){
      s.edgeWater+=amount;
      const bin=Math.floor((Math.atan2(y,x)+Math.PI)/(Math.PI*2)*16)%16;
      s.rimWet[bin]+=amount;s.rimWetAt[bin]=s.elapsed;
      if(s.elapsed-s.lastEdge>1.5){s.edgeHits++;s.lastEdge=s.elapsed;}
      event(s,'edge');
    }
    if(s.lossRate>.5){
      if(s.elapsed-s.lastSpill>1.5){s.spillAccidents++;s.lastSpill=s.elapsed;}
      event(s,s.tableWater>28?'flood':'miss');
    }
    const movement=s.lastAim?Math.hypot(x-s.lastAim.x,y-s.lastAim.y):0;
    s.focusTime=movement<dt*.18?s.focusTime+dt:Math.max(0,s.focusTime-dt*3);
    s.stabilityIntegral+=amount*clamp(input.instability||0);
    if(captured>0){
      const weights=s.cells.map(c=>Math.exp(-((c.x-x)**2+(c.y-y)**2)/.065)),peak=Math.max(...weights,.001);
      const digging=clamp((s.focusTime-1.5)/5)+force*1.7;
      s.cells.forEach((c,i)=>{
        const local=weights[i]/peak;
        c.agitation=clamp(c.agitation+dt*local*(.5+force*5));
        c.erosion=clamp(c.erosion+dt*local*digging*(.019+force*.055));
        c.channel=Math.max(c.channel,clamp((c.erosion-.18)/.72));
      });
      if(digging>1.1)event(s,'crater');
    }
    return captured;
  }
  function settle(s,dt){
    s.cells.forEach(c=>{c.agitation*=Math.exp(-dt*3);});
    s.channeling=Math.max(...s.cells.map(c=>c.channel));
    s.disturbance=average(s.cells.map(c=>c.erosion));
    if(s.flow===0){s.lossRate=0;s.focusTime=Math.max(0,s.focusTime-dt*2);}
    if(s.overflowRate>0){const water=s.overflowRate*dt;wetTable(s,water,Math.sin(s.elapsed*.7)*.7,1.2);for(const i of [3,11]){s.rimWet[i]+=water*.5;s.rimWetAt[i]=s.elapsed;}event(s,'flood');}
  }
  function assess(s){
    const missRatio=s.missedWater/Math.max(1,s.totalWater),stability=1-clamp(s.stabilityIntegral/Math.max(1,s.totalWater));
    const raw=clamp(missRatio*18,0,15)+clamp(s.edgeWater/Math.max(1,s.totalWater)*5,0,4)
      +clamp(s.tableWater/45,0,4)+s.channeling*4+s.disturbance*5
      +clamp(s.grindAbuse*2+s.grinderBreaks*2,0,7)+(1-stability)*4+clamp(s.spillAccidents*.08,0,2)+clamp(s.edgeHits*.05,0,1.5)
      +Math.min(12,s.knockdowns*3+s.serverKnockdowns*2);
    const penalty=raw*(s.mode==='practice'?.5:1);
    let comment='節奏穩定，粉床控制得很好，整體乾淨平衡。';
    if(s.totalWater<2)comment=s.knockdowns?'還沒開始沖，就先把器具撞倒了。先扶正，咖啡還在等你。':s.grinderBreaks?'磨豆機受傷了，咖啡還沒等到水。':'水壺還沒上班，這杯目前只有想像。';
    else if(s.serverKnockdowns)comment='濾杯倒了，分享壺也跟著躺平。這杯的餘韻，是桌子的。';
    else if(s.knockdowns)comment='你不只沖咖啡，還把濾杯送去躺一下。扶正器具後，溫柔一點再來。';
    else if(missRatio>.5)comment='你沖的可能不是咖啡，是一場小型災難。桌子表示喝飽了。';
    else if(s.channeling>.6&&s.tableWater>12)comment='粉床被打穿、桌面全濕，風味十分奔放。';
    else if(s.grinderBreaks&&raw>8)comment='磨豆機受傷了，濾杯也很困惑。幸好手柄還裝得回去。';
    else if(s.tableWater>12)comment='風味還在努力，但你的桌面比咖啡還忙。';
    else if(s.channeling>.45)comment='這個坑很有個性，咖啡卻想走捷徑。下次換個地方沖。';
    else if(raw>4)comment='有點手忙腳亂，但至少大部分的水進了濾杯。';
    else if(s.grinderBreaks)comment='手柄雖然離家出走，裝回後還是努力完成了這杯。';
    else if(s.totalWater<160||!s.bloomRecorded)comment='桌面很乾淨；再練習注水量與停水悶蒸，風味會更完整。';
    return {penalty,raw,missRatio,stability,comment,tableWater:s.tableWater,edgeHits:s.edgeHits,
      spillAccidents:s.spillAccidents,channeling:s.channeling,disturbance:s.disturbance,
      grinderBreaks:s.grinderBreaks,grindAbuse:s.grindAbuse,knockdowns:s.knockdowns,serverKnockdowns:s.serverKnockdowns,knockedWater:s.knockedWater};
  }
  root.BrewChaos={initialize,impact,settle,assess,collide,upright,updateRig,spill};
})(globalThis);
