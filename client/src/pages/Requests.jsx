import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { Avatar, Badge, Btn, Empty, PageHead, Segmented, Skeleton, Tabs } from '../components/ui.jsx';
import { fail, toast } from '../components/toast.jsx';
import { api, refreshCounts, timeAgo } from '../lib/api.js';
import { useAction, useLoad } from '../hooks/useLoad.js';

const STAT = ['all', 'pending', 'accepted', 'declined', 'withdrawn'];

function ActButton({ r, act, className, children, reload }) {
  const [busy, run] = useAction();
  return <Btn className={className} busy={busy} data-act={act} data-id={r.id} onClick={() => run(async () => { try { await api.actOnRequest(r.id, act); toast('Request ' + act + '. The other person has been notified.', 'ok', 'Done'); } catch (e) { fail(e); } await reload(); refreshCounts(); })}>{children}</Btn>;
}

export default function Requests() {
  const q = useLoad(() => api.listRequests(), []), [tab, setTab] = useState('received'), [status, setStatus] = useState('all');
  useEffect(() => { document.title = 'Requests - RCMP'; }, []);
  const data = q.data;
  const list = data ? data[tab].filter((r) => status === 'all' || r.status === status) : [];
  return (
    <div className="content">
      <PageHead eyebrow="Requests" title="Collaboration requests" sub="Interest you sent, invitations you received, and requests for your projects. Every request shows one clear status." />
      <div className="notice mb"><Icon name="info" /><span><b>One final answer.</b> If two people respond to the same request at once, only the first response is kept; the other gets a conflict message (HTTP 409). Try it with <i>Demo tools → Lose the next race</i>.</span></div>
      <Tabs label="Request direction" value={tab} onChange={setTab} tabs={[
        { id: 'received', label: <>Received <span className="count" id="cr">{data ? data.received.filter((r) => r.status === 'pending').length : 0}</span></> },
        { id: 'sent', label: <>Sent <span className="count" id="cs">{data ? data.sent.length : 0}</span></> }]} />
      <div className="row mb"><Segmented id="seg" label="Filter by status" value={status} onChange={setStatus} options={STAT.map((s) => [s, s[0].toUpperCase() + s.slice(1)])} /></div>
      <div id="list" className="stack">
        {q.loading && !data ? <Skeleton n={3} h={120} /> : q.error ? <Empty icon="alert-circle" title="Could not load requests" text={q.error.message} />
          : !list.length ? <Empty icon="inbox" title={'No ' + (status === 'all' ? '' : status + ' ') + tab + ' requests'} text={tab === 'sent' ? 'Find a project to join from Discover.' : 'When someone is interested in your project or invites you, it appears here.'}>{tab === 'sent' ? <Link className="btn primary" to="/discover">Discover projects</Link> : null}</Empty>
            : list.map((r) => {
              const other = tab === 'received' ? r.fromUser : r.toUser, pend = r.status === 'pending';
              const verb = r.type === 'invitation' ? (tab === 'received' ? 'invited you to join' : 'You invited ' + other.name + ' to') : (tab === 'received' ? 'is interested in' : 'You expressed interest in');
              return (
                <article className="card" key={r.id}>
                  <div className="card-body"><div className="row nowrap" style={{ alignItems: 'flex-start' }}><Avatar user={other} cls="lg" /><div className="grow stack sm">
                    <div className="row between nowrap"><div><b>{tab === 'received' ? other.name : ''}</b> {verb} <Link to={'/project?id=' + r.projectId}><b>{r.projectTitle}</b></Link></div><Badge status={r.status} /></div>
                    <div className="small muted">{r.type === 'invitation' ? 'Invitation' : 'Interest'} · {timeAgo(r.createdAt)} · <span className="mono">{r.id}</span></div>
                    <blockquote style={{ margin: '4px 0', padding: '10px 14px', background: 'var(--bg)', borderLeft: '3px solid var(--border-strong)', borderRadius: 4, color: 'var(--text-2)' }}>{r.message}</blockquote>
                    {r.history.length > 1 ? <details><summary className="small muted" style={{ cursor: 'pointer' }}>Status history</summary><ul className="timeline" style={{ marginTop: 10 }}>{r.history.map((h, i) => <li key={i} className={h.status !== 'pending' ? 'done' : ''}><Badge status={h.status} /><time>{new Date(h.ts).toLocaleString('en-GB')}</time></li>)}</ul></details> : null}
                  </div></div></div>
                  {pend ? <div className="card-foot"><span className="small muted">{tab === 'received' ? 'Accepting adds ' + other.name + ' to the project team.' : 'You can withdraw while it is pending.'}</span>
                    <div className="row">{tab === 'received' ? <><ActButton r={r} act="declined" className="btn sm danger" reload={q.reload}>Decline</ActButton><ActButton r={r} act="accepted" className="btn sm primary" reload={q.reload}><Icon name="check" size="sm" /> Accept</ActButton></> : <ActButton r={r} act="withdrawn" className="btn sm" reload={q.reload}>Withdraw</ActButton>}</div></div> : null}
                </article>
              );
            })}
      </div>
    </div>
  );
}
