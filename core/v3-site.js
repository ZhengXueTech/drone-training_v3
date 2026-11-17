/* newdrone 無人機飛行模擬器 © 2026 何政學（新北市立中正國民中學）｜授權 CC BY-NC-SA 4.0（姓名標示─非商業性─相同方式分享），見 LICENSE.md；請保留本聲明 */
/* v3 網站頁面的主題（不載入 three.js）。跟 core/theme.js 的 activeTheme() 讀同一個設定 nd3.theme。 */
export const SITE_THEMES={neon:'霓虹夜航',dusk:'黃昏賽博'};
export function siteTheme(){
  const t=new URLSearchParams(location.search).get('theme');
  if(t==='off'||SITE_THEMES[t])return t;
  try{ const s=localStorage.getItem('nd3.theme'); if(s==='off'||SITE_THEMES[s])return s; }catch{}
  return 'neon';
}
export function setSiteTheme(t){ try{ localStorage.setItem('nd3.theme',t); }catch{} applySiteTheme(); }
export function applySiteTheme(){
  document.body.classList.toggle('site-dusk',siteTheme()==='dusk');
}
