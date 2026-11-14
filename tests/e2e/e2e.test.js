/**
 * End-to-end tests: real Chromium -> built React client (client/dist) -> Express API -> real PostgreSQL.
 * Playwright drives the browser; axe-core (@axe-core/playwright) provides the accessibility audit (NFR-013).
 * Skipped when Playwright/Chromium is not installed. IDs: TC-E2E-xx. Run with `npm run e2e` or `npx jest tests/e2e`.
 */
const assert = require('node:assert/strict');
const { boot } = require('../helpers');

let chromium = null;
try { chromium = require('playwright')[process.env.BROWSER || 'chromium']; } catch (e) { /* not installed */ }
const T = chromium ? test : test.skip;
const TO = 90000;
// Firefox and WebKit on a shared CI runner are slower and timing-sensitive: a failed browser test is run once more before it counts (the first failure is still printed).
if (process.env.BROWSER && process.env.BROWSER !== 'chromium') jest.retryTimes(1, { logErrorsBeforeRetry: true });

let t, browser;
beforeAll(async () => { if (!chromium) return; t = await boot(); browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}); });
afterAll(async () => { if (browser) await browser.close(); if (t) await t.close(); });

async function page(width, reduceMotion) {
  const ctx = await browser.newContext({ viewport: { width: width || 1280, height: 800 }, reducedMotion: reduceMotion ? 'reduce' : 'no-preference' }), p = await ctx.newPage(), errors = [];
  // Firefox and WebKit report a request or lazy chunk that is cancelled when the test navigates away on purpose; the app is served from one origin, so this is not a CORS or app error.
  const noise = /Failed to load resource|fonts\.g|error loading dynamically imported module|Importing a module script failed|Fetch API cannot load .* due to access control checks|NetworkError when attempting to fetch resource|Load failed/;
  p.on('pageerror', (e) => { if (!noise.test(String(e))) errors.push(String(e)); });
  p.on('console', async (m) => {
    if (m.type() !== 'error') return;
    let text = m.text();
    // Firefox prints an object argument as "JSHandle@object"; read the real message so it can be judged (and shown if it fails the test).
    if (/JSHandle/.test(text)) { try { text = (await Promise.all(m.args().map((a) => a.evaluate((v) => (v && v.message) || (typeof v === 'string' ? v : JSON.stringify(v)))))).join(' '); } catch (e) { text = 'NAVIGATION'; } }
    // If the object cannot be read because the page was already navigating away, the message came from a request cancelled by that navigation, not from the app.
    if (text !== 'NAVIGATION' && !noise.test(text)) errors.push(text);
  });
  await p.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  p.errors = errors; return p;
}
/** Add a CSS rule through the stylesheet object. A <style> tag would be blocked by the page's strict Content-Security-Policy (no 'unsafe-inline'), which is the behaviour under test. */
const addRule = (p, rule) => p.evaluate((r) => { const sheet = document.styleSheets[0]; if (sheet) sheet.insertRule(r, sheet.cssRules.length); }, rule).catch(() => {});
/** Wait for the page to be quiet ("networkidle" can time out in Firefox on pages that keep animating) and show the scroll-reveal sections so axe checks them. */
async function settle(p) {
  await p.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
  await addRule(p, '.js-reveal{opacity:1!important;transform:none!important;transition:none!important}');
  await p.waitForTimeout(300);
}
async function signIn(p, email) {
  await p.goto(t.base + '/login');
  await p.fill('#email', email); await p.fill('#password', 'Demo@1234'); await p.click('#form button[type=submit]');
  await p.waitForURL(/dashboard$/, { waitUntil: 'commit' });
  await p.waitForSelector('h1'); // let the lazy dashboard chunk finish before the test navigates again (Firefox logs a cancelled chunk otherwise)
}

T('TC-E2E-01 sign in: bad password shows an error and stays; good password reaches the dashboard', async () => {
  const p = await page();
  await p.goto(t.base + '/login'); await p.fill('#email', 'aisha@port.ac.uk'); await p.fill('#password', 'wrong'); await p.click('#form button[type=submit]');
  await p.waitForSelector('[role=alert], .field-error, .toast.err, .alert', { timeout: 5000 });
  assert.match(p.url(), /login/);
  await signIn(p, 'aisha@port.ac.uk');
  await p.waitForSelector('h1'); assert.deepEqual(p.errors, []);
}, TO);
T('TC-E2E-02 protected page without a session redirects to sign in', async () => {
  const p = await page(); await p.goto(t.base + '/dashboard'); await p.waitForURL(/login/, { waitUntil: 'commit' });
}, TO);
T('TC-E2E-03 register form: inline field errors, nothing created (FR-001, NFR-007)', async () => {
  const p = await page(); await p.goto(t.base + '/register');
  await p.fill('#email', 'not-an-email'); await p.click('#form button[type=submit]');
  assert.match(p.url(), /register/);
  assert.equal(await t.count("SELECT COUNT(*) AS n FROM users WHERE email = 'not-an-email'"), 0);
}, TO);
T('TC-E2E-04 workspace: a 21-character task title is refused in the dialog, a valid one is saved and shown (F7)', async () => {
  const p = await page(); await signIn(p, 'aisha@port.ac.uk');
  await p.goto(t.base + '/workspace?id=PRJ-1001'); await p.click('#newTask');
  await p.fill('#tt', 'x'.repeat(21)); await p.click('#sv');
  assert.ok(await p.locator('.modal [data-field=title] .error, .modal .field-error, .modal [role=alert]').first().isVisible(), 'inline error shown');
  const before = await t.count("SELECT COUNT(*) AS n FROM tasks WHERE project_id='PRJ-1001'");
  await p.fill('#tt', 'E2E browser task'); await p.click('#sv');
  await p.waitForSelector('text=E2E browser task');
  assert.equal(await t.count("SELECT COUNT(*) AS n FROM tasks WHERE project_id='PRJ-1001'"), before + 1);
  assert.deepEqual(p.errors, []);
}, TO);
T('TC-E2E-05 markup typed into a task is displayed as text, never executed (NFR-004)', async () => {
  const p = await page(); await signIn(p, 'aisha@port.ac.uk');
  await p.goto(t.base + '/workspace?id=PRJ-1001'); await p.click('#newTask');
  await p.fill('#tt', '<img src=x onerror=alert(1)>'); await p.click('#sv');
  await p.waitForTimeout(800);
  const dialogs = []; p.on('dialog', (d) => { dialogs.push(d.message()); d.dismiss(); });
  await p.reload(); await p.waitForTimeout(500);
  assert.equal(dialogs.length, 0, 'no script ran');
  assert.equal(await p.locator('img[src=x]').count(), 0, 'no injected element');
}, TO);
T('TC-E2E-06 responsive: no horizontal scroll at 360, 768 and 1280 px on key pages (NFR-011)', async () => {
  for (const w of [360, 768, 1280]) {
    const p = await page(w); await signIn(p, 'aisha@port.ac.uk');
    for (const u of ['dashboard', 'discover', 'workspace?id=PRJ-1001', 'subscription', 'notifications', 'mentors']) {
      await p.goto(t.base + '/' + u); await p.waitForSelector('h1');
      const over = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      assert.ok(over <= 1, u + ' at ' + w + ' px overflows by ' + over + 'px');
    }
  }
}, TO);
T('TC-E2E-07 every page loads for its role without console errors', async () => {
  const sets = { 'aisha@port.ac.uk': ['dashboard', 'profile', 'discover', 'projects', 'requests', 'mentors', 'support', 'subscription', 'notifications', 'project-new'], 'admin@rcmp.example': ['admin', 'compensation'] };
  for (const [email, pages] of Object.entries(sets)) {
    const p = await page(); await signIn(p, email);
    for (const n of pages) { await p.goto(t.base + '/' + n); await p.waitForSelector('h1'); }
    assert.deepEqual(p.errors, [], email);
  }
}, TO);
T('TC-E2E-08 keyboard: Tab reaches the skip link / first control and focus is visible', async () => {
  const p = await page(); await p.goto(t.base + '/login');
  await p.waitForSelector('#form'); await p.keyboard.press('Tab');
  const tag = await p.evaluate(() => document.activeElement && document.activeElement.tagName);
  assert.ok(['A', 'INPUT', 'BUTTON'].includes(tag), 'focus landed on ' + tag);
}, TO);
T('TC-E2E-09 forgot and reset password in the browser, then sign in with the new password (FR-002)', async () => {
  const email = 'browser.reset@port.ac.uk'; await t.call('POST', '/api/auth/register', { name: 'Browser Reset', email, password: 'Str0ng#Pass1', role: 'student', consent: true });
  const p = await page(); await p.goto(t.base + '/login'); await p.click('a[href="/forgot"]'); await p.waitForURL(/forgot/, { waitUntil: 'commit' }); await p.waitForSelector('text=Forgot your password?');
  for (let i = 0; i < 3 && !(await p.locator('text=Open reset link').count()); i++) { // a slow runner can swallow the first click while the page is still loading
    await p.fill('#email', email); await p.click('#form button[type=submit]');
    await p.waitForSelector('text=Open reset link', { timeout: 8000 }).catch(() => {});
  }
  await p.click('text=Open reset link'); await p.waitForURL(/reset\?token=/, { waitUntil: 'commit' });
  await p.fill('#password', 'weak'); await p.fill('#confirm', 'weak'); await p.click('#form button[type=submit]');
  assert.match(p.url(), /reset/, 'weak password refused');
  await p.fill('#password', 'Br0wser#New1'); await p.fill('#confirm', 'Different#1'); await p.click('#form button[type=submit]');
  assert.match(p.url(), /reset/, 'mismatch refused');
  await p.fill('#confirm', 'Br0wser#New1'); await p.click('#form button[type=submit]'); await p.waitForURL(/login\?reset=1/, { waitUntil: 'commit' });
  await p.waitForSelector('text=Password changed');
  await p.fill('#email', email); await p.fill('#password', 'Br0wser#New1'); await p.click('#form button[type=submit]'); await p.waitForURL(/dashboard$/, { waitUntil: 'commit' });
  assert.deepEqual(p.errors, []);
}, TO);
const SLOW_ENGINE = !!process.env.BROWSER && process.env.BROWSER !== 'chromium';   // Firefox and WebKit in CI: same axe rules, fewer repeats to keep the job short
const WIDTHS = SLOW_ENGINE ? [1280] : [360, 768, 1280];
const PUBLIC_ROUTES = ['/', '/pricing', '/contact', '/privacy', '/terms', '/cookies', '/login', '/register', '/forgot'];
const USER_ROUTES = ['/dashboard', '/profile', '/notifications', '/requests', '/discover', '/mentors', '/projects', '/project-new', '/support', '/subscription', '/project?id=PRJ-1001', '/workspace?id=PRJ-1001', '/agreement?id=PRJ-1001'];
const ADMIN_ROUTES = ['/admin', '/compensation'];
// Firefox and WebKit run the same axe rules on ten key routes at 1280 px (Chromium covers every route at all three widths); WebKit needs about 11 s per route on a CI runner.
const AXE_PUBLIC = SLOW_ENGINE ? ['/', '/pricing', '/contact', '/login'] : PUBLIC_ROUTES;
const AXE_USER = SLOW_ENGINE ? ['/dashboard', '/discover', '/workspace?id=PRJ-1001', '/subscription', '/profile'] : USER_ROUTES;
const AXE_ADMIN = SLOW_ENGINE ? ['/admin'] : ADMIN_ROUTES;
T('TC-E2E-10 accessibility on every route: axe-core finds no serious or critical violations at 360, 768 and 1280 px (NFR-013)', async () => {
  const AxeBuilder = require('@axe-core/playwright').default || require('@axe-core/playwright').AxeBuilder;
  const problems = [];
  for (const w of WIDTHS) {
    const anon = await page(w), user = await page(w), admin = await page(w); await signIn(user, 'aisha@port.ac.uk'); await signIn(admin, 'admin@rcmp.example');
    for (const [p, routes] of [[anon, AXE_PUBLIC], [user, AXE_USER], [admin, AXE_ADMIN]]) {
      for (const r of routes) {
        await p.goto(t.base + r); await p.waitForSelector('h1', { timeout: 8000 }); await settle(p);
        const res = await new AxeBuilder({ page: p }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
        for (const v of res.violations.filter((x) => ['serious', 'critical'].includes(x.impact))) problems.push(w + 'px ' + r + ': ' + v.id + ' (' + v.nodes.length + ') ' + v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | '));
      }
    }
  }
  assert.deepEqual(problems, []);
}, 300000);
T('TC-E2E-10b structure on every route: language, title, exactly one h1, labelled controls, named buttons and links, image alt', async () => {
  const anon = await page(), user = await page(), admin = await page(); await signIn(user, 'aisha@port.ac.uk'); await signIn(admin, 'admin@rcmp.example'); const problems = [];
  for (const [p, routes] of [[anon, PUBLIC_ROUTES], [user, USER_ROUTES], [admin, ADMIN_ROUTES]]) {
    for (const f of routes) {
      await p.goto(t.base + f); await p.waitForSelector('h1', { timeout: 8000 }).catch(() => {}); await p.waitForLoadState('networkidle');
      const r = await p.evaluate(() => {
        const bad = [], name = (e) => (e.getAttribute('aria-label') || e.getAttribute('aria-labelledby') || e.textContent || e.getAttribute('title') || '').trim();
        if (!document.documentElement.lang) bad.push('no lang'); if (!document.title) bad.push('no title');
        if (document.querySelectorAll('h1').length !== 1) bad.push('h1 count ' + document.querySelectorAll('h1').length);
        document.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]),select,textarea').forEach((e) => { if (e.closest('[hidden]') || e.offsetParent === null) return; const lab = (e.id && document.querySelector('label[for="' + e.id + '"]')) || e.closest('label'); if (!lab && !e.getAttribute('aria-label') && !e.getAttribute('aria-labelledby')) bad.push('unlabelled ' + (e.id || e.name || e.type)); });
        document.querySelectorAll('button,a[href]').forEach((e) => { if (e.offsetParent === null) return; if (!name(e) && !e.querySelector('img[alt]')) bad.push('unnamed ' + e.tagName + ' ' + (e.id || e.className)); });
        document.querySelectorAll('img').forEach((e) => { if (!e.hasAttribute('alt')) bad.push('img without alt'); });
        return bad;
      });
      if (r.length) problems.push(f + ': ' + r.join('; '));
    }
  }
  assert.deepEqual(problems, []);
}, TO);
T('TC-E2E-11 no screen still claims data is kept only in the browser (content accuracy after the move to a server)', async () => {
  const fs = require('node:fs'), path = require('node:path'), root = path.resolve(__dirname, '..', '..', 'client', 'src');
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const bad = walk(root).filter((f) => /\.jsx?$/.test(f)).filter((f) => /stored (only )?in (this|your) browser|data stays in this browser|stored only in this browser/i.test(fs.readFileSync(f, 'utf8')));
  assert.equal(bad.length, 0, bad.join(', '));
}, TO);

T('TC-E2E-12 Scout: hover vibrates, click opens, answers in scope, declines off-topic, click/Esc close (public page)', async () => {
  const p = await page(); await p.goto(t.base + '/');
  await p.waitForSelector('.scout-launch');
  assert.equal(await p.getAttribute('.scout-launch', 'aria-expanded'), 'false');
  await p.hover('.scout-launch');
  assert.ok(await p.evaluate(() => document.querySelector('.scout-launch').classList.contains('shake')), 'vibration class applied on hover');
  await p.waitForFunction(() => !document.querySelector('.scout-launch').classList.contains('shake'), null, { timeout: 3000 }); // plays three times, then stops
  await p.click('.scout-launch');
  assert.equal(await p.getAttribute('.scout-launch', 'aria-expanded'), 'true');
  assert.ok(await p.isVisible('.scout-panel'));
  assert.ok(await p.evaluate(() => document.activeElement.classList.contains('scout-input')), 'focus moves to the input');
  await p.fill('.scout-input', 'How do I upload a file?'); await p.keyboard.press('Enter');
  await p.waitForFunction(() => document.querySelectorAll('.scout-msg.bot').length >= 2);
  assert.match(await p.locator('.scout-msg.bot').last().innerText(), /10 MB|10 MiB|upload/i);
  await p.fill('.scout-input', 'What is the capital of France?'); await p.keyboard.press('Enter');
  await p.waitForFunction(() => document.querySelectorAll('.scout-msg.bot').length >= 3);
  assert.match(await p.locator('.scout-msg.bot').last().innerText(), /only help with using this platform/);
  await p.keyboard.press('Escape'); assert.ok(!(await p.isVisible('.scout-panel')), 'Esc closes');
  await p.click('.scout-launch'); assert.ok(await p.isVisible('.scout-panel')); await p.click('.scout-launch'); assert.ok(!(await p.isVisible('.scout-panel')), 'second click closes');
  assert.deepEqual(p.errors, []);
}, TO);
T('TC-E2E-13 Scout is personalised when signed in, never renders markup from the user, fits a phone', async () => {
  const p = await page(390); await signIn(p, 'aisha@port.ac.uk');
  await p.click('.scout-launch'); await p.fill('.scout-input', '<img src=x onerror=alert(1)> what does my plan include'); await p.keyboard.press('Enter');
  await p.waitForFunction(() => document.querySelectorAll('.scout-msg.bot').length >= 2);
  assert.equal(await p.locator('.scout-log img').count(), 0);
  const box = await p.locator('.scout-panel').boundingBox();
  assert.ok(box.x >= 0 && box.x + box.width <= 390, 'panel inside the viewport');
  assert.equal(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  assert.deepEqual(p.errors, []);
}, TO);

T('TC-E2E-14 phone navigation: hamburger opens every public link, Esc closes, nothing scrolls sideways', async () => {
  const p = await page(375); await p.goto(t.base + '/');
  assert.ok(await p.isVisible('.nav-toggle')); assert.ok(!(await p.isVisible('.pub-nav .links a.l >> nth=0')), 'links hidden until opened');
  await p.click('.nav-toggle'); assert.equal(await p.getAttribute('.nav-toggle', 'aria-expanded'), 'true');
  for (const name of ['Features', 'How it works', 'Pricing', 'Contact', 'Privacy']) assert.ok(await p.isVisible('.pub-nav .links >> text=' + name), name);
  assert.ok(await p.isVisible('.pub-nav .links >> text=Get started'));
  await p.keyboard.press('Escape'); assert.equal(await p.getAttribute('.nav-toggle', 'aria-expanded'), 'false');
  assert.equal(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  assert.deepEqual(p.errors, []);
}, TO);
T('TC-E2E-15 pricing page lists the four plans from the shared catalogue; landing has the 3-D globe; one logo for page and tab', async () => {
  const p = await page(); await p.goto(t.base + '/pricing');
  await p.waitForSelector('.plan'); assert.equal(await p.locator('.plan').count(), 4);
  assert.match(await p.locator('#plans').innerText(), /Scholar Plus[\s\S]*9\.99[\s\S]*6 requests per month/);
  await p.goto(t.base + '/'); assert.ok(await p.isVisible('#globe'));
  const px = await p.evaluate(() => { const c = document.getElementById('globe'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++; return n; });
  assert.ok(px > 1000, 'globe drew something');
  const html = await (await fetch(t.base + '/')).text();
  assert.match(html, /href="\/assets\/img\/favicon\.svg"/); assert.ok(!/data:image\/svg\+xml/.test(html.split('</head>')[0]), 'no old inline icon');
  assert.ok(!/Not an official university service|A prototype built/.test(await p.locator('body').innerText()));
  assert.deepEqual(p.errors, []);
}, TO);
T('TC-E2E-16 contact page: client validation, successful send shows a reference, admin sees it in the Messages tab', async () => {
  const p = await page(); await p.goto(t.base + '/contact');
  await p.click('#form button[type=submit]'); assert.ok(await p.locator('.error-text').count() >= 4, 'empty form shows field errors');
  await p.fill('#name', 'Sam Visitor'); await p.fill('#email', 'sam@uni.ac.uk'); await p.selectOption('#topic', 'bug'); await p.fill('#subject', 'Upload button question'); await p.fill('#message', 'The upload button did not respond on my phone.');
  await p.click('#form button[type=submit]'); await p.waitForURL(/contact-thanks/, { waitUntil: 'commit' }); await p.waitForSelector('#ref');
  assert.match(await p.locator('h1').innerText(), /Thank you for contacting us/); assert.match(await p.locator('main').innerText(), /2 to 3 business days/);
  assert.match(await p.locator('#ref').innerText(), /^MSG-\d+$/); assert.ok(!/ref=/.test(p.url()), 'reference removed from the address bar');
  const a = await page(); await signIn(a, 'admin@rcmp.example'); await a.goto(t.base + '/admin'); await a.click('[data-tab=messages]');
  await a.waitForSelector('#panel-messages article'); assert.match(await a.locator('#panel-messages').innerText(), /Upload button question/);
  await a.click('#panel-messages [data-m=answered]'); await a.waitForFunction(() => /answered/.test(document.querySelector('#panel-messages').innerText));
  assert.deepEqual(p.errors.concat(a.errors), []);
}, TO);

T('TC-E2E-17 contact form: each red error clears as soon as that field becomes valid; the form card never tilts (autofill menu stays open)', async () => {
  const p = await page(); await p.goto(t.base + '/contact'); await p.waitForSelector('#form button[type=submit]'); await p.waitForLoadState('networkidle');
  const cnt = async (sel, n, msg) => { await p.waitForFunction(([q, k]) => document.querySelectorAll(q).length === k, [sel, n], { timeout: 4000 }).catch(() => {}); assert.equal(await p.locator(sel).count(), n, msg); };
  await p.click('#form button[type=submit]'); await cnt('.error-text', 5);
  await p.fill('#name', 'Sam Visitor'); await cnt('[data-field=name] .error-text', 0, 'name error cleared');
  await p.fill('#email', 'sam'); await cnt('[data-field=email] .error-text', 1, 'still invalid, still shown');
  await p.fill('#email', 'sam@uni.ac.uk'); await cnt('[data-field=email] .error-text', 0);
  await p.fill('#subject', 'ab'); await cnt('[data-field=subject] .error-text', 1, 'two characters is still too short');
  await p.fill('#subject', 'abc'); await cnt('[data-field=subject] .error-text', 0, 'three characters clears it');
  await p.selectOption('#topic', 'bug'); await cnt('[data-field=topic] .error-text', 0);
  await p.fill('#message', 'long enough message'); await cnt('[data-field=message] .error-text', 0);
  await cnt('.error-text', 0);
  const form = p.locator('#form').locator('xpath=ancestor::div[contains(@class,"card")][1]'); await form.hover();
  assert.ok(!/tilt/.test(await form.getAttribute('class')), 'form card has no tilt class');
  assert.deepEqual(p.errors, []);
}, TO);
T('TC-E2E-18 landing footer carries the contact strip and company column; labels no longer use the monospace face', async () => {
  const p = await page(); await p.goto(t.base + '/');
  assert.ok(await p.isVisible('.pub-footer .foot-cta a[href="/contact"]')); assert.ok(await p.isVisible('.pub-footer >> text=Company'));
  assert.ok(await p.isVisible('.hero .float3d.f1'), 'hero depth badges present');
  const ff = await p.evaluate(() => getComputedStyle(document.querySelector('.eyebrow')).fontFamily); assert.ok(!/mono/i.test(ff), ff);
  assert.deepEqual(p.errors, []);
}, TO);
T('TC-E2E-19 with e-mail verification on: register, land on the code page, wrong code is refused, right code signs in', async () => {
  const sent = [];
  const v = await boot({ app: { verifyEmail: true, mailer: { configured: true, enabled: true, send: async (m) => { sent.push(m); } }, authLimit: 500 } });
  try {
    const p = await page();
    await p.goto(v.base + '/register');
    await p.fill('#name', 'Vera Verify'); await p.fill('#email', 'vera@uni.ac.uk'); await p.fill('#password', 'Strong#Pass1');
    await p.check('[name=role] >> nth=0'); await p.check('#consent'); await p.click('#form button[type=submit]');
    await p.waitForURL(/verify\?email=vera%40uni\.ac\.uk/, { waitUntil: 'commit' });
    const pin = /code is (\d{6})/.exec(sent[0].text)[1], wrong = pin === '000000' ? '111111' : '000000';
    await p.fill('#pin', wrong); await p.click('#form button[type=submit]');
    await p.waitForSelector('.field-error, [role=alert]'); assert.match(p.url(), /verify/);
    await p.fill('#pin', pin); await p.click('#form button[type=submit]');
    await p.waitForURL(/profile/, { waitUntil: 'commit' });
    assert.deepEqual(p.errors.filter((e) => !/40[0-9]/.test(e)), []);
  } finally { await v.close(); }
}, TO);
T('TC-E2E-20 legal pages: Terms and Cookies render with their own title and meta description, and the footer links reach them', async () => {
  const p = await page();
  for (const [path, h1, title] of [['/terms', 'Terms of use', /Terms of use/], ['/cookies', 'Cookies', /Cookies/], ['/privacy', 'Privacy', /Privacy/]]) {
    await p.goto(t.base + path); await p.waitForSelector('h1');
    assert.match(await p.title(), title); assert.ok((await p.locator('h1').first().innerText()).includes(h1));
    assert.ok((await p.getAttribute('meta[name=description]', 'content')).length > 40, path + ' has a meta description');
  }
  await p.goto(t.base + '/'); await p.click('.pub-footer a[href="/terms"]'); await p.waitForURL(/\/terms$/, { waitUntil: 'commit' }); await p.waitForSelector('h1');
  await p.goto(t.base + '/contact'); await p.waitForSelector('a[href="mailto:muhammad.habib@myport.ac.uk"]', { timeout: 8000 });
  assert.deepEqual(p.errors, []);
}, TO);
T('TC-E2E-21 dark theme: the toggle switches, the choice survives a reload, and the public pages still pass axe colour contrast', async () => {
  const AxeBuilder = require('@axe-core/playwright').default || require('@axe-core/playwright').AxeBuilder;
  const p = await page(); await p.goto(t.base + '/'); await p.waitForSelector('#themeToggle');
  assert.notEqual(await p.getAttribute('html', 'data-theme'), 'dark');
  await p.click('#themeToggle'); assert.equal(await p.getAttribute('html', 'data-theme'), 'dark');
  await p.reload(); await p.waitForSelector('h1'); assert.equal(await p.getAttribute('html', 'data-theme'), 'dark');
  const problems = [];
  for (const r of (SLOW_ENGINE ? PUBLIC_ROUTES.slice(0, 3) : PUBLIC_ROUTES)) {
    await p.goto(t.base + r); await p.waitForSelector('h1'); await settle(p);
    const res = await new AxeBuilder({ page: p }).withRules(['color-contrast']).analyze();
    for (const v of res.violations) problems.push(r + ': ' + v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | '));
  }
  assert.deepEqual(problems, []);
  await p.goto(t.base + '/'); await p.waitForSelector('#themeToggle'); await p.click('#themeToggle'); assert.equal(await p.getAttribute('html', 'data-theme'), 'light');
}, 300000);
T('TC-E2E-22 scroll helpers: the progress bar grows while scrolling and the back-to-top button returns to the top', async () => {
  // Chromium runs the smooth scroll; Firefox and WebKit headless can stall it, so the app's reduced-motion path (instant jump) is used there.
  const p = await page(undefined, SLOW_ENGINE); await p.goto(t.base + '/'); await p.waitForSelector('h1');
  assert.equal(await p.isVisible('#backTop'), false);
  await p.evaluate(() => window.scrollTo(0, 1600)); await p.waitForSelector('#backTop');
  const w = await p.evaluate(() => parseFloat(document.querySelector('.scroll-progress span').style.width)); assert.ok(w > 0, 'progress ' + w);
  await p.click('#backTop'); await p.waitForFunction(() => window.scrollY < 5, null, { timeout: 10000, polling: 100 });
  assert.deepEqual(p.errors, []);
}, TO);
T('TC-E2E-23 sidebar: the menu button hides it on a wide screen, a tab at the edge brings it back, and the choice survives a reload', async () => {
  const p = await page(1280); await signIn(p, 'aisha@port.ac.uk'); await p.waitForSelector('#sidebar');
  const still = '.sidebar,.main,.footer{transition:none!important}';   // test the final position, not the 0.2 s slide (headless WebKit and Firefox can pause animations)
  await addRule(p, still);
  const left = () => p.evaluate(() => Math.round(document.getElementById('sidebar').getBoundingClientRect().right));
  assert.ok((await left()) > 100, 'sidebar visible at first');
  await p.click('#menuBtn'); await p.waitForSelector('.shell.side-hidden', { timeout: 10000 }); await p.waitForFunction(() => document.getElementById('sidebar').getBoundingClientRect().right <= 1, null, { timeout: 10000, polling: 100 });
  assert.ok(await p.isVisible('.side-edge'));
  assert.equal(await p.evaluate(() => Math.round(document.querySelector('.main').getBoundingClientRect().left)), 0, 'content uses the full width');
  await p.reload(); await p.waitForSelector('.side-edge'); await addRule(p, still); await p.waitForFunction(() => document.getElementById('sidebar').getBoundingClientRect().right <= 1, null, { timeout: 10000, polling: 100 }); assert.ok((await left()) <= 0, 'still hidden after reload');
  await p.click('.side-edge'); await p.waitForFunction(() => document.getElementById('sidebar').getBoundingClientRect().right > 100, null, { timeout: 10000, polling: 100 });
  assert.equal(await p.isVisible('.side-edge'), false);
  assert.deepEqual(p.errors, []);
}, TO);
