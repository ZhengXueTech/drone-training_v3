/* newdrone 無人機飛行模擬器 © 2026 何政學（新北市立中正國民中學）｜授權 CC BY-NC-SA 4.0（姓名標示─非商業性─相同方式分享），見 LICENSE.md；請保留本聲明 */
/* ============================================================
   feedback.js — 撞擊回饋（2026-11-19，老師回饋「球機碰撞回彈不明顯，要有碰撞回饋」）
   ------------------------------------------------------------
   · 物理層（physics.js／soccer.js／yaw-drone.js／race.js…）撞到東西時呼叫 bump(drone, 撞擊速度)。
   · 只有「玩家在操控」的機體才有回饋：玩家那台每幀 step/update 時會記下 d._ctl（輸入來源），
     AI 機體從來不經過 step/update，所以 AI 自己撞來撞去不會讓你的手把震。
   · 回饋內容：
       ① 撞擊音效：撞越大力聲音越大（跟著關卡的「音效」開關，預設關）。
       ② 震動：Xbox／PS 手把（Chrome/Edge 的 vibrationActuator）；手機平板觸控玩家用 navigator.vibrate
          （Android 有效、iPhone 不支援，沒有就安靜略過）。nd.settings.rumble＝false 可關，預設開。
   · 持續貼著牆／地面＝同一次接觸，只在剛撞上的那一下回饋（兩次碰撞要隔 0.25 秒以上）。
   ============================================================ */
'use strict';
import { sfx } from './audio.js';

const KEY='nd.settings.rumble';
export function rumbleOn(){ try{ return localStorage.getItem(KEY)!=='false'; }catch{ return true; } }
export function setRumble(on){ try{ localStorage.setItem(KEY,on?'true':'false'); }catch{} }

/* kind：'wall'（牆／網／障礙）'floor'（地板）'drone'（機體互撞）'ring'（球門環） */
const MIN={wall:0.6,floor:1.2,drone:0.5,ring:0.5};
const _last=new WeakMap();

export function bump(d,speed,kind='wall'){
  const c=d&&d._ctl;
  if(!c||!c.device||c.device==='none'||c.device==='ai')return;
  if(!(speed>(MIN[kind]??0.6)))return;
  // 貼著牆／躺在地上時每幀都會「再碰一次」：只要上一次碰撞在 0.25 秒內，就當作同一次接觸，不再回饋（也不刷新音效）
  const now=performance.now(), last=_last.get(d)||0;
  _last.set(d,now);
  if(now-last<250)return;
  const s=Math.min(1,(speed-(MIN[kind]??0.6))/4+0.15);      // 0.15～1
  try{ sfx.hit(s,kind); }catch{}
  if(!rumbleOn())return;
  try{
    if(c.device==='gamepad'&&c.pad!=null){
      const gp=(navigator.getGamepads?navigator.getGamepads():[])[c.pad];
      const va=gp&&gp.vibrationActuator;
      if(va&&va.playEffect) va.playEffect('dual-rumble',{startDelay:0,duration:Math.round(60+160*s),
        strongMagnitude:Math.min(1,0.25+0.75*s),weakMagnitude:Math.min(1,0.4+0.6*s)}).catch(()=>{});
    }else if(c.device==='touch'&&navigator.vibrate){
      navigator.vibrate(Math.round(25+70*s));
    }
  }catch{}
}
