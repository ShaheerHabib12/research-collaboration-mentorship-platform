import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { Modal } from '../components/Modal.jsx';
import ProjectTabs from '../components/ProjectTabs.jsx';
import { Avatar, Badge, Btn, Empty, Field, LockView, Skeleton } from '../components/ui.jsx';
import { fail, toast } from '../components/toast.jsx';
import { useSession } from '../hooks/useSession.js';
import { useAction, useQuery } from '../hooks/useLoad.js';
import { api, fmtDate, timeAgo } from '../lib/api.js';

const clone = (x) => JSON.parse(JSON.stringify(x));

function ProposeDialog({ id, onClose, onDone }) {
  const [section, setSection] = useState('Roles'), [text, setText] = useState(''), [err, setErr] = useState(''), [busy, run] = useAction();
  const go = () => run(async () => { try { await api.proposeRevision(id, section, text); onClose(); toast('Proposal sent to the owner.', 'ok'); onDone(); } catch (e) { if (e.fields) setErr(e.fields.proposal || Object.values(e.fields)[0]); else fail(e); } });
  return (
    <Modal title="Propose a change" onClose={onClose} footer={<><button className="btn" type="button" data-close onClick={onClose}>Cancel</button><Btn className="btn primary" id="go" busy={busy} busyText="Sending..." onClick={go}>Send proposal</Btn></>}>
      <form className="stack" noValidate onSubmit={(e) => { e.preventDefault(); go(); }}>
        <p className="muted">Members cannot edit the published agreement. Your proposal goes to the owner, who can accept it into the next version.</p>
        <div className="field"><label htmlFor="ps">Section</label><select className="select" id="ps" value={section} onChange={(e) => setSection(e.target.value)}><option>Roles</option><option>Contributions</option><option>Deadlines</option><option>Communication</option><option>Authorship</option></select></div>
        <Field name="proposal" label="Your proposal" htmlFor="pt" error={err}><textarea className="textarea" id="pt" maxLength={520} value={text} aria-invalid={err ? 'true' : undefined} onChange={(e) => { setText(e.target.value); setErr(''); }} /></Field>
      </form>
    </Modal>
  );
}

export default function Agreement() {
  const params = useQuery(), me = useSession();
  const [id, setId] = useState(params.id || null), [ag, setAg] = useState(null), [draft, setDraft] = useState(null), [err, setErr] = useState(null), [errors, setErrors] = useState({}), [dlg, setDlg] = useState(false), [busy, run] = useAction();
  useEffect(() => { document.title = 'Team agreement - RCMP'; if (!id) api.myProjects().then((m) => setId(m[0] ? m[0].id : 'none')).catch(fail); }, []); // eslint-disable-line
  async function load(keepDraft) {
    try { const a = await api.getAgreement(id); setAg(a); if (!keepDraft) setDraft(a.isOwner && a.draft ? clone(a.draft) : null); return a; }
    catch (e) { if (e.status === 401 || e.status === 0) fail(e); setErr(e); return null; }
  }
  useEffect(() => { if (id && id !== 'none') load(); }, [id]); // eslint-disable-line

  if (id === 'none' || (!id && false)) return <div className="content"><LockView code="404" title="No project selected" text="Open the agreement from a project." /></div>;
  if (err) return <div className="content"><LockView code={err.status || 'Error'} title={err.status === 403 ? 'Agreement is for members only' : 'Could not load the agreement'} text={err.message} /></div>;
  if (!ag) return <div className="content"><Skeleton n={1} h={160} /></div>;
  const memberName = (uid) => { const m = ag.members.find((x) => x.id === uid); return m ? m.name : 'Former member'; };
  const mine = ag.acks[me.id], acked = mine === ag.version, pub = ag.published, ackedCount = ag.members.filter((m) => ag.acks[m.id] === ag.version).length;
  const props = [...ag.proposals.filter((p) => p.status === 'open'), ...ag.proposals.filter((p) => p.status !== 'open')];

  async function save(publish) {
    setErrors({});
    run(async () => {
      try {
        const a = { exists: true, ...(await api.saveAgreement(id, draft, ag.version, publish)) }; setAg((x) => ({ ...x, ...a })); setDraft(clone(a.draft));
        toast(publish ? 'Version ' + a.version + ' published. Members were notified to acknowledge it.' : 'Draft saved.', 'ok', publish ? 'Published' : 'Saved'); await load(true); setDraft(clone(a.draft));
      } catch (e) {
        if (e.fields) setErrors(e.fields);
        if (e.status === 409) { // stale owner edit: keep the text on screen, refresh the version underneath
          const typed = clone(draft); await load(true); setDraft(typed); setAg((x) => ({ ...x, version: e.currentVersion })); fail(e); toast('Your edits are still on screen. Review v' + e.currentVersion + ' above, then publish again.', 'info'); return;
        }
        fail(e);
      }
    });
  }
  const setRole = (i, k, v) => setDraft({ ...draft, roles: draft.roles.map((r, j) => (j === i ? { ...r, [k]: v } : r)) });
  const setDl = (i, k, v) => setDraft({ ...draft, deadlines: draft.deadlines.map((d, j) => (j === i ? { ...d, [k]: v } : d)) });
  const H4 = ({ children }) => <h4>{children}</h4>;

  return (
    <div className="content">
      <div className="crumbs"><Link to="/projects">My projects</Link><Icon name="chevron-right" size="sm" /><Link to={'/project?id=' + id}>{id}</Link><Icon name="chevron-right" size="sm" /><span>Team agreement</span></div>
      <div className="page-head"><div><div className="eyebrow">Team agreement{ag.version ? <span className="badge published">Version {ag.version}</span> : <span className="badge">Draft - not published</span>}</div><h1>Team agreement</h1><p>{ag.projectTitle}</p></div><div className="actions" id="actions" /></div>
      <ProjectTabs id={id} current="agreement" />
      <div className="notice warn mb"><Icon name="scale" /><div><strong>Expectations, not rules.</strong> This agreement records what the team expects of each other. It does not replace institutional rules, research governance, ethics approval or authorship policies (FR-026).</div></div>
      {!ag.exists ? <Empty icon="clipboard-check" title="No agreement published yet" text={ag.owner.name + ' has not created the team agreement. You will be notified when it is ready to review.'} /> : (
        <div className="grid split"><div className="stack lg">
          {ag.isOwner && draft ? (
            <section className="card"><div className="card-head"><h3><Icon name="pencil" /> {ag.version ? 'Edit draft for v' + (ag.version + 1) : 'Draft the agreement'}</h3><span className="small muted">Only you (the owner) can edit and publish</span></div>
              <form id="ef" className="card-body stack lg" noValidate onSubmit={(e) => e.preventDefault()}>
                <div><H4>Roles and responsibilities</H4><div className="stack sm" style={{ marginTop: 8 }}>{draft.roles.map((r, i) => (
                  <div className="grid g2" key={r.userId} style={{ gap: 8, gridTemplateColumns: '180px 1fr 2fr' }}><div className="row nowrap"><span><Avatar user={ag.members.find((m) => m.id === r.userId)} cls="sm" /></span><b className="small">{memberName(r.userId)}</b></div>
                    <input className="input" value={r.role} aria-label={'Role for ' + memberName(r.userId)} maxLength={60} onChange={(e) => setRole(i, 'role', e.target.value)} />
                    <input className="input" value={r.responsibilities} aria-label={'Responsibilities for ' + memberName(r.userId)} maxLength={200} placeholder="Responsibilities" onChange={(e) => setRole(i, 'responsibilities', e.target.value)} /></div>
                ))}</div></div>
                <Field name="contributions" label="Expected contributions" htmlFor="ec" error={errors.contributions}><textarea className="textarea" id="ec" maxLength={600} value={draft.contributions} onChange={(e) => setDraft({ ...draft, contributions: e.target.value })} /></Field>
                <Field name="deadlines" label="Deadlines" htmlFor="dl" error={errors.deadlines}>
                  <div className="stack sm" id="dl">{draft.deadlines.map((d, i) => (
                    <div className="row nowrap" key={i}><input className="input" value={d.label} aria-label={'Deadline ' + (i + 1) + ' label'} maxLength={60} onChange={(e) => setDl(i, 'label', e.target.value)} />
                      <input className="input" type="date" value={d.date} aria-label={'Deadline ' + (i + 1) + ' date'} style={{ maxWidth: 170 }} onChange={(e) => setDl(i, 'date', e.target.value)} />
                      <button type="button" className="btn ghost sm icon-only" aria-label={'Remove deadline ' + (i + 1)} onClick={() => setDraft({ ...draft, deadlines: draft.deadlines.filter((_, j) => j !== i) })}><Icon name="x" size="sm" /></button></div>))}</div>
                  <div><button type="button" className="btn sm" id="adddl" onClick={() => setDraft({ ...draft, deadlines: [...draft.deadlines, { label: '', date: '' }] })}><Icon name="plus" size="sm" /> Add deadline</button></div></Field>
                <Field name="communication" label="Communication" htmlFor="ecm" error={errors.communication}><textarea className="textarea" id="ecm" maxLength={400} style={{ minHeight: 72 }} value={draft.communication} onChange={(e) => setDraft({ ...draft, communication: e.target.value })} /></Field>
                <Field name="authorship" label="Authorship" htmlFor="eau" error={errors.authorship}><textarea className="textarea" id="eau" maxLength={500} style={{ minHeight: 72 }} value={draft.authorship} onChange={(e) => setDraft({ ...draft, authorship: e.target.value })} /></Field>
                <div className="row" style={{ justifyContent: 'flex-end' }}><Btn className="btn" type="button" id="saveDraft" busy={busy} busyText="Saving..." onClick={() => save(false)}>Save draft</Btn><Btn className="btn primary" type="button" id="publish" busy={busy} busyText="Publishing..." onClick={() => save(true)}><Icon name="send" /> Publish v{ag.version + 1}</Btn></div>
              </form></section>
          ) : null}
          {pub ? (
            <section className="card"><div className="card-head"><h3><Icon name="check-circle" /> Published agreement · v{ag.version}</h3><span className="small muted">{timeAgo(ag.publishedAt)} by {memberName(ag.publishedBy)}</span></div>
              <div className="card-body stack lg">
                <div><H4>Roles and responsibilities</H4><div className="table-wrap" tabIndex={0} style={{ marginTop: 8 }}><table className="table"><thead><tr><th>Member</th><th>Role</th><th>Responsibilities</th></tr></thead><tbody>{pub.roles.map((r) => <tr key={r.userId}><td><b>{memberName(r.userId)}</b></td><td>{r.role}</td><td>{r.responsibilities || '-'}</td></tr>)}</tbody></table></div></div>
                <div><H4>Expected contributions</H4><p style={{ color: 'var(--text-2)', marginTop: 4 }}>{pub.contributions}</p></div>
                <div><H4>Deadlines</H4><ul className="timeline" style={{ marginTop: 8 }}>{pub.deadlines.map((d, i) => <li key={i}><b>{d.label}</b><time>{fmtDate(d.date)}</time></li>)}</ul></div>
                <div><H4>Communication</H4><p style={{ color: 'var(--text-2)', marginTop: 4 }}>{pub.communication}</p></div>
                <div><H4>Authorship</H4><p style={{ color: 'var(--text-2)', marginTop: 4 }}>{pub.authorship}</p></div>
              </div></section>
          ) : <div className="notice"><Icon name="info" /><span>{ag.isOwner ? 'Draft the agreement below, then publish version 1 so members can acknowledge it.' : 'Nothing has been published yet.'}</span></div>}
          <section className="card"><div className="card-head"><h3><Icon name="message" /> Revision proposals</h3>{ag.published && !ag.isOwner ? <button className="btn sm" id="propose" type="button" onClick={() => setDlg(true)}><Icon name="plus" size="sm" /> Propose a change</button> : null}</div>
            <div className="card-body">{props.length ? props.map((p) => (
              <div className="item" key={p.id}><span><Avatar user={p.user} cls="sm" /></span><div className="body"><div className="row"><b>{p.user.name}</b><span className="badge nodot">{p.section}</span><Badge status={p.status === 'open' ? 'pending' : p.status === 'accepted' ? 'accepted' : 'declined'} label={p.status === 'open' ? 'Open' : p.status[0].toUpperCase() + p.status.slice(1)} /></div><p className="small" style={{ marginTop: 4, color: 'var(--text-2)' }}>{p.text}</p><div className="xs muted">{timeAgo(p.createdAt)} · against v{p.version}</div></div>
                {ag.isOwner && p.status === 'open' ? <div className="row">{['declined', 'accepted'].map((d) => <button key={d} className={'btn sm' + (d === 'accepted' ? ' primary' : '')} data-res={d} type="button" onClick={async () => { try { await api.resolveProposal(id, p.id, d); toast('Proposal ' + d + '.', 'ok'); } catch (e) { fail(e); } load(true); }}>{d === 'accepted' ? 'Accept' : 'Decline'}</button>)}</div> : null}</div>
            )) : <p className="muted small">{ag.isOwner ? 'Members can propose changes after you publish. Members never edit the published text directly.' : 'No proposals yet. Use "Propose a change" to suggest a revision to the owner.'}</p>}</div></section>
        </div>
        <aside className="stack lg">
          <section className="card"><div className="card-head"><h3><Icon name="users" /> Acknowledgements</h3>{pub ? <span className="small muted">{ackedCount} of {ag.members.length}</span> : null}</div>
            <div className="card-body">{pub ? ag.members.map((m) => { const a = ag.acks[m.id]; return (
              <div className="item" key={m.id}><span><Avatar user={m} cls="sm" /></span><div className="body"><b>{m.name}</b><div className="xs muted">{a ? 'Acknowledged v' + a : 'Not yet'}</div></div>{a === ag.version ? <Badge status="accepted" label="Acknowledged" /> : a ? <span className="badge pending">Old v{a}</span> : <Badge status="pending" label="Waiting" />}</div>); }) : <p className="muted small">Acknowledgements start once a version is published.</p>}
              {pub && !acked ? <Btn className="btn primary block" id="ack" busy={busy} style={{ marginTop: 16 }} onClick={() => run(async () => { try { await api.acknowledgeAgreement(id, ag.version); toast('Acknowledged. The owner has been notified.', 'ok'); await load(); } catch (e) { fail(e); if (e.status === 409) load(); } })}><Icon name="check" /> I have read and acknowledge v{ag.version}</Btn> : null}
              {pub && acked ? <div className="notice ok" style={{ marginTop: 16 }}><Icon name="check-circle" /><span>You acknowledged this version.</span></div> : null}</div></section>
          <section className="card"><div className="card-head"><h3><Icon name="history" /> Version history</h3></div>
            <div className="card-body">{ag.history.length ? <ul className="timeline">{ag.history.slice().reverse().map((h) => <li className="done" key={h.version}><b>v{h.version}</b> · {h.summary}<time>{new Date(h.ts).toLocaleString('en-GB')}</time></li>)}</ul> : <p className="muted small">No versions yet.</p>}</div></section>
        </aside></div>
      )}
      {dlg ? <ProposeDialog id={id} onClose={() => setDlg(false)} onDone={load} /> : null}
    </div>
  );
}
