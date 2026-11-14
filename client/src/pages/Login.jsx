import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthFrame, { Notice } from '../components/AuthFrame.jsx';
import Icon from '../components/Icon.jsx';
import { Avatar, Btn, Field, useForm } from '../components/ui.jsx';
import { fail } from '../components/toast.jsx';
import { DEMO, DEMO_PASSWORD, api, colorFor, initials } from '../lib/api.js';
import { V } from '../lib/shared.js';
import { useAction, useQuery } from '../hooks/useLoad.js';
import { useLoad } from '../hooks/useLoad.js';

/** Only allow redirects to our own pages (prevents an open redirect). */
export const safeNext = (n) => (/^\/[a-z0-9-]+(\?[\w=&%.-]*)?$/i.test(n || '') ? n : /^[a-z0-9-]+\.html(\?[\w=&%.-]*)?$/i.test(n || '') ? '/' + n.replace('.html', '') : '/dashboard');

const NOTE = { student: 'Student - has a Plus plan', researcher: 'Researcher - owns projects', mentor: 'Mentor - mentorship inbox', admin: 'Administrator - approvals' };

export default function Login() {
  const params = useQuery(), nav = useNavigate(), f = useForm({ email: '', password: '' });
  const [show, setShow] = useState(false), [busy, run] = useAction();
  const health = useLoad(() => fetch('/api/health').then((r) => r.json()), [], { silent: true });
  useEffect(() => { document.title = 'Sign in - RCMP'; if (params.logout) api.logout(); else if (api.meSync()) nav(safeNext(params.next), { replace: true }); }, []); // eslint-disable-line

  async function signIn(email, password) {
    await run(async () => {
      try { await api.login(email, password); nav(safeNext(params.next)); }
      catch (e) {
        if (e.status === 403 && e.code === 'email_unverified') nav('/verify?email=' + encodeURIComponent(e.email || email) + '&resend=1');
        else if (e.status === 401) f.setErrors({ password: e.message });
        else fail(e, { noRedirect: true });
      }
    });
  }
  function submit(ev) {
    ev.preventDefault(); const errors = {}, v = V.validateEmail(f.values.email);
    if (!v.ok) errors.email = v.error; if (!f.values.password) errors.password = 'Enter your password.';
    if (Object.keys(errors).length) return f.setErrors(errors);
    f.clear(); signIn(f.values.email, f.values.password);
  }
  return (
    <AuthFrame title="Welcome back to your research workspace." foot="Sessions expire after 8 hours and end when you sign out."
      points={[['users', 'Pick up requests, invitations and team agreements where you left off.'], ['kanban', 'Move tasks forward and share files with your team privately.'], ['graduation-cap', 'Track mentorship and researcher-support requests in one place.']]}>
      <div><h1>Sign in</h1><p className="muted" style={{ marginTop: 4 }}>New here? <Link to="/register">Create an account</Link></p></div>
      {params.expired ? <Notice type="warn">Your session expired. Sign in again - any unsaved draft on that page was kept.</Notice> : null}
      {params.logout ? <Notice type="ok">You have been signed out.</Notice> : null}
      {params.reset ? <Notice type="ok">Password changed. Sign in with your new password.</Notice> : null}
      <form id="form" noValidate className="stack" autoComplete="on" ref={f.formRef} onSubmit={submit}>
        <Field name="email" label="Email address" error={f.errors.email}><input className="input" type="email" autoComplete="username" required placeholder="name@university.ac.uk" {...f.bind('email')} /></Field>
        <Field name="password" error={f.errors.password} label="Password"
          labelExtra={<> <button type="button" className="btn ghost sm" id="toggle" aria-pressed={show} style={{ height: 24, padding: '0 6px' }} onClick={() => setShow(!show)}><Icon name={show ? 'eye-off' : 'eye'} size="sm" /> {show ? 'Hide' : 'Show'}</button></>}>
          <input className="input" type={show ? 'text' : 'password'} autoComplete="current-password" required {...f.bind('password')} />
        </Field>
        <p className="small" style={{ margin: 0 }}><Link to="/forgot">Forgot your password?</Link></p>
        <Btn className="btn primary lg block" type="submit" busy={busy} busyText="Signing in...">Sign in</Btn>
      </form>
      {health.data && health.data.demo ? (
        <div className="demo-box" aria-labelledby="demoH">
          <h3 id="demoH" style={{ fontSize: '.9375rem' }}>One-click demo accounts</h3>
          <p className="hint" style={{ margin: '4px 0 12px' }}>Password for all demo accounts: <span className="mono">{DEMO_PASSWORD}</span></p>
          <div className="stack sm">
            {DEMO.map((a) => (
              <button key={a.email} type="button" className="btn block" data-email={a.email} disabled={busy} onClick={() => signIn(a.email, DEMO_PASSWORD)} style={{ justifyContent: 'flex-start', height: 'auto', padding: '10px 12px', textAlign: 'left' }}>
                <Avatar user={{ initials: initials(a.name), color: colorFor(a.id), name: '' }} cls="sm" /><span><b style={{ display: 'block' }}>{a.name}</b><span className="hint">{NOTE[a.role] + (a.name.indexOf('Priya') === 0 ? ' (free plan: shows blocked requests)' : '')}</span></span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </AuthFrame>
  );
}
