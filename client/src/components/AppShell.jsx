import { ThemeToggle } from './SiteExtras.jsx';
import { useEffect, useRef, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import Icon from './Icon.jsx';
import { Avatar, LockView } from './ui.jsx';
import { Modal, confirmDialog } from './Modal.jsx';
import { toast, fail } from './toast.jsx';
import { useCounts, useSession } from '../hooks/useSession.js';
import { DEMO, DEMO_PASSWORD, api, colorFor, getSim, initials, resetDemoData, setSim } from '../lib/api.js';
import { useLoad } from '../hooks/useLoad.js';
import { bindTilt, countUp } from '../lib/effects.js';

const NAV = [
  { label: 'Workspace', items: [
    { id: 'dashboard', to: '/dashboard', icon: 'dashboard', text: 'Dashboard', roles: '*' },
    { id: 'discover', to: '/discover', icon: 'search', text: 'Discover', roles: ['student', 'researcher', 'mentor'] },
    { id: 'projects', to: '/projects', icon: 'folder', text: 'My projects', roles: ['student', 'researcher', 'mentor'] },
    { id: 'requests', to: '/requests', icon: 'users', text: 'Requests', roles: ['student', 'researcher', 'mentor'], count: true }
  ] },
  { label: 'Guidance', items: [
    { id: 'mentors', to: '/mentors', icon: 'graduation-cap', text: 'Mentors', roles: ['student', 'researcher', 'mentor'] },
    { id: 'support', to: '/support', icon: 'life-buoy', text: 'Researcher support', roles: ['student', 'researcher', 'admin'] },
    { id: 'subscription', to: '/subscription', icon: 'credit-card', text: 'Subscription', roles: ['student'] },
    { id: 'compensation', to: '/compensation', icon: 'banknote', text: 'Compensation', roles: ['researcher', 'admin'] }
  ] },
  { label: 'Administration', items: [{ id: 'admin', to: '/admin', icon: 'shield-check', text: 'Admin console', roles: ['admin'] }] },
  { label: 'Account', items: [
    { id: 'notifications', to: '/notifications', icon: 'bell', text: 'Notifications', roles: '*' },
    { id: 'profile', to: '/profile', icon: 'user', text: 'My profile', roles: '*' }
  ] }
];
export const ROLE_LABEL = { student: 'Student', researcher: 'Researcher', mentor: 'Mentor', admin: 'Administrator' };

// sub-pages keep their parent highlighted in the sidebar
const PARENT = { 'project-new': 'projects', project: 'projects', workspace: 'projects', agreement: 'projects', 'profile-view': 'discover' };
const isHere = (id, path) => { const seg = path.split('/')[1] || ''; return (PARENT[seg] || seg) === id; };

function Sidebar({ me, open, onNavigate, onMenu }) {
  const c = useCounts(), loc = useLocation();
  return (
    <aside className={'sidebar' + (open ? ' open' : '')} id="sidebar" aria-label="Main navigation">
      <div className="brand-row">
        <Link className="brand" to="/dashboard" onClick={onNavigate}>
          <span className="brand-mark"><img src="/assets/img/logo-mark.svg" alt="" width="34" height="34" /></span>
          <span><span className="brand-name">RCMP</span><br /><span className="brand-sub">Research &amp; Mentorship</span></span>
        </Link>
        <button type="button" className="icon-btn side-menu-btn" id="sideMenuBtn" aria-label="Hide the sidebar" title="Hide the sidebar" aria-controls="sidebar" onClick={onMenu}><Icon name="menu" /></button>
      </div>
      <nav className="nav" aria-label="Primary">
        {NAV.map((g) => {
          const items = g.items.filter((i) => i.roles === '*' || i.roles.includes(me.role));
          if (!items.length) return null;
          return (
            <div key={g.label}>
              <div className="nav-label">{g.label}</div>
              {items.map((i) => (
                <Link key={i.id} to={i.to} onClick={onNavigate} aria-current={isHere(i.id, loc.pathname) ? 'page' : undefined}>
                  <Icon name={i.icon} /><span>{i.text}</span>
                  {i.count && c.pending ? <span className="count" aria-label={c.pending + ' pending'}>{c.pending}</span> : null}
                </Link>
              ))}
            </div>
          );
        })}
      </nav>
      <div className="side-foot">
        <div className="user-chip">
          <Avatar user={{ initials: initials(me.name), color: colorFor(me.id), name: me.name }} />
          <div className="who grow"><b>{me.name}</b><span>{ROLE_LABEL[me.role]}</span></div>
          <Link className="icon-btn" to="/login?logout=1" data-logout aria-label="Sign out" title="Sign out"><Icon name="log-out" /></Link>
        </div>
      </div>
    </aside>
  );
}

function Topbar({ me, onMenu, menuOpen, hidden }) {
  const c = useCounts(), nav = useNavigate(), loc = useLocation();
  const [um, setUm] = useState(false), [q, setQ] = useState(new URLSearchParams(loc.search).get('q') || ''), box = useRef(null);
  useEffect(() => {
    const click = (e) => { if (box.current && !box.current.contains(e.target)) setUm(false); };
    const key = (e) => { if (e.key === 'Escape') setUm(false); };
    document.addEventListener('click', click); document.addEventListener('keydown', key);
    return () => { document.removeEventListener('click', click); document.removeEventListener('keydown', key); };
  }, []);
  const av = { initials: initials(me.name), color: colorFor(me.id), name: me.name };
  return (
    <header className="topbar">
      <button className="icon-btn menu-btn" id="menuBtn" aria-label={hidden || !menuOpen ? 'Show or hide the sidebar' : 'Hide the sidebar'} title="Show or hide the sidebar" aria-controls="sidebar" aria-expanded={menuOpen || !hidden} onClick={onMenu}><Icon name="menu" /></button>
      <form className="search" role="search" onSubmit={(e) => { e.preventDefault(); nav('/discover?q=' + encodeURIComponent(q)); }}>
        <label className="sr-only" htmlFor="gsearch">Search projects and people</label>
        <div className="input-icon"><Icon name="search" /><input id="gsearch" className="input" type="search" name="q" placeholder="Search projects, people, skills..." maxLength={80} autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      </form>
      <div className="spacer" />
      <ThemeToggle />
      <Link className="icon-btn" to="/notifications" aria-label={'Notifications' + (c.unread ? ', ' + c.unread + ' unread' : '')}><Icon name="bell" />{c.unread ? <span className="dot">{c.unread}</span> : null}</Link>
      <div className="rel" ref={box}>
        <button className="icon-btn" id="userBtn" aria-haspopup="true" aria-expanded={um} aria-label="Account menu" style={{ width: 'auto', padding: '0 4px' }} onClick={(e) => { e.stopPropagation(); setUm(!um); }}><Avatar user={av} cls="sm" decor /><Icon name="chevron-down" size="sm" /></button>
        <div className="menu" id="userMenu" hidden={!um}>
          <div className="head"><b style={{ color: 'var(--navy)', fontSize: '.875rem' }}>{me.name}</b><br />{me.email}</div><hr />
          <Link to="/profile"><Icon name="user" /> My profile</Link>
          <Link to="/notifications"><Icon name="bell" /> Notification settings</Link>
          <Link to="/privacy"><Icon name="shield" /> Privacy notice</Link>
          <Link to="/terms"><Icon name="info" /> Terms of use</Link><hr />
          <Link to="/login?logout=1" data-logout><Icon name="log-out" /> Sign out</Link>
        </div>
      </div>
    </header>
  );
}

function DemoTools() {
  const [open, setOpen] = useState(false), [sim, setSimState] = useState(getSim()), me = api.meSync(), nav = useNavigate();
  const health = useLoad(() => fetch('/api/health').then((r) => r.json()), [], { silent: true });
  if (!health.data || !health.data.demo) return null; // the demo tools exist only when the server runs in demo mode (never in production)
  const on = Object.keys(sim).some((k) => sim[k]);
  const sw = (key, label, hint) => (
    <label className="row nowrap between" style={{ alignItems: 'flex-start', gap: 12 }} key={key}>
      <span><b className="small">{label}</b><br /><span className="hint">{hint}</span></span>
      <span className="switch"><input type="checkbox" data-sim={key} checked={!!sim[key]} onChange={(e) => { const s = setSim({ [key]: e.target.checked }); setSimState({ ...s }); toast(e.target.checked ? 'Simulation enabled' : 'Simulation off', 'info'); }} /><span /></span>
    </label>
  );
  return (
    <>
      <button className={'btn demo-fab' + (on ? ' sim-on' : '')} type="button" aria-expanded={open} onClick={() => setOpen(!open)}><Icon name="sliders" /> Demo tools</button>
      <div className="card demo-panel" hidden={!open} role="region" aria-label="Demo tools">
        <div className="row between mb"><h3>Demo tools</h3><button className="icon-btn" type="button" aria-label="Close demo tools" onClick={() => setOpen(false)}><Icon name="x" /></button></div>
        <p className="hint mb">Trigger the error paths from the use-case definitions while recording the demo.</p>
        <div className="stack">
          {sw('offline', 'Offline / network error', 'Every call fails with a network error.')}
          {sw('dbFail', 'Database failure on save', 'Writes return 500 and are rolled back (NFR-010).')}
          {sw('expireNext', 'Expire session on next action', 'Next call returns 401 - drafts are kept.')}
          {sw('conflictNext', 'Lose the next race (409)', 'Next accept/withdraw or agreement save conflicts (NFR-009).')}
          {sw('storageFail', 'File storage failure', 'Next upload returns 500 with no orphan record.')}
        </div>
        <hr className="hr mt mb" />
        <div className="field"><label htmlFor="demoUser">Switch demo user</label>
          <select className="select" id="demoUser" value={me ? me.email : ''} onChange={async (e) => { try { await api.login(e.target.value, DEMO_PASSWORD); nav('/dashboard'); } catch (err) { fail(err); } }}>
            {DEMO.map((a) => <option key={a.email} value={a.email}>{a.name} ({a.role})</option>)}
          </select>
        </div>
        <button className="btn danger block mt" type="button" data-reset onClick={async () => { if (await confirmDialog({ title: 'Reset demo data?', message: 'This restores the original sample data and signs you out.', confirm: 'Reset', danger: true })) { try { await resetDemoData(); nav('/login'); } catch (e) { fail(e); } } }}>Reset all demo data</button>
        <p className="hint mt">All demo passwords: <span className="mono">{DEMO_PASSWORD}</span></p>
      </div>
    </>
  );
}

/** Layout for every signed-in page: skip link, sidebar, top bar, <main id="page">, footer, demo tools. */
export function AppShell() {
  const me = useSession(), loc = useLocation(), [open, setOpen] = useState(false), main = useRef(null);
  useEffect(() => { setOpen(false); window.scrollTo(0, 0); }, [loc.pathname]);
  useEffect(() => { const k = (e) => { if (e.key === 'Escape') setOpen(false); }; document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k); }, []);
  useEffect(() => { // tilt on cards and count-up on KPI numbers once the page content has rendered
    const root = main.current; if (!root) return undefined;
    const undo = bindTilt(root); root.querySelectorAll('.kpi .v').forEach(countUp);
    return undo;
  });
  const [hidden, setHidden] = useState(() => { try { return localStorage.getItem('rcmp-sidebar') === 'hidden'; } catch (e) { return false; } });
  const wide = () => window.matchMedia('(min-width: 1024px)').matches;
  const toggleMenu = () => { if (wide()) { const h = !hidden; setHidden(h); try { localStorage.setItem('rcmp-sidebar', h ? 'hidden' : 'shown'); } catch (e) { /* storage blocked */ } } else setOpen(!open); };
  const nav = useNavigate();
  useEffect(() => { if (!me) nav('/login?next=' + encodeURIComponent(loc.pathname + loc.search), { replace: true }); }, [me, loc.pathname, loc.search, nav]);
  if (!me) return null;
  return (
    <>
      <a className="skip-link" href="#page">Skip to main content</a>
      <div className={'shell' + (hidden ? ' side-hidden' : '')}>
        <Sidebar me={me} open={open} onNavigate={() => setOpen(false)} onMenu={toggleMenu} />
        <div className="main">
          <Topbar me={me} onMenu={toggleMenu} menuOpen={open} hidden={hidden} />
          <main id="page" tabIndex={-1} ref={main}><Outlet /></main>
        </div>
        <footer className="footer">
          <span>&copy; 2026 RCMP &middot; Research Collaboration and Mentorship Platform</span><span className="sp" />
          <Link to="/privacy">Privacy notice</Link><Link to="/contact">Contact us</Link><Link to="/">About</Link>
        </footer>
      </div>
      {hidden ? <button type="button" className="side-edge" aria-label="Show sidebar" title="Show sidebar" onClick={toggleMenu}><Icon name="chevron-right" /></button> : null}
      {open ? <div className="scrim" onClick={() => setOpen(false)} /> : null}
      <DemoTools />
    </>
  );
}

/** Route guard: signed in (else redirect to sign-in with ?next=) and, optionally, an allowed role (else 403 view). */
export function RequireAuth({ roles, children }) {
  const me = useSession(), loc = useLocation(), nav = useNavigate();
  useEffect(() => { if (!me) nav('/login?next=' + encodeURIComponent(loc.pathname + loc.search), { replace: true }); }, [me, loc.pathname, loc.search, nav]);
  if (!me) return null;
  if (roles && !roles.includes(me.role)) {
    return <LockView code="403" title="This page is not available for your role" text={'You are signed in as ' + ROLE_LABEL[me.role] + '. This area is for ' + roles.map((r) => ROLE_LABEL[r]).join(' / ') + ' accounts.'} />;
  }
  return children;
}
