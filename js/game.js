(function(){
  'use strict';
  const $=id=>document.getElementById(id),M=BrewModel,R=BrewRenderer,C=BrewControls,P=BrewPreparation;
  const screens=['home','beans','grind','dose','heat','game','result'],active=['grind','dose','heat','game'];
  let screen='home',prep=P.create(),control=C.create(),kettle=C.pose(control),simulation=M.create({prepared:false});
  let paused=false,modalPause=false,dragging=null,grindDrag=null,cupDrag=null,levelDrag=null;
  let keys=new Set(),keyHeld=false,grindHeld=false,doseHeld=false,previousTime=null,accumulator=0,visualTime=0,previewDirty=true,lastHint=0,observationKey='';
  let lastBreak=0,lastChaos=0,toastUntil=0,collisionPose=null;
  let soundOn=false,audio=null,audioGain=null,audioFilter=null,audioNoise=null,crackGain=null;
  const renderer=new R.Renderer($('game-canvas')),preview=new R.Renderer($('preview-canvas'),true),previewState=M.create();
  const prepRenderers=Object.fromEntries(['grind','dose','heat'].map(name=>[name,new BrewPreparationRenderer($(name+'-canvas'))]));
  const storageKey='brew-by-feel.best.v3';
  function readBest(key){try{const v=JSON.parse(localStorage.getItem(key));return Number.isFinite(v?.score)&&v.score>=0&&v.score<=100?v:null;}catch{return null;}}
  let best=readBest(storageKey),legacyBest=readBest('brew-by-feel.best.v2')||readBest('brew-by-feel.best.v1');
  function updateBest(){$('home-best').textContent=best?`${best.score} 分 · ${best.label}`:legacyBest?`本階段尚未紀錄（前版 ${legacyBest.score} 分）`:'尚未留下第一杯';}
  function showScreen(next){
    screen=next;for(const name of screens)$(name+'-screen').hidden=name!==next;
    $('workflow').hidden=next==='home';$('workflow-mode').textContent=prep.mode==='practice'?'練習模式':'正式挑戰';
    const steps=['beans','grind','dose','heat','game','result'];
    document.querySelectorAll('[data-step]').forEach(li=>{const current=li.dataset.step===next;if(current)li.setAttribute('aria-current','step');else li.removeAttribute('aria-current');li.classList.toggle('done',steps.indexOf(li.dataset.step)<steps.indexOf(next));});
    $('journey-pause').hidden=!active.includes(next)||next==='game';previousTime=null;accumulator=0;previewDirty=true;
    document.body.classList.remove('is-dragging');window.scrollTo({top:0,behavior:'instant'});
    const title=$(next+'-title');if(title)title.focus({preventScroll:true});
    if(prepRenderers[next])prepRenderers[next].resize();
  }
  function mute(){if(audioGain)audioGain.gain.setTargetAtTime(0,audio.currentTime,.035);if(crackGain)crackGain.gain.setTargetAtTime(0,audio.currentTime,.015);}
  function release(node,id){try{if(id!==undefined&&node.hasPointerCapture(id))node.releasePointerCapture(id);}catch{}}
  function stopInput(){
    release($('kettle'),dragging?.id);release($('grind-handle'),grindDrag?.id);release($('powder-cup'),cupDrag?.id);release($('level-bed'),levelDrag?.id);
    dragging=grindDrag=cupDrag=levelDrag=null;keyHeld=grindHeld=doseHeld=false;keys.clear();C.end(control);collisionPose=null;
    prep.repairHeld=false;prep.container.held=false;prep.powderFlow=0;simulation.flow=0;
    $('kettle').classList.remove('dragging');$('kettle').setAttribute('aria-pressed','false');document.body.classList.remove('is-dragging');mute();
  }
  function placeKettle(){
    kettle=C.pose(control);const node=$('kettle'),p=R.kettleProjection(kettle,renderer.view,simulation);
    node.style.left=((p.x-155*p.scale)/R.W*100)+'%';node.style.top=((p.y-110*p.scale)/R.H*100)+'%';node.style.width=(310*p.scale/R.W*100)+'%';node.style.height=(220*p.scale/R.H*100)+'%';node.style.transform=`rotate(${-kettle.tilt*.78}rad)`;
    node.setAttribute('aria-pressed',String(control.pouring));
  }
  function resetJourney(){
    stopInput();prep=P.create();control=C.create();kettle=C.pose(control);simulation=M.create({prepared:false});paused=false;modalPause=false;visualTime=0;
    lastBreak=lastChaos=0;toastUntil=0;$('chaos-toast').hidden=true;$('scene').classList.remove('accident-shake');
    $('pause-overlay').hidden=true;if($('prep-pause-dialog').open)$('prep-pause-dialog').close();
    $('beans-next').disabled=true;$('selected-bean-note').textContent='先選一份咖啡，再開始這段旅程。';
    $('roast-filter').value='all';document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode==='challenge')));
    $('grind-setting').value='50';$('grind-setting').disabled=false;$('grind-label').textContent='中等';$('powder-angle').value='0';
    $('flow-setting').value='4';$('depth-setting').value='0';$('control-mode').value='wheel';$('heater-toggle').setAttribute('aria-pressed','false');
    renderBeans();showScreen('beans');
  }
  function chooseBean(id){
    const b=BrewBeans.get(id);prep.beanId=b.id;$('beans-next').disabled=false;$('selected-bean-note').textContent=`今天選擇 ${b.name} · ${b.roast}`;
    document.querySelectorAll('.bean-card').forEach(card=>{const selected=card.dataset.bean===b.id;card.classList.toggle('selected',selected);const button=card.querySelector('.bean-select');button.setAttribute('aria-pressed',String(selected));button.textContent=selected?'已選擇 ✓':'選這一款';});prep.selected=true;
  }
  function renderBeans(){
    const filter=$('roast-filter').value;
    $('bean-grid').innerHTML=BrewBeans.all.filter(b=>filter==='all'||b.roast===filter).map(b=>`<article class="bean-card${prep.selected&&prep.beanId===b.id?' selected':''}" data-bean="${b.id}" style="--bean-color:${b.color};--bean-accent:${b.accent};--bean-bg:${b.accent}25"><div class="bean-art" aria-hidden="true"><div class="coffee-bag"><div class="bag-label">Feel.<small>${b.english}</small></div></div><i class="art-bean"></i><i class="art-bean"></i><i class="art-bean"></i></div><div class="bean-card-body"><p class="eyebrow">${b.english}</p><h2>${b.name}</h2><p class="bean-meta">${b.variety}<br>${b.process} · ${b.roast}</p><p class="bean-notes">${b.notes.join(' · ')}</p><div class="bean-card-actions"><button type="button" data-detail="${b.id}">認識產地與品種 ↗</button><button class="bean-select" type="button" data-select="${b.id}" aria-pressed="${!!prep.selected&&prep.beanId===b.id}">${prep.selected&&prep.beanId===b.id?'已選擇 ✓':'選這一款'}</button></div></div></article>`).join('');
    $('bean-grid').querySelectorAll('[data-select]').forEach(b=>b.addEventListener('click',()=>chooseBean(b.dataset.select)));
    $('bean-grid').querySelectorAll('[data-detail]').forEach(b=>b.addEventListener('click',()=>showBean(b.dataset.detail)));
  }
  function showBean(id){const b=BrewBeans.get(id),facts=[['國家／產區',`${b.country} · ${b.region}`],['咖啡品種',b.variety],['處理法',b.process],['烘焙程度',b.roast],['代表性風味',b.notes.join('、')],['酸質／醇厚度',`${b.acidity}／${b.body}`]];
    $('bean-detail-content').innerHTML=`<p class="eyebrow">${b.english} · A COFFEE TO UNDERSTAND</p><h2 id="bean-dialog-title">${b.name}</h2><dl class="bean-detail-meta">${facts.map(([k,v])=>`<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>${[['這份配方的特色',b.feature],['產地介紹',b.origin],['品種介紹',b.varietyInfo],['建議沖煮方向',b.direction]].map(([h,p])=>`<section class="bean-detail-section"><h3>${h}</h3><p>${p}</p></section>`).join('')}<p class="bean-source">${BrewBeans.disclaimer}<br><a href="${b.source}" target="_blank" rel="noopener noreferrer">品種資料參考：World Coffee Research ↗</a></p>`;
    $('bean-dialog').showModal();
  }
  function updatePrepLabels(){
    const b=BrewBeans.get(prep.beanId);document.querySelectorAll('.prep-bean-name').forEach(n=>n.textContent=b.name);
    $('grind-recommendation').hidden=prep.mode!=='practice';$('heat-recommendation').hidden=prep.mode!=='practice';$('heat-exact').hidden=prep.mode!=='practice';
    $('grind-recommendation').textContent=`本配方可從${BrewBeans.grindLabel(b.grindRange[0])}至${BrewBeans.grindLabel(b.grindRange[1])}附近開始練習。${b.direction}`;
    $('heat-recommendation').textContent=`本遊戲配方起始水溫參考 ${b.tempRange[0]}～${b.tempRange[1]} °C。細微溫差不會大幅扣分。`;
  }
  function beginBrew(){
    if(screen!=='heat'||!P.canAdvance(prep,'heat')||!P.canAdvance(prep,'dose')||prep.beansRemaining!==0||!prep.selected)return;
    stopInput();const b=BrewBeans.get(prep.beanId);simulation=M.create({beanId:b.id,grind:prep.grind,dose:prep.poured,temperature:prep.temperature,bedQuality:P.bedQuality(prep),distribution:prep.distribution,mode:prep.mode,grindAbuse:prep.grindAbuse,grinderBreaks:prep.breakCount,prepared:true});
    control=C.create();kettle=C.pose(control);paused=false;visualTime=0;lastHint=0;observationKey='';prep.stage='game';
    $('brew-bean-name').textContent=b.name;$('brew-bean-roast').textContent=`${b.variety} · ${b.process} · ${b.roast}`;$('brew-notes').textContent=b.notes.join(' · ');
    $('game-temperature').hidden=prep.mode!=='practice';$('finish-button').disabled=false;$('kettle').disabled=false;$('pause-overlay').hidden=true;$('drag-hint').hidden=false;
    $('flow-setting').value='4';$('depth-setting').value='0';$('control-mode').value='wheel';$('scene-state').textContent='準備就緒';$('observation-text').textContent='按住水壺拖移前後左右，用滾輪或 W/S 調水；強流會偏，別只盯著瞄準環。';
    showScreen('game');renderer.resize();placeKettle();renderer.draw(simulation,kettle,0);
  }
  $('start-button').addEventListener('click',resetJourney);$('retry-button').addEventListener('click',resetJourney);
  $('roast-filter').addEventListener('change',renderBeans);
  document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>{if(screen!=='beans')return;prep.mode=b.dataset.mode;document.querySelectorAll('[data-mode]').forEach(n=>n.setAttribute('aria-pressed',String(n===b)));$('workflow-mode').textContent=prep.mode==='practice'?'練習模式':'正式挑戰';}));
  $('beans-next').addEventListener('click',()=>{if(screen!=='beans'||!prep.selected)return;prep.stage='grind';updatePrepLabels();showScreen('grind');});
  $('load-beans').addEventListener('click',()=>{if(screen==='grind'){P.load(prep);initAudio();}});
  $('grind-setting').addEventListener('input',e=>{if(prep.turns>0)return;prep.grind=M.clamp(Number(e.target.value)/100);$('grind-label').textContent=BrewBeans.grindLabel(prep.grind);e.target.setAttribute('aria-valuetext',BrewBeans.grindLabel(prep.grind));});
  $('grind-next').addEventListener('click',()=>{if(screen!=='grind'||!P.canAdvance(prep,'grind'))return;stopInput();prep.stage='dose';showScreen('dose');});
  $('dose-next').addEventListener('click',()=>{if(screen!=='dose'||!P.canAdvance(prep,'dose'))return;stopInput();prep.stage='heat';showScreen('heat');});
  $('heater-toggle').addEventListener('click',()=>{if(screen!=='heat'||paused)return;prep.heaterOn=!prep.heaterOn;initAudio();});
  $('heat-next').addEventListener('click',beginBrew);$('home-button').addEventListener('click',()=>{stopInput();showScreen('home');updateBest();});
  function pause(message,show=true){
    if(!active.includes(screen)||simulation.finished&&screen==='game')return;stopInput();paused=true;previousTime=null;accumulator=0;const text=message||'準備與萃取都已暫停，準備好再繼續。';
    if(screen==='game'){$('pause-overlay').hidden=false;$('pause-message').textContent=text;$('kettle').disabled=true;$('finish-button').disabled=true;$('scene-state').textContent='暫停中';if(show)$('resume-button').focus({preventScroll:true});}
    else if(show&&!$('prep-pause-dialog').open){$('prep-pause-message').textContent=text;$('prep-pause-dialog').showModal();}
  }
  function resume(){if(!active.includes(screen)||document.hidden)return;paused=false;previousTime=null;accumulator=0;if($('prep-pause-dialog').open)$('prep-pause-dialog').close();$('pause-overlay').hidden=true;$('kettle').disabled=false;$('finish-button').disabled=false;if(screen==='game'){$('scene-state').textContent=simulation.started?'專注沖煮':'準備就緒';$('kettle').focus({preventScroll:true});}}
  $('pause-button').addEventListener('click',()=>pause());$('journey-pause').addEventListener('click',()=>pause());$('resume-button').addEventListener('click',resume);$('prep-resume').addEventListener('click',resume);
  $('prep-pause-dialog').addEventListener('cancel',e=>{e.preventDefault();resume();});
  function leave(){if(screen==='beans'){stopInput();showScreen('home');return;}pause('',false);$('leave-dialog').showModal();}
  $('leave-button').addEventListener('click',leave);document.querySelectorAll('.prep-home').forEach(b=>b.addEventListener('click',leave));
  $('keep-brewing').addEventListener('click',()=>{$('leave-dialog').close();resume();});
  $('confirm-leave').addEventListener('click',()=>{stopInput();showScreen('home');$('leave-dialog').close();if($('prep-pause-dialog').open)$('prep-pause-dialog').close();paused=false;updateBest();});
  $('leave-dialog').addEventListener('close',()=>{if(active.includes(screen)&&paused)resume();});
  document.querySelectorAll('.help-trigger').forEach(b=>b.addEventListener('click',()=>{modalPause=active.includes(screen)&&!paused;if(modalPause)pause('正在閱讀指南。',false);$('help-dialog').showModal();}));
  document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>$(b.dataset.close).close()));
  $('help-dialog').addEventListener('close',()=>{if(modalPause){modalPause=false;resume();}});
  document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d&&d.id!=='prep-pause-dialog'){const b=d.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)d.close();}}));
  function point(event,node){const rect=node.getBoundingClientRect();return{x:(event.clientX-rect.left)/rect.width*960,y:(event.clientY-rect.top)/rect.height*650};}
  function scenePoint(event){const p=point(event,$('scene'));return R.inputPoint(p.x,p.y,renderer.view,simulation);}
  function takePointer(event,node){if(event.button!==0||!event.isPrimary||paused)return false;event.preventDefault();node.focus({preventScroll:true});node.setPointerCapture(event.pointerId);document.body.classList.add('is-dragging');return true;}
  $('grind-handle').addEventListener('pointerdown',e=>{if(screen!=='grind'||!prep.loaded||prep.beansRemaining<=0||prep.handleBroken||!takePointer(e,$('grind-handle')))return;const p=point(e,$('grind-scene'));grindDrag={id:e.pointerId,time:performance.now(),angle:Math.atan2((p.y-202)/65,(p.x-480)/145)};initAudio();});
  $('grind-handle').addEventListener('pointermove',e=>{if(grindDrag?.id!==e.pointerId)return;const p=point(e,$('grind-scene'));const a=Math.atan2((p.y-202)/65,(p.x-480)/145);const delta=Math.atan2(Math.sin(a-grindDrag.angle),Math.cos(a-grindDrag.angle));const now=performance.now();P.grind(prep,delta,(now-grindDrag.time)/1000);grindDrag.angle=a;grindDrag.time=now;});
  const repair=$('repair-handle');
  repair.addEventListener('pointerdown',e=>{if(screen!=='grind'||!prep.handleBroken||!takePointer(e,repair))return;prep.repairHeld=true;initAudio();});
  for(const type of ['pointerup','pointercancel','lostpointercapture','blur'])repair.addEventListener(type,()=>{prep.repairHeld=false;document.body.classList.remove('is-dragging');});
  repair.addEventListener('keydown',e=>{if((e.code==='Space'||e.code==='Enter')&&!paused){e.preventDefault();prep.repairHeld=true;}});
  repair.addEventListener('keyup',e=>{if(e.code==='Space'||e.code==='Enter'){e.preventDefault();prep.repairHeld=false;}});
  $('powder-angle').addEventListener('input',e=>{prep.container.tilt=Number(e.target.value)/100;});
  $('powder-cup').addEventListener('pointerdown',e=>{if(screen!=='dose'||!takePointer(e,$('powder-cup')))return;const p=point(e,$('dose-scene'));cupDrag={id:e.pointerId,x:p.x,y:p.y,cx:prep.container.x,cy:prep.container.y};prep.container.held=true;initAudio();});
  $('powder-cup').addEventListener('pointermove',e=>{if(cupDrag?.id!==e.pointerId)return;const p=point(e,$('dose-scene'));prep.container.x=M.clamp(cupDrag.cx+p.x-cupDrag.x,90,800);prep.container.y=M.clamp(cupDrag.cy+p.y-cupDrag.y,90,350);});
  $('powder-cup').addEventListener('wheel',e=>{if(!cupDrag)return;e.preventDefault();prep.container.tilt=M.clamp(prep.container.tilt-e.deltaY*.002);$('powder-angle').value=prep.container.tilt*100;},{passive:false});
  $('level-bed').addEventListener('pointerdown',e=>{if(screen!=='dose'||!takePointer(e,$('level-bed')))return;levelDrag={id:e.pointerId,x:e.clientX};});
  $('level-bed').addEventListener('pointermove',e=>{if(levelDrag?.id!==e.pointerId)return;P.level(prep,e.clientX-levelDrag.x);levelDrag.x=e.clientX;});
  $('kettle').addEventListener('pointerdown',e=>{if(screen!=='game'||simulation.finished||dragging||!takePointer(e,$('kettle')))return;const p=scenePoint(e);if(control.mode==='drag')C.setFlow(control,0);dragging={id:e.pointerId,x:p.x,y:p.y,aimX:control.aimX,aimY:control.aimY,flow:control.flowSetting};collisionPose=C.pose(control);C.begin(control);$('drag-hint').hidden=true;initAudio();placeKettle();});
  $('kettle').addEventListener('pointermove',e=>{if(dragging?.id!==e.pointerId)return;e.preventDefault();const p=scenePoint(e);C.setAim(control,dragging.aimX+(p.x-dragging.x)/R.BED.rx,control.mode==='drag'?control.aimY:dragging.aimY+(p.y-dragging.y)/(renderer.view==='overhead'?R.BED.rx:R.BED.ry));if(control.mode==='drag')setFlow(dragging.flow+(p.y-dragging.y)/145*10.5);$('depth-setting').value=control.aimY;});
  function setFlow(value){C.setFlow(control,value);$('flow-setting').value=control.flowSetting;$('flow-setting').setAttribute('aria-valuetext',control.flowSetting<2?'極細水流':control.flowSetting<6.5?'柔和水流':'強水流');}
  $('scene').addEventListener('wheel',e=>{if(screen!=='game'||paused||!control.pouring)return;e.preventDefault();setFlow(control.flowSetting-e.deltaY*(e.deltaMode===1?.12:.008));},{passive:false});
  $('flow-setting').addEventListener('input',e=>setFlow(Number(e.target.value)));$('depth-setting').addEventListener('input',e=>C.setAim(control,control.aimX,Number(e.target.value)));
  $('control-mode').addEventListener('change',e=>{stopInput();control.mode=e.target.value;$('drag-hint').innerHTML=control.mode==='drag'?'<span aria-hidden="true">↘</span> 按住向下拖曳，落點保持':'<span aria-hidden="true">⤢</span> 拖移前後左右，滾輪調水流';});
  $('game-canvas').addEventListener('pointerdown',e=>{if(screen!=='game'||paused)return;const p=point(e,$('scene')),aim=R.bedPoint(p.x,p.y,renderer.view,simulation);if(aim.x*aim.x+aim.y*aim.y<=1.2){C.setAim(control,aim.x,aim.y);$('depth-setting').value=control.aimY;}});
  for(const [id,getDrag] of [['kettle',()=>dragging],['grind-handle',()=>grindDrag],['powder-cup',()=>cupDrag],['level-bed',()=>levelDrag]])for(const type of ['pointerup','pointercancel','lostpointercapture'])$(id).addEventListener(type,e=>{if(getDrag()?.id===e.pointerId){stopInput();placeKettle();}});
  document.querySelectorAll('.view-controls button[data-view]').forEach(b=>b.addEventListener('click',()=>{if(screen!=='game'||!R.VIEWS[b.dataset.view])return;stopInput();renderer.view=b.dataset.view;$('scene').dataset.view=renderer.view;document.querySelectorAll('.view-controls button').forEach(n=>n.setAttribute('aria-pressed',String(n===b)));$('game-canvas').setAttribute('aria-label',`${R.VIEWS[renderer.view].label}沖煮場景，粉床水位與滴漏隨實際操作變化。`);placeKettle();renderer.draw(simulation,kettle,visualTime);}));
  document.addEventListener('keydown',e=>{
    if(document.querySelector('dialog[open]'))return;
    if(e.code==='Escape'&&active.includes(screen)){e.preventDefault();if(paused)resume();else pause();return;}
    if(paused){if(e.code==='Tab'&&screen==='game'){e.preventDefault();$('resume-button').focus();}return;}
    const focused=document.activeElement;
    if(screen==='grind'&&focused===$('grind-handle')&&e.code==='Space'&&prep.loaded){e.preventDefault();grindHeld=true;initAudio();return;}
    if(screen==='dose'&&focused===$('powder-cup')&&['Space','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.code)){e.preventDefault();keys.add(e.code);if(e.code==='Space'){doseHeld=true;prep.container.held=true;initAudio();}return;}
    if(screen==='dose'&&focused===$('level-bed')&&['ArrowLeft','ArrowRight'].includes(e.code)){e.preventDefault();P.level(prep,12);return;}
    if(screen==='game'&&(focused===$('kettle')||dragging)&&['Space','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','KeyW','KeyS'].includes(e.code)){e.preventDefault();keys.add(e.code);if(e.code==='Space'&&!dragging){keyHeld=true;collisionPose=C.pose(control);C.begin(control);$('drag-hint').hidden=true;initAudio();}}
  });
  document.addEventListener('keyup',e=>{keys.delete(e.code);if(e.code==='Space'&&(keyHeld||grindHeld||doseHeld)){e.preventDefault();stopInput();}});
  ['kettle','grind-handle','powder-cup'].forEach(id=>$(id).addEventListener('blur',()=>{if(keyHeld||grindHeld||doseHeld)stopInput();}));
  window.addEventListener('blur',()=>{if(active.includes(screen)&&!paused)pause('視窗離開焦點，已暫停；準備好再繼續。');});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&active.includes(screen))pause('你離開了頁面，準備、加熱與萃取已暫停。');});
  window.addEventListener('resize',()=>{stopInput();previewDirty=true;preview.resize();renderer.resize();for(const r of Object.values(prepRenderers))r.resize();placeKettle();if(screen==='game')renderer.draw(simulation,kettle,visualTime);});
  function initAudio(){if(!soundOn)return;try{if(!audio){const A=window.AudioContext||window.webkitAudioContext;if(!A)return;audio=new A();const buffer=audio.createBuffer(1,audio.sampleRate*2,audio.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;audioNoise=audio.createBufferSource();audioNoise.buffer=buffer;audioNoise.loop=true;audioFilter=audio.createBiquadFilter();audioFilter.type='lowpass';audioGain=audio.createGain();audioGain.gain.value=0;audioNoise.connect(audioFilter);audioFilter.connect(audioGain);audioGain.connect(audio.destination);audioNoise.start();}if(audio.state==='suspended')audio.resume().catch(()=>{});}catch{soundOn=false;updateSound();}}
  function updateSound(){$('sound-toggle').setAttribute('aria-pressed',String(soundOn));$('sound-toggle').setAttribute('aria-label',soundOn?'關閉音效':'開啟音效');$('sound-label').textContent=soundOn?'音效開啟':'音效關閉';}
  $('sound-toggle').addEventListener('click',()=>{soundOn=!soundOn;initAudio();updateSound();if(!soundOn)mute();});
  function crack(){if(!soundOn)return;initAudio();if(!audio)return;const o=audio.createOscillator(),g=audio.createGain();crackGain=g;o.type='square';o.frequency.setValueAtTime(160,audio.currentTime);o.frequency.exponentialRampToValueAtTime(35,audio.currentTime+.12);g.gain.setValueAtTime(.09,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.16);o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+.17);o.onended=()=>{o.disconnect();g.disconnect();if(crackGain===g)crackGain=null;};}
  function updateAudio(){if(!audioGain)return;let gain=0,freq=900;if(soundOn&&!paused){if(screen==='game'){gain=Math.min(.12,simulation.flow*.007+simulation.drainage*.001+simulation.lossRate*.012);freq=650+simulation.flow*220+simulation.lossRate*450;}if(screen==='grind'){gain=prep.grindMotion*.045;freq=420+prep.grind*800;}if(screen==='dose'){gain=prep.powderFlow*.004;freq=1500;}if(screen==='heat'){gain=prep.heaterOn?.005+prep.temperature/100*.016:Math.max(0,prep.temperature-70)*.0001;freq=300+prep.temperature*10;}}audioGain.gain.setTargetAtTime(gain,audio.currentTime,.06);audioFilter.frequency.setTargetAtTime(freq,audio.currentTime,.08);}
  function updatePreparationUI(){
    if(screen==='grind'){$('load-beans').disabled=prep.loaded;$('load-beans').textContent=prep.loaded?'豆子已放入 ✓':'將這份豆子倒入';$('grind-setting').disabled=prep.turns>0;$('grind-handle').disabled=!prep.loaded||prep.beansRemaining===0||prep.handleBroken;$('grind-handle').style.left=(480+Math.cos(prep.crankAngle)*145)/960*100+'%';$('grind-handle').style.top=(202+Math.sin(prep.crankAngle)*65)/650*100+'%';$('grind-next').disabled=!P.canAdvance(prep,'grind');$('grind-status').textContent=prep.handleBroken?'磨豆機：我受不了了。裝回手柄後可以繼續，粉沒有消失。':prep.beansRemaining===0?'豆子已經磨成粉，可以進入下一步。':prep.loaded?'按住木質手柄，繞中心轉幾圈。':'磨豆機還空著，先放入咖啡豆。';}
    if(screen==='grind'){
      $('grinder-repair').hidden=!prep.handleBroken;
      $('repair-progress').setAttribute('aria-valuenow',String(Math.round(prep.repairProgress*100)));$('repair-progress').firstElementChild.style.width=prep.repairProgress*100+'%';
      $('grind-temper').textContent=prep.handleBroken?'手感：手柄已離線':prep.grindStress>.35?'手感：慢一點，我快散了！':prep.grindSpeed>10?'手感：轉太快啦！':'手感：輕鬆慢磨';
      $('grind-temper').classList.toggle('danger',prep.grindStress>.35);
      if(prep.breakCount>lastBreak){lastBreak=prep.breakCount;release($('grind-handle'),grindDrag?.id);grindDrag=null;grindHeld=false;document.body.classList.remove('is-dragging');crack();if(!matchMedia('(prefers-reduced-motion: reduce)').matches){$('grind-scene').classList.remove('accident-shake');void $('grind-scene').offsetWidth;$('grind-scene').classList.add('accident-shake');}$('repair-handle').focus({preventScroll:true});}
    }
    if(screen==='dose'){const c=prep.container;$('powder-cup').style.left=(c.x-90)/960*100+'%';$('powder-cup').style.top=(c.y-100)/650*100+'%';$('powder-cup').style.transform=`rotate(${-c.tilt*.85}rad)`;$('powder-in-cup').style.transform=`scaleY(${Math.max(0,prep.grounds/prep.dose)})`;$('powder-in-cup').style.transformOrigin='center bottom';$('powder-in-cup').style.transformBox='fill-box';$('dose-next').disabled=!P.canAdvance(prep,'dose');$('dose-status').textContent=P.canAdvance(prep,'dose')?(P.bedQuality(prep)>.85?'粉床已經平整，帶上這份準備。':'粉已倒入，還能輕晃濾杯鋪得更均勻。'):prep.powderFlow>0?'咖啡粉正在落入濾杯，粉床逐漸形成。':prep.poured>0?'粉杯還有一些粉，繼續移到上方倒入。':'濾紙還空著，請把粉杯帶到濾杯上方。';}
    if(screen==='heat'){$('heat-needle').setAttribute('transform',`rotate(${-120+(prep.temperature-24)/76*240} 120 110)`);$('heat-exact').textContent=prep.temperature.toFixed(1)+' °C';$('heater-toggle').setAttribute('aria-pressed',String(prep.heaterOn));$('heater-toggle').innerHTML=prep.heaterOn?'停止加熱 <span aria-hidden="true">Ⅱ</span>':'開始加熱 <span aria-hidden="true">♨</span>';$('heat-next').disabled=!P.canAdvance(prep,'heat');$('heat-status').textContent=prep.heaterOn?(prep.temperature>97?'已接近沸騰，指針與蒸氣正在回應。':'加熱中，指針正在往熱端移動。'):prep.heated?'離開熱源後水會冷卻，何時開始由你決定。':'水壺安靜地等待。先啟動加熱，再讀一讀指針。';}
  }
  function observe(){
    const now=visualTime*1000;
    $('upright-button').hidden=!simulation.dripperTipped&&!simulation.serverTipped;
    if(now-lastHint<500)return;lastHint=now;const s=simulation,g=R.geometry(kettle);let key,text,warning=false;
    if(s.dripperTipped||s.serverTipped){key='knocked';text='器具倒下了！先放開水壺，按「扶正器具」再續注；現在的水只會流到桌上。';warning=true;}
    else if(!s.started){key='ready';text='按住水壺拖移前後左右；以滾輪或 W/S 調水。虛線環是瞄準，大流量與急甩會讓水偏離。';}
    else if(s.flow>0&&g.x*g.x+g.y*g.y>1){key='outside';text='水落在濾杯外，慢慢把落點帶回粉床。';warning=true;}
    else if(s.freeWater>M.CONFIG.capacity*.83){key='full';text='積水已接近濾杯邊緣，排水正努力追上注水。';warning=true;}
    else if(s.flow>7){key='harsh';text='水流很強，液面與粉床正被明顯擾動。';warning=true;}
    else if(s.flow>0&&s.saturation<.65){key='wetting';text='乾粉逐漸轉深，留意還沒被水照顧的地方。';}
    else if(s.flow===0&&s.bloomActivity>.38){key='bloom';text='粉床鼓起、氣泡釋放。停下來，也是一種沖煮。';}
    else if(s.freeWater>4){key='pool';text='粉床上方形成積水與反光，液面隨進水與滴漏持續變化。';}
    else if(s.flow>0){key='pour';text='水流穩定落下，慢慢照顧整片粉床。';}
    else if(s.poreWater>2){key='drain';text='積水退去，咖啡液還在滴落，濕潤的粉床重新顯露。';}
    else{key='quiet';text='滴漏漸漸稀疏。是否續注、何時收尾，由你判斷。';}
    if(key!==observationKey){observationKey=key;$('observation-text').textContent=text;$('observation-text').parentElement.classList.toggle('warning',warning);}
    if(s.eventId!==lastChaos){lastChaos=s.eventId;const lines={miss:['你在澆花嗎？','濾杯：我在這裡。','這杯是在沖桌子。'],edge:['咖啡粉：不要只沖旁邊！','濾紙不是你的第二杯。'],flood:['桌子喝得比咖啡還多。','這不是手沖，這是水災。','恭喜，你成功泡濕桌面。'],crater:['粉床：這裡不是採礦場。','這個坑，很有你的風格。'],knock:['濾杯：我怎麼躺下了？！'],domino:['一壺雙倒！分享壺也躺平了。']};const choices=lines[s.eventKind]||lines.miss;$('chaos-toast').textContent=choices[(s.eventId-1)%choices.length];$('chaos-toast').hidden=false;toastUntil=visualTime+2.6;if(s.eventKind!=='edge'&&!matchMedia('(prefers-reduced-motion: reduce)').matches){$('scene').classList.remove('accident-shake');void $('scene').offsetWidth;$('scene').classList.add('accident-shake');}}
    if(visualTime>toastUntil)$('chaos-toast').hidden=true;
    $('scene-state').textContent=s.started?'專注沖煮':'準備就緒';$('brew-temp-marker').style.left=M.clamp((s.temperature-24)/76)*100+'%';if(prep.mode==='practice')$('game-temperature').textContent=`壺中水溫 ${s.temperature.toFixed(1)} °C · 本配方起始參考 ${s.bean.tempRange.join('～')} °C`;
  }
  function finish(){
    if(screen!=='game'||paused||simulation.finished||!simulation.prepared)return;stopInput();$('finish-button').disabled=true;const result=M.finish(simulation);
    $('total-score').textContent=result.total;$('score-badge').textContent=result.flavor.label;$('flavor-title').textContent=result.flavor.title;$('flavor-description').textContent=result.flavor.text;
    $('flavor-notes').replaceChildren(...result.flavor.notes.map(text=>{const n=document.createElement('span');n.textContent=text;return n;}));
    const names={uniformity:'萃取均勻度',control:'注水控制',bloom:'悶蒸表現',rhythm:'沖煮節奏',balance:'整體平衡度'};
    $('metric-list').innerHTML=Object.entries(names).map(([key,label])=>`<div class="metric-row"><div class="metric-label"><span>${label}</span><strong>${result.metrics[key]} / 100</strong></div><div class="metric-track" aria-hidden="true"><div class="metric-fill" style="width:${result.metrics[key]}%"></div></div></div>`).join('');
    const seconds=Math.round(result.elapsed);$('result-time').textContent=`${Math.floor(seconds/60)} 分 ${(seconds%60).toString().padStart(2,'0')} 秒`;$('result-water').textContent=`${Math.round(result.water)} ml`;$('result-pulses').textContent=result.pulses.length+' 段';
    const facts=[['豆種／烘焙',`${result.beanName} · ${result.roast}`],['研磨設定',`${BrewBeans.grindLabel(result.grind)}（${Math.round(result.grind*100)}）`],['起始／結束水溫',`${result.initialTemperature.toFixed(1)} / ${result.finalTemperature.toFixed(1)} °C`],['接觸平均水溫',result.meanTemperature.toFixed(1)+' °C'],['簡化萃取進度',Math.round(result.extraction*100)+'%'],['準備表現',result.preparation+' / 100']];
    $('result-parameters').innerHTML=facts.map(([k,v])=>`<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');$('result-factors').textContent=`主要失分來源：${result.factors.slice(0,2).map(f=>`${f.label}（${Math.round(f.value*100)}）`).join('、')}。${prep.mode==='practice'?'這杯為練習，不覆寫正式最佳紀錄。':''}`;
    const a=result.accidents;$('accident-comment').textContent=a.comment;
    $('accident-facts').innerHTML=[['撞倒濾杯',`${a.knockdowns} 次`],['連帶撞倒分享壺',`${a.serverKnockdowns} 次`],['器具倒出液體',`${Math.round(a.knockedWater)} ml`],['水跑去哪了',`${Math.round(a.missRatio*100)}% 灑出粉床`],['濾紙／邊緣撞擊',`${a.edgeHits} 次`],['桌子喝了',`${Math.round(a.tableWater)} ml`],['灑水事故',`${a.spillAccidents} 次`],['局部通道',`${Math.round(a.channeling*100)}%`],['粉床翻攪',`${Math.round(a.disturbance*100)}%`],['水流穩定度',`${Math.round(a.stability*100)}%`],['手柄離家出走',`${a.grinderBreaks} 次`],['暴力研磨負荷',a.grindAbuse<.1?'溫柔':a.grindAbuse<.6?'有點急':'很有破壞力']].map(([k,v])=>`<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
    $('accident-penalty').textContent=`事故額外扣分 ${a.penalty.toFixed(1)} 分${prep.mode==='practice'?'（練習寬容：事故扣分減半）':''}。灑水也會降低原有注水控制與有效萃取，並非只扣此項。`;
    $('advice-list').replaceChildren(...result.advice.map(text=>{const n=document.createElement('li');n.textContent=text;return n;}));
    const newBest=prep.mode==='challenge'&&result.total>0&&(!best||result.total>best.score);$('new-best').hidden=!newBest;if(newBest){best={score:result.total,label:result.flavor.label,beanId:result.beanId};try{localStorage.setItem(storageKey,JSON.stringify(best));}catch{}updateBest();}showScreen('result');
  }
  $('upright-button').addEventListener('click',()=>{if(screen!=='game'||paused||simulation.finished)return;stopInput();if(BrewChaos.upright(simulation)){$('upright-button').hidden=true;$('observation-text').textContent='器具已扶正，灑出的水留在桌上。這次慢慢靠近。';$('kettle').focus({preventScroll:true});}});
  $('finish-button').addEventListener('click',finish);
  function tick(dt){
    if(screen==='grind'&&grindHeld)P.grind(prep,dt*4.2,dt);
    if(screen==='dose'){const c=prep.container;if(keys.has('ArrowLeft'))c.x-=150*dt;if(keys.has('ArrowRight'))c.x+=150*dt;if(keys.has('ArrowUp'))c.y-=120*dt;if(keys.has('ArrowDown'))c.y+=120*dt;c.x=M.clamp(c.x,90,800);c.y=M.clamp(c.y,90,350);}
    if(['grind','dose','heat'].includes(screen)){P.step(prep,dt);return;}
    if(screen==='game'){
      if(keys.has('ArrowLeft'))C.setAim(control,control.aimX-dt*.9,control.aimY);if(keys.has('ArrowRight'))C.setAim(control,control.aimX+dt*.9,control.aimY);if(keys.has('ArrowUp'))C.setAim(control,control.aimX,control.aimY-dt*.8);if(keys.has('ArrowDown'))C.setAim(control,control.aimX,control.aimY+dt*.8);
      if(keys.has('ArrowUp')||keys.has('ArrowDown'))$('depth-setting').value=control.aimY;
      if(keys.has('KeyW'))setFlow(control.flowSetting+dt*3);if(keys.has('KeyS'))setFlow(control.flowSetting-dt*3);const before=collisionPose;C.step(control,dt);kettle=C.pose(control);
      if(BrewChaos.collide(simulation,before,kettle,dt,control.pouring)){stopInput();kettle=C.pose(control);crack();}
      collisionPose=control.pouring?kettle:null;
      const g=R.geometry(kettle);M.step(simulation,{flow:kettle.flow,x:g.x,y:g.y,instability:kettle.instability},dt);
    }
  }
  function frame(now){
    if(previousTime===null)previousTime=now;const raw=(now-previousTime)/1000;previousTime=now;
    if(active.includes(screen)&&!paused){if(raw>.6)pause('畫面曾中斷，已暫停以避免準備或萃取跳秒。');else{accumulator+=Math.max(0,raw);visualTime+=Math.max(0,raw);while(accumulator>=M.CONFIG.step){tick(M.CONFIG.step);accumulator-=M.CONFIG.step;}updateAudio();}if(screen==='game'){placeKettle();observe();renderer.draw(simulation,kettle,visualTime);}else{updatePreparationUI();prepRenderers[screen].draw(prep,screen,visualTime);}}
    else if(screen==='home'&&previewDirty){preview.resize();preview.draw(previewState,{x:650,tilt:0},0);previewDirty=false;}requestAnimationFrame(frame);
  }
  updateBest();renderBeans();placeKettle();preview.draw(previewState,{x:650,tilt:0},0);requestAnimationFrame(frame);
})();
