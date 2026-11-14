import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';

export function Notice({ type, children, role = 'status' }) {
  return <div className={'notice ' + type} role={role}><Icon name={type === 'ok' ? 'check-circle' : type === 'info' ? 'info' : 'alert-triangle'} /><div>{children}</div></div>;
}

/** Two-column frame used by sign-in, register, verify, forgot and reset pages. */
export default function AuthFrame({ title, points, foot, small = false, children, cardStyle }) {
  return (
    <div className="auth">
      <aside className="auth-side">
        <Link className="brand" to="/" style={{ border: 0, padding: 0 }}><span className="brand-mark"><img src="/assets/img/logo-mark.svg" alt="" width="34" height="34" /></span><span><span className="brand-name">RCMP</span>{small ? null : <><br /><span className="brand-sub">Research &amp; Mentorship</span></>}</span></Link>
        <div><h2>{title}</h2><ul>{points.map(([ic, t]) => <li key={t}><Icon name={ic} /><span>{t}</span></li>)}</ul></div>
        <p className="small" style={{ color: '#94a3b8' }}>{foot}</p>
      </aside>
      <main className="auth-main" id="main"><div className="auth-card" style={cardStyle}>{children}</div></main>
    </div>
  );
}
