/* newdrone 無人機飛行模擬器 © 2026 何政學（新北市立中正國民中學）｜授權 CC BY-NC-SA 4.0（姓名標示─非商業性─相同方式分享），見 LICENSE.md；請保留本聲明 */
/* ============================================================
   race-venue.js — 改裝賽道的「場地」（2026-11-28，老師：改裝賽道的場地）
   ------------------------------------------------------------
   老師選的四件事：
   ① 每條賽道有自己的地面：操場＝紅色跑道＋草皮、森林＝泥土小徑、城市＝柏油馬路＋斑馬線、體育館＝木地板（在賽道檔 decorate 裡）、霓虹＝原本的
   ② 操場入門要像真的操場：跑道、草皮場線、司令台、看台、夜間照明燈柱
   ③ PIT 進站區和起點重做：起終點拱門（黑白格旗幟＋START）＋地上黑白格線；PIT＝方形停機坪＋⚡充電圖示＋遮雨棚與看板
   ④ 場地範圍看得出來：照物理邊界（±bounds.x × ±bounds.z，原本主題格線是正方形、跟 z 邊界對不上）畫圍網、發光頂欄、地上邊界線、四角高度標
   主題（霓虹夜航／黃昏賽博）關閉時：只做 ③④，地面照 v2 原樣。
   ============================================================ */
import * as THREE from 'three';
import { look } from './race-look.js';

const canvasTex=(w,h,draw,rep)=>{ const c=document.createElement('canvas'); c.width=w; c.height=h; draw(c.getContext('2d'),w,h);
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=4; if(rep){ t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(...rep); } return t; };
const hex=n=>'#'+n.toString(16).padStart(6,'0');
const flat=(w,d,mat,y)=>{ const m=new THREE.Mesh(new THREE.PlaneGeometry(w,d),mat); m.rotation.x=-Math.PI/2; m.position.y=y; m.receiveShadow=true; return m; };

/* 主題場地的格線／方形邊框／中央起降區先藏起來（賽道自己畫地面和真正的邊界） */
function hideThemeField(scene){
  const f=scene.getObjectByName('field'); if(!f)return;
  f.traverse(o=>{ if(/^th-(field|grid|edge|pad|north)$/.test(o.name))o.visible=false; });
}

/* ④ 邊界：圍網＋發光頂欄＋地上邊界線＋四角高度標（高度＝bounds.y） */
function boundary(root,T,L){
  const BX=T.bounds.x, BZ=T.bounds.z, H=T.bounds.y||10, edge=L?L.edge:0xfacc15;
  const lineM=new THREE.MeshBasicMaterial({color:edge});
  for(const [x,z,w,d] of [[0,-BZ,BX*2,0.14],[0,BZ,BX*2,0.14],[-BX,0,0.14,BZ*2],[BX,0,0.14,BZ*2]]){
    const e=new THREE.Mesh(new THREE.BoxGeometry(w,0.04,d),lineM); e.position.set(x,0.045,z); root.add(e); }
  const NET=Math.min(2.4,H*0.35), postM=new THREE.MeshStandardMaterial({color:L?0x2a3550:0x8a8f98,metalness:0.5,roughness:0.5});
  const netM=new THREE.MeshBasicMaterial({color:edge,transparent:true,opacity:0.07,side:THREE.DoubleSide,depthWrite:false});
  const railM=new THREE.MeshBasicMaterial({color:edge,transparent:true,opacity:0.8});
  const side=(ax,az,bx,bz)=>{ const len=Math.hypot(bx-ax,bz-az), cx=(ax+bx)/2, cz=(az+bz)/2, ang=Math.atan2(bx-ax,bz-az);
    const net=new THREE.Mesh(new THREE.PlaneGeometry(len,NET),netM); net.position.set(cx,NET/2,cz); net.rotation.y=ang+Math.PI/2; root.add(net);
    const rail=new THREE.Mesh(new THREE.BoxGeometry(0.06,0.06,len),railM); rail.position.set(cx,NET,cz); rail.rotation.y=ang; root.add(rail);
    const n=Math.max(2,Math.round(len/4));
    for(let i=0;i<=n;i++){ const t=i/n, p=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,NET,6),postM); p.position.set(ax+(bx-ax)*t,NET/2,az+(bz-az)*t); root.add(p); } };
  side(-BX,-BZ,BX,-BZ); side(BX,-BZ,BX,BZ); side(BX,BZ,-BX,BZ); side(-BX,BZ,-BX,-BZ);
  // 四角高度標：細柱到飛行高度上限，頂端一個小方塊
  const capM=new THREE.MeshBasicMaterial({color:edge});
  for(const [x,z] of [[-BX,-BZ],[BX,-BZ],[BX,BZ],[-BX,BZ]]){
    const c=new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.04,H,6),new THREE.MeshBasicMaterial({color:edge,transparent:true,opacity:0.35}));
    c.position.set(x,H/2,z); root.add(c);
    const cap=new THREE.Mesh(new THREE.BoxGeometry(0.3,0.08,0.3),capM); cap.position.set(x,H,z); root.add(cap); }
}

/* ③ 起終點：拱門（黑白格旗幟＋START／FINISH）＋地上黑白格線 */
function startGate(root,ring0,R,L){
  const yaw=ring0.rotation.y, sx=Math.cos(yaw), sz=-Math.sin(yaw), x0=ring0.position.x, z0=ring0.position.z, top=ring0.position.y+R+0.5;
  const g=new THREE.Group(); root.add(g);
  const colM=new THREE.MeshStandardMaterial({color:L?0x1f2c4a:0xe5e7eb,metalness:0.4,roughness:0.4});
  for(const s of [-1,1]){ const c=new THREE.Mesh(new THREE.BoxGeometry(0.32,top,0.32),colM); c.position.set(x0+sx*s*(R+0.3),top/2,z0+sz*s*(R+0.3)); g.add(c);
    if(L){ const st=new THREE.Mesh(new THREE.BoxGeometry(0.05,top,0.34),new THREE.MeshBasicMaterial({color:L.edge})); st.position.copy(c.position); st.rotation.y=yaw; g.add(st); } }
  const ban=canvasTex(512,96,(x,w,h)=>{ const s=16; for(let i=0;i<w/s;i++)for(let j=0;j<h/s;j++){ x.fillStyle=(i+j)%2?'#111':'#f5f5f5'; x.fillRect(i*s,j*s,s,s); }
    x.fillStyle='rgba(10,20,40,.88)'; x.fillRect(w*0.2,10,w*0.6,h-20); x.fillStyle=L?hex(L.edge):'#facc15'; x.font='bold 54px system-ui,sans-serif'; x.textAlign='center'; x.textBaseline='middle'; x.fillText('START ▸ FINISH',w/2,h/2+2); });
  const banner=new THREE.Mesh(new THREE.BoxGeometry((R+0.3)*2+0.4,0.75,0.12),[colM,colM,colM,colM,new THREE.MeshBasicMaterial({map:ban}),new THREE.MeshBasicMaterial({map:ban})]);
  banner.position.set(x0,top+0.2,z0); banner.rotation.y=yaw+Math.PI/2; g.add(banner);
  // 地上黑白格線（跨在起點環正下方，垂直於飛行方向）
  const chk=canvasTex(256,32,(x,w,h)=>{ const s=16; for(let i=0;i<w/s;i++)for(let j=0;j<h/s;j++){ x.fillStyle=(i+j)%2?'#111':'#eee'; x.fillRect(i*s,j*s,s,s); } });
  const line=new THREE.Mesh(new THREE.PlaneGeometry((R+0.3)*2,0.5),new THREE.MeshBasicMaterial({map:chk}));
  line.rotation.x=-Math.PI/2; line.rotation.z=yaw+Math.PI/2; line.position.set(x0,0.05,z0); g.add(line);
}

/* ③ PIT：方形停機坪（⚡＋PIT 畫在地上）＋遮雨棚＋看板。判定照舊：中心 2 m 內、貼地、慢下來 */
function pitArea(root,PIT,yaw,L){
  const acc=L?L.acc2??0xffc85c:0xfacc15, g=new THREE.Group(); g.position.copy(PIT); g.position.y=0; root.add(g);
  const padT=canvasTex(256,256,(x,w,h)=>{ x.fillStyle=L?'#13213d':'#3a3f47'; x.fillRect(0,0,w,h);
    x.strokeStyle=hex(acc); x.lineWidth=10; x.strokeRect(14,14,w-28,h-28);
    x.setLineDash([18,14]); x.lineWidth=4; x.strokeRect(34,34,w-68,h-68); x.setLineDash([]);
    x.fillStyle=hex(acc); x.font='bold 64px system-ui,sans-serif'; x.textAlign='center'; x.textBaseline='middle'; x.fillText('⚡PIT',w/2,h/2-8);
    x.font='bold 26px system-ui,sans-serif'; x.fillText('降落停 3 秒換電池',w/2,h/2+46); });
  const pad=flat(4,4,new THREE.MeshStandardMaterial({map:padT,roughness:0.6}),0.04); pad.rotation.z=yaw; g.add(pad);
  // 遮雨棚：四根細柱＋薄頂（在停機坪後方，不擋降落）
  const back={x:Math.sin(yaw),z:Math.cos(yaw)}, side={x:Math.cos(yaw),z:-Math.sin(yaw)};
  const postM=new THREE.MeshStandardMaterial({color:L?0x2a3550:0x9ca3af,metalness:0.5});
  const roofC=new THREE.Vector3(-back.x*2.9,2.6,-back.z*2.9);
  for(const [a,b] of [[-1,-0.6],[1,-0.6],[-1,0.6],[1,0.6]]){ const p=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,2.6,6),postM);
    p.position.set(roofC.x+side.x*a*1.6+back.x*b,1.3,roofC.z+side.z*a*1.6+back.z*b); g.add(p); }
  const roof=new THREE.Mesh(new THREE.BoxGeometry(3.6,0.08,1.6),new THREE.MeshStandardMaterial({color:L?0x1b2a4a:0xe5e7eb})); roof.position.copy(roofC); roof.rotation.y=yaw; g.add(roof);
  const edge=new THREE.Mesh(new THREE.BoxGeometry(3.62,0.05,0.05),new THREE.MeshBasicMaterial({color:acc})); edge.position.set(roofC.x+back.x*0.8,2.55,roofC.z+back.z*0.8); edge.rotation.y=yaw; g.add(edge);
  const signT=canvasTex(256,64,(x,w,h)=>{ x.fillStyle='rgba(10,20,40,.92)'; x.fillRect(0,0,w,h); x.fillStyle=hex(acc); x.font='bold 36px system-ui,sans-serif'; x.textAlign='center'; x.textBaseline='middle'; x.fillText('PIT 換電池',w/2,h/2+2); });
  // 雙面招牌：兩片背對背，背面文字才不會左右顛倒
  const sign=new THREE.Group(); const sGeo=new THREE.PlaneGeometry(2.2,0.55), sMat=new THREE.MeshBasicMaterial({map:signT});
  const sf=new THREE.Mesh(sGeo,sMat); sf.position.z=0.01; sign.add(sf);
  const sb=new THREE.Mesh(sGeo,sMat); sb.rotation.y=Math.PI; sb.position.z=-0.01; sign.add(sb);
  sign.position.set(roofC.x+back.x*0.81,2.25,roofC.z+back.z*0.81); sign.rotation.y=yaw; g.add(sign);
  // 電池櫃
  const box=new THREE.Mesh(new THREE.BoxGeometry(0.9,0.8,0.5),new THREE.MeshStandardMaterial({color:L?0x22314f:0x6b7280})); box.position.set(roofC.x-side.x*1.0,0.4,roofC.z-side.z*1.0); box.rotation.y=yaw; g.add(box);
  const led=new THREE.Mesh(new THREE.BoxGeometry(0.5,0.08,0.02),new THREE.MeshBasicMaterial({color:0x4ade80})); led.position.set(box.position.x+back.x*0.26,0.6,box.position.z+back.z*0.26); led.rotation.y=yaw; g.add(led);
}

/* ② 操場：紅色跑道（橢圓，配合環的位置）＋草皮場線＋司令台＋看台＋燈柱（放在飛行範圍外，不會撞） */
function playground(root,T,L){
  const BX=T.bounds.x, BZ=T.bounds.z;
  root.add(flat(BX*2+10,BZ*2+10,new THREE.MeshStandardMaterial({color:L?0x2a2f3a:0x8b8f96,roughness:0.95}),0.02));
  const A=19, B=12, W=3.2;
  const ell=(a,b,n=96)=>{ const s=new THREE.Shape(); for(let i=0;i<=n;i++){ const t=i/n*Math.PI*2; const x=a*Math.sin(t), y=b*Math.cos(t); i?s.lineTo(x,y):s.moveTo(x,y); } return s; };
  const trackS=ell(A+W/2+0.6,B+W/2+0.6); trackS.holes.push(ell(A-W/2,B-W/2));
  const track=new THREE.Mesh(new THREE.ShapeGeometry(trackS,96),new THREE.MeshStandardMaterial({color:L?0x9a3b2c:0xb5523b,roughness:0.9}));
  track.rotation.x=-Math.PI/2; track.position.y=0.03; root.add(track);
  const turf=new THREE.Mesh(new THREE.ShapeGeometry(ell(A-W/2,B-W/2),96),new THREE.MeshStandardMaterial({color:L?0x1d5a3a:0x3f8f4a,roughness:0.95}));
  turf.rotation.x=-Math.PI/2; turf.position.y=0.031; root.add(turf);
  // 跑道分道線
  const laneM=new THREE.LineBasicMaterial({color:0xf1f1f1,transparent:true,opacity:0.75});
  for(let k=0;k<=4;k++){ const a=A-W/2+k*(W+0.6)/4, b=B-W/2+k*(W+0.6)/4, pts=[];
    for(let i=0;i<=120;i++){ const t=i/120*Math.PI*2; pts.push(new THREE.Vector3(a*Math.sin(t),0.045,b*Math.cos(t))); }
    root.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),laneM)); }
  // 草皮場線（中線、中圈、禁區）
  const wl=(pts)=>root.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts.map(([x,z])=>new THREE.Vector3(x,0.05,z))),laneM));
  wl([[0,-(B-W/2)+0.4],[0,B-W/2-0.4]]);
  { const p=[]; for(let i=0;i<=48;i++){ const t=i/48*Math.PI*2; p.push([2.2*Math.sin(t),2.2*Math.cos(t)]); } wl(p); }
  for(const s of [-1,1]){ const x0=s*(A-W/2-0.6), x1=s*(A-W/2-4.2); wl([[x0,-4],[x1,-4],[x1,4],[x0,4]]); }
  // 司令台（z 負方向、飛行範圍外）
  const stand=new THREE.Group(); stand.position.set(0,0,-(BZ+3.4)); root.add(stand);
  const wallC=L?0x1f2c4a:0xd6d3cc, roofC=L?0x2a3a60:0x7c2d12;
  const base=new THREE.Mesh(new THREE.BoxGeometry(9,1.4,4),new THREE.MeshStandardMaterial({color:wallC})); base.position.y=0.7; stand.add(base);
  for(const x of [-4,4]){ const p=new THREE.Mesh(new THREE.BoxGeometry(0.3,3.2,0.3),new THREE.MeshStandardMaterial({color:wallC})); p.position.set(x,3,1.6); stand.add(p); }
  const roof=new THREE.Mesh(new THREE.BoxGeometry(10,0.3,5),new THREE.MeshStandardMaterial({color:roofC})); roof.position.y=4.6; roof.rotation.x=-0.08; stand.add(roof);
  const sT=canvasTex(512,96,(x,w,h)=>{ x.fillStyle=L?'#0b1b33':'#1e3a8a'; x.fillRect(0,0,w,h); x.fillStyle=L?hex(L.edge):'#fff'; x.font='bold 56px system-ui,sans-serif'; x.textAlign='center'; x.textBaseline='middle'; x.fillText('司 令 台',w/2,h/2+2); });
  const sg=new THREE.Mesh(new THREE.PlaneGeometry(4.5,0.85),new THREE.MeshBasicMaterial({map:sT})); sg.position.set(0,1.0,2.02); stand.add(sg);
  // 看台（z 正方向、飛行範圍外）
  const seats=new THREE.Group(); seats.position.set(4,0,BZ+3.2); root.add(seats);
  for(let k=0;k<4;k++){ const st=new THREE.Mesh(new THREE.BoxGeometry(14,0.45,1),new THREE.MeshStandardMaterial({color:k%2?(L?0x26355a:0x9ca3af):(L?0x1d2a48:0x6b7280)})); st.position.set(0,0.25+k*0.45,k*0.9); seats.add(st); }
  // 夜間照明燈柱（四角外側）
  for(const [x,z] of [[-BX-2,-BZ-2],[BX+2,-BZ-2],[BX+2,BZ+2],[-BX-2,BZ+2]]){
    const p=new THREE.Mesh(new THREE.CylinderGeometry(0.15,0.2,11,8),new THREE.MeshStandardMaterial({color:L?0x2a3550:0x9ca3af})); p.position.set(x,5.5,z); root.add(p);
    const head=new THREE.Mesh(new THREE.BoxGeometry(1.6,0.6,0.3),new THREE.MeshBasicMaterial({color:0xfff6d8})); head.position.set(x,11,z); head.lookAt(0,0,0); root.add(head);
    /* 2026-11-28 老師：對戰 lag → 拿掉 4 盞 SpotLight（每盞會讓整個場景每個像素多算一次光，分割畫面更重）；燈頭仍是亮白色 */ }
}

/* ① 城市：柏油地面＋街道虛線＋人行道（每棟大樓周圍）＋幾處斑馬線 */
function city(root,T,L){
  const BX=T.bounds.x, BZ=T.bounds.z;
  root.add(flat(BX*2+6,BZ*2+6,new THREE.MeshStandardMaterial({color:0x1a1f2b,roughness:0.9}),0.025));
  const dashM=new THREE.MeshBasicMaterial({color:0xf2c14e,transparent:true,opacity:0.8});
  for(const x of [-24,-16,-8,0,8,16,24])for(let z=-BZ+1;z<BZ-1;z+=3){ const d=flat(0.15,1.4,dashM,0.04); d.position.x=x; d.position.z=z; root.add(d); }
  for(const z of [-16,-8,0,8,16])for(let x=-BX+1;x<BX-1;x+=3){ const d=flat(1.4,0.15,dashM,0.04); d.position.x=x; d.position.z=z; root.add(d); }
  const zebM=new THREE.MeshBasicMaterial({color:0xe9ecef,transparent:true,opacity:0.75});
  for(const [cx,cz] of [[0,0],[-16,8],[16,-8],[8,16],[-8,-16]])for(let i=-2;i<=2;i++){ const z=flat(0.45,2.4,zebM,0.045); z.position.set(cx+i*0.8,0.045,cz+3); root.add(z); }
  for(const b of (T.boxes||[])){ if(b.y0)continue; const s=flat(b.w+1.6,b.d+1.6,new THREE.MeshStandardMaterial({color:0x2c3445,roughness:0.85}),0.035); s.position.x=b.x; s.position.z=b.z; root.add(s); }
}

/* ① 森林：沿著環的位置鋪一條泥土小徑 */
function forestTrail(root,T){
  const pts=T.rings.map(r=>new THREE.Vector3(r.p.x,0,r.p.z)), cv=new THREE.CatmullRomCurve3(pts,true), P=cv.getSpacedPoints(240);
  const pos=[], idx=[]; const W=1.6;
  P.forEach((p,i)=>{ const q=P[(i+1)%P.length], d=q.clone().sub(p).setY(0).normalize(), n=new THREE.Vector3(-d.z,0,d.x);
    pos.push(p.x+n.x*W,0.04,p.z+n.z*W, p.x-n.x*W,0.04,p.z-n.z*W); if(i<P.length-1){ const a=i*2; idx.push(a,a+1,a+2, a+1,a+3,a+2); } });
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); g.setIndex(idx); g.computeVertexNormals();
  root.add(new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:0x3d2e22,roughness:1,side:THREE.DoubleSide})));
}

export function buildVenue(scene,T,{ring0,ringR,pit,pitYaw}){
  const L=look(), root=new THREE.Group(); root.name='race-venue'; scene.add(root);
  const kind=T.venue||T.levelId.replace(/^race-/,'');
  if(L){ hideThemeField(scene);
    if(kind==='playground')playground(root,T,L);
    else if(kind==='city')city(root,T,L);
    else if(kind==='forest')forestTrail(root,T);
    else if(kind==='neon'){ /* 霓虹賽道本身就有自己的地面與格線 */ }
  }else if(kind==='playground')playground(root,T,null);
  boundary(root,T,L);
  startGate(root,ring0,ringR,L);
  pitArea(root,pit,pitYaw,L);
  return root;
}
