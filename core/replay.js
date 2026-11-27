/* newdrone 無人機飛行模擬器 © 2026 何政學（新北市立中正國民中學）｜授權 CC BY-NC-SA 4.0（姓名標示─非商業性─相同方式分享），見 LICENSE.md；請保留本聲明 */
/* ============================================================
   replay.js — 回放最近 15 秒（多視角）（2026-11-28）
   ------------------------------------------------------------
   老師：「新增錄影模式，暫存 15 秒內回放，給多視圖畫面，方便釐清（例：碰撞後進球沒算分）；
   未來戰術討論也可以用。」
   · 錄：關卡每幀呼叫 record(dt)，以每秒 30 筆記下每台機的畫面位置／姿態（直接讀 mesh，
     看到的就是當時畫面）＋比分時間文字；mark(文字) 在時間軸上插標記（進球、擦框、卡網…）。
   · 放：open() 時遊戲維持暫停，自己接管畫面（engine.setRenderFn）：
       四格＝追蹤（跟著選定的機）／全場俯視／側面看台／球門後；也可單一視角全螢幕。
       播放／暫停、±1 秒、慢動作 0.25／0.5／1 倍、換追蹤的機、離開。
   · 操作：滑鼠點按鈕；鍵盤 空白鍵 播放、←→ 前後 1 秒、↑↓ 換速度、1～4 單一視角、0 四格、Tab 換機、Esc 離開；
     手把／遙控器：上下＝換列（時間軸／按鈕），時間軸上左右＝前後、A＝播放；按鈕列左右選、A 按；
     B（或左搖桿往左推住）＝離開。
   不依賴關卡規則；之後 pvp、戰術板都能直接用。
   ============================================================ */
import * as THREE from 'three';
import { YawHold } from './gp-hold.js';

const HZ=30, KEEP=15;
const NAME=['追蹤','全場俯視','側面看台','球門後'];

export class Replay{
  /* opts: engine, input, drones（有 mesh、team、i）, field（FIELD）, teamA（TA 值）, focus（預設追蹤的機）, label(d)＝機名 */
  constructor(opts){
    Object.assign(this,{label:d=>'#'+(d.i+1)},opts);
    this.buf=[]; this.marks=[]; this.acc=0; this.t=0; this.active=false;
    this.cams=[0,1,2,3].map(()=>new THREE.PerspectiveCamera(58,1,0.04,60));
    this._hold=new YawHold();
  }
  /* 每幀（遊戲進行中）呼叫；hudText＝當下比分／時間文字 */
  record(dt,hudText=''){
    if(this.active)return;
    this.t+=dt; this.acc+=dt; if(this.acc<1/HZ)return; this.acc=0;
    this.buf.push({t:this.t,hud:hudText,d:this.drones.map(d=>{ const m=d.mesh;
      return [m.position.x,m.position.y,m.position.z,m.rotation.x,m.rotation.y,m.rotation.z]; })});
    while(this.buf.length&&this.t-this.buf[0].t>KEEP)this.buf.shift();
    while(this.marks.length&&this.t-this.marks[0].t>KEEP)this.marks.shift();
  }
  mark(text){ if(!this.active)this.marks.push({t:this.t,text}); }
  clear(){ this.buf=[]; this.marks=[]; }
  get length(){ return this.buf.length?this.buf[this.buf.length-1].t-this.buf[0].t:0; }

  open(onExit){
    if(this.active||this.buf.length<HZ)return false;      // 不到 1 秒不給回放
    this.active=true; this.onExit=onExit;
    this.saved=this.drones.map(d=>({p:d.mesh.position.clone(),r:d.mesh.rotation.clone(),v:d.mesh.visible}));
    this.drones.forEach(d=>d.mesh.visible=true);
    this.t0=this.buf[0].t; this.t1=this.buf[this.buf.length-1].t;
    this.ph=this.t0; this.playing=true; this.speed=1; this.layout=4; this.row=0; this.bi=0;
    this.fi=Math.max(0,this.drones.indexOf(this.focus));
    this._last=performance.now();
    this._hid=[...document.body.children].filter(e=>e.tagName!=='CANVAS'&&e.tagName!=='SCRIPT'&&e.style.visibility!=='hidden');
    this._hid.forEach(e=>e.style.visibility='hidden');   // 關卡 HUD 先藏起來，畫面只留回放
    this._ui();
    this.engine.setRenderFn((r,s)=>this._frame(r,s));
    this._key=e=>this._onKey(e); addEventListener('keydown',this._key,true);
    return true;
  }
  close(){
    if(!this.active)return;
    this.active=false;
    this.drones.forEach((d,i)=>{ const s=this.saved[i]; d.mesh.position.copy(s.p); d.mesh.rotation.copy(s.r); d.mesh.visible=s.v; });
    removeEventListener('keydown',this._key,true);
    this.el?.remove(); this.el=null;
    (this._hid||[]).forEach(e=>e.style.visibility=''); this._hid=null;
    const r=this.engine.renderer; r.setScissorTest(false); const v=r.getSize(new THREE.Vector2()); r.setViewport(0,0,v.x,v.y);
    this.engine.setRenderFn(null);
    this.onExit&&this.onExit();
  }

  /* ── 介面 ── */
  _ui(){
    const el=document.createElement('div'); el.id='nd-replay'; this.el=el;
    el.innerHTML=`<style>
      #nd-replay{position:fixed;inset:0;z-index:9000;pointer-events:none;font-family:system-ui,"Microsoft JhengHei",sans-serif;color:#F2F6FB}
      #nd-replay .lab{position:absolute;padding:3px 9px;margin:6px;border-radius:6px;background:rgba(6,14,24,.78);font-size:13px}
      #nd-replay .top{font-size:15px;margin-bottom:8px;white-space:nowrap}
      #nd-replay .bar{position:absolute;left:0;right:0;bottom:0;padding:8px 14px 12px;background:rgba(6,14,24,.92);pointer-events:auto}
      #nd-replay .tl{position:relative;height:22px;border-radius:6px;background:#1e2a3a;cursor:pointer;outline:2px solid transparent}
      #nd-replay .tl .fill{position:absolute;left:0;top:0;bottom:0;background:#34D3A6;border-radius:6px}
      #nd-replay .tl .mk{position:absolute;top:-4px;bottom:-4px;width:3px;background:#fbbf24}
      #nd-replay .tl .mk span{position:absolute;bottom:26px;left:-40px;width:80px;text-align:center;font-size:11px;color:#fbbf24}
      #nd-replay .row{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;align-items:center}
      #nd-replay button{font:inherit;font-size:14px;padding:6px 12px;border-radius:8px;border:2px solid #3b4a5e;background:#132235;color:#F2F6FB;cursor:pointer}
      #nd-replay button.on{border-color:#34D3A6}
      #nd-replay .gp-focus,#nd-replay .tl.gp-focus{outline:3px solid rgba(255,255,255,.85)!important}
      #nd-replay .tip{margin-left:auto;font-size:12px;opacity:.7}
    </style>
    <div id="rp-labs" style="position:absolute;left:0;right:0;top:0;bottom:0"></div>
    <div class="bar"><div class="top" id="rp-top"></div>
      <div class="tl" id="rp-tl"><div class="fill" id="rp-fill"></div></div>
      <div class="row">
        <button id="rp-play"></button><button id="rp-back">⏪ 1 秒</button><button id="rp-fwd">1 秒 ⏩</button>
        <button id="rp-speed"></button><button id="rp-lay"></button><button id="rp-focus"></button>
        <button id="rp-exit">✖ 離開回放</button>
        <span class="tip">空白鍵 播放・←→ 前後・↑↓ 速度・1～4／0 視角・Tab 換機・Esc 離開</span>
      </div></div>`;
    document.body.appendChild(el);
    const $=id=>el.querySelector('#'+id);
    $('rp-play').onclick=()=>this._toggle();
    $('rp-back').onclick=()=>this._seek(-1);
    $('rp-fwd').onclick=()=>this._seek(1);
    $('rp-speed').onclick=()=>this._speed(1);
    $('rp-lay').onclick=()=>this._layout();
    $('rp-focus').onclick=()=>this._focus(1);
    $('rp-exit').onclick=()=>this.close();
    const tl=$('rp-tl');
    const seekTo=e=>{ const r=tl.getBoundingClientRect(); this.ph=this.t0+(this.t1-this.t0)*Math.min(1,Math.max(0,(e.clientX-r.left)/r.width)); };
    tl.onpointerdown=e=>{ seekTo(e); tl.setPointerCapture(e.pointerId); tl.onpointermove=seekTo; };
    tl.onpointerup=()=>{ tl.onpointermove=null; };
    tl.innerHTML+=this.marks.filter(m=>m.t>=this.t0).map(m=>`<div class="mk" style="left:${(m.t-this.t0)/(this.t1-this.t0)*100}%"><span>${m.text}</span></div>`).join('');
    this.btnIds=['rp-play','rp-back','rp-fwd','rp-speed','rp-lay','rp-focus','rp-exit'];
    this._sync();
  }
  _sync(){
    const $=id=>this.el.querySelector('#'+id);
    $('rp-play').textContent=this.playing?'⏸ 暫停':'▶ 播放';
    $('rp-speed').textContent='🐢 速度 '+this.speed+'×';
    $('rp-lay').textContent=this.layout===4?'🔲 四格':'🖥 '+NAME[this.layout];
    $('rp-focus').textContent='🎯 追蹤：'+this.label(this.drones[this.fi]);
    this.el.querySelectorAll('.gp-focus').forEach(e=>e.classList.remove('gp-focus'));
    (this.row===0?$('rp-tl'):$(this.btnIds[this.bi])).classList.add('gp-focus');
    const labs=this.layout===4?[0,1,2,3]:[this.layout];
    const pos=this.layout===4?[['0','0'],['50%','0'],['0','50%'],['50%','50%']]:[['0','0']];
    $('rp-labs').innerHTML=labs.map((v,k)=>`<div class="lab" style="left:${pos[k][0]};top:${pos[k][1]}">${k+1<5&&this.layout===4?(v+1)+' ':''}${NAME[v]}${v===0?'：'+this.label(this.drones[this.fi]):''}</div>`).join('');
  }
  _toggle(){ if(!this.playing&&this.ph>=this.t1-1e-3)this.ph=this.t0; this.playing=!this.playing; this._sync(); }
  _seek(s){ this.ph=Math.min(this.t1,Math.max(this.t0,this.ph+s)); }
  _speed(d){ const S=[0.25,0.5,1]; this.speed=S[(S.indexOf(this.speed)+d+S.length)%S.length]; this._sync(); }
  _layout(v){ this.layout=v!=null?v:(this.layout===4?0:this.layout===3?4:this.layout+1); this._sync(); }
  _focus(d){ this.fi=(this.fi+d+this.drones.length)%this.drones.length; this._sync(); }
  _onKey(e){
    const k=e.code; let used=true;
    if(k==='Space')this._toggle();
    else if(k==='ArrowLeft')this._seek(-1);
    else if(k==='ArrowRight')this._seek(1);
    else if(k==='ArrowUp')this._speed(1);
    else if(k==='ArrowDown')this._speed(-1);
    else if(k==='Tab')this._focus(e.shiftKey?-1:1);
    else if(/^Digit[1-4]$/.test(k))this._layout(+k.slice(5)-1);
    else if(k==='Digit0')this._layout(4);
    else if(k==='Escape')this.close();
    else used=false;
    if(used){ e.preventDefault(); e.stopImmediatePropagation(); }
  }
  _pad(dt){
    const m=this.input.pollMenu?this.input.pollMenu(dt):{};
    if(m.back){ this.close(); return; }
    try{ const gp=this.input.gamepads()[0]; if(gp&&this.input.gpAxis){ const r=this._hold.step(this.input.gpAxis(gp,'yaw'),dt); if(r==='back'){ this.close(); return; } if(r==='confirm')m.confirm=true; } }catch{}
    if(m.y){ this.row=this.row?0:1; this._sync(); }
    if(this.row===0){ if(m.x)this._seek(m.x*0.5); if(m.confirm)this._toggle(); }
    else{ if(m.x){ this.bi=(this.bi+m.x+this.btnIds.length)%this.btnIds.length; this._sync(); }
      if(m.confirm)this.el.querySelector('#'+this.btnIds[this.bi]).click(); }
  }

  /* ── 每幀：推進播放頭 → 擺機 → 多視角渲染 ── */
  _frame(r,scene){
    const now=performance.now(), dt=Math.min(0.1,(now-this._last)/1000); this._last=now;
    this._pad(dt); if(!this.active)return;
    if(this.playing){ this.ph+=dt*this.speed; if(this.ph>=this.t1){ this.ph=this.t1; this.playing=false; this._sync(); } }
    // 找前後兩筆內插（跳太遠＝重置換位，不內插）
    const B=this.buf; let i=B.findIndex(s=>s.t>=this.ph); if(i<0)i=B.length-1; const a=B[Math.max(0,i-1)], b=B[i];
    const k=b.t>a.t?(this.ph-a.t)/(b.t-a.t):0;
    this.drones.forEach((d,j)=>{ const p=a.d[j], q=b.d[j], jump=Math.hypot(p[0]-q[0],p[1]-q[1],p[2]-q[2])>0.8, f=jump?(k<0.5?0:1):k;
      const L=(u,v)=>u+(v-u)*f, LA=(u,v)=>u+Math.atan2(Math.sin(v-u),Math.cos(v-u))*f;
      d.mesh.position.set(L(p[0],q[0]),L(p[1],q[1]),L(p[2],q[2]));
      d.mesh.rotation.set(LA(p[3],q[3]),LA(p[4],q[4]),LA(p[5],q[5]),'YXZ'); });
    const el=this.el;
    el.querySelector('#rp-fill').style.width=((this.ph-this.t0)/Math.max(0.01,this.t1-this.t0)*100)+'%';
    el.querySelector('#rp-top').textContent=`📼 回放　${(this.ph-this.t1).toFixed(1)} 秒　${(b||a).hud||''}`;
    this._aim();
    const size=r.getSize(new THREE.Vector2()), W=size.x, bh=Math.min(size.y*0.4,el.querySelector('.bar').offsetHeight||0), H=size.y-bh;
    el.querySelector('#rp-labs').style.bottom=bh+'px';   // 畫面只畫在下方控制列上面
    r.setScissorTest(true);
    const views=this.layout===4?[[0,0,bh+H/2],[1,W/2,bh+H/2],[2,0,bh],[3,W/2,bh]].map(([v,x,y])=>[v,x,y,W/2,H/2]):[[this.layout,0,bh,W,H]];
    for(const [v,x,y,w,h] of views){
      const c=this.cams[v]; c.aspect=w/h; c.updateProjectionMatrix();
      r.setViewport(x,y,w,h); r.setScissor(x,y,w,h); r.render(scene,c);
    }
    r.setScissorTest(false);
  }
  _aim(){
    const F=this.field, d=this.drones[this.fi], m=d.mesh, [c0,c1,c2,c3]=this.cams;
    // 1 追蹤：機尾後上方（mesh.rotation.y＝yaw+π，機頭朝 -Z 本地 → 世界前方＝(sin yaw, cos yaw)）
    const yaw=m.rotation.y-Math.PI, fx=Math.sin(yaw), fz=Math.cos(yaw);
    c0.fov=62; c0.position.set(m.position.x-fx*1.3,m.position.y+0.55,m.position.z-fz*1.3); c0.up.set(0,1,0); c0.lookAt(m.position.x+fx*0.6,m.position.y,m.position.z+fz*0.6);
    // 2 全場俯視：+Z（藍隊進攻方向）在畫面上方
    c1.fov=55; c1.position.set(0,F.HL*2.25,0.001); c1.up.set(0,0,1); c1.lookAt(0,0,0);
    // 3 側面看台：從 -X 側看，+Z 在畫面右邊
    c2.fov=78; c2.position.set(-F.HW+0.08,F.FH*0.92,0); c2.up.set(0,1,0); c2.lookAt(F.HW*0.9,0.1,0);   // 網內貼邊、高處往下看
    // 4 球門後：追蹤那台要攻的球門，從球門後方看回場內
    const gz=(d.team===this.teamA?1:-1)*(F.HL-0.08);
    c3.fov=72; c3.position.set(0,F.FH-0.12,gz); c3.up.set(0,1,0); c3.lookAt(0,0.9,-gz*0.15);   // 球門後上方往場內看（看得到球門環和進攻路線）
  }
}
