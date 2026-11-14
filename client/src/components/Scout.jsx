import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { request } from '../lib/api.js';
import { toRoute } from '../lib/api.js';

/* Scout, the help widget. Answers come from POST /api/assistant (a rule-based guide, not an AI model).
   Every string from the server is rendered as text by React, never as markup. */
const KEY = 'rcmp.scout.v1', MAX = 300;
const GREETING = { r: 'bot', t: "Hi, I'm Scout. I can help you find your way around RCMP: collaborators, projects, requests, team agreements, files, mentors, plans and privacy.", x: { links: [], chips: ['Find collaborators', 'Start a project', 'Request a mentor', 'What do the plans include?', 'Is my work private?'] } };
const reduced = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
const load = () => { try { return JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch (e) { return null; } };
const save = (v) => { try { sessionStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { /* ignore */ } };

function Mascot({ eyesRef }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <line x1="24" y1="9" x2="24" y2="5" stroke="#e2e8f0" strokeWidth="2" strokeLinecap="round" />
      <circle cx="24" cy="4" r="2.4" fill="#f59e0b" />
      <rect className="scout-body" x="8" y="12" width="32" height="30" rx="14" fill="#f8fafc" />
      <rect x="11.5" y="20" width="25" height="15" rx="7.5" fill="#0f172a" />
      <g className="scout-eyes" ref={eyesRef}>
        <ellipse className="scout-eye scout-blink" cx="17.5" cy="27" rx="2.6" ry="3.2" fill="#5eead4" />
        <ellipse className="scout-eye scout-blink" cx="30.5" cy="27" rx="2.6" ry="3.2" fill="#5eead4" />
      </g>
      <path d="M20.5 33c1.2 1 5.8 1 7 0" stroke="#5eead4" strokeWidth="1.4" strokeLinecap="round" fill="none" />
      <path d="M24 10 L38 15 L24 20 L10 15 Z" fill="#1e3a8a" stroke="#f8fafc" strokeWidth="1" strokeLinejoin="round" />
      <path d="M36 16.5 v5" stroke="#f59e0b" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
const Svg = ({ d }) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;

export default function Scout() {
  const [open, setOpen] = useState(false), [ping, setPing] = useState(false), [shake, setShake] = useState(false);
  const [msgs, setMsgs] = useState(() => { const h = load(); return h && h.length ? h : [GREETING]; });
  const [text, setText] = useState(''), [busy, setBusy] = useState(false), [typing, setTyping] = useState(false);
  const logRef = useRef(null), inputRef = useRef(null), launchRef = useRef(null), eyesRef = useRef(null);

  useEffect(() => { try { if (!sessionStorage.getItem('rcmp.scout.seen')) { setPing(true); sessionStorage.setItem('rcmp.scout.seen', '1'); } } catch (e) { /* ignore */ } }, []);
  useEffect(() => { const k = (e) => { if (e.key === 'Escape' && open) { setOpen(false); launchRef.current.focus(); } }; document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k); }, [open]);
  useEffect(() => { if (open && logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [msgs, typing, open]);
  useEffect(() => { if (open) { setPing(false); inputRef.current && inputRef.current.focus(); } }, [open]);
  useEffect(() => { // eyes follow the pointer a little
    if (reduced()) return; let tick = false;
    const mv = (e) => { if (tick) return; tick = true; requestAnimationFrame(() => { tick = false; const el = launchRef.current, g = eyesRef.current; if (!el || !g) return; const r = el.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2), d = Math.hypot(dx, dy) || 1, k = Math.min(1, d / 200) * 1.6; g.style.transform = 'translate(' + (dx / d * k).toFixed(2) + 'px,' + (dy / d * k).toFixed(2) + 'px)'; }); };
    document.addEventListener('pointermove', mv, { passive: true }); return () => document.removeEventListener('pointermove', mv);
  }, []);

  function wiggle() { if (shake || open) return; setShake(true); setTimeout(() => setShake(false), 720); }
  async function ask(raw) {
    let t = String(raw || '').trim(); if (!t || busy) return; if (t.length > MAX) t = t.slice(0, MAX);
    setBusy(true); setText(''); setTyping(true);
    const next = [...msgs.map((m) => (m.x && m.x.chips ? { ...m, x: { ...m.x, chips: [] } } : m)), { r: 'me', t }];
    setMsgs(next); const started = Date.now(); let b;
    try { b = await request('POST', '/api/assistant', { message: t }); }
    catch (e) { b = { reply: (e && e.status && e.message) ? e.message : "I can't reach the server right now. Please check your connection and try again.", links: [], chips: [] }; }
    await new Promise((res) => setTimeout(res, reduced() ? 0 : Math.max(0, 450 - (Date.now() - started))));
    const done = [...next, { r: 'bot', t: String(b.reply || ''), x: { links: b.links || [], chips: b.chips || [] } }];
    setTyping(false); setMsgs(done); save(done.slice(-30)); setBusy(false);
    if (inputRef.current) inputRef.current.focus();
  }
  return (
    <div className={'scout idle' + (open ? ' open' : '')}>
      <button type="button" ref={launchRef} className={'scout-launch' + (shake ? ' shake' : '')} aria-label={open ? 'Close Scout' : 'Open Scout, the RCMP help assistant'} aria-expanded={open} aria-controls="scout-panel"
        onClick={() => setOpen(!open)} onMouseEnter={wiggle} onFocus={(e) => { if (e.target.matches(':focus-visible')) wiggle(); }}>
        <Mascot eyesRef={eyesRef} />
        {ping ? <span className="scout-ping" /> : null}
      </button>
      <span className="scout-tip" aria-hidden="true">Need a hand? Ask Scout</span>
      <section className="scout-panel" id="scout-panel" role="dialog" aria-label="Scout help assistant" hidden={!open}>
        <div className="scout-head">
          <div className="scout-avatar"><Mascot /></div>
          <div className="scout-title"><strong>Scout</strong><span>RCMP help guide</span></div>
          <button type="button" className="scout-iconbtn" aria-label="Start a new conversation" title="New conversation" onClick={() => { save(null); setMsgs([GREETING]); inputRef.current && inputRef.current.focus(); }}><Svg d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5" /></button>
          <button type="button" className="scout-iconbtn" aria-label="Close Scout" onClick={() => { setOpen(false); launchRef.current.focus(); }}><Svg d="M6 6l12 12M18 6L6 18" /></button>
        </div>
        <div className="scout-log" role="log" aria-live="polite" aria-label="Conversation with Scout" ref={logRef}>
          {msgs.map((m, i) => (
            <div key={i} className={'scout-msg ' + (m.r === 'me' ? 'me' : 'bot')}>
              <div className="scout-bubble">{m.t}</div>
              {m.x && m.x.links && m.x.links.length ? <div className="scout-links">{m.x.links.filter((k) => /^[a-z0-9-]+\.html$/i.test(k.href)).map((k) => <Link key={k.href} className="scout-link" to={toRoute(k.href)} onClick={() => setOpen(false)}>{k.label} →</Link>)}</div> : null}
              {m.x && m.x.chips && m.x.chips.length && i === msgs.length - 1 ? <div className="scout-chips">{m.x.chips.map((c) => <button key={c} type="button" className="scout-chip" onClick={() => ask(c)}>{c}</button>)}</div> : null}
            </div>
          ))}
          {typing ? <div className="scout-msg" aria-label="Scout is typing"><div className="scout-typing"><i /><i /><i /></div></div> : null}
        </div>
        <form className="scout-form" autoComplete="off" onSubmit={(e) => { e.preventDefault(); ask(text); }}>
          <input ref={inputRef} className="scout-input" type="text" maxLength={MAX} placeholder="Ask how something works…" aria-label="Your question for Scout" enterKeyHint="send" value={text} onChange={(e) => setText(e.target.value)} />
          <button type="submit" className="scout-send" aria-label="Send question" disabled={busy}><Svg d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></button>
        </form>
        <div className="scout-note">Scout is a guide to this platform, not an AI model and not a university adviser. It answers only questions about using RCMP.</div>
      </section>
    </div>
  );
}
