/* newdrone 無人機飛行模擬器 © 2026 何政學（新北市立中正國民中學）｜授權 CC BY-NC-SA 4.0（姓名標示─非商業性─相同方式分享），見 LICENSE.md；請保留本聲明 */
/* ============================================================
   campus-model.js — 中正國中校園「外型」模型（2026-11-28，職業線第五天：校慶空拍）
   ------------------------------------------------------------
   來源：老師的「中正國中 3D 校園導覽」CAMPUS 3D v1.46 外賓版的校舍位置、外形與樓層數
   （BUILDINGS 的空拍圖像素座標、弧形 bow、深度 d；S=0.18 公尺／像素）。
   老師同意：只用建築外型——不放教室名稱、不放內部、不放導航點。
   座標：x＝東西（東為 +），z＝南北（南為 +，正門在南），單位公尺；跟導覽網頁同一套。
   回傳 obbs（每棟沿長邊切成約 3 m 的旋轉方塊）給關卡做碰撞。
   ============================================================ */
import * as THREE from 'three';

const S=0.18, OX=808, OY=520, FH=3.4, LIFT=1.2;
export const CAMPUS_P=(px,py)=>[(px-OX)*S,(py-OY)*S];
const P=CAMPUS_P;
// 校舍（外型）：top＝屋頂在第幾層上面（導覽網頁的 roof||最高樓層）
const BUILDINGS=[
 {name:'行政大樓',color:0xb8935a,bow:1.5,a:[587,474],b:[943,461],d:12,top:3},
 {name:'中央廊',color:0xb8935a,a:[765,422],b:[770,307],d:8,top:2,noLabel:true},
 {name:'和平樓',color:0xe85a9b,bow:2,a:[324,734],b:[447,539],d:10,top:5},
 {name:'信義樓',color:0xf29a3d,bow:3,a:[422,518],b:[650,386],d:10,top:5},
 {name:'力行樓',color:0x4f86c6,bow:4,a:[600,316],b:[945,287],d:10,top:5},
 {name:'仁愛樓',color:0x4db8e8,bow:3,a:[894,364],b:[1144,453],d:10,top:5},
 {name:'忠孝樓',color:0x8cc65a,bow:2,a:[1124,478],b:[1279,648],d:10,top:5},
 {name:'至善樓',color:0x58bcc4,a:[378,304],b:[647,229],d:10,top:3},
 {name:'德馨樓',color:0xf2c200,a:[894,196],b:[1125,183],d:11,top:4},
 {name:'至美樓',color:0x9a55b5,a:[1140,188],b:[1228,238],d:9,top:5,noLabel:true},
 {name:'至美樓',color:0x9a55b5,a:[1222,258],b:[1150,438],d:9,top:5},
 {name:'至真樓',color:0xd9708a,a:[1250,230],b:[1402,236],d:9,top:5,noLabel:true},
 {name:'至真樓',color:0xd9708a,a:[1391,272],b:[1322,628],d:9,top:5},
];
const CAMPUS_POLY=[[205,215],[345,190],[350,135],[480,130],[485,190],[830,140],[1250,75],[1520,70],[1545,110],[1500,330],[1390,480],[1375,800],[1350,830],[960,860],[880,790],[740,790],[700,920],[250,975],[215,920],[135,890],[225,640],[215,400]];
const TREES=[[520,862],[580,866],[640,866],[700,860],[980,812],[1050,806],[1120,800],[1190,795],[1260,790],[1320,780],
 [700,362],[840,356],[690,522],[882,516],[510,600],[498,690],[1035,600],[1190,330],[1262,400],[1242,470],[300,330],[312,420],[1000,250],[760,200]];

function arcOf(b){
  const [ax,az]=P(...b.a), [bx,bz]=P(...b.b), ch=Math.hypot(bx-ax,bz-az), ux=(bx-ax)/ch, uz=(bz-az)/ch, phi=Math.atan2(bz-az,bx-ax);
  if(b.bow){ let nx=-uz, nz=ux; const mx=(ax+bx)/2, mz=(az+bz)/2;
    if(nx*(mx+0.5)+nz*(mz-25.2)<0){ nx=-nx; nz=-nz; }
    const R=(ch*ch/4+b.bow*b.bow)/(2*b.bow), th=Math.asin(ch/(2*R)), ox=mx-nx*(R-b.bow), oz=mz-nz*(R-b.bow);
    return {len:2*R*th, at:t=>{ const al=-th+t/R, sn=Math.sin(al), cs=Math.cos(al); return [ox+R*(sn*ux+cs*nx), oz+R*(sn*uz+cs*nz), Math.atan2(cs*uz-sn*nz, cs*ux-sn*nx)]; }};
  }
  return {len:ch, at:t=>[ax+ux*t, az+uz*t, phi]};
}
function flat(scene,pts,color,y){
  const sh=new THREE.Shape(); pts.forEach((p,i)=>{ const [x,z]=P(p[0],p[1]); i?sh.lineTo(x,-z):sh.moveTo(x,-z); });
  const g=new THREE.ShapeGeometry(sh); g.rotateX(-Math.PI/2);
  const m=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color,roughness:1})); m.position.y=y; m.receiveShadow=true; scene.add(m); return m;
}
function nameTag(text){
  const c=document.createElement('canvas'); c.width=256; c.height=64; const g=c.getContext('2d');
  g.fillStyle='rgba(10,18,32,.85)'; g.fillRect(0,0,256,64); g.fillStyle='#ffffff';
  g.font='bold 34px system-ui,sans-serif'; g.textAlign='center'; g.textBaseline='middle'; g.fillText(text,128,34);
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace;
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:t,depthWrite:false})); sp.scale.set(8,2,1); return sp;
}

/* 建立校園：回傳 {group, obbs, spots, bounds} */
export function buildCampus(){
  const root=new THREE.Group(); root.name='campus';
  const obbs=[];
  // 地面：街道、校地、籃球場（四面球場）
  const street=new THREE.Mesh(new THREE.PlaneGeometry(600,600),new THREE.MeshStandardMaterial({color:0x6f777a,roughness:1}));
  street.rotation.x=-Math.PI/2; street.position.y=-0.05; root.add(street);
  flat(root,CAMPUS_POLY,0x8fb86a,0);
  flat(root,[[480,525],[1040,525],[1040,785],[480,785]],0xc98f7c,0.03);
  [[538,630,582,768],[634,725,582,768],[778,875,550,742],[879,975,550,742]].forEach(r=>flat(root,[[r[0],r[2]],[r[1],r[2]],[r[1],r[3]],[r[0],r[3]]],0x3d9a62,0.06));
  // 校舍：沿弧線每 ~3 m 一段（外牆＋屋頂），段落同時當碰撞方塊
  const labels=[];
  BUILDINGS.forEach(b=>{
    const A=arcOf(b), H=b.top*FH+LIFT, n=Math.max(1,Math.round(A.len/3)), seg=A.len/n;
    const wall=new THREE.MeshStandardMaterial({color:new THREE.Color(0xe6e0d4).lerp(new THREE.Color(b.color),0.35),roughness:0.85});
    const roofC=new THREE.Color(b.color); const hsl={}; roofC.getHSL(hsl); roofC.setHSL(hsl.h,hsl.s*0.55,Math.min(0.62,hsl.l*0.85+0.08));
    const roof=new THREE.MeshStandardMaterial({color:roofC,roughness:0.9});
    for(let i=0;i<n;i++){ const t=(i+0.5)*seg, [x,z,phi]=A.at(t);
      const m=new THREE.Mesh(new THREE.BoxGeometry(seg+0.06,H,b.d),wall); m.position.set(x,H/2,z); m.rotation.y=-phi; m.castShadow=m.receiveShadow=true; root.add(m);
      const r=new THREE.Mesh(new THREE.BoxGeometry(seg+0.3,0.3,b.d+0.6),roof); r.position.set(x,H+0.15,z); r.rotation.y=-phi; root.add(r);
      // 樓層線（看得出幾層樓）：每層一條淺色帶
      for(let L=1;L<b.top;L++){ const s=new THREE.Mesh(new THREE.BoxGeometry(seg+0.08,0.14,b.d+0.08),new THREE.MeshStandardMaterial({color:0xf4f1ea,roughness:1}));
        s.position.set(x,L*FH+LIFT,z); s.rotation.y=-phi; root.add(s); }
      obbs.push({x,z,phi,hx:seg/2+0.03,hz:b.d/2,y0:0,y1:H+0.3,name:b.name}); }
    if(!b.noLabel){ const [x,z]=A.at(A.len/2), tg=nameTag(b.name); tg.position.set(x,H+3,z); root.add(tg); labels.push(tg); }
  });
  // 行政大樓兩端圓柱塔樓
  { const A=arcOf(BUILDINGS[0]), H=3*FH+LIFT+0.5;
    [2.2,A.len-2.2].forEach(t=>{ const [x,z,phi]=A.at(t); let nx=-Math.sin(phi), nz=Math.cos(phi); if(nx*(-0.5-x)+nz*(25.2-z)<0){ nx=-nx; nz=-nz; }
      const cx=x+nx*4.8, cz=z+nz*4.8, m=new THREE.Mesh(new THREE.CylinderGeometry(2.7,2.7,H,24),new THREE.MeshStandardMaterial({color:0xd8d6d1}));
      m.position.set(cx,H/2,cz); root.add(m); obbs.push({x:cx,z:cz,phi:0,hx:2.7,hz:2.7,y0:0,y1:H,name:'行政大樓'}); }); }
  // 司令台
  { const [x,z]=P(764,497); const m=new THREE.Mesh(new THREE.BoxGeometry(68*S,LIFT,24*S),new THREE.MeshStandardMaterial({color:0xe9e4d8})); m.position.set(x,LIFT/2,z); root.add(m);
    const rf=new THREE.Mesh(new THREE.BoxGeometry(68*S,0.3,26*S),new THREE.MeshStandardMaterial({color:0xd6d4cf})); rf.position.set(x,FH-0.2+LIFT,z); root.add(rf);
    obbs.push({x,z,phi:0,hx:68*S/2,hz:13*S,y0:0,y1:FH+LIFT,name:'司令台'}); }
  // 風雨操場：柱子＋屋頂（四周開放，可以從下面飛進去）
  { const cx=1340, cy=135, W=340, D=100, H=FH*3, col=new THREE.MeshStandardMaterial({color:0xb7bfc2});
    flat(root,[[cx-W/2,cy-D/2],[cx+W/2,cy-D/2],[cx+W/2,cy+D/2],[cx-W/2,cy+D/2]],0xc98f7c,0.05);
    for(let i=0;i<=8;i++)[-1,1].forEach(sd=>{ const [x,z]=P(cx-W/2+W*i/8,cy+sd*(D/2-2)); const m=new THREE.Mesh(new THREE.BoxGeometry(0.6,H,0.6),col); m.position.set(x,H/2,z); root.add(m); obbs.push({x,z,phi:0,hx:0.3,hz:0.3,y0:0,y1:H,name:'風雨操場柱子'}); });
    const [rx,rz]=P(cx,cy), r=new THREE.Mesh(new THREE.BoxGeometry(W*S+2,0.3,D*S+2),new THREE.MeshStandardMaterial({color:0x9aa3a6,side:THREE.DoubleSide}));
    r.position.set(rx,H+0.6,rz); root.add(r); obbs.push({x:rx,z:rz,phi:0,hx:W*S/2+1,hz:D*S/2+1,y0:H+0.45,y1:H+0.75,name:'風雨操場屋頂'});
    const tg=nameTag('風雨操場'); tg.position.set(rx,H+3.5,rz); root.add(tg); }
  // 正門：四根柱子＋雨庇（校名牌不做，維持外型）
  const [gx,gz]=P(765,792), GW=90*S;
  { const m=new THREE.MeshStandardMaterial({color:0xefece4}), blue=new THREE.MeshStandardMaterial({color:0x6f9fd2});
    [-0.42,-0.17,0.17,0.42].forEach(k=>{ const c=new THREE.Mesh(new THREE.CylinderGeometry(0.62,0.62,5.4,16),m); c.position.set(gx+k*GW,2.7,gz-1.6); root.add(c); obbs.push({x:gx+k*GW,z:gz-1.6,phi:0,hx:0.62,hz:0.62,y0:0,y1:5.4,name:'正門'}); });
    const roofG=new THREE.Mesh(new THREE.BoxGeometry(GW*1.08,1.05,7.2),blue); roofG.position.set(gx,5.4+0.52,gz-1.6); root.add(roofG);
    obbs.push({x:gx,z:gz-1.6,phi:0,hx:GW*0.54,hz:3.6,y0:5.4,y1:6.5,name:'正門'});
    const tg=nameTag('正門'); tg.position.set(gx,9,gz-1.6); root.add(tg); }
  // 樹
  { const trunk=new THREE.MeshStandardMaterial({color:0x7a5a3c}), leaf=new THREE.MeshStandardMaterial({color:0x4f8f4a,flatShading:true});
    TREES.forEach(([px,py],i)=>{ const [x,z]=P(px,py), k=0.85+((i*37)%10)/25;
      const t=new THREE.Mesh(new THREE.CylinderGeometry(0.3,0.42,3.6*k,6),trunk); t.position.set(x,1.8*k,z); root.add(t);
      const c=new THREE.Mesh(new THREE.IcosahedronGeometry(3*k,0),leaf); c.position.set(x,5.6*k,z); root.add(c);
      obbs.push({x,z,phi:0,hx:2.3*k,hz:2.3*k,y0:3.2*k,y1:8*k,name:'樹'}); obbs.push({x,z,phi:0,hx:0.4,hz:0.4,y0:0,y1:3.6*k,name:'樹'}); }); }
  // 光照（主題關閉時場地本身就有；這裡補一點讓校舍白天看得清楚）
  root.add(new THREE.HemisphereLight(0xdcecff,0x7f8f68,0.5));
  const spots={
    center:new THREE.Vector3(...[P(808,480)].map(p=>[p[0],0,p[1]])[0]),
    court:new THREE.Vector3(P(758,655)[0],0,P(758,655)[1]),
    gate:new THREE.Vector3(gx,3,gz-1.6),
    stage:new THREE.Vector3(P(764,497)[0],0,P(764,497)[1]),
  };
  return {group:root,obbs,spots,labels,bounds:{x:120,z:85,y:45}};
}
