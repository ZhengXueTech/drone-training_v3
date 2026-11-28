/* newdrone 無人機飛行模擬器 © 2026 何政學（新北市立中正國民中學）｜授權 CC BY-NC-SA 4.0（姓名標示─非商業性─相同方式分享），見 LICENSE.md；請保留本聲明 */
/* ============================================================
   start-panel.js — 關卡開始畫面統一格式的共用小幫手（2026-10-11）
   ------------------------------------------------------------
   UI 規範（以後新關卡都照這個）：
     標題 → 一句重點 summary → 小標籤 tags → （html 橫幅，選用）→ 📖 規則說明（收合）
     → ⚙ 設定（每個設定一列分段選擇：難度／情境／挑戰條件…）→ ▶ 一顆主按鈕「開始」
     → 次要按鈕（機體樣式、操作教學、回關卡列表…）
   用法：
     startPanel(ui,{levelId,title,summary,tags,rules,html,
       diffs:[{v:'easy',label:'初級',hint:'無障礙・120 秒'}],   // 沒有難度就不給
       pre:[...], rows:[...], // 關卡自己的設定列（pre 在難度前、rows 在難度後）
       ch,                    // Challenge 物件：自動加「定高／風／檔位」列
       diffLabel:'⏱ 時間', diffDefault:'normal',   // 選用：難度列改名／預設值
       style:{get:()=>idx,set:i=>{...}},   // 機體樣式：次要按鈕，按一下換下一款
       startLabel:'▶ 開始', onStart:(diff)=>{} })
   難度會記住（nd.diff.<levelId>），下次進來停在上次選的。
   ============================================================ */
import { DRONE_STYLES } from './drone-styles.js';
import { CAGE_STYLES, ballPrefsGet, ballPrefsSet } from './drone-soccer-cage.js';   // v3
import { hasKnowledgeCard, showKnowledgeCard } from '../data/knowledge-cards.js';   // 2026-11-28 情境知識卡
import { isTaskStyle, taskDroneGet, taskDroneSet, TASK_PALETTES, taskColorGet, taskColorSet } from './drone-styles.js';   // 2026-11-28 任務情境機體切換

export function loadDiff(levelId,diffs,def){
  let v=null; try{ v=localStorage.getItem('nd.diff.'+levelId); }catch{}
  return diffs&&diffs.some(d=>d.v===v)?v:(def??diffs?.[0]?.v??null);
}
export function saveDiff(levelId,v){ try{ localStorage.setItem('nd.diff.'+levelId,v); }catch{} }

export function startPanel(ui,o){
  let diff=loadDiff(o.levelId,o.diffs,o.diffDefault);
  const rows=[...(o.pre||[])];   // pre：要排在難度前面的列（例如「情境」）
  if(o.diffs)rows.push({id:'diff',label:o.diffLabel||'🎚 難度',value:diff,options:o.diffs.map(d=>({v:d.v,label:d.label})),
    hint:v=>{ const d=o.diffs.find(x=>x.v===v); return d?(typeof d.hint==='function'?d.hint():d.hint||''):''; },
    onChange:v=>{ diff=v; saveDiff(o.levelId,v); }});
  if(o.rows)rows.push(...o.rows);
  if(o.ch&&o.ch.settingsRows)rows.push(...o.ch.settingsRows());
  { const c0=o.style&&DRONE_STYLES[o.style.get()]?.code;
    if(c0&&TASK_PALETTES[c0])rows.push({id:'tcol',label:'🎨 機體配色',value:String(taskColorGet(c0)),
      options:TASK_PALETTES[c0].map((p,i)=>({v:String(i),label:p.name})),
      hint:()=>taskDroneGet()==='ball'?'（目前用「我的球機」，配色在切回情境機時生效）':'情境專屬機的顏色',
      onChange:v=>{ taskColorSet(c0,+v); o.style.set(o.style.get()); }}); }
  const btns=[{id:'b-go',label:o.startLabel||'▶ 開始',primary:true,onClick:()=>o.onStart&&o.onStart(diff)}];
  const code=o.style&&DRONE_STYLES[o.style.get()]?.code;
  if(o.style&&isTaskStyle(code)){
    // 2026-11-28 任務情境：機體在「情境專屬機」和「我的球機」之間切換
    const name=DRONE_STYLES.find(s=>s.code===code)?.name||'情境機';
    const lab=()=>taskDroneGet()==='ball'?'⚽ 機體：我的球機':'🚁 機體：'+name;
    btns.push({id:'b-style',label:lab(),onClick:()=>{
      taskDroneSet(taskDroneGet()==='ball'?'scene':'ball');
      o.style.set(o.style.get());
      const b=document.getElementById('b-style'); if(b)b.textContent=lab(); }});
  }else if(o.style){
    // v3：按鈕改成換「我的球機」的球框款式（存回 nd3.ball，跟「我的球機」頁同一份設定）
    const lab=()=>'⚽ 球框：'+(CAGE_STYLES.find(c=>c.code===ballPrefsGet().cage)||CAGE_STYLES[0]).name;
    btns.push({id:'b-style',label:lab(),onClick:()=>{
      const b0=ballPrefsGet(), i=CAGE_STYLES.findIndex(c=>c.code===b0.cage);
      ballPrefsSet({...b0,cage:CAGE_STYLES[(i+1)%CAGE_STYLES.length].code});
      o.style.set(o.style.get());                       // 讓關卡重建機體
      const b=document.getElementById('b-style'); if(b)b.textContent=lab(); }});
  }
  if(o.levelId&&hasKnowledgeCard(o.levelId))btns.push({id:'b-know',label:'📖 情境知識卡',onClick:()=>showKnowledgeCard(ui,o.levelId,()=>startPanel(ui,o))});
  if(o.buttons)btns.push(...o.buttons);
  return ui.showModal({title:o.title,summary:o.summary??'',tags:o.tags,rules:o.rules,html:o.html,settings:rows,buttons:btns,align:'top'});
}
