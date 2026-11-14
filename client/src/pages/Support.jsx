import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { Modal } from '../components/Modal.jsx';
import { Avatar, Badge, Btn, Counter, Empty, Field, PageHead, Segmented, Skeleton, Stars } from '../components/ui.jsx';
import { fail, toast } from '../components/toast.jsx';
import { useSession } from '../hooks/useSession.js';
import { useAction, useLoad } from '../hooks/useLoad.js';
import { api, timeAgo } from '../lib/api.js';
import { V } from '../lib/shared.js';

const FILT = ['all', 'pending', 'assigned', 'in_progress', 'completed', 'reopened'];

function TextDialog({ title, label, hint, field, okLabel, onSend, onClose }) {
  const [text, setText] = useState(''), [err, setErr] = useState(''), [busy, run] = useAction();
  return (
    <Modal title={title} onClose={onClose} footer={<><button className="btn" type="button" data-close onClick={onClose}>Cancel</button><Btn className="btn primary" id="go" busy={busy} onClick={() => run(async () => { try { await onSend(text); } catch (e) { if (e.fields) setErr(Object.values(e.fields)[0]); else fail(e); } })}>{okLabel}</Btn></>}>
      <Field name={field} label={<>{label} {hint ? <span className="muted" style={{ fontWeight: 400 }}>{hint}</span> : null}</>} htmlFor="n" error={err}><textarea className="textarea" id="n" maxLength={300} value={text} aria-invalid={err ? 'true' : undefined} onChange={(e) => { setText(e.target.value); setErr(''); }} /></Field>
    </Modal>
  );
}
function RateDialog({ id, onClose, onDone }) {
  const [rating, setRating] = useState(0), [comment, setComment] = useState(''), [err, setErr] = useState(''), [busy, run] = useAction();
  const go = () => { const v = V.validateFeedback(rating, comment); if (!v.ok) return setErr(v.error); run(async () => { try { await api.feedbackSupport(id, rating, comment); onClose(); toast('Thank you for your feedback.', 'ok'); onDone(); } catch (e) { fail(e); } }); };
  return (
    <Modal title="Rate the support you received" onClose={onClose} footer={<><button className="btn" type="button" data-close onClick={onClose}>Cancel</button><Btn className="btn primary" id="go" busy={busy} onClick={go}>Submit feedback</Btn></>}>
      <div className="stack"><p className="muted">Your feedback helps the platform match researchers fairly and feeds their performance bonus (30% weighting).</p>
        <Field name="rating" label="Rating" htmlFor="stars" error={err}>
          <div className="star-input" role="radiogroup" aria-label="Rating" id="stars">{[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" role="radio" className={n <= rating ? 'on' : ''} aria-checked={n === rating} aria-label={n + ' star' + (n > 1 ? 's' : '')} data-n={n} onClick={() => { setRating(n); setErr(''); }}><Icon name="star" size="lg" /></button>))}</div></Field>
        <div className="field"><label htmlFor="fc">Comment <span className="muted" style={{ fontWeight: 400 }}>(optional)</span></label><textarea className="textarea" id="fc" maxLength={320} style={{ minHeight: 72 }} value={comment} onChange={(e) => setComment(e.target.value)} /></div></div>
    </Modal>
  );
}
function NewDialog({ data, projects, onClose, onDone }) {
  const [v, setV] = useState({ category: '', description: '', projectId: '' }), [errs, setErrs] = useState({}), [busy, run] = useAction(), ent = data.entitlement;
  const go = () => run(async () => {
    try { const r = await api.createSupport(v); onClose(); toast(r.researcher ? 'Matched with ' + r.researcher.name + '.' : 'Request saved - waiting for an available researcher.', r.researcher ? 'ok' : 'warn', 'Request sent'); onDone(); }
    catch (e) { if (e.fields) setErrs(e.fields); else { if (e.status === 402) onClose(); fail(e); } }
  });
  const set = (k) => (e) => { setV({ ...v, [k]: e.target.value }); setErrs({ ...errs, [k]: undefined }); };
  return (
    <Modal title="New support request" size="lg" onClose={onClose} footer={<><button className="btn" type="button" data-close onClick={onClose}>Cancel</button><Btn className="btn primary" id="go" busy={busy} busyText="Matching..." onClick={go}>Submit request</Btn></>}>
      <form className="stack" noValidate onSubmit={(e) => { e.preventDefault(); go(); }}>
        <div className="grid g2">
          <Field name="category" label={<>Category <span className="req">*</span></>} htmlFor="c" error={errs.category}><select className="select" id="c" value={v.category} aria-invalid={errs.category ? 'true' : undefined} onChange={set('category')}><option value="">Choose...</option>{data.categories.map((x) => <option key={x}>{x}</option>)}</select></Field>
          <div className="field"><label htmlFor="p">Project context <span className="muted" style={{ fontWeight: 400 }}>(optional)</span></label><select className="select" id="p" value={v.projectId} onChange={set('projectId')}><option value="">None</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select></div>
        </div>
        <Field name="description" htmlFor="d" error={errs.description} label={<>What do you need? <span className="req">*</span></>} labelExtra={<span className="counter" id="dc"><Counter value={v.description} min={20} max={800} /></span>}><textarea className="textarea" id="d" maxLength={820} value={v.description} aria-invalid={errs.description ? 'true' : undefined} onChange={set('description')} /></Field>
        <div className="notice"><Icon name="info" /><span>{ent.blocked ? 'Your plan does not allow another request - sending will be blocked.' : 'This uses 1 of your ' + ent.remaining + ' remaining requests.'} We match on expertise, availability and workload.</span></div>
      </form>
    </Modal>
  );
}

export default function Support() {
  const me = useSession(), student = me.role === 'student', q = useLoad(() => api.listSupport(), []), [filter, setFilter] = useState('all'), [dlg, setDlg] = useState(null), [projects, setProjects] = useState([]), [busy, run] = useAction();
  useEffect(() => { document.title = 'Researcher support - RCMP'; if (student) api.myProjects().then((ps) => setProjects(ps.filter((p) => p.status !== 'closed'))).catch(() => {}); }, []); // eslint-disable-line
  const data = q.data, e = data && data.entitlement;
  const items = data ? data.items.filter((r) => filter === 'all' || r.status === filter) : [];
  const act = (id, action, text, ok) => run(async () => { try { await api.updateSupport(id, action, text); toast(ok, 'ok'); } catch (x) { fail(x); } await q.reload(); });
  return (
    <div className="content">
      <PageHead eyebrow="Researcher support" title="Researcher support" sub={student ? 'Raise a support request that is matched to an available researcher with the right expertise. Researchers never charge you directly - requests are funded by your plan.' : me.role === 'researcher' ? 'Student requests assigned to you by expertise, availability and workload. Completed requests count towards your contribution target.' : 'All support requests across the platform (read-only).'}>
        {student ? <button className="btn primary" id="new" type="button" disabled={!data} onClick={() => setDlg({ k: 'new' })}><Icon name="plus" /> New support request</button> : null}
      </PageHead>
      <div id="ent" className="mb">{student && e ? (e.blocked
        ? <div className="notice warn"><Icon name="lock" /><div><b>{e.allowance === 0 ? 'Your plan (' + e.plan.name + ') does not include support requests.' : 'Allowance used up for this period.'}</b> <Link to="/subscription">Choose a plan</Link> to send new requests.</div></div>
        : <div className="notice"><Icon name="info" /><div><b>{e.remaining} of {e.allowance}</b> requests left on {e.plan.name}. Declined or rejected requests return their allowance.</div></div>) : null}</div>
      <div className="row mb"><Segmented id="seg" label="Filter by status" value={filter} onChange={setFilter} options={FILT.map((s) => [s, s === 'all' ? 'All' : s === 'in_progress' ? 'In progress' : s[0].toUpperCase() + s.slice(1)])} /></div>
      <div id="list" className="stack">
        {q.loading && !data ? <Skeleton n={3} h={120} /> : q.error ? <Empty icon="alert-circle" title="Could not load requests" text={q.error.message} />
          : !items.length ? <Empty icon="life-buoy" title="No requests here" text={student ? 'Need a methodology check, statistics help or writing feedback? Raise a request.' : 'Assigned requests will appear here.'} />
            : items.map((r) => {
              const other = student ? r.researcher : r.student, isRes = me.role === 'researcher';
              const acts = [];
              if (isRes && (r.status === 'assigned' || r.status === 'reopened')) acts.push(<Btn key="s" className="btn sm" busy={busy} data-a="start" data-id={r.id} onClick={() => act(r.id, 'start', undefined, 'Work started. The student has been notified.')}>Start work</Btn>);
              if (isRes && ['assigned', 'in_progress', 'reopened'].includes(r.status)) acts.push(<button key="c" className="btn sm primary" type="button" data-a="complete" data-id={r.id} onClick={() => setDlg({ k: 'complete', id: r.id })}><Icon name="check" size="sm" /> Mark completed</button>);
              if (student && r.status === 'completed') { acts.push(<button key="o" className="btn sm" type="button" data-a="reopen" data-id={r.id} onClick={() => setDlg({ k: 'reopen', id: r.id })}>Re-open / dispute</button>); if (!r.feedback) acts.push(<button key="r" className="btn sm primary" type="button" data-a="rate" data-id={r.id} onClick={() => setDlg({ k: 'rate', id: r.id })}><Icon name="star" size="sm" /> Rate support</button>); }
              return (
                <article className="card" key={r.id}>
                  <div className="card-body"><div className="row nowrap" style={{ alignItems: 'flex-start' }}>{other ? <Avatar user={other} cls="lg" /> : <span className="avatar lg" style={{ background: '#94a3b8' }}>?</span>}<div className="grow stack sm">
                    <div className="row between nowrap"><div><b>{r.category}</b> <span className="muted">· {student ? (r.researcher ? 'with ' + r.researcher.name : 'awaiting a researcher') : 'for ' + r.student.name}</span></div><Badge status={r.status} /></div>
                    <div className="small muted">{timeAgo(r.createdAt)}{r.projectTitle ? ' · ' + r.projectTitle : ''} · <span className="mono">{r.id}</span></div><p style={{ color: 'var(--text-2)' }}>{r.description}</p>
                    {r.status === 'pending' ? <div className="notice warn"><Icon name="clock" /><span>No suitable researcher is available right now. The request stays pending and your allowance is held until one is assigned.</span></div> : null}
                    {r.feedback ? <div className="row"><span className="small muted">Your feedback:</span><Stars n={r.feedback.rating} /><span className="small">{r.feedback.comment}</span></div> : null}
                    <details><summary className="small muted" style={{ cursor: 'pointer' }}>Activity log ({r.log.length})</summary><ul className="timeline" style={{ marginTop: 10 }}>{r.log.map((l, i) => <li key={i}><span className="small">{l.text}</span><time>{new Date(l.ts).toLocaleString('en-GB')}</time></li>)}</ul></details>
                  </div></div></div>
                  {acts.length ? <div className="card-foot"><span className="small muted">{student ? 'Completed work can be re-opened if it did not meet your need.' : 'Completed requests count towards your contribution target.'}</span><div className="row">{acts}</div></div> : null}
                </article>
              );
            })}
      </div>
      {dlg && dlg.k === 'new' ? <NewDialog data={data} projects={projects} onClose={() => setDlg(null)} onDone={q.reload} /> : null}
      {dlg && dlg.k === 'complete' ? <TextDialog title="Mark as completed" label="Summary of the help given" hint="(shown to the student)" field="summary" okLabel="Complete" onClose={() => setDlg(null)} onSend={async (t) => { setDlg(null); await act(dlg.id, 'complete', t, 'Completed. The student can now rate the support.'); }} /> : null}
      {dlg && dlg.k === 'reopen' ? <TextDialog title="Re-open this request" label="What was missing?" field="reason" okLabel="Re-open" onClose={() => setDlg(null)} onSend={async (t) => { await api.updateSupport(dlg.id, 'reopen', t); setDlg(null); toast('Request re-opened. The researcher has been notified.', 'ok'); q.reload(); }} /> : null}
      {dlg && dlg.k === 'rate' ? <RateDialog id={dlg.id} onClose={() => setDlg(null)} onDone={q.reload} /> : null}
    </div>
  );
}
