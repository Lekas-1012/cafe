/* 目標與實際落點分開；幾何補償後再套用可預期的慣性、強流偏移。 */
(function (root) {
  'use strict';
  const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
  const flowForTilt=t=>t<=.06?0:10.5*Math.pow(clamp((t-.06)/.94),1.55);
  const tiltForFlow=f=>f<=0?0:.06+.94*Math.pow(clamp(f/10.5),1/1.55);
  function create(){return {aimX:0,aimY:0,actualX:0,actualY:0,previousX:0,previousY:0,phase:0,speed:0,instability:0,flowSetting:4,pouring:false,visualTilt:0,mode:'wheel'};}
  function setAim(c,x,y){if(Number.isFinite(x))c.aimX=clamp(x,-1.5,1.5);if(Number.isFinite(y))c.aimY=clamp(y,-1.5,1.5);}
  function setFlow(c,value){c.flowSetting=clamp(Number(value)||0,0,10.5);}
  function begin(c){c.pouring=true;}
  function end(c){c.pouring=false;}
  function step(c,dt){
    const target=tiltForFlow(c.pouring?c.flowSetting:0);c.visualTilt+=(target-c.visualTilt)*(1-Math.exp(-dt*16));
    const speed=Math.hypot(c.aimX-c.previousX,c.aimY-c.previousY)/Math.max(dt,.001);
    c.speed+=(Math.min(30,speed)-c.speed)*(1-Math.exp(-dt*12));
    c.previousX=c.aimX;c.previousY=c.aimY;c.phase+=dt;
    const force=clamp((c.flowSetting-6.5)/4),lag=.025+force*.13+clamp(c.speed/12)*.1;
    if(!c.pouring){c.actualX=c.aimX;c.actualY=c.aimY;c.instability=0;return;}
    const follow=1-Math.exp(-dt/lag);
    c.actualX+=(c.aimX-c.actualX)*follow;c.actualY+=(c.aimY-c.actualY)*follow;
    c.instability=clamp(force*.65+Math.hypot(c.aimX-c.actualX,c.aimY-c.actualY)*1.4);
  }
  function pose(c){
    const tilt=c.visualTilt,angle=-tilt*.78;
    const flow=c.pouring?c.flowSetting:0;
    const endX=460+c.aimX*120,endY=324+c.aimY*35;
    const horizontalTravel=flow>0?6+flow*1.4:6;
    const offsetX=-125*Math.cos(angle)+39*Math.sin(angle);
    const x=endX+horizontalTravel-offsetX;
    const force=c.pouring?clamp((flow-6.5)/4):0;
    const wobble=force*force*.24;
    const landingX=c.actualX+wobble*(Math.sin(c.phase*12.7)+Math.sin(c.phase*6.1)*.35);
    const landingY=c.actualY+wobble*(Math.cos(c.phase*10.3)*.8+Math.sin(c.phase*5.3)*.3);
    // 往前緣伸壺時壺身也真的降低；正常小圈保持離開器具的高度。
    const y=156+Math.max(0,c.aimY-.45)*125;
    return {x,y,tilt,flow,aimX:c.aimX,aimY:c.aimY,landingX,landingY,instability:c.instability,endX,endY,horizontalTravel};
  }
  root.BrewControls={create,setAim,setFlow,begin,end,step,pose,flowForTilt,tiltForFlow};
})(globalThis);
