import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { Btn, ChipInput, Counter, Field, PageHead, Suggestions, useForm } from '../components/ui.jsx';
import { fail, toast } from '../components/toast.jsx';
import { ApiError, api } from '../lib/api.js';
import { C, V } from '../lib/shared.js';
import { useAction, useQuery } from '../hooks/useLoad.js';

const VIS = [['public', 'globe', 'Public brief', 'Everyone can read the full brief in search.'], ['summary', 'eye-off', 'Summary only', 'Title, skills and roles are listed; question and objectives stay hidden until a request is accepted.'], ['private', 'lock', 'Private', 'Not listed. Only people you invite can open it.']];
const BLANK = { title: '', subject: '', stage: 'idea', question: '', objectives: [], methods: [], skills: [], roles: [], hoursPerWeek: '', visibility: 'public', milestones: [] };

export default function ProjectNew() {
  const { id: editId } = useQuery(), nav = useNavigate(), key = 'rcmp.draft.brief.' + (editId || 'new');
  const f = useForm(BLANK), [objIn, setObjIn] = useState(''), [busy, run] = useAction(), [mode, setMode] = useState(null), [note, setNote] = useState('Drafts are kept if your session expires.'), [ready, setReady] = useState(!editId), msRef = useRef(null);
  const v = f.values;
  useEffect(() => { document.title = (editId ? 'Edit project brief' : 'New project brief') + ' - RCMP'; }, [editId]);
  useEffect(() => {
    (async () => {
      if (editId) {
        try {
          const p = await api.getProject(editId); if (!p.isOwner) throw new ApiError(403, 'Only the project owner can edit this brief.');
          f.setValues({ ...BLANK, ...p, hoursPerWeek: p.hoursPerWeek || '', milestones: (p.milestones || []).map((m) => ({ id: m.id, title: m.title, due: m.due, done: m.done })) }); setMode('edit');
        } catch (e) { fail(e); return; }
      }
      try { const st = JSON.parse(sessionStorage.getItem(key)); if (st && (st.title || st.question)) { f.setValues({ ...BLANK, ...st }); setNote('Restored your unsaved draft from this session.'); } } catch (e) { /* ignore */ }
      setReady(true);
    })();
  }, []); // eslint-disable-line
  // The form is mirrored into sessionStorage so an expired session (401) never loses typed work (UC-01, S2).
  useEffect(() => { if (ready) try { sessionStorage.setItem(key, JSON.stringify(v)); } catch (e) { /* ignore */ } }, [v, ready]); // eslint-disable-line

  const addObj = () => { const t = V.sanitizeText(objIn); if (!t) return; if (v.objectives.length >= 8) return toast('Maximum 8 objectives.', 'warn'); f.set('objectives', [...v.objectives, t]); setObjIn(''); };
  const setMs = (i, k, val) => f.set('milestones', v.milestones.map((m, j) => (j === i ? { ...m, [k]: val } : m)));

  function save(publish) {
    const d = { ...v }; f.clear(); const r = V.validateProjectBrief(d);
    if (publish && !r.ok) { f.setErrors(r.errors); toast('Fix the highlighted fields before publishing. Nothing was saved.', 'warn', 'Not published'); return; }
    if (!publish && r.errors.title) { f.setErrors({ title: r.errors.title }); return; }
    run(async () => {
      try {
        const p = await api.saveProject(d, editId, publish); try { sessionStorage.removeItem(key); } catch (e) { /* ignore */ }
        toast(publish ? 'Your brief is saved and visible as configured.' : 'Draft saved.', 'ok', publish ? 'Published' : 'Draft saved'); setTimeout(() => nav('/project?id=' + p.id), 700);
      } catch (e) { if (e.fields) f.setErrors(e.fields); if (e.status === 500 || e.status === 0) toast('Not saved - your draft is still on this page. Press the button again to retry.', 'warn'); fail(e); }
    });
  }
  const sug = (field, max) => (s) => { if (!v[field].includes(s) && v[field].length < max) f.set(field, [...v[field], s]); };

  return (
    <div className="content">
      <div className="crumbs"><Link to="/projects">My projects</Link><Icon name="chevron-right" size="sm" /><span id="crumb">{mode === 'edit' ? 'Edit' : 'New brief'}</span></div>
      <PageHead eyebrow="New project" title={mode === 'edit' ? 'Edit project brief' : 'Create a research project'} sub="A concise brief helps the right people respond: the question, the skills you need, the roles on offer and the time you expect." />
      <div className="grid split">
        <form id="form" className="stack lg" noValidate ref={f.formRef} onSubmit={(e) => { e.preventDefault(); save(true); }}>
          <section className="card"><div className="card-head"><h3><Icon name="file-text" /> The research</h3></div><div className="card-body stack">
            <Field name="title" error={f.errors.title} label={<>Project title <span className="req">*</span></>} labelExtra={<span className="counter" id="tc"><Counter value={v.title} min={5} max={120} /></span>}><input className="input" maxLength={125} placeholder="A clear, specific title" {...f.bind('title')} /></Field>
            <div className="grid g2">
              <Field name="subject" label={<>Subject area <span className="req">*</span></>} error={f.errors.subject}><select className="select" {...f.bind('subject')}><option value="">Choose...</option>{C.SUBJECTS.map((s) => <option key={s}>{s}</option>)}</select></Field>
              <Field name="stage" label={<>Current stage <span className="req">*</span></>} error={f.errors.stage}><select className="select" {...f.bind('stage')}>{C.STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></Field>
            </div>
            <Field name="question" error={f.errors.question} label={<>Research question <span className="req">*</span></>} labelExtra={<span className="counter" id="qc"><Counter value={v.question} min={20} max={600} /></span>}><textarea className="textarea" maxLength={620} placeholder="What are you trying to find out?" {...f.bind('question')} /></Field>
            <Field name="objectives" htmlFor="objIn" error={f.errors.objectives} label={<>Objectives <span className="req">*</span></>}>
              <ol id="objList" className="stack sm" style={{ paddingLeft: 20, margin: 0 }}>{v.objectives.map((o, i) => <li key={i}><div className="row nowrap"><span className="grow">{o}</span><button type="button" className="btn ghost sm icon-only" aria-label={'Remove objective ' + (i + 1)} onClick={() => f.set('objectives', v.objectives.filter((_, j) => j !== i))}><Icon name="x" size="sm" /></button></div></li>)}</ol>
              <div className="row nowrap"><input className="input" id="objIn" maxLength={140} placeholder="Add an objective and press Enter" value={objIn} onChange={(e) => setObjIn(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addObj(); } }} /><button className="btn" type="button" id="objAdd" onClick={addObj}><Icon name="plus" /> Add</button></div>
            </Field>
            <Field name="methods" label="Methods / keywords" htmlFor="methods-in"><ChipInput id="methods-in" aria-label="Add a method" value={v.methods} onChange={(x) => f.set('methods', x)} max={8} placeholder="e.g. Cross-validation" /></Field>
          </div></section>

          <section className="card"><div className="card-head"><h3><Icon name="users" /> Who you need</h3></div><div className="card-body stack">
            <Field name="skills" error={f.errors.skills} htmlFor="skills-in" label={<>Required skills <span className="req">*</span></>}><ChipInput id="skills-in" invalid={f.errors.skills} aria-label="Add a skill" value={v.skills} onChange={(x) => f.set('skills', x)} max={10} maxMessage="Maximum 10 skills" placeholder="Add a skill and press Enter" /><div className="suggest" id="skillSug"><Suggestions items={C.SKILL_SUGGESTIONS.slice(0, 9)} onAdd={sug('skills', 10)} /></div></Field>
            <Field name="roles" label="Open roles" htmlFor="roles-in"><ChipInput id="roles-in" aria-label="Add a role" value={v.roles} onChange={(x) => f.set('roles', x)} max={6} placeholder="e.g. Data analyst" /></Field>
            <Field name="hoursPerWeek" htmlFor="hours" error={f.errors.hoursPerWeek} label={<>Expected time commitment (hours / week) <span className="req">*</span></>}><input className="input" type="number" min="1" max="40" style={{ maxWidth: 200 }} {...f.bind('hoursPerWeek')} id="hours" /></Field>
          </div></section>

          <section className="card"><div className="card-head"><h3><Icon name="eye" /> Who can see this brief</h3></div><div className="card-body">
            <fieldset className="field" data-field="visibility"><legend className="sr-only">Visibility</legend>
              <div className="radio-cards">{VIS.map(([val, ic, t, d]) => <label className="radio-card" key={val}><input type="radio" name="vis" value={val} checked={v.visibility === val} onChange={() => f.set('visibility', val)} /><span className="t"><Icon name={ic} /> {t}</span><span className="d">{d}</span></label>)}</div>
            </fieldset></div></section>

          <section className="card"><div className="card-head"><h3><Icon name="calendar" /> Basic timeline (optional)</h3><button className="btn sm" type="button" id="addMs" onClick={() => { if (v.milestones.length >= 8) return toast('Maximum 8 milestones.', 'warn'); f.set('milestones', [...v.milestones, { title: '', due: '' }]); setTimeout(() => { const l = msRef.current.querySelectorAll('[data-mt]'); if (l.length) l[l.length - 1].focus(); }, 0); }}><Icon name="plus" size="sm" /> Add milestone</button></div>
            <div className="card-body stack" id="msList" ref={msRef}>{v.milestones.length ? v.milestones.map((m, i) => (
              <div className="row nowrap" key={i}><input className="input" data-mt={i} value={m.title} aria-label={'Milestone ' + (i + 1) + ' title'} maxLength={60} placeholder="Milestone title" onChange={(e) => setMs(i, 'title', e.target.value)} />
                <input className="input" type="date" data-md={i} value={m.due} aria-label={'Milestone ' + (i + 1) + ' date'} style={{ maxWidth: 170 }} onChange={(e) => setMs(i, 'due', e.target.value)} />
                <button type="button" className="btn ghost sm icon-only" aria-label={'Remove milestone ' + (i + 1)} onClick={() => f.set('milestones', v.milestones.filter((_, j) => j !== i))}><Icon name="x" size="sm" /></button></div>
            )) : <p className="muted small">No milestones yet. Add a few to show collaborators the shape of the project.</p>}</div></section>

          <div className="card"><div className="card-foot" style={{ borderRadius: 'var(--r-lg)' }}><span className="small muted" id="draftNote">{note}</span>
            <div className="row"><Link className="btn" to="/projects">Cancel</Link><Btn className="btn" type="button" id="draft" busy={busy} busyText="Saving..." onClick={() => save(false)}><Icon name="file" /> Save draft</Btn><Btn className="btn primary" type="submit" id="pub" busy={busy} busyText="Publishing..."><Icon name={mode === 'edit' ? 'check' : 'send'} /> {mode === 'edit' ? 'Save changes' : 'Publish brief'}</Btn></div></div></div>
        </form>
        <aside className="stack" style={{ position: 'sticky', top: 'calc(var(--topbar-h) + 16px)' }}>
          <div className="card card-pad stack"><h3>Writing a brief that gets replies</h3><ul className="stack sm small" style={{ margin: 0, paddingLeft: 18, color: 'var(--text-2)' }}><li>State one clear question.</li><li>List the skills and roles you need - supervisors told us this is what they check first.</li><li>Say how many hours a week you expect.</li><li>Use <b>Summary only</b> for unpublished ideas.</li></ul></div>
          <div className="notice warn"><Icon name="info" /><span>Your brief is not an ethics approval and does not replace institutional research governance (FR-026).</span></div>
        </aside>
      </div>
    </div>
  );
}
