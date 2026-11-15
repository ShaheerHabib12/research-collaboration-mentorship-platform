import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { Modal, confirmDialog } from '../components/Modal.jsx';
import MessageDialog from '../components/MessageDialog.jsx';
import ReportDialog from '../components/ReportDialog.jsx';
import ProjectTabs from '../components/ProjectTabs.jsx';
import { Avatar, Badge, Btn, LockView, Skeleton } from '../components/ui.jsx';
import { ROLE_LABEL } from '../components/AppShell.jsx';
import { fail, toast } from '../components/toast.jsx';
import { api, daysUntil, fmtDate, timeAgo } from '../lib/api.js';
import { C } from '../lib/shared.js';
import { useAction, useLoad, useQuery } from '../hooks/useLoad.js';

function InviteSearch({ p, onClose, onPick }) {
  const [q, setQ] = useState(''), [items, setItems] = useState(null);
  useEffect(() => { const t = setTimeout(async () => { try { const r = await api.searchPeople({ q }, 1); setItems(r.items.filter((u) => !p.members.includes(u.id)).slice(0, 5)); } catch (e) { fail(e); } }, 250); return () => clearTimeout(t); }, [q]); // eslint-disable-line
  return (
    <Modal title="Invite a collaborator" size="lg" onClose={onClose} footer={<button className="btn" type="button" data-close onClick={onClose}>Close</button>}>
      <div className="stack"><div className="field"><label htmlFor="iq">Search people by name, skill or interest</label><div className="input-icon"><Icon name="search" /><input className="input" id="iq" maxLength={60} autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)} /></div></div>
        <div id="ir" className="stack sm" aria-live="polite">{items && !items.length ? <p className="muted">No people match.</p> : (items || []).map((u) => <div className="item" key={u.id}><span><Avatar user={u} /></span><div className="body"><b>{u.name}</b><div className="small muted">{u.headline}</div></div><button className="btn tertiary sm" type="button" onClick={() => onPick(u)}>Invite</button></div>)}</div></div>
    </Modal>
  );
}

export default function Project() {
  const { id } = useQuery(), q = useLoad(() => (id ? api.getProject(id) : Promise.resolve(null)), [id], { silent: true });
  const [dlg, setDlg] = useState(null), [busy, run] = useAction();
  useEffect(() => { if (q.data) document.title = q.data.title + ' - RCMP'; }, [q.data]);
  useEffect(() => { if (q.error && (q.error.status === 401 || q.error.status === 0)) fail(q.error); }, [q.error]);
  if (!id) return <div className="content"><LockView code="404" title="No project selected" text="Open a project from My projects or Discover." /></div>;
  if (q.error) { const e = q.error; return <div className="content"><LockView code={e.status || 'Error'} title={e.status === 403 ? 'This project is private' : e.status === 404 ? 'Project not found' : 'Could not load the project'} text={e.message} /></div>; }
  const p = q.data; if (!p) return <div className="content"><Skeleton n={3} h={140} /></div>;
  const stage = (C.STAGES.find((s) => s.id === p.stage) || {}).label, visLabel = { public: 'Public brief', summary: 'Summary only', private: 'Private' }[p.visibility], done = p.milestones.filter((m) => m.done).length;
  async function setStatus(s) {
    if (s === 'closed' && !(await confirmDialog({ title: 'Close this project?', message: 'Pending requests will be declined and the project cannot be reopened.', confirm: 'Close project', danger: true }))) return;
    run(async () => { try { await api.setProjectStatus(p.id, s); toast('Project is now ' + s + '.', 'ok'); } catch (e) { fail(e); } await q.reload(); });
  }
  const person = (r) => (r.type === 'interest' ? r.fromUser : r.toUser);
  return (
    <div className="content">
      <div className="crumbs"><Link to="/projects">My projects</Link><Icon name="chevron-right" size="sm" /><span>{p.id}</span></div>
      <div className="page-head"><div><div className="eyebrow"><Badge status={p.status} /><span className="badge nodot">{stage}</span><span className="badge nodot"><Icon name={p.visibility === 'private' ? 'lock' : 'globe'} size="sm" /> {visLabel}</span><span>{p.id}</span></div><h1>{p.title}</h1></div>
        <div className="actions">
          {p.isOwner ? <>
            <Link className="btn" to={'/project-new?id=' + p.id}><Icon name="pencil" /> Edit brief</Link>
            {p.status === 'open' ? <Btn className="btn" busy={busy} data-status="paused" onClick={() => setStatus('paused')}><Icon name="pause" /> Pause</Btn> : null}
            {p.status === 'paused' ? <Btn className="btn" busy={busy} data-status="open" onClick={() => setStatus('open')}><Icon name="play" /> Resume</Btn> : null}
            {p.status !== 'closed' ? <Btn className="btn danger" busy={busy} data-status="closed" onClick={() => setStatus('closed')}><Icon name="ban" /> Close</Btn> : null}
            {p.status !== 'closed' && p.status !== 'draft' ? <button className="btn tertiary" id="invite" type="button" onClick={() => setDlg({ k: 'invite' })}><Icon name="user-plus" /> Invite</button> : null}
          </> : !p.isMember && p.status === 'open' ? (p.pendingRequest ? <button className="btn" disabled>Request pending</button> : <button className="btn primary" id="interest" type="button" onClick={() => setDlg({ k: 'interest' })}><Icon name="send" /> Send interest</button>) : null}
        </div></div>
      {p.status === 'paused' ? <div className="notice warn mb"><Icon name="pause" /><span>This project is <b>paused</b> and not accepting new requests.</span></div> : null}
      {p.status === 'closed' ? <div className="notice mb"><Icon name="ban" /><span>This project is <b>closed</b>. Pending requests were declined automatically.</span></div> : null}
      {p.isMember ? <ProjectTabs id={p.id} current="project" /> : null}
      <div className="grid split">
        <div className="stack lg">
          <section className="card"><div className="card-body stack">
            <div><h3>Research question</h3><p style={{ marginTop: 6, color: 'var(--text-2)' }}>{p.locked ? 'The owner shares the full brief with the team once a request is accepted.' : p.question}</p></div>
            {p.objectives.length ? <div><h3>Objectives</h3><ol style={{ margin: '6px 0 0', paddingLeft: 20, color: 'var(--text-2)' }}>{p.objectives.map((o, i) => <li key={i}>{o}</li>)}</ol></div> : null}
            {p.methods && p.methods.length ? <div><h3>Methods</h3><div className="tags" style={{ marginTop: 6 }}>{p.methods.map((s) => <span className="chip plain" key={s}>{s}</span>)}</div></div> : null}
            <div className="meta-box"><div><div className="lbl">Required skills</div><div className="tags">{p.skills.map((s) => <span className="chip mono" key={s}>{s}</span>)}</div></div><div><div className="lbl">Open roles</div><div className="tags">{p.roles.length ? p.roles.map((s) => <span className="chip plain" key={s}>{s}</span>) : <span className="muted">None listed</span>}</div></div><div><div className="lbl">Time commitment</div><b>{p.hoursPerWeek} hours / week</b></div><div><div className="lbl">Subject</div><b>{p.subject}</b></div></div>
          </div></section>
          {p.milestones.length ? (
            <section className="card"><div className="card-head"><h3><Icon name="calendar" /> Timeline</h3><span className="small muted">{done} of {p.milestones.length} milestones complete</span></div>
              <div className="card-body"><ul className="timeline">{p.milestones.map((m, i) => { const du = daysUntil(m.due); return <li key={m.id || i} className={m.done ? 'done' : ''}><b>{m.title}</b> {m.done ? <Badge status="completed" label="Done" /> : du !== null && du < 0 ? <span className="badge bad">Overdue</span> : null}<time>{m.due ? fmtDate(m.due) : 'No date'}</time></li>; })}</ul></div></section>
          ) : null}
          {p.isOwner && p.requests.length ? (
            <section className="card"><div className="card-head"><h3><Icon name="users" /> Requests for this project</h3><Link className="btn sm" to="/requests">Manage</Link></div>
              <div className="card-body">{p.requests.slice(0, 5).map((r) => <div className="item" key={r.id}><span><Avatar user={person(r)} cls="sm" /></span><div className="body"><div className="title">{person(r).name} <span className="muted" style={{ fontWeight: 400 }}>· {r.type}</span></div><div className="small muted">{timeAgo(r.createdAt)}</div></div><Badge status={r.status} /></div>)}</div></section>
          ) : null}
        </div>
        <aside className="stack lg">
          <section className="card"><div className="card-head"><h3><Icon name="users" /> Team ({p.memberProfiles.length})</h3></div>
            <div className="card-body">{p.memberProfiles.map((m) => <div className="item" key={m.id}><span><Avatar user={m} /></span><div className="body"><Link className="title" to={'/profile-view?id=' + m.id}>{m.name}</Link><div className="small muted">{m.id === p.ownerId ? 'Project owner' : 'Team member'} · {ROLE_LABEL[m.role]}</div></div></div>)}</div></section>
          {p.isMember
            ? <section className="card card-pad stack"><h3>Quick links</h3><Link className="btn block" to={'/workspace?id=' + p.id}><Icon name="kanban" /> Open workspace</Link><Link className="btn block" to={'/agreement?id=' + p.id}><Icon name="clipboard-check" /> Team agreement</Link></section>
            : <section className="card card-pad stack"><h3>Not a member yet</h3><p className="small muted">Private tasks, files and the team agreement are only visible to members. Non-members receive a 403 from the server.</p><button className="btn ghost sm" id="report" type="button" onClick={() => setDlg({ k: 'report' })}><Icon name="flag" size="sm" /> Report this project</button></section>}
        </aside>
      </div>
      {dlg && dlg.k === 'interest' ? <MessageDialog title="Send interest" label="Message" intro="Tell the owner why you would like to join this project." placeholder="" okMsg="Interest sent." onSend={(m) => api.sendInterest(p.id, m)} onClose={() => setDlg(null)} onDone={q.reload} /> : null}
      {dlg && dlg.k === 'invite' ? <InviteSearch p={p} onClose={() => setDlg(null)} onPick={(u) => setDlg({ k: 'invite2', u })} /> : null}
      {dlg && dlg.k === 'invite2' ? <MessageDialog title={'Invite ' + dlg.u.name} label="Message" intro="Explain the role and what you would work on together." placeholder="" okMsg={'Invitation sent to ' + dlg.u.name + '.'} onSend={(m) => api.sendInvitation(p.id, dlg.u.id, m)} onClose={() => setDlg(null)} onDone={q.reload} /> : null}
      {dlg && dlg.k === 'report' ? <ReportDialog target={{ type: 'project', id: p.id, name: p.title }} onClose={() => setDlg(null)} /> : null}
    </div>
  );
}
