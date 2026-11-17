/* newdrone 無人機飛行模擬器 © 2026 何政學（新北市立中正國民中學）｜授權 CC BY-NC-SA 4.0（姓名標示─非商業性─相同方式分享），見 LICENSE.md；請保留本聲明 */
/* ============================================================
   home-bg.js — v3 首頁的動態背景（2026-11-17）
   遊戲裡同一個主題場地，幾顆足球無人機繞 8 字飛、偶爾穿過浮空圓環，鏡頭慢慢繞場一圈。
   · 只是背景：不吃輸入、不存任何東西。
   · 省電：手機／小螢幕少放幾顆、解析度降低；切到別的分頁就停；
     系統設定「減少動態效果」時只畫一張靜態畫面。
   · 任何一步失敗（舊電腦沒有 WebGL）都直接放棄，首頁照常可用。
   ============================================================ */
import * as THREE from 'three';
import { buildThemedField, activeTheme } from './theme.js';
import { buildSoccerCage, CAGE_STYLES, CAGE_COLORS, TAIL_COLORS, spinCageProps } from './drone-soccer-cage.js';

export function startHomeBg(canvas){
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const small=Math.min(innerWidth,innerHeight)<700;
  let r;
  try{ r=new THREE.WebGLRenderer({canvas,antialias:!small,powerPreference:'low-power'}); }
  catch(e){ return null; }
  r.setPixelRatio(Math.min(small?1:1.5,devicePixelRatio||1));
  const scene=new THREE.Scene();
  buildThemedField(scene,{size:15,theme:activeTheme()||'neon'});
  const cam=new THREE.PerspectiveCamera(50,1,0.1,400);

  // 浮空圓環（跟關卡裡的穿環一樣的感覺）
  const ringCols=[0x34d3a6,0xffc85c,0xff7ab6];
  const rings=[[-4,3.4,-3,0.5],[4,4.4,2,-0.9],[0,5.4,-5,0.2]].map(([x,y,z,ry],i)=>{
    const g=new THREE.Group();
    g.add(new THREE.Mesh(new THREE.TorusGeometry(1.6,0.09,10,48),new THREE.MeshBasicMaterial({color:ringCols[i]})));
    g.add(new THREE.Mesh(new THREE.TorusGeometry(1.6,0.28,10,48),new THREE.MeshBasicMaterial({color:ringCols[i],transparent:true,opacity:0.16,blending:THREE.AdditiveBlending,depthWrite:false})));
    g.position.set(x,y,z); g.rotation.y=ry; scene.add(g); return g;
  });

  // 足球無人機：款式／顏色／尾燈隨機，紅藍兩隊輪流
  const rnd=(a,b)=>a+Math.random()*(b-a);
  const okTail=TAIL_COLORS.map((c,i)=>c.warn?-1:i).filter(i=>i>=0);
  const N=small?4:7, drones=[];
  for(let i=0;i<N;i++){
    const m=buildSoccerCage({cage:CAGE_STYLES[(i*3)%CAGE_STYLES.length].code,team:i%2?'red':'blue',
      cageColor:CAGE_COLORS[Math.floor(Math.random()*CAGE_COLORS.length)].hex,
      tail:TAIL_COLORS[okTail[Math.floor(Math.random()*okTail.length)]].hex});
    m.rotation.order='YXZ'; scene.add(m);
    drones.push({m,cx:rnd(-5,5),cz:rnd(-6,4),rx:rnd(3,8),rz:rnd(2,5),y:rnd(2.4,5.2),w:rnd(0.16,0.3)*(Math.random()<.5?-1:1),ph:rnd(0,6.28),last:null,yaw:0});
  }

  function size(){ const w=canvas.clientWidth||innerWidth, h=canvas.clientHeight||innerHeight;
    r.setSize(w,h,false); cam.aspect=w/h; cam.updateProjectionMatrix(); }
  addEventListener('resize',size); size();

  const p=new THREE.Vector3();
  let t=rnd(0,40), last=performance.now(), running=true;
  function frame(now){
    const dt=Math.min(0.05,(now-last)/1000); last=now; t+=dt;
    for(const d of drones){
      const a=d.w*t+d.ph;
      p.set(d.cx+d.rx*Math.sin(a), d.y+0.5*Math.sin(a*1.7), d.cz+d.rz*Math.sin(2*a));   // 8 字
      if(d.last){
        const vx=p.x-d.last.x, vz=p.z-d.last.z;
        if(vx*vx+vz*vz>1e-8){
          const yaw=Math.atan2(-vx,-vz);                                   // 機頭 = -Z
          let dy=yaw-d.yaw; while(dy>Math.PI)dy-=2*Math.PI; while(dy<-Math.PI)dy+=2*Math.PI;
          d.yaw+=dy*Math.min(1,dt*6);
          d.m.rotation.y=d.yaw;
          d.m.rotation.x=-0.18;                                            // 往前飛：機頭微低
          d.m.rotation.z=THREE.MathUtils.clamp(-dy*4,-0.35,0.35);          // 轉彎：往內側傾
        }
      }
      d.m.position.copy(p); d.last=(d.last||new THREE.Vector3()).copy(p);
      spinCageProps(d.m,dt,1);
    }
    rings.forEach((g,i)=>{ g.position.y+=Math.sin(t*0.8+i)*0.002; });
    const ca=t*0.035;
    cam.position.set(Math.sin(ca)*15.5,2.4+Math.sin(t*0.1)*0.5,Math.cos(ca)*15.5);
    cam.lookAt(0,1.6,0);
    r.render(scene,cam);
    if(running&&!reduce)requestAnimationFrame(frame);
  }
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){ running=false; }
    else if(!running){ running=true; last=performance.now(); if(!reduce)requestAnimationFrame(frame); }
  });
  requestAnimationFrame(frame);
  return {stop(){ running=false; }};
}
