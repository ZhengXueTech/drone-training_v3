/* newdrone 無人機飛行模擬器 © 2026 何政學（新北市立中正國民中學）｜授權 CC BY-NC-SA 4.0（姓名標示─非商業性─相同方式分享），見 LICENSE.md；請保留本聲明 */
/* ============================================================
   drone-styles.js v2 — 機體樣式／實機數位分身註冊表（ES Module）
   newdrone Phase 0｜移植自基本版 v1.2（14 樣式全數保留）
   ------------------------------------------------------------
   ■ 機體座標規範（全系統凍結，見規劃書 5.5）：
       機頭 = -Z、機頂 = +Y、右舷 = +X
     基本版部分樣式機鼻朝 +Z（歷史因素）——本模組以 noseAxis
     欄位標記，於 buildDroneStyle() 內用外層 Group 統一轉正，
     保證任何樣式回傳時機頭都指向 -Z。
   ■ userData 約定：
       .noseDir  = Vector3(0,0,-1)（驗收站畫箭頭用）
       .spin     = 需要每幀旋轉的子物件（保護籠/光環）
       .cargo    = 貨運機吊掛物（cargo-lift 專用）
       .styleCode
   ■ 用法：
       import { DRONE_STYLES, buildDroneStyle, droneStyleGet, droneStyleSet } from './drone-styles.js';
       const mesh = buildDroneStyle('pvp-cage', { tint: 0xff3344 }); // tint = 席位隊色
   ■ 實機對應：機隊共 18 台（紅、藍各半）、遙控器 15 支。
       詳細型號盤點完成後，於 REAL_FLEET 補上實機建檔並精修對應樣式。
   ============================================================ */
import * as THREE from 'three';
import { buildSoccerCage, ballPrefsGet, ballBuildOpts, TAIL_COLORS } from './drone-soccer-cage.js';   // v3
import { registerCage } from './theme.js';                                                          // v3
const V3_BALL=(()=>{ try{ return new URLSearchParams(location.search).get('ball')!=='classic'; }catch{ return true; } })();   // ?ball=classic＝看 v2 原本的機體

const BR = 0.11; // 足球系機體半徑（公尺）

/* ── 足球系 ─────────────────────────────────────────────── */
function m_soccer(o){
  const tc=o.tc??0x00eeff, sc=o.sc??0x22d3ee, isPlayer=o.isPlayer??true;
  const g=new THREE.Group(); const S=0.22;
  const spin=new THREE.Group();
  const glowMat=new THREE.MeshStandardMaterial({color:tc,emissive:tc,emissiveIntensity:isPlayer?.85:.55,wireframe:true,transparent:true,opacity:isPlayer?.72:.55});
  spin.add(new THREE.Mesh(new THREE.SphereGeometry(BR,14,10),glowMat));
  g.add(spin); g.userData.spin=spin;
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.14*S,8,8),new THREE.MeshStandardMaterial({color:0x1e293b,metalness:.9})));
  const armMat=new THREE.MeshStandardMaterial({color:0x64748b,metalness:.8});
  const armGeo=new THREE.CylinderGeometry(0.02*S,0.02*S,0.72*S,6);
  const a1=new THREE.Mesh(armGeo,armMat); a1.rotation.set(0,Math.PI/4,Math.PI/2); g.add(a1);
  const a2=new THREE.Mesh(armGeo,armMat.clone()); a2.rotation.set(0,-Math.PI/4,Math.PI/2); g.add(a2);
  const nose=new THREE.Mesh(new THREE.ConeGeometry(0.07*S,0.165*S,4),new THREE.MeshBasicMaterial({color:0xfacc15}));
  nose.rotation.x=Math.PI/2; nose.position.set(0,0,0.32*S); g.add(nose);
  const tail=new THREE.Mesh(new THREE.SphereGeometry(0.09*S,6,6),new THREE.MeshBasicMaterial({color:0xef4444}));
  tail.position.set(0,0,-0.32*S); g.add(tail);
  g.add(new THREE.Mesh(new THREE.SphereGeometry(BR*.44,8,8),new THREE.MeshStandardMaterial({color:sc,emissive:sc,emissiveIntensity:isPlayer?1.2:.7,transparent:true,opacity:.42})));
  const led=new THREE.Mesh(new THREE.TorusGeometry(BR*.88,BR*.05,6,24),new THREE.MeshBasicMaterial({color:sc}));
  led.rotation.x=Math.PI/2; g.add(led);
  g.add(new THREE.PointLight(sc,isPlayer?.9:.45,1.8));
  return g;
}

function m_pvp(o){
  const tc=o.tc??0x00eeff;
  const g=new THREE.Group(),S=0.22;
  const glowM=new THREE.MeshBasicMaterial({color:tc,wireframe:true,transparent:true,opacity:.55});
  const glowMesh=new THREE.Mesh(new THREE.SphereGeometry(BR*.97,10,7),glowM);
  g.add(glowMesh); g.userData.spin=glowMesh;
  g.add(new THREE.Mesh(new THREE.SphereGeometry(BR*.88,8,6),new THREE.MeshBasicMaterial({color:tc,transparent:true,opacity:.12})));
  g.add(new THREE.Mesh(new THREE.SphereGeometry(BR*.44,8,8),new THREE.MeshStandardMaterial({color:0x0a1428,metalness:.7,roughness:.35})));
  const armG=new THREE.BoxGeometry(BR*1.7*S,BR*.18*S,BR*.18*S);
  const armM=new THREE.MeshStandardMaterial({color:0x112244,metalness:.6,roughness:.4});
  [Math.PI/4,-Math.PI/4].forEach(ry=>{const a=new THREE.Mesh(armG,armM);a.rotation.y=ry;a.scale.setScalar(1/S);g.add(a);});
  const nose=new THREE.Mesh(new THREE.ConeGeometry(BR*.20,BR*.33,6),new THREE.MeshStandardMaterial({color:0x22cc44,emissive:0x114422,emissiveIntensity:.8,metalness:.3}));
  nose.rotation.x=Math.PI/2; nose.position.z=BR*.62; g.add(nose);
  const tail=new THREE.Mesh(new THREE.SphereGeometry(BR*.15,6,4),new THREE.MeshStandardMaterial({color:0xff2200,emissive:0xff1100,emissiveIntensity:1.5}));
  tail.position.z=-BR*.62; g.add(tail);
  g.add(new THREE.PointLight(tc,.8,1.0));
  return g;
}

function m_realistic(o){
  const teamColor=o.tc??0x00eeff, armColor=o.armColor??0x112244;
  const g=new THREE.Group();
  g.add(new THREE.Mesh(new THREE.SphereGeometry(BR,16,12),new THREE.MeshPhongMaterial({color:teamColor,transparent:true,opacity:.28,shininess:90})));
  const ring=new THREE.Mesh(new THREE.TorusGeometry(BR*.82,.011,4,20),new THREE.MeshBasicMaterial({color:teamColor,transparent:true,opacity:.55}));
  g.add(ring); g.userData.ring=ring; g.userData.spin=ring;
  g.add(new THREE.Mesh(new THREE.SphereGeometry(BR*.40,8,8),new THREE.MeshStandardMaterial({color:0x0a1428,metalness:.7,roughness:.35})));
  const armGeo=new THREE.BoxGeometry(BR*1.65,BR*.15,BR*.15);
  const armMat=new THREE.MeshStandardMaterial({color:armColor,metalness:.6,roughness:.4});
  [Math.PI/4,-Math.PI/4].forEach(ry=>{const arm=new THREE.Mesh(armGeo,armMat);arm.rotation.y=ry;g.add(arm);});
  const nose=new THREE.Mesh(new THREE.ConeGeometry(BR*.20,BR*.33,5),new THREE.MeshStandardMaterial({color:0x22cc44,emissive:0x116622,emissiveIntensity:.9}));
  nose.rotation.x=Math.PI/2; nose.position.z=BR*.53; g.add(nose);
  const tail=new THREE.Mesh(new THREE.SphereGeometry(BR*.13,5,4),new THREE.MeshStandardMaterial({color:0xff2200,emissive:0xff1100,emissiveIntensity:1.8}));
  tail.position.z=-BR*.55; g.add(tail);
  g.add(new THREE.PointLight(teamColor,.75,.95));
  return g;
}

function m_gkpractice(o){
  const tc=o.tc??0x00eeff, isPlayer=o.isPlayer??true;
  const g=new THREE.Group(); const S=0.22;
  const spin=new THREE.Group();
  const gm=new THREE.MeshStandardMaterial({color:tc,emissive:tc,emissiveIntensity:isPlayer?.85:.55,wireframe:true,transparent:true,opacity:isPlayer?.72:.52});
  spin.add(new THREE.Mesh(new THREE.SphereGeometry(BR,14,10),gm));
  g.add(spin); g.userData.spin=spin;
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.14*S,8,8),new THREE.MeshStandardMaterial({color:0x1e293b,metalness:.9})));
  const am=new THREE.MeshStandardMaterial({color:isPlayer?0x64748b:0x8b2222,metalness:.8});
  const ag=new THREE.CylinderGeometry(0.02*S,0.02*S,0.72*S,6);
  const a1=new THREE.Mesh(ag,am); a1.rotation.set(0,Math.PI/4,Math.PI/2); g.add(a1);
  const a2=new THREE.Mesh(ag,am.clone()); a2.rotation.set(0,-Math.PI/4,Math.PI/2); g.add(a2);
  const nose=new THREE.Mesh(new THREE.ConeGeometry(0.08*S,0.2*S,4),new THREE.MeshBasicMaterial({color:isPlayer?0xfacc15:0xff6633}));
  nose.rotation.x=Math.PI/2; nose.position.set(0,0,0.3*S); g.add(nose);
  const tail=new THREE.Mesh(new THREE.SphereGeometry(0.09*S,6,6),new THREE.MeshBasicMaterial({color:isPlayer?0xef4444:0xff9900}));
  tail.position.set(0,0,-0.35*S); g.add(tail);
  g.add(new THREE.PointLight(tc,isPlayer?.6:.4,.65));
  return g;
}

function m_expgk(o){
  const color=o.color??0xcc0033;
  const g=new THREE.Group();
  const glow=new THREE.Mesh(new THREE.SphereGeometry(BR*.97,10,7),new THREE.MeshBasicMaterial({color,wireframe:true,transparent:true,opacity:.7}));
  g.add(glow); g.userData.spin=glow;
  g.add(new THREE.Mesh(new THREE.SphereGeometry(BR*.88,8,6),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.25})));
  g.add(new THREE.Mesh(new THREE.SphereGeometry(BR*.44,8,8),new THREE.MeshStandardMaterial({color:0x0a0018,metalness:.7,roughness:.35})));
  const armM=new THREE.MeshStandardMaterial({color:0x110022,metalness:.6,roughness:.4});
  const armG=new THREE.CylinderGeometry(0.015,0.015,BR*1.6,4);
  [Math.PI/4,-Math.PI/4].forEach(ry=>{const a=new THREE.Mesh(armG,armM);a.rotation.set(0,ry,Math.PI/2);g.add(a);});
  const nose=new THREE.Mesh(new THREE.ConeGeometry(BR*.20,BR*.33,6),new THREE.MeshStandardMaterial({color:0x22cc44,emissive:0x22cc44,emissiveIntensity:1.2}));
  nose.rotation.x=-Math.PI/2; nose.position.z=-BR*.62; g.add(nose);
  const tail=new THREE.Mesh(new THREE.SphereGeometry(BR*.15,6,4),new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:2.5}));
  tail.position.z=BR*.62; g.add(tail);
  g.add(new THREE.PointLight(color,1.2,1.5));
  return g;
}

/* ── 任務系 ─────────────────────────────────────────────── */
function m_hover(o){
  const C=o.color??0x00ccaa;
  const g=new THREE.Group();
  const glow=new THREE.Mesh(new THREE.SphereGeometry(0.5,14,10),new THREE.MeshBasicMaterial({color:C,wireframe:true,transparent:true,opacity:.65}));
  g.add(glow); g.userData.spin=glow;
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.38,10,8),new THREE.MeshBasicMaterial({color:C,transparent:true,opacity:.22})));
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.15,8,8),new THREE.MeshStandardMaterial({color:0x0a1828,metalness:.8,roughness:.3})));
  const armM=new THREE.MeshStandardMaterial({color:0x1a3040,metalness:.7});
  [Math.PI/4,-Math.PI/4].forEach(ry=>{const a=new THREE.Mesh(new THREE.CylinderGeometry(.015,.015,.8,4),armM);a.rotation.set(0,ry,Math.PI/2);g.add(a);});
  const nose=new THREE.Mesh(new THREE.ConeGeometry(.05,.10,4),new THREE.MeshBasicMaterial({color:C,transparent:true,opacity:.9}));
  nose.rotation.x=-Math.PI/2; nose.position.z=-.44; g.add(nose);
  g.add(new THREE.PointLight(C,1.5,2.0));
  return g;
}

function m_chaseai(o){
  const C=o.color??0xec4899;
  const g=new THREE.Group();
  const glow=new THREE.Mesh(new THREE.SphereGeometry(0.48,14,10),new THREE.MeshBasicMaterial({color:C,wireframe:true,transparent:true,opacity:.75}));
  g.add(glow); g.userData.spin=glow;
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.34,10,8),new THREE.MeshBasicMaterial({color:C,transparent:true,opacity:.28})));
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.13,8,8),new THREE.MeshStandardMaterial({color:0x200020,metalness:.8})));
  const armM=new THREE.MeshStandardMaterial({color:0x3d0030,metalness:.7});
  [Math.PI/4,-Math.PI/4].forEach(ry=>{const a=new THREE.Mesh(new THREE.CylinderGeometry(.013,.013,.75,4),armM);a.rotation.set(0,ry,Math.PI/2);g.add(a);});
  g.add(new THREE.PointLight(C,1.5,2.5));
  return g;
}

function m_infinite(){
  const g=new THREE.Group();
  const glow=new THREE.Mesh(new THREE.SphereGeometry(0.5,16,16),new THREE.MeshStandardMaterial({color:0x00ffff,emissive:0x00ffff,emissiveIntensity:0.8,wireframe:true,transparent:true,opacity:0.7}));
  g.add(glow); g.userData.spin=glow;
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.14,8,8),new THREE.MeshStandardMaterial({color:0x1e293b,metalness:0.9})));
  const armMat=new THREE.MeshStandardMaterial({color:0x64748b,metalness:0.8});
  const a1=new THREE.Mesh(new THREE.CylinderGeometry(0.02,0.02,0.75,8),armMat);
  a1.rotation.set(0,Math.PI/4,Math.PI/2); g.add(a1);
  const a2=new THREE.Mesh(new THREE.CylinderGeometry(0.02,0.02,0.75,8),armMat);
  a2.rotation.set(0,-Math.PI/4,Math.PI/2); g.add(a2);
  const nose=new THREE.Mesh(new THREE.ConeGeometry(0.08,0.2,4),new THREE.MeshBasicMaterial({color:0xfacc15}));
  nose.rotation.x=-Math.PI/2; nose.position.set(0,0,-0.3); g.add(nose);
  return g;
}

function m_agri(){
  const g=new THREE.Group();
  g.add(new THREE.Mesh(new THREE.SphereGeometry(.12,10,8),new THREE.MeshStandardMaterial({color:0x3d6518,metalness:.5,roughness:.4})));
  const armM=new THREE.MeshStandardMaterial({color:0x4a7a20,metalness:.4});
  [Math.PI/4,-Math.PI/4].forEach(ry=>{const arm=new THREE.Mesh(new THREE.BoxGeometry(.52,.03,.05),armM);arm.rotation.y=ry;g.add(arm);});
  const propM=new THREE.MeshBasicMaterial({color:0x99dd44,transparent:true,opacity:.40});
  [[-1,-1],[-1,1],[1,-1],[1,1]].forEach(([mx,mz])=>{const pd=new THREE.Mesh(new THREE.CircleGeometry(.09,16),propM);pd.rotation.x=-Math.PI/2;pd.position.set(mx*.184,.06,mz*.184);g.add(pd);});
  const nose=new THREE.Mesh(new THREE.ConeGeometry(.06,.12,6),new THREE.MeshStandardMaterial({color:0xffcc00,emissive:0x886600,emissiveIntensity:.8}));
  nose.rotation.x=Math.PI/2; nose.position.z=.22; g.add(nose);
  const nozzle=new THREE.Mesh(new THREE.CylinderGeometry(.02,.03,.08,6),new THREE.MeshStandardMaterial({color:0x00ccff,emissive:0x006688,emissiveIntensity:.5}));
  nozzle.position.y=-.16; g.add(nozzle);
  g.add(new THREE.PointLight(0xaaff44,.6,.8));
  return g;
}

function m_rescue(){
  const g=new THREE.Group();
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.12,10,8),new THREE.MeshStandardMaterial({color:0xff5500,metalness:0.4,roughness:0.4})));
  const armM=new THREE.MeshStandardMaterial({color:0xcc4400,metalness:0.4});
  [Math.PI/4,-Math.PI/4].forEach(ry=>{const a=new THREE.Mesh(new THREE.BoxGeometry(0.52,0.03,0.05),armM);a.rotation.y=ry;g.add(a);});
  const propM=new THREE.MeshBasicMaterial({color:0xff8833,transparent:true,opacity:0.45});
  [[-1,-1],[-1,1],[1,-1],[1,1]].forEach(([mx,mz])=>{const pd=new THREE.Mesh(new THREE.CircleGeometry(0.09,16),propM.clone());pd.rotation.x=-Math.PI/2;pd.position.set(mx*0.184,0.06,mz*0.184);g.add(pd);});
  const nose=new THREE.Mesh(new THREE.ConeGeometry(0.05,0.12,6),new THREE.MeshStandardMaterial({color:0xffcc00,emissive:0x886600,emissiveIntensity:0.8}));
  nose.rotation.x=Math.PI/2; nose.position.z=0.22; g.add(nose);
  const lh=new THREE.Mesh(new THREE.CylinderGeometry(0.035,0.04,0.08,8),new THREE.MeshStandardMaterial({color:0xffffff,roughness:0.2,metalness:0.8}));
  lh.position.set(0,-0.13,0.04); g.add(lh);
  const sl=new THREE.PointLight(0xffffff,1.5,12); sl.position.set(0,-0.15,0.04); g.add(sl);
  const sLed=new THREE.SphereGeometry(0.02,6,6);
  const fL=new THREE.Mesh(sLed,new THREE.MeshStandardMaterial({color:0xff2200,emissive:0xff2200,emissiveIntensity:3}));
  fL.position.set(0,0.05,0.13); g.add(fL);
  const rL=new THREE.Mesh(sLed.clone(),new THREE.MeshStandardMaterial({color:0x00ff44,emissive:0x00ff44,emissiveIntensity:3}));
  rL.position.set(0,0.05,-0.13); g.add(rL);
  return g;
}

function m_bridge(){
  const g=new THREE.Group();
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.12,10,8),new THREE.MeshStandardMaterial({color:0xffcc00,metalness:0.5,roughness:0.3})));
  const aM=new THREE.MeshStandardMaterial({color:0xddaa00,metalness:0.5});
  [Math.PI/4,-Math.PI/4].forEach(ry=>{const arm=new THREE.Mesh(new THREE.BoxGeometry(0.52,0.03,0.05),aM);arm.rotation.y=ry;g.add(arm);});
  const pM=new THREE.MeshBasicMaterial({color:0xffee88,transparent:true,opacity:0.40});
  [[-1,-1],[-1,1],[1,-1],[1,1]].forEach(([mx,mz])=>{const pd=new THREE.Mesh(new THREE.CircleGeometry(0.09,16),pM.clone());pd.rotation.x=-Math.PI/2;pd.position.set(mx*0.184,0.06,mz*0.184);g.add(pd);});
  const nose=new THREE.Mesh(new THREE.ConeGeometry(0.05,0.12,6),new THREE.MeshStandardMaterial({color:0xff4400,emissive:0x882200,emissiveIntensity:0.8}));
  nose.rotation.x=Math.PI/2; nose.position.z=0.22; g.add(nose);
  const sM=new THREE.MeshStandardMaterial({color:0x222222,roughness:0.3,metalness:0.8});
  const pod=new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.03,0.10,8),sM);
  pod.rotation.x=Math.PI/2; pod.position.set(0,-0.08,0.06); g.add(pod);
  const tip=new THREE.Mesh(new THREE.SphereGeometry(0.025,6,6),new THREE.MeshStandardMaterial({color:0x880000,roughness:0.1,metalness:0.9}));
  tip.position.set(0,-0.08,0.12); g.add(tip);
  const sL=new THREE.SphereGeometry(0.02,6,6);
  const fL=new THREE.Mesh(sL,new THREE.MeshStandardMaterial({color:0xff2200,emissive:0xff2200,emissiveIntensity:3}));
  fL.position.set(0,0.05,0.13); g.add(fL);
  const rL=new THREE.Mesh(sL.clone(),new THREE.MeshStandardMaterial({color:0x00ff44,emissive:0x00ff44,emissiveIntensity:3}));
  rL.position.set(0,0.05,-0.13); g.add(rL);
  return g;
}

function m_inspection(){
  const g=new THREE.Group();
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.20,0.06,0.20),new THREE.MeshStandardMaterial({color:0xe8e8e8,roughness:0.3,metalness:0.5})));
  const armMat=new THREE.MeshStandardMaterial({color:0xcccccc,roughness:0.4,metalness:0.4});
  [Math.PI/4,-Math.PI/4].forEach(ry=>{const arm=new THREE.Mesh(new THREE.BoxGeometry(0.40,0.025,0.04),armMat);arm.rotation.y=ry;g.add(arm);});
  const nose=new THREE.Mesh(new THREE.ConeGeometry(0.04,0.10,6),new THREE.MeshStandardMaterial({color:0x4488ff,emissive:0x224499,emissiveIntensity:0.8}));
  nose.rotation.x=Math.PI/2; nose.position.set(0,0,0.21); g.add(nose);
  const propGeo=new THREE.CylinderGeometry(0.09,0.09,0.015,12);
  [[0.13,0.13,0x4488ff],[-0.13,0.13,0x4488ff],[0.13,-0.13,0xaaaaaa],[-0.13,-0.13,0xaaaaaa]].forEach(([px,pz,col])=>{
    const pr=new THREE.Mesh(propGeo,new THREE.MeshStandardMaterial({color:col,transparent:true,opacity:0.75,metalness:0.3}));
    pr.position.set(px,0.04,pz); g.add(pr);
  });
  const gimbal=new THREE.Mesh(new THREE.BoxGeometry(0.07,0.05,0.05),new THREE.MeshStandardMaterial({color:0x444444,roughness:0.3,metalness:0.7}));
  gimbal.position.set(0,-0.08,0.03); g.add(gimbal);
  const lens=new THREE.Mesh(new THREE.SphereGeometry(0.025,8,8),new THREE.MeshStandardMaterial({color:0x112244,roughness:0.05,metalness:0.95}));
  lens.position.set(0,-0.08,0.07); g.add(lens);
  const ledGeo=new THREE.SphereGeometry(0.022,6,6);
  const fLed=new THREE.Mesh(ledGeo,new THREE.MeshStandardMaterial({color:0xff2200,emissive:0xff2200,emissiveIntensity:3}));
  fLed.position.set(0,0.05,0.13); g.add(fLed);
  const rLed=new THREE.Mesh(ledGeo.clone(),new THREE.MeshStandardMaterial({color:0x00ff44,emissive:0x00ff44,emissiveIntensity:3}));
  rLed.position.set(0,0.05,-0.13); g.add(rLed);
  return g;
}

function m_cargo(o){
  const DRONE_COLOR=0xf59e0b, CARGO_COLOR=0xfbbf24;
  const g=new THREE.Group();
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.34,0.12,0.34),new THREE.MeshStandardMaterial({color:DRONE_COLOR,metalness:.7,roughness:.3})));
  [[-1,0,-1],[-1,0,1],[1,0,-1],[1,0,1]].forEach(([sx,,sz])=>{
    const arm=new THREE.Mesh(new THREE.BoxGeometry(0.55,0.04,0.04),new THREE.MeshStandardMaterial({color:0x78350f}));
    arm.position.set(sx*.32,0,sz*.32); arm.rotation.y=Math.atan2(sz,sx); g.add(arm);
    const rotor=new THREE.Mesh(new THREE.CylinderGeometry(0.17,0.17,0.025,10),new THREE.MeshStandardMaterial({color:DRONE_COLOR,transparent:true,opacity:.5}));
    rotor.position.set(sx*.42,0.06,sz*.42); g.add(rotor);
  });
  const nose=new THREE.Mesh(new THREE.ConeGeometry(0.08,0.22,4),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0.9}));
  nose.rotation.x=-Math.PI/2; nose.position.z=-0.30; g.add(nose);
  g.add(new THREE.PointLight(DRONE_COLOR,1.2,3));
  const cargo=new THREE.Group();
  const cbx=new THREE.Mesh(new THREE.BoxGeometry(0.38,0.38,0.38),new THREE.MeshStandardMaterial({color:CARGO_COLOR,emissive:CARGO_COLOR,emissiveIntensity:.9,metalness:.3}));
  cbx.position.y=-0.75; cargo.add(cbx);
  cargo.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0),new THREE.Vector3(0,-0.75,0)]),new THREE.LineBasicMaterial({color:0x888888})));
  cargo.add(new THREE.PointLight(CARGO_COLOR,0.8,2));
  cargo.visible=(o&&o.showCargo===false)?false:true;
  g.add(cargo); g.userData.cargo=cargo;
  return g;
}

function m_multidef(){
  const DRONE_COLOR=0x7c3aed;
  const g=new THREE.Group();
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.35,0.12,0.35),new THREE.MeshStandardMaterial({color:DRONE_COLOR,metalness:.7,roughness:.3})));
  [[-1,0,-1],[-1,0,1],[1,0,-1],[1,0,1]].forEach(([sx,,sz])=>{
    const arm=new THREE.Mesh(new THREE.BoxGeometry(0.55,0.05,0.05),new THREE.MeshStandardMaterial({color:0x3b0d8a}));
    arm.position.set(sx*.32,0,sz*.32); arm.rotation.y=Math.atan2(sz,sx); g.add(arm);
    const rotor=new THREE.Mesh(new THREE.CylinderGeometry(0.18,0.18,0.025,10),new THREE.MeshStandardMaterial({color:0x6d28d9,transparent:true,opacity:.55}));
    rotor.position.set(sx*.42,0.06,sz*.42); g.add(rotor);
  });
  const nose=new THREE.Mesh(new THREE.ConeGeometry(0.08,0.22,4),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0.9}));
  nose.rotation.x=-Math.PI/2; nose.position.z=-0.31; g.add(nose);
  g.add(new THREE.PointLight(DRONE_COLOR,1.5,3));
  return g;
}

/* ── 樣式註冊表 ──────────────────────────────────────────────
   noseAxis：'−z' 已符合規範；'+z' 建構時機鼻朝 +Z（基本版歷史），
   buildDroneStyle() 會自動用外層 Group 轉正 180°。 */

/* ── 2026-11-28 任務情境機體重新造型（老師：配色和樣式要像真的機種，設定關卡時可以換配色）──
   單位公尺、機頭 +z（m_cargo2 例外：-z，跟原本一樣）。配色：TASK_PALETTES[code][i]＝{name,body,accent}。 */
export const TASK_PALETTES={
  'agri-sprayer':[{name:'白綠（常見農噴機）',body:0xeef2f0,accent:0x2f9e44},{name:'橘黑',body:0xf08c00,accent:0x222222},{name:'灰藍',body:0x9aa5b1,accent:0x1971c2}],
  'rescue-search':[{name:'救援橘',body:0x2b2f36,accent:0xff6a00},{name:'紅白',body:0xf1f3f5,accent:0xe03131},{name:'警用藍',body:0x1f2a44,accent:0x339af0}],
  'bridge-probe':[{name:'工程黃',body:0x2b2f36,accent:0xffc107},{name:'安全橘',body:0x343a40,accent:0xff8c1a},{name:'白灰',body:0xdee2e6,accent:0x495057}],
  'inspect-cam':[{name:'空拍白',body:0xeef0f2,accent:0x868e96},{name:'深空灰',body:0x3b4048,accent:0x9aa5b1},{name:'迷彩綠',body:0x5c6b3b,accent:0x2b2f20}],
  'cargo-lift':[{name:'物流橘',body:0x2b2f36,accent:0xf59e0b},{name:'郵務綠',body:0x2f6b3a,accent:0xf5d90a},{name:'白藍',body:0xe9ecef,accent:0x1c7ed6}],
};
const TASK_COLOR_KEY=code=>'nd3.taskColor.'+code;
export function taskColorGet(code){ const L=TASK_PALETTES[code]; if(!L)return 0; let i=0; try{ i=parseInt(localStorage.getItem(TASK_COLOR_KEY(code)))||0; }catch{} return Math.max(0,Math.min(L.length-1,i)); }
export function taskColorSet(code,i){ try{ localStorage.setItem(TASK_COLOR_KEY(code),String(i)); }catch{} }
const pal=(code,o)=>{ const L=TASK_PALETTES[code]; const p=L[o&&o.palette!=null?o.palette:taskColorGet(code)]||L[0]; return p; };
const std=(c,m=.35,r=.5)=>new THREE.MeshStandardMaterial({color:c,metalness:m,roughness:r});
const glow=c=>new THREE.MeshStandardMaterial({color:c,emissive:c,emissiveIntensity:2.2});
/* 一支旋翼：馬達＋兩片槳（實體）＋淡淡的旋轉盤 */
function rotor(r,armCol,bladeCol){
  const g=new THREE.Group();
  const mot=new THREE.Mesh(new THREE.CylinderGeometry(r*.16,r*.18,r*.28,12),std(armCol,.6,.35)); g.add(mot);
  const blade=new THREE.Mesh(new THREE.BoxGeometry(r*2,r*.03,r*.16),std(bladeCol,.2,.6)); blade.position.y=r*.17; g.add(blade);
  const blade2=blade.clone(); blade2.rotation.y=Math.PI/2.6; g.add(blade2);
  const disc=new THREE.Mesh(new THREE.CircleGeometry(r,28),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.10,depthWrite:false,side:THREE.DoubleSide}));
  disc.rotation.x=-Math.PI/2; disc.position.y=r*.19; g.add(disc);
  return g;
}
function arm(len,thick,col){ const a=new THREE.Mesh(new THREE.CylinderGeometry(thick,thick,len,10),std(col,.4,.45)); a.rotation.z=Math.PI/2; return a; }
function navLights(g,z,y,x){
  const L=new THREE.Mesh(new THREE.SphereGeometry(.018,8,6),glow(0xff2222)); L.position.set(-x,y,z); g.add(L);
  const R=new THREE.Mesh(new THREE.SphereGeometry(.018,8,6),glow(0x22ff55)); R.position.set(x,y,z); g.add(R);
}
/* 農噴機：X 型長臂＋大槳、中間大藥箱（看得到藥水）、機腹橫桿噴頭、雙滑橇腳架 */
function m_agri2(o){
  const P=pal('agri-sprayer',o), g=new THREE.Group();
  const body=new THREE.Mesh(new THREE.BoxGeometry(.30,.10,.40),std(P.body,.15,.45)); body.position.y=.04; g.add(body);
  const top=new THREE.Mesh(new THREE.BoxGeometry(.22,.04,.28),std(P.accent,.2,.5)); top.position.y=.11; g.add(top);
  const tank=new THREE.Mesh(new THREE.CylinderGeometry(.11,.12,.20,16),new THREE.MeshStandardMaterial({color:0xf8f9fa,transparent:true,opacity:.55,roughness:.2}));
  tank.position.y=-.10; g.add(tank);
  const liq=new THREE.Mesh(new THREE.CylinderGeometry(.10,.11,.13,16),std(0x40c057,.1,.3)); liq.position.y=-.135; g.add(liq);
  [Math.PI/4,3*Math.PI/4,5*Math.PI/4,7*Math.PI/4].forEach(a=>{
    const L=.46, ar=arm(L,.018,0x2b2f36); ar.position.set(Math.sin(a)*L/2,.04,Math.cos(a)*L/2); ar.rotation.y=a+Math.PI/2; g.add(ar);
    const ro=rotor(.20,0x2b2f36,0x343a40); ro.position.set(Math.sin(a)*L,.08,Math.cos(a)*L); g.add(ro);
  });
  const boom=new THREE.Mesh(new THREE.CylinderGeometry(.012,.012,.80,8),std(0x495057)); boom.rotation.z=Math.PI/2; boom.position.set(0,-.20,0); g.add(boom);
  [-.34,-.12,.12,.34].forEach(x=>{ const nz=new THREE.Mesh(new THREE.ConeGeometry(.02,.05,8),std(P.accent)); nz.rotation.x=Math.PI; nz.position.set(x,-.23,0); g.add(nz); });
  [-1,1].forEach(sx=>{
    const leg=new THREE.Mesh(new THREE.CylinderGeometry(.012,.012,.24,8),std(0x343a40)); leg.position.set(sx*.13,-.14,0); leg.rotation.z=sx*.25; g.add(leg);
    const skid=new THREE.Mesh(new THREE.CylinderGeometry(.014,.014,.46,8),std(0x343a40)); skid.rotation.x=Math.PI/2; skid.position.set(sx*.16,-.26,0); g.add(skid);
  });
  const fpv=new THREE.Mesh(new THREE.BoxGeometry(.06,.04,.03),std(0x111111,.6,.2)); fpv.position.set(0,.05,.21); g.add(fpv);
  navLights(g,.2,.05,.1);
  return g;
}
/* 救援機：深色機身＋橘色臂、機腹強力探照燈、紅綠航行燈、閃光燈、高腳架 */
function m_rescue2(o){
  const P=pal('rescue-search',o), g=new THREE.Group();
  const body=new THREE.Mesh(new THREE.BoxGeometry(.24,.09,.32),std(P.body,.3,.4)); g.add(body);
  const shell=new THREE.Mesh(new THREE.SphereGeometry(.13,16,10,0,Math.PI*2,0,Math.PI/2),std(P.accent,.2,.45)); shell.scale.set(1,.45,1.25); shell.position.y=.04; g.add(shell);
  [Math.PI/4,3*Math.PI/4,5*Math.PI/4,7*Math.PI/4].forEach(a=>{
    const L=.30, ar=arm(L,.016,P.accent); ar.position.set(Math.sin(a)*L/2,.02,Math.cos(a)*L/2); ar.rotation.y=a+Math.PI/2; g.add(ar);
    const ro=rotor(.13,0x222222,0x2b2b2b); ro.position.set(Math.sin(a)*L,.05,Math.cos(a)*L); g.add(ro);
  });
  const lampB=new THREE.Mesh(new THREE.CylinderGeometry(.04,.05,.07,14),std(0x222222,.7,.3)); lampB.position.set(0,-.08,.08); lampB.rotation.x=.5; g.add(lampB);
  const lens=new THREE.Mesh(new THREE.CircleGeometry(.038,16),new THREE.MeshBasicMaterial({color:0xfff8d0})); lens.position.set(0,-.105,.115); lens.rotation.x=Math.PI/2+.5+Math.PI; g.add(lens);
  const sl=new THREE.PointLight(0xffffff,1.5,12); sl.position.set(0,-.15,.1); g.add(sl);
  const strobe=new THREE.Mesh(new THREE.SphereGeometry(.02,8,6),glow(0xffffff)); strobe.position.set(0,.1,-.08); g.add(strobe);
  [-1,1].forEach(sx=>{ const leg=new THREE.Mesh(new THREE.CylinderGeometry(.01,.01,.2,8),std(0x222222)); leg.position.set(sx*.1,-.12,0); g.add(leg);
    const ft=new THREE.Mesh(new THREE.CylinderGeometry(.012,.012,.26,8),std(0x222222)); ft.rotation.x=Math.PI/2; ft.position.set(sx*.1,-.22,0); g.add(ft); });
  navLights(g,.16,.02,.12);
  return g;
}
/* 橋檢機：工程色機身、四個槳都有護圈、機頂朝上相機（看橋底）＋機頭雲台相機、感測莢艙 */
function m_bridge2(o){
  const P=pal('bridge-probe',o), g=new THREE.Group();
  const body=new THREE.Mesh(new THREE.BoxGeometry(.22,.09,.28),std(P.body,.3,.45)); g.add(body);
  const deck=new THREE.Mesh(new THREE.BoxGeometry(.18,.03,.22),std(P.accent,.25,.45)); deck.position.y=.06; g.add(deck);
  [Math.PI/4,3*Math.PI/4,5*Math.PI/4,7*Math.PI/4].forEach(a=>{
    const L=.26, ar=arm(L,.016,P.accent); ar.position.set(Math.sin(a)*L/2,.02,Math.cos(a)*L/2); ar.rotation.y=a+Math.PI/2; g.add(ar);
    const ro=rotor(.11,0x222222,0x333333); ro.position.set(Math.sin(a)*L,.05,Math.cos(a)*L); g.add(ro);
    const guard=new THREE.Mesh(new THREE.TorusGeometry(.125,.008,6,28),std(P.accent,.3,.5)); guard.rotation.x=Math.PI/2; guard.position.set(Math.sin(a)*L,.07,Math.cos(a)*L); g.add(guard);
  });
  const upCam=new THREE.Mesh(new THREE.CylinderGeometry(.035,.035,.05,14),std(0x111111,.7,.2)); upCam.position.set(0,.1,.02); g.add(upCam);
  const upLens=new THREE.Mesh(new THREE.CircleGeometry(.025,14),new THREE.MeshStandardMaterial({color:0x2244aa,metalness:.9,roughness:.1})); upLens.rotation.x=-Math.PI/2; upLens.position.set(0,.126,.02); g.add(upLens);
  const gim=new THREE.Mesh(new THREE.BoxGeometry(.07,.06,.06),std(0x222222,.6,.3)); gim.position.set(0,-.07,.13); g.add(gim);
  const lens=new THREE.Mesh(new THREE.CircleGeometry(.022,14),new THREE.MeshStandardMaterial({color:0x2244aa,metalness:.9,roughness:.1})); lens.position.set(0,-.07,.161); g.add(lens);
  const pod=new THREE.Mesh(new THREE.CylinderGeometry(.025,.025,.12,10),std(0x444444,.6,.3)); pod.rotation.x=Math.PI/2; pod.position.set(0,-.06,-.04); g.add(pod);
  navLights(g,.15,.03,.1);
  return g;
}
/* 巡檢機：像市售空拍機——流線白機身、斜伸四臂、前方雲台相機、前視感測器、腳架 */
function m_inspect2(o){
  const P=pal('inspect-cam',o), g=new THREE.Group();
  const body=new THREE.Mesh(new THREE.SphereGeometry(.12,20,12),std(P.body,.15,.35)); body.scale.set(.85,.45,1.35); g.add(body);
  const top=new THREE.Mesh(new THREE.BoxGeometry(.1,.02,.16),std(P.accent,.3,.4)); top.position.y=.055; g.add(top);
  [[.11,.09,1],[-.11,.09,1],[.11,-.11,-1],[-.11,-.11,-1]].forEach(([x,z,f])=>{
    const tx=x*2.1, tz=z*1.9+(f>0?.02:-.02);
    const len=Math.hypot(tx-x,tz-z), ar=new THREE.Mesh(new THREE.BoxGeometry(.03,.022,len),std(P.body,.15,.4));
    ar.position.set((x+tx)/2,f>0?.0:-.01,(z+tz)/2); ar.rotation.y=Math.atan2(tx-x,tz-z); g.add(ar);
    const ro=rotor(.09,P.accent,0x868e96); ro.position.set(tx,f>0?.03:.02,tz); g.add(ro);
  });
  const gimbal=new THREE.Mesh(new THREE.BoxGeometry(.05,.04,.04),std(0x1b1f24,.6,.3)); gimbal.position.set(0,-.05,.15); g.add(gimbal);
  const cam=new THREE.Mesh(new THREE.SphereGeometry(.03,14,10),std(0x1b1f24,.6,.25)); cam.position.set(0,-.06,.17); g.add(cam);
  const lens=new THREE.Mesh(new THREE.CircleGeometry(.018,14),new THREE.MeshStandardMaterial({color:0x223a66,metalness:.95,roughness:.05})); lens.position.set(0,-.06,.2); g.add(lens);
  [-.03,.03].forEach(x=>{ const s=new THREE.Mesh(new THREE.CircleGeometry(.008,10),new THREE.MeshBasicMaterial({color:0x111111})); s.position.set(x,.0,.162); g.add(s); });
  navLights(g,-.16,.0,.04);
  return g;
}
/* 貨運機：六軸大機、深色機身、吊掛絞盤＋鋼索＋發光貨箱（userData.cargo 沿用），機頭 -z */
function m_cargo2(o){
  const P=pal('cargo-lift',o), g=new THREE.Group();
  const body=new THREE.Mesh(new THREE.CylinderGeometry(.17,.17,.1,6),std(P.body,.35,.45)); g.add(body);
  const cap=new THREE.Mesh(new THREE.CylinderGeometry(.12,.15,.05,6),std(P.accent,.25,.45)); cap.position.y=.07; g.add(cap);
  for(let k=0;k<6;k++){ const a=k*Math.PI/3+Math.PI/6, L=.42;
    const ar=arm(L,.018,P.body); ar.position.set(Math.sin(a)*L/2,.0,Math.cos(a)*L/2); ar.rotation.y=a+Math.PI/2; g.add(ar);
    const ro=rotor(.15,0x222222,k<2?P.accent:0x2b2b2b); ro.position.set(Math.sin(a)*L,.04,Math.cos(a)*L); g.add(ro); }
  const winch=new THREE.Mesh(new THREE.CylinderGeometry(.04,.04,.08,12),std(0x495057,.6,.3)); winch.rotation.z=Math.PI/2; winch.position.y=-.08; g.add(winch);
  const nose=new THREE.Mesh(new THREE.ConeGeometry(.04,.1,8),glow(0xffffff)); nose.rotation.x=-Math.PI/2; nose.position.z=-.2; g.add(nose);
  const cargo=new THREE.Group();
  const cbx=new THREE.Mesh(new THREE.BoxGeometry(.34,.30,.34),new THREE.MeshStandardMaterial({color:0xc9a26b,roughness:.8}));
  cbx.position.y=-.75; cargo.add(cbx);
  const band=new THREE.Mesh(new THREE.BoxGeometry(.35,.05,.35),std(P.accent,.2,.5)); band.position.y=-.75; cargo.add(band);
  cargo.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,-.08,0),new THREE.Vector3(0,-.6,0)]),new THREE.LineBasicMaterial({color:0xaaaaaa})));
  cargo.add(new THREE.PointLight(P.accent,0.6,2));
  cargo.visible=(o&&o.showCargo===false)?false:true;
  g.add(cargo); g.userData.cargo=cargo;
  return g;
}

export const DRONE_STYLES=[
 {code:'soccer-cage',   name:'足球競賽版',   badge:'足球系', noseAxis:'+z', sim:'足球競賽 3v3（單人＋AI）', feat:'隊色線框保護籠＋內部 LED 發光球＋水平 LED 環', src:'soccer-match.html → makeDroneMesh', build:m_soccer},
 {code:'pvp-cage',      name:'PVP 對戰版',   badge:'足球系', noseAxis:'+z', sim:'PVP 對戰 2/4/6 人', feat:'線框籠＋淡光暈＋X 方臂，綠鼻錐', src:'PVP/soccer-match-2p/4p/6p.html', build:m_pvp},
 {code:'realistic-shell',name:'真實防撞殼版', badge:'足球系', noseAxis:'+z', sim:'真實版足球對戰 FAI F9A-B', feat:'FAI 半透明 bumper 球殼＋旋轉光環', src:'PVP/soccer-realistic.html', build:m_realistic},
 {code:'gk-practice',   name:'守門練習版',   badge:'足球系', noseAxis:'+z', sim:'守門員練習模式', feat:'發光線框籠＋斜十字臂，雙配色', src:'practice-goalkeeper.html', build:m_gkpractice},
 {code:'exp-gk-red',    name:'守門挑戰版',   badge:'足球系', noseAxis:'-z', sim:'守門挑戰任務', feat:'紅色高亮線框籠＋高強度尾燈', src:'exp/exp-goalkeeper.html', build:m_expgk},
 {code:'trainer-orb',   name:'訓練型光球',   badge:'任務系', noseAxis:'-z', sim:'定點懸停訓練', feat:'大線框光球，訓練關卡標準機', src:'exp/exp-hover.html', build:m_hover},
 {code:'chase-ai',      name:'追逐 AI 機',   badge:'任務系', noseAxis:'-z', sim:'追逐任務（AI 目標機）', feat:'桃紅高亮光球、無鼻錐', src:'exp/exp-chase.html', build:m_chaseai},
 {code:'infinite-neon', name:'穿環霓虹版',   badge:'任務系', noseAxis:'-z', sim:'無限穿環挑戰', feat:'青色 emissive 線框球＋黃鼻錐', src:'exp/exp-infinite.html', build:m_infinite},
 {code:'agri-sprayer',  name:'農噴機',       badge:'任務系', noseAxis:'+z', sim:'農田噴灑任務', feat:'草綠機身＋四槳盤＋朝下噴頭', src:'exp/exp-agri.html', build:m_agri2},
 {code:'rescue-search', name:'救援機',       badge:'任務系', noseAxis:'+z', sim:'夜間搜救任務', feat:'橘機身＋探照燈＋紅綠航行燈', src:'exp/exp-rescue.html', build:m_rescue2},
 {code:'bridge-probe',  name:'橋檢機',       badge:'任務系', noseAxis:'+z', sim:'橋梁檢測任務', feat:'工程黃機身＋腹部感測莢艙', src:'exp/exp-bridge.html', build:m_bridge2},
 {code:'inspect-cam',   name:'巡檢機',       badge:'任務系', noseAxis:'+z', sim:'設施巡檢任務', feat:'白方機身＋雲台相機，最像市售空拍機', src:'exp/exp-inspection.html', build:m_inspect2},
 {code:'cargo-lift',    name:'貨運機',       badge:'任務系', noseAxis:'-z', sim:'貨物吊運任務', feat:'琥珀方機身＋鋼索吊掛發光貨箱', src:'exp/exp-cargo.html', build:m_cargo2},
 {code:'multidef-guard',name:'防守機',       badge:'任務系', noseAxis:'-z', sim:'多機防守任務', feat:'紫色方形機身＋紫旋翼', src:'exp/exp-multidef.html', build:m_multidef},
];

/* ── 公開 API ───────────────────────────────────────────── */
const KEY='nd.settings.droneStyle';      // 新命名空間
const LEGACY_KEY='droneSimDroneStyle';   // 基本版舊 key（fallback 讀取）
const SCALE_KEY='nd.settings.droneVisualScale'; // 機體視覺大小（純視覺，不影響物理/碰撞尺寸）

/* ── v3（2026-11-17）：所有關卡的機體一律換成擬真足球無人機 ──
   · 主角：用學生在「我的球機」選的款式／顏色／燈位／隊伍／尾燈（data 在 nd3.ball）。
   · 足球場的 6 台（code='soccer-cage'）：隊伍看 tc 是紅還是藍，sc 跟 tc 不同＝前鋒（環燈換對隊色）；
     其他球的尾燈依序換色、避開主角的尾燈，符合 FAI「每顆球尾燈不同」。
   · 停地外觀由 theme.js 的 settleAll() 統一處理（engine.js 每幀呼叫）。 */
let _tailSeq=0;
function v3Ball(code,opts){
  const scale=(opts.scale!=null)?opts.scale:droneVisualScaleGet();
  const me=ballPrefsGet();
  let o;
  if(code==='soccer-cage'){
    const tc=opts.tc??0x2266ff, red=((tc>>16)&255)>(tc&255);
    const isPlayer=opts.isPlayer??false;
    let tail=me.tail;
    if(!isPlayer){ do{ tail=(_tailSeq++)%TAIL_COLORS.length; }while(tail===me.tail); }
    o={...(isPlayer?ballBuildOpts(me):{cage:'globe',ring:'outer',cageColor:0xdfe5ee}),
       team:red?'red':'blue', striker:(opts.sc!=null&&opts.sc!==tc), tail:TAIL_COLORS[tail].hex,
       // 2026-11-19 老師回饋「球門比球機太小」：足球場上的球機一律照真實比例（直徑 22 cm），
       // 不套「機體視覺大小」偏好（v2 首頁可以設 1.3～3 倍，v3 跟 v2 同網域會讀到同一格 → 球機在場上被放大好幾倍）；
       // 0.556＝球框模型最外緣（燈環外徑 0.516＋管徑 0.04），用它對齊 FIELD_BR，看起來的大小＝碰撞大小。
       scale:FIELD_BR/0.556};
  }else{
    o={...ballBuildOpts(me),scale:scale||1};
    // 隊伍以「我的球機」設定為準（訓練場的紅隊／藍隊出發會直接改這個設定）
  }
  const g=buildSoccerCage(o);
  g.userData.styleCode='soccer-ball';
  g.userData.noseDir=new THREE.Vector3(0,0,-1);
  registerCage(g);
  return g;
}
const FIELD_BR=0.11;      // core/systems/soccer.js FIELD.BR（足球場的球半徑）

/* 2026-11-28 老師：任務情境原本各有自己的無人機（農噴機、救援機、橋檢機…），v3 全部換成「我的球機」後不見了，
   而且球機在大場地的比例跑掉（球比農田一格還大、守門籠被球塞滿）。
   → 任務系機體（badge 任務系＋守門挑戰版）預設用原本的情境專屬機；開始畫面可以切成「我的球機」（存 nd3.taskDrone）。 */
const TASK_KEY='nd3.taskDrone';
export function isTaskStyle(code){ const d=DRONE_STYLES.find(s=>s.code===code); return !!d&&(d.badge==='任務系'||code==='exp-gk-red'); }
export function taskDroneGet(){ try{ return localStorage.getItem(TASK_KEY)==='ball'?'ball':'scene'; }catch{ return 'scene'; } }
export function taskDroneSet(v){ try{ localStorage.setItem(TASK_KEY,v==='ball'?'ball':'scene'); }catch{} }
export function buildDroneStyle(code,opts={}){
  if(V3_BALL&&isTaskStyle(code)){
    if(taskDroneGet()==='ball'){   // 我的球機：縮成跟這個情境機一樣大（量情境機的寬度，不算吊掛貨物）
      const d0=DRONE_STYLES.find(x=>x.code===code), ref=d0.build({...opts,showCargo:false});
      const sz=new THREE.Box3().setFromObject(ref).getSize(new THREE.Vector3()), w=Math.max(sz.x,sz.z)*0.85;
      const k=(opts.scale!=null?opts.scale:droneVisualScaleGet());
      return v3Ball(code,{...opts,scale:k*w/(0.556*2)});
    }
  }else if(V3_BALL)return v3Ball(code,opts);
  const def=DRONE_STYLES.find(s=>s.code===code);
  if(!def){console.warn('[drone-styles] 未知樣式代號：'+code);return null;}
  // tint（席位隊色）：同時映射到各建構函式慣用的 tc / color 參數
  const o={...opts};
  if(opts.tint!=null){ o.tc=o.tc??opts.tint; o.color=o.color??opts.tint; }
  const inner=def.build(o);
  // 機頭規範化：+z 樣式外包一層並旋轉 180°，統一輸出機頭 = -Z
  let g;
  if(def.noseAxis==='+z'){
    g=new THREE.Group();
    inner.rotation.y=Math.PI;
    g.add(inner);
    Object.assign(g.userData, inner.userData); // spin / cargo / ring 上提
  } else {
    g=inner;
  }
  g.userData.styleCode=code;
  g.userData.noseDir=new THREE.Vector3(0,0,-1); // 規範：機頭 = -Z（驗收站據此畫箭頭）
  // 機體視覺大小：呼叫端可用 opts.scale 明確指定（例如 pvp.html 固定傳 1，
  // 避免多人分割畫面裡大小不一致）；沒指定時 fallback 讀取使用者全域偏好
  // （index.html「顯示設定」）。純粹縮放渲染用的 Group，物理/碰撞半徑
  // （core/physics.js、core/systems/soccer.js 的 BR 等）完全不受影響。
  const scale=(opts.scale!=null)?opts.scale:droneVisualScaleGet();
  if(scale && scale!==1) g.scale.setScalar(scale);
  return g;
}

export function droneStyleGet(slot){
  try{
    if(slot){const v=localStorage.getItem(KEY+'.'+slot); if(v)return v;}
    return localStorage.getItem(KEY) || localStorage.getItem(LEGACY_KEY);
  }catch(e){return null;}
}
export function droneStyleSet(code,slot){
  try{localStorage.setItem(KEY+(slot?'.'+slot:''),code);}catch(e){}
}

export function droneVisualScaleGet(){
  try{
    const v=parseFloat(localStorage.getItem(SCALE_KEY));
    return (v>0 && isFinite(v)) ? v : 1;
  }catch(e){return 1;}
}
export function droneVisualScaleSet(scale){
  try{localStorage.setItem(SCALE_KEY,String(scale));}catch(e){}
}
