import { useEffect, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { confirmDialog } from '../components/Modal.jsx';
import { Avatar, Badge, Empty, PageHead, Skeleton, Tabs } from '../components/ui.jsx';
import { fail, toast } from '../components/toast.jsx';
import { useLoad } from '../hooks/useLoad.js';
import { api, timeAgo } from '../lib/api.js';

const DESIG = ['', 'Methodologist', 'Statistician', 'Reviewer', 'Writing coach'];
const TOPIC = { general: 'General', account: 'Account', subscription: 'Subscription', mentorship: 'Mentorship', bug: 'Problem', partnership: 'Partnership' };

export default function Admin() {
  const [tab, setTab] = useState('researchers'), rs = useLoad(() => api.listResearchers(), []), rp = useLoad(() => api.listReports(), []), ms = useLoad(() => api.listContact(), []), au = useLoad(() => api.listAudit(), []);
  useEffect(() => { document.title = 'Admin console - RCMP'; }, []);
  const patch = async (id, p, msg) => { try { await api.updateResearcher(id, p); toast(msg, 'ok'); } catch (e) { fail(e); } rs.reload(); au.reload(); };
  const report = async (r, a) => {
    if (a === 'suspend' && !(await confirmDialog({ title: 'Suspend this account?', message: 'The user is signed out and cannot sign in until reinstated.', confirm: 'Suspend', danger: true }))) return;
    try { await api.actOnReport(r.id, a); toast('Report ' + a + ' recorded.', 'ok'); } catch (e) { fail(e); } rp.reload(); au.reload();
  };
  const message = async (m, s) => { try { await api.setContactStatus(m.id, s); toast('Message marked ' + s + '.', 'ok'); } catch (e) { fail(e); } ms.reload(); au.reload(); };
  const c1 = (rs.data || []).filter((r) => !r.researcher.approved).length, c2 = (rp.data || []).filter((r) => r.status === 'open').length, c3 = (ms.data || []).filter((m) => m.status === 'new').length;
  return (
    <div className="content">
      <PageHead eyebrow="Administration" title="Admin console" sub="Approve researchers, handle user reports and review the audit trail of sensitive actions." />
      <Tabs label="Admin sections" value={tab} onChange={setTab} tabs={[
        { id: 'researchers', label: <>Researchers <span className="count" id="c1">{c1}</span></> }, { id: 'reports', label: <>Reports <span className="count" id="c2">{c2}</span></> },
        { id: 'messages', label: <>Messages <span className="count" id="c3">{c3}</span></> }, { id: 'audit', label: 'Audit trail' }]} />
      {tab === 'researchers' ? <div id="panel-researchers">{!rs.data ? <Skeleton n={2} h={80} /> : (
        <><div className="table-wrap" tabIndex={0}><table className="table" aria-label="Researchers"><thead><tr><th>Researcher</th><th>Status</th><th>Designation</th><th>Expertise</th><th className="r">Open requests</th><th>Active</th><th><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>{rs.data.map((r) => (
            <tr key={r.id}><td><div className="row nowrap"><Avatar user={r} cls="sm" /><div><b>{r.name}</b><div className="xs muted">{r.institution}</div></div></div></td>
              <td><Badge status={r.researcher.approved ? 'approved' : 'pending'} label={r.researcher.approved ? 'Approved' : 'Awaiting approval'} /></td>
              <td><select className="select vis-select" data-des={r.id} aria-label={'Designation for ' + r.name} value={r.researcher.designation || ''} onChange={(e) => patch(r.id, { designation: e.target.value }, 'Designation updated and logged.')}>{DESIG.map((d) => <option key={d} value={d}>{d || 'None'}</option>)}</select></td>
              <td><div className="tags">{r.researcher.expertise.map((e) => <span className="chip plain" key={e}>{e}</span>)}</div></td><td className="r mono">{r.open}</td>
              <td><label className="switch"><input type="checkbox" data-act={r.id} checked={!!r.researcher.active} aria-label={'Active: ' + r.name} onChange={(e) => patch(r.id, { active: e.target.checked }, e.target.checked ? 'Marked active.' : 'Marked inactive - bonus will not apply.')} /><span /></label></td>
              <td className="r">{r.researcher.approved ? null : <button className="btn primary sm" type="button" data-ok={r.id} onClick={() => patch(r.id, { approved: true }, 'Researcher approved and notified.')}>Approve</button>}</td></tr>))}</tbody></table></div>
          <p className="hint" style={{ marginTop: 12 }}>Only approved, active researchers with matching expertise receive student support requests (FR-050). Researchers are never paid directly by students.</p></>)}</div> : null}
      {tab === 'reports' ? <div id="panel-reports">{!rp.data ? <Skeleton n={2} h={80} /> : rp.data.length ? <div className="stack">{rp.data.map((r) => (
        <article className="card" key={r.id}><div className="card-body"><div className="row between nowrap" style={{ alignItems: 'flex-start' }}><div className="stack sm">
          <div className="row"><b>{r.reason}</b><span className="badge nodot">{r.targetType}</span></div><div>{r.targetName}</div>
          {r.details ? <blockquote style={{ margin: 0, padding: '8px 12px', background: 'var(--bg)', borderLeft: '3px solid var(--border-strong)', borderRadius: 4, color: 'var(--text-2)' }}>{r.details}</blockquote> : null}
          <div className="small muted">Reported by {r.reporter.name} · {timeAgo(r.createdAt)} · <span className="mono">{r.id}</span>{r.outcome ? ' · Outcome: ' + r.outcome : ''}</div></div><Badge status={r.status} /></div></div>
          {r.status === 'open' ? <div className="card-foot"><span className="small muted">Actions are recorded in the audit trail.</span><div className="row"><button className="btn sm" type="button" data-r="dismiss" onClick={() => report(r, 'dismiss')}>Dismiss</button><button className="btn sm" type="button" data-r="warn" onClick={() => report(r, 'warn')}>Warn</button><button className="btn sm danger" type="button" data-r="suspend" onClick={() => report(r, 'suspend')}>Suspend account</button></div></div> : null}</article>))}</div>
        : <Empty icon="flag" title="No reports" text="User reports appear here for review." />}</div> : null}
      {tab === 'messages' ? <div id="panel-messages">{!ms.data ? <Skeleton n={2} h={80} /> : ms.data.length ? <div className="stack">{ms.data.map((m) => (
        <article className="card" key={m.id}><div className="card-body"><div className="row between nowrap" style={{ alignItems: 'flex-start' }}><div className="stack sm">
          <div className="row"><b>{m.subject}</b><span className="badge nodot">{TOPIC[m.topic] || m.topic}</span><span className={'badge ' + (m.status === 'new' ? 'warn' : m.status === 'answered' ? 'ok' : 'info')}>{m.status}</span></div>
          <div className="small muted">{m.name} &middot; <a href={'mailto:' + m.email}>{m.email}</a> &middot; {new Date(m.createdAt).toLocaleString()} &middot; <span className="mono">{m.id}</span></div>
          <p style={{ whiteSpace: 'pre-wrap', margin: '6px 0 0' }}>{m.message}</p></div>
          <div className="row">{m.status !== 'read' ? <button className="btn sm" type="button" data-m="read" onClick={() => message(m, 'read')}>Mark read</button> : null}{m.status !== 'answered' ? <button className="btn primary sm" type="button" data-m="answered" onClick={() => message(m, 'answered')}>Mark answered</button> : null}</div></div></div></article>))}</div>
        : <div className="empty"><h3>No messages yet</h3><p>Messages sent from the Contact page appear here.</p></div>}</div> : null}
      {tab === 'audit' ? <div id="panel-audit">{!au.data ? <Skeleton n={2} h={80} /> : au.data.length ? (
        <div className="table-wrap" tabIndex={0}><table className="table" aria-label="Audit trail"><thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Target</th></tr></thead><tbody>{au.data.map((a, i) => <tr key={i}><td className="mono" style={{ whiteSpace: 'nowrap' }}>{new Date(a.ts).toLocaleString('en-GB')}</td><td>{a.actorName}</td><td>{a.action}</td><td className="mono">{a.target}</td></tr>)}</tbody></table></div>
      ) : <Empty icon="history" title="No audit entries yet" />}</div> : null}
    </div>
  );
}
