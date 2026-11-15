import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthFrame, { Notice } from '../components/AuthFrame.jsx';
import { Btn, Field, useForm } from '../components/ui.jsx';
import { fail } from '../components/toast.jsx';
import { api } from '../lib/api.js';
import { V } from '../lib/shared.js';
import { useAction, useQuery } from '../hooks/useLoad.js';

export default function Reset() {
  const params = useQuery(), nav = useNavigate(), f = useForm({ password: '', confirm: '' }), [busy, run] = useAction();
  const [banner, setBanner] = useState(params.token ? null : 'This page needs a reset link. Request one from the forgot-password page.');
  useEffect(() => { document.title = 'Choose a new password - RCMP'; }, []);
  function submit(ev) {
    ev.preventDefault(); const pw = f.values.password, errors = {}, v = V.validatePassword(pw);
    if (!v.ok) errors.password = v.error; if (pw !== f.values.confirm) errors.confirm = 'The two passwords do not match.';
    if (Object.keys(errors).length) return f.setErrors(errors);
    f.clear();
    run(async () => {
      try { await api.resetPassword(params.token, pw); nav('/login?reset=1'); }
      catch (e) { if (e.fields && e.fields.token) setBanner(e.message); else if (e.fields) f.setErrors(e.fields); else fail(e, { noRedirect: true }); }
    });
  }
  return (
    <AuthFrame small title="Account recovery" foot="Secure account recovery" points={[['shield-check', 'Reset links work once and expire after 30 minutes.'], ['lock', 'Changing your password signs out every other session.']]}>
      <div><h1>Choose a new password</h1><p className="muted" style={{ marginTop: 4 }}>Use at least 8 characters with a mix of letters, numbers and symbols.</p></div>
      {banner ? <Notice type="warn">{banner}</Notice> : null}
      <form id="form" noValidate className="stack" hidden={!params.token} ref={f.formRef} onSubmit={submit}>
        <Field name="password" label="New password" error={f.errors.password}><input className="input" type="password" autoComplete="new-password" required {...f.bind('password')} /></Field>
        <Field name="confirm" label="Confirm new password" error={f.errors.confirm}><input className="input" type="password" autoComplete="new-password" required {...f.bind('confirm')} /></Field>
        <Btn className="btn primary lg block" type="submit" busy={busy} busyText="Saving...">Set new password</Btn>
      </form>
    </AuthFrame>
  );
}
