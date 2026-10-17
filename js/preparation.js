/* 準備流程的確定性狀態：固定一份豆量，磨豆、倒粉、加熱均有實際進度。 */
(function(root){
  'use strict';
  const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
  function create(beanId='yirgacheffe',mode='challenge'){
    return {beanId,mode,stage:'beans',grind:.5,dose:18,loaded:false,beansRemaining:18,grounds:0,
      crankAngle:0,turns:0,grindEnergy:0,grindMotion:0,poured:0,distribution:Array(35).fill(0),leveling:0,
      container:{x:205,y:170,tilt:0,held:false},powderFlow:0,heaterOn:false,heated:false,heatEnergy:0,
      temperature:24,heatTime:0,shake:0,grindSpeed:0,grindStress:0,grindAbuse:0,
      handleBroken:false,breakCount:0,breakAge:0,repairHeld:false,repairProgress:0,repairGrace:0};
  }
  function load(p){if(!p.loaded){p.loaded=true;p.stage='grind';return true;}return false;}
  function grind(p,deltaAngle,dt=.04){
    if(!p.loaded||p.beansRemaining<=0||p.handleBroken||!Number.isFinite(deltaAngle))return;
    dt=clamp(dt,.004,.12);
    const speed=Math.abs(deltaAngle)/dt,abuse=clamp((speed-10)/12);
    p.grindSpeed= Math.min(90,speed);
    p.grindAbuse+=abuse*dt;
    if(p.repairGrace<=0)p.grindStress=clamp(p.grindStress+abuse*dt*2.2,0,2);
    if(p.grindStress>=(p.mode==='practice'?1.05:.65)){
      p.handleBroken=true;p.breakCount++;p.breakAge=0;p.grindMotion=0;p.shake=1;p.repairProgress=0;
      return;
    }
    const delta=clamp(Math.abs(deltaAngle),0,.45);
    p.crankAngle+=deltaAngle;p.turns+=delta/(Math.PI*2);p.grindEnergy+=delta;
    const amount=Math.min(p.beansRemaining,delta*18/(Math.PI*2*3.5));
    p.beansRemaining=Math.max(0,p.beansRemaining-amount);p.grounds+=amount;p.grindMotion=1;
    if(p.beansRemaining<.001){p.grounds=18;p.beansRemaining=0;}
  }
  function canAdvance(p,stage=p.stage){
    if(stage==='grind')return p.loaded&&p.beansRemaining===0&&!p.handleBroken;
    if(stage==='dose')return p.poured>=p.dose*.97;
    if(stage==='heat')return p.heated&&!p.heaterOn;
    return false;
  }
  function pour(p,dt){
    p.powderFlow=0;
    const c=p.container;
    if(!c.held||c.tilt<.18||p.grounds<=0)return;
    // 出粉口必須位於濾杯上方；落到外面不偷扣豆量，讓玩家可修正。
    const mouthX=c.x-65*Math.cos(-c.tilt*.85)+15*Math.sin(-c.tilt*.85);
    const mouthY=c.y-65*Math.sin(-c.tilt*.85)-15*Math.cos(-c.tilt*.85);
    if(mouthX<340||mouthX>580||mouthY>310)return;
    const amount=Math.min(p.grounds,(1+c.tilt*5)*dt);
    p.grounds-=amount;p.poured+=amount;p.powderFlow=amount/Math.max(dt,.001);
    const norm=(mouthX-460)/120;
    const weights=p.distribution.map((_,i)=>Math.exp(-Math.pow((i%7-3)/3-norm,2)/.2));
    const sum=weights.reduce((a,b)=>a+b,0);
    p.distribution=p.distribution.map((v,i)=>v+amount*weights[i]/sum);
    if(p.grounds<.001){p.poured=18;p.grounds=0;}
  }
  function level(p,delta){
    if(p.poured<=0)return;
    const amount=clamp(Math.abs(delta)/80,0,.12);
    const average=p.poured/p.distribution.length;
    p.distribution=p.distribution.map(v=>v+(average-v)*amount);
    p.leveling=clamp(p.leveling+amount*.2);p.shake=1;
  }
  function heat(p,dt){
    p.heatTime+=dt;
    if(p.heaterOn){const change=Math.min(100-p.temperature,(9.2-.06*(p.temperature-24))*dt);p.temperature+=change;p.heatEnergy+=Math.max(0,change);if(p.heatEnergy>=20)p.heated=true;}
    else p.temperature=Math.max(24,p.temperature-.6*dt);
    p.temperature=clamp(p.temperature,24,100);
  }
  function step(p,dt){
    p.grindMotion*=Math.exp(-dt*8);p.shake*=Math.exp(-dt*7);
    p.grindSpeed*=Math.exp(-dt*5);p.grindStress=Math.max(0,p.grindStress-dt*.3);
    p.repairGrace=Math.max(0,p.repairGrace-dt);
    if(p.handleBroken){
      p.breakAge+=dt;
      if(p.repairHeld){p.repairProgress=clamp(p.repairProgress+dt/(p.mode==='practice'?.9:1.4));
        if(p.repairProgress>=1){p.handleBroken=false;p.grindStress=0;p.grindSpeed=0;p.crankAngle=0;p.repairHeld=false;p.repairGrace=1;}}
    }
    if(p.stage==='dose')pour(p,dt);
    if(p.stage==='heat')heat(p,dt);
  }
  function bedQuality(p){
    if(p.poured<=0)return 0;
    const avg=p.poured/p.distribution.length;
    const cv=Math.sqrt(p.distribution.reduce((s,v)=>s+(v-avg)**2,0)/p.distribution.length)/Math.max(avg,.001);
    return clamp(1-cv*.48);
  }
  root.BrewPreparation={create,load,grind,pour,level,heat,step,canAdvance,bedQuality};
})(globalThis);
