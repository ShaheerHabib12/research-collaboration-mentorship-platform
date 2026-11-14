import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { Btn, Counter, Field, useForm } from '../components/ui.jsx';
import { fail } from '../components/toast.jsx';
import { api } from '../lib/api.js';
import { V } from '../lib/shared.js';
import { useAction } from '../hooks/useLoad.js';

function check(d) {
  const f = {}, n = V.validateName(d.name), m = V.validateEmail(d.email), s = V.sanitizeText(d.subject).length, b = V.sanitizeText(d.message).length;
  if (!n.ok) f.name = n.error; if (!m.ok) f.email = m.error; if (!d.topic) f.topic = 'Choose what your message is about.';
  if (s < 3 || s > 100) f.subject = 'Subject must be 3 to 100 characters.'; if (b < 10 || b > 1000) f.message = 'Message must be 10 to 1000 characters.';
  return f;
}
const TOPICS = [['general', 'General question'], ['account', 'My account'], ['subscription', 'Subscription and billing'], ['mentorship', 'Mentorship or researcher support'], ['bug', 'Something is not working'], ['partnership', 'Partnership or research collaboration']];

export default function Contact() {
  const nav = useNavigate(), f = useForm({ name: '', email: '', topic: '', subject: '', message: '', website: '' }, { live: true }), [busy, run] = useAction();
  useEffect(() => { document.title = 'Contact us - RCMP'; }, []);
  // Live feedback: once a field has shown an error, re-check it on every edit and drop the red as soon as it is valid.
  useEffect(() => {
    const keys = Object.keys(f.errors); if (!keys.length) return;
    const now = check(f.values), next = {}; keys.forEach((k) => { if (now[k]) next[k] = now[k]; });
    if (keys.length !== Object.keys(next).length || keys.some((k) => next[k] !== f.errors[k])) f.setErrors(next);
  }, [f.values]); // eslint-disable-line
  function submit(ev) {
    ev.preventDefault(); const errs = check(f.values); if (Object.keys(errs).length) return f.setErrors(errs);
    f.clear();
    run(async () => { try { const r = await api.sendContact(f.values); nav('/contact-thanks', { state: { ref: r.id }, replace: true }); } catch (err) { fail(err); if (err.fields) f.setErrors(err.fields); } });
  }
  return (
    <>
      <section className="page-hero"><div className="in">
        <div className="eyebrow"><span className="badge info">Contact us</span></div>
        <h1>Talk to the RCMP team.</h1>
        <p className="lead">Questions about your account, a subscription, mentorship, or something that is not working? Send us a message and we will read it.</p>
      </div></section>
      <section className="section"><div className="in contact-grid">
        <div className="card"><div className="card-body card-pad">
          <form id="form" noValidate className="stack" autoComplete="on" data-live ref={f.formRef} onSubmit={submit}>
            <div className="grid g2">
              <Field name="name" label="Your name" error={f.errors.name}><input className="input" autoComplete="name" required maxLength={80} {...f.bind('name')} /></Field>
              <Field name="email" label="Email address" error={f.errors.email}><input className="input" type="email" autoComplete="email" required placeholder="name@university.ac.uk" {...f.bind('email')} /></Field>
            </div>
            <Field name="topic" label="What is it about?" error={f.errors.topic}>
              <select className="select" required {...f.bind('topic')}><option value="" disabled>Choose a topic</option>{TOPICS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            </Field>
            <Field name="subject" label="Subject" error={f.errors.subject}><input className="input" required maxLength={100} {...f.bind('subject')} /></Field>
            <Field name="message" label="Message" labelExtra={<> <span className="counter" id="cnt"><Counter value={f.values.message} min={10} max={1000} /></span></>} error={f.errors.message} hint="Do not include passwords or payment details.">
              <textarea className="textarea" rows={6} required {...f.bind('message')} />
            </Field>
            <div className="hp" aria-hidden="true"><label>Leave this empty <input type="text" id="website" name="website" tabIndex={-1} autoComplete="off" value={f.values.website} onChange={(e) => f.set('website', e.target.value)} /></label></div>
            <Btn className="btn primary lg" type="submit" busy={busy} busyText="Sending...">Send message</Btn>
            <p className="muted small" style={{ marginTop: 12 }}>By sending this form you agree that the team stores your name, e-mail and message to answer you. Read the <Link to="/privacy">privacy notice</Link> and the <Link to="/terms">terms</Link>. Prefer e-mail? Write to <a href="mailto:muhammad.habib@myport.ac.uk">muhammad.habib@myport.ac.uk</a>.</p>
          </form>
        </div></div>
        <aside className="stack contact-side">
          <div className="card tilt-soft"><div className="card-body card-pad"><h3><Icon name="users" /> Find a collaborator</h3><p className="muted small">Looking for people for a project? Browse open projects after you sign in.</p><Link to="/register">Create an account</Link></div></div>
          <div className="card tilt-soft"><div className="card-body card-pad"><h3><Icon name="graduation-cap" /> Mentorship and support</h3><p className="muted small">See how plans and allowances work before you subscribe.</p><Link to="/pricing">View plans</Link></div></div>
          <div className="card tilt-soft"><div className="card-body card-pad"><h3><Icon name="shield-check" /> Privacy</h3><p className="muted small">Messages are stored so the team can answer them and are visible only to administrators.</p><Link to="/privacy">Read the privacy notice</Link></div></div>
        </aside>
      </div></section>
    </>
  );
}
