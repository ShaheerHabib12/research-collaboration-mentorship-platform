import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthFrame from '../components/AuthFrame.jsx';
import Icon from '../components/Icon.jsx';
import { Btn, Field, useForm } from '../components/ui.jsx';
import { fail } from '../components/toast.jsx';
import { api } from '../lib/api.js';
import { V } from '../lib/shared.js';
import { useAction } from '../hooks/useLoad.js';

export default function Register() {
  const nav = useNavigate(), f = useForm({ name: '', email: '', role: '', institution: '', password: '', consent: false }), [busy, run] = useAction();
  useEffect(() => { document.title = 'Create account - RCMP'; if (api.meSync()) nav('/dashboard', { replace: true }); }, []); // eslint-disable-line
  function submit(ev) {
    ev.preventDefault(); const d = f.values, errors = {}, n = V.validateName(d.name), e = V.validateEmail(d.email), p = V.validatePassword(d.password);
    if (!n.ok) errors.name = n.error; if (!e.ok) errors.email = e.error; if (!p.ok) errors.password = p.error;
    if (!d.role) errors.role = 'Choose how you will use the platform.'; if (!d.consent) errors.consent = 'You must accept the privacy notice to register.';
    if (Object.keys(errors).length) return f.setErrors(errors);
    f.clear();
    run(async () => {
      try { const r = await api.register(d); nav(r.pending ? '/verify?email=' + encodeURIComponent(r.email) + (r.emailSent === false ? '&unsent=1' : '') : '/profile?welcome=1'); }
      catch (err) { if (err.fields) f.setErrors(err.fields); else fail(err, { noRedirect: true }); }
    });
  }
  const roles = [['student', 'user', 'Student', 'Find teammates, join projects, optional support plans.'], ['researcher', 'flask', 'Researcher', 'Lead projects and answer support requests. Approved by an admin.'], ['mentor', 'graduation-cap', 'Mentor', 'Offer guidance. Credential verification is optional.']];
  return (
    <AuthFrame title="Find collaborators beyond your own network." foot="Demo data is stored on the server you are connected to." cardStyle={{ maxWidth: 480 }}
      points={[['check-circle', 'Free to collaborate: profiles, briefs, discovery and a private workspace.'], ['check-circle', 'You choose what other people can see on your profile and projects.'], ['check-circle', 'Optional student plans add researcher support and mentorship requests.']]}>
      <div><h1>Create your account</h1><p className="muted" style={{ marginTop: 4 }}>Already registered? <Link to="/login">Sign in</Link></p></div>
      <form id="form" noValidate className="stack" ref={f.formRef} onSubmit={submit}>
        <Field name="name" label={<>Full name <span className="req" aria-hidden="true">*</span></>} error={f.errors.name}><input className="input" autoComplete="name" required maxLength={60} {...f.bind('name')} /></Field>
        <Field name="email" label={<>Email address <span className="req" aria-hidden="true">*</span></>} error={f.errors.email}><input className="input" type="email" autoComplete="email" required placeholder="name@university.ac.uk" {...f.bind('email')} /></Field>
        <fieldset className="field" data-field="role">
          <legend>I will use RCMP as a <span className="req" aria-hidden="true">*</span></legend>
          <div className="radio-cards">
            {roles.map(([v, ic, t, d]) => (
              <label className="radio-card" key={v}><input type="radio" name="role" value={v} checked={f.values.role === v} aria-invalid={f.errors.role ? 'true' : undefined} onChange={() => f.set('role', v)} /><span className="t"><Icon name={ic} /> {t}</span><span className="d">{d}</span></label>
            ))}
          </div>
          {f.errors.role ? <div className="error-text" role="alert"><Icon name="alert-circle" size="sm" /><span>{f.errors.role}</span></div> : null}
        </fieldset>
        <Field name="institution" label={<>Institution <span className="muted" style={{ fontWeight: 400 }}>(optional)</span></>} error={f.errors.institution}><input className="input" autoComplete="organization" maxLength={80} {...f.bind('institution')} /></Field>
        <Field name="password" label={<>Password <span className="req" aria-hidden="true">*</span></>} error={f.errors.password}>
          <input className="input" type="password" autoComplete="new-password" required aria-describedby="pwHint" {...f.bind('password')} />
          <div className="strength" id="strength" data-s={V.passwordStrength(f.values.password)} aria-hidden="true"><i /><i /><i /><i /></div>
          <span className="hint" id="pwHint">At least 8 characters with upper-case, lower-case and a number. Passwords are stored salted and hashed (bcrypt), never in plain text.</span>
        </Field>
        <Field name="consent" error={f.errors.consent}>
          <label className="check"><input type="checkbox" id="consent" checked={f.values.consent} aria-invalid={f.errors.consent ? 'true' : undefined} onChange={(e) => f.set('consent', e.target.checked)} /><span>I have read the <Link to="/privacy" target="_blank" rel="noopener">privacy notice</Link> and understand what data RCMP collects and why.</span></label>
        </Field>
        <Btn className="btn primary lg block" type="submit" busy={busy} busyText="Creating account...">Create account</Btn>
      </form>
    </AuthFrame>
  );
}
