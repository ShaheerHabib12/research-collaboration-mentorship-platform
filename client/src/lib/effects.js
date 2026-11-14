/**
 * effects.js - progressive-enhancement motion helpers, called from React effects.
 * Each bind function returns a cleanup. All honour prefers-reduced-motion and fine-pointer checks.
 * (No WebGL or Three.js: a 2-D canvas gives the 3-D globe at a few KB and works offline.)
 */
const REDUCE = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
const FINE = () => !!(window.matchMedia && matchMedia('(pointer: fine)').matches);

/** Pointer-driven 3-D tilt with a moving highlight for cards marked .tilt / .tilt-soft. */
export function bindTilt(rootEl) {
  if (REDUCE() || !FINE()) return () => {};
  const undo = [];
  rootEl.querySelectorAll('.tilt, .tilt-soft, #features .card, #roles .card, .plan').forEach((el) => {
    if (el.__tilt || el.querySelector('input, select, textarea, form')) return; // never move a card with form fields: it cancels autofill
    el.__tilt = true; if (!el.classList.contains('tilt') && !el.classList.contains('tilt-soft')) el.classList.add('tilt-soft');
    const max = el.classList.contains('tilt-soft') ? 3 : 8; let raf = 0;
    const move = (e) => {
      if (el.contains(document.activeElement) && /^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName)) return;
      const r = el.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      cancelAnimationFrame(raf); raf = requestAnimationFrame(() => {
        el.style.setProperty('--tx', ((py - 0.5) * -max * 2).toFixed(2) + 'deg'); el.style.setProperty('--ty', ((px - 0.5) * max * 2).toFixed(2) + 'deg');
        el.style.setProperty('--gx', (px * 100).toFixed(0) + '%'); el.style.setProperty('--gy', (py * 100).toFixed(0) + '%'); el.classList.add('is-tilting');
      });
    };
    const leave = () => { cancelAnimationFrame(raf); el.style.setProperty('--tx', '0deg'); el.style.setProperty('--ty', '0deg'); el.classList.remove('is-tilting'); };
    el.addEventListener('pointermove', move); el.addEventListener('pointerleave', leave);
    undo.push(() => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerleave', leave); el.__tilt = false; });
  });
  return () => undo.forEach((f) => f());
}

/** Count-up for dashboard numbers: "4" -> 0..4, "38%" -> 0..38%. */
export function countUp(el) {
  if (REDUCE() || el.dataset.counted) return; el.dataset.counted = '1';
  const m = /^(\d+)(.*)$/.exec(el.textContent.trim()); if (!m) return;
  const to = parseInt(m[1], 10), tail = m[2]; if (to < 2 || to > 100000) return;
  const t0 = performance.now(), dur = Math.min(900, 300 + to * 12);
  (function tick(now) { const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3); el.textContent = Math.round(to * e) + tail; if (k < 1) requestAnimationFrame(tick); })(t0);
}

/** Landing page: header shadow, scroll reveal, product-card parallax, hero depth and the collaboration network canvas. */
export function bindHero(hero) {
  const reduce = REDUCE(), undo = [];
  const head = document.querySelector('header'), onScroll = () => head && head.classList.toggle('scrolled', scrollY > 8);
  addEventListener('scroll', onScroll, { passive: true }); undo.push(() => removeEventListener('scroll', onScroll));
  if ('IntersectionObserver' in window && !reduce) {
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    document.querySelectorAll('main section:not(.hero) .card, main section:not(.hero) h2, main section:not(.hero) .step, main section:not(.hero) li').forEach((el, i) => {
      el.classList.add('js-reveal'); el.style.setProperty('--d', (i % 3) * 70 + 'ms'); io.observe(el);
    });
    undo.push(() => io.disconnect());
  }
  const mock = hero.querySelector('.mock'), stage = hero.querySelector('.stage');
  if (!reduce && FINE()) {
    let raf = 0;
    const mv = (e) => {
      const r = hero.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      if (mock) { mock.style.setProperty('--ry', (x * 7).toFixed(2) + 'deg'); mock.style.setProperty('--rx', (-y * 6).toFixed(2) + 'deg'); }
      if (stage) { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { stage.style.setProperty('--px', (x * 2).toFixed(3)); stage.style.setProperty('--py', (y * 2).toFixed(3)); }); }
    };
    const lv = () => { if (mock) { mock.style.setProperty('--ry', '0deg'); mock.style.setProperty('--rx', '0deg'); } if (stage) { stage.style.setProperty('--px', 0); stage.style.setProperty('--py', 0); } };
    hero.addEventListener('pointermove', mv); hero.addEventListener('pointerleave', lv);
    undo.push(() => { hero.removeEventListener('pointermove', mv); hero.removeEventListener('pointerleave', lv); });
  }
  undo.push(heroNet(hero));
  return () => undo.forEach((f) => f());
}

function heroNet(hero) {
  const reduce = REDUCE();
  var cv = document.createElement('canvas'); cv.className = 'hero-net'; cv.setAttribute('aria-hidden', 'true'); hero.prepend(cv);
  var ctx = cv.getContext('2d'), W = 0, H = 0, dpr = Math.min(2, devicePixelRatio || 1), nodes = [], mouse = { x: -999, y: -999 }, running = false, raf = 0;
  function size() { var r = hero.getBoundingClientRect(); W = r.width; H = r.height; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); var n = Math.round(Math.min(46, Math.max(16, W / 32))); while (nodes.length < n) nodes.push({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - .5) * .25, vy: (Math.random() - .5) * .25, r: 1.6 + Math.random() * 2, t: Math.random() < .22 }); nodes.length = n; }
  function draw() {
    ctx.clearRect(0, 0, W, H);
    for (var i = 0; i < nodes.length; i++) {
      var a = nodes[i]; a.x += a.vx; a.y += a.vy; if (a.x < 0 || a.x > W) a.vx *= -1; if (a.y < 0 || a.y > H) a.vy *= -1;
      var dx = a.x - mouse.x, dy = a.y - mouse.y, d2 = dx * dx + dy * dy; if (d2 < 9000) { var f = (1 - d2 / 9000) * .6; a.x += dx / Math.sqrt(d2 + 1) * f; a.y += dy / Math.sqrt(d2 + 1) * f; }
      for (var j = i + 1; j < nodes.length; j++) { var b = nodes[j], ex = a.x - b.x, ey = a.y - b.y, d = ex * ex + ey * ey; if (d < 14400) { ctx.strokeStyle = 'rgba(37,99,235,' + (0.16 * (1 - d / 14400)).toFixed(3) + ')'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); } }
    }
    for (var k = 0; k < nodes.length; k++) { var n = nodes[k]; ctx.fillStyle = n.t ? 'rgba(13,148,136,.55)' : 'rgba(37,99,235,.42)'; ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, 6.2832); ctx.fill(); }
  }
  function loop() { draw(); raf = requestAnimationFrame(loop); }
  function start() { if (!running && !reduce) { running = true; loop(); } }
  function stop() { running = false; cancelAnimationFrame(raf); }
  size(); draw(); var onResize = function () { size(); draw(); }; addEventListener('resize', onResize);
  hero.addEventListener('pointermove', function (e) { var r = hero.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; });
  hero.addEventListener('pointerleave', function () { mouse.x = mouse.y = -999; });
  const io = 'IntersectionObserver' in window ? new IntersectionObserver((es) => { es[0].isIntersecting ? start() : stop(); }) : null;
  if (io) io.observe(hero); else start();
  const vis = () => { document.hidden ? stop() : start(); };
  document.addEventListener('visibilitychange', vis);
  return () => { stop(); if (io) io.disconnect(); removeEventListener('resize', onResize); document.removeEventListener('visibilitychange', vis); cv.remove(); };
}

/** A real 3-D "research network" globe on a 2-D canvas: Fibonacci-sphere points, 3-D rotation, perspective, depth sorting. Drag or use arrow keys to rotate. */
export function bindGlobe(cv) {
  if (!cv || !cv.getContext) return () => {};
  var reduce = REDUCE();
  var ctx = cv.getContext('2d'), dpr = Math.min(2, devicePixelRatio || 1), S = 0, N = 90, P = [], L = [];
  var ay = 0.6, ax = -0.35, vy = 0.0035, vx = 0, drag = false, lx = 0, ly = 0, running = false, raf = 0, hover = -1;
  var COL = ['#2563eb', '#2563eb', '#2563eb', '#0d9488', '#d97706'];
  for (var i = 0; i < N; i++) { var y = 1 - (i / (N - 1)) * 2, r = Math.sqrt(1 - y * y), th = i * 2.399963; P.push({ x: Math.cos(th) * r, y: y, z: Math.sin(th) * r, c: COL[i % COL.length], s: 1.6 + (i % 7 === 0 ? 2.2 : (i % 3 === 0 ? 1.2 : 0)) }); }
  for (var a = 0; a < N; a++) for (var b = a + 1; b < N; b++) { var dx = P[a].x - P[b].x, dy = P[a].y - P[b].y, dz = P[a].z - P[b].z; if (dx * dx + dy * dy + dz * dz < 0.34) L.push([a, b]); }
  function size() { var w = cv.clientWidth; S = w; cv.width = w * dpr; cv.height = w * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
  function frame() {
    ay += vy + (drag ? 0 : 0); ax += vx; vx *= 0.95; if (!drag && Math.abs(vy) > 0.0035) vy *= 0.97;
    var cy = Math.cos(ay), sy = Math.sin(ay), cx = Math.cos(ax), sx = Math.sin(ax), R = S * 0.36, cxp = S / 2, cyp = S / 2, F = 3.2, pr = [];
    for (var i = 0; i < N; i++) {
      var p = P[i], x1 = p.x * cy + p.z * sy, z1 = -p.x * sy + p.z * cy, y2 = p.y * cx - z1 * sx, z2 = p.y * sx + z1 * cx, k = F / (F - z2);
      pr.push({ x: cxp + x1 * R * k, y: cyp + y2 * R * k, z: z2, k: k, p: p });
    }
    ctx.clearRect(0, 0, S, S);
    var g = ctx.createRadialGradient(cxp - R * .3, cyp - R * .35, R * .1, cxp, cyp, R * 1.15); g.addColorStop(0, 'rgba(219,234,254,.85)'); g.addColorStop(1, 'rgba(219,234,254,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cxp, cyp, R * 1.12, 0, 6.2832); ctx.fill();
    ctx.lineWidth = 1;
    for (var l = 0; l < L.length; l++) { var A = pr[L[l][0]], B = pr[L[l][1]], d = (A.z + B.z) / 2, al = 0.06 + 0.22 * (d + 1) / 2; ctx.strokeStyle = 'rgba(37,99,235,' + al.toFixed(3) + ')'; ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke(); }
    // data pulses travelling along a few links
    var tt = (performance.now() / 1800) % 1;
    for (var q0 = 0; q0 < 7; q0++) { var lk = L[(q0 * 29) % L.length], A2 = pr[lk[0]], B2 = pr[lk[1]], ph = (tt + q0 / 7) % 1; if ((A2.z + B2.z) / 2 < -0.1) continue; ctx.globalAlpha = .9; ctx.fillStyle = '#fbbf24'; ctx.beginPath(); ctx.arc(A2.x + (B2.x - A2.x) * ph, A2.y + (B2.y - A2.y) * ph, 2.2, 0, 6.2832); ctx.fill(); }
    ctx.globalAlpha = 1;
    pr.sort(function (u, v) { return u.z - v.z; });
    for (var n = 0; n < pr.length; n++) { var q = pr[n], depth = (q.z + 1) / 2; ctx.globalAlpha = 0.28 + 0.72 * depth; ctx.fillStyle = q.p.c; ctx.beginPath(); ctx.arc(q.x, q.y, q.p.s * q.k * (S / 420 + .45), 0, 6.2832); ctx.fill(); if (q.p.s > 3 && depth > .55) { ctx.globalAlpha = .18 * depth; ctx.beginPath(); ctx.arc(q.x, q.y, q.p.s * q.k * 2.6, 0, 6.2832); ctx.fill(); } }
    ctx.globalAlpha = 1;
  }
  function loop() { frame(); raf = requestAnimationFrame(loop); }
  function start() { if (!running && !reduce) { running = true; loop(); } }
  function stop() { running = false; cancelAnimationFrame(raf); }
  cv.addEventListener('pointerdown', function (e) { drag = true; lx = e.clientX; ly = e.clientY; cv.setPointerCapture(e.pointerId); cv.classList.add('grab'); });
  cv.addEventListener('pointermove', function (e) { if (!drag) return; vy = (e.clientX - lx) * 0.0016; vx = (e.clientY - ly) * 0.0009; ay += (e.clientX - lx) * 0.006; ax = Math.max(-1.2, Math.min(1.2, ax + (e.clientY - ly) * 0.005)); lx = e.clientX; ly = e.clientY; if (reduce) frame(); });
  function up() { drag = false; cv.classList.remove('grab'); if (Math.abs(vy) < 0.002) vy = 0.0035; }
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('keydown', function (e) { if (e.key === 'ArrowLeft') ay -= 0.15; else if (e.key === 'ArrowRight') ay += 0.15; else if (e.key === 'ArrowUp') ax = Math.max(-1.2, ax - 0.1); else if (e.key === 'ArrowDown') ax = Math.min(1.2, ax + 0.1); else return; e.preventDefault(); if (reduce) frame(); });
  var onResize = function () { size(); frame(); }; size(); frame(); addEventListener('resize', onResize);
  var gio = 'IntersectionObserver' in window ? new IntersectionObserver(function (es) { es[0].isIntersecting ? start() : stop(); }) : null;
  if (gio) gio.observe(cv); else start();
  var vis = function () { document.hidden ? stop() : start(); };
  document.addEventListener('visibilitychange', vis);
  return function () { stop(); if (gio) gio.disconnect(); removeEventListener('resize', onResize); document.removeEventListener('visibilitychange', vis); };
}
