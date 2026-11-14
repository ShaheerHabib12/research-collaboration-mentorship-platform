// k6 load test (NFR-018): 50 virtual users, p95 under 2 s, under 1 % errors.
// Full run (15 minutes, the NFR-018 test):  k6 run -e BASE_URL=http://localhost:3000 k6/load.js
// Short run (what GitHub Actions does on every push, 1 minute):  add  -e LOAD_DURATION=1m
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  scenarios: { steady: { executor: 'constant-vus', vus: 50, duration: __ENV.LOAD_DURATION || '15m' } },
  thresholds: { http_req_duration: ['p(95)<2000'], http_req_failed: ['rate<0.01'] }
};
const BASE = __ENV.BASE_URL || 'http://localhost:3000';
const USERS = ['aisha@port.ac.uk', 'elena.vance@port.ac.uk', 'marcus.okafor@port.ac.uk', 'priya.nair@port.ac.uk'];

export function setup() {
  return USERS.map((email) => {
    const r = http.post(BASE + '/api/auth/login', JSON.stringify({ email, password: 'Demo@1234' }), { headers: { 'Content-Type': 'application/json' } });
    return r.status === 200 ? r.json('token') : null;
  }).filter(Boolean);
}
export default function (tokens) {
  const h = { headers: { Authorization: 'Bearer ' + tokens[__VU % tokens.length], 'Content-Type': 'application/json' } };
  const paths = ['/api/dashboard', '/api/notifications', '/api/summary', '/api/projects/search?f=%7B%7D&page=1'];
  for (const p of paths) check(http.get(BASE + p, h), { ['200 ' + p]: (r) => r.status === 200 });
  if (__ITER % 10 === 0) check(http.post(BASE + '/api/notifications/all/read', null, h), { read: (r) => r.status < 500 });
  sleep(1);
}
