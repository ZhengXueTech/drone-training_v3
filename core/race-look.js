/* newdrone 無人機飛行模擬器 © 2026 何政學（新北市立中正國民中學）｜授權 CC BY-NC-SA 4.0（姓名標示─非商業性─相同方式分享），見 LICENSE.md；請保留本聲明 */
/* ============================================================
   race-look.js — 改裝賽道場景跟 v3 畫面主題對齊（2026-11-28，老師：「改裝賽道建築物配色跟風格要調整」）
   ------------------------------------------------------------
   v3 的場地（core/theme.js：霓虹夜航／黃昏賽博）是深色地面＋發光格線＋城市剪影，
   賽道裡原本 v2 的大樓、樹、體育館是白天寫實配色，放在一起很突兀。
   這裡給賽道資料（data/tracks/*.js 的 decorate）用：
     look()            目前主題的配色（主題關閉＝null，賽道照原本 v2 外觀）
     edges(mesh,c,o)   幫物體加發光外框線（不用後製光暈，舊電腦也跑得動）
     hideThemeBits(scene,{skyline,grid}) 藏掉不適合的主題物件（森林、室內不要城市剪影／地面格線）
     windowTex(L)      深色大樓＋發光窗戶貼圖（當 emissiveMap 用）
   ============================================================ */
import * as THREE from 'three';
import { THEMES, activeTheme } from './theme.js';

export function look(){ const t=activeTheme(); return t?{id:t,...THEMES[t]}:null; }
export function edges(mesh,color,opacity=0.7){
  const e=new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry,25),
    new THREE.LineBasicMaterial({color,transparent:opacity<1,opacity}));
  mesh.add(e); return e;
}
export function hideThemeBits(scene,{skyline=false,grid=false,stars=false}={}){
  const f=scene.getObjectByName('field'); if(!f)return;
  f.traverse(o=>{
    if(skyline&&o.name==='skyline')o.visible=false;
    if(grid&&o.type==='GridHelper')o.visible=false;
    if(stars&&o.isPoints)o.visible=false;
  });
}
let _seed=7; const R=()=>((_seed=(_seed*1664525+1013904223)>>>0)/4294967296);
export function windowTex(L){
  const c=document.createElement('canvas'); c.width=64; c.height=128; const g=c.getContext('2d');
  g.fillStyle='#000'; g.fillRect(0,0,64,128);
  const cols=[...L.caps.map(h=>'#'+h.toString(16).padStart(6,'0')),'#ffe9a8'];
  for(let y=6;y<128;y+=14)for(let x=5;x<64;x+=15){
    const r=R(); if(r<0.5)continue;
    g.fillStyle=cols[Math.floor(R()*cols.length)]; g.globalAlpha=0.55+R()*0.45; g.fillRect(x,y,9,7); }
  g.globalAlpha=1;
  const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.colorSpace=THREE.SRGBColorSpace; return t;
}
