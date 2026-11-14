import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthFrame, { Notice } from '../components/AuthFrame.jsx';
import { Btn, Field, useForm } from '../components/ui.jsx';
import { fail } from '../components/toast.jsx';
import { api } from '../lib/api.js';
import { useAction, useQuery } from '../hooks/useLoad.js';

export default function Verify() {
  const params = useQuery(), nav = useNavigate(), email = params.email || '', f = useForm({ pin: '' }), [busy, run] = useAction();
  const [banner, setBanner] = useState(params.unsent ? { type: 'warn', text: 'We could not send the email just now. Press "send a new code" in a minute.' } : null);
  const [left, setLeft] = useState(60), started = useRef(false);
  useEffect(() => { document.title = 'Check your email - RCMP'; if (api.meSync()) nav('/dashboard', { replace: true }); else if (!email) nav('/register', { replace: true }); }, []); // eslint-disable-line
  useEffect(() => { if (left <= 0) return undefined; const t = setTimeout(() => setLeft(left - 1), 1000); return () => clearTimeout(t); }, [left]);
  async function send() {
    try { await api.resendPin(email); setBanner({ type: 'ok', text: 'A new code is on its way to ' + email + '. It replaces the old one.' }); setLeft(60); } catch (e) { fail(e, { noRedirect: true }); }
  }
  useEffect(() => { if (started.current) return; started.current = true; if (params.resend && email) send(); }, []); // eslint-disable-line
  function submit(ev) {
    ev.preventDefault(); const pin = f.values.pin.trim();
    if (!/^\d{6}$/.test(pin)) return f.setErrors({ pin: 'Enter the 6-digit code from the email.' });
    f.clear();
    run(async () => { try { await api.verifyEmail(email, pin); nav('/profile?welcome=1'); } catch (e) { if (e.fields) f.setErrors(e.fields); else fail(e, { noRedirect: true }); } });
  }
  return (
    <AuthFrame small title="One quick check" foot="Secure sign-up"
      points={[['shield-check', 'We send a 6-digit code so only the real owner of an address can use it.'], ['lock', 'The code works for 10 minutes and allows 5 tries.']]}>
      <div><h1>Check your email</h1><p className="muted" style={{ marginTop: 4 }} id="lead">We sent a 6-digit code to {email}. Enter it below. <Link to="/register">Use a different email</Link></p></div>
      {banner ? <Notice type={banner.type}>{banner.text}</Notice> : null}
      <form id="form" noValidate className="stack" ref={f.formRef} onSubmit={submit}>
        <Field name="pin" label="Verification code" error={f.errors.pin}>
          <input className="input" inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}" required placeholder="123456" style={{ fontSize: '1.5rem', letterSpacing: '.4em', textAlign: 'center' }}
            {...f.bind('pin')} onChange={(e) => f.set('pin', e.target.value.replace(/\D/g, '').slice(0, 6))} />
        </Field>
        <Btn className="btn primary lg block" type="submit" busy={busy} busyText="Checking...">Confirm and continue</Btn>
      </form>
      <p className="muted small">Nothing arrived? Check your spam folder, then <button type="button" className="linklike" id="resend" disabled={left > 0} onClick={send} style={{ background: 'none', border: 0, padding: 0, color: 'var(--primary-strong)', textDecoration: 'underline', cursor: left > 0 ? 'default' : 'pointer', font: 'inherit' }}>send a new code</button> <span id="wait">{left > 0 ? '(available in ' + left + ' s)' : ''}</span></p>
    </AuthFrame>
  );
}
