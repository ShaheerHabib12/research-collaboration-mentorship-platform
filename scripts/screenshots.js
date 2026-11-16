/**
 * screenshots.js - retakes every screenshot used in README and the report from the running React app:
 *   node scripts/screenshots.js          (needs Chromium; set CHROMIUM_PATH to reuse an existing binary; run `npm run build` first)
 * Output: docs/screenshots/*.png  (light theme by default; files ending in -dark use the dark theme)
 */
'use strict';
const path = require('node:path');
const { startStack } = require('../tests/e2e/stack');
const { chromium } = require('playwright');
const out = path.join(__dirname, '..', 'docs', 'screenshots');

(async () => {
  const s = await startStack();
  const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const ctx = async (w, h, theme) => {
    const c = await b.newContext({ viewport: { width: w || 1280, height: h || 800 }, colorScheme: theme === 'dark' ? 'dark' : 'light' });
    await c.addInitScript((t) => { try { localStorage.setItem('rcmp-theme', t); } catch (e) { /* ignore */ } }, theme || 'light');
    const p = await c.newPage(); await p.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort()); return p;
  };
  const shot = async (p, name, full) => { await p.waitForLoadState('networkidle'); await p.waitForTimeout(1400); await p.screenshot({ path: path.join(out, name + '.png'), fullPage: !!full }); console.log('saved', name); };
  const signIn = async (p, email) => { await p.goto(s.url + '/login'); await p.waitForSelector('#form'); await p.fill('#email', email); await p.fill('#password', 'Demo@1234'); await p.click('#form button[type=submit]'); await p.waitForURL(/(dashboard|admin|compensation)/, { waitUntil: 'commit' }); await p.waitForSelector('h1'); };
  const stack = async (p, name) => { await p.goto(s.url + '/'); await p.waitForSelector('.stack3d'); await p.locator('.stack3d').scrollIntoViewIfNeeded(); await p.evaluate(() => { const e = document.querySelector('.stack3d'); e.style.setProperty('--sry', '-26deg'); e.style.setProperty('--srx', '18deg'); }); await shot(p, name); };

  for (const theme of ['light', 'dark']) {
    const sfx = theme === 'dark' ? '-dark' : '';
    let p = await ctx(1280, 800, theme);
    await p.goto(s.url + '/'); await shot(p, '01-landing' + sfx);
    await p.goto(s.url + '/'); await p.waitForSelector('#globe'); await p.locator('#globe').scrollIntoViewIfNeeded(); await shot(p, '13-network-globe' + sfx);
    await stack(p, '17-stack-3d' + sfx);
    if (theme === 'light') {
      await p.goto(s.url + '/login'); await shot(p, '02-login');
      await p.goto(s.url + '/pricing'); await shot(p, '11-pricing');
      await p.goto(s.url + '/contact'); await shot(p, '12-contact');
      await p.fill('#name', 'Sam Visitor'); await p.fill('#email', 'sam@uni.ac.uk'); await p.selectOption('#topic', 'bug'); await p.fill('#subject', 'Upload button question'); await p.fill('#message', 'The upload button did not respond on my phone.'); await p.click('#form button[type=submit]'); await p.waitForSelector('#ref'); await shot(p, '15-contact-thanks');
    } else {
      await p.goto(s.url + '/login'); await shot(p, '02-login-dark');
      await p.goto(s.url + '/pricing'); await shot(p, '11-pricing-dark');
    }
    p = await ctx(1280, 800, theme); await signIn(p, 'aisha@port.ac.uk');
    await p.goto(s.url + '/dashboard'); await shot(p, '03-dashboard' + sfx);
    await p.goto(s.url + '/discover'); await shot(p, '04-discover' + sfx);
    await p.goto(s.url + '/workspace?id=PRJ-1001'); await shot(p, '05-workspace' + sfx);
    await p.goto(s.url + '/agreement?id=PRJ-1001'); await shot(p, '06-team-agreement' + sfx);
    await p.goto(s.url + '/subscription'); await shot(p, '07-subscription' + sfx);
    await p.goto(s.url + '/dashboard'); await p.click('.scout-launch'); await p.fill('.scout-input', 'How do I upload a file?'); await p.keyboard.press('Enter'); await p.waitForFunction(() => document.querySelectorAll('.scout-msg.bot').length >= 2); await shot(p, '08-scout-assistant' + sfx);
    const a = await ctx(1280, 800, theme); await signIn(a, 'admin@rcmp.example');
    await a.goto(s.url + '/admin'); await shot(a, '09-admin' + sfx);
    await a.getByRole('tab', { name: /Messages/ }).click(); await a.waitForSelector('#panel-messages'); await shot(a, '16-admin-messages' + sfx);
    await a.goto(s.url + '/compensation'); await shot(a, '18-compensation' + sfx);
    const m = await ctx(390, 844, theme); await signIn(m, 'aisha@port.ac.uk'); await m.goto(s.url + '/dashboard'); await shot(m, '10-mobile-dashboard' + sfx);
    const mp = await ctx(375, 812, theme); await mp.goto(s.url + '/'); await mp.click('.nav-toggle'); await shot(mp, '14-mobile-menu' + sfx);
  }
  await b.close(); await s.stop();
})().catch((e) => { console.error(e); process.exit(1); });
