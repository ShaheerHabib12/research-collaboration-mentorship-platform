import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { Avatar, Badge, Empty, PageHead, Skeleton } from '../components/ui.jsx';
import { ROLE_LABEL } from '../components/AppShell.jsx';
import { useSession } from '../hooks/useSession.js';
import { useLoad } from '../hooks/useLoad.js';
import { api, daysUntil, timeAgo } from '../lib/api.js';

const SUBS = { student: 'Your projects, requests and support allowance at a glance.', researcher: 'Your projects, collaboration requests and assigned student support.', mentor: 'Mentorship requests and the projects you advise.', admin: 'Approvals, reports and compensation waiting for you.' };
const ACTS = { student: [['/discover', 'Find collaborators', 'search', 1], ['/project-new', 'New project brief', 'folder-plus']], researcher: [['/project-new', 'New project brief', 'folder-plus', 1], ['/support', 'Support queue', 'life-buoy']], mentor: [['/mentors?tab=inbox', 'Mentorship inbox', 'inbox', 1], ['/profile', 'Edit mentor profile', 'user']], admin: [['/admin', 'Open admin console', 'shield-check', 1], ['/compensation', 'Compensation', 'banknote']] };

function Kpi({ label, value, sub, icon, tone, to }) {
  const inner = <><div><div className="k">{label}</div><div className="v num">{value}</div><div className="s">{sub}</div></div><div className={'ic ' + (tone || '')}><Icon name={icon} /></div></>;
  return to ? <Link className={'card kpi ' + (tone === 'teal' ? 'teal' : '')} to={to} style={{ color: 'inherit', textDecoration: 'none' }}>{inner}</Link> : <div className="card kpi">{inner}</div>;
}

function AdminView() {
  const { data, loading } = useLoad(async () => { const [o, n] = await Promise.all([api.adminOverview(), api.listNotifications()]); return { o, n: n.slice(0, 5) }; }, []);
  if (loading || !data) return <div className="grid g4"><Skeleton n={4} h={110} /></div>;
  const { o, n } = data;
  return (
    <>
      <div className="grid g4">
        <Kpi label="Researchers to approve" value={o.pendingResearchers} sub="awaiting your decision" icon="user-plus" tone="amber" to="/admin" />
        <Kpi label="Open reports" value={o.openReports} sub="need moderation" icon="flag" tone="amber" to="/admin" />
        <Kpi label="Statements awaiting approval" value={o.awaitingApproval} sub="ready for review" icon="banknote" to="/compensation" />
        <Kpi label="Failed payouts" value={o.payoutFailed} sub="needs reconciliation" icon="alert-triangle" tone={o.payoutFailed ? 'amber' : 'teal'} to="/compensation" />
      </div>
      <div className="grid split mt-lg" style={{ marginTop: 24 }}>
        <div className="card"><div className="card-head"><h3><Icon name="bell" /> Latest notifications</h3><Link className="btn sm" to="/notifications">View all</Link></div>
          <div className="card-body" id="nl">{n.length ? n.map((x) => <div className="item" key={x.id}><div className="body"><Link className="title" to={'/' + String(x.href).replace(/\.html/, '')}>{x.title}</Link><div className="small muted">{x.body}</div></div><span className="xs muted">{timeAgo(x.ts)}</span></div>) : <p className="muted">Nothing new.</p>}</div></div>
        <div className="card card-pad stack"><h3>Platform snapshot</h3><dl className="kv" style={{ gridTemplateColumns: '1fr auto' }}><dt>Registered users</dt><dd className="num">{o.users}</dd><dt>Open projects</dt><dd className="num">{o.projects}</dd><dt>Unassigned support</dt><dd className="num">{o.unassigned}</dd></dl></div>
      </div>
    </>
  );
}

function MemberView({ me }) {
  const { data: d, loading, error } = useLoad(() => api.dashboard(), []);
  if (error) return <Empty icon="alert-circle" title="Could not load your dashboard" text={error.message} />;
  if (loading || !d) return <div className="grid g4"><Skeleton n={4} h={110} /></div>;
  const ent = d.entitlement, pct = ent && ent.allowance ? Math.round(ent.used / ent.allowance * 100) : 100;
  return (
    <>
      <div className="grid g4">
        <Kpi label="Active projects" value={d.projects.filter((p) => p.status !== 'closed').length} sub={d.projects.length + ' in total'} icon="folder" />
        <Kpi label="Pending requests" value={d.pending.length} sub="waiting for your answer" icon="users" tone="amber" />
        <Kpi label="My open tasks" value={d.tasks.length} sub="assigned to you" icon="check-square" tone="teal" />
        {me.role === 'student' ? <Kpi label="Support allowance" value={ent.remaining + '/' + ent.allowance} sub={ent.plan.name + ' plan'} icon="life-buoy" />
          : me.role === 'researcher' ? <Kpi label="Assigned support" value={d.supportOpen} sub="open student requests" icon="life-buoy" />
            : <Kpi label="Mentorship requests" value={d.mentorPending} sub="waiting for you" icon="graduation-cap" />}
      </div>
      <div className="grid split" style={{ marginTop: 24 }}>
        <div className="stack lg">
          <div className="card"><div className="card-head"><h3><Icon name="users" /> Requests waiting for you</h3><Link className="btn sm" to="/requests">All requests</Link></div>
            <div className="card-body">{d.pending.length ? d.pending.map((r) => (
              <div className="item" key={r.id}><span><Avatar user={r.fromUser} /></span><div className="body"><div className="title">{r.fromUser.name} {r.type === 'invitation' ? 'invited you to' : 'is interested in'} {r.projectTitle}</div><div className="small muted" style={{ marginTop: 2 }}>"{r.message.length > 110 ? r.message.slice(0, 110) + '...' : r.message}"</div></div><Link className="btn sm primary" to="/requests">Respond</Link></div>
            )) : <p className="muted">You are all caught up.</p>}</div></div>
          <div className="card"><div className="card-head"><h3><Icon name="folder" /> My projects</h3><Link className="btn sm" to="/projects">View all</Link></div>
            <div className="card-body">{d.projects.length ? d.projects.slice(0, 4).map((p) => (
              <div className="item" key={p.id}><div className="body"><div className="row between nowrap"><Link className="title" to={'/project?id=' + p.id}>{p.title}</Link><Badge status={p.status} /></div><div className="small muted">{p.isOwner ? 'You own this project' : 'Owner: ' + p.owner.name} · {p.members.length} member{p.members.length === 1 ? '' : 's'}</div></div><Link className="btn sm" to={'/workspace?id=' + p.id}>Workspace</Link></div>
            )) : <Empty icon="folder-plus" title="No projects yet" text="Publish a brief or find a project that needs your skills."><Link className="btn primary" to="/discover">Discover projects</Link></Empty>}</div></div>
          <div className="card"><div className="card-head"><h3><Icon name="check-square" /> My upcoming tasks</h3></div>
            <div className="card-body">{d.tasks.length ? d.tasks.map((t) => { const du = daysUntil(t.due); return (
              <div className="item" key={t.id}><div className="body"><Link className="title" to={'/workspace?id=' + t.projectId}>{t.title}</Link><div className="small muted">{t.projectTitle}</div></div><span className={'small ' + (du !== null && du < 0 ? 'badge bad nodot' : 'muted')}>{t.due ? (du === 0 ? 'Due today' : du < 0 ? 'Overdue' : 'Due in ' + du + 'd') : 'No due date'}</span></div>
            ); }) : <p className="muted">No tasks assigned to you.</p>}</div></div>
        </div>
        <div className="stack lg">
          {me.role === 'student' ? (
            <div className="card card-pad stack"><div className="row between"><h3>Support allowance</h3><Link className="btn sm" to="/subscription">Manage plan</Link></div>
              <div className="row between small"><span>{ent.used} of {ent.allowance} used</span><b className="num">{ent.remaining} left</b></div>
              <div className={'progress ' + (ent.blocked ? 'bad' : pct > 66 ? 'amber' : 'teal')} role="progressbar" aria-label="Support requests used this month" aria-valuenow={pct} aria-valuemin="0" aria-valuemax="100"><i style={{ width: pct + '%' }} /></div>
              {ent.blocked ? <div className="notice warn"><Icon name="info" /><span>{ent.allowance === 0 ? 'Your plan has no support allowance.' : 'Allowance used up for this period.'} <Link to="/subscription">Choose a plan</Link></span></div> : null}
            </div>
          ) : null}
          <div className="card"><div className="card-head"><h3><Icon name="activity" /> Recent activity</h3></div>
            <div className="card-body">{d.activity.length ? d.activity.map((a, i) => <div className="item" key={i}><span><Avatar user={a.user} cls="sm" /></span><div className="body small"><b>{a.user.name}</b> {a.text}<div className="muted xs">{a.projectTitle} · {timeAgo(a.ts)}</div></div></div>) : <p className="muted">No activity yet.</p>}</div></div>
          {d.suggested.length ? (
            <div className="card"><div className="card-head"><h3><Icon name="target" /> Open projects to explore</h3><Link className="btn sm" to="/discover">Discover</Link></div>
              <div className="card-body">{d.suggested.map((p) => <div className="item" key={p.id}><div className="body"><Link className="title" to={'/project?id=' + p.id}>{p.title}</Link><div className="tags" style={{ marginTop: 6 }}>{p.skills.slice(0, 3).map((s) => <span className="chip mono" key={s}>{s}</span>)}</div></div></div>)}</div></div>
          ) : null}
        </div>
      </div>
    </>
  );
}

export default function Dashboard() {
  const me = useSession();
  useEffect(() => { document.title = 'Dashboard - RCMP'; }, []);
  return (
    <div className="content">
      <PageHead eyebrow={ROLE_LABEL[me.role] + ' dashboard'} title={'Welcome back, ' + me.name.replace(/^(Dr\.|Prof\.)\s+/, '').split(' ')[0]} sub={SUBS[me.role]}>
        {ACTS[me.role].map((a) => <Link key={a[0]} className={'btn ' + (a[3] ? 'primary' : '')} to={a[0]}><Icon name={a[2]} /> {a[1]}</Link>)}
      </PageHead>
      <div id="body">{me.role === 'admin' ? <AdminView /> : <MemberView me={me} />}</div>
    </div>
  );
}
