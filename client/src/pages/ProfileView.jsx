import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import ReportDialog from '../components/ReportDialog.jsx';
import { Avatar, Badge, LockView, Skeleton } from '../components/ui.jsx';
import { ROLE_LABEL } from '../components/AppShell.jsx';
import { useSession } from '../hooks/useSession.js';
import { useLoad, useQuery } from '../hooks/useLoad.js';
import { api } from '../lib/api.js';

export default function ProfileView() {
  const { id } = useQuery(), me = useSession(), nav = useNavigate(), [report, setReport] = useState(false);
  useEffect(() => { document.title = 'Profile - RCMP'; if (!id || id === me.id) nav('/profile', { replace: true }); }, [id]); // eslint-disable-line
  const q = useLoad(() => (id && id !== me.id ? api.getProfile(id) : Promise.resolve(null)), [id], { silent: true });
  if (q.error) return <div className="content" style={{ maxWidth: 980 }}><LockView code={q.error.status || 'Error'} title={q.error.status === 404 ? 'Profile not found' : 'Could not load profile'} text={q.error.status === 404 ? 'This profile does not exist or is not visible to you.' : q.error.message} /></div>;
  const u = q.data; if (!u) return <div className="content" style={{ maxWidth: 980 }}><Skeleton n={1} h={200} /></div>;
  const hid = u.hidden || [], m = u.mentor;
  const row = (l, f, v) => hid.includes(f) ? <><dt>{l}</dt><dd className="muted"><Icon name="lock" size="sm" /> Hidden by this user</dd></> : v ? <><dt>{l}</dt><dd>{f === 'link' ? <a href={/^https?:\/\//i.test(v) ? v : '#'} target="_blank" rel="noopener noreferrer">{v}</a> : v}</dd></> : null;
  const Lbl = ({ children }) => <div className="xs muted" style={{ marginBottom: 6 }}>{children}</div>;
  return (
    <div className="content" style={{ maxWidth: 980 }}>
      <div className="crumbs"><Link to="/discover?tab=people">Discover</Link><Icon name="chevron-right" size="sm" /><span>{u.name}</span></div>
      <section className="card"><div className="card-body"><div className="row nowrap" style={{ alignItems: 'flex-start' }}>
        <Avatar user={u} cls="xl" />
        <div className="grow stack sm"><h1>{u.name}</h1><p className="muted">{u.headline}</p>
          <div className="row"><Badge status="none" label={ROLE_LABEL[u.role]} />{m ? <Badge status={m.verification} label={{ verified: 'Credentials verified', pending: 'Verification pending', none: 'Not verified' }[m.verification]} /> : null}{u.sharesProject ? <span className="badge info nodot"><Icon name="users" size="sm" /> You share a project</span> : null}</div></div>
        <div className="row"><button className="btn ghost" id="report" type="button" onClick={() => setReport(true)}><Icon name="flag" /> Report</button>{m ? <Link className="btn tertiary" to={'/mentors?mentor=' + u.id}><Icon name="graduation-cap" /> Request mentorship</Link> : null}</div>
      </div></div></section>
      <div className="grid g2" style={{ marginTop: 24 }}>
        <section className="card"><div className="card-head"><h3>About</h3></div><div className="card-body">
          <dl className="kv">{row('Institution', 'institution', u.institution)}{row('Department', 'department', u.department)}{row('Experience', 'experience', u.experience)}{row('Availability', 'availability', u.availability ? u.availability.hours + ' h/week · ' + u.availability.days.join(', ') + (u.availability.note ? ' · ' + u.availability.note : '') : '')}{row('Link', 'link', u.link)}<dt>Languages</dt><dd>{(u.languages || []).join(', ')}</dd></dl>
          {hid.length ? <p className="hint" style={{ marginTop: 12 }}><Icon name="lock" size="sm" /> Hidden fields are removed on the server and never sent to your browser.</p> : null}
        </div></section>
        <section className="card"><div className="card-head"><h3>Interests and skills</h3></div><div className="card-body stack">
          <div><Lbl>RESEARCH INTERESTS</Lbl><div className="tags">{u.interests.map((s) => <span className="chip" key={s}>{s}</span>)}</div></div>
          <div><Lbl>SKILLS</Lbl><div className="tags">{u.skills.map((s) => <span className="chip mono" key={s}>{s}</span>)}</div></div>
          {u.preferredRoles && u.preferredRoles.length ? <div><Lbl>PREFERRED ROLES</Lbl><div className="tags">{u.preferredRoles.map((s) => <span className="chip plain" key={s}>{s}</span>)}</div></div> : null}
          {m ? <><div><Lbl>MENTORING TOPICS</Lbl><div className="tags">{m.expertise.map((s) => <span className="chip teal" key={s}>{s}</span>)}</div></div>
            <div><Lbl>QUALIFICATIONS</Lbl><ul style={{ margin: 0, paddingLeft: 18, color: 'var(--text-2)' }}>{m.qualifications.map((s) => <li key={s}>{s}</li>)}</ul></div></> : null}
        </div></section>
      </div>
      {report ? <ReportDialog target={{ type: 'user', id: u.id, name: u.name }} onClose={() => setReport(false)} /> : null}
    </div>
  );
}
