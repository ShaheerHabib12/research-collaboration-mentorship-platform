import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { bindGlobe, bindHero } from '../lib/effects.js';

const Feature = ({ ic, icon, title, children }) => <article className="card feature"><div className={'ic' + (ic ? ' ' + ic : '')}><Icon name={icon} /></div><h3>{title}</h3><p className="muted">{children}</p></article>;


/** Three-tier stack drawn as three slabs in real 3-D (CSS preserve-3d). Drag to turn it, arrow keys nudge it; it turns slowly on its own unless motion is reduced. */
function Stack3D() {
  const box = useRef(null);
  useEffect(() => {
    const el = box.current; if (!el) return undefined;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let ry = -18, rx = 16, drag = null, raf = 0, t = 0;
    const paint = () => { el.style.setProperty('--sry', ry.toFixed(1) + 'deg'); el.style.setProperty('--srx', rx.toFixed(1) + 'deg'); };
    const tick = () => { if (!drag) { t += 0.012; ry = -18 + Math.sin(t) * 16; paint(); } raf = requestAnimationFrame(tick); };
    paint(); if (!reduce) raf = requestAnimationFrame(tick);
    const down = (e) => { drag = { x: e.clientX, y: e.clientY, ry, rx }; el.setPointerCapture(e.pointerId); };
    const move = (e) => { const r = el.getBoundingClientRect(); el.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100).toFixed(0) + '%'); el.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100).toFixed(0) + '%'); if (!drag) return; ry = Math.max(-40, Math.min(40, drag.ry + (e.clientX - drag.x) * 0.25)); rx = Math.max(4, Math.min(30, drag.rx - (e.clientY - drag.y) * 0.2)); paint(); };
    const up = () => { drag = null; t = Math.asin(Math.max(-1, Math.min(1, (ry + 18) / 16))) || 0; };
    const key = (e) => { const d = { ArrowLeft: [-6, 0], ArrowRight: [6, 0], ArrowUp: [0, 3], ArrowDown: [0, -3] }[e.key]; if (!d) return; e.preventDefault(); ry = Math.max(-40, Math.min(40, ry + d[0])); rx = Math.max(4, Math.min(30, rx + d[1])); paint(); };
    el.addEventListener('pointerdown', down); el.addEventListener('pointermove', move); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('keydown', key);
    return () => { cancelAnimationFrame(raf); el.removeEventListener('pointerdown', down); el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); el.removeEventListener('keydown', key); };
  }, []);
  return (
    <div className="stack3d" ref={box} tabIndex={0} role="group" aria-label="Three-layer architecture, tilt with the mouse or arrow keys. Top: React client. Middle: Express API. Bottom: PostgreSQL database.">
      <div className="stack-model">
        <div className="slab s1"><span className="tag">Layer 1 · Browser</span><b>React 18 client</b><small>26 pages, shared validators</small></div>
        <div className="link l1" aria-hidden="true"><i /></div>
        <div className="slab s2"><span className="tag">Layer 2 · Server</span><b>Express 5 API</b><small>JWT, helmet, rules, Unit of Work</small></div>
        <div className="link l2" aria-hidden="true"><i /></div>
        <div className="slab s3"><span className="tag">Layer 3 · Data</span><b>PostgreSQL 16</b><small>constraints, transactions, encrypted files</small></div>
      </div>
    </div>
  );
}

export default function Landing() {
  const hero = useRef(null), globe = useRef(null);
  useEffect(() => { document.title = 'RCMP - Research Collaboration and Mentorship Platform'; const a = bindHero(hero.current), b = bindGlobe(globe.current); return () => { a(); b(); }; }, []);
  return (
    <>
      <section className="hero" aria-labelledby="h-hero" ref={hero}>
        <div className="in">
          <div>
            <div className="eyebrow"><span className="badge info">Research collaboration platform</span></div>
            <h1 id="h-hero">Find your research team. <em>Agree how you will work.</em> Get expert guidance.</h1>
            <p className="lead">RCMP helps students and early-career researchers find collaborators outside their own network, turn a broad idea into a clear project brief, organise the work in a private workspace, and ask vetted mentors and researchers for help when they get stuck.</p>
            <div className="cta">
              <Link className="btn primary lg" to="/register">Create a free account <Icon name="arrow-right" /></Link>
              <Link className="btn lg" to="/login">Try the demo</Link>
            </div>
            <div className="proof" aria-label="Highlights">
              <div><b>Free</b><span>to collaborate and discover</span></div>
              <div><b>Private</b><span>by default, enforced server-side</span></div>
              <div><b>Mentors</b><span>not supervisors - with clear limits</span></div>
            </div>
          </div>
          <div className="stage" aria-hidden="true">
            <span className="float3d f1"><Icon name="check-circle" size="sm" /> Agreement acknowledged</span>
            <span className="float3d f2"><Icon name="graduation-cap" size="sm" /> Mentor matched</span>
            <span className="float3d f3"><Icon name="kanban" size="sm" /> 3 tasks moved today</span>
            <div className="mock">
              <div className="bar"><i /><i /><i /></div>
              <div className="row between"><span className="badge active">In progress</span><span className="mono muted">PRJ-1001</span></div>
              <h3 style={{ fontSize: '1.25rem' }}>Multimodal Neural Architectures for Clinical Diagnosis</h3>
              <p className="small muted">Can attention-guided fusion of ECG and radiograph data improve triage accuracy?</p>
              <div className="tags"><span className="chip mono">PyTorch</span><span className="chip mono">Machine learning</span><span className="chip mono">Statistics</span></div>
              <div className="meta-box"><div><div className="lbl">Open roles</div><div className="tags"><span className="chip plain">Data analyst</span><span className="chip plain">Student fellow</span></div></div><div><div className="lbl">Commitment</div><b>8 hours / week</b></div></div>
              <div className="row between"><span className="avatar-stack"><span className="avatar sm" style={{ background: '#1d4ed8' }}>ER</span><span className="avatar sm" style={{ background: '#0f766e' }}>AR</span><span className="avatar sm" style={{ background: '#6d28d9' }}>PN</span><span className="avatar sm" style={{ background: '#c2410c' }}>MO</span></span><span className="btn primary sm">Request to collaborate</span></div>
              <div className="notice ok"><Icon name="check-circle" /><span><strong>Team agreement v2</strong> published - 2 of 4 members have acknowledged.</span></div>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="features" aria-labelledby="h-feat">
        <div className="section-head">
          <div className="eyebrow">What you can do</div>
          <h2 id="h-feat">Everything a small research team needs, in one place</h2>
          <p>From the first search to the last milestone - every feature maps back to what supervisors, bachelor's students and master's students told us in our requirements interviews.</p>
        </div>
        <div className="grid g3">
          <Feature icon="user" title="Profiles you control">Publish your interests, skills and availability. Choose, field by field, who can see what.</Feature>
          <Feature icon="folder-plus" title="Project briefs that get replies">A short brief with the question, skills, roles and time commitment - published, paused or closed by the owner.</Feature>
          <Feature icon="search" title="Find and invite collaborators">Search projects and people with filters. Express interest or invite - and always see whether a request is pending, accepted, declined or withdrawn.</Feature>
          <Feature ic="teal" icon="clipboard-check" title="Team agreements">Agree roles, expected contributions, deadlines and authorship early. Members acknowledge or propose revisions.</Feature>
          <Feature icon="kanban" title="A private workspace">Tasks, milestones and files (up to 10 MB) visible only to the team - with a timestamped history of changes.</Feature>
          <Feature ic="teal" icon="graduation-cap" title="Mentors and researcher support">Browse mentor profiles, request guidance, or raise a support request that is matched to an available researcher.</Feature>
        </div>
        <aside className="callout" aria-label="Good to know"><span className="callout-ic"><Icon name="scale" /></span><div><span className="callout-label">Good to know</span><p><strong>Mentorship is not supervision.</strong> RCMP complements, and does not replace, official university supervision, institutional research governance or ethics approval. We cannot guarantee compatibility, publication or mentor quality.</p></div></aside>
      </section>

      <section className="section tint" id="how" aria-labelledby="h-how"><div className="wrap">
        <div className="section-head"><div className="eyebrow">How it works</div><h2 id="h-how">From idea to a working team in four steps</h2></div>
        <ol className="steps">
          <li><h3>Build your profile</h3><p className="muted">Add interests, skills, availability and your privacy settings.</p></li>
          <li><h3>Publish or find a project</h3><p className="muted">Write a brief or search for one that needs your skills.</p></li>
          <li><h3>Agree and organise</h3><p className="muted">Acknowledge the team agreement, then plan tasks and share files privately.</p></li>
          <li><h3>Ask for guidance</h3><p className="muted">Request a mentor or researcher support when you are stuck.</p></li>
        </ol>
      </div></section>

      <section className="section" id="roles" aria-labelledby="h-roles">
        <div className="section-head"><div className="eyebrow">Who it is for</div><h2 id="h-roles">Built around four kinds of user</h2></div>
        <div className="grid g4">
          <Feature icon="user" title="Students">Find a partner, join a team and subscribe to a plan that includes researcher support.</Feature>
          <Feature icon="flask" title="Researchers">Lead projects, answer student support requests, and see transparent compensation statements. Researchers never charge students directly.</Feature>
          <Feature ic="teal" icon="graduation-cap" title="Mentors">Share expertise, set availability and decide which requests to accept.</Feature>
          <Feature ic="amber" icon="shield-check" title="Administrators">Approve researchers, review reports, and approve compensation with a full audit trail.</Feature>
        </div>
      </section>

      <section className="section" id="stack" aria-labelledby="h-stack"><div className="wrap stack-wrap">
        <div><div className="eyebrow">How it is built</div><h2 id="h-stack">Three layers, each talking only to the one below</h2>
          <p className="muted">The browser never touches the database. Every rule is checked again on the server, and each request runs in one database transaction, so a save either happens completely or not at all.</p>
          <p className="small muted">Drag the model to tilt it.</p></div>
        <Stack3D />
      </div></section>

      <section className="section tint" aria-labelledby="h-trust"><div className="wrap">
        <div className="grid g2" style={{ alignItems: 'center' }}>
          <div><div className="eyebrow">Trust by design</div><h2 id="h-trust" style={{ fontSize: '2rem', lineHeight: '2.5rem', letterSpacing: '-.03em' }}>Private ideas stay private</h2>
            <p className="muted" style={{ marginTop: 12, fontSize: '1.0625rem', lineHeight: '1.7rem' }}>Unpublished work is the thing researchers worry about most. Visibility rules are checked on every request, not just hidden in the interface.</p></div>
          <ul className="stack" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {[['lock', 'Server-side permission checks', 'Non-members get a 403 and no file bytes or metadata.'], ['eye-off', 'Field-level visibility', 'Hidden profile fields are never sent to other users.'], ['shield-check', 'Payments stay with the provider', 'RCMP stores references and statuses, never card details.'], ['users', 'Accessible and responsive', 'Keyboard navigation, visible focus, labelled fields and phone-friendly layouts.']].map(([ic, t, d]) => (
              <li key={t} className="row nowrap" style={{ alignItems: 'flex-start' }}><Icon name={ic} /><span><b>{t}</b><br /><span className="muted small">{d}</span></span></li>
            ))}
          </ul>
        </div>
      </div></section>

      <section className="section" id="network" aria-labelledby="h-net"><div className="wrap"><div className="globe-wrap">
        <div>
          <div className="eyebrow">Your research network</div>
          <h2 id="h-net" style={{ fontSize: '2.25rem', lineHeight: '2.75rem', letterSpacing: '-.03em' }}>Collaborators, mentors and researchers in one connected space</h2>
          <p className="muted" style={{ marginTop: 14, fontSize: '1.0625rem', lineHeight: '1.7rem' }}>Every project, agreement and request links people who would not otherwise meet. Drag the globe to explore the network, or use the arrow keys when it is focused.</p>
          <div className="globe-legend"><span><i style={{ background: '#1d4ed8' }} />Students and collaborators</span><span><i style={{ background: '#0f766e' }} />Mentors</span><span><i style={{ background: '#d97706' }} />Researchers</span></div>
          <div className="row" style={{ marginTop: 24 }}><Link className="btn primary" to="/register">Join the network</Link><Link className="btn" to="/pricing">See plans</Link></div>
        </div>
        <canvas id="globe" ref={globe} width="520" height="520" tabIndex={0} role="img" aria-label="Interactive 3-D network of collaborators, mentors and researchers. Drag or use arrow keys to rotate." />
      </div></div></section>

      <section className="section" aria-labelledby="h-cta">
        <div className="cta-band">
          <div><h2 id="h-cta">Ready to find your research team?</h2><p>Create an account in under a minute, or try the demo accounts.</p></div>
          <div className="row"><Link className="btn primary lg" to="/register">Create an account</Link><Link className="btn lg" to="/login">Sign in to the demo</Link></div>
        </div>
      </section>
    </>
  );
}
