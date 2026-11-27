/* newdrone 無人機飛行模擬器 © 2026 何政學（新北市立中正國民中學）｜授權 CC BY-NC-SA 4.0（姓名標示─非商業性─相同方式分享），見 LICENSE.md；請保留本聲明 */
/* ============================================================
   systems/soccer.js — FAI 無人機足球核心（ES Module）v1.0
   newdrone Phase 1｜移植自基本版 soccer-match.html（手感優先）
   ------------------------------------------------------------
   內容：FAI F9A-B 場地常數、場地/籠網/球門環建構、
         SoccerDrone（家族 C 物理：yaw-only＋重力/懸浮推力）、
         球體彈性碰撞、球門環碰撞、進球判定（僅 striker 得分）。
   [FIX bug#6] 阻尼 dt 化：基本版 vel*=0.87 是「每幀」（綁定 60fps，
   高刷新率手感不同）。此處換算為每秒存速比 0.87^60，
   以 Math.pow(K,dt) 施加——60Hz 下手感與基本版完全一致。
   座標慣例（沿基本版）：Team A 出發於 -Z、攻 +Z 球門；
   yaw=0 時機頭朝 +Z（注意與 drone-styles 機頭 -Z 規範相反，
   關卡同步 mesh 時須 rotation.y = yaw + PI）。
   ============================================================ */
import * as THREE from 'three';
import { rollGroundEffect, dampInput, triggerAnomaly as _triggerAnomaly } from './anomaly.js';
import { bump } from '../feedback.js';
import { powerStep } from './power.js';

/* ── FAI F9A-B 場地常數（公尺）── */
export const FIELD={
  FL:6, FW:3, FH:3,            // 場長/寬/高
  HL:3, HW:1.5,                // 半場
  GZ:2.0,                      // 球門環 Z（HL-1.0）
  GY:2.5,                      // 球門環中心高
  GI:0.20, GO:0.35,            // 內/外半徑
  GT:0.075, GR:0.275,          // 環管半徑/環主半徑
  BR:0.11,                     // 機體（bumper 球）半徑
  SET_DUR:180, N_SETS:3,       // 每節 180 秒、3 節制
};

/* ── 2026-10-11 開賽前場地設定（老師：球門高度、FIDA 8×4×3 場地都要能選；FIDA 要醒目標示、注意球門與底線）──
   在這裡（模組載入時、其他常數算出來之前）就改好 FIELD，後面的出發點、半場、球門判定全部跟著用新值。
   設定存 nd.settings.soccerField＝{preset:'fai'|'fida', gy:球門中心高}；開始畫面改了會重新載入頁面。
   · FAI F9A-B（SC4 2026 B.2.2／B.3）：6×3×3、球門離底線 1 m、外徑 70／內徑 40 cm、高度沒規定（預設沿用 2.5）
   · FIDA Class 20（2023 Rule Book §1）：8×4×3、球門離底線 1.5 m、外徑 50／內徑 30 cm、中心高 1.8～2.2 m */
export const FIELD_PRESETS={
  fai: {label:'FAI F9A-B 6×3×3',FL:6,FW:3,FH:3,HL:3,HW:1.5,GZ:2.0,GI:0.20,GO:0.35,GT:0.075,GR:0.275,gys:[1.8,2.0,2.2,2.5],gy:2.5},
  fida:{label:'FIDA Class 20 8×4×3',FL:8,FW:4,FH:3,HL:4,HW:2,GZ:2.5,GI:0.15,GO:0.25,GT:0.05,GR:0.20,gys:[1.8,2.0,2.2],gy:2.0},
};
export const FIELD_SETUP=(()=>{ let v={}; try{ v=JSON.parse(localStorage.getItem('nd.settings.soccerField'))||{}; }catch{}
  const preset=v.preset==='fida'?'fida':'fai', P=FIELD_PRESETS[preset], gy=P.gys.includes(+v.gy)?+v.gy:P.gy;
  return {preset,gy}; })();
{ const P=FIELD_PRESETS[FIELD_SETUP.preset];
  for(const k of ['FL','FW','FH','HL','HW','GZ','GI','GO','GT','GR'])FIELD[k]=P[k];
  FIELD.GY=FIELD_SETUP.gy; }
export function saveFieldSetup(s){ try{ localStorage.setItem('nd.settings.soccerField',JSON.stringify(s)); }catch{} }

/* ── 物理常數（基本版原值；速度倍率 SF 由關卡傳入）── */
export const SOCCER_PHYS={
  GRAVITY:-9.81, HOVER:9.81,
  THRMAX:14, PITCHMAX:8, YAWMAX:2.8,
  DRAG_PER_SEC:Math.pow(0.87,60),   // [FIX bug#6] 0.87/幀@60fps → dt 化
  WBOUNCE:0.6, FBOUNCE:0.35,   // 2026-11-19 老師回饋「球機碰撞回彈不明顯」：0.35／0.18 → 0.6／0.35（球框有彈性，撞網會彈回來）
};

export const TA=0, TB=1;
let _arenaHook=null;
export function setArenaHook(h){ _arenaHook=h; }   // core/soccer-arena.js 註冊；沒註冊＝經典場地

/* 速度檔位（2026-08-03 新增，使用者回饋「碰撞真實感」C 項）：真實足球
   無人機比賽選手會切一檔（穩）／二檔（衝）——這裡只調水平推進力道
   （PITCHMAX 方向的 ax/az），不動垂直油門，貼近「檔位是前後左右衝刺力道」
   的真實印象。二檔能不能撞贏、撞了會不會失控，完全是「二檔本來速度就
   比較快」這件事在 resolveCollisions() 依 closingSpeed 分級判定時自然帶出來
   的結果，不需要在碰撞公式裡另外疊加檔位係數，兩處只要各自對，效果就對。 */
export const GEAR_MULT={1:0.55,2:1.0};
/* 2026-11-27 四檔（老師：實機四檔、每檔快 20%、疊加）：一檔≈原本一檔、四檔＝原本二檔（最高速不變）。
   關卡把 drone.gears=4 才用這組；沒設＝原本兩檔（pvp 等其他關卡不受影響）。 */
export const GEAR4_MULT={1:1/1.728,2:1.2/1.728,3:1.44/1.728,4:1};   // 2026-09-30：一檔 0.7→0.55，兩檔差距拉大（使用者回報「G 檔感覺不出來」）

/* 機速手感（2026-09-30 新增，使用者回報：「競速無刷／專家只是變快，並沒有很難控制」）：
   原本四檔只把推力乘上 SF，足球物理阻力極大（每幀存速 0.87）→ 幾乎沒有慣性，
   推就走、放就停，速度再快也不難。真實無刷機難在「慣性（放桿還會滑）＋轉向靈敏＋
   （專家）沒有定高」。這裡每檔補上：
     drag  ＝每幀存速（越接近 1 慣性越大、放桿滑越遠）
     accel ＝水平推力再乘的係數（阻力變小後終端速度會暴增，用它壓回合理範圍）
     yaw   ＝轉向速率倍率
   由關卡把 SOCCER_FEEL[機速代碼] 傳給 step() 的第 5 個參數；不傳＝原本手感（AI 與 pvp 不受影響）。 */
/* v3（2026-11-17 老師：實機「二檔全速，場地來回約 3 秒」；舊版要 13 秒）：
   阻力變小一點（有慣性）、推力加大。標準＋二檔：全速約 4.9 m/s，6 m 場地來回約 3.1 秒；一檔約 5 秒。 */
/* real（2026-11-21 老師：「手把玩足球太簡單；真實無人機右搖桿推滿會下衝或上衝，跟當時機身水平有關，轉彎也是」
   → 選「標準以上都加、強度不同」＋甩尾、邊轉邊飛掉高度、加減速有延遲）：
     lag  ＝機身傾斜跟上搖桿的時間常數（秒）——要先傾斜才開始加速，放桿要反傾才停
     tau  ＝水平慣性時間常數（秒；取代 drag）——轉頭後速度還沿舊方向滑（甩尾）；accel 會依此換算，最高速度不變
     alt  ＝傾斜掉高度的強度（0＝定高全補回、1＝完全不補）：垂直推力＝推力×cos(傾角)
     lift ＝速度帶來的額外升力（平飛時快速通過＝往上飄；放桿瞬間機身回平還很快＝上衝）
     bank ＝邊轉邊飛的額外傾斜（轉向速率×速度 → 更大傾角 → 掉更多）
     hold ＝定高把高度慢慢拉回來的力道（油門放中間時；0＝不拉回，專家無定高） */
export const SOCCER_FEEL={
  slow:  {drag:0.93, accel:2.75, yaw:0.85},  // 慢速有刷：SF 0.55 → 二檔全速約 2.7 m/s（不加擬真）
  std:   {drag:0.93, accel:2.75, yaw:1.0, real:{lag:0.12,tau:0.45,alt:0.60,lift:0.10,bank:0.10,hold:4}},
  race:  {drag:0.955,accel:1.25, yaw:1.3, real:{lag:0.18,tau:0.80,alt:1.00,lift:0.16,bank:0.16,hold:2.5}},   // 慣性更大、更快（全速約 6.5 m/s）
  expert:{drag:0.955,accel:1.25, yaw:1.3, real:{lag:0.18,tau:0.80,alt:1.00,lift:0.16,bank:0.16,hold:0}},   // 同 race，另由 noHold 拿掉定高
};
const TILT_MAX=0.6;   // 推滿時機身傾角（rad，約 34°）

/* 六席編制（基本版 DCFG）：[0]=玩家 A-striker */
export const SOCCER_SEATS=[
  {team:TA,role:'striker', tc:0x00eeff,sc:0xff44cc},
  {team:TA,role:'support', tc:0x2266ff,sc:0x2266ff},
  {team:TA,role:'defender',tc:0x2266ff,sc:0x2266ff},
  {team:TB,role:'striker', tc:0xff3322,sc:0x66aaff},
  {team:TB,role:'support', tc:0xff6633,sc:0xff6633},
  {team:TB,role:'defender',tc:0xff6633,sc:0xff6633},
];
const {HL,HW,BR}=FIELD;
/* 2026-07-23：出發位置改比照基本版 PVP/soccer-match-2p/4p/6p.html 的
   STARTS_2P/STARTS_6P 慣例（同隊三人在中場附近排開，X 間距 ±0.60，
   Z 只離中線 ~1.1~1.18），取代舊值（X 間距只有 ±0.264、Z 深入己方
   底線 ~2.78）。舊值只影響「單人版 AI 隊友/對手的視覺站位」時不明顯
   （單人版全程只會渲染玩家自己一顆鏡頭），但在 Phase 4 pvp.html 多人
   分割畫面情境下，三名隊友幾乎疊在一起、又緊貼自家底牆，會讓三格個人
   視角在開賽瞬間長得幾乎一樣——這正是使用者實機回饋「多視角看起來像
   同一個」的根本原因，經比對基本版三份 PVP 檔案的實際出發座標後修正。 */
export const SOCCER_STARTS=[
  new THREE.Vector3(0,BR+.02,-HL+1.82), new THREE.Vector3(-0.60,BR+.02,-HL+1.90),
  new THREE.Vector3(0.60,BR+.02,-HL+1.90), new THREE.Vector3(0,BR+.02,HL-1.82),
  new THREE.Vector3(-0.60,BR+.02,HL-1.90), new THREE.Vector3(0.60,BR+.02,HL-1.90),
];

/* ── 場地建構（地板/標線/籠網/球門環）── */
/* 2026-10-11 足球場畫面升級：場地外觀抽成兩種——「經典」＝原本這段程式一字不改搬進 buildClassicDeco()；
   「競技場」＝core/soccer-arena.js（畫質 低／中／高，可在開始畫面與暫停選單切換）。球門環與物理完全不動。 */
export function buildClassicDeco(scene,root=scene){
  const F=FIELD;
  root.background=new THREE.Color(0x040810);
  root.fog=new THREE.FogExp2(0x04080e,0.032);
  scene.add(new THREE.AmbientLight(0x0a1830,3.5));
  const dl=new THREE.DirectionalLight(0x4488aa,.8); dl.position.set(2,8,-2); scene.add(dl);
  const dl2=new THREE.DirectionalLight(0x223355,.35); dl2.position.set(-3,4,4); scene.add(dl2);
  const tl=new THREE.PointLight(0x0e2244,1.2,10); tl.position.set(0,F.FH+.5,0); scene.add(tl);
  const flr=new THREE.Mesh(new THREE.PlaneGeometry(F.FW,F.FL),
    new THREE.MeshStandardMaterial({color:0x08122a,roughness:.95,metalness:.05}));
  flr.rotation.x=-Math.PI/2; scene.add(flr);
  scene.add(new THREE.GridHelper(Math.max(F.FW,F.FL),12,0x0c1e3c,0x0c1e3c));
  const lm=(c,o=.65)=>new THREE.LineBasicMaterial({color:c,transparent:true,opacity:o});
  const line=(mat,p1,p2)=>scene.add(new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...p1),new THREE.Vector3(...p2)]),mat));
  line(lm(0x22d3ee,.7),[-HW,.005,0],[HW,.005,0]);
  line(lm(0x3b82f6,.55),[-HW,.005,-HL],[HW,.005,-HL]);
  line(lm(0xef4444,.55),[-HW,.005,HL],[HW,.005,HL]);
  // 籠網（半透明面板＋邊框＋立柱）
  const netM=(c,o)=>new THREE.MeshBasicMaterial({color:c,transparent:true,opacity:o,side:THREE.DoubleSide});
  const wM=new THREE.LineBasicMaterial({color:0x1a4060,transparent:true,opacity:.5});
  [{w:F.FW,h:F.FH,p:[0,F.FH/2,-HL],ry:0,col:0x001040,op:.18},
   {w:F.FW,h:F.FH,p:[0,F.FH/2, HL],ry:Math.PI,col:0x400010,op:.18},
   {w:F.FL,h:F.FH,p:[-HW,F.FH/2,0],ry:Math.PI/2,col:0x0a1e36,op:.12},
   {w:F.FL,h:F.FH,p:[ HW,F.FH/2,0],ry:-Math.PI/2,col:0x0a1e36,op:.12},
   {w:F.FW,h:F.FL,p:[0,F.FH,0],rx:-Math.PI/2,col:0x060f1e,op:.09},
  ].forEach(p=>{
    const m=new THREE.Mesh(new THREE.PlaneGeometry(p.w,p.h,Math.ceil(p.w/.25),Math.ceil(p.h/.25)),netM(p.col,p.op));
    m.position.set(...p.p); if(p.rx)m.rotation.x=p.rx; if(p.ry)m.rotation.y=p.ry; scene.add(m);
    const el=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(p.w,p.h)),wM.clone());
    el.position.set(...p.p); if(p.rx)el.rotation.x=p.rx; if(p.ry)el.rotation.y=p.ry; scene.add(el);
  });
  const pilM=new THREE.MeshStandardMaterial({color:0x1a3050,metalness:.85,roughness:.2});
  const pilG=new THREE.CylinderGeometry(.022,.022,F.FH,6);
  [[-HW,-HL],[HW,-HL],[-HW,HL],[HW,HL]].forEach(([x,z])=>{
    const p=new THREE.Mesh(pilG,pilM); p.position.set(x,F.FH/2,z); scene.add(p);});
}
export function buildSoccerField(scene){
  const F=FIELD;
  const deco=new THREE.Group(); scene.add(deco);
  if(_arenaHook)_arenaHook.build(scene,deco); else buildClassicDeco(deco,scene);
  // 球門環（直立於 XY 平面、開口朝 Z——基本版已驗證勿加 rotation.x）
  const goals=[];
  [{z:-F.GZ,col:0x2266ff,em:0x001155},{z:F.GZ,col:0xff2233,em:0x550011}].forEach(d=>{
    const torus=new THREE.Mesh(new THREE.TorusGeometry(F.GR,F.GT,20,64),
      new THREE.MeshStandardMaterial({color:d.col,emissive:d.em,emissiveIntensity:0.45,metalness:.25,roughness:.55}));   // 2026-11-21：降低自發光、少反光（看久不刺眼）
    // FAI F9A-B：環軸向厚度上限 10cm（徑向 15cm 由 D1/D2 幾何決定）
    // → 圓管 torus 沿 Z 壓扁 10/15（SC4 Vol F9 2026 對照，2026-07-20 查證）
    torus.scale.z=10/15;
    torus.position.set(0,F.GY,d.z); scene.add(torus);
    const gl=new THREE.PointLight(d.col,0.3,1.5);   // 2026-11-21：1.5→0.3，環內不再亮成一圈白光 gl.position.set(0,F.GY,d.z); scene.add(gl);
    const wl=F.FH-F.GY;
    const wire=new THREE.Mesh(new THREE.CylinderGeometry(.004,.004,wl,4),
      new THREE.MeshBasicMaterial({color:0x334455}));
    wire.position.set(0,F.GY+wl/2,d.z); scene.add(wire);
    goals.push({mesh:torus,light:gl,z:d.z});
  });
  if(_arenaHook&&_arenaHook.goals)_arenaHook.goals(goals,scene,deco);
  return goals;
}

/* ── SoccerDrone：家族 C 物理（沿基本版 physicsDrone，阻尼 dt 化）── */
export class SoccerDrone{
  constructor(i){
    const cfg=SOCCER_SEATS[i];
    this.i=i; this.team=cfg.team; this.role=cfg.role; this.isPlayer=i===0;
    this.cfg=cfg;
    this.pos=SOCCER_STARTS[i].clone();
    this.vel=new THREE.Vector3();
    this.yaw=cfg.team===TA?0:Math.PI;
    this.prevZ=this.pos.z;
    this.mustReturn=false;
    this.aiState='stage'; this.aiT=Math.random()*1.5;
    // 2026-08-03 新增：anomalyT／_geArmed／_frozenInput 見 systems/anomaly.js；
    // gear 是玩家自己切換的裝備設定，預設一檔（穩），reset() 不會把它重置掉（見下方）。
    this.anomalyT=0; this._geArmed=false; this._frozenInput=null; this.gear=1;
  }
  reset(){
    this.pos.copy(SOCCER_STARTS[this.i]); this.vel.set(0,0,0);
    this.yaw=this.team===TA?0:Math.PI; this.prevZ=this.pos.z; this.spinV=0;
    this.mustReturn=false; this.aiState='stage'; this.aiT=Math.random()*1.5;
    this.anomalyT=0; this._geArmed=false; this._frozenInput=null;   // gear 是裝備設定，不隨每球重置
    this.tP=0; this.tR=0; this.tilt=0; this.holdY=null; this.recT=0; this.wob=[0,0]; this.rollT=0; this.netT=0; this.rollP=0; this.rollR=0;
    this._unstickT=0; this._stuckT=0; this._stuckRef=null;   // AI 互卡脫離（core/systems/ai.js）
  }
  triggerAnomaly(dur){ _triggerAnomaly(this,dur); }
  /* 玩家輸入（統一語意合約：throttle+=升、yaw+=右轉、pitch+=前進、roll+=右移）
     基本版符號對照：螢幕(相機朝+Z)右=-X → roll 取負；yaw+=右轉=yaw 減小 → 取負
     D 項只套用在玩家 step()（AI 走 moveTo()→integrate() 直接控速度、沒有
     搖桿輸入可以打折，維持原樣）。 */
  /* noHold（2026-09-30 補上：關卡的「專家無定高」選項從移植以來一直有傳進來，
     但這裡從沒接收，所以專家＝競速無刷，完全沒差）：true 時拿掉定高輔助，
     油門 ≤0＝無推力往下掉，0..1 對應 0..(HOVER+THRMAX)——跟角度/Acro 模式同一套邏輯
     （老師 2026-09-30 決定維持「放開油門＝往下掉」）。懸停約需推住 41%。
     feel：見 SOCCER_FEEL；不傳＝原本手感。 */
  step(dt,ctl,SF=1,noHold=false,feel=null){
    const P=SOCCER_PHYS;
    this._ctl=ctl;   // 2026-11-19 記下輸入來源 → core/feedback.js 撞擊回饋（AI 不經過 step，所以沒有）
    rollGroundEffect(this,this.pos.y-FIELD.BR,this.vel.y);
    const inp=dampInput(this,ctl,dt);
    if(this.hitFx&&this._hitState(dt,inp))return;
    const GM=(this.gears===4?GEAR4_MULT:GEAR_MULT)[this.gear]??1.0;
    const PM=this.power?powerStep(this,dt,inp):1;   // 2026-11-27 電池壓降＋馬達過熱（core/systems/power.js）
    const AM=feel?feel.accel:1, YM=feel?feel.yaw:1;
    this._dragPerSec=feel?Math.pow(feel.drag,60):null;
    const ay=noHold?Math.max(0,inp.throttle)*(P.HOVER+P.THRMAX)*PM:P.HOVER+inp.throttle*P.THRMAX*SF*(inp.throttle>0?PM:1);
    const R=feel&&feel.real;
    if(!R){
      this.integrate(dt, -inp.roll*P.PITCHMAX*SF*GM*AM*PM, ay,
                         inp.pitch*P.PITCHMAX*SF*GM*AM*PM, -inp.yaw*P.YAWMAX*YM);
      return;
    }
    // ── 擬真：機身傾角追搖桿（有延遲）→ 水平推力＝sin(傾角)、垂直推力＝cos(傾角) ──
    const kOld=-Math.log(feel.drag)*60, kNew=1/R.tau;         // 換算：最高速度＝推力/阻力係數，維持原本最高速度
    this._dragPerSec=Math.exp(-kNew);
    const f=1-Math.exp(-dt/R.lag);
    /* 2026-11-27 撞後恢復（老師：撞擊後要等晶片穩定，約 1 秒上下；研究實測恢復約 0.8 秒）：
       被撞那一刻機身被打歪（wob，0.3 秒衰減），恢復期間（recT）搖桿只剩部分控制權，越接近 1 秒越回來。 */
    let auth=1;
    if(this.recT>0){ this.recT=Math.max(0,this.recT-dt); auth=Math.max(0.3,1-this.recT*0.75); }
    const wk=Math.exp(-dt/0.3), wob=this.wob||(this.wob=[0,0]); wob[0]*=wk; wob[1]*=wk;
    this.tP=(this.tP||0)+(inp.pitch*TILT_MAX*auth+wob[0]-(this.tP||0))*f;
    this.tR=(this.tR||0)+(-inp.roll*TILT_MAX*auth+wob[1]-(this.tR||0))*f;
    const sMax=Math.sin(TILT_MAX), H=P.PITCHMAX*SF*GM*AM*PM*kNew/kOld/sMax;
    const ax=Math.sin(this.tR)*H, az=Math.sin(this.tP)*H;
    const yr=-inp.yaw*P.YAWMAX*YM;
    const vh=Math.hypot(this.vel.x,this.vel.z);
    const tilt=Math.min(1.2,Math.hypot(this.tP,this.tR)+R.bank*Math.abs(yr)*vh/3);   // 邊轉邊飛：額外傾斜
    const thrust=ay;                                            // 這一刻馬達總推力（定高時 ≈ 懸停推力）
    const loss=thrust*(1-Math.cos(tilt))*R.alt;                 // 傾斜掉的垂直推力（定高只補回 1-alt）
    const lift=R.lift*vh*vh*Math.cos(tilt)*Math.max(0,1-tilt/TILT_MAX);   // 速度帶來的升力：機身越平越明顯（放桿上衝）
    this.tilt=tilt;
    // 定高：油門在中間時，飛控會把高度慢慢拉回原本的高度（先掉、再回來）；推拉油門＝重新記住目前高度
    let hold=0;
    if(!noHold&&R.hold){
      if(this.holdY==null||Math.abs(inp.throttle)>0.08) this.holdY=this.pos.y;
      else hold=Math.max(-4,Math.min(4,R.hold*(this.holdY-this.pos.y)-1.6*Math.sqrt(R.hold)*this.vel.y));
    }else this.holdY=null;
    this.integrate(dt, ax, ay-loss+lift+hold, az, yr);
  }
  /* 原始積分（AI moveTo 直接用；ax/az 依 yaw 轉世界系——沿基本版行為） */
  /* ── 2026-11-28 物理第二批：滾地與卡網（老師：「被撞夠大力，或出現慣性，可能在地上滾，或者卡撞到網子，
     然後操作上才是要等微停」）。只有 hitFx=true 的玩家機會發生；AI 不受影響。
     · 滾地：帶著水平速度重落地（往下 ≥2.5 m/s 且水平 ≥0.8；或直直砸下 ≥4 m/s），或剛被撞（recT）又貼地高速滑行（≥1.6 m/s）→ 在地上滾 0.6～1.4 秒，
       這段時間馬達沒辦法把它拉起來；滾完還要約半秒等機身穩定（recT）才完全回來。
     · 卡網：撞網速度 ≥1.8 m/s 有機率卡住（越快越容易、最多 7 成），卡 0.6～1.6 秒；
       往網子的反方向拉，脫困快 2.5 倍；被別台撞開也會脫困。 */
  _floorHit(vy){
    if(this.rollT>0||this.netT>0)return;
    const vh=Math.hypot(this.vel.x,this.vel.z);
    if((vy>=2.5&&vh>=0.8)||vy>=4||(this.recT>0&&vh>=1.6&&vy>0.2)){
      this.rollT=Math.min(1.4,0.6+vy*0.15+vh*0.12); this._evt='roll';
    }
  }
  _netHit(v,nx,ny,nz){
    if(v<1.8||this.netT>0||this.rollT>0)return;
    if(Math.random()>Math.min(0.7,(v-1.8)/2+0.2))return;
    this.netT=Math.min(1.6,0.6+(v-1.8)*0.4); this.netN=[nx,ny,nz]; this.netPos=this.pos.clone();
    this.vel.set(0,0,0); this._evt='net';
  }
  /* 回傳 true＝這一幀被「滾地／卡網」接管，step() 不再做一般操控 */
  _hitState(dt,inp){
    const F=FIELD;
    if(this.netT>0){
      if(this.pos.distanceTo(this.netPos)>0.12){ this.netT=0; return false; }   // 被撞開＝脫困
      const sy=Math.sin(this.yaw), cy=Math.cos(this.yaw), n=this.netN;
      const wx=-inp.roll*cy+inp.pitch*sy, wz=inp.roll*sy+inp.pitch*cy;          // 搖桿方向（世界座標，近似）
      const away=wx*n[0]+wz*n[2]+(n[1]?-(inp.throttle||0):0);
      this.netT-=dt*(away>0.5?2.5:1);
      this.pos.copy(this.netPos); this.vel.set(0,0,0);
      if(this.netT<=0){ this.netT=0; this.recT=Math.max(this.recT||0,0.4); }
      return true;
    }
    if(this.rollT>0){
      this.rollT-=dt;
      const k=Math.exp(-1.6*dt); this.vel.x*=k; this.vel.z*=k;                    // 滾動摩擦
      const f=this.vel.x*Math.sin(this.yaw)+this.vel.z*Math.cos(this.yaw), sd=this.vel.x*Math.cos(this.yaw)-this.vel.z*Math.sin(this.yaw);
      this.rollP=(this.rollP||0)+f/F.BR*dt; this.rollR=(this.rollR||0)+sd/F.BR*dt;  // 畫面：球框滾動
      this.tP=0; this.tR=0; this.holdY=null;
      this.integrate(dt,0,0,0,0);                                                // 馬達拉不起來，只剩重力和慣性
      if(this.rollT<=0){ this.rollT=0; this.recT=Math.max(this.recT||0,0.5);
        const w=a=>Math.atan2(Math.sin(a),Math.cos(a)); this.rollP=w(this.rollP); this.rollR=w(this.rollR); }
      return true;
    }
    if(this.rollP||this.rollR){ const k=Math.exp(-dt/0.15); this.rollP*=k; this.rollR*=k; if(Math.abs(this.rollP)+Math.abs(this.rollR)<0.01){this.rollP=0;this.rollR=0;} }
    return false;
  }
  integrate(dt,ax,ay,az,yr){
    const P=SOCCER_PHYS, F=FIELD;
    this.prevZ=this.pos.z;
    this.yaw+=yr*dt;
    // v3：碰撞摩擦帶來的自轉（spinV，rad/s）——飛控會慢慢把它壓下來（約 0.45 秒衰減一半）
    if(this.spinV){ this.yaw+=this.spinV*dt; this.spinV*=Math.exp(-1.5*dt); if(Math.abs(this.spinV)<0.03)this.spinV=0; }
    const sy=Math.sin(this.yaw), cy=Math.cos(this.yaw);
    this.vel.x+=(ax*cy+az*sy)*dt;
    this.vel.y+=(ay+P.GRAVITY)*dt;
    this.vel.z+=(ax*-sy+az*cy)*dt;
    this.vel.multiplyScalar(Math.pow(this._dragPerSec??P.DRAG_PER_SEC,dt));   // [FIX bug#6]；_dragPerSec＝玩家機速手感（AI 不設）
    this.pos.addScaledVector(this.vel,dt);
    // 地板/天花板/牆
    const fx=this.hitFx;   // 2026-11-27 滾地／卡網（只有關卡開啟的玩家機；AI 不設）
    if(this.pos.y<F.BR){const vy=-this.vel.y;this.pos.y=F.BR;bump(this,vy,'floor');this.vel.y=Math.abs(this.vel.y)*P.FBOUNCE;if(fx)this._floorHit(vy);}
    if(this.pos.y>F.FH-F.BR){const v=this.vel.y;this.pos.y=F.FH-F.BR;bump(this,v);this.vel.y=-Math.abs(this.vel.y)*P.WBOUNCE;if(fx)this._netHit(v,0,-1,0);}
    if(this.pos.x<-HW+F.BR){const v=-this.vel.x;this.pos.x=-HW+F.BR;bump(this,v);this.vel.x= Math.abs(this.vel.x)*P.WBOUNCE;if(fx)this._netHit(v,1,0,0);}
    if(this.pos.x> HW-F.BR){const v=this.vel.x;this.pos.x= HW-F.BR;bump(this,v);this.vel.x=-Math.abs(this.vel.x)*P.WBOUNCE;if(fx)this._netHit(v,-1,0,0);}
    if(this.pos.z<-HL+F.BR){const v=-this.vel.z;this.pos.z=-HL+F.BR;bump(this,v);this.vel.z= Math.abs(this.vel.z)*P.WBOUNCE;if(fx)this._netHit(v,0,0,1);}
    if(this.pos.z> HL-F.BR){const v=this.vel.z;this.pos.z= HL-F.BR;bump(this,v);this.vel.z=-Math.abs(this.vel.z)*P.WBOUNCE;if(fx)this._netHit(v,0,0,-1);}
    this._ringBounce();
  }
  /* 球門環碰撞（沿基本版 goalRingBounce） */
  _ringBounce(){
    const F=FIELD;
    for(const gz of [-F.GZ,F.GZ]){
      const dx=this.pos.x, dy=this.pos.y-F.GY, dz=this.pos.z-gz;
      const r=Math.sqrt(dx*dx+dy*dy);
      const distTube=Math.sqrt((r-F.GR)*(r-F.GR)+dz*dz);
      if(distTube<F.GT+F.BR){
        const tx=r>0.001?dx/r*F.GR:F.GR, ty=r>0.001?dy/r*F.GR:0;
        const nx=dx-tx, ny=dy-ty, nz=dz;
        const nl=Math.sqrt(nx*nx+ny*ny+nz*nz);
        if(nl>0.001){
          // 2026-11-21 老師：撞球門環太 Q 彈 → 改成「擋開」：只把往環裡衝的速度消掉大部分（恢復係數 0.25），
          // 再把機體推出環管外（改位置、不加速度）。原本每幀加 6 m/s 的推力＝像彈簧床。
          const ux=nx/nl, uy=ny/nl, uz=nz/nl, vn=this.vel.x*ux+this.vel.y*uy+this.vel.z*uz;
          if(vn<0){ bump(this,-vn,'ring'); const k=-1.25*vn; this.vel.x+=ux*k; this.vel.y+=uy*k; this.vel.z+=uz*k; }
          const pen=F.GT+F.BR-distTube;
          this.pos.x+=ux*pen; this.pos.y+=uy*pen; this.pos.z+=uz*pen;}
      }
    }
  }
}

/* ── 機體互撞（2026-08-03 重寫，使用者回饋「碰撞真實感」B/A-2 項）──────
   原本永遠是對稱彈性碰撞（像撞球一樣，兩邊各分一半動量），使用者實測回饋
   「阻擋沒啥用」——真實無人機互撞高機率是雙方都受衝擊、低機率是被借力
   頂飛、更低機率是兩台一起意外送進球門。這裡依「相對衝擊速度」
   （closingSpeed＝兩機相對速度沿碰撞法線方向的分量）分三段機率決定結果：
     simple（簡單碰撞）：原本的對稱彈開，維持原手感，多數情況會是這個。
     stun（撞球定桿換位）：沿法線方向衝得較猛的一方幾乎停下，另一方帶著
       大半動量、往一個隨機偏轉角度飛出（模擬「借力」但方向不受控）。
     blowup（雙機捲入進網）：只有碰撞點靠近球門（|z|超過門前 70% 位置）
       才可能發生，兩機動量一起被甩向該側球門——防守方弄巧成拙送分。
   速度檔位（C 項）不在這裡另外加係數：二檔本來速度上限就比較高，
   會自然撞出更高的 closingSpeed、落在中/高速機率區間，兩邊各自對即可。
   ============================================================ */
const _diff=new THREE.Vector3(), _relVel=new THREE.Vector3(), _deflect=new THREE.Vector3();
const GOAL_MOUTH_FRAC=0.7;   // |pos.z| 超過 FIELD.GZ 的這個比例才算「靠近球門」

/* 依 closingSpeed（m/s）＋是否靠近球門，回傳 'simple'|'stun'|'blowup'。
   數值來自 2026-08-03 使用者確認的三段機率表。 */
function _rollCollisionTier(closing,nearGoal){
  let pStun,pBlow;
  if(closing<1.5){pStun=0.05;pBlow=0;}
  else if(closing<3.5){pStun=0.25;pBlow=nearGoal?0.05:0;}
  else {pStun=0.40;pBlow=nearGoal?0.15:0;}
  if(!nearGoal){                 // 不靠近球門時，雙機捲入的機率併回定桿換位
    pStun += closing<1.5?0:closing<3.5?0.05:0.15;
  }
  const r=Math.random();
  if(pBlow>0&&r<pBlow)return 'blowup';
  if(r<pBlow+pStun)return 'stun';
  return 'simple';
}
function _maybeAnomaly(d,tMin,tMax,prob){
  if(Math.random()<prob) _triggerAnomaly(d,tMin+Math.random()*(tMax-tMin));
}
/* v3（2026-11-17 老師回饋重寫）：
   ① 撞擊用「動量交換」算，兩台一定互相彈開（恢復係數 0.85），撞越快彈越遠——不再靠抽籤，
      加速撞過去一定看得到效果；
   ② 被撞的一瞬間兩台都會「失控」一小段時間（接近速度 × 0.12 秒，最多 0.7 秒），AI 這段時間不能
      馬上修正回來（舊版 AI 撞完下一幀就拉回原位，看起來像沒事）；撞得很快時還可能訊號異常；
   ③ 擦撞自轉只在「剛碰到的那一下」算，而且錯開滑動要超過 0.6 m/s——慢慢靠過去、擠在一起不會亂轉；
   ④ 進球回程中的前鋒（mustReturn）跟對方碰到只輕輕推開，不失控、不轉。 */
const _touch=new Set();
export function resolveCollisions(drones){
  const now=new Set();
  for(let i=0;i<drones.length;i++)for(let j=i+1;j<drones.length;j++){
    const a=drones[i], b=drones[j];
    _diff.copy(a.pos).sub(b.pos);
    const d2=_diff.lengthSq(), md=BR*2;
    if(d2<md*md&&d2>1e-4){
      const key=a.i+','+b.i, onset=!_touch.has(key); now.add(key);
      const dist=Math.sqrt(d2), n=_diff.divideScalar(dist);
      _relVel.copy(a.vel).sub(b.vel);
      const vn=_relVel.dot(n), closing=Math.max(0,-vn);       // n 由 b 指向 a；vn<0＝正在靠近
      // 進球回程（不可擋）或同隊互碰：只輕輕推開，不失控、不轉
      const returning=((a.mustReturn||b.mustReturn)&&a.team!==b.team)||a.team===b.team;
      if(vn<0){
        /* 2026-11-19 晚（老師：「兩機互頂不會撞飛，只有直線加速撞過去才會飛」）：彈性改成看接近速度——
           慢慢頂（< 0.8 m/s）＝完全不彈、兩台黏在一起比推力，推力大的慢慢把對方推走；
           0.8～2.5 m/s 逐漸變彈；≥ 2.5 m/s（直線加速衝撞）才是全彈 0.95＋外推，撞飛。 */
        const hard=returning?0:Math.min(1,Math.max(0,(closing-0.8)/1.7));
        const e=returning?0.2:0.95*hard, jimp=-(1+e)*vn/2;      // 等質量：各分一半
        // 球框有彈性：衝撞時再多給兩邊一個往外彈的力（接近速度 × 0.45 × 衝撞程度²），慢慢頂不會有
        const push=closing*0.45*hard*hard;
        if(onset){ bump(a,closing,'drone'); bump(b,closing,'drone'); }
        if(onset&&!returning&&closing>0.8){   // 2026-11-27 撞後恢復（玩家機 step() 用；AI 用 knockT）
          const rt=Math.min(1.0,0.25+closing*0.28), wk=Math.min(0.35,closing*0.08);
          for(const d of [a,b]){ d.recT=Math.max(d.recT||0,rt); d.wob=[(Math.random()*2-1)*wk,(Math.random()*2-1)*wk]; }
        }
        a.vel.addScaledVector(n,jimp+push); b.vel.addScaledVector(n,-jimp-push);
        if(!returning&&onset&&closing>1.2){   // 慢慢頂不會失控（原本 0.4 m/s 就失控）
          const kt=Math.min(0.7,closing*0.12);
          for(const d of [a,b]) d.knockT=Math.max(d.knockT||0,kt);
          if(closing>2.5){ const p=Math.min(0.6,(closing-2.5)/4); _maybeAnomaly(a,0.3,0.7,p); _maybeAnomaly(b,0.3,0.7,p); }
        }
      }
      if(onset&&!returning){   // 擦撞：兩台同方向自轉（都順時針或都逆時針）
        const tx=_relVel.x-n.x*vn, tz=_relVel.z-n.z*vn;
        if(Math.hypot(tx,tz)>0.6&&closing>0.8){   // 2026-11-19：慢慢頂、貼著滑不轉
          const kick=Math.max(-2.2,Math.min(2.2,(n.z*tx-n.x*tz)*1.2));
          for(const d of [a,b]) d.spinV=Math.max(-9,Math.min(9,(d.spinV||0)+kick));
        }
      }
      const ov=(md-dist)*.52;
      a.pos.addScaledVector(n,ov); b.pos.addScaledVector(n,-ov);
    }
  }
  _touch.clear(); now.forEach(k=>_touch.add(k));
}

/* ── 進球判定（FAI：僅 striker、mustReturn 中不得分）→ 'A'|'B'|null ──
   判定半徑兩檔（skill「判定寬鬆優先」＋FAI 正式規則對照）：
   - 練習（寬鬆，預設）：球心進內徑 GI=0.20 即得分——降低學生挫折感
   - 正式（strict）：FAI 規定「整顆球完全穿過」＝球心距環軸 < GI−BR=0.09
     （SC4 Vol F9 2026：goal when "entire drone ball has passed through"）
   辦正式比賽請開 strict（關卡 intro 可切換）。 */
export function checkGoal(d,{strict=false}={}){
  const F=FIELD;
  if(d.role!=='striker'||d.mustReturn)return null;
  const targZ=d.team===TA?F.GZ:-F.GZ;
  const dir=d.team===TA?1:-1;
  if(!((d.prevZ-targZ)*dir<0&&(d.pos.z-targZ)*dir>=0))return null;
  const dx=d.pos.x, dy=d.pos.y-F.GY;
  const r=strict?F.GI-F.BR:F.GI;
  return Math.sqrt(dx*dx+dy*dy)<=r ? (d.team===TA?'A':'B') : null;
}
