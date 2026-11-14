/**
 * api.js - browser side of the three-tier system. Every call is an HTTP request to the Express API (server/),
 * which validates, authorises and stores data in PostgreSQL. Nothing here decides business rules.
 *   status 0  cannot reach the server      401  session missing/expired (session cleared)
 *   others    as documented in docs/API.md
 * The JWT lives in localStorage (rcmp.session.v1). Residual XSS risk is documented in docs/SECURITY.md:
 * React escapes all output and the server sends a strict CSP.
 */
import { C } from './shared.js';

const SESSION_KEY = 'rcmp.session.v1', SIM_KEY = 'rcmp.sim.v1', COUNTS_KEY = 'rcmp.counts.v1';
const BASE = '';
export const DEMO_PASSWORD = 'Demo@1234';

export class ApiError extends Error {
  constructor(status, message, extra) {
    super(message); this.name = 'ApiError'; this.status = status;
    if (extra) for (const k of Object.keys(extra)) if (k !== 'error') this[k] = extra[k];
  }
}

const read = (key) => { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) { return null; } };
const write = (key, v) => { try { if (v === null) localStorage.removeItem(key); else localStorage.setItem(key, JSON.stringify(v)); } catch (e) { /* storage blocked */ } };
const emit = (name, detail) => window.dispatchEvent(new CustomEvent(name, { detail }));

export function getSession() { const s = read(SESSION_KEY); if (!s || !s.token) return null; if (s.exp && s.exp < Date.now()) { clearSession(); return null; } return s; }
function setSession(token, user) {
  let exp = Date.now() + 8 * 3600 * 1000;
  try { exp = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).exp * 1000; } catch (e) { /* keep default */ }
  write(SESSION_KEY, { token, user, exp }); emit('rcmp:session');
}
export function clearSession() { write(SESSION_KEY, null); write(COUNTS_KEY, null); emit('rcmp:session'); }
export const getSim = () => read(SIM_KEY) || {};
export function setSim(p) { const s = Object.assign(getSim(), p); Object.keys(s).forEach((k) => { if (!s[k]) delete s[k]; }); write(SIM_KEY, s); return s; }

/** One place for every network call: headers, offline simulation, error mapping. */
export async function request(method, path, body, opts = {}) {
  const sim = getSim();
  if (sim.offline) throw new ApiError(0, 'You appear to be offline. Nothing was sent - check your connection and try again.');
  const headers = {}, s = getSession(), serverSim = {};
  if (s) headers.Authorization = 'Bearer ' + s.token;
  ['dbFail', 'expireNext', 'conflictNext', 'storageFail'].forEach((k) => { if (sim[k]) serverSim[k] = true; });
  if (Object.keys(serverSim).length) headers['X-RCMP-Sim'] = JSON.stringify(serverSim);
  const init = { method, headers };
  if (opts.raw) { init.body = opts.raw; Object.assign(headers, opts.headers || {}); }
  else if (body !== undefined) { headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(body); }
  let res;
  try { res = await fetch(BASE + path, init); } catch (e) { throw new ApiError(0, 'Cannot reach the server. Check your connection (and that the server is running) - nothing was sent.'); }
  const consumed = res.headers.get('X-RCMP-Sim-Consumed');
  if (consumed) { const off = {}; consumed.split(',').forEach((k) => { off[k] = false; }); setSim(off); }
  if (opts.blob && res.ok) return res.blob();
  const txt = await res.text(); let data;
  try { data = txt ? JSON.parse(txt) : null; } catch (e) { data = null; }
  if (!res.ok) {
    if (res.status === 401 && s) clearSession();
    throw new ApiError(res.status, (data && data.error) || 'The server returned an unexpected response (' + res.status + ').', data);
  }
  return data;
}
const get = (p) => request('GET', p);
const post = (p, b) => request('POST', p, b === undefined ? {} : b);
const put = (p, b) => request('PUT', p, b);
const del = (p) => request('DELETE', p);
const q = (f, page) => '?f=' + encodeURIComponent(JSON.stringify(f || {})) + '&page=' + (page || 1);
const e = encodeURIComponent;

export async function refreshCounts() {
  if (!getSession()) return;
  try { const c = await request('GET', '/api/summary'); write(COUNTS_KEY, c); emit('rcmp:counts', c); } catch (err) { /* badges stay as they were */ }
}
export const counts = () => read(COUNTS_KEY) || { unread: 0, pending: 0 };

export const DEMO = [
  { id: 'USR-101', email: 'aisha@port.ac.uk', name: 'Aisha Rahman', role: 'student' },
  { id: 'USR-102', email: 'elena.vance@port.ac.uk', name: 'Dr. Elena Vance', role: 'researcher' },
  { id: 'USR-103', email: 'marcus.okafor@port.ac.uk', name: 'Prof. Marcus Okafor', role: 'mentor' },
  { id: 'USR-100', email: 'admin@rcmp.example', name: 'Jordan Hale', role: 'admin' },
  { id: 'USR-104', email: 'priya.nair@port.ac.uk', name: 'Priya Nair', role: 'student' }
];

export const api = {
  meSync: () => { const s = getSession(); return s ? s.user : null; },
  // accounts
  /** Resolves with the user, or {pending:true,email} when the e-mail must be confirmed with a PIN first. */
  register: async (d) => { const r = await post('/api/auth/register', d); if (r.pending) return r; setSession(r.token, r.user); return r.user; },
  verifyEmail: async (email, pin) => { const r = await post('/api/auth/verify', { email, pin }); setSession(r.token, r.user); return r.user; },
  resendPin: (email) => post('/api/auth/resend', { email }),
  forgotPassword: (email) => post('/api/auth/forgot', { email }),
  resetPassword: (token, password) => post('/api/auth/reset', { token, password }),
  login: async (email, password) => { const r = await post('/api/auth/login', { email, password }); setSession(r.token, r.user); return r.user; },
  logout: () => { post('/api/auth/logout').catch(() => {}); clearSession(); },
  me: async () => { const u = await get('/api/me'); const s = getSession(); if (s) setSession(s.token, u); return u; },
  getProfile: (id) => get(id ? '/api/profiles/' + e(id) : '/api/profile'),
  updateProfile: async (d) => { const u = await put('/api/profile', d); const s = getSession(); if (s) { s.user = Object.assign({}, s.user, { name: u.name, headline: u.headline }); write(SESSION_KEY, s); emit('rcmp:session'); } return u; },
  exportMyData: () => get('/api/me/export'),
  deleteMyAccount: async () => { const r = await del('/api/me'); clearSession(); return r; },
  dashboard: () => get('/api/dashboard'),
  // discovery + projects
  searchProjects: (f, page) => get('/api/projects/search' + q(f, page)),
  searchPeople: (f, page) => get('/api/people/search' + q(f, page)),
  myProjects: () => get('/api/projects'),
  getProject: (id) => get('/api/projects/' + e(id)),
  saveProject: (d, id, publish) => id ? put('/api/projects/' + e(id), { data: d, publish: !!publish }) : post('/api/projects', { data: d, publish: !!publish }),
  setProjectStatus: (id, status) => post('/api/projects/' + e(id) + '/status', { status }),
  sendInterest: (id, message) => post('/api/projects/' + e(id) + '/interest', { message }),
  sendInvitation: (id, userId, message) => post('/api/projects/' + e(id) + '/invitations', { userId, message }),
  listRequests: () => get('/api/requests'),
  actOnRequest: (id, to) => post('/api/requests/' + e(id) + '/act', { to }),
  // agreement
  getAgreement: (id) => get('/api/projects/' + e(id) + '/agreement'),
  saveAgreement: (id, draft, baseVersion, publish) => put('/api/projects/' + e(id) + '/agreement', { draft, baseVersion, publish: !!publish }),
  acknowledgeAgreement: (id, version) => post('/api/projects/' + e(id) + '/agreement/acknowledge', { version }),
  proposeRevision: (id, section, text) => post('/api/projects/' + e(id) + '/agreement/proposals', { section, text }),
  resolveProposal: (id, pid, decision) => post('/api/projects/' + e(id) + '/agreement/proposals/' + e(pid), { decision }),
  // workspace
  getWorkspace: (id) => get('/api/projects/' + e(id) + '/workspace'),
  saveTask: (id, d, taskId) => taskId ? put('/api/projects/' + e(id) + '/tasks/' + e(taskId), d) : post('/api/projects/' + e(id) + '/tasks', d),
  moveTask: (id, taskId, status) => post('/api/projects/' + e(id) + '/tasks/' + e(taskId) + '/move', { status }),
  deleteTask: (id, taskId) => del('/api/projects/' + e(id) + '/tasks/' + e(taskId)),
  addMilestone: (id, title, due) => post('/api/projects/' + e(id) + '/milestones', { title, due }),
  toggleMilestone: (id, msId) => post('/api/projects/' + e(id) + '/milestones/' + e(msId) + '/toggle'),
  /** file: a real File/Blob (bytes are sent as-is) or {name,size} (a blob of that size is generated). */
  uploadFile: (id, file, permission) => {
    const blob = file && typeof file.slice === 'function' ? file : new Blob([new Uint8Array(Math.max(0, Number(file && file.size) || 0))]);
    return request('POST', '/api/projects/' + e(id) + '/files', undefined, { raw: blob, headers: { 'X-File-Name': e(file.name || ''), 'X-File-Permission': permission || 'team', 'Content-Type': 'application/octet-stream' } });
  },
  /** Downloads the decrypted file after the server has checked membership and permission. */
  openFile: async (id, fileId) => {
    const meta = await get('/api/projects/' + e(id) + '/files/' + e(fileId));
    const blob = await request('GET', '/api/projects/' + e(id) + '/files/' + e(fileId) + '/content', undefined, { blob: true });
    const a = document.createElement('a'), url = URL.createObjectURL(blob); a.href = url; a.download = meta.name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000); return meta;
  },
  deleteFile: (id, fileId) => del('/api/projects/' + e(id) + '/files/' + e(fileId)),
  // mentors + support
  searchMentors: (f, page) => get('/api/mentors/search' + q(f, page)),
  requestMentorship: (d) => post('/api/mentorship-requests', d),
  listMentorRequests: () => get('/api/mentorship-requests'),
  actOnMentorRequest: (id, action, note) => post('/api/mentorship-requests/' + e(id) + '/act', { action, note }),
  toggleAccepting: (accepting) => put('/api/mentors/accepting', { accepting: !!accepting }),
  createSupport: (d) => post('/api/support', d),
  listSupport: () => get('/api/support'),
  updateSupport: (id, action, text) => post('/api/support/' + e(id) + '/act', { action, text }),
  feedbackSupport: (id, rating, comment) => post('/api/support/' + e(id) + '/feedback', { rating, comment }),
  // subscription + compensation
  getSubscription: () => get('/api/subscription'),
  subscribe: (planId, outcome) => post('/api/subscription', { planId, outcome }),
  settlePending: (eventId) => post('/api/subscription/settle', { eventId }),
  cancelSubscription: () => del('/api/subscription'),
  listStatements: () => get('/api/statements'),
  actOnStatement: (id, action, payload) => post('/api/statements/' + e(id) + '/act', { action, payload: payload || {} }),
  // admin
  adminOverview: () => get('/api/admin/overview'),
  listResearchers: () => get('/api/admin/researchers'),
  updateResearcher: (id, patch) => request('PATCH', '/api/admin/researchers/' + e(id), patch),
  reportContent: (d) => post('/api/reports', d),
  listReports: () => get('/api/admin/reports'),
  actOnReport: (id, action) => post('/api/admin/reports/' + e(id) + '/act', { action }),
  listAudit: () => get('/api/admin/audit'),
  sendContact: (d) => post('/api/contact', d),
  listContact: () => get('/api/admin/contact'),
  setContactStatus: (id, status) => post('/api/admin/contact/' + e(id) + '/status', { status }),
  // notifications
  listNotifications: () => get('/api/notifications'),
  markRead: async (id) => { const r = await post('/api/notifications/' + e(id) + '/read'); refreshCounts(); return r; },
  getPrefs: () => get('/api/notification-prefs'),
  setPrefs: (p) => put('/api/notification-prefs', p),
  assistant: (message, history) => post('/api/assistant', { message, history })
};

/** Demo only: restore the seed data on the server and sign out. */
export async function resetDemoData() { await request('POST', '/api/demo/reset', {}); clearSession(); }

/* ---------------- formatting helpers ---------------- */
const D = 24 * 3600 * 1000;
export function timeAgo(ts) {
  const s = Math.max(1, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60); if (m < 60) return m + 'm ago';
  const h = Math.round(m / 60); if (h < 24) return h + 'h ago';
  const d = Math.round(h / 24); if (d < 30) return d + 'd ago';
  return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
export function fmtDate(d) { if (!d) return '-'; const x = typeof d === 'number' ? new Date(d) : new Date(d + (String(d).length === 10 ? 'T00:00:00' : '')); return x.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }
export const fmtSize = (b) => b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB';
export const money = (n) => '£' + Number(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const daysUntil = (d) => d ? Math.round((new Date(d + 'T00:00:00') - new Date(new Date().toDateString())) / D) : null;
export const initials = (n) => C.initials(n);
export const colorFor = (id) => C.colorFor(id);

/** Server-supplied links such as "project.html?id=X" become client routes ("/project?id=X"). */
export function toRoute(href) { if (!href) return '/dashboard'; const h = String(href).replace(/^\//, '').replace(/\.html/, ''); return '/' + (h === 'index' ? '' : h); }
