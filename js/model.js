/* 可在瀏覽器與測試環境單獨執行的確定性沖煮模型。單位：秒、ml。 */
(function (root) {
  'use strict';
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const mean = values => values.reduce((a, b) => a + b, 0) / (values.length || 1);
  const quality = (value, target, tolerance) => Math.exp(-Math.pow((value - target) / tolerance, 2));
  const CONFIG = Object.freeze({ targetWater: 270, targetTime: 125, bloomWait: 24, maxFlow: 10.5, capacity: 86, step: 1 / 60 });

  function create(options = {}) {
    const bean = root.BrewBeans ? root.BrewBeans.get(options.beanId) : {id:'yirgacheffe',name:'衣索比亞',roast:'淺焙',notes:['柑橘','花香','蜂蜜'],grindRange:[.55,.75],tempRange:[92,96],solubility:.87,permeability:1,gas:1.15,rhythmSensitivity:1.15,bloomWait:26,targetTime:135,targetExtract:.66};
    const grind=clamp(options.grind ?? .6),dose=clamp(options.dose ?? 18,0,18);
    const cells = [{ x: 0, y: 0, wet: 0, dose: 0, contact: 0, extraction: 0 }];
    [0.34, 0.65, 0.9].forEach((radius, ring) => {
      const count = [6, 12, 16][ring];
      for (let i = 0; i < count; i++) {
        const angle = i / count * Math.PI * 2 + ring * 0.3;
        cells.push({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, wet: 0, dose: 0, contact: 0, extraction: 0 });
      }
    });
    const distribution=options.distribution||Array(cells.length).fill(1),densityMean=mean(distribution)||1;
    cells.forEach((c,i)=>{c.groundDensity=clamp((distribution[i]??densityMean)/densityMean,.15,3);});
    return root.BrewChaos.initialize({
      bean,grind,dose,prepared:options.prepared !== false&&dose>=17.46,bedQuality:clamp(options.bedQuality ?? 1),
      initialTemperature:clamp(options.temperature ?? 94,24,100),temperature:clamp(options.temperature ?? 94,24,100),
      temperatureIntegral:0,temperatureContact:0,thermalQuality:0,poreWater:0,freeWater:0,surfaceHeight:0,aimX:0,aimY:0,overflowRate:0,
      permeability:bean.permeability*Math.exp((.5-grind)*2.7),clogging:0,waterLevelPeak:0,
      cells, started: false, finished: false, elapsed: 0, totalWater: 0, landedWater: 0,
      missedWater: 0, overflow: 0, bedWater: 0, absorbed: 0, beverage: 0, drained: 0,
      flow: 0, drainage: 0, uniformity: 0, saturation: 0, bloomActivity: 0,
      bloomWet: 0, bloomUniform: 0, bloomDose: 0, bloomWait: 0, bloomRecorded: false,
      pulses: [], activePulse: null, pendingStop: null, lastStop: null, gaps: [],
      gentleWater: 0, harshWater: 0, unstableWater: 0, movement: 0, lastAim: null, dryTime: 0,
      bloomContact: 0, maxWater: 0
    },options);
  }

  function flowForTilt(tilt) { return tilt <= 0.06 ? 0 : CONFIG.maxFlow * Math.pow(clamp((tilt - 0.06) / 0.94), 1.55); }

  function endPulse(s) {
    if (!s.activePulse) return;
    s.activePulse.end = s.pendingStop === null ? s.elapsed : s.pendingStop;
    s.activePulse.duration = s.activePulse.end - s.activePulse.start;
    s.activePulse.wet = s.saturation;
    s.activePulse.uniformity = s.uniformity;
    s.pulses.push(s.activePulse);
    s.lastStop = s.activePulse.end;
    s.activePulse = null;
    s.pendingStop = null;
    s.lastAim = null;
  }

  function step(s, input, dt = CONFIG.step) {
    if (s.finished) return s;
    // 外部呼叫也不可用超大 dt 跳過物理；UI 另以固定步長推進。
    dt = clamp(Number.isFinite(dt) ? dt : 0, 0, 0.05);
    root.BrewChaos.updateRig(s,dt);
    const flow = Number.isFinite(input.flow)?clamp(input.flow,0,10.5):flowForTilt(input.tilt || 0);
    // 壺中熱水在準備就緒與停水時也會自然冷卻；暫停時外部不呼叫 step。
    s.temperature=Math.max(24,s.temperature-(s.temperature-24)*.0007*dt);
    if(!s.prepared||s.dose<=0){s.flow=0;return s;}
    if (!s.started && flow <= 0) return s;
    if(!s.started)s.initialTemperature=s.temperature;
    s.started = true;
    s.elapsed += dt;
    s.flow = flow;

    if (flow > 0) {
      if (!s.activePulse) {
        if (s.lastStop !== null) s.gaps.push(s.elapsed - s.lastStop);
        if (!s.bloomRecorded && s.pulses.length) {
          const first = s.pulses[0];
          s.bloomWait = s.elapsed - first.end;
          s.bloomDose = first.water;
          s.bloomWet = first.wet;
          s.bloomUniform = first.uniformity;
          s.bloomRecorded = true;
        }
        s.activePulse = { start: s.elapsed, end: s.elapsed, duration: 0, water: 0, wet: 0, uniformity: 0 };
      }
      s.pendingStop = null;
      let amount = flow * dt;
      s.activePulse.water += amount;
      s.totalWater += amount;
      const x = Number.isFinite(input.x) ? input.x : 0;
      const y = Number.isFinite(input.y) ? input.y : 0;
      s.aimX=x;s.aimY=y;
      amount=root.BrewChaos.impact(s,{...input,x,y},dt,amount);
      const inBed = amount>0;
      if (inBed) {
        s.landedWater += amount;
        const weights = s.cells.map(c => Math.exp(-((c.x - x) ** 2 + (c.y - y) ** 2) / 0.19));
        const sum = weights.reduce((a, b) => a + b, 0);
        s.cells.forEach((c, i) => {
          const dose = amount * weights[i] / sum;
          c.dose += dose;
          c.wet = clamp(c.wet + dose / (1.25*c.groundDensity));
        });
        const absorption = Math.min(amount*.55, Math.max(0, s.dose*1.1 - s.absorbed),3*dt);
        s.absorbed += absorption;
        s.poreWater += amount - absorption;
        if(s.poreWater>s.dose){s.freeWater+=s.poreWater-s.dose;s.poreWater=s.dose;}
        if (flow >= 2 && flow <= 6.5) s.gentleWater += amount;
        if (flow > 6.5) s.harshWater += amount * (flow - 6.5) / 4;
      }
      if (s.lastAim && inBed) {
        const distance = Math.min(2, Math.hypot(x - s.lastAim.x, y - s.lastAim.y));
        s.movement += distance * amount;
        s.unstableWater += amount * clamp((distance / Math.max(dt, 0.001) - 4) / 10);
      }
      s.lastAim = { x, y };
    } else if (s.activePulse) {
      if (s.pendingStop === null) s.pendingStop = s.elapsed;
      // 避免極短的輸入抖動被當成一次新分段。
      if (s.elapsed - s.pendingStop >= 0.45) endPulse(s);
    }

    const transfer=Math.min(s.poreWater,Math.max(0,s.dose*1.1-s.absorbed)*.13*dt);
    s.poreWater-=transfer;s.absorbed+=transfer;
    s.overflowRate=0;
    if(s.freeWater>CONFIG.capacity){const excess=s.freeWater-CONFIG.capacity;s.overflow+=excess;s.overflowRate=dt>0?excess/dt:0;s.freeWater=CONFIG.capacity;}
    const fill=Math.min(s.freeWater,Math.max(0,s.dose-s.poreWater));s.poreWater+=fill;s.freeWater-=fill;
    s.clogging=clamp((s.grind-.68)*1.2+s.harshWater/Math.max(1,s.landedWater)*.16);
    const resistance=s.permeability*(1-s.clogging*.55)*(0.7+s.bedQuality*.3);
    const drainRate=resistance*(.18+.065*s.poreWater+.095*s.freeWater);
    const mobile=s.poreWater+s.freeWater;
    const drained=Math.min(mobile,Math.max(0,drainRate*dt));
    const fromFree=Math.min(s.freeWater,drained);s.freeWater-=fromFree;s.poreWater=Math.max(0,s.poreWater-(drained-fromFree));
    s.drainage=dt>0?drained/dt:0;
    s.bedWater=s.poreWater+s.freeWater;
    s.surfaceHeight=Math.pow(clamp(s.freeWater/CONFIG.capacity),.62);
    s.maxWater=Math.max(s.maxWater,s.bedWater);s.waterLevelPeak=Math.max(s.waterLevelPeak,s.surfaceHeight);
    s.drained += drained;
    if(s.dripperTipped||s.serverTipped)root.BrewChaos.spill(s,drained,s.knockDirection*1.4,1);
    else s.beverage += drained;
    const wetAvg = mean(s.cells.map(c => c.wet));
    s.cells.forEach(c => {
      // 毛細擴散只能稍微補足局部濕潤；持續單點仍會留下不均勻的累積水量。
      if (s.bedWater > 4) c.wet += (wetAvg - c.wet) * dt * 0.075;
      c.wet = clamp(c.wet - dt * (s.bedWater > 1 ? 0.0005 : 0.003));
      const contact = c.wet * (s.bedWater > 0.5 ? 1 : 0.18);
      c.contact += contact * dt;
      const temperatureFactor=Math.exp((s.temperature-90)*.028);
      const surface=Math.exp((s.grind-.5)*1.05);
      c.extraction += (1 - c.extraction) * contact * dt * (.011+s.flow*.00018)*s.bean.solubility*surface*temperatureFactor*(1-c.channel*.48);
    });
    s.saturation = mean(s.cells.map(c => c.wet));
    const averageDose = mean(s.cells.map(c => c.dose));
    const cv = Math.sqrt(mean(s.cells.map(c => (c.dose - averageDose) ** 2))) / Math.max(averageDose, 0.01);
    s.uniformity = clamp(1 - cv * 0.72);
    s.bloomContact += s.saturation * dt;
    s.bloomActivity = clamp(s.saturation * Math.exp(-s.bloomContact / (25*s.bean.gas)) * 1.5*s.bean.gas);
    if(s.saturation>.05){s.temperatureIntegral+=s.temperature*dt;s.temperatureContact+=dt;}
    if (s.bedWater < 1 && s.elapsed > 36) s.dryTime += dt;
    root.BrewChaos.settle(s,dt);
    return s;
  }

  function finish(s) {
    if (!s.finished) {
      endPulse(s);
      s.flow = 0;
      s.finished = true;
    }
    return score(s);
  }

  function score(s) {
    const water = s.landedWater;
    const volumeQ = quality(water, CONFIG.targetWater, 93);
    const idealGrind=mean(s.bean.grindRange),idealTemperature=mean(s.bean.tempRange);
    const meanTemperature=s.temperatureContact>0?s.temperatureIntegral/s.temperatureContact:s.initialTemperature;
    const grindQ=quality(s.grind,idealGrind,.27),tempQ=quality(s.initialTemperature,idealTemperature,10)*.65+quality(meanTemperature,idealTemperature-3,10)*.35;
    const preparationQ=grindQ*.45+tempQ*.35+s.bedQuality*.2;
    const timeQ = quality(s.elapsed, s.bean.targetTime, 54/s.bean.rhythmSensitivity);
    const extract = mean(s.cells.map(c => c.extraction));
    const extractionQ = quality(extract, s.bean.targetExtract, 0.24);
    const concentrationQ = quality(s.beverage / Math.max(s.landedWater, 1), 0.87, 0.22);
    const lossQ = clamp(1 - (s.missedWater + s.overflow) / Math.max(s.totalWater, 1) * 2);
    const uniform = clamp(s.uniformity * 0.7 + s.saturation * 0.15+s.bedQuality*.15);
    const gentle = s.gentleWater / Math.max(water, 1);
    const harsh = s.harshWater / Math.max(water, 1);
    const unstable = s.unstableWater / Math.max(water, 1);
    const control = clamp((0.3 + gentle * 0.7 - harsh * 0.5 - unstable * 0.25) * lossQ);
    const bloom = s.bloomRecorded ? clamp(
      quality(s.bloomWait, s.bean.bloomWait, 17) * 0.4 +
      quality(s.bloomDose, 46, 27) * 0.24 + s.bloomWet * 0.2 + s.bloomUniform * 0.16
    ) : 0;
    const countQ = s.pulses.length >= 3 && s.pulses.length <= 5 ? 1 : s.pulses.length === 2 ? 0.65 : s.pulses.length === 1 ? 0.12 : 0.35;
    const gaps = s.gaps.slice(1);
    const gapQ = gaps.length ? mean(gaps.map(g => quality(g, 9, 12))) : 0;
    const rhythm = clamp(timeQ * 0.55 + countQ * 0.25 + gapQ * 0.2 - s.dryTime / 180);
    const balance = clamp(volumeQ*.3+extractionQ*.3+concentrationQ*.15+lossQ*.05+preparationQ*.2);
    const metrics = {
      uniformity: Math.round(uniform * 100), control: Math.round(control * 100),
      bloom: Math.round(bloom * 100), rhythm: Math.round(rhythm * 100), balance: Math.round(balance * 100)
    };
    const weighted = uniform * 20 + control * 16 + bloom * 18 + rhythm * 14 + balance * 20 + preparationQ*12;
    // 總水量是必要條件；少量水即使均勻潤濕也不能拿高分。
    const adequacy = clamp(water / 170) * clamp(1 - Math.max(0, water - 365) / 380);
    const accidents=root.BrewChaos.assess(s);
    let total = Math.round(weighted * adequacy-accidents.penalty);
    if (!s.bloomRecorded) total = Math.min(total, 69);
    else if (s.bloomWait < 6) total = Math.min(total, 79);
    if (water < 2) total = 0;
    if(!s.prepared||s.dose<17.46)total=0;
    if (water < 2) Object.keys(metrics).forEach(key => { metrics[key] = 0; });
    total = clamp(total, 0, 100);
    if(total<75&&accidents.raw<4&&water>=160&&s.bloomRecorded)accidents.comment='器具安好、桌面乾爽。再調整研磨、水溫或分段節奏，甜感會更靠近。';
    let flavor;
    if (water < 90 || extract < 0.5) flavor = { title: '還沒甦醒的清晨', label: '萃取不足', notes: ['青檸', '生澀', '單薄'], text: '酸感走在甜感前面，口感還有些單薄。讓粉床充分濕潤，給水與咖啡多一點相處的時間。' };
    else if (water > 370 || s.elapsed > 180 || extract > 0.87) flavor = { title: '停留太久的餘韻', label: '萃取過度', notes: ['深木質', '苦味', '乾澀'], text: '尾韻偏苦，帶著乾燥的木質感。試著縮短停留，在滴漏漸緩時收尾。' };
    else if (uniform < 0.6) flavor = { title: '有點迷路的風味', label: '萃取不均', notes: ['尖酸', '雜味', '不協調'], text: '有的地方走得太快，有的地方還在等待。把落點慢慢帶過整片粉床，讓每一處都被照顧。' };
    else if (control < 0.62) flavor = { title: '被水流打亂的旋律', label: '注水控制待練習', notes: ['厚重', '粗糙', '混濁'], text: '水流帶起了太多擾動，乾淨度因此減少。輕一點傾斜水壺，讓細水流穩定地落下。' };
    else if (total >= 80) flavor = { title: '剛剛好的那一杯', label: '沖煮平衡', notes: [...s.bean.notes], text: `這次以${s.bean.notes.join('、')}為代表的風味輪廓較完整，甜感與尾韻取得平衡。這是依本款示範配方與操作推估的遊戲描述。` };
    else flavor = { title: '甜感正在靠近', label: '逐漸平衡', notes: ['淡柑橘', '穀物', '輕甜'], text: '已經能嚐到一些乾淨的甜味。再調整悶蒸與分段的呼吸，風味就會更加完整。' };
    const advice = [];
    if(s.knockdowns)advice.push('水壺伸向前緣時會降低，快速撞進杯緣會撞倒器具。縮小移動範圍、放慢靠近；撞倒後先扶正再續注。');
    if(s.grinderBreaks)advice.push('磨豆手柄曾斷裂。保持連續的小幅圓周操作，別快速甩動；修好後放慢一點。');
    if(s.channeling>.35)advice.push('局部已挖出通道。用柔和水流畫小圈、換照顧不同區域，別讓水一直打同一點。');
    if(accidents.missRatio>.04)advice.push('灑水與桌面濕度會扣分。大流量容易偏流，靠近外圈時縮小圈、減弱水流。');
    if (water < 180) advice.push('這次注水偏少。觀察分享壺的累積，下次讓咖啡液更完整地形成。');
    if (water > 340) advice.push('這次注水偏多。分享壺漸滿時，試著更早停止並等待濾杯滴完。');
    if (!s.bloomRecorded) advice.push('這次沒有形成悶蒸停頓。先均勻潤濕，再停水等待氣泡緩和，接著分段續注。');
    else if (bloom < 0.78) advice.push(s.bloomWait < 15 ? '悶蒸停得太短。第一次停水後，觀察膨脹與氣泡自然慢下來，再開始續注。' : s.bloomDose > 70 ? '第一次注水偏多。先讓粉床均勻轉深，留出停水悶蒸的空間。' : '悶蒸可以更均勻。先輕柔地照顧整片乾粉，再等待氣泡逐漸消退。');
    if(grindQ<.78)advice.push(s.grind>idealGrind?'研磨偏細，阻力與接觸增加。下次調粗一些，觀察積水是否更容易下降。':'研磨偏粗，水通過得較快。下次調細一些，讓甜感有時間形成。');
    if(tempQ<.8)advice.push(s.initialTemperature>idealTemperature?'這款配方的起始水溫偏高。下次停止加熱後稍候，避免苦澀與香氣失衡。':'起始水溫偏低，萃取速度較慢。下次讓類比指針再往熱端靠近一些。');
    if(s.bedQuality<.8)advice.push('乾粉堆積不均。下次倒粉後輕晃濾杯，把表面鋪得更平整。');
    if (uniform < 0.8) advice.push('落點太集中。慢慢左右掃動，搭配前後落點滑桿或方向鍵，照顧整片粉床。');
    if (s.missedWater > 4) advice.push('有水落在濾杯外。放慢橫向移動，跟著水流末端調整落點。');
    if (s.overflow > 3) advice.push('粉床曾經溢水。水面升高時先放開水壺，讓滴漏追上注水。');
    if (control < 0.8) advice.push('水流可以更細。用滾輪、W/S 或流量滑桿調小，維持落點穩定再慢慢移動。');
    if (s.bedWater > 12) advice.push('收尾時粉床還有明顯積水。停水後多觀察一會兒，讓最後的咖啡液流入分享壺。');
    if (rhythm < 0.75) advice.push('試著讓續注分成幾段，在水面下降、粉床仍濕潤時接上下一段。');
    if (!advice.length) advice.push('這次的控制很穩定。下次試著讓整片粉床更一致，保留同樣輕柔的節奏。');
    const factors=[{label:'準備與參數',value:preparationQ},{label:'萃取均勻度',value:uniform},{label:'注水控制',value:control},{label:'悶蒸',value:bloom},{label:'節奏',value:rhythm},{label:'整體平衡',value:balance}].sort((a,b)=>a.value-b.value);
    return { total, metrics, flavor, accidents, advice: advice.slice(0, 5), factors,preparation:Math.round(preparationQ*100),beanId:s.bean.id,beanName:s.bean.name,roast:s.bean.roast,grind:s.grind,initialTemperature:s.initialTemperature,meanTemperature,finalTemperature:s.temperature,extraction: extract, water: s.totalWater, elapsed: s.elapsed, beverage: s.beverage, remaining: s.bedWater, pulses: s.pulses.map(p => ({ ...p })) };
  }
  root.BrewModel = { CONFIG, create, step, finish, score, flowForTilt, clamp };
})(globalThis);
