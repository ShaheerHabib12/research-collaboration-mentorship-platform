/**
 * Light and dark theme. The choice is a display preference kept in this browser only
 * (localStorage key "rcmp-theme"); no server sees it. Without a saved choice the
 * operating system setting decides.
 */
const KEY = 'rcmp-theme';
const read = () => { try { return localStorage.getItem(KEY); } catch (e) { return null; } };
export function currentTheme() {
  const saved = read();
  if (saved === 'dark' || saved === 'light') return saved;
  return window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
export function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  const m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute('content', t === 'dark' ? '#0b1220' : '#1d4ed8');
}
export function setTheme(t) { try { localStorage.setItem(KEY, t); } catch (e) { /* private mode: keep it for this visit only */ } applyTheme(t); }
export const initTheme = () => applyTheme(currentTheme());
