/* newdrone 無人機飛行模擬器 © 2026 何政學（新北市立中正國民中學）｜授權 CC BY-NC-SA 4.0（姓名標示─非商業性─相同方式分享），見 LICENSE.md；請保留本聲明 */
/* ============================================================
   class-login.js — 新版班級登入（2026-11-19，雲端新版第三階段）
   ------------------------------------------------------------
   老師在後台開班、印小紙條；學生掃那一班的 QR 碼（網址帶 gas＋cls＋room）進首頁，
   這裡跳出登入框：班級（QR 帶進來就固定）＋座號＋4 碼登入碼＋暱稱（選填，不要用真名）。
   登入只記在這個分頁（cloud-sync.js 的 sessionStorage），關掉瀏覽器就登出。
   右下角的小牌子：登入後顯示「801 班 3 號」＋換人；沒登入顯示「登入班級」。
   只有新版班級（nd.class.v3）才出現；舊方式的老師、沒連雲端的完全不受影響。
   ============================================================ */
import { cloudInit, classInfo, classIsV3 } from './cloud-api.js';
import { login, logout, auth, status, onCloudStatus, flush } from '../data/cloud-sync.js';

const ROOM='nd3.room', LAST='nd3.lastRoom';
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function room(){ try{ return sessionStorage.getItem(ROOM)||localStorage.getItem(LAST)||''; }catch{ return ''; } }
function roomFixed(){ try{ return !!sessionStorage.getItem(ROOM); }catch{ return false; } }

const CSS=`
#cl-chip{position:fixed;right:16px;bottom:16px;z-index:40;display:flex;align-items:center;gap:8px;padding:8px 14px;border-radius:999px;
  background:rgba(8,20,40,.88);border:1px solid var(--acc,#3ee6b0);color:#fff;font-size:14px;box-shadow:0 6px 24px rgba(0,0,0,.35)}
#cl-chip button{font:inherit;font-size:13px;border:1px solid rgba(255,255,255,.35);background:transparent;color:#fff;border-radius:999px;padding:3px 10px;cursor:pointer}
#cl-chip .warn{color:#ffd27a}
#cl-mask{position:fixed;inset:0;z-index:60;background:rgba(3,8,18,.72);display:flex;align-items:center;justify-content:center;padding:16px}
#cl-box{width:min(420px,100%);background:#0f1b2e;color:#eaf2ff;border:1px solid var(--acc,#3ee6b0);border-radius:20px;padding:22px 22px 18px;box-shadow:0 20px 60px rgba(0,0,0,.5)}
#cl-box h3{margin:0 0 4px;font-size:21px}#cl-box .who{color:#9fb8d6;font-size:14px;margin-bottom:14px}
#cl-box label{display:block;font-size:14px;color:#9fb8d6;margin:10px 0 4px}
#cl-box input{width:100%;font:inherit;font-size:20px;padding:9px 12px;border-radius:12px;border:1px solid #2c3f5c;background:#0a1424;color:#fff}
#cl-box input[readonly]{opacity:.75}
#cl-box .pin{letter-spacing:8px;font-weight:800;text-align:center}
#cl-box .row2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
#cl-box .hint{font-size:12px;color:#7f93ad;margin-top:4px}
#cl-box .acts{display:flex;gap:10px;margin-top:16px}
#cl-box .acts button{flex:1;font:inherit;font-size:17px;font-weight:800;padding:11px;border-radius:12px;cursor:pointer;border:1px solid #2c3f5c;background:transparent;color:#cfe0f5}
#cl-box .acts .go{background:var(--acc,#3ee6b0);border-color:var(--acc,#3ee6b0);color:#04121f}
#cl-msg{min-height:22px;font-size:14px;margin-top:10px}#cl-msg.err{color:#ff9b8a}#cl-msg.ok{color:#7ff0c9}`;

function chip(){
  let el=$('cl-chip');
  if(!el){ el=document.createElement('div'); el.id='cl-chip'; document.body.appendChild(el);
    el.addEventListener('click',ev=>{ const b=ev.target.closest('button'); if(!b)return;
      if(b.dataset.a==='in')openLogin();
      else if(b.dataset.a==='out'){ logout(); paint(); openLogin(); } }); }
  return el;
}
function paint(){
  const a=auth(), st=status(), el=chip();
  if(a){ const nm=a.name&&!/班 \d+ 號$/.test(a.name)?'（'+esc(a.name)+'）':'';
    el.innerHTML='☁ '+esc(a.classId)+' 班 '+esc(a.seat)+' 號'+nm+(st.pending?' <span class="warn">待上傳 '+st.pending+'</span>':'')+(st.error?' <span class="warn" title="'+esc(st.error)+'">⚠</span>':'')+' <button data-a="out">換人</button>'; }
  else el.innerHTML='☁ 還沒登入，成績不會上傳 <button data-a="in">登入班級</button>';
}
export function openLogin(){
  const info=classInfo()||{}, r=room(), fixed=roomFixed()&&r;
  let m=$('cl-mask'); if(m)m.remove();
  m=document.createElement('div'); m.id='cl-mask';
  m.innerHTML=`<form id="cl-box" autocomplete="off"><h3>登入班級</h3>
    <div class="who">${esc(info.school||'')} ${esc(info.teacher||'')} 老師的班級</div>
    <div class="row2"><div><label>班級</label><input id="cl-cls" value="${esc(r)}" ${fixed?'readonly':''} maxlength="10" placeholder="例：801"></div>
    <div><label>座號</label><input id="cl-seat" type="number" inputmode="numeric" min="1" max="60" placeholder="例：5"></div></div>
    <label>登入碼（老師發的小紙條，4 個數字）</label><input id="cl-pin" class="pin" inputmode="numeric" maxlength="4" placeholder="• • • •">
    <label>暱稱（選填）</label><input id="cl-nick" maxlength="10" placeholder="排行榜可以顯示，不要用真名">
    <div id="cl-msg"></div>
    <div class="acts"><button type="button" id="cl-skip">先不登入</button><button type="submit" class="go" id="cl-go">登入</button></div>
    <div class="hint" style="margin-top:10px">關掉瀏覽器就會登出；下一位同學用同一台電腦要重新登入。</div></form>`;
  document.body.appendChild(m);
  const msg=(t,c)=>{ const e=$('cl-msg'); e.textContent=t; e.className=c||''; };
  $(fixed?'cl-seat':'cl-cls').focus();
  $('cl-pin').addEventListener('input',e=>{ e.target.value=e.target.value.replace(/\D/g,'').slice(0,4); });
  $('cl-skip').onclick=()=>{ m.remove(); paint(); };
  $('cl-box').onsubmit=async ev=>{
    ev.preventDefault();
    const cls=$('cl-cls').value.trim(), seat=$('cl-seat').value.trim(), pin=$('cl-pin').value.trim(), nick=$('cl-nick').value.trim();
    if(!cls||!seat){ msg('班級、座號都要填','err'); return; }
    if(!/^\d{4}$/.test(pin)){ msg('登入碼是 4 個數字','err'); return; }
    $('cl-go').disabled=true; msg('登入中…（雲端第一次會比較慢，最多等 20 秒）');
    const r=await login({school:info.school||'',classId:cls,seat,name:nick,pw:pin},{onWait:i=>msg('雲端忙線中，自動重試第 '+i+' 次…')});
    $('cl-go').disabled=false;
    if(!r.ok){ msg(r.error||'登入失敗','err'); return; }
    try{ localStorage.setItem(LAST,cls); }catch{}
    msg('登入成功！'+(r.restored?'從雲端拉回 '+r.restored+' 關紀錄。':''),'ok');
    setTimeout(()=>{ m.remove(); paint(); if(r.restored)location.reload(); },900);
  };
}
/* 首頁呼叫：新版班級才掛上小牌子；open＝剛從 QR 碼進來，直接跳登入框（已登入就不跳） */
export async function mountClassLogin({open=false}={}){
  await cloudInit();
  if(!classIsV3())return false;
  if(!$('cl-css')){ const s=document.createElement('style'); s.id='cl-css'; s.textContent=CSS; document.head.appendChild(s); }
  paint(); onCloudStatus(paint); flush();
  if(open&&!auth())openLogin();
  return true;
}
