/* newdrone 無人機飛行模擬器 © 2026 何政學（新北市立中正國民中學）｜授權 CC BY-NC-SA 4.0（姓名標示─非商業性─相同方式分享），見 LICENSE.md；請保留本聲明 */
/* ============================================================
   theme.js — 場景外觀主題（2026-11-17 新增，樣板關試做中）
   ------------------------------------------------------------
   · 新增不修改：world.js 的 buildBasicField() 完全沒動；關卡要用主題時
     改呼叫 buildThemedField()，物件組成（地面、格線、邊界柱、圍線、
     北方標記）與尺寸、座標都跟 buildBasicField 一致，只換外觀，
     碰撞與小地圖都不受影響。
   · v3（2026-11-17）起：world.js 的 buildBasicField() 直接改用這裡（新外觀＝預設）。
     首頁可切換霓虹夜航／黃昏賽博（存 nd3.theme）；網址 ?theme=off 回到 v2 原本場地。
   · 不用後製特效（bloom 等）：舊電腦／Chromebook 不會變卡，VR 也不會壞。
     「發光感」全部靠 MeshBasic＋Additive 疊色與霧。
   · 物件都掛在同一個 root Group，卸載照舊由 engine.disposeScene() 處理。
   ============================================================ */
import * as THREE from 'three';
import { spinCageProps } from './drone-soccer-cage.js';

export const THEMES={
  neon:{
    label:'霓虹夜航',
    sky:{top:0x03061a, mid:0x0d1446, horizon:0x3a1a6e, glow:0x19e6ff},
    fog:{color:0x1a1650, near:45, far:200},
    hemi:[0x6f7cff, 0x08061c, 0.75], sun:{color:0xbcd2ff, intensity:1.6, pos:[14,30,18]},
    ground:0x070c1f, field:0x0b1530, gridMain:0x19e6ff, gridSub:0x1b3a6b, outerGrid:0x24306a,
    edge:0x34d3a6, pillar:0x19e6ff, pad:0x34d3a6, north:0xffc85c,
    bldg:0x0a0f26, caps:[0x19e6ff, 0xff4fd8, 0x8a7dff], capRate:0.75,
    stars:true, sunDisc:null,
  },
  dusk:{
    label:'黃昏賽博',
    sky:{top:0x23164f, mid:0x8a3a8c, horizon:0xff9a6b, glow:0xffd08a},
    fog:{color:0xd77a8c, near:45, far:210},
    hemi:[0xffc6d6, 0x2a1840, 1.0], sun:{color:0xffb27a, intensity:2.0, pos:[-18,14,-30]},
    ground:0x221a3c, field:0x2c2250, gridMain:0xff7ab6, gridSub:0x5b3a78, outerGrid:0x4a2d68,
    edge:0xffc85c, pillar:0xff7ab6, pad:0xffc85c, north:0xffe08a,
    bldg:0x2a1840, caps:[0xffc85c, 0xff7ab6], capRate:0.35,
    stars:false, sunDisc:{color:0xffd59a, glow:0xff8a5c, dir:[-0.22,0.13,-1]},
  },
};

/* ── v3（2026-11-17）：新外觀變成預設 ──
   順序：網址 ?theme=neon|dusk|off → 首頁選的（localStorage nd3.theme）→ 預設 neon。
   off＝回到 v2 原本的場地（給很舊的電腦或想對照用）。 */
const THEME_KEY='nd3.theme';
export function activeTheme(){
  const t=new URLSearchParams(location.search).get('theme');
  if(t==='off')return null;
  if(t&&THEMES[t])return t;
  try{ const s=localStorage.getItem(THEME_KEY); if(s==='off')return null; if(s&&THEMES[s])return s; }catch{}
  return 'neon';
}
export function setTheme(t){ try{ localStorage.setItem(THEME_KEY,t); }catch{} }
/* 舊名稱保留（acro-freeflight.html 用這個名字）；v3 起等於 activeTheme() */
export function themeFromURL(){ return activeTheme(); }

/* 天空：大球內側漸層（不吃霧、不寫深度，永遠在最後面） */
function makeSky(c){
  const mat=new THREE.ShaderMaterial({
    side:THREE.BackSide, depthWrite:false, fog:false,
    uniforms:{top:{value:new THREE.Color(c.top)},mid:{value:new THREE.Color(c.mid)},
      horizon:{value:new THREE.Color(c.horizon)},glow:{value:new THREE.Color(c.glow)}},
    vertexShader:`varying vec3 vP; void main(){ vP=normalize(position);
      gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader:`uniform vec3 top,mid,horizon,glow; varying vec3 vP;
      void main(){ float h=vP.y;
        vec3 c=mix(horizon,mid,smoothstep(0.0,0.18,h));
        c=mix(c,top,smoothstep(0.18,0.65,h));
        c+=glow*0.35*exp(-abs(h)*28.0);           // 地平線一條亮帶
        if(h<0.0) c=mix(horizon,vec3(0.0),smoothstep(0.0,-0.25,h))*0.6;
        gl_FragColor=vec4(c,1.0);
        #include <colorspace_fragment>
      }`,
  });
  const m=new THREE.Mesh(new THREE.SphereGeometry(300,32,16),mat);
  m.renderOrder=-10; m.frustumCulled=false;
  return m;
}

function makeStars(){
  const n=700, pos=new Float32Array(n*3);
  for(let i=0;i<n;i++){
    const th=Math.random()*Math.PI*2, y=0.08+Math.random()*0.92, r=Math.sqrt(1-y*y);
    pos.set([Math.cos(th)*r*280, y*280, Math.sin(th)*r*280], i*3);
  }
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.BufferAttribute(pos,3));
  return new THREE.Points(g,new THREE.PointsMaterial({color:0xcfe0ff,size:1.6,sizeAttenuation:false,
    fog:false,transparent:true,opacity:0.8,depthWrite:false}));
}

function makeSunDisc(s){
  const g=new THREE.Group();
  const d=new THREE.Vector3(...s.dir).normalize().multiplyScalar(270);
  const disc=new THREE.Mesh(new THREE.CircleGeometry(26,48),
    new THREE.MeshBasicMaterial({color:s.color,fog:false,depthWrite:false}));
  const halo=new THREE.Mesh(new THREE.CircleGeometry(70,48),
    new THREE.MeshBasicMaterial({color:s.glow,fog:false,transparent:true,opacity:0.22,
      blending:THREE.AdditiveBlending,depthWrite:false}));
  [halo,disc].forEach((m,i)=>{ m.position.copy(d); m.lookAt(0,0,0); m.renderOrder=-9+i; g.add(m); });
  return g;
}

/* 遠景城市剪影：InstancedMesh（一次畫完，便宜）＋樓頂發光條 */
function makeSkyline(c,size){   // 回傳的 Group 名字＝'skyline'（賽道可以藏起來，例：森林、室內體育館）
  // 固定亂數種子：每台電腦、每次載入的城市剪影都一樣（像一個固定場地）
  let seed=20261117; const R=()=>{ seed|=0; seed=seed+0x6D2B79F5|0; let t=Math.imul(seed^seed>>>15,1|seed);
    t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; };
  const N=110, rnd=(a,b)=>a+R()*(b-a);
  const box=new THREE.BoxGeometry(1,1,1);
  const bldg=new THREE.InstancedMesh(box,new THREE.MeshStandardMaterial({color:c.bldg,roughness:0.9}),N);
  const caps=new THREE.InstancedMesh(box,new THREE.MeshBasicMaterial({color:0xffffff}),N);
  const m=new THREE.Matrix4(), q=new THREE.Quaternion(), s=new THREE.Vector3(), p=new THREE.Vector3();
  const col=new THREE.Color(); let k=0;
  for(let i=0;i<N;i++){
    const a=(i/N)*Math.PI*2+rnd(-0.03,0.03), r=rnd(size*6.5,size*11);
    const w=rnd(5,12), h=rnd(3,11)*(R()<0.12?2.0:1), dpt=rnd(5,12);
    p.set(Math.cos(a)*r, h/2, Math.sin(a)*r);
    q.setFromAxisAngle(new THREE.Vector3(0,1,0), -a);
    s.set(w,h,dpt); m.compose(p,q,s); bldg.setMatrixAt(i,m);
    if(R()<c.capRate){
      p.y=h+0.12; s.set(w*0.92,0.25,dpt*0.92); m.compose(p,q,s);
      caps.setMatrixAt(k,m); caps.setColorAt(k,col.setHex(c.caps[k%c.caps.length])); k++;
    }
  }
  caps.count=k;
  const g=new THREE.Group(); g.name='skyline'; g.add(bldg); if(k)g.add(caps);
  return g;
}

/* 主函式：跟 buildBasicField(scene,{size,skipCompassMark}) 同樣的參數與回傳 */
export function buildThemedField(scene,{size=15,theme='neon',skipCompassMark=false}={}){
  const c=THEMES[theme]||THEMES.neon;
  scene.background=new THREE.Color(c.sky.top);
  scene.fog=new THREE.Fog(c.fog.color,c.fog.near,c.fog.far);
  const root=new THREE.Group(); root.name='field'; root.userData.theme=theme;

  root.add(makeSky(c.sky));
  if(c.stars)root.add(makeStars());
  if(c.sunDisc)root.add(makeSunDisc(c.sunDisc));
  root.add(makeSkyline(c,size));

  // 光照（陰影設定與 buildBasicField 相同）
  root.add(new THREE.HemisphereLight(c.hemi[0],c.hemi[1],c.hemi[2]));
  const sun=new THREE.DirectionalLight(c.sun.color,c.sun.intensity);
  sun.position.set(...c.sun.pos); sun.castShadow=true;
  sun.shadow.mapSize.set(1024,1024);
  sun.shadow.camera.left=-25; sun.shadow.camera.right=25;
  sun.shadow.camera.top=25; sun.shadow.camera.bottom=-25;
  root.add(sun);

  // 地面：外圍大地＋場地內一塊稍亮的底，讓「可以飛的範圍」一眼看得出來
  const outer=new THREE.Mesh(new THREE.PlaneGeometry(size*26,size*26),
    new THREE.MeshStandardMaterial({color:c.ground,roughness:0.85,metalness:0.2}));
  outer.rotation.x=-Math.PI/2; outer.receiveShadow=true; root.add(outer);
  const field=new THREE.Mesh(new THREE.PlaneGeometry(size*2,size*2),
    new THREE.MeshStandardMaterial({color:c.field,roughness:0.7,metalness:0.25}));
  field.rotation.x=-Math.PI/2; field.position.y=0.005; field.receiveShadow=true; field.name='th-field'; root.add(field);
  const grid=new THREE.GridHelper(size*2,size*2,c.gridMain,c.gridSub);
  grid.position.y=0.012; grid.material.transparent=true; grid.material.opacity=0.85; grid.name='th-grid'; root.add(grid);
  const og=new THREE.GridHelper(size*26,78,c.outerGrid,c.outerGrid);
  og.position.y=0.008; og.material.transparent=true; og.material.opacity=0.45; root.add(og);

  // 邊界：地上發光框線＋四角光柱＋原本高度的淡圍線（物理邊界提示照舊）
  const edgeM=new THREE.MeshBasicMaterial({color:c.edge});
  for(const [x,z,w,d] of [[0,-size,size*2,0.12],[0,size,size*2,0.12],[-size,0,0.12,size*2],[size,0,0.12,size*2]]){
    const e=new THREE.Mesh(new THREE.BoxGeometry(w,0.04,d),edgeM); e.position.set(x,0.03,z); e.name='th-edge'; root.add(e);
  }
  const pillarM=new THREE.MeshBasicMaterial({color:c.pillar,transparent:true,opacity:0.35,
    blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide});
  const pts=[];
  for(const [x,z] of [[-size,-size],[size,-size],[size,size],[-size,size]]){
    const p=new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.3,6,10,1,true),pillarM);
    p.position.set(x,3,z); p.name='th-edge'; root.add(p);
    const tip=new THREE.Mesh(new THREE.SphereGeometry(0.16,10,8),new THREE.MeshBasicMaterial({color:c.pillar}));
    tip.position.set(x,0.16,z); tip.name='th-edge'; root.add(tip);
    pts.push(new THREE.Vector3(x,2.6,z));
  }
  pts.push(pts[0].clone());
  { const ln=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineBasicMaterial({color:c.pillar,transparent:true,opacity:0.3})); ln.name='th-edge'; root.add(ln); }

  // 起降區（出生點 0,0,6 附近）
  const pad=new THREE.Group();
  pad.add(new THREE.Mesh(new THREE.RingGeometry(1.05,1.2,40),
    new THREE.MeshBasicMaterial({color:c.pad,side:THREE.DoubleSide})));
  pad.add(new THREE.Mesh(new THREE.CircleGeometry(1.05,40),
    new THREE.MeshBasicMaterial({color:c.pad,transparent:true,opacity:0.12,depthWrite:false})));
  const hM=new THREE.MeshBasicMaterial({color:c.pad,side:THREE.DoubleSide});
  for(const [x,y,w,h] of [[-0.28,0,0.1,0.8],[0.28,0,0.1,0.8],[0,0,0.56,0.1]]){
    const b=new THREE.Mesh(new THREE.PlaneGeometry(w,h),hM); b.position.set(x,y,0.001); pad.add(b);
  }
  pad.rotation.x=-Math.PI/2; pad.position.set(0,0.02,6); pad.name='th-pad'; root.add(pad);

  if(!skipCompassMark){
    const nMark=new THREE.Mesh(new THREE.ConeGeometry(0.5,1.2,4),
      new THREE.MeshStandardMaterial({color:c.north,emissive:c.north,emissiveIntensity:0.6}));
    nMark.position.set(0,0.6,size+1.2); nMark.name='th-north'; root.add(nMark);
  }
  scene.add(root);
  return root;
}

/* HUD 外觀：只加 body class＋覆寫 CSS 變數與字型，hud.js 本身不動 */
const THEME_CSS=`
body[class*="nd-theme-"] #nd-hud{font-family:system-ui,-apple-system,"Microsoft JhengHei","PingFang TC","Noto Sans TC",sans-serif;}
body[class*="nd-theme-"] .nd-z{border-radius:14px;padding:8px 14px;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);}
body[class*="nd-theme-"] #nd-mission{font-weight:700;}
body[class*="nd-theme-"] #nd-gpbar kbd{border-radius:6px;}
body.nd-theme-neon{--nd-cyan:#34d3a6;--nd-panel:rgba(11,27,51,.72);--nd-edge:rgba(52,211,166,.5);}
body.nd-theme-neon #nd-hud{color:#eaf2fb;}
body.nd-theme-neon #nd-gpbar kbd{background:#132a4d;border-color:#35507a;}
body.nd-theme-neon #mode-btn,body.nd-theme-neon #self-level-btn{background:rgba(19,42,77,.7)!important;border-color:rgba(52,211,166,.7)!important;color:#eaf2fb!important;font-family:inherit;}
body.nd-theme-dusk{--nd-cyan:#ffc85c;--nd-panel:rgba(38,20,62,.66);--nd-edge:rgba(255,154,120,.55);}
body.nd-theme-dusk #nd-hud{color:#fff3ea;}
body.nd-theme-dusk #nd-gpbar kbd{background:#3a2058;border-color:#7a4a8c;}
body.nd-theme-dusk #mode-btn,body.nd-theme-dusk #self-level-btn{background:rgba(58,32,88,.6)!important;border-color:rgba(255,200,92,.7)!important;color:#fff3ea!important;font-family:inherit;}
`;
export function applyThemeCSS(theme){
  if(!THEMES[theme])return;
  if(!document.getElementById('nd-theme-css')){
    const st=document.createElement('style'); st.id='nd-theme-css'; st.textContent=THEME_CSS;
    document.head.appendChild(st);
  }
  document.body.classList.add('nd-theme-'+theme);
}

/* ── 停地外觀（2026-11-17 老師回饋：球框要像真的一樣「底部輕輕碰地」，不要陷一半）──
   物理的最低離地高度是 0.15（physics.js GROUND_Y），但訓練光球畫出來半徑 0.5，
   停在地上時下半截會埋進地面。這裡只調「畫面」：機體太低時把 mesh 抬到
   底部剛好碰地（只陷 sink 一點點），飛高了就完全跟物理位置一致。
   物理位置、碰撞、穿環判定、小地圖都不受影響。
   另外把機體裡的 PointLight 在地面時調暗（避免地上一圈藍光），飛起來才亮。
   用法：每幀 mesh.position.copy(drone.pos) 之後呼叫 settleOnGround(mesh,drone)。 */
const _box=new THREE.Box3();
/* 往下打一條射線找「球底下最高的實心頂面」（只在球離地很近時才打，省效能）。
   略過：球自己、透明物件（光柱、光暈、圓環）、線條、看不見的東西、太陡的面。 */
const _ray=new THREE.Raycaster(), _down=new THREE.Vector3(0,-1,0), _o=new THREE.Vector3();
_ray.camera=new THREE.PerspectiveCamera();   // 11-17 修：場景裡有 Sprite（賽道標示）時，Raycaster 一定要有 camera 才不會當掉；Sprite 結果下面本來就會略過
function surfaceBelow(mesh,footR){
  const sc=mesh.parent; if(!sc||footR<0.15)return 0;            // 足球場的小球：場地是平的，不用找（觀眾席物件很多，省效能）
  const reach=footR*2.2+1.2;
  if(mesh.position.y>reach+1.5)return 0;                       // 飛高了：不用找
  _o.set(mesh.position.x,mesh.position.y+footR,mesh.position.z);
  _ray.set(_o,_down); _ray.far=footR+reach;
  let best=0;
  const hits=_ray.intersectObjects(sc.children,true);
  for(const h of hits){
    const o=h.object;
    if(!o.isMesh||o.isInstancedMesh||!o.visible)continue;
    let p=o, mine=false; while(p){ if(p===mesh){mine=true;break;} p=p.parent; } if(mine)continue;
    const m=Array.isArray(o.material)?o.material[0]:o.material;
    if(!m||m.transparent||m.wireframe||m.side===THREE.BackSide)continue;
    if(h.face&&h.face.normal){ const n=h.face.normal.clone().transformDirection(o.matrixWorld); if(n.y<0.7)continue; }
    if(h.point.y>best)best=h.point.y;
    break;                                                      // 由近到遠排序：第一個有效的就是最上面那層
  }
  return best;
}
export function settleOnGround(mesh,drone,{sink}={}){
  if(!mesh)return;
  const u=mesh.userData;
  if(u.footR===undefined){
    // 第一次：在「沒旋轉、原點」狀態量機體最低點到中心的距離（含視覺縮放）
    // 存「尤拉角」不存四元數：足球場只設 rotation.y，若用四元數還原，180° 會被換算成 (π,0,π)，
    // 之後關卡再設 rotation.y=π 就變成 (π,π,π)＝沒轉，球前後顛倒、尾燈跑到前面（v3 11/17 老師抓到）
    const p=mesh.position.clone(), e=mesh.rotation.clone();
    mesh.position.set(0,0,0); mesh.rotation.set(0,0,0); mesh.updateMatrixWorld(true);
    _box.makeEmpty();
    mesh.traverse(o=>{ if(o.isMesh&&o.visible&&o.material.depthTest!==false){ o.geometry.computeBoundingBox();
      const b=o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld); _box.union(b);} });
    u.footR=_box.isEmpty()?0.15:Math.max(0.15,-_box.min.y);
    u.lights=[]; mesh.traverse(o=>{ if(o.isPointLight){ u.lights.push([o,o.intensity]); } });
    mesh.position.copy(p); mesh.rotation.copy(e);
  }
  const rawY=drone?drone.pos.y:mesh.position.y;
  // v3：球底下如果有東西（充電站、降落墊、平台），用它的頂面當地面，球不會「被吃掉」
  const floor=surfaceBelow(mesh,u.footR);
  const rest=floor+u.footR-(sink??u.footR*0.07);     // 陷入量跟球的大小成比例（足球場的小球不會陷太多）
  if(mesh.position.y<rest) mesh.position.y=rest;
  // 燈：離地 0～(球高 2 倍) 之間由暗到亮
  const k=THREE.MathUtils.clamp((rawY+0.15*(u.footR/0.4)-rest)/Math.max(0.25,u.footR*2.5),0,1);
  for(const [l,i0] of u.lights) l.intensity=i0*k;
  // 擬真足球無人機：槳的轉速跟離地程度連動（停地＝槳停）
  const now=performance.now(), dt=u._t?Math.min(0.1,(now-u._t)/1000):0; u._t=now;
  if(u.props)spinCageProps(mesh,dt,k);
}

/* ── v3：所有關卡自動停地（engine.js 每幀呼叫 settleAll）──
   drone-styles.js 產生足球無人機時 registerCage(mesh)；關卡每幀把 mesh 位置設好之後、
   畫面渲染之前，這裡統一把太低的球抬到「底部碰地」，關卡檔不用改。 */
const _cages=new Set();
export function registerCage(mesh){ if(mesh)_cages.add(mesh); }
export function settleAll(){
  for(const m of _cages){
    if(m.parent){ m.userData._attached=true; settleOnGround(m,null); }
    else if(m.userData._attached) _cages.delete(m);        // 已經從場景拿掉（換機體、關卡重來）
  }
}
