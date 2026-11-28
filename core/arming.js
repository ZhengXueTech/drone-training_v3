/* core/arming.js — 起槳／停槳（2026-11-28 老師：模擬器沒有起槳停槳，也沒有教學；擺攤時每個人都會遇到）
   規則（照實機 Betaflight／天芎／Balkin v3）：
     ・起槳前馬達不轉，飛不起來
     ・起槳時油門要在最低（遙控器）／不能推油門（手把、鍵盤）
     ・空中停槳＝馬達停，直接掉下來（安全教育）；手勢／按鍵在空中不接受停槳，只有撥桿可以
   起槳方式優先順序：
     1. 遙控器有指派「起槳撥桿」（搖桿精靈 fn:'arm'）→ 撥桿，跟真機一樣
     2. 沒有撥桿 → 兩支搖桿往「下、內」扳住，畫面風扇轉起來（約 1 秒）就放開（CSC 手勢；下、外 也可以）
     3. 標準手把另有 Y 鍵；鍵盤 E 鍵；觸控／滑鼠點畫面上的「起槳」鈕
   教學：同一台電腦前 3 次起槳顯示大提示（含動畫），之後縮成角落小字；首頁「換下一位玩家」會重設。
   用法（關卡）：
     const arm=new Arming({input});
     每幀：const p2=arm.tick(dt,p,{airborne}); → 用 p2 取代 p 給物理；arm.armed 判斷馬達有沒有在轉
     arm.reset() 開新局（回到停槳）。arm.onChange=(armed,{air})=>{} 可選。 */
import { gpCfgRead } from './input.js';
import { sfx } from './audio.js';

const KEY='nd.armCount', BIG_N=3, GEST_T=1.0;   // 手勢要扳住 1 秒（11-28 老師：0.5 秒太短，馬達一轉、手還扳著，機頭就被轉歪）
const NEUTRAL={throttle:-1,yaw:0,pitch:0,roll:0};
const isRC=(gp,cfg)=>!!(cfg&&cfg.throttleType==='bottom')||/startrc|radiomaster|edgetx|opentx|frsky|jumper|tx16|boxer|zorro|pocket|rc /i.test(gp.id);

export class Arming{
  constructor({input,ui=null,enabled=true}={}){
    this.input=input; this.ui=ui; this.enabled=enabled; this.armed=!enabled;
    this._g=0; this._gLock=false; this._swPrev=null; this._swBlock=false; this._warnT=0; this._kb=false; this._click=false; this._yFree=false;
    this.onChange=null; this._build();
    addEventListener('keydown',e=>{ if(e.code==='KeyE'&&!e.repeat)this._kb=true; });
    globalThis.__ndArmed=this.armed;
  }
  count(){ try{ return +localStorage.getItem(KEY)||0; }catch{ return 0; } }
  reset(){ this._set(false,false,true); this._swBlock=this._swPrev===true; }   // 撥桿還在「開」：要先撥回去再撥上來才算（跟 Betaflight 一樣）
  /* 這一刻用哪一種方法起槳（教學文字依此） */
  method(p){
    const gp=this._gp(p);
    if(gp){ const cfg=gpCfgRead(gp);
      if(cfg?.axBtns?.find(b=>b.fn==='arm'))return 'switch';
      return isRC(gp,cfg)?'rc':'pad'; }
    return p.device==='touch'?'touch':'kb';
  }
  _gp(p){ if(p.device!=='gamepad')return null; return this.input.gamepads().find(g=>g.index===p.pad)||null; }
  _set(v,air,silent){
    if(this.armed===v)return; this.armed=v; globalThis.__ndArmed=v;
    if(v&&!silent){ try{ localStorage.setItem(KEY,String(this.count()+1)); }catch{} }
    this.onChange&&!silent&&this.onChange(v,{air});
    if(!silent)this._flash(v?(this._relLock?'🌀 馬達轉了！先放開搖桿，再推油門起飛':'🌀 已起槳　馬達怠速中，推油門起飛'):air?'⚠ 空中停槳！馬達停了，飛機直接掉下去':'🔒 已停槳');
  }
  tick(dt,p,{airborne=false}={}){
    globalThis.__ndAirborne=airborne;
    if(!this.enabled){ this._ui(p,false); return p; }
    const gp=this._gp(p), cfg=gp?gpCfgRead(gp):null, m=this.method(p);
    const lowT=(m==='switch'||m==='rc')?p.throttle<-0.8:p.throttle<0.15;   // 遙控器油門不回中：要拉到最低；手把／鍵盤：沒推油門就好
    let want=null;   // true=要起槳 false=要停槳
    // 1. 撥桿（位置型：開＝起槳）
    if(m==='switch'){
      const ab=cfg.axBtns.find(b=>b.fn==='arm'), on=((gp.axes[ab.ax]??0)-(ab.mid??0))*(ab.on||1)>0.3;
      if(this._swPrev===null)this._swPrev=on, this._swBlock=on;          // 開關卡一進來就在「開」：先撥回去
      if(!on){ this._swBlock=false; if(this.armed)want=false; }
      else if(!this.armed&&!this._swBlock){ if(lowT)want=true; else{ this._swBlock=true; this._warn('油門沒拉到最低，起槳被擋下來了。把起槳撥桿撥回去，油門拉到底，再撥一次'); } }
      this._swPrev=on;
    }
    // 2. 手勢（所有搖桿都有效；撥桿那支也可以當備用）
    let gest=false;
    if(gp&&m!=='switch'){
      const ax=n=>this.input.gpAxis(gp,n,cfg), t=ax('throttle'), y=ax('yaw'), pi=ax('pitch'), r=ax('roll');
      // 2026-11-28 實測：手把搖桿是圓形框，扳到斜角時每一軸只有約 0.7（截圖 Y +69%），不可能兩軸都過 0.85。
      // 改成看「扳得夠遠（長度 0.8 以上）＋方向在對的那一格」：左桿右下（或左下）、右桿左下（或右下），兩邊相反。
      const L=Math.hypot(y,t), Rr=Math.hypot(r,pi), Q=0.4;
      gest=L>0.8&&Rr>0.8&&t<-Q&&pi<-Q&&((y>Q&&r<-Q)||(y<-Q&&r>Q));
      if(gest&&!this._gLock){ this._g+=dt; if(this._g>=GEST_T){ this._gLock=true; this._g=0;
          if(!this.armed){ want=true; this._relLock=true; } else if(!airborne)want=false; else this._warn('空中不能用手勢停槳，先降落'); } }
      if(!gest){ this._g=0; if(Math.abs(y)<0.3&&Math.abs(r)<0.3)this._gLock=false; }
    }
    // 2b. 搖桿精靈把「起槳」指派給一顆按鈕：按一下切換
    if(gp&&Number.isInteger(cfg?.buttons?.arm)&&cfg.buttons.arm>=0){ if(this.input.gpBtnEdge(gp,cfg.buttons.arm))want=this._toggleWant(airborne,lowT); }
    // 3. 標準手把 Y 鍵（b3 沒被其他功能占用時）
    this._yFree=false;
    if(gp&&m==='pad'&&gp.mapping==='standard'){
      const used=Object.values(cfg?.buttons||{}).includes(3)||(cfg?.buttons&&cfg.buttons.arm>=0);
      this._yFree=!used;
      const e=this.input.gpBtnEdge(gp,3);
      if(e&&!used) want=this._toggleWant(airborne,lowT);
    }
    // 4. 鍵盤 E／畫面按鈕
    if(this._kb||this._click){ this._kb=false; this._click=false; want=this._toggleWant(airborne,lowT); }
    if(want===true&&!this.armed){ if(lowT||m==='switch')this._set(true,airborne); else this._warn(m==='kb'?'起槳時不要按 W（油門）':'起槳時不要推油門'); }
    else if(want===false&&this.armed)this._set(false,airborne);
    this._warnT=Math.max(0,this._warnT-dt);
    this._spin=gest&&!this._gLock?Math.min(1,this._g/GEST_T):0;
    // 手勢起槳後：搖桿還扳在角落 → 先不吃輸入，等放開（不然一起槳就被偏航／前後帶走）
    if(this._relLock&&gp){ const ax=n=>this.input.gpAxis(gp,n,cfg);
      if(Math.abs(ax('yaw'))<0.3&&Math.abs(ax('roll'))<0.3&&Math.abs(ax('pitch'))<0.3)this._relLock=false; }
    if(!this.armed)this._relLock=false;
    this._ui(p,gest&&!this.armed,m);
    this._hum(dt,p);
    if(this.armed&&this._relLock)return {...p,...NEUTRAL};
    // 還在地上、沒推油門：真機沒有升力，轉向和前後左右都沒有作用（只有油門能讓它離地）
    if(this.armed&&!airborne&&p.throttle<0.2)return {...p,yaw:0,pitch:0,roll:0};
    if(this.armed)return p;
    // 停槳：馬達不轉＝沒有任何控制
    return {...p,...NEUTRAL};
  }
  _toggleWant(air,lowT){ if(!this.armed)return true; if(air){ this._warn('空中不能用按鍵停槳，先降落'); return null; } return false; }
  _warn(t){ if(this._warnT>0)return; this._warnT=2.5; this._flash('⚠ '+t,true); }

  /* ── 畫面 ── */
  _build(){
    const css=document.createElement('style');
    css.textContent=`#nd-arm{position:fixed;left:50%;top:22%;transform:translateX(-50%);z-index:60;pointer-events:none;text-align:center;
      background:rgba(8,16,30,.9);color:#fff;font:600 17px system-ui,"Microsoft JhengHei",sans-serif;padding:14px 22px 16px;border-radius:16px;border:2px solid #ffb44a;max-width:min(92vw,520px)}
      #nd-arm h3{margin:0 0 6px;font-size:24px;color:#ffd27a}#nd-arm .s{font-size:14px;color:#cdd6e4;font-weight:500;margin-top:6px}
      #nd-arm svg{display:block;margin:8px auto 2px}
      #nd-arm.small{left:auto;right:12px;top:auto;bottom:236px;transform:none;padding:6px 12px;font-size:14px;border-width:1px}
      #nd-arm.small h3{font-size:15px;margin:0;display:inline}#nd-arm.small .d,#nd-arm.small svg,#nd-arm.small .s{display:none}
      #nd-arm-btn{pointer-events:auto;margin-top:8px;font:700 16px system-ui,"Microsoft JhengHei",sans-serif;padding:8px 18px;border-radius:999px;border:0;background:#ffb44a;color:#1a1200;cursor:pointer}
      #nd-arm.small #nd-arm-btn{margin:0 0 0 8px;padding:3px 10px;font-size:13px}
      #nd-arm-st{position:fixed;right:12px;bottom:200px;z-index:59;pointer-events:none;font:600 13px system-ui,"Microsoft JhengHei",sans-serif;padding:4px 10px;border-radius:999px;background:rgba(8,16,30,.8);color:#fff;border:1px solid rgba(255,255,255,.35)}
      #nd-arm-st .fan{display:inline-block;animation:ndFan .35s linear infinite}@keyframes ndFan{to{transform:rotate(360deg)}}
      #nd-arm .bar{height:8px;border-radius:4px;background:#33445e;margin:8px auto 0;width:200px;overflow:hidden}#nd-arm .bar i{display:block;height:100%;background:#ffb44a;width:0}
      #nd-arm-fl{position:fixed;left:50%;top:32%;transform:translateX(-50%);z-index:61;pointer-events:none;display:none;font:700 18px system-ui,"Microsoft JhengHei",sans-serif;padding:10px 18px;border-radius:12px;background:rgba(8,16,30,.92);color:#fff;border:1px solid rgba(255,255,255,.4)}
      @keyframes ndArmL{0%,15%{transform:translate(0,0)}45%,85%{transform:translate(var(--dx),14px)}100%{transform:translate(0,0)}}
      #nd-arm .knob{animation:ndArmL 2.4s ease-in-out infinite}`;
    document.head.appendChild(css);
    const el=document.createElement('div'); el.id='nd-arm'; el.style.display='none'; document.body.appendChild(el); this._el=el;
    const st=document.createElement('div'); st.id='nd-arm-st'; st.style.display='none'; document.body.appendChild(st); this._st=st;
    const fl=document.createElement('div'); fl.id='nd-arm-fl'; document.body.appendChild(fl); this._fl=fl;
    el.addEventListener('click',e=>{ if(e.target.id==='nd-arm-btn')this._click=true; });
  }
  _flash(t,warn){ const f=this._fl; f.textContent=t; f.style.borderColor=warn?'#ffb44a':'rgba(255,255,255,.4)'; f.style.display='block';
    clearTimeout(this._flT); this._flT=setTimeout(()=>f.style.display='none',2600); }
  _ui(p,gesturing,m){
    const show=this.enabled&&!this.armed&&!(this.ui&&this.ui.modalOpen)&&!this.hidden;
    this._st.style.display=this.enabled&&!this.hidden?'block':'none';
    this._st.innerHTML=this.armed?'<span class="fan">✣</span> 已起槳':'🔒 停槳';
    this._st.style.borderColor=this.armed?'#4ade80':'rgba(255,255,255,.35)';
    if(!show){ this._el.style.display='none'; return; }
    { const gp=this._gp(p); this._yName=gp&&/dualsense|dualshock|wireless controller|054c|playstation/i.test(gp.id)&&!/xbox/i.test(gp.id)?'△':'Y'; }
    const big=this.count()<BIG_N, key=m+(big?'B':'S')+(gesturing?'g':'')+(this._yFree?'y':'');
    this._el.style.display='block';
    if(this._key===key){ const b=this._el.querySelector('.bar i'); if(b)b.style.width=Math.round(this._spin*100)+'%'; return; } this._key=key;
    this._el.className=big?'':'small';
    const D={
      switch:['撥起「起槳撥桿」','油門先拉到最低，再撥起槳撥桿（真機也是這樣）。','sw'],
      rc:['兩支搖桿往「下、內」扳','油門拉到底，左桿往右下、右桿往左下扳住；看到風扇轉起來、聽到馬達聲（約 1 秒）就放開。','csc'],
      pad:this._yFree?[`按 ${this._yName} 起槳`,'也可以：兩支搖桿都往「下、內」扳住，風扇轉起來（約 1 秒）就放開（跟遙控器一樣）。','csc']
        :['兩支搖桿往「下、內」扳','左桿扳到右下角、右桿扳到左下角扳住，風扇轉起來（約 1 秒）就放開（'+this._yName+' 鍵已被搖桿設定用掉）。','csc'],
      kb:['按 E 起槳','起槳時不要按 W（油門）。降落後再按一次 E＝停槳。',null],
      touch:['點下面的「起槳」','起槳後馬達開始轉，才能推油門起飛。',null]}[m]||['起槳',''];
    this._el.innerHTML=`<h3>🔒 先起槳</h3><div class="d">${gesturing?'<span class="fan" style="display:inline-block;animation:ndFan .5s linear infinite">✣</span> 馬達啟動中…繼續扳住':D[0]}</div>${gesturing?'<div class="bar"><i></i></div>':''}${big&&D[2]&&!gesturing?this._svg(D[2]):''}`
      +`<div class="s">${D[1]}<br>降落後記得停槳；空中停槳飛機會直接掉下去。</div>`
      +(m==='touch'||m==='kb'||!big?`<button id="nd-arm-btn" type="button">🔓 起槳</button>`:'');
  }
  _svg(kind){
    if(kind==='sw')return `<svg width="120" height="70" viewBox="0 0 120 70"><rect x="10" y="10" width="100" height="50" rx="10" fill="#1d2a40" stroke="#8aa"/>
      <rect x="54" y="18" width="12" height="34" rx="6" fill="#0b1220" stroke="#8aa"/><g class="knob" style="--dx:0px;animation-name:none"><circle cx="60" cy="26" r="7" fill="#ffb44a"/></g>
      <text x="60" y="66" fill="#cdd6e4" font-size="10" text-anchor="middle">撥到「開」</text></svg>`;
    const stick=(cx,dx)=>`<circle cx="${cx}" cy="30" r="24" fill="#1d2a40" stroke="#8aa"/><line x1="${cx-24}" y1="30" x2="${cx+24}" y2="30" stroke="#33445e"/><line x1="${cx}" y1="6" x2="${cx}" y2="54" stroke="#33445e"/>
      <g class="knob" style="--dx:${dx}px"><circle cx="${cx}" cy="30" r="8" fill="#ffb44a"/></g>`;
    return `<svg width="170" height="66" viewBox="0 0 170 66">${stick(40,14)}${stick(130,-14)}</svg>`;
  }
  /* 馬達聲：手勢扳住時慢慢轉起來，起槳後怠速，推油門越高越尖；停槳就停（音效開關沿用 sfx.enabled） */
  _hum(dt,p){
    const want=this.enabled&&!this.hidden&&(this.armed||this._spin>0)&&sfx.enabled;
    if(!want){ if(this._osc){ try{ this._gn.gain.setTargetAtTime(0,sfx.ctx.currentTime,0.08); }catch{} if(!this.armed&&!(this._spin>0)){ const o=this._osc; this._osc=null; setTimeout(()=>{ try{o.stop();}catch{} },400); } } return; }
    if(!this._osc){ if(!sfx._ensure())return; const c=sfx.ctx; this._osc=c.createOscillator(); this._osc.type='sawtooth';
      const f=c.createBiquadFilter(); f.type='lowpass'; f.frequency.value=900; this._gn=c.createGain(); this._gn.gain.value=0;
      this._osc.connect(f); f.connect(this._gn); this._gn.connect(c.destination); this._osc.start(); }
    const c=sfx.ctx, th=this.armed?Math.max(0,p.throttle):0, k=this.armed?1:this._spin;
    this._osc.frequency.setTargetAtTime(40+50*k+120*th,c.currentTime,0.05);
    this._gn.gain.setTargetAtTime(0.025*k+0.02*th,c.currentTime,0.05);
  }
  set hidden(v){ this._hid=v; if(v){ this._el.style.display='none'; this._st.style.display='none'; } }
  get hidden(){ return !!this._hid; }
}

/* 空中停槳：沒有推力，只剩重力（給一般 Drone 用；SoccerDrone 用 noHold＋油門 -1 就會自然掉） */
export function freeFall(drone,dt,groundY=0.15){
  drone.vel.y-=9.8*dt; drone.vel.x*=Math.pow(0.7,dt); drone.vel.z*=Math.pow(0.7,dt);
  drone.pos.addScaledVector(drone.vel,dt);
  if(drone.pos.y<groundY){ drone.pos.y=groundY; drone.vel.set(0,0,0); }
}
