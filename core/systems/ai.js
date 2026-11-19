/* newdrone 無人機飛行模擬器 © 2026 何政學（新北市立中正國民中學）｜授權 CC BY-NC-SA 4.0（姓名標示─非商業性─相同方式分享），見 LICENSE.md；請保留本聲明 */
/* ============================================================
   systems/ai.js — AI 行為（ES Module）v1.0
   newdrone Phase 1｜泛化自基本版 soccer-match.html 狀態機
   ------------------------------------------------------------
   - moveTo：P 控制趨近目標點（所有 AI 共用的基礎行為）
   - updateSoccerAI：足球 3v3 狀態機
       striker：stage（中場對準球門）→ charge（直線衝刺）→ stage
       support：TB 壓迫/攔截玩家、TA 側翼跟隨
       defender：TB 主動阻擋守門（追蹤玩家 X/Y）、TA 攔截敵方 striker
   - 難度參數表 AI_DIFF：速度倍率＋節奏／果斷度（規劃書 §7-1「難度參數表化」；
     2026-07-21 第二輪回饋加大三檔差距＋加入 react/align 節奏參數，
     真正的假動作/人味失誤等行為分級——留待 Phase 4 AI 專題）
   ============================================================ */
import * as THREE from 'three';
import { FIELD, SOCCER_PHYS, TA, TB } from './soccer.js';

// spd/gk/block：移動與撲防速度倍率（med＝原始基準值，不變＝三檔中原本手感不動）
// react：striker 進球/退回後要等多久才能再次衝刺的冷卻時間倍率（越小＝越快再衝）
// align：striker 判斷「是否對準可以衝刺」的容許誤差倍率（越大＝越隨便就衝、越果斷）
export const AI_DIFF={
  // v3（2026-11-17）：速度換成真實 m/s 後，舊的 0.6～1.5 倍差距太大（困難一場被進近百球），收斂成下面這組
  // dbl（2026-11-19 老師選「依難度不同」）：false＝一守門一攔截（守門員貼在球門前不撲出、支援不進球門前 1 m）；
  //   true＝困難才會門前兩台夾擊（守門員可撲出 0.9 m、支援跟到球門口）
  easy:{spd:0.7,  gk:4.0, block:7.0,  react:1.6, align:0.8, look:0.5 ,dbl:false},
  med: {spd:0.8,  gk:6.0, block:9.0,  react:1.3, align:0.85,look:0.3 ,dbl:false},
  hard:{spd:0.9,  gk:9.0, block:12.0, react:1.05,align:0.95,look:0.15,dbl:true},
}

const _tgt=new THREE.Vector3();
let _avoid=null;   // v3：我方 AI 要繞開的對象（玩家）
const AI_ALLY={spd:1.0,gk:9.0,block:12.0,react:1.0,align:1.0,look:0.2};   // v3：你的 AI 隊友（不隨難度變）
/* v3 速度換算：AI 阻力跟玩家「標準」機速一樣（每幀存速 0.93），
   舊程式的 maxSpd 數字 × AI_SPEED ＝ 真的 m/s（中等：前鋒衝刺約 3.6 m/s；玩家二檔全速約 4.9 m/s） */
const AI_DRAG_PER_SEC=Math.pow(0.93,60), AI_K=-Math.log(AI_DRAG_PER_SEC), KP=6, AI_SPEED=0.33;
const pred=(o,t)=>_p.copy(o.pos).addScaledVector(o.vel,t);   // 預判：t 秒後會在哪
const _p=new THREE.Vector3(), _q=new THREE.Vector3();
const keeperOf=(drones,team)=>drones.find(o=>o.team===team&&o.role==='defender');
/* v3（2026-11-17 老師：守備方不可以阻擋得分飛機回程）：對方前鋒進球後在回己方半場（mustReturn）時，
   讓到他回程路線的旁邊（左右錯開 0.7 m 以上、高度不變），等他過去 */
/* v3：守門員／後衛的「反應時間」——每 look 秒才重新看一次對手位置（再往前預判 t 秒），
   所以會慢半拍；難度越高看得越勤（look：簡單 0.5、中等 0.3、困難 0.15 秒） */
function seen(d,o,dt,look,t){
  d._lookT=(d._lookT||0)-dt;
  if(d._lookT<=0||!d._seen){ d._seen=(d._seen||new THREE.Vector3()).copy(o.pos).addScaledVector(o.vel,t); d._lookT=look; }
  return _p.copy(d._seen);
}
function giveWay(d,runner,homeZ,dt,SF){
  const F=FIELD, side=runner.pos.x>0?-1:1;
  _tgt.set(clamp(runner.pos.x+side*0.75,-F.HW+F.BR*2,F.HW-F.BR*2),
           clamp(d.pos.y,F.BR+.1,F.FH-F.BR-.1),homeZ);
  moveTo(d,_tgt,dt,8*SF);
}
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

/* P 控制趨近：距離×4.5 決定期望速度（上限 maxSpd），機頭轉向目標
   [FIX] 基本版把「世界座標」速度誤差直接塞進 integrate 的「機體座標」參數：
   yaw=0 的藍隊沒事，yaw=π 的紅隊指令整組反轉——紅隊 striker 永遠卡在
   自家底線牆上、從未成功進攻（基本版潛在 bug，headless 實測證實）。
   修正：先把世界系指令旋回機體系（ax=wx·cy−wz·sy, az=wx·sy+wz·cy），
   yaw=0 時與基本版完全相同（藍隊手感不變），yaw=π 時方向正確。 */
export function moveTo(d,tgt,dt,maxSpd){
  const P=SOCCER_PHYS;
  // 2026-08-03 新增（使用者回饋：AI 被撞後應該跟玩家一樣會「訊號異常」，
  // 不能撞完下一幀就秒修正回來，否則人機不公平）：AI 沒有搖桿輸入可以
  // 打折，但 moveTo() 就是 AI 版的「下指令給機身」——跟玩家的 dampInput()
  // 同一個概念，改成凍結異常觸發當下算出來的那組 (ax,ay,az,yr) 指令，
  // 之後每幀原樣重播，不再依 tgt 重新算，直到異常結束；updateSoccerAI()
  // 的狀態機（aiState/aiT）繼續照常演進——這代表「AI 的大腦還在想」，
  // 只是「訊號送不到機身」，跟玩家「手還在動搖桿、機身收不到」是同一回事。
  if(d.anomalyT>0){
    d.anomalyT=Math.max(0,d.anomalyT-dt);
    if(d._frozenCmd){
      d.integrate(dt,d._frozenCmd[0],d._frozenCmd[1],d._frozenCmd[2],d._frozenCmd[3]);
      if(d.anomalyT<=0)d._frozenCmd=null;
      return;
    }
  }else{
    d._frozenCmd=null;
  }
  d._dragPerSec=AI_DRAG_PER_SEC;
  // v3：剛被撞到的那一小段時間（knockT，由 resolveCollisions 設定）不能操控，只能被彈著走、維持高度
  if(d.knockT>0){ d.knockT-=dt; d.integrate(dt,0,P.HOVER-d.vel.y*2,0,0); return; }
  // v3（2026-11-17 老師：我方隊友一直撞到自己的前鋒）：隊友繞開玩家——
  // ①離玩家 0.6 m 內往外推開 ②要去的路線會擦過玩家（0.35 m 內）就往旁邊偏
  if(_avoid&&_avoid!==d){
    const ax0=d.pos.x-_avoid.pos.x, ay0=d.pos.y-_avoid.pos.y, az0=d.pos.z-_avoid.pos.z, r0=Math.hypot(ax0,ay0,az0);
    tgt=tgt.clone();
    if(r0<0.6&&r0>1e-3){ const k=(0.6-r0)*2.5/r0; tgt.x+=ax0*k; tgt.y+=ay0*k; tgt.z+=az0*k; }
    const sx=tgt.x-d.pos.x, sy=tgt.y-d.pos.y, sz=tgt.z-d.pos.z, L2=sx*sx+sy*sy+sz*sz;
    if(L2>1e-4){ const u=clamp(-(ax0*sx+ay0*sy+az0*sz)/L2,0,1);
      const cx=d.pos.x+sx*u-_avoid.pos.x, cz=d.pos.z+sz*u-_avoid.pos.z, cy2=d.pos.y+sy*u-_avoid.pos.y;
      const cd=Math.hypot(cx,cy2,cz);
      if(u>0&&u<1&&cd<0.35){ const side=(cx>=0?1:-1); tgt.x=_avoid.pos.x+side*0.45; } }
  }
  const toT=tgt.clone().sub(d.pos);
  const dist=toT.length();                          // v3：AI 跟玩家同一套阻力（見下方 AI_DRAG）
  if(dist<.03){ // 到了：把速度煞住
    const sy0=Math.sin(d.yaw), cy0=Math.cos(d.yaw), bx=-d.vel.x*KP, bz=-d.vel.z*KP;
    d.integrate(dt,bx*cy0-bz*sy0,P.HOVER-d.vel.y*KP,bx*sy0+bz*cy0,0); return; }
  // v3（2026-11-17 老師回饋：足球太慢、AI 笨）：maxSpd 沿用舊的數字，乘 AI_SPEED 換算成真的 m/s；
  // 加速度＝阻力補償＋比例控制，所以 AI 真的會到達想要的速度（舊版只到 1/18，跑得很慢）
  const spd=clamp(dist*4.5,0,maxSpd*AI_SPEED);
  const vt=toT.clone().normalize().multiplyScalar(spd);
  const wx=AI_K*vt.x+KP*(vt.x-d.vel.x), wz=AI_K*vt.z+KP*(vt.z-d.vel.z);   // 期望世界系加速度
  const wy=AI_K*vt.y+KP*(vt.y-d.vel.y);
  const ty=Math.atan2(toT.x,toT.z);                       // 機頭轉向目標
  const yd=Math.atan2(Math.sin(ty-d.yaw),Math.cos(ty-d.yaw));
  const sy=Math.sin(d.yaw), cy=Math.cos(d.yaw);
  const ax=wx*cy-wz*sy, ay=P.HOVER+wy, az=wx*sy+wz*cy, yr=yd*4.5;
  if(d.anomalyT>0)d._frozenCmd=[ax,ay,az,yr];
  d.integrate(dt, ax,ay,az,yr);
}

/* 足球 AI（沿基本版 updateAI；ctx={drones,player,SF,diff}） */
export function updateSoccerAI(d,dt,ctx){
  if(d.isPlayer)return;
  const F=FIELD, {drones,player}=ctx;
  const SF=ctx.SF??1, D=d.team===TA?AI_ALLY:AI_DIFF[ctx.diff??'med'];   // v3：難度只影響對手；你的隊友固定水準
  _avoid=d.team===TA?ctx.player:null;                                   // v3：我方隊友繞開你
  const isA=d.team===TA;
  const attkGZ=isA?F.GZ:-F.GZ;
  const ds=isA?1:-1;
  d.aiT-=dt;

  // FAI：進球後退回己方半場
  if(d.mustReturn){
    _tgt.set((d.i%2-.5)*.3,1.2,isA?-.6:.6);
    moveTo(d,_tgt,dt,6*SF*D.spd);
    return;
  }

  switch(d.role){
    case 'striker':{   // stage → charge → stage
      // v3 聰明一點：①從守門員的另一側切入（不再永遠正面直衝）②衝刺途中前面被擋住就放棄、重新繞
      const gk=keeperOf(drones,isA?TB:TA);
      if(d.aiState==='charge'){
        // v3：先飛到球門正前方 0.35 m 的「對準點」，再直直穿過去（不會斜斜撞到環）；
        // 對準點之前如果守門員擋在路上，先從他旁邊繞（貼著他側邊 0.3 m）
        const toPlane=(attkGZ-d.pos.z)*ds;
        if(toPlane>0.45) _tgt.set(0,F.GY,attkGZ-ds*.35); else _tgt.set(0,F.GY,attkGZ+ds*.1);
        if(gk&&toPlane>0.45){ const dz=(gk.pos.z-d.pos.z)*ds, lat=gk.pos.x-d.pos.x, lv=gk.pos.y-d.pos.y;
          if(dz>0&&dz<0.8&&Math.hypot(lat,lv)<F.BR*2.6){
            const side=Math.abs(lat)>0.02?(lat>0?-1:1):(d.lane||1);
            _tgt.set(clamp(gk.pos.x+side*0.3,-F.HW+F.BR*2,F.HW-F.BR*2),F.GY,gk.pos.z); } }
        moveTo(d,_tgt,dt,11*SF*D.spd);
        if(gk){   // 守門員就擋在前面（正前方 0.5 m 內、左右差不到一顆球）→ 換邊重來
          _q.copy(gk.pos).sub(d.pos);
          if(_q.z*ds>0&&_q.z*ds<0.5&&Math.hypot(_q.x,_q.y-0)<F.BR*1.6&&Math.random()<dt*3*D.align){
            d.aiState='stage'; d.lane=-(d.lane||1); d.aiT=0.2*D.react; }
        }
        // [難度] 衝刺後回到 stage 的冷卻時間 × D.react：hard 更快再度出擊，
        // easy 讓玩家有更多喘息空間
        if((d.pos.z-attkGZ)*ds>=0.06){d.aiState='stage';   // v3：穿過環面 6 cm 才算衝完（舊版差 5 cm 就收手，球永遠進不了）
          d.aiT=(2.2+Math.random()*1.8)*D.react;d.lane=0;}   // v3：衝完喘一下再組織下一波（真實比賽一波進攻約 3～5 秒）
      }else{
        const stgZ=isA?.8:-.8;
        if(!d.lane&&gk) d.lane=gk.pos.x>0?-1:1;            // 選守門員沒站的那一邊
        const sideX=(d.lane||0)*Math.min(0.55,F.HW-F.BR*3);
        _tgt.set(sideX,F.GY,stgZ);
        moveTo(d,_tgt,dt,6*SF*D.spd);
        // 對準窗口比基本版放寬（.13/.25→.2/.35）：基本版此路徑因 moveTo bug
        // 從未實際執行；實測太嚴時 striker 被防守碰撞後很難再進入攻擊循環
        // [難度] × D.align：hard 較隨便就判定「對準」了、更果斷衝刺；
        // easy 要站得更準才會出手，給玩家防守反應時間（med＝原始基準不變）
        const aligned=Math.abs(d.pos.x-sideX)<.2*D.align&&Math.abs(d.pos.y-F.GY)<.2
                    &&Math.abs(d.pos.z-stgZ)<.35*D.align;
        if(aligned&&d.aiT<0){d.aiState='charge';d.aiT=3;}
      }
      break;
    }
    case 'support':{
      if(d.team===TB){
        // 敵方支援：預判玩家 0.35 秒後的位置，擋在玩家和球門之間（v3）
        if(player.mustReturn){ giveWay(d,player,.5,dt,SF); break; }
        if(player.pos.z>0){
          pred(player,0.35);
          // 簡單／中等：支援只在球門前 1 m 以外攔截，你衝進去它就停在外圍（守門交給守門員，不兩台夾）
          _tgt.set(_p.x*.8,clamp(_p.y,F.BR+.1,F.FH-F.BR-.1),clamp(_p.z+.35,0,D.dbl?F.GZ-.3:F.GZ-1.0));
        }
        else _tgt.set(d.i%2===0?-.4:.4,1.3,.5);
      }else{
        // 我方支援（v3）：你在進攻時，去卡住對方守門員（站在守門員和你之間），幫你開路；
        // 沒在進攻時跟在你旁邊
        const bS=drones.find(o=>o.team===TB&&o.role==='striker');
        if(bS&&bS.mustReturn&&d.pos.distanceTo(bS.pos)<0.9){ giveWay(d,bS,d.pos.z,dt,SF); break; }   // v3：別擋對方回程
        const gk=keeperOf(drones,TB);
        if(gk&&player.pos.z>0.3&&player.role==='striker'&&!player.mustReturn){
          // 你進攻時：直接衝去撞開對方守門員（預判他 0.25 秒後的位置），幫你清出射門路線
          pred(gk,0.25); _tgt.copy(_p);
          _tgt.x+=(gk.pos.x>=player.pos.x?1:-1)*0.12;          // 從守門員「不在你那一側」撞過去，把他推離你的路線
          moveTo(d,_tgt,dt,9*SF*D.spd); break;
        }else{
          _tgt.copy(player.pos);
          _tgt.z-=.5; _tgt.x+=(d.i%2===0?-.35:.35);
        }
        _tgt.y=clamp(_tgt.y,F.BR+.1,F.FH-F.BR-.2);
      }
      moveTo(d,_tgt,dt,5.5*SF*D.spd);
      break;
    }
    case 'defender':{
      if(d.team===TB){   // TB 守門員：主動阻擋
        if(player.mustReturn){ giveWay(d,player,F.GZ-.5,dt,SF); break; }   // v3：玩家進球後回程，不能擋
        const distP=d.pos.distanceTo(player.pos);
        const approaching=player.pos.z>F.GZ*.3;
        seen(d,player,dt,D.look,0.3);                         // v3：預判玩家 0.3 秒後的位置，但有反應時間（D.look）
        if(distP<(D.look>0.4?0.55:D.look>0.2?0.45:0.35)&&approaching){   // v3：越難越不會衝出去亂撲，守住射門線
          _tgt.set(clamp(_p.x,-F.HW+F.BR*2,F.HW-F.BR*2),
                   clamp(_p.y,F.BR+.1,F.FH-F.BR-.1),
                   clamp(_p.z,D.dbl?F.GZ-.9:F.GZ-.55,F.GZ-.1));   // 簡單／中等：最多離開球門 0.55 m，不撲出來
          moveTo(d,_tgt,dt,D.block*SF);
        }else if(approaching){
          // 站在「玩家 → 球門中心」連線上、球門前 0.5 m（封住射門角度）
          const gzD=F.GZ-.5, t=clamp((gzD-_p.z)/Math.max(.01,F.GZ-_p.z),0,1);
          _tgt.set(clamp(_p.x+(0-_p.x)*t,-F.HW+F.BR*2,F.HW-F.BR*2),
                   clamp(_p.y+(F.GY-_p.y)*t,F.BR+.1,F.FH-F.BR-.1),gzD);
          moveTo(d,_tgt,dt,D.gk*SF);
        }else{
          _tgt.set(0,F.GY,F.GZ-.5);
          moveTo(d,_tgt,dt,4*SF);
        }
      }else{             // TA 後衛：攔截敵方 striker（drones[3]）
        const bStr=drones[3];
        if(bStr&&bStr.mustReturn){ giveWay(d,bStr,-F.GZ+.55,dt,SF); break; }   // v3：對方前鋒進球後回程，不能擋
        // v3：我方球門沒危險（對方前鋒還在他們半場）而你在進攻時，後衛上前去撞開「正在夾你」的對方支援
        const bSup=drones.find(o=>o.team===TB&&o.role==='support');
        if(bStr&&bSup&&player.pos.z>0.2&&bStr.pos.z>0.3&&bSup.pos.distanceTo(player.pos)<1.2){
          pred(bSup,0.25); _tgt.copy(_p); moveTo(d,_tgt,dt,9*SF*D.spd); break;
        }
        // v3：跟對方守門員同一套守法——站在「對方前鋒 → 我方球門中心」連線上、球門前 0.5 m 封角度；
        // 對方前鋒衝到很近才撲上去擋（有反應時間，不是神）
        if(bStr&&bStr.pos.z<-F.GZ*.3){
          seen(d,bStr,dt,D.look,0.3);
          const ownZ=-F.GZ, lineZ=ownZ+.5;
          if(d.pos.distanceTo(bStr.pos)<0.45){
            _tgt.set(clamp(_p.x,-F.HW+F.BR*2,F.HW-F.BR*2),clamp(_p.y,F.BR+.1,F.FH-F.BR-.1),clamp(_p.z,ownZ+.1,ownZ+.9));
            moveTo(d,_tgt,dt,D.block*SF); break;
          }
          const t=clamp((_p.z-lineZ)/Math.max(.01,_p.z-ownZ),0,1);
          _tgt.set(clamp(_p.x+(0-_p.x)*t,-F.HW+F.BR*2,F.HW-F.BR*2),
                   clamp(_p.y+(F.GY-_p.y)*t,F.BR+.1,F.FH-F.BR-.1),lineZ);
          moveTo(d,_tgt,dt,D.gk*SF); break;
        }
        _tgt.set(0,F.GY,-F.GZ+.5);
        moveTo(d,_tgt,dt,4*SF);
      }
      break;
    }
  }
}
