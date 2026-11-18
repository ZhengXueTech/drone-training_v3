/* newdrone 無人機飛行模擬器 © 2026 何政學（新北市立中正國民中學）｜授權 CC BY-NC-SA 4.0（姓名標示─非商業性─相同方式分享），見 LICENSE.md；請保留本聲明 */
/* ============================================================
   drone-soccer-cage.js — 擬真「足球無人機」機型（2026-11-17 新增，主題試做中）
   ------------------------------------------------------------
   參考實際 20cm 級足球無人機的結構（老師燈框專案的實物）：
   · 球框：四款可選——地球儀／足球紋路／蜂巢細網／透明殼（老師提供的市售照片），底部都是「平的底座」，
     停地時平底貼地、飛起來也看得到平底。
   · 環燈：16 顆 LED，隊伍色（規定紅／藍）；可長在外框最大那圈（outer）或躲在球內機架下（inner）。
   · 尾燈：下排、在機尾（+Z），跟環燈分開；12 色可選，前鋒自動換成對方隊色。
   · 內部：X 型機架＋四顆馬達＋四組槳（會轉，轉速跟離地高度連動）。
   · 機頭 = -Z（跟 drone-styles.js 規範一致），機頭方向有一個黃色小三角。
   畫面半徑 0.5（跟訓練光球同大，視覺放大過，方便看清楚），
   只是外觀：物理／碰撞半徑完全不變。
   ============================================================ */
import * as THREE from 'three';

const R=0.5;          // 球框半徑（視覺）
const BASE_Y=-0.40;   // 平底高度（相對球心）

/* 足球紋路球框（截角二十面體＝真正足球的 12 個五角形＋20 個六角形）。
   規則：FAI F9 B.1.1 單一開口 ≤150 cm²（韓國 20cm 級規則 <70 cm²）。
   以實物直徑 20 cm 換算，五角形約 29 cm²、六角形約 44 cm²，都在規定內
   （實際數值見 cageOpenAreas()）。 */
function icosa(){
  const t=(1+Math.sqrt(5))/2;
  const v=[[-1,t,0],[1,t,0],[-1,-t,0],[1,-t,0],[0,-1,t],[0,1,t],[0,-1,-t],[0,1,-t],[t,0,-1],[t,0,1],[-t,0,-1],[-t,0,1]]
    .map(a=>new THREE.Vector3(...a).normalize());
  const e=[]; const L=v[0].distanceTo(v[1]);
  for(let i=0;i<12;i++)for(let j=i+1;j<12;j++)if(Math.abs(v[i].distanceTo(v[j])-L)<1e-6)e.push([i,j]);
  return {v,e};
}
function soccerFaces(){
  const {v,e}=icosa();
  const pt=(a,b,f)=>new THREE.Vector3().lerpVectors(v[a],v[b],f).normalize().multiplyScalar(R);
  const edges=[], pents=[], hexKeys=new Map();
  // 每條二十面體邊的中間 1/3 段＝六角形與六角形之間的邊
  for(const [a,b] of e) edges.push([pt(a,b,1/3),pt(a,b,2/3)]);
  // 每個頂點周圍 5 個 1/3 點＝五角形
  for(let i=0;i<12;i++){
    const nb=e.filter(([a,b])=>a===i||b===i).map(([a,b])=>a===i?b:a);
    const n=v[i], u=new THREE.Vector3().subVectors(v[nb[0]],n).projectOnPlane(n).normalize(), w=new THREE.Vector3().crossVectors(n,u);
    nb.sort((x,y)=>{ const dx=new THREE.Vector3().subVectors(v[x],n), dy=new THREE.Vector3().subVectors(v[y],n);
      return Math.atan2(dx.dot(w),dx.dot(u))-Math.atan2(dy.dot(w),dy.dot(u)); });
    const ring=nb.map(k=>pt(i,k,1/3)); pents.push(ring);
    for(let k=0;k<5;k++) edges.push([ring[k],ring[(k+1)%5]]);
  }
  return {edges,pents};
}
/* 開口面積（cm²，以實物直徑 20 cm 換算；平面多邊形近似） */
export function cageOpenAreas(style='globe'){
  if(style==='globe')return globeAreas();
  const {edges,pents}=soccerFaces();
  const k=10/R;  // 畫面半徑 0.5 ↔ 實物 10 cm
  const poly=pts=>{ const c=new THREE.Vector3(); pts.forEach(p=>c.add(p)); c.divideScalar(pts.length);
    let A=0; for(let i=0;i<pts.length;i++){ A+=new THREE.Vector3().crossVectors(
      new THREE.Vector3().subVectors(pts[i],c),new THREE.Vector3().subVectors(pts[(i+1)%pts.length],c)).length()/2; } return A*k*k; };
  const side=edges[0][0].distanceTo(edges[0][1]);
  const pent=poly(pents[0]);
  const hex=pent*0+ (3*Math.sqrt(3)/2)*side*side*k*k;   // 正六角形近似
  return {pent:Math.round(pent),hex:Math.round(hex)};
}
/* 常見款「地球儀式」球框（老師提供的市售 20 cm 球照片）：
   經線肋條＋幾圈緯線、頂部小圈、底部是平的大圓開口、赤道一圈較寬的燈帶。 */
const MERID=12, LATS=[-30,30,55], TOP_LAT=80, MERID_ROT=15;
const BASE_LAT=Math.asin(BASE_Y/R)*180/Math.PI;   // 約 -53°
function sph(latDeg,lonDeg){ const la=latDeg*Math.PI/180, lo=lonDeg*Math.PI/180;
  return new THREE.Vector3(Math.cos(la)*Math.cos(lo)*R, Math.sin(la)*R, Math.cos(la)*Math.sin(lo)*R); }
function globeEdges(){
  const out=[], seg=(pts,closed)=>{ for(let i=0;i<pts.length-(closed?0:1);i++) out.push([pts[i],pts[(i+1)%pts.length]]); };
  // 經線：從底座到頂圈
  // 2026-11-17 老師決定：整圈轉 15°（MERID_ROT），機頭／機尾落在開口中間、不擋尾燈
  for(let m=0;m<MERID;m++){ const lo=MERID_ROT+m*360/MERID, pts=[];
    for(let k=0;k<=12;k++) pts.push(sph(BASE_LAT+(TOP_LAT-BASE_LAT)*k/12,lo)); seg(pts,false); }
  // 緯線圈＋頂圈＋底座圈（底座圈＝平底的大圓開口）
  for(const lat of [...LATS,TOP_LAT,BASE_LAT]){ const pts=[];
    for(let k=0;k<48;k++) pts.push(sph(lat,k*7.5)); seg(pts,true); }
  return out;
}
/* ── NEWDRONE 原創球框（2026-11-17，自己設計的幾何，不參考任何產品）── */
const ringPts=(lat,n,off=0)=>{ const a=[]; for(let k=0;k<n;k++) a.push(sph(lat,off+k*360/n)); return a; };
const loop=(pts,out)=>{ for(let i=0;i<pts.length;i++) out.push([pts[i],pts[(i+1)%pts.length]]); };
/* Z 紋桁架：緯線圈之間用鋸齒斜撐（三角形桁架），也呼應「中正」的 Z */
function zigEdges(){
  const out=[], lats=[BASE_LAT,-25,0,25,50,74], N=12;
  lats.forEach((lat,i)=>{ loop(ringPts(lat,48),out);
    if(i<lats.length-1){ const lo=ringPts(lat,N,(i%2)*15), hi=ringPts(lats[i+1],N,((i+1)%2)*15);
      for(let k=0;k<N;k++){ out.push([lo[k],hi[k]]); out.push([hi[k],lo[(k+1)%N]]); } } });
  return out;
}
/* 螺旋菱格：兩組反向螺旋肋條交叉成菱形 */
function spiralEdges(){
  const out=[], M=10, TW=110, TOP=76;
  for(const dir of [1,-1]) for(let m=0;m<M;m++){ const pts=[];
    for(let k=0;k<=16;k++){ const t=k/16, lat=BASE_LAT+(TOP-BASE_LAT)*t; pts.push(sph(lat,m*360/M+dir*TW*t)); }
    for(let i=0;i<pts.length-1;i++) out.push([pts[i],pts[i+1]]); }
  loop(ringPts(TOP,48),out); loop(ringPts(BASE_LAT,48),out);
  return out;
}
/* 軌道環：三條斜大圓（像衛星軌道／陀螺儀）＋緯線把開口縮小 */
function orbitEdges(){
  const out=[];
  for(let o=0;o<3;o++){ const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(55*Math.PI/180,o*120*Math.PI/180,0,'YXZ'));
    const pts=[]; for(let k=0;k<64;k++){ const a=k/64*Math.PI*2; pts.push(new THREE.Vector3(Math.cos(a)*R,0,Math.sin(a)*R).applyQuaternion(q)); }
    loop(pts,out); }
  for(const lat of [-30,30,60,BASE_LAT]) loop(ringPts(lat,48),out);
  for(let m=0;m<6;m++){ const pts=[]; for(let k=0;k<=8;k++) pts.push(sph(BASE_LAT+(60-BASE_LAT)*k/8,m*60+30)); for(let i=0;i<8;i++) out.push([pts[i],pts[i+1]]); }
  return clampPairs(out);
}

/* 燈籠款（老師的構想，2026-11-17）：碳纖棒彎成弧線當經線，上圈／赤道圈／底座圈是
   3D 列印件（硬料），棒子交會處用軟料小夾扣卡住——結構像中式燈籠骨架。
   開口：12 支棒＋三圈 → 側面每格約 42～46 cm²（20 cm 實物），在韓國規則 70 cm² 內。 */
const LAN_RODS=12, LAN_TOP=62, LAN_ROT=15;
/* 頂部三種（2026-11-17 老師決定都開放選）：
   'disc'＝頂上有列印圓盤（可以拿來頂人）；
   'fai' ＝沒圓盤、頂圈開大一點（lat 50，頂部開口約 130 cm²，FAI ≤150）；
   'kr'  ＝沒圓盤、頂圈 lat 62＋頂部和底部各加十字（每格都 <70 cm²，韓國規則）。 */
const LAN_TOPS={disc:62, fai:50, kr:62};
function lanternRods(topLat=LAN_TOP){
  const out=[];
  for(let m=0;m<LAN_RODS;m++){ const lo=LAN_ROT+m*360/LAN_RODS, pts=[];
    for(let k=0;k<=20;k++) pts.push(sph(BASE_LAT+(topLat-BASE_LAT)*k/20,lo));
    for(let i=0;i<20;i++) out.push([pts[i],pts[i+1]]); }
  return out;
}
export function lanternAreas(rods=LAN_RODS,top='disc'){
  const topLat=LAN_TOPS[top]||LAN_TOP;
  const k=10, z=(a,b)=>2*Math.PI*k*k*Math.abs(Math.sin(b*Math.PI/180)-Math.sin(a*Math.PI/180))/rods;
  const rt=Math.cos(topLat*Math.PI/180)*k, rb=Math.cos(BASE_LAT*Math.PI/180)*k;
  const out={upper:Math.round(z(0,topLat)), lower:Math.round(z(BASE_LAT,0)), bottom:Math.round(Math.PI*rb*rb)};
  if(top==='kr'){ out.top=Math.round(Math.PI*rt*rt/4); out.bottom=Math.round(Math.PI*rb*rb/4); out.cross=true; }   // 11-17：韓國版頂、底都加十字 → 每格＝1/4
  else out.top=Math.round(Math.PI*rt*rt);
  if(top==='disc') out.top=0;   // 有圓盤＝頂部封住
  return out;
}

/* 11-17：給驗收用——依球機設定列出各開口面積（cm²，實物 20 cm）。
   complete=false 表示還沒算的款式（目前全部都算了）。 */
export function ballOpenAreas(b){
  const k=10, kr=b.top==='kr', disk=r=>Math.PI*r*r, out=[];
  const cross=(name,r)=>{ if(kr) out.push([name+'每格',disk(r)/4]); else out.push([name,disk(r)]); };   // 韓國版＝十字切 4 格
  const rb=Math.cos(BASE_LAT*Math.PI/180)*k, rTop=Math.sqrt(R*R-TOP_Y*TOP_Y)/R*k;
  let complete=true;
  if(b.cage==='lantern'){ const A=lanternAreas(LAN_RODS,b.top||'disc');
    out.push(['側面',Math.max(A.upper,A.lower)]);
    if(A.top) out.push([A.cross?'頂部每格':'頂部',A.top]);
    out.push([A.cross?'底部每格':'底部',A.bottom]);
    return {parts:out.map(([n,a])=>[n,Math.round(a)]),complete:true,topClosed:!A.top}; }
  if(b.cage==='globe'){ out.push(['側面',globeAreas().side],['頂部',disk(Math.cos(TOP_LAT*Math.PI/180)*k)]); }
  else if(b.cage==='soccer'){ const a=cageOpenAreas('soccer'); out.push(['五角形',a.pent],['六角形',a.hex]); cross('頂部',rTop); }
  else if(b.cage==='honey'){ out.push(['側面細網',14]); cross('頂部',rTop); }
  // 11-17 晚：Z紋／螺旋／軌道環用球面格點逐格量出來（含赤道燈帶當分隔；誤差約 ±4%）
  else if(b.cage==='zig'){ out.push(['側面',12],['頂部',23]); }
  else if(b.cage==='spiral'){ out.push(['側面',19],['頂部',18]); }
  else if(b.cage==='orbit'){ out.push(['側面',35]); cross('頂部',rTop); }   // 加頂圈後：側面最大 35、頂部平面 92
  else if(b.cage==='clear'){ out.push(['側面',26],['頂部',disk(Math.cos(TOP_LAT*Math.PI/180)*k)]); }   // 透明殼＝地球儀骨架
  else complete=false;
  cross('底部',rb);
  return {parts:out.map(([n,a])=>[n,Math.round(a)]),complete};
}
/* 開口面積（cm²，以實物直徑 20 cm 換算，球面帶狀分格精算） */
function globeAreas(){
  const k=10, zone=(a,b)=>2*Math.PI*k*k*Math.abs(Math.sin(b*Math.PI/180)-Math.sin(a*Math.PI/180))/MERID;
  const bands=[BASE_LAT,...LATS.slice(0,1),0,...LATS.slice(1),TOP_LAT].sort((x,y)=>x-y);
  let side=0; for(let i=0;i<bands.length-1;i++) side=Math.max(side,zone(bands[i],bands[i+1]));
  const rb=Math.cos(BASE_LAT*Math.PI/180)*k;
  return {side:Math.round(side), bottom:Math.round(Math.PI*rb*rb)};
}

const TOP_Y=0.42;     // 頂部開口平面（足球紋路、蜂巢款上面多一圈開口，照實物照片）
/* 把框條夾在底座與頂圈兩個平面之間；兩端都被壓到同一平面的條子丟掉（那裡改由圈補上） */
/* 11-17 晚改：桿件超出平底／頂部平面時，在「平面跟球面相交」那一點切斷，端點剛好落在底圈／頂圈上。
   舊寫法只把 y 壓平，端點會停在圈內側變成懸空的短桿（蜂巢、軌道環頂部各有幾根）——
   老師：球框不能有凸起物（會戳到敵方飛機），所以不能留懸空的桿頭。 */
function clampPairs(pairs,top=true){
  const cut=(a,b,y)=>{ const t=(y-a.y)/(b.y-a.y), p=a.clone().lerp(b,t), h=Math.hypot(p.x,p.z)||1, r=Math.sqrt(R*R-y*y);
    p.x*=r/h; p.z*=r/h; p.y=y; return p; };            // a 在平面內側、b 在外側 → 回傳交點（貼在圈上）
  const out=[];
  for(let [a,b] of pairs){
    if(a.y<=BASE_Y&&b.y<=BASE_Y)continue;
    if(top&&a.y>=TOP_Y&&b.y>=TOP_Y)continue;
    if(a.y<BASE_Y)a=cut(b,a,BASE_Y); else if(b.y<BASE_Y)b=cut(a,b,BASE_Y);
    if(top){ if(a.y>TOP_Y)a=cut(b,a,TOP_Y); else if(b.y>TOP_Y)b=cut(a,b,TOP_Y); }
    if(a.distanceTo(b)>0.003)out.push([a,b]);
  }
  return out;
}
function cageEdges(){ return clampPairs(soccerFaces().edges); }
/* 蜂巢款（細密六角網，照片裡藍色／橘色那種）：細分二十面體的「對偶」——
   每個三角面取中心，相鄰兩面的中心連一條，整顆就變成六角形網（夾 12 個五角形）。 */
function honeyEdges(){
  const g=new THREE.IcosahedronGeometry(R,2), p=g.getAttribute('position');
  const key=v=>v.toArray().map(n=>Math.round(n*1e4)).join(',');
  const cent=[], edgeFaces=new Map();
  for(let t=0;t<p.count;t+=3){
    const a=new THREE.Vector3().fromBufferAttribute(p,t), b=new THREE.Vector3().fromBufferAttribute(p,t+1), c=new THREE.Vector3().fromBufferAttribute(p,t+2);
    const f=cent.length; cent.push(a.clone().add(b).add(c).divideScalar(3).normalize().multiplyScalar(R));
    for(const [u,v] of [[a,b],[b,c],[c,a]]){ const ku=key(u),kv=key(v), k=ku<kv?ku+'|'+kv:kv+'|'+ku;
      if(!edgeFaces.has(k))edgeFaces.set(k,[]); edgeFaces.get(k).push(f); }
  }
  g.dispose();
  const out=[]; for(const fs of edgeFaces.values()) if(fs.length===2) out.push([cent[fs[0]],cent[fs[1]]]);
  return clampPairs(out);
}

/* 用 InstancedMesh 一次畫完所有框條（比一條一條建便宜） */
function makeStruts(pairs,radius,mat){
  const geo=new THREE.CylinderGeometry(radius,radius,1,6,1,true);
  const im=new THREE.InstancedMesh(geo,mat,pairs.length);
  const up=new THREE.Vector3(0,1,0), m=new THREE.Matrix4(), q=new THREE.Quaternion(),
        s=new THREE.Vector3(), mid=new THREE.Vector3(), dir=new THREE.Vector3();
  pairs.forEach(([a,b],i)=>{
    dir.subVectors(b,a); const len=dir.length(); dir.normalize();
    mid.addVectors(a,b).multiplyScalar(0.5);
    q.setFromUnitVectors(up,dir); s.set(1,len,1);
    m.compose(mid,q,s); im.setMatrixAt(i,m);
  });
  im.castShadow=true;
  return im;
}

/* 尾燈 12 色（FAI B.1.5：每顆球尾燈顏色不同、隊伍自選、不可用紅／藍；
   前鋒例外：紅隊前鋒＝藍、藍隊前鋒＝紅）。順序已盡量讓相鄰色差距大；
   「慎用」三色在 LED 實物上比較容易被看成紅或藍。 */
export const TAIL_COLORS=[
  {name:'白',hex:0xffffff},{name:'黃',hex:0xffe600},{name:'綠',hex:0x00d84a},{name:'紫',hex:0xa040ff,warn:'接近藍'},
  {name:'橘',hex:0xff8c00},{name:'薄荷',hex:0x00e5b0},{name:'洋紅',hex:0xff2bd6,warn:'接近紅'},{name:'萊姆',hex:0xa8ff00},
  {name:'青',hex:0x00d0ff,warn:'接近藍'},{name:'金',hex:0xffc000},{name:'粉',hex:0xff8fd0},{name:'暖白',hex:0xffd9a0},
];
export const TEAM_COLORS={red:0xff2a2a, blue:0x2a6bff};
/* 燈籠列印件顏色＝中正基本色調（2026-11-17 老師決定）：白＋校服藍／橘／青（色碼照公開得獎照片估，可再調） */
export const PRINT_COLORS={
  white:{name:'白',hex:0xf2f4f5}, blue:{name:'校服藍',hex:0x58b4e6},
  orange:{name:'校服橘',hex:0xff6a1a}, cyan:{name:'青',hex:0x16b3a4},
};
/* 球框跟環燈同色系＝環燈分不清楚，違反規定（環燈要清楚可辨）→ 回傳提醒文字；沒撞色回傳 null。只提醒、不擋選擇。 */
export function printColorClash(team,printKey){
  if(team==='blue'&&printKey==='blue') return '藍隊配校服藍球框：環燈跟球框都是藍色，裁判分不清楚——這樣違反規定（環燈必須清楚可辨），比賽請換顏色。';
  if(team==='red'&&printKey==='orange') return '紅隊配校服橘球框：環燈跟球框顏色太接近，裁判分不清楚——這樣違反規定（環燈必須清楚可辨），比賽請換顏色。';
  return null;
}

/* 把球裡「不會動、不透明」的零件，依材質合併成一個網格（機架、馬達、LED、尾燈、圓圈、列印件…）。
   槳（會轉）、InstancedMesh（球框桿件，本來就是一次畫完）、半透明光暈都不動。
   只合併位置＋法線，這些材質都不用貼圖座標。 */
function mergeStatic(g,props){
  g.updateMatrixWorld(true);
  const skip=new Set(); props.forEach(p=>p.traverse(o=>skip.add(o)));
  const groups=new Map();
  g.traverse(o=>{
    if(!o.isMesh||o.isInstancedMesh||skip.has(o))return;
    const m=o.material; if(Array.isArray(m)||m.transparent)return;
    if(!groups.has(m))groups.set(m,[]); groups.get(m).push(o);
  });
  for(const [mat,list] of groups){
    if(list.length<2)continue;
    const pos=[], nor=[]; const nm=new THREE.Matrix3();
    for(const o of list){
      let geo=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();
      geo.applyMatrix4(o.matrixWorld);
      const pa=geo.attributes.position.array; pos.push(pa);
      if(geo.attributes.normal)nor.push(geo.attributes.normal.array);
      else{ geo.computeVertexNormals(); nor.push(geo.attributes.normal.array); }
      geo.dispose();
    }
    const cat=arrs=>{ const n=arrs.reduce((a,b)=>a+b.length,0), out=new Float32Array(n); let k=0; for(const a of arrs){ out.set(a,k); k+=a.length; } return out; };
    const merged=new THREE.BufferGeometry();
    merged.setAttribute('position',new THREE.BufferAttribute(cat(pos),3));
    merged.setAttribute('normal',new THREE.BufferAttribute(cat(nor),3));
    merged.computeBoundingSphere();
    for(const o of list){ o.parent.remove(o); }
    const mm=new THREE.Mesh(merged,mat); mm.castShadow=true; g.add(mm);
  }
}

let _glowTex=null;
function glowTexture(){
  if(_glowTex)return _glowTex;
  if(typeof document==='undefined')return null;
  const c=document.createElement('canvas'); c.width=c.height=64; const x=c.getContext('2d');
  const gr=x.createRadialGradient(32,32,0,32,32,32);
  gr.addColorStop(0,'rgba(255,255,255,1)'); gr.addColorStop(0.35,'rgba(255,255,255,.55)'); gr.addColorStop(1,'rgba(255,255,255,0)');
  x.fillStyle=gr; x.fillRect(0,0,64,64);
  _glowTex=new THREE.CanvasTexture(c); return _glowTex;
}
export function buildSoccerCage({tint=0x3399ff,team=null,scale=1,tail=0xffffff,striker=false,cage='globe',cageColor=0xdfe5ee,ring='outer',printColor=0xff7a1a,top='disc'}={}){
  if(typeof printColor==='string'&&PRINT_COLORS[printColor]) printColor=PRINT_COLORS[printColor].hex;
  const ringPos=ring;
  // team 指定時環燈用規定的紅／藍；前鋒尾燈＝對方隊色
  if(team&&TEAM_COLORS[team]) tint=TEAM_COLORS[team];
  if(striker&&team) tail=TEAM_COLORS[team==='red'?'blue':'red'];
  const g=new THREE.Group();
  g.userData.styleCode='soccer-cage';
  g.userData.noseDir=new THREE.Vector3(0,0,-1);

  // ── 球框：cage＝'globe' 地球儀｜'soccer' 足球紋路｜'honey' 蜂巢細網｜'clear' 透明殼 ──
  const clear=cage==='clear';
  const cageM=clear
    ? new THREE.MeshStandardMaterial({color:0xeaf6ff,emissive:0x1a2a3a,transparent:true,opacity:0.45,roughness:0.15,metalness:0.0,depthWrite:false})
    : new THREE.MeshStandardMaterial({color:cageColor,emissive:0x1c2636,metalness:0.15,roughness:0.55});
  const rAt=y=>Math.sqrt(R*R-y*y);
  const hoop=(y,tube)=>{ const m=new THREE.Mesh(new THREE.TorusGeometry(rAt(y),tube,6,48),cageM);
    m.rotation.x=Math.PI/2; m.position.y=y; g.add(m); };
  if(cage==='soccer'){ g.add(makeStruts(cageEdges(),0.017,cageM)); hoop(BASE_Y,0.02); hoop(TOP_Y,0.017); }
  else if(cage==='honey'){ g.add(makeStruts(honeyEdges(),0.009,cageM)); hoop(BASE_Y,0.016); hoop(TOP_Y,0.012); }
  else if(cage==='lantern'){
    // 碳纖棒（深色、細）＋列印件（printColor：上圈、赤道圈、底座圈、夾扣）
    const rodM=new THREE.MeshStandardMaterial({color:0x15171b,metalness:0.4,roughness:0.35});
    const prtM=new THREE.MeshStandardMaterial({color:printColor,roughness:0.7});
    const topLat=LAN_TOPS[top]||LAN_TOP;
    g.add(makeStruts(lanternRods(topLat),0.009,rodM));
    const ringAt=(y,tube,h)=>{ const m=new THREE.Mesh(new THREE.TorusGeometry(rAt(y),tube,8,48),prtM);
      m.rotation.x=Math.PI/2; m.position.y=y; m.scale.z=h||1; g.add(m); };
    const yTop=Math.sin(topLat*Math.PI/180)*R;
    ringAt(yTop,0.022); ringAt(BASE_Y,0.024);
    if(top==='disc'){
      // 頂蓋：燈籠頂的小圓盤（列印件，可以拿來頂人）
      const cap=new THREE.Mesh(new THREE.CylinderGeometry(rAt(yTop)*0.55,rAt(yTop)*0.8,0.03,24),prtM);
      cap.position.y=yTop+0.02; g.add(cap);
    } else if(top==='kr'){
      // 韓國規則版（11-17 老師選十字）：頂部、底部各加兩根對角交叉的碳纖棒，每格約 17／28 cm²
      const xs=[]; for(const y of [yTop,BASE_Y]) for(let q=0;q<2;q++){ const a=(45+q*90)*Math.PI/180, c=Math.cos(a)*rAt(y), s2=Math.sin(a)*rAt(y);
        xs.push([new THREE.Vector3(-c,y,-s2),new THREE.Vector3(c,y,s2)]); }
      g.add(makeStruts(xs,0.009,rodM));
    }
    // 棒子跟上／下／赤道圈交會處的夾扣（軟料小塊）
    const clipG=new THREE.BoxGeometry(0.04,0.045,0.03);
    for(let m=0;m<LAN_RODS;m++) for(const lat of [topLat,0,BASE_LAT]){
      const c=new THREE.Mesh(clipG,prtM); c.position.copy(sph(lat,LAN_ROT+m*360/LAN_RODS)); c.lookAt(0,c.position.y,0); g.add(c); }
  }
  else if(cage==='zig'){ g.add(makeStruts(zigEdges(),0.011,cageM)); hoop(BASE_Y,0.02); }
  else if(cage==='spiral'){ g.add(makeStruts(spiralEdges(),0.012,cageM)); hoop(BASE_Y,0.02); }
  else if(cage==='orbit'){ g.add(makeStruts(orbitEdges(),0.012,cageM)); hoop(BASE_Y,0.02); hoop(TOP_Y,0.017); }   // 11-17 晚：加頂圈（原本頂部連成 151 cm² 超過 FAI 150）
  else { g.add(makeStruts(globeEdges(),clear?0.02:0.012,cageM)); hoop(BASE_Y,clear?0.026:0.02); }
  // 11-17 老師：其他款也有「韓國版」（top='kr'）——底部平底大開口加十字（兩根對角交叉）；
  // 足球紋路／蜂巢的頂部開口（約 92 cm²）也一樣加。燈籠款在上面自己處理。
  if(top==='kr'&&cage!=='lantern'){
    const krCross=y=>{ const ro=rAt(y), sp=[];
      for(let q=0;q<2;q++){ const a=(45+q*90)*Math.PI/180;
        sp.push([new THREE.Vector3(-Math.cos(a)*ro,y,-Math.sin(a)*ro),new THREE.Vector3(Math.cos(a)*ro,y,Math.sin(a)*ro)]); }
      g.add(makeStruts(sp,0.01,cageM)); };
    krCross(BASE_Y);
    if(cage==='soccer'||cage==='honey'||cage==='orbit') krCross(TOP_Y);
  }
  // 赤道圈：外框最大那一圈（燈放外圈時它就是燈帶）
  const band=new THREE.Mesh(new THREE.CylinderGeometry(R*1.01,R*1.01,ring==='outer'?0.06:0.03,64,1,true),
    clear?cageM:new THREE.MeshStandardMaterial({color:cage==='lantern'?printColor:cageColor,roughness:0.6,side:THREE.DoubleSide}));
  g.add(band);

  // ── 機架、馬達、槳 ──
  const frameM=new THREE.MeshStandardMaterial({color:0x1f242c,metalness:0.5,roughness:0.4});
  const body=new THREE.Mesh(new THREE.BoxGeometry(0.15,0.035,0.15),frameM); body.position.y=0.0; g.add(body);
  const batt=new THREE.Mesh(new THREE.BoxGeometry(0.08,0.05,0.15),
    new THREE.MeshStandardMaterial({color:0x2d3644,roughness:0.6}));
  batt.position.set(0,-0.06,0.03); g.add(batt);
  const props=[];
  const motorM=new THREE.MeshStandardMaterial({color:0x9aa3ad,metalness:0.8,roughness:0.3});
  const bladeM=new THREE.MeshStandardMaterial({color:0x111418,roughness:0.5});
  const blurM=new THREE.MeshBasicMaterial({color:0xcfd6df,transparent:true,opacity:0.08,depthWrite:false,side:THREE.DoubleSide});
  for(const [sx,sz] of [[-1,-1],[1,-1],[-1,1],[1,1]]){
    const end=new THREE.Vector3(sx*0.2,0,sz*0.2);
    const arm=new THREE.Mesh(new THREE.BoxGeometry(0.03,0.02,0.29),frameM);
    arm.position.copy(end).multiplyScalar(0.5); arm.lookAt(end); g.add(arm);
    const motor=new THREE.Mesh(new THREE.CylinderGeometry(0.028,0.028,0.045,12),motorM);
    motor.position.set(end.x,0.02,end.z); g.add(motor);
    const prop=new THREE.Group(); prop.position.set(end.x,0.05,end.z);
    const blade=new THREE.Mesh(new THREE.BoxGeometry(0.21,0.006,0.026),bladeM); prop.add(blade);
    const blur=new THREE.Mesh(new THREE.CircleGeometry(0.11,24),blurM.clone());
    blur.rotation.x=-Math.PI/2; prop.add(blur);
    prop.userData.dir=sx*sz>0?1:-1;          // 對角同向、相鄰反向（四軸慣例）
    prop.userData.blade=blade; prop.userData.blur=blur;
    g.add(prop); props.push(prop);
  }
  g.userData.props=props;

  // ── 環燈（16 顆 LED，FAI F9A-B 至少 16 顆，隊伍色）──
  // ring＝'outer'：長在外框最大那圈上｜'inner'：小圈躲在球內、貼在機架下方
  // 規則重點是「環燈要明顯、分得出來」，球框本身沒有硬性樣式。
  const ledM=new THREE.MeshBasicMaterial({color:tint});
  // 2026-11-17 新增三種實機燈位（老師決定全部開放自由選，不跟機型綁）：
  // 'dome'＝頂部燈罩（TC 200I 的 H7 燈罩、GT2：Ø50 環燈板在機身中央頂部）
  // 'waist'＝腰帶燈（Balkin-S3：燈條貼原廠白色圓環，r≈61 mm、機臂下方）
  // 'frame'＝兩排燈框（TC 200I v6：環燈列在上、尾燈列在下，燈框 Ø135）
  const XR={dome:{r:0.115,y:0.045,w:0.018,h:0.016},waist:{r:0.31,y:-0.035,w:0.026,h:0.02},frame:{r:0.343,y:-0.018,w:0.024,h:0.02}}[ringPos];
  if(XR){
    const ringG=new THREE.Group();
    for(let i=0;i<16;i++){ const a=i/16*Math.PI*2, d=new THREE.Mesh(new THREE.BoxGeometry(XR.w,XR.h,0.01),ledM);
      d.position.set(Math.cos(a)*XR.r,XR.y,Math.sin(a)*XR.r); d.lookAt(0,XR.y,0); ringG.add(d); }
    if(ringPos==='dome'){   // 半透明燈罩
      const dome=new THREE.Mesh(new THREE.SphereGeometry(0.13,28,10,0,Math.PI*2,0,Math.PI/2),
        new THREE.MeshStandardMaterial({color:0xf4f7fb,transparent:true,opacity:0.35,roughness:0.3,depthWrite:false}));
      dome.scale.y=0.55; dome.position.y=0.02; ringG.add(dome);
    } else if(ringPos==='waist'){   // 原廠白色圓環
      const hoopW=new THREE.Mesh(new THREE.CylinderGeometry(0.305,0.305,0.03,48,1,true),
        new THREE.MeshStandardMaterial({color:0xe8ecef,roughness:0.6,side:THREE.DoubleSide}));
      hoopW.position.y=XR.y; ringG.add(hoopW);
    } else {   // 列印燈框（深灰）：環燈列＋下方尾燈列
      const fr=new THREE.Mesh(new THREE.CylinderGeometry(0.338,0.338,0.075,48,1,true),
        new THREE.MeshStandardMaterial({color:0x2b2f36,roughness:0.7,side:THREE.DoubleSide}));
      fr.position.y=XR.y-0.025; ringG.add(fr);
    }
    g.add(ringG);
    const glowX=new THREE.Mesh(new THREE.TorusGeometry(XR.r*1.01,0.035,8,64),
      new THREE.MeshBasicMaterial({color:tint,transparent:true,opacity:0.3,blending:THREE.AdditiveBlending,depthWrite:false}));
    glowX.rotation.x=Math.PI/2; glowX.position.y=XR.y; g.add(glowX);
    g.userData.ring=ringG;
  } else {
  const inner=ringPos==='inner';
  const rr=inner?0.27:R*1.022, ry=inner?-0.03:0;
  const ledG=new THREE.BoxGeometry(inner?0.034:0.03,0.026,0.012);
  const ringG=new THREE.Group();
  for(let i=0;i<16;i++){ const a=i/16*Math.PI*2, d=new THREE.Mesh(ledG,ledM);
    d.position.set(Math.cos(a)*rr,ry,Math.sin(a)*rr); d.lookAt(0,ry,0); ringG.add(d); }
  if(inner){ const strip=new THREE.Mesh(new THREE.TorusGeometry(rr,0.012,6,48),new THREE.MeshStandardMaterial({color:0x222831}));
    strip.rotation.x=Math.PI/2; strip.position.y=ry; ringG.add(strip); }
  g.add(ringG);
  const ringGlow=new THREE.Mesh(new THREE.TorusGeometry(rr*1.01,inner?0.05:0.04,8,64),
    new THREE.MeshBasicMaterial({color:tint,transparent:true,opacity:inner?0.32:0.25,
      blending:THREE.AdditiveBlending,depthWrite:false}));
  ringGlow.rotation.x=Math.PI/2; ringGlow.position.y=ry; g.add(ringGlow);
  g.userData.ring=ringG;
  }

  // ── 尾燈：機尾（+Z）外殼內側、環燈下方，6 顆 LED 沿球面排成一小段弧（v3 11/17 老師回饋：原本藏在
  //    中央被環燈擋住、從後面看不到，反而從前面透過球框看得到；改到後方外緣、放大、加光暈）──
  const TY=ringPos==='frame'?-0.06:-0.135, TR=ringPos==='frame'?0.35:0.455;   // 11-17：兩排燈框時尾燈在燈框下排（v6 實機）
  const tailM=new THREE.MeshBasicMaterial({color:tail});
  for(let i=0;i<6;i++){ const a=(i-2.5)*0.085;
    const d=new THREE.Mesh(new THREE.BoxGeometry(0.04,0.034,0.02),tailM);
    d.position.set(Math.sin(a)*TR,TY,Math.cos(a)*TR); d.rotation.y=a; g.add(d); }
  const tailGlowM=o=>new THREE.MeshBasicMaterial({color:tail,map:glowTexture(),transparent:true,opacity:o,
      blending:THREE.AdditiveBlending,depthWrite:false});            // 單面：只有從後面看才有光暈；圓形漸層不會看到方框
  const tg1=new THREE.Mesh(new THREE.PlaneGeometry(0.40,0.16),tailGlowM(0.95)); tg1.position.set(0,TY,TR+0.012); g.add(tg1);
  const tg2=new THREE.Mesh(new THREE.PlaneGeometry(0.62,0.30),tailGlowM(0.35)); tg2.position.set(0,TY,TR+0.02); g.add(tg2);
  // （v3：機頭黃色小三角拿掉——老師 11/17：有尾燈就分得出前後）

  mergeStatic(g,props);                     // v3 效能：不會動的零件依材質合併，一顆球從約 50 個繪製呼叫降到 20 個左右
  if(scale&&scale!==1)g.scale.setScalar(scale);
  return g;
}

/* 每幀呼叫：槳的轉速跟「離地程度」連動（停在地上＝槳停）。
   k：0＝停地、1＝飛行中（由 theme.js settleOnGround 算好傳進來） */
export function spinCageProps(mesh,dt,k){
  const props=mesh&&mesh.userData.props; if(!props)return;
  for(const p of props){
    p.rotation.y+=p.userData.dir*dt*(k>0.02?28+12*k:0);
    p.userData.blade.visible=k<0.6;                         // 轉快了只看到殘影圓盤
    p.userData.blur.material.opacity=0.05+0.25*k;
  }
}

/* ── v3（2026-11-17）：學生自己的球機設定（pages/my-ball.html 選；證書也畫這顆）──
   存在 localStorage nd3.ball；網址 &ball=…&ring=… 可臨時覆蓋（老師示範用）。 */
export const CAGE_STYLES=[
  {code:'globe',  name:'地球儀', kind:'常見款'},
  {code:'soccer', name:'足球紋路', kind:'常見款'},
  {code:'honey',  name:'蜂巢細網', kind:'常見款'},
  {code:'clear',  name:'透明殼', kind:'常見款'},
  {code:'lantern',name:'燈籠款', kind:'NEWDRONE 原創'},
  {code:'zig',    name:'Z 紋桁架', kind:'NEWDRONE 原創'},
  {code:'spiral', name:'螺旋菱格', kind:'NEWDRONE 原創'},
  {code:'orbit',  name:'軌道環', kind:'NEWDRONE 原創'},
];
export const CAGE_COLORS=[
  {name:'霧銀',hex:0xdfe5ee},{name:'碳黑',hex:0x30343c},{name:'雪白',hex:0xf7f7f2},
  {name:'螢光黃',hex:0xe8ff3a},{name:'薄荷綠',hex:0x5fe0b8},{name:'紫羅蘭',hex:0x9d7bff},
  // 11-17 老師：加中正基本色調（校服藍／橘／青，照公開得獎照片估；白色跟原本「雪白」重複，不另加），原本 6 色也都保留。
  // clash＝跟哪一隊的環燈同色系（同色系＝環燈分不清楚，違反規定 → 只提醒不擋）
  {name:'校服藍',hex:0x58b4e6,zz:true,clash:'blue'},
  {name:'校服橘',hex:0xff6a1a,zz:true,clash:'red'},{name:'青',hex:0x16b3a4,zz:true},
];
/* 環燈位置（11-17 老師：全部開放自由選，不跟機型綁；標註對應哪台實機） */
export const RING_POS=[
  {code:'outer',name:'外圈',sub:'最明顯'},
  {code:'inner',name:'球內',sub:'從縫隙透光'},
  {code:'dome', name:'頂部燈罩',sub:'像 TC 200I、GT2'},
  {code:'waist',name:'腰帶燈',sub:'像 Balkin-S3'},
  {code:'frame',name:'兩排燈框',sub:'像 TC 200I 燈框'},
];
/* 燈籠款頂部（11-17 老師：三種都開放選） */
export const LANTERN_TOPS=[
  {code:'disc',name:'有圓盤',sub:'可以頂人'},
  {code:'fai', name:'FAI 版',sub:'頂部開口 ≤150 cm²'},
  {code:'kr',  name:'韓國版',sub:'頂部＋底部每格 <70 cm²'},
];
/* 其他款的規則版本（11-17）：一般／韓國版（底部加十字；足球紋路、蜂巢、軌道環頂部也加） */
export const KR_OPTS=[
  {code:'disc',name:'一般版',sub:'FAI 規則'},
  {code:'kr',  name:'韓國版',sub:'底部加十字，每格 <70 cm²'},
];
/* 撞色檢查：球框（燈籠是列印件）跟環燈同色系 → 回傳提醒文字；沒撞色回傳 null */
export function ballClash(b){
  const c=CAGE_COLORS[b.color]; if(!c||!c.clash||c.clash!==b.team) return null;
  return `${b.team==='blue'?'藍隊':'紅隊'}配「${c.name}」球框：環燈跟球框顏色太接近，裁判分不清楚——這樣違反規定（環燈必須清楚可辨），比賽請換顏色。`;
}
const BALL_KEY='nd3.ball';
export const BALL_DEFAULT={cage:'globe',ring:'outer',team:'blue',tail:0,color:0,top:'disc'};
export function ballPrefsGet(){
  let b={...BALL_DEFAULT};
  try{ const s=JSON.parse(localStorage.getItem(BALL_KEY)||'null');
    if(s&&typeof s==='object')b={...b,...s};
    else{ b=randomBall(); localStorage.setItem(BALL_KEY,JSON.stringify(b)); }   // 第一次：隨機發一顆，之後固定
  }catch{}
  try{ const q=new URLSearchParams(location.search);
    if(CAGE_STYLES.some(c=>c.code===q.get('ball')))b.cage=q.get('ball');
    if(RING_POS.some(r=>r.code===q.get('ring')))b.ring=q.get('ring');
    if(LANTERN_TOPS.some(t=>t.code===q.get('top')))b.top=q.get('top'); }catch{}
  if(!CAGE_STYLES.some(c=>c.code===b.cage))b.cage=BALL_DEFAULT.cage;
  if(!RING_POS.some(r=>r.code===b.ring))b.ring='outer';
  if(!LANTERN_TOPS.some(t=>t.code===b.top))b.top='disc';
  if(!TEAM_COLORS[b.team])b.team='blue';
  b.tail=Math.max(0,Math.min(TAIL_COLORS.length-1,b.tail|0));
  b.color=Math.max(0,Math.min(CAGE_COLORS.length-1,b.color|0));
  return b;
}
/* 新學生還沒選球機時隨機發一顆（老師 2026-11-17 指定：地球儀／燈籠款／螺旋菱格／足球紋路），
   球框顏色、隊伍、尾燈也隨機；環燈固定外圈（最明顯）。 */
export const BALL_STARTERS=['globe','lantern','spiral','soccer'];
export function randomBall(){
  const r=n=>Math.floor(Math.random()*n);
  const team=r(2)?'red':'blue';
  let color; do{ color=r(CAGE_COLORS.length); }while(CAGE_COLORS[color].clash===team);   // 11-17：不隨機發到撞色（違規）的組合
  return {cage:BALL_STARTERS[r(BALL_STARTERS.length)],ring:'outer',team,color,
          tail:(()=>{ const ok=TAIL_COLORS.map((c,i)=>c.warn?-1:i).filter(i=>i>=0); return ok[r(ok.length)]; })(),   // 不發 ⚠ 慎用色
  };
}
export function ballPrefsSet(b){ try{ localStorage.setItem(BALL_KEY,JSON.stringify(b)); }catch{} }
/* 設定 → buildSoccerCage 參數 */
export function ballBuildOpts(b=ballPrefsGet()){
  const o={cage:b.cage,ring:b.ring,team:b.team,tail:TAIL_COLORS[b.tail].hex,cageColor:CAGE_COLORS[b.color].hex,top:b.top||'disc'};
  if(b.cage==='lantern'&&b.color>0)o.printColor=o.cageColor;     // 燈籠款：棒子固定碳纖黑，顏色換在列印件上（預設霧銀＝原本的橘色列印件）
  return o;
}
