import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AuthFrame, { Notice } from '../components/AuthFrame.jsx';
import Icon from '../components/Icon.jsx';
import { Btn, Field, useForm } from '../components/ui.jsx';
import { fail } from '../components/toast.jsx';
import { api } from '../lib/api.js';
import { V } from '../lib/shared.js';
import { useAction } from '../hooks/useLoad.js';

const SIDE = [['shield-check', 'Reset links work once and expire after 30 minutes.'], ['lock', 'Changing your password signs out every other session.']];
export default function Forgot() {
  const f = useForm({ email: '' }), [busy, run] = useAction(), [done, setDone] = useState(null);
  useEffect(() => { document.title = 'Forgot password - RCMP'; }, []);
  function submit(ev) {
    ev.preventDefault(); const v = V.validateEmail(f.values.email); if (!v.ok) return f.setErrors({ email: v.error });
    f.clear(); run(async () => { try { setDone(await api.forgotPassword(f.values.email)); } catch (e) { fail(e, { noRedirect: true }); } });
  }
  return (
    <AuthFrame small title="Account recovery" foot="Secure account recovery" points={SIDE}>
      <div><h1>Forgot your password?</h1><p className="muted" style={{ marginTop: 4 }}>Enter your account email. <Link to="/login">Back to sign in</Link></p></div>
      {done ? <Notice type="ok">{done.message}</Notice> : null}
      <form id="form" noValidate className="stack" ref={f.formRef} onSubmit={submit}>
        <Field name="email" label="Email address" error={f.errors.email}><input className="input" type="email" autoComplete="username" required placeholder="name@university.ac.uk" {...f.bind('email')} /></Field>
        <Btn className="btn primary lg block" type="submit" busy={busy} busyText="Sending...">Send reset link</Btn>
      </form>
      {done && done.resetToken ? <div id="demo" className="notice info"><Icon name="info" /><div><strong>Demo mode:</strong> no email service is connected, so the link is shown here. <Link to={'/reset?token=' + encodeURIComponent(done.resetToken)}>Open reset link</Link></div></div> : null}
    </AuthFrame>
  );
}
