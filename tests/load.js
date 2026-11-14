/**
 * load.js - NFR-018 evidence: concurrent users against the real API.
 *   node tests/load.js [users=50] [requestsPerUser=40]
 * Mix: 70% reads (search, dashboard, workspace), 30% writes (tasks, notifications).
 * Reports p50/p95/max and the error count. Pass criterion: p95 < 2000 ms, 0 server errors.
 */
'use strict';
const { boot } = require('./helpers');
const users = Number(process.argv[2] || 50), per = Number(process.argv[3] || 40);

(async () => {
  const t = await boot(), lat = [], codes = {};
  const emails = ['aisha', 'elena', 'marcus', 'admin', 'priya', 'liam', 'tariq', 'yuki'];
  const tokens = await Promise.all(emails.map((e) => t.as(e)));
  const timed = async (fn) => { const s = process.hrtime.bigint(); const r = await fn(); lat.push(Number(process.hrtime.bigint() - s) / 1e6); codes[r.status] = (codes[r.status] || 0) + 1; return r; };
  async function vu(i) {
    const tok = tokens[i % 4]; // aisha, elena, marcus, admin
    for (let k = 0; k < per; k++) {
      const x = (i + k) % 10;
      if (x < 3) await timed(() => t.call('GET', '/api/projects/search?f=%7B%7D&page=' + (1 + (k % 2)), undefined, tok));
      else if (x < 5) await timed(() => t.call('GET', '/api/dashboard', undefined, tok));
      else if (x < 7) await timed(() => t.call('GET', '/api/notifications', undefined, tok));
      else if (x < 8) await timed(() => t.call('GET', '/api/summary', undefined, tok));
      else if (x < 9 && i % 4 === 0) await timed(() => t.call('POST', '/api/projects/PRJ-1001/tasks', { title: 'Load ' + i + '-' + k }, tok));
      else await timed(() => t.call('POST', '/api/notifications/all/read', undefined, tok));
    }
  }
  const t0 = Date.now();
  await Promise.all(Array.from({ length: users }, (_, i) => vu(i)));
  const secs = (Date.now() - t0) / 1000;
  lat.sort((a, b) => a - b);
  const p = (q) => lat[Math.min(lat.length - 1, Math.floor(lat.length * q))].toFixed(1);
  const serverErrors = Object.keys(codes).filter((c) => c >= 500).reduce((a, c) => a + codes[c], 0);
  const out = { users, requests: lat.length, seconds: +secs.toFixed(1), rps: Math.round(lat.length / secs), p50_ms: +p(0.5), p95_ms: +p(0.95), max_ms: +lat[lat.length - 1].toFixed(1), statusCodes: codes, serverErrors };
  console.log(JSON.stringify(out, null, 2));
  await t.close();
  process.exit(out.p95_ms < 2000 && serverErrors === 0 ? 0 : 1);
})();
