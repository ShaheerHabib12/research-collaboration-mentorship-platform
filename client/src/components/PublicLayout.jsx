import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useSession } from '../hooks/useSession.js';
import { bindTilt } from '../lib/effects.js';
import { ThemeToggle } from './SiteExtras.jsx';

/** Header (with the mobile hamburger), main landmark and footer shared by the public pages. */
export function PublicLayout() {
  const me = useSession(), loc = useLocation(), [open, setOpen] = useState(false);
  useEffect(() => { setOpen(false); }, [loc.pathname, loc.hash]);
  useEffect(() => { // anchors such as /#features
    if (loc.hash) { const el = document.getElementById(loc.hash.slice(1)); if (el) { el.scrollIntoView(); return; } }
    window.scrollTo(0, 0);
  }, [loc.pathname, loc.hash]);
  useEffect(() => {
    const key = (e) => { if (e.key === 'Escape') setOpen(false); };
    const click = (e) => { if (!e.target.closest('.pub-nav')) setOpen(false); };
    const rs = () => { if (innerWidth > 900) setOpen(false); };
    document.addEventListener('keydown', key); document.addEventListener('click', click); addEventListener('resize', rs);
    return () => { document.removeEventListener('keydown', key); document.removeEventListener('click', click); removeEventListener('resize', rs); };
  }, []);
  useEffect(() => bindTilt(document.getElementById('main') || document.body));
  const on = (p) => (loc.pathname === p && !loc.hash ? ' on' : '');
  return (
    <>
      <a className="skip-link" href="#main">Skip to main content</a>
      <header className={'pub-nav' + (open ? ' open' : '')}>
        <div className="in">
          <Link className="brand" to="/" style={{ border: 0, height: 'auto', padding: 0 }}>
            <span className="brand-mark"><img src="/assets/img/logo-mark.svg" alt="" width="34" height="34" /></span>
            <span><span className="brand-name">RCMP</span><br /><span className="brand-sub">Research &amp; Mentorship</span></span>
          </Link>
          <button type="button" className="nav-toggle" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} aria-controls="pubLinks" onClick={() => setOpen(!open)}><span /></button>
          <nav className="links" id="pubLinks" aria-label="Site" onClick={(e) => { if (e.target.closest('a')) setOpen(false); }}>
            <Link className="l" to="/#features">Features</Link><Link className="l" to="/#how">How it works</Link>
            <Link className={'l' + on('/pricing')} to="/pricing">Pricing</Link><Link className={'l' + on('/contact')} to="/contact">Contact</Link><Link className={'l' + on('/privacy')} to="/privacy">Privacy</Link><ThemeToggle className="icon-btn nav-theme" />
            {me ? <Link className="btn sm" to="/dashboard" id="navSignin">Dashboard</Link> : <><Link className="btn sm" to="/login" id="navSignin">Sign in</Link><Link className="btn primary sm" to="/register" id="navJoin">Get started</Link></>}
          </nav>
        </div>
      </header>
      <main id="main"><Outlet /></main>
      <footer className="pub-footer">
        <div className="foot-cta"><div className="box"><div><h3>Have a question or an idea?</h3><p>Questions about plans, mentorship or your account? Send the team a message.</p></div><Link className="btn" to="/contact">Contact us</Link></div></div>
        <div className="in">
          <div><div className="row" style={{ marginBottom: 12 }}><span className="brand-mark"><img src="/assets/img/logo-mark.svg" alt="" width="34" height="34" /></span><b style={{ color: '#fff', font: '700 1.0625rem var(--font-display)' }}>RCMP</b></div><p>Find collaborators, agree how you will work, and get expert guidance. RCMP gives students and early-career researchers one place to build a project team, organise the work and ask vetted mentors for help.</p></div>
          <div><h4>Platform</h4><Link to="/#features">Features</Link><Link to="/#how">How it works</Link><Link to="/pricing">Pricing</Link></div>
          <div><h4>Company</h4><Link to="/contact">Contact us</Link><Link to="/pricing">Plans and pricing</Link><Link to="/privacy">Privacy notice</Link></div>
          <div><h4>Account</h4><Link to="/login">Sign in</Link><Link to="/register">Create account</Link></div>
          <div><h4>Legal</h4><Link to="/privacy">Privacy notice</Link><Link to="/terms">Terms of use</Link><Link to="/cookies">Cookies and storage</Link><Link to="/privacy#retention">Data retention</Link></div>
        </div>
        <div className="legal">&copy; 2026 Research Collaboration and Mentorship Platform, Team 02, University of Portsmouth. A coursework project. <Link to="/terms">Terms</Link> &middot; <Link to="/privacy">Privacy</Link> &middot; <Link to="/cookies">Cookies</Link></div>
      </footer>
    </>
  );
}
