import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { Modal, confirmDialog } from '../components/Modal.jsx';
import ProjectTabs from '../components/ProjectTabs.jsx';
import { Avatar, AvatarStack, Btn, ChipInput, Counter, Empty, Field, LockView, Skeleton, fileIcon, useForm } from '../components/ui.jsx';
import { fail, toast } from '../components/toast.jsx';
import { useAction, useQuery } from '../hooks/useLoad.js';
import { api, daysUntil, fmtDate, fmtSize, timeAgo } from '../lib/api.js';
import { V } from '../lib/shared.js';

const COLS = [{ id: 'todo', label: 'To do', color: '#94a3b8' }, { id: 'progress', label: 'In progress', color: '#2563eb' }, { id: 'review', label: 'Review', color: '#d97706' }, { id: 'done', label: 'Done', color: '#0d9488' }];

function TaskDialog({ id, task, status, members, onClose, onSaved }) {
  const f = useForm({ title: task ? task.title : '', description: task ? task.description : '', tags: task ? task.tags : [], due: task ? task.due : '', assignee: task ? task.assignee || '' : '' }), [busy, run] = useAction();
  const v = f.values;
  function save() {
    const d = { ...v, status: task ? task.status : status || 'todo' }, errs = {}, a = V.validateTaskTitle(d.title), b = V.validateTaskDescription(d.description), g = V.validateTags(d.tags);
    if (!a.ok) errs.title = a.error; if (!b.ok) errs.description = b.error; if (!g.ok) errs.tags = g.error;
    if (Object.keys(errs).length) return f.setErrors(errs);
    f.clear();
    run(async () => { try { await api.saveTask(id, d, task && task.id); onClose(); toast(task ? 'Task updated.' : 'Task created.', 'ok', 'Saved'); await onSaved(); } catch (e) { if (e.fields) f.setErrors(e.fields); else fail(e); } });
  }
  return (
    <Modal title={task ? 'Edit task ' + task.id : 'New task'} onClose={onClose}
      footer={<>{task ? <button className="btn danger" type="button" style={{ marginRight: 'auto' }} onClick={async () => { try { await api.deleteTask(id, task.id); onClose(); toast('Task deleted.', 'ok'); onSaved(); } catch (e) { fail(e); } }}>Delete</button> : null}
        <button className="btn" type="button" data-close onClick={onClose}>Cancel</button><Btn className="btn primary" id="sv" busy={busy} busyText="Saving..." onClick={save}>{task ? 'Save changes' : 'Create task'}</Btn></>}>
      <form id="tf" className="stack" noValidate ref={f.formRef} onSubmit={(e) => { e.preventDefault(); save(); }}>
        <Field name="title" htmlFor="tt" error={f.errors.title} label={<>Title <span className="req">*</span></>} labelExtra={<span className="counter" id="tc"><Counter value={v.title} min={3} max={20} /></span>} hint="Between 3 and 20 characters (FR-042)."><input className="input" maxLength={40} placeholder="3 to 20 characters" {...f.bind('title')} id="tt" /></Field>
        <Field name="description" htmlFor="td" error={f.errors.description} label="Description" labelExtra={<span className="counter" id="dc"><Counter value={v.description} min={0} max={250} /></span>}><textarea className="textarea" maxLength={300} style={{ minHeight: 80 }} placeholder="Optional - up to 250 characters" {...f.bind('description')} id="td" /></Field>
        <Field name="tags" htmlFor="tag-in" error={f.errors.tags} label={<>Tags <span className="muted" style={{ fontWeight: 400 }}>(optional, max 3)</span></>}><ChipInput id="tag-in" invalid={f.errors.tags} aria-label="Add a tag" value={v.tags} onChange={(x) => f.set('tags', x)} max={3} maxMessage="Maximum 3 topic tags reached" placeholder="Type a tag and press Enter" validate={(list) => V.validateTags(list)} /></Field>
        <div className="grid g2">
          <Field name="due" label="Due date"><input className="input" type="date" {...f.bind('due')} id="tdue" /></Field>
          <Field name="assignee" label="Assignee" error={f.errors.assignee}><select className="select" {...f.bind('assignee')} id="tas"><option value="">Unassigned</option>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></Field>
        </div>
      </form>
    </Modal>
  );
}

export default function Workspace() {
  const params = useQuery(), [id, setId] = useState(params.id || null), [ws, setWs] = useState(null), [err, setErr] = useState(null), [dlg, setDlg] = useState(null), [perm, setPerm] = useState('team');
  const [dragId, setDragId] = useState(null), [over, setOver] = useState(null), [dropOver, setDropOver] = useState(false), [landed, setLanded] = useState(null), [ms, setMs] = useState({ t: '', d: '' }), fileRef = useRef(null);
  useEffect(() => { document.title = 'Workspace - RCMP'; if (!id) api.myProjects().then((m) => setId(m[0] ? m[0].id : 'none')).catch(fail); }, []); // eslint-disable-line
  const load = async () => { try { setWs(await api.getWorkspace(id)); } catch (e) { if (e.status === 401 || e.status === 0) fail(e); setErr(e); } };
  useEffect(() => { if (id && id !== 'none') load(); }, [id]); // eslint-disable-line

  if (id === 'none') return <div className="content"><LockView code="404" title="No project selected" text="Open a workspace from My projects." /></div>;
  if (err) return <div className="content"><LockView code={err.status || 'Error'} title={err.status === 403 ? 'Workspace is for members only' : 'Could not open workspace'} text={err.message + (err.status === 403 ? ' No task, file or history data was returned.' : '')} /></div>;
  if (!ws) return <div className="content"><Skeleton n={1} h={160} /></div>;
  const p = ws.project, total = ws.tasks.length, done = ws.tasks.filter((t) => t.status === 'done').length, pct = total ? Math.round(done / total * 100) : 0, bytes = ws.files.reduce((a, x) => a + x.size, 0);

  async function move(taskId, status) {
    try { await api.moveTask(id, taskId, status); await load(); setLanded(taskId); setTimeout(() => setLanded(null), 900); toast('Task moved.', 'ok'); } catch (e) { fail(e); load(); }
  }
  /** Client-side size check gives instant feedback; the API repeats it (never trust the client). */
  async function upload(file) {
    const v = V.validateFile(file);
    if (!v.ok && v.status !== 413) { toast(v.error, 'bad', 'Cannot upload'); return; } // 413 is reported by the API call below
    try { await api.uploadFile(id, file, perm); toast(file.name + ' (' + fmtSize(file.size) + ') uploaded.', 'ok', 'Uploaded'); await load(); } catch (e) { fail(e); }
  }
  const members = p.memberProfiles;

  return (
    <div className="content">
      <div className="crumbs"><Link to="/projects">My projects</Link><Icon name="chevron-right" size="sm" /><Link to={'/project?id=' + p.id}>{p.id}</Link><Icon name="chevron-right" size="sm" /><span>Workspace</span></div>
      <div className="page-head"><div><div className="eyebrow">Workspace<span className="badge nodot"><Icon name="lock" size="sm" /> Private to members</span></div><h1>{p.title}</h1></div>
        <div className="actions"><Link className="btn" to={'/agreement?id=' + p.id}><Icon name="clipboard-check" /> Team agreement</Link><button className="btn primary" id="newTask" type="button" onClick={() => setDlg({ k: 'task' })}><Icon name="plus" /> New task</button></div></div>
      <ProjectTabs id={p.id} current="workspace" />
      <div className="grid g4 mb">
        <div className="card kpi"><div><div className="k">Tasks</div><div className="v num">{total}</div><div className="s">{done} done</div></div><div className="ic"><Icon name="check-square" /></div></div>
        <div className="card kpi teal"><div><div className="k">Progress</div><div className="v num">{pct}%</div><div className="s"><div className="progress teal" style={{ width: 120, marginTop: 4 }}><i style={{ width: pct + '%' }} /></div></div></div><div className="ic teal"><Icon name="activity" /></div></div>
        <div className="card kpi"><div><div className="k">Files</div><div className="v num">{ws.files.length}</div><div className="s">{fmtSize(bytes)} stored</div></div><div className="ic slate"><Icon name="folder" /></div></div>
        <div className="card kpi"><div><div className="k">Members</div><div className="v num">{members.length}</div><div className="s"><AvatarStack list={members} /></div></div><div className="ic amber"><Icon name="users" /></div></div>
      </div>

      <section aria-labelledby="bh"><div className="row between mb"><h2 id="bh" style={{ fontSize: '1.25rem' }}>Task board</h2></div>
        <div className="board" id="board">{COLS.map((c) => {
          const items = ws.tasks.filter((t) => t.status === c.id);
          return (
            <div key={c.id} className={'col' + (over === c.id ? ' over' : '')} data-col={c.id} role="group" aria-label={c.label + ' column'}
              onDragOver={(e) => { e.preventDefault(); setOver(c.id); }} onDragLeave={() => setOver(null)}
              onDrop={(e) => { e.preventDefault(); setOver(null); const t = ws.tasks.find((x) => x.id === dragId); if (t && t.status !== c.id) move(dragId, c.id); }}>
              <div className="col-head"><span><span className="dotc" style={{ background: c.color }} />{c.label}</span><span className="n">{items.length}</span></div>
              {items.map((t) => {
                const du = daysUntil(t.due), late = du !== null && du < 0 && t.status !== 'done';
                return (
                  <article key={t.id} className={'task' + (t.status === 'done' ? ' done' : '') + (dragId === t.id ? ' dragging' : '') + (landed === t.id ? ' landed' : '')} draggable data-id={t.id}
                    onDragStart={(e) => { setDragId(t.id); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', t.id); } catch (x) { /* ignore */ } }} onDragEnd={() => { setDragId(null); setOver(null); }}>
                    <div className="row between nowrap"><span className="tid">{t.id}</span></div><div className="tt">{t.title}</div>
                    {t.description ? <div className="td">{t.description}</div> : null}
                    {t.tags.length ? <div className="tags">{t.tags.map((g) => <span className="chip mono" key={g}>{g}</span>)}</div> : null}
                    <div className="foot"><span className={'due ' + (late ? 'late' : '')}><Icon name="calendar" size="sm" /> {t.due ? (late ? 'Overdue · ' : '') + fmtDate(t.due) : 'No date'}</span>{t.assigneeUser ? <Avatar user={t.assigneeUser} cls="sm" /> : null}</div>
                    <div className="row nowrap" style={{ gap: 6 }}>
                      <select className="select vis-select" data-move={t.id} aria-label={'Move ' + t.title} value="" onChange={(e) => { if (e.target.value) move(t.id, e.target.value); }}><option value="">Move to...</option>{COLS.filter((x) => x.id !== t.status).map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select>
                      <button className="btn ghost sm icon-only" type="button" data-edit={t.id} aria-label={'Edit ' + t.title} onClick={() => setDlg({ k: 'task', task: t })}><Icon name="pencil" size="sm" /></button></div>
                  </article>
                );
              })}
              {c.id === 'todo' ? <button className="btn ghost sm" type="button" data-add="todo" onClick={() => setDlg({ k: 'task', status: 'todo' })}><Icon name="plus" size="sm" /> Add task</button> : null}
            </div>
          );
        })}</div><p className="hint" style={{ marginTop: 8 }}>Drag cards between columns, or use the "Move" menu on each card for keyboard access.</p></section>

      <div className="grid split" style={{ marginTop: 32 }}>
        <section className="card" aria-labelledby="fh"><div className="card-head"><h3 id="fh"><Icon name="lock" /> Private files</h3><span className="badge nodot">Limit 10 MB</span></div>
          <div className="card-body stack">
            <div className={'dropzone' + (dropOver ? ' over' : '')} id="drop"
              onDragEnter={(e) => { e.preventDefault(); setDropOver(true); }} onDragOver={(e) => { e.preventDefault(); setDropOver(true); }} onDragLeave={(e) => { e.preventDefault(); setDropOver(false); }}
              onDrop={(e) => { e.preventDefault(); setDropOver(false); if (e.dataTransfer.files[0]) upload(e.dataTransfer.files[0]); }}>
              <div className="ic"><Icon name="upload" size="lg" /></div><b>Drag and drop a file, or choose one</b><p className="small muted" style={{ margin: '4px 0 12px' }}>PDF, DOCX, XLSX, CSV, images, ZIP and more · up to 10 MB each</p>
              <div className="row" style={{ justifyContent: 'center' }}><button className="btn primary" type="button" id="pick" onClick={() => fileRef.current.click()}>Choose file</button><button className="btn" type="button" id="big" title="Demo: simulate a 10.1 MB file" onClick={() => upload({ name: 'large_dataset.zip', size: Math.round(10.1 * 1024 * 1024) })}>Try a 10.1 MB file</button></div>
              <input type="file" id="file" hidden ref={fileRef} onChange={(e) => { if (e.target.files[0]) upload(e.target.files[0]); e.target.value = ''; }} />
            </div>
            <div className="field"><label htmlFor="perm">Who can open the next upload</label><select className="select" id="perm" style={{ maxWidth: 260 }} value={perm} onChange={(e) => setPerm(e.target.value)}><option value="team">All project members</option><option value="owner">Project owner only</option></select></div>
            {ws.files.length ? (
              <div className="table-wrap" tabIndex={0}><table className="table"><thead><tr><th>File</th><th className="r">Size</th><th>Access</th><th>Uploaded by</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{ws.files.map((x) => (
                <tr key={x.id}><td><div className="row nowrap"><Icon name={fileIcon(x.ext)} /><div><b style={{ wordBreak: 'break-all' }}>{x.name}</b><div className="xs muted">{timeAgo(x.uploadedAt)}</div></div></div></td><td className="r mono">{fmtSize(x.size)}</td>
                  <td>{x.permission === 'owner' ? <span className="badge nodot pending">Owner only</span> : <span className="badge nodot active">Team</span>}</td><td>{x.uploaderUser.name}</td>
                  <td className="r"><div className="row nowrap" style={{ justifyContent: 'flex-end' }}>
                    <button className="btn sm" type="button" data-open={x.id} onClick={async () => { try { const m = await api.openFile(id, x.id); toast(m.name + ' (' + fmtSize(m.size) + ') was decrypted by the server and downloaded.', 'ok', 'Download started'); } catch (e) { fail(e); } }}>Open</button>
                    <button className="btn sm ghost icon-only" type="button" data-delf={x.id} aria-label={'Delete ' + x.name} onClick={async () => { if (!(await confirmDialog({ title: 'Delete this file?', message: 'The file and its metadata are removed for all members.', confirm: 'Delete', danger: true }))) return; try { await api.deleteFile(id, x.id); toast('File deleted.', 'ok'); load(); } catch (e) { fail(e); } }}><Icon name="trash" size="sm" /></button></div></td></tr>))}</tbody></table></div>
            ) : <Empty icon="folder" title="No files yet" text="Upload data, drafts or ethics documents. Only members can see them." />}
          </div></section>
        <aside className="stack lg">
          <section className="card"><div className="card-head"><h3><Icon name="calendar" /> Milestones</h3></div>
            <div className="card-body stack">{p.milestones.length ? p.milestones.map((m) => { const du = daysUntil(m.due); return (
              <label className="check" key={m.id}><input type="checkbox" data-ms={m.id} checked={!!m.done} onChange={async () => { try { await api.toggleMilestone(id, m.id); await load(); } catch (e) { fail(e); load(); } }} /><span><b style={m.done ? { textDecoration: 'line-through', color: 'var(--text-3)' } : undefined}>{m.title}</b><br /><span className={'xs ' + (du !== null && du < 0 && !m.done ? 'badge bad nodot' : 'muted')}>{m.due ? fmtDate(m.due) : 'No date'}</span></span></label>); }) : <p className="muted small">No milestones yet.</p>}
              <form id="msForm" className="row nowrap" noValidate onSubmit={async (e) => { e.preventDefault(); try { await api.addMilestone(id, ms.t, ms.d); toast('Milestone added.', 'ok'); setMs({ t: '', d: '' }); await load(); } catch (x) { fail(x); } }}>
                <input className="input" id="msT" maxLength={60} placeholder="New milestone" aria-label="New milestone title" value={ms.t} onChange={(e) => setMs({ ...ms, t: e.target.value })} />
                <input className="input" id="msD" type="date" aria-label="Due date" style={{ maxWidth: 150 }} value={ms.d} onChange={(e) => setMs({ ...ms, d: e.target.value })} /><button className="btn icon-only" aria-label="Add milestone"><Icon name="plus" /></button></form></div></section>
          <section className="card"><div className="card-head"><h3><Icon name="history" /> Recent activity</h3></div>
            <div className="card-body">{ws.activity.length ? ws.activity.slice(0, 8).map((a, i) => <div className="item" key={i}><span><Avatar user={a.user} cls="sm" /></span><div className="body small"><b>{a.user.name}</b> {a.text}<div className="xs muted mono">{new Date(a.ts).toLocaleString('en-GB')}</div></div></div>) : <p className="muted small">No activity yet.</p>}</div></section>
        </aside>
      </div>
      {dlg ? <TaskDialog id={id} task={dlg.task} status={dlg.status} members={members} onClose={() => setDlg(null)} onSaved={load} /> : null}
    </div>
  );
}
