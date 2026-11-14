import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Icon from './Icon.jsx';
import { currentTheme, setTheme } from '../lib/theme.js';

/** Sun/moon button that switches between the light and dark theme. */
export function ThemeToggle({ className = 'icon-btn' }) {
  const [t, setT] = useState(currentTheme());
  const flip = () => { const n = t === 'dark' ? 'light' : 'dark'; setTheme(n); setT(n); };
  return (
    <button type="button" className={className + ' theme-toggle'} id="themeToggle" onClick={flip} aria-pressed={t === 'dark'} aria-label={t === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'} title={t === 'dark' ? 'Light theme' : 'Dark theme'}>
      <span aria-hidden="true">{t === 'dark' ? '☀' : '☾'}</span>
    </button>
  );
}

/** Thin reading-progress bar at the top and a back-to-top button that appears after scrolling. */
export function PageExtras() {
  const [p, setP] = useState(0), [show, setShow] = useState(false);
  useEffect(() => {
    let raf = 0;
    const on = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => {
      const h = document.documentElement, max = h.scrollHeight - h.clientHeight;
      setP(max > 0 ? Math.min(100, Math.round((h.scrollTop / max) * 100)) : 0); setShow(h.scrollTop > 600);
    }); };
    addEventListener('scroll', on, { passive: true }); on();
    return () => { removeEventListener('scroll', on); cancelAnimationFrame(raf); };
  }, []);
  const top = () => { const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches; window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' }); const m = document.getElementById('main'); if (m) { m.setAttribute('tabindex', '-1'); m.focus({ preventScroll: true }); } };
  return (
    <>
      <div className="scroll-progress" aria-hidden="true"><span style={{ width: p + '%' }} /></div>
      {show ? <button type="button" className="back-top" id="backTop" onClick={top} aria-label="Back to top"><Icon name="arrow-up" /></button> : null}
    </>
  );
}

const TITLES = {
  '/': ['RCMP - Research Collaboration and Mentorship Platform', 'Find collaborators, agree how you will work together, and get expert guidance on your research in one private, accessible workspace.'],
  '/pricing': ['Plans and pricing - RCMP', 'Compare the four RCMP plans, from the free Explorer plan to Scholar Pro. Payments are simulated in this coursework build.'],
  '/contact': ['Contact us - RCMP', 'Send the RCMP team a question about plans, mentorship or your account. We reply within 2 to 3 business days.'],
  '/contact-thanks': ['Message sent - RCMP', 'Your message reached the RCMP team.'],
  '/privacy': ['Privacy notice - RCMP', 'What RCMP collects, why, who can see it, and how to review, export or delete your data.'],
  '/terms': ['Terms of use - RCMP', 'The rules for using RCMP, including what is simulated, acceptable use, plans and refunds.'],
  '/cookies': ['Cookies and browser storage - RCMP', 'RCMP sets no tracking cookies. This page lists the small items kept in your browser and why.'],
  '/login': ['Sign in - RCMP', 'Sign in to your RCMP account.'],
  '/register': ['Create your account - RCMP', 'Create a free RCMP account as a student, researcher or mentor.'],
  '/forgot': ['Reset your password - RCMP', 'Ask for a link to choose a new RCMP password.']
};
/** Sets a default page title and meta description from the route. Pages that set their own title run after this and win. */
export function RouteMeta() {
  const { pathname } = useLocation();
  useEffect(() => {
    const t = TITLES[pathname]; let d = document.querySelector('meta[name="description"]');
    if (!d) { d = document.createElement('meta'); d.setAttribute('name', 'description'); document.head.appendChild(d); }
    if (t) { document.title = t[0]; d.setAttribute('content', t[1]); } else { d.setAttribute('content', 'RCMP workspace for research teams: projects, agreements, tasks, files and mentorship.'); }
  }, [pathname]);
  return null;
}
