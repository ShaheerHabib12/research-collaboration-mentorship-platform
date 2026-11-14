import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import MessageDialog from '../components/MessageDialog.jsx';
import ReportDialog from '../components/ReportDialog.jsx';
import { Avatar, AvatarStack, Badge, ChipInput, Empty, Field, PageHead, Pager, Skeleton, Tabs } from '../components/ui.jsx';
import { ROLE_LABEL } from '../components/AppShell.jsx';
import { fail } from '../components/toast.jsx';
import { api } from '../lib/api.js';
import { C } from '../lib/shared.js';
import { useQuery } from '../hooks/useLoad.js';

const BLANK = { q: '', skills: [], subject: '', stage: '', role: '', maxHours: '', urole: '', interest: '', language: '', avail: '' };

function ProjCard({ p, onInterest, onReport }) {
  const stage = (C.STAGES.find((s) => s.id === p.stage) || {}).label;
  return (
    <article className="card proj-card">
      <div className="row between"><div className="row"><Badge status="open" label={stage} />{p.visibility === 'summary' ? <span className="badge nodot">Summary only</span> : null}</div><span className="mono muted">{p.id}</span></div>
      <h3><Link to={'/project?id=' + p.id}>{p.title}</Link></h3>
      <p className="desc">{p.locked ? 'Details are shared with the team once your request is accepted.' : p.question}</p>
      <div className="meta-box"><div><div className="lbl">Skills</div><div className="tags">{p.skills.slice(0, 4).map((s) => <span className="chip mono" key={s}>{s}</span>)}</div></div><div><div className="lbl">Open roles</div><div className="tags">{p.roles.slice(0, 3).map((s) => <span className="chip plain" key={s}>{s}</span>)}</div></div></div>
      <div className="row between"><div className="row nowrap"><AvatarStack list={p.memberProfiles} /><span className="small muted">{p.owner.name}</span></div><span className="small muted"><Icon name="clock" size="sm" /> {p.hoursPerWeek} h/wk</span></div>
      <div className="row between" style={{ marginTop: -4 }}>
        <button className="btn ghost sm" type="button" onClick={() => onReport({ type: 'project', id: p.id, name: p.title })}><Icon name="flag" size="sm" /> Report</button>
        {p.isMember ? <Link className="btn sm" to={'/workspace?id=' + p.id}>Open workspace</Link> : p.pendingRequest ? <button className="btn sm" disabled>Request pending</button> : <button className="btn primary sm" type="button" data-interest={p.id} onClick={() => onInterest(p)}><Icon name="send" size="sm" /> Send interest</button>}
      </div>
    </article>
  );
}
function PersonCard({ u, canInvite, onInvite, onReport }) {
  const verified = u.mentor && u.mentor.verification === 'verified';
  return (
    <article className="card person-card">
      <div className="head"><Avatar user={u} cls="lg" /><div className="grow"><h3><Link to={'/profile-view?id=' + u.id}>{u.name}</Link></h3><div className="small muted">{u.headline}</div><div className="row" style={{ marginTop: 6 }}><Badge status={u.role === 'mentor' && verified ? 'verified' : 'none'} label={ROLE_LABEL[u.role] + (verified ? ' · verified' : '')} /></div></div></div>
      {u.institution ? <div className="small"><Icon name="building" size="sm" /> {u.institution}</div> : null}
      <div><div className="xs muted" style={{ marginBottom: 4 }}>INTERESTS</div><div className="tags">{u.interests.slice(0, 3).map((s) => <span className="chip" key={s}>{s}</span>)}</div></div>
      <div><div className="xs muted" style={{ marginBottom: 4 }}>SKILLS</div><div className="tags">{u.skills.slice(0, 4).map((s) => <span className="chip mono" key={s}>{s}</span>)}</div></div>
      <div className="small muted">{u.availability ? u.availability.hours + ' h/week · ' + u.availability.days.join(', ') : ''}{u.hidden.length ? <span className="xs muted"><Icon name="lock" size="sm" /> {u.hidden.length} field{u.hidden.length > 1 ? 's' : ''} hidden by user</span> : null}</div>
      <div className="row between"><button className="btn ghost sm" type="button" onClick={() => onReport({ type: 'user', id: u.id, name: u.name })}><Icon name="flag" size="sm" /> Report</button>
        <div className="row"><Link className="btn sm" to={'/profile-view?id=' + u.id}>View</Link>{canInvite ? <button className="btn tertiary sm" type="button" data-invite={u.id} onClick={() => onInvite(u)}><Icon name="user-plus" size="sm" /> Invite</button> : null}</div></div>
    </article>
  );
}

export default function Discover() {
  const qp = useQuery(), [mode, setMode] = useState(qp.tab === 'people' ? 'people' : 'projects'), [page, setPage] = useState(1);
  const [f, setF] = useState({ ...BLANK, q: qp.q || '' }), [res, setRes] = useState(null), [err, setErr] = useState(null), [loading, setLoading] = useState(true), [owned, setOwned] = useState([]);
  const [dlg, setDlg] = useState(null), seq = useRef(0), first = useRef(true);
  useEffect(() => { document.title = 'Discover - RCMP'; api.myProjects().then((ps) => setOwned(ps.filter((p) => p.isOwner && p.status !== 'closed'))).catch(fail); }, []);
  useEffect(() => { setF((x) => ({ ...x, q: qp.q || x.q })); }, [qp.q]);

  const apiFilters = () => mode === 'projects' ? { q: f.q, skills: f.skills, subject: f.subject, stage: f.stage, role: f.role, maxHours: f.maxHours } : { q: f.q, skills: f.skills, role: f.urole, interest: f.interest, language: f.language, availability: f.avail };
  const run = async () => {
    const id = ++seq.current; setLoading(true); setErr(null);
    try { const r = mode === 'projects' ? await api.searchProjects(apiFilters(), page) : await api.searchPeople(apiFilters(), page); if (id === seq.current) { setRes(r); setPage(r.page); } }
    catch (e) { if (id === seq.current) { setErr(e); fail(e); } }
    if (id === seq.current) setLoading(false);
  };
  useEffect(() => { const t = setTimeout(run, first.current ? 0 : 200); first.current = false; return () => clearTimeout(t); }, [mode, page, JSON.stringify(f)]); // eslint-disable-line
  const upd = (k) => (e) => { setPage(1); setF({ ...f, [k]: e.target.value }); };
  const clearAll = () => { setF({ ...BLANK }); setPage(1); };

  return (
    <div className="content">
      <PageHead eyebrow="Discover" title="Discover" sub="Search open research projects and people by topic, skill, role, language and availability."><Link className="btn primary" to="/project-new"><Icon name="folder-plus" /> New project brief</Link></PageHead>
      <Tabs label="What to search" value={mode} onChange={(m) => { setMode(m); setPage(1); }} tabs={[{ id: 'projects', label: <><Icon name="folder" /> Projects</> }, { id: 'people', label: <><Icon name="users" /> People</> }]} />
      <div className="grid split-l">
        <form className="card filter-card" id="filters" role="search" aria-label="Filters" noValidate onSubmit={(e) => e.preventDefault()}>
          <div className="row between"><h3>Filters</h3><button className="btn ghost sm" type="button" id="clear" onClick={clearAll}>Clear all</button></div>
          <Field name="q" label="Keywords" hint="Search text is treated as plain text only."><div className="input-icon"><Icon name="search" /><input className="input" id="q" name="q" maxLength={80} placeholder="Title, topic, skill..." autoComplete="off" value={f.q} onChange={upd('q')} /></div></Field>
          <Field name="fskills" label="Must have skills" htmlFor="fskills-in"><ChipInput id="fskills-in" aria-label="Add a skill filter" value={f.skills} onChange={(x) => { setPage(1); setF({ ...f, skills: x }); }} max={5} placeholder="e.g. Python" /></Field>
          {mode === 'projects' ? (
            <div id="pf" className="stack">
              <Field name="subject" label="Subject area"><select className="select" id="subject" value={f.subject} onChange={upd('subject')}><option value="">Any subject</option>{C.SUBJECTS.map((s) => <option key={s}>{s}</option>)}</select></Field>
              <Field name="stage" label="Research stage"><select className="select" id="stage" value={f.stage} onChange={upd('stage')}><option value="">Any stage</option>{C.STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></Field>
              <Field name="role" label="Open role contains"><input className="input" id="role" maxLength={40} placeholder="e.g. analyst" value={f.role} onChange={upd('role')} /></Field>
              <Field name="maxHours" label="Max hours / week"><input className="input" id="maxHours" type="number" min="1" max="40" value={f.maxHours} onChange={upd('maxHours')} /></Field>
            </div>
          ) : (
            <div id="uf" className="stack">
              <Field name="urole" label="Account type"><select className="select" id="urole" value={f.urole} onChange={upd('urole')}><option value="">Anyone</option><option value="student">Student</option><option value="researcher">Researcher</option><option value="mentor">Mentor</option></select></Field>
              <Field name="interest" label="Interest contains"><input className="input" id="interest" maxLength={40} value={f.interest} onChange={upd('interest')} /></Field>
              <Field name="language" label="Language"><select className="select" id="language" value={f.language} onChange={upd('language')}><option value="">Any language</option>{C.LANGUAGES.map((s) => <option key={s}>{s}</option>)}</select></Field>
              <Field name="avail" label="At least (hours / week)"><input className="input" id="avail" type="number" min="0" max="40" value={f.avail} onChange={upd('avail')} /></Field>
            </div>
          )}
        </form>
        <section aria-live="polite" aria-busy={loading}>
          <div className="row between mb"><p className="muted" id="count" role="status">{res && !loading ? res.total + (res.total === 1 ? ' result' : ' results') + (res.pages > 1 ? ' · page ' + res.page + ' of ' + res.pages : '') : ''}</p></div>
          {loading ? <div id="results" className="grid g2"><Skeleton n={4} h={200} /></div>
            : err ? <div id="results"><Empty icon="alert-circle" title="Search failed" text={err.message} /></div>
              : !res || !res.items.length ? <div id="results"><Empty icon="search" title={'No ' + mode + ' match these filters'} text="Try fewer filters, a broader keyword, or remove a skill. Nothing was found - your search text was treated as plain text."><button className="btn" id="broaden" type="button" onClick={clearAll}>Clear all filters</button></Empty></div>
                : <div id="results" className="grid g2">{res.items.map((it) => mode === 'projects'
                  ? <ProjCard key={it.id} p={it} onReport={(t) => setDlg({ kind: 'report', t })} onInterest={(p) => setDlg({ kind: 'interest', p })} />
                  : <PersonCard key={it.id} u={it} canInvite={owned.length > 0} onReport={(t) => setDlg({ kind: 'report', t })} onInvite={(u) => setDlg({ kind: 'invite', u })} />)}</div>}
          <div id="pager">{res && !loading ? <Pager page={res.page} pages={res.pages} onChange={(p) => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }} /> : null}</div>
        </section>
      </div>
      {dlg && dlg.kind === 'report' ? <ReportDialog target={dlg.t} onClose={() => setDlg(null)} /> : null}
      {dlg && dlg.kind === 'interest' ? <MessageDialog title="Send interest" intro={'Tell the owner why you would like to join "' + dlg.p.title + '".'} okMsg="Interest sent. You can follow its status under Requests." onSend={(m) => api.sendInterest(dlg.p.id, m)} onClose={() => setDlg(null)} onDone={run} /> : null}
      {dlg && dlg.kind === 'invite' ? <InviteDialog u={dlg.u} owned={owned} onClose={() => setDlg(null)} /> : null}
    </div>
  );
}

function InviteDialog({ u, owned, onClose }) {
  const [pid, setPid] = useState(owned[0].id);
  return (
    <MessageDialog title={'Invite ' + u.name} label="Invitation message" sendLabel="Send invitation" placeholder="" okMsg={'Invitation sent to ' + u.name + '.'} onSend={(m) => api.sendInvitation(pid, u.id, m)} onClose={onClose}>
      <Field name="project" label="Project" htmlFor="ip"><select className="select" id="ip" value={pid} onChange={(e) => setPid(e.target.value)}>{owned.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select></Field>
    </MessageDialog>
  );
}
