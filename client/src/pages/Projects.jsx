import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { AvatarStack, Badge, Empty, PageHead, Skeleton, Tabs } from '../components/ui.jsx';
import { useLoad } from '../hooks/useLoad.js';
import { api } from '../lib/api.js';
import { C } from '../lib/shared.js';

export default function Projects() {
  const q = useLoad(() => api.myProjects(), []), [tab, setTab] = useState('all');
  useEffect(() => { document.title = 'My projects - RCMP'; }, []);
  const all = q.data || [], owned = all.filter((p) => p.isOwner).length;
  const list = all.filter((p) => tab === 'all' || (tab === 'owned' ? p.isOwner : !p.isOwner));
  return (
    <div className="content">
      <PageHead eyebrow="Projects" title="My projects" sub="Projects you own or have joined. Open a workspace, edit a brief, or publish a new one.">
        <Link className="btn primary" to="/project-new"><Icon name="folder-plus" /> New project brief</Link>
      </PageHead>
      <Tabs label="Project filter" value={tab} onChange={setTab} tabs={[
        { id: 'all', label: <>All <span className="count" id="c-all">{all.length}</span></> },
        { id: 'owned', label: <>Owned by me <span className="count" id="c-owned">{owned}</span></> },
        { id: 'member', label: <>Joined <span className="count" id="c-member">{all.length - owned}</span></> }]} />
      {q.loading && !q.data ? <div id="list" className="grid g2"><Skeleton n={4} h={220} /></div>
        : !list.length ? <div id="list"><Empty icon="folder-plus" title={tab === 'member' ? 'You have not joined any projects' : 'Nothing here yet'} text="Publish a brief to recruit collaborators, or find a project that needs your skills."><div className="row" style={{ justifyContent: 'center' }}><Link className="btn primary" to="/project-new">New brief</Link><Link className="btn" to="/discover">Discover</Link></div></Empty></div>
          : <div id="list" className="grid g2">{list.map((p) => {
            const stage = (C.STAGES.find((s) => s.id === p.stage) || {}).label, pct = p.taskCount ? Math.round(p.doneCount / p.taskCount * 100) : 0;
            return (
              <article className="card proj-card" key={p.id}>
                <div className="row between"><div className="row"><Badge status={p.status} /><span className="badge nodot">{stage}</span></div><span className="mono muted">{p.id}</span></div>
                <h3><Link to={'/project?id=' + p.id}>{p.title}</Link></h3>
                <p className="desc">{p.question || 'No research question yet - finish your draft to publish.'}</p>
                <div><div className="row between small"><span className="muted">{p.doneCount} of {p.taskCount} tasks done</span><b className="num">{pct}%</b></div><div className="progress teal" style={{ marginTop: 6 }}><i style={{ width: pct + '%' }} /></div></div>
                <div className="row between"><div className="row nowrap"><AvatarStack list={p.memberProfiles} /><span className="small muted">{p.isOwner ? 'Owner' : 'Member'}</span></div>
                  <div className="row"><Link className="btn sm" to={'/project?id=' + p.id}>Overview</Link><Link className="btn primary sm" to={'/workspace?id=' + p.id}>Workspace</Link></div></div>
              </article>
            );
          })}</div>}
    </div>
  );
}
