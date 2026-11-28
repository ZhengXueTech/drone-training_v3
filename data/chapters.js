/* newdrone 無人機飛行模擬器 © 2026 何政學（新北市立中正國民中學）｜授權 CC BY-NC-SA 4.0（姓名標示─非商業性─相同方式分享），見 LICENSE.md；請保留本聲明 */
/* ============================================================
   chapters.js — 首頁「章節」設定（2026-11-28，老師決定：像 DLC 一樣分大章節、由左往右排）
   ------------------------------------------------------------
   · 章節＝「學什麼」（PVE 內容）；對戰（PVP）不算章節，首頁另外有「對戰入口」。
   · 新增一章：在 CHAPTERS 加一筆（levels 填 data/levels-manifest.js 的 id）；
     拿掉一章：刪掉那筆，或 enabled:false（首頁就不顯示）；soon:true＝顯示「即將推出」。
   · links：章節裡的額外入口（例：機庫）。
   ============================================================ */
export const CHAPTERS=[
  { id:'basic', n:1, emoji:'🛫', title:'飛行入門', enabled:true,
    desc:'從地面安全、搖桿對應到搜救任務的 13 關；玩 3 關就能拿體驗證書。',
    levels:['sandbox','acro-freeflight','t01','t02','t03','t04','t05','t06','t07','t08','t09','t10','t11'] },
  { id:'mission', n:2, emoji:'🌾', title:'任務情境', enabled:true,
    desc:'把飛行用在工作上：懸停、追蹤、投遞、農噴、巡檢、搜救、守門。',
    levels:['x-hover','x-chase','x-cargo','x-agri','x-inspection','x-bridge','x-rescue','x-goalkeeper','x-infinite'] },
  { id:'soccer', n:3, emoji:'⚽', title:'無人機足球', enabled:true,
    desc:'先在穿環特訓練對準，再上 3v3；擬真賽規照 FAI 正式比賽判罰。',
    levels:['soccer-aim','soccer','soccer-real'],
    links:[{href:'pages/my-ball.html',label:'⚽ 選我的球機'}] },
  { id:'race', n:4, emoji:'🏁', title:'競速與改機', enabled:true,
    desc:'改裝賽道從操場跑到夜間霓虹；去機庫換零件，回賽道看差多少。',
    levels:['race-playground','race-forest','race-city','race-gym','race-neon'],
    links:[{href:'pages/garage.html',label:'🔧 機庫（換零件）'}] },
  { id:'more', n:5, emoji:'📦', title:'更多章節', enabled:true, soon:true,
    desc:'戰術討論板、VR 親子活動……之後會一章一章加進來。', levels:[] },
];

/* 有對戰版的關卡（關卡卡片標「⚔ 可對戰」，點標籤直接進配對大廳） */
export const PVP_OF={
  soccer:'soccer-pvp','soccer-real':'soccer-pvp',
  'x-hover':'x-hover-pk','x-goalkeeper':'goalkeeper-pk','x-chase':'chase-pk','x-cargo':'cargo-pk','x-agri':'agri-pk',
  'x-rescue':'rescue-pk','x-infinite':'infinite-pk','x-bridge':'bridge-pk','x-inspection':'inspection-pk',
  'race-playground':'race-pk','race-forest':'race-pk','race-city':'race-pk','race-gym':'race-pk','race-neon':'race-pk',
};
