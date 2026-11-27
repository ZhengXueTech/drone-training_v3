/* newdrone 無人機飛行模擬器 © 2026 何政學（新北市立中正國民中學）｜授權 CC BY-NC-SA 4.0（姓名標示─非商業性─相同方式分享），見 LICENSE.md；請保留本聲明 */
/* ============================================================
   power.js — 足球球機的「電池」與「馬達溫度」（2026-11-27）
   ------------------------------------------------------------
   老師回饋：三、四檔約 1 分多鐘就會「速度上不去、升力下降」，比完要拿風扇吹。
   查證後拆成兩個不同的原因，分開模擬（學生可以學著分辨）：
     · 電池電壓下降（sag）：推越多、電越少 → 掉越多；「鬆開油門馬上回來」。
     · 馬達過熱：高檔位持續飛會越積越熱，超過門檻才開始掉力；「降檔也要很久才退」。
   時間對齊 FAI F9A：每局 3 分鐘、局間換電池＋維修 → newSet() 電池充滿、溫度歸零。
   每進一球的 reset() 不會動這裡（同一局內持續累積）。
   只影響有開 d.power 的玩家機（step()）；AI 不經過 step()，不受影響。
   ============================================================ */
export const POWER_CONST={
  // 溫度：dH/dt = 發熱 − 散熱(K_COOL×H)；發熱＝HEAT[檔]×出力
  HEAT:{1:0,2:0.001,3:0.0085,4:0.0115}, K_COOL:0.0025,
  HOT:0.6,            // 超過這個值開始掉力（三檔約 1 分 40 秒、四檔約 1 分 10 秒，激烈飛）
  HOT_SPAN:0.8, HOT_LOSS:0.30,   // 再往上 0.8 → 最多掉 30%
  // 電池：耗電＝底耗＋出力×檔位係數；壓降＝出力×(新電池壓降＋沒電加成)
  DRAIN0:0.0016, DRAIN:0.0021, DRAIN_W:{1:0.6,2:1,3:1.4,4:1.8},
  SAG0:0.05, SAG_LOW:0.18, LOW:0.25,
};
export function powerReset(d){ d.batt=1; d.heat=0; d.sag=0; d.pm=1; d._pwWarn={}; }
/* 每幀呼叫：回傳推力倍率（1＝正常）。inp＝已處理過的搖桿輸入。 */
export function powerStep(d,dt,inp,C=POWER_CONST){
  if(d.batt==null)powerReset(d);
  const g=d.gear||1;
  const demand=Math.min(1,0.15+Math.hypot(inp.pitch||0,inp.roll||0)*0.7+Math.max(0,inp.throttle||0)*0.5);
  d.heat=Math.max(0,d.heat+((C.HEAT[g]||0)*demand-C.K_COOL*d.heat)*dt);
  d.batt=Math.max(0,d.batt-(C.DRAIN0+C.DRAIN*demand*(C.DRAIN_W[g]||1))*dt);
  d.sag=demand*(C.SAG0+C.SAG_LOW*(1-d.batt));
  const hotLoss=Math.min(1,Math.max(0,(d.heat-C.HOT)/C.HOT_SPAN))*C.HOT_LOSS;
  d.pm=(1-d.sag)*(1-hotLoss);
  return d.pm;
}
/* 給 HUD／提示用：回傳要提醒的事件（各只提醒一次，換局後重來） */
export function powerAlerts(d,C=POWER_CONST){
  const out=[]; if(d.batt==null)return out; const w=d._pwWarn||(d._pwWarn={});
  if(d.heat>C.HOT&&!w.hot){ w.hot=1; out.push(['hot','🌡 馬達過熱：速度和升力開始下降（降回一、二檔也要很久才會退）']); }
  if(d.batt<C.LOW&&!w.low){ w.low=1; out.push(['low','🔋 電量偏低：推油門會變軟，鬆開會回來']); }
  return out;
}
export function powerLabel(d,C=POWER_CONST){
  if(d.batt==null)return '';
  return `🔋${Math.round(d.batt*100)}%`+(d.heat>C.HOT?'･🌡過熱':d.heat>C.HOT*0.7?'･🌡偏熱':'');
}
