/* newdrone 無人機飛行模擬器 © 2026 何政學（新北市立中正國民中學）｜授權 CC BY-NC-SA 4.0（姓名標示─非商業性─相同方式分享），見 LICENSE.md；請保留本聲明 */
/* ============================================================
   knowledge-cards.js — 情境知識卡（2026-11-28）
   ------------------------------------------------------------
   任務情境關卡開始畫面多一顆「📖 情境知識卡」：真實世界裡這份工作怎麼做、
   遊戲裡哪個規則對應到真實規範。內容以公開官方文件改寫，卡片底部標出處。
   新增情境：照 agri 的格式加一筆，key＝關卡 levelId。
   ============================================================ */
export const KNOWLEDGE_CARDS={
  'x-agri':{
    title:'📖 情境知識卡 · 農業噴藥無人機',
    lead:'台灣已經有很多田用無人機噴藥：省人力，也讓農民不用背著藥桶走進田裡吸農藥。但它是「會噴藥的飛行器」，規定比一般空拍機嚴格很多。',
    sections:[
      {h:'🎮 遊戲裡的規則，真實世界也有',items:[
        '<b>要飛低才噴得到</b>：真實規範的飛行高度不能超過作物頂端上方 <b>4 公尺</b>；實際試驗多在作物上方 1.5～3 公尺。',
        '<b>有風會把藥吹走</b>：離地 1.5 公尺處風速超過 <b>每秒 3 公尺</b>就要停止噴藥（藥會飄到隔壁田）。',
        '<b>回補給站</b>：真實作業也是一趟一趟回起降點換電池、補藥液。',
        '<b>避開樹和電線桿</b>：起降點要選周圍沒有樹木、電線桿、建築物的空曠處或平坦農道。'
      ]},
      {h:'🧑‍✈️ 誰可以飛？',items:[
        '要有兩張證：民航局的<b>遙控無人機高級專業操作證</b>（噴灑物件要 G2 類），加上<b>空中施作技術類別農藥代噴技術人員證書</b>。',
        '還要加入法人（例如農會、合作社、公司）並登記代噴業，取得民航局許可才能噴。'
      ]},
      {h:'✅ 起飛前要檢查',items:[
        '螺旋槳有沒有裂、馬達有沒有鎖緊、正槳反槳有沒有裝對、電池電量、機臂、噴頭。',
        '噴頭先用清水噴 30 秒量水量，任一個噴頭差超過 ±10% 就要換。'
      ]},
      {h:'🌬 怎麼飛才安全',items:[
        '下雨、打雷、起霧都不能飛。',
        '操作的人站在<b>上風處</b>，從<b>下風處</b>開始噴，橫著風向來回噴（藥霧才不會吹到自己）。',
        '人和無人機保持 <b>20 公尺以上、150 公尺以內</b>。',
        '學校、住家、水源、高壓電、養蜂養魚場、有機農場附近，不確定安全就不要噴；也避免用無人機噴除草劑，以免傷到隔壁田。'
      ]},
      {h:'📊 真實參數範例（鳳梨田）',items:[
        '飛行高度：作物上方 1.5 公尺　飛行速度：每秒 3 公尺　每趟噴幅：約 2.8 公尺',
        '想一想：遊戲裡你的噴灑半徑是 0.7～1 公尺，飛太快會漏噴哪裡？'
      ]}
    ],
    source:'資料來源：農業部農業藥物試驗所〈農噴無人機(Unmanned aerial vehicle, UAV)空中施作規範及基本施藥指引〉（114年5月）；法規以交通部民用航空局公告為準。'
  }
};
export const hasKnowledgeCard=id=>!!KNOWLEDGE_CARDS[id];
/* 分頁顯示（每頁 2 段）：手把、遙控器、觸控都只要按按鈕翻頁，不必捲動 */
export const knowledgePages=id=>{ const c=KNOWLEDGE_CARDS[id]; return c?Math.ceil(c.sections.length/2):0; };
export function knowledgeHtml(id,page=0){
  const c=KNOWLEDGE_CARDS[id]; if(!c)return '';
  const n=knowledgePages(id), secs=c.sections.slice(page*2,page*2+2);
  return `<div class="nd-kcard" style="text-align:left;line-height:1.65;font-size:15px">
    ${page===0?`<p style="margin:0 0 10px;opacity:.92">${c.lead}</p>`:''}
    ${secs.map(s=>`<div style="margin:12px 0 0"><div style="font-weight:700;color:#8fe3ff;margin-bottom:4px">${s.h}</div>
      <ul style="margin:0;padding-left:20px">${s.items.map(t=>`<li style="margin:3px 0">${t}</li>`).join('')}</ul></div>`).join('')}
    <p style="margin:14px 0 0;font-size:12px;opacity:.65">第 ${page+1}／${n} 頁　${page===n-1?c.source:''}</p></div>`;
}
/* 開卡：ui.showModal；onBack＝回開始畫面 */
export function showKnowledgeCard(ui,id,onBack,page=0){
  const c=KNOWLEDGE_CARDS[id]; if(!c)return; const n=knowledgePages(id);
  const btns=[];
  if(page<n-1)btns.push({id:'b-knext',label:'下一頁 ▶',onClick:()=>showKnowledgeCard(ui,id,onBack,page+1)});
  if(page>0)btns.push({id:'b-kprev',label:'◀ 上一頁',onClick:()=>showKnowledgeCard(ui,id,onBack,page-1)});
  btns.push({id:'b-kback',label:'← 回開始畫面',onClick:onBack});
  ui.showModal({title:c.title,html:knowledgeHtml(id,page),buttons:btns,align:'top'});
}
