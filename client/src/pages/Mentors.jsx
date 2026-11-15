import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { Modal } from '../components/Modal.jsx';
import { Avatar, Badge, Btn, Counter, Empty, Field, PageHead, Pager, Skeleton, Tabs, useForm } from '../components/ui.jsx';
import { fail, toast } from '../components/toast.jsx';
import { useSession } from '../hooks/useSession.js';
import { useAction, useLoad, useQuery } from '../hooks/useLoad.js';
import { api, timeAgo } from '../lib/api.js';
import { C, V } from '../lib/shared.js';

const VER = { verified: ['Credentials verified', 'verified'], pending: ['Verification pending', 'pending'], none: ['Not verified', 'none'] };

function RequestDialog({ m, ent, projects, onClose, onDone }) {
  const f = useForm({ topic: '', stage: '', goals: '', guidance: '', projectId: '' }), [busy, run] = useAction();
  function go() {
    const d = { mentorId: m.id, ...f.values }, v = V.validateMentorshipRequest(d); if (!v.ok) return f.setErrors(v.errors);
    f.clear();
    run(async () => {
      try { await api.requestMentorship(d); onClose(); toast('Request sent to ' + m.name + '. You will be notified when they respond.', 'ok', 'Sent'); onDone(); }
      catch (e) { if (e.fields) f.setErrors(e.fields); else { if (e.status === 402 || e.status === 409) onClose(); fail(e); } }
    });
  }
  return (
    <Modal title={'Request mentorship from ' + m.name} size="lg" onClose={onClose} footer={<><button className="btn" type="button" data-close onClick={onClose}>Cancel</button><Btn className="btn tertiary" id="go" busy={busy} busyText="Sending..." onClick={go}><Icon name="send" size="sm" /> Send request</Btn></>}>
      <form id="rf" className="stack" noValidate ref={f.formRef} onSubmit={(e) => { e.preventDefault(); go(); }}>
        {ent && !ent.unlimited ? <div className={'notice ' + (ent.blocked ? 'warn' : '')}><Icon name="info" /><span>{ent.blocked ? 'Your plan does not allow another request. You can fill this in, but sending will be blocked.' : 'This uses 1 of your ' + ent.remaining + ' remaining requests.'}</span></div> : null}
        <div className="grid g2">
          <Field name="topic" label={<>Topic <span className="req">*</span></>} error={f.errors.topic}><select className="select" {...f.bind('topic')} id="rt"><option value="">Choose...</option>{m.mentor.expertise.concat(C.TOPICS.filter((t) => !m.mentor.expertise.includes(t))).map((t) => <option key={t}>{t}</option>)}</select></Field>
          <Field name="stage" label={<>Your project stage <span className="req">*</span></>} error={f.errors.stage}><select className="select" {...f.bind('stage')} id="rs"><option value="">Choose...</option>{C.STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></Field>
        </div>
        <Field name="goals" error={f.errors.goals} label={<>Your goals <span className="req">*</span></>} labelExtra={<span className="counter" id="gc"><Counter value={f.values.goals} min={20} max={600} /></span>}><textarea className="textarea" maxLength={620} placeholder="What do you want to achieve with this mentor's help?" {...f.bind('goals')} id="rg" /></Field>
        <Field name="guidance" label={<>Guidance needed <span className="req">*</span></>} error={f.errors.guidance}><input className="input" maxLength={100} placeholder="e.g. Review of my analysis plan" {...f.bind('guidance')} id="rgd" /></Field>
        <Field name="projectId" label={<>Related project <span className="muted" style={{ fontWeight: 400 }}>(optional)</span></>}><select className="select" {...f.bind('projectId')} id="rp"><option value="">None</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select></Field>
      </form>
    </Modal>
  );
}

function NoteDialog({ kind, onClose, onSend }) {
  const [note, setNote] = useState(''), [busy, run] = useAction();
  return (
    <Modal title={kind === 'clarify' ? 'Ask a clarifying question' : 'Decline this request'} onClose={onClose} footer={<><button className="btn" type="button" data-close onClick={onClose}>Cancel</button><Btn className="btn primary" id="go" busy={busy} onClick={() => run(() => onSend(note))}>Send</Btn></>}>
      <div className="field"><label htmlFor="n">{kind === 'clarify' ? 'Your question' : 'Optional note to the requester'}</label><textarea className="textarea" id="n" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} /></div>
    </Modal>
  );
}

function Inbox({ isMentor, q }) {
  const [dlg, setDlg] = useState(null), [busy, run] = useAction();
  const profile = useLoad(() => (isMentor ? api.getProfile() : Promise.resolve(null)), []);
  const items = q.data ? q.data.items : [];
  async function act(id, a, note) { try { await api.actOnMentorRequest(id, a, note); setDlg(null); toast('Request updated. The student has been notified.', 'ok'); } catch (e) { fail(e); } q.reload(); }
  return (
    <div id="panel-inbox"><div id="inbox" className="stack">
      {q.loading && !q.data ? <Skeleton n={2} h={140} /> : !items.length ? <Empty icon="graduation-cap" title={isMentor ? 'No requests yet' : 'You have not requested mentorship'} text={isMentor ? 'Requests from students and researchers will appear here.' : 'Pick a mentor from the directory to get started.'} />
        : items.map((x) => {
          const other = isMentor ? x.student : x.mentor, wait = x.status === 'pending' || x.status === 'clarify';
          return (
            <article className="card" key={x.id}>
              <div className="card-body"><div className="row nowrap" style={{ alignItems: 'flex-start' }}><Avatar user={other} cls="lg" /><div className="grow stack sm">
                <div className="row between nowrap"><div><b>{other.name}</b> · <span className="muted">{x.topic}</span></div><Badge status={x.status} /></div>
                <div className="small muted">{timeAgo(x.createdAt)} · stage: {x.stage}{x.projectTitle ? ' · ' + x.projectTitle : ''} · <span className="mono">{x.id}</span></div>
                <dl className="kv" style={{ gridTemplateColumns: '130px 1fr', fontSize: '.875rem' }}><dt>Goals</dt><dd>{x.goals}</dd><dt>Guidance needed</dt><dd>{x.guidance}</dd>{x.note ? <><dt>Mentor note</dt><dd>{x.note}</dd></> : null}</dl>
              </div></div></div>
              {isMentor && x.status !== 'declined' && x.status !== 'completed' ? (
                <div className="card-foot"><span className="small muted">Declining returns the allowance to the student.</span><div className="row">
                  {wait ? <><button className="btn sm danger" data-a="decline" type="button" onClick={() => setDlg({ kind: 'decline', id: x.id })}>Decline</button><button className="btn sm" data-a="clarify" type="button" onClick={() => setDlg({ kind: 'clarify', id: x.id })}>Ask to clarify</button><Btn className="btn sm primary" data-a="accept" busy={busy} onClick={() => run(() => act(x.id, 'accept', ''))}>Accept</Btn></> : null}
                  {x.status === 'accepted' ? <Btn className="btn sm tertiary" data-a="complete" busy={busy} onClick={() => run(() => act(x.id, 'complete', ''))}>Mark completed</Btn> : null}
                </div></div>
              ) : null}
            </article>
          );
        })}
      {dlg ? <NoteDialog kind={dlg.kind} onClose={() => setDlg(null)} onSend={(note) => act(dlg.id, dlg.kind, note)} /> : null}
    </div></div>
  );
}

export default function Mentors() {
  const me = useSession(), qp = useQuery(), isMentor = me.role === 'mentor';
  const [tab, setTab] = useState(qp.tab === 'inbox' || isMentor ? 'inbox' : 'directory'), [page, setPage] = useState(1);
  const [f, setF] = useState({ q: '', topic: '', ver: false, acc: false }), [res, setRes] = useState(null), [err, setErr] = useState(null), [loading, setLoading] = useState(!isMentor);
  const [dlg, setDlg] = useState(null), [projects, setProjects] = useState([]), seq = useRef(0), pre = useRef(qp.mentor), first = useRef(true);
  const inbox = useLoad(() => api.listMentorRequests(), []), accepting = useLoad(() => (isMentor ? api.getProfile() : Promise.resolve(null)), []);
  useEffect(() => { document.title = (isMentor ? 'Mentorship' : 'Mentors') + ' - RCMP'; if (!isMentor) api.myProjects().then((ps) => setProjects(ps.filter((p) => p.status !== 'closed'))).catch(() => {}); }, []); // eslint-disable-line

  const search = async () => {
    const id = ++seq.current; setLoading(true); setErr(null);
    try {
      const r = await api.searchMentors({ q: f.q, topic: f.topic, verifiedOnly: f.ver, acceptingOnly: f.acc }, page);
      if (id !== seq.current) return; setRes(r); setPage(r.page);
      if (pre.current) { const m = r.items.find((x) => x.id === pre.current); pre.current = null; if (m) setDlg(m); }
    } catch (e) { if (id === seq.current) { setErr(e); fail(e); } }
    if (id === seq.current) setLoading(false);
  };
  useEffect(() => { if (isMentor) return undefined; const t = setTimeout(search, first.current ? 0 : 200); first.current = false; return () => clearTimeout(t); }, [page, JSON.stringify(f)]); // eslint-disable-line
  const ent = res ? res.entitlement : null, pendingCount = inbox.data ? inbox.data.items.filter((x) => x.status === 'pending' || x.status === 'clarify').length : 0;
  const upd = (k, v) => { setPage(1); setF({ ...f, [k]: v }); };
  const tabs = isMentor ? [{ id: 'inbox', label: <>Incoming requests <span className="count" id="cInbox">{pendingCount}</span></> }]
    : [{ id: 'directory', label: 'Directory' }, { id: 'inbox', label: <>My requests <span className="count" id="cInbox">{pendingCount}</span></> }];

  return (
    <div className="content">
      <PageHead eyebrow="Mentorship" title={isMentor ? 'Mentorship' : 'Mentors'} sub={isMentor ? 'Review requests from students and researchers, ask clarifying questions, and control how many you receive.' : 'Browse mentors by topic, check their qualifications and verification status, and send a request describing your goals.'}>
        {isMentor && accepting.data ? <label className="check" style={{ background: '#fff', border: '1px solid var(--border-strong)', borderRadius: 8, padding: '8px 14px' }}><span className="switch"><input type="checkbox" id="accepting" checked={!!accepting.data.mentor.accepting} onChange={async (e) => { const on = e.target.checked; try { await api.toggleAccepting(on); accepting.setData((d) => ({ ...d, mentor: { ...d.mentor, accepting: on } })); toast(on ? 'You are accepting requests.' : 'You will not receive new requests.', 'ok'); } catch (x) { fail(x); } }} /><span /></span><b className="small">Accepting new requests</b></label> : null}
      </PageHead>
      <div className="notice warn mb"><Icon name="alert-triangle" /><div><strong>Mentorship is not official supervision.</strong> Mentors offer guidance on request. They do not replace your university supervisor, and RCMP cannot guarantee mentor quality or compatibility. Credential verification is optional and its status is shown accurately.</div></div>
      <Tabs label="Mentorship views" value={tab} onChange={setTab} tabs={tabs} />
      {tab === 'directory' && !isMentor ? (
        <div id="panel-directory">
          <div className="card card-pad mb" style={{ padding: 16 }}><form id="f" className="row" style={{ alignItems: 'flex-end' }} noValidate onSubmit={(e) => e.preventDefault()}>
            <div className="field grow" style={{ minWidth: 200 }}><label htmlFor="q">Search mentors</label><div className="input-icon"><Icon name="search" /><input className="input" id="q" maxLength={60} placeholder="Name, topic or institution" value={f.q} onChange={(e) => upd('q', e.target.value)} /></div></div>
            <div className="field" style={{ minWidth: 200 }}><label htmlFor="topic">Topic</label><select className="select" id="topic" value={f.topic} onChange={(e) => upd('topic', e.target.value)}><option value="">Any topic</option>{C.TOPICS.map((t) => <option key={t}>{t}</option>)}</select></div>
            <label className="check" style={{ paddingBottom: 10 }}><input type="checkbox" id="ver" checked={f.ver} onChange={(e) => upd('ver', e.target.checked)} /><span>Verified only</span></label>
            <label className="check" style={{ paddingBottom: 10 }}><input type="checkbox" id="acc" checked={f.acc} onChange={(e) => upd('acc', e.target.checked)} /><span>Accepting requests</span></label>
          </form></div>
          <div id="ent" className="mb">{ent && !ent.unlimited ? (ent.blocked
            ? <div className="notice warn"><Icon name="lock" /><div><b>{ent.allowance === 0 ? 'Your plan does not include mentorship requests.' : 'You have used your allowance for this period.'}</b> You can still browse. <Link to="/subscription">Choose a plan</Link> to send requests.</div></div>
            : <div className="notice"><Icon name="info" /><div>You have <b>{ent.remaining}</b> of {ent.allowance} requests left on <b>{ent.plan.name}</b>. A request uses one allowance and is returned if the mentor declines.</div></div>) : null}</div>
          <p className="muted mb" id="count" role="status">{res && !loading ? res.total + (res.total === 1 ? ' mentor' : ' mentors') : ''}</p>
          {loading ? <div id="list" className="grid g2"><Skeleton n={4} h={220} /></div> : err ? <Empty icon="alert-circle" title="Could not load mentors" text={err.message} />
            : !res.items.length ? <Empty icon="search" title="No mentor matches that topic" text="Try another topic or remove the verified/accepting filters - or ask a researcher for support instead."><Link className="btn" to="/support">Ask for researcher support</Link></Empty>
              : <div id="list" className="grid g2">{res.items.map((m) => {
                const v = VER[m.mentor.verification];
                return (
                  <article className="card person-card" key={m.id}>
                    <div className="head"><Avatar user={m} cls="lg" /><div className="grow"><h3><Link to={'/profile-view?id=' + m.id}>{m.name}</Link></h3><div className="small muted">{m.headline}</div><div className="row" style={{ marginTop: 6 }}><Badge status={v[1]} label={v[0]} />{m.mentor.accepting ? <Badge status="active" label="Accepting requests" /> : <Badge status="none" label="Not accepting" />}</div></div></div>
                    <div><div className="xs muted" style={{ marginBottom: 4 }}>MENTORING TOPICS</div><div className="tags">{m.mentor.expertise.map((s) => <span className="chip teal" key={s}>{s}</span>)}</div></div>
                    <div><div className="xs muted" style={{ marginBottom: 4 }}>QUALIFICATIONS</div><ul className="small" style={{ margin: 0, paddingLeft: 18, color: 'var(--text-2)' }}>{m.mentor.qualifications.map((s) => <li key={s}>{s}</li>)}</ul></div>
                    <div className="small muted">{m.institution ? m.institution + ' · ' : ''}{m.availability ? m.availability.hours + ' h/week available' : ''}</div>
                    <div className="row between"><Link className="btn sm" to={'/profile-view?id=' + m.id}>View profile</Link><button className="btn tertiary sm" type="button" data-req={m.id} disabled={!m.mentor.accepting} onClick={() => setDlg(m)}><Icon name="send" size="sm" /> Request mentorship</button></div>
                  </article>
                );
              })}</div>}
          <div id="pager">{res && !loading ? <Pager page={res.page} pages={res.pages} onChange={setPage} /> : null}</div>
        </div>
      ) : <Inbox isMentor={isMentor} q={inbox} />}
      {dlg ? <RequestDialog m={dlg} ent={ent} projects={projects} onClose={() => setDlg(null)} onDone={() => { search(); inbox.reload(); }} /> : null}
    </div>
  );
}
