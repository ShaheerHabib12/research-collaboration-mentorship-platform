import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { Btn, Empty, PageHead, Segmented, Skeleton, SwitchRow } from '../components/ui.jsx';
import { fail, toast } from '../components/toast.jsx';
import { api, timeAgo, toRoute } from '../lib/api.js';
import { useAction, useLoad } from '../hooks/useLoad.js';

const ICON = { requests: 'users', projects: 'folder', mentorship: 'graduation-cap', support: 'life-buoy', billing: 'credit-card', admin: 'shield-check', account: 'user' };
const CATS = [['requests', 'Collaboration requests', 'Interest and invitations'], ['projects', 'Project updates', 'Agreements, tasks, members'], ['mentorship', 'Mentorship', 'Requests and responses'], ['support', 'Researcher support', 'Matching and completion']];

export default function Notifications() {
  const list = useLoad(() => api.listNotifications(), []), prefsQ = useLoad(() => api.getPrefs(), []);
  const [filter, setFilter] = useState('all'), [cats, setCats] = useState({}), [pause, setPause] = useState({ v: '', touched: false }), [busy, run] = useAction();
  useEffect(() => { document.title = 'Notifications - RCMP'; }, []);
  useEffect(() => { if (prefsQ.data) setCats(Object.fromEntries(CATS.map(([c]) => [c, prefsQ.data.categories[c] !== false]))); }, [prefsQ.data]);
  const items = list.data || [], unread = items.filter((n) => !n.read).length, shown = items.filter((n) => filter === 'all' || !n.read);
  const prefs = prefsQ.data, paused = prefs && prefs.pausedUntil && new Date(prefs.pausedUntil) > new Date();

  async function readAll() { try { await api.markRead('all'); list.setData((d) => d.map((n) => ({ ...n, read: true }))); toast('All notifications marked as read.', 'ok'); } catch (e) { fail(e); } }
  function save(e) {
    e.preventDefault();
    run(async () => {
      try {
        const h = Number(pause.v), p = await api.setPrefs({ categories: cats, pausedUntil: pause.touched ? (h ? new Date(Date.now() + h * 3600000).toISOString() : null) : prefs.pausedUntil });
        prefsQ.setData(p); setPause({ v: '', touched: false }); toast('Notification preferences saved.', 'ok', 'Saved');
      } catch (x) { fail(x); }
    });
  }
  return (
    <div className="content">
      <PageHead eyebrow="Inbox" title="Notifications" sub="Status changes for requests, invitations, agreements and billing. Notifications never reveal confidential details to anyone but you.">
        <button className="btn" id="readAll" type="button" onClick={readAll}><Icon name="check" /> Mark all as read</button>
      </PageHead>
      <div className="grid split">
        <section className="card">
          <div className="card-head"><Segmented id="seg" label="Filter" value={filter} onChange={setFilter} options={[['all', 'All'], ['unread', 'Unread']]} /><span className="small muted" id="cnt" role="status">{unread} unread</span></div>
          <div className="card-body" id="list">
            {list.loading && !list.data ? <Skeleton n={1} h={90} /> : shown.length ? shown.map((n) => (
              <div key={n.id} className={'item ' + (n.read ? '' : 'unread')}>
                <span className="avatar sm" style={{ background: n.read ? '#94a3b8' : 'var(--primary)' }}><Icon name={ICON[n.category] || 'bell'} size="sm" /></span>
                <div className="body"><Link className="title" to={toRoute(n.href)} data-id={n.id} onClick={() => api.markRead(n.id)}>{n.title}</Link><div className="small muted">{n.body}</div></div>
                <div className="right"><div className="xs muted">{timeAgo(n.ts)}</div>{n.essential ? <span className="xs muted">Essential</span> : null}</div>
              </div>
            )) : <Empty icon="bell" title={filter === 'unread' ? 'No unread notifications' : 'No notifications yet'} text="You will be notified when requests, invitations or agreements change." />}
          </div>
        </section>
        <aside className="stack lg"><section className="card">
          <div className="card-head"><h3><Icon name="sliders" /> Preferences</h3></div>
          <form className="card-body stack" id="prefs" noValidate onSubmit={save}>
            <p className="small muted">Essential notifications (security, billing, request outcomes you are directly part of, admin tasks) cannot be switched off.</p>
            {CATS.map(([c, t, h]) => <SwitchRow key={c} title={t} hint={h} data-c={c} checked={cats[c] !== false} onChange={(v) => setCats({ ...cats, [c]: v })} />)}
            <hr className="hr" />
            <div className="field"><label htmlFor="pause">Pause non-essential notifications</label>
              <select className="select" id="pause" value={pause.v} onChange={(e) => setPause({ v: e.target.value, touched: true })}>
                <option value="">Not paused</option><option value="1">For 1 hour</option><option value="8">For 8 hours</option><option value="24">For 24 hours</option><option value="168">For 7 days</option>
              </select>
              <span className="hint" id="pauseNote">{paused ? 'Paused until ' + new Date(prefs.pausedUntil).toLocaleString('en-GB') + '. Essential notifications still arrive.' : ''}</span></div>
            <Btn className="btn primary" type="submit" busy={busy} busyText="Saving..." disabled={!prefs}>Save preferences</Btn>
          </form></section></aside>
      </div>
    </div>
  );
}
