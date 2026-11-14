import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { Modal, confirmDialog } from '../components/Modal.jsx';
import { Avatar, Badge, Btn, ChipInput, Counter, Field, PageHead, Skeleton, Suggestions, download, useForm } from '../components/ui.jsx';
import { fail, toast } from '../components/toast.jsx';
import { api, colorFor, initials } from '../lib/api.js';
import { C, V } from '../lib/shared.js';
import { useAction, useLoad, useQuery } from '../hooks/useLoad.js';

const VIS = [['public', 'Everyone'], ['team', 'Team members only'], ['private', 'Only me']];
function VisSelect({ field, value, onChange }) {
  return <select className="select vis-select" data-vis={field} aria-label={'Who can see ' + field} value={value} onChange={(e) => onChange(e.target.value)}>{VIS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>;
}
function Toggles({ items, value, onChange, legend }) {
  return <fieldset className="field"><legend>{legend}</legend><div className="pill-row">{items.map((x) => <button key={x} type="button" className="chip chip-toggle" aria-pressed={value.includes(x)} onClick={() => onChange(value.includes(x) ? value.filter((y) => y !== x) : [...value, x])}>{x}</button>)}</div></fieldset>;
}

function ProfileForm({ p, setP }) {
  const params = useQuery(), nav = useNavigate(), [busy, run] = useAction(), [preview, setPreview] = useState(false);
  const f = useForm({
    name: p.name, headline: p.headline || '', institution: p.institution || '', department: p.department || '', experience: p.experience || '', link: p.link || '',
    interests: p.interests, skills: p.skills, preferredRoles: p.preferredRoles, assistance: p.assistance, languages: p.languages || [],
    hours: (p.availability || {}).hours || 0, days: (p.availability || {}).days || [], anote: (p.availability || {}).note || '',
    vis: { ...p.visibility.fields }, listed: p.visibility.overall === 'listed',
    expertise: p.mentor ? p.mentor.expertise : [], quals: p.mentor ? p.mentor.qualifications : [], accepting: p.mentor ? !!p.mentor.accepting : false, rexp: p.researcher ? p.researcher.expertise : []
  });
  const v = f.values, setVis = (k, val) => f.set('vis', { ...v.vis, [k]: val });
  const checks = [['name', v.name], ['headline', v.headline], ['institution', v.institution], ['experience', v.experience], ['interests', v.interests.length], ['skills', v.skills.length], ['availability', v.days.length && Number(v.hours) > 0]];
  const pct = Math.round(checks.filter((c) => c[1]).length / checks.length * 100), miss = checks.filter((c) => !c[1]).map((c) => c[0]);

  const collect = () => {
    const d = { name: v.name, headline: v.headline, institution: v.institution, department: v.department, experience: v.experience, link: v.link.trim(), interests: v.interests, skills: v.skills, preferredRoles: v.preferredRoles, assistance: v.assistance, languages: v.languages, availability: { hours: v.hours, days: v.days, note: v.anote }, visibility: { overall: v.listed ? 'listed' : 'unlisted', fields: v.vis } };
    if (p.mentor) d.mentor = { expertise: v.expertise, qualifications: v.quals, accepting: v.accepting };
    if (p.researcher) d.researcher = { expertise: v.rexp };
    return d;
  };
  function save(e) {
    if (e) e.preventDefault();
    const d = collect(), r = V.validateProfile(d);
    if (!r.ok) { f.setErrors(r.errors); toast('Please fix the highlighted fields. Nothing was saved.', 'warn'); return; }
    f.clear();
    run(async () => { try { setP(await api.updateProfile(d)); toast('Profile saved. Visibility settings apply immediately.', 'ok', 'Saved'); } catch (err) { if (err.fields) f.setErrors(err.fields); fail(err); } });
  }
  const d = collect(), hide = (k) => (d.visibility.fields[k] || 'public') !== 'public';
  const row = (l, val, k) => hide(k) ? <><dt>{l}</dt><dd className="muted"><Icon name="lock" size="sm" /> Hidden by user</dd></> : <><dt>{l}</dt><dd>{val || '-'}</dd></>;

  return (
    <div className="content">
      <PageHead eyebrow="Account" title="My profile" sub="Tell collaborators what you work on and when you are available. Choose who sees each detail.">
        <button className="btn" id="preview" type="button" onClick={() => setPreview(true)}><Icon name="eye" /> Preview as others see it</button>
        <Btn className="btn primary" id="saveTop" type="button" busy={busy} busyText="Saving..." onClick={() => save()}><Icon name="check" /> Save profile</Btn>
      </PageHead>
      {params.welcome ? <div id="welcome" className="notice ok mb"><Icon name="check-circle" /><div><strong>Account created.</strong> Complete your profile so collaborators can find you - add interests, skills and availability.</div></div> : null}
      <div className="grid split">
        <form id="form" className="stack lg" noValidate ref={f.formRef} onSubmit={save}>
          <section className="card"><div className="card-head"><h3><Icon name="user" /> About you</h3></div><div className="card-body stack">
            <div className="grid g2">
              <Field name="name" label={<>Full name <span className="req">*</span></>} error={f.errors.name}><input className="input" maxLength={60} {...f.bind('name')} /></Field>
              <Field name="headline" label="Headline" labelExtra={<> <span className="counter" id="hc"><Counter value={v.headline} min={0} max={100} /></span></>} error={f.errors.headline}><input className="input" maxLength={110} placeholder="e.g. MSc student interested in sleep research" {...f.bind('headline')} /></Field>
            </div>
            <div className="grid g2">
              <Field name="institution" label="Institution" labelExtra={<> <VisSelect field="institution" value={v.vis.institution || 'public'} onChange={(x) => setVis('institution', x)} /></>} error={f.errors.institution}><input className="input" maxLength={80} {...f.bind('institution')} /></Field>
              <Field name="department" label="Department / school" error={f.errors.department}><input className="input" maxLength={80} {...f.bind('department')} /></Field>
            </div>
            <Field name="experience" label="Experience summary" labelExtra={<> <span className="row" style={{ gap: 12 }}><span className="counter" id="ec"><Counter value={v.experience} min={0} max={800} /></span><VisSelect field="experience" value={v.vis.experience || 'public'} onChange={(x) => setVis('experience', x)} /></span></>} error={f.errors.experience}><textarea className="textarea" maxLength={900} {...f.bind('experience')} /></Field>
            <Field name="link" label="CV, portfolio or publication link" labelExtra={<> <VisSelect field="link" value={v.vis.link || 'team'} onChange={(x) => setVis('link', x)} /></>} error={f.errors.link} hint="Shown only to the audience you choose (FR-006)."><input className="input" type="url" placeholder="https://" {...f.bind('link')} /></Field>
          </div></section>

          <section className="card"><div className="card-head"><h3><Icon name="target" /> Interests and skills</h3></div><div className="card-body stack">
            <Field name="interests" error={f.errors.interests} label={<>Research interests <span className="req">*</span></>} htmlFor="interests-in"><ChipInput id="interests-in" invalid={f.errors.interests} aria-label="Add a research interest" value={v.interests} onChange={(x) => f.set('interests', x)} max={12} placeholder="Add an interest and press Enter" /></Field>
            <Field name="skills" error={f.errors.skills} label={<>Skills <span className="req">*</span></>} htmlFor="skills-in"><ChipInput id="skills-in" invalid={f.errors.skills} aria-label="Add a skill" value={v.skills} onChange={(x) => f.set('skills', x)} max={15} placeholder="Add a skill and press Enter" />
              <div className="suggest" id="skillSug" aria-label="Suggested skills"><Suggestions items={C.SKILL_SUGGESTIONS.slice(0, 10)} onAdd={(s) => { if (!v.skills.some((x) => x.toLowerCase() === s.toLowerCase()) && v.skills.length < 15) f.set('skills', [...v.skills, s]); }} /></div></Field>
            <Field name="preferredRoles" label="Preferred roles" htmlFor="roles-in" error={f.errors.preferredRoles}><ChipInput id="roles-in" aria-label="Add a preferred role" value={v.preferredRoles} onChange={(x) => f.set('preferredRoles', x)} max={6} placeholder="e.g. Data analyst, Co-author" /></Field>
            <Field name="assistance" label="Types of research assistance you offer or need" htmlFor="assist-in"><ChipInput id="assist-in" aria-label="Add an assistance type" value={v.assistance} onChange={(x) => f.set('assistance', x)} max={6} placeholder="e.g. Statistics support" /></Field>
            <Toggles legend="Languages" items={C.LANGUAGES} value={v.languages} onChange={(x) => f.set('languages', x)} />
          </div></section>

          <section className="card"><div className="card-head"><h3><Icon name="calendar" /> Availability</h3><VisSelect field="availability" value={v.vis.availability || 'public'} onChange={(x) => setVis('availability', x)} /></div><div className="card-body stack">
            <div className="grid g2"><Field name="hours" label="Hours per week you can commit" error={f.errors.hours}><input className="input" type="number" min="0" max="40" {...f.bind('hours')} /></Field>
              <Field name="anote" label="Note"><input className="input" maxLength={80} placeholder="e.g. Evenings after 5pm UK time" {...f.bind('anote')} /></Field></div>
            <Toggles legend="Days you are usually free" items={C.DAYS} value={v.days} onChange={(x) => f.set('days', x)} />
          </div></section>

          {p.mentor ? (
            <section className="card" id="mentorCard"><div className="card-head"><h3><Icon name="graduation-cap" /> Mentor profile</h3><span id="verif"><Badge status={p.mentor.verification} label={{ verified: 'Verified', pending: 'Verification pending', none: 'Not verified' }[p.mentor.verification]} /></span></div><div className="card-body stack">
              <Field name="expertise" label="Mentoring topics (expertise)" htmlFor="exp-in"><ChipInput id="exp-in" aria-label="Add a topic" value={v.expertise} onChange={(x) => f.set('expertise', x)} max={8} />
                <div className="suggest" id="topicSug"><Suggestions items={C.TOPICS.slice(0, 6)} onAdd={(s) => { if (!v.expertise.includes(s) && v.expertise.length < 8) f.set('expertise', [...v.expertise, s]); }} /></div></Field>
              <Field name="quals" label="Qualifications" htmlFor="quals-in" hint="Verification is optional and, where offered, its status is shown accurately to students (FR-019, FR-037)."><ChipInput id="quals-in" aria-label="Add a qualification" value={v.quals} onChange={(x) => f.set('quals', x)} max={6} placeholder="e.g. PhD Statistics, Imperial College London" /></Field>
              <label className="check"><span className="switch"><input type="checkbox" id="accepting" checked={v.accepting} onChange={(e) => f.set('accepting', e.target.checked)} /><span /></span><span><b>Accepting new mentorship requests</b><br /><span className="hint">Turn off to avoid being overloaded (FR-021).</span></span></label>
            </div></section>
          ) : null}

          {p.researcher ? (
            <section className="card" id="resCard"><div className="card-head"><h3><Icon name="flask" /> Researcher support expertise</h3><span id="rbadge"><Badge status={p.researcher.approved ? 'approved' : 'pending'} label={p.researcher.approved ? 'Approved researcher' : 'Awaiting approval'} /></span></div><div className="card-body stack">
              <Field name="rexp" label="Support categories you can handle" htmlFor="rexp-in" hint="Student support requests are matched on these categories, your availability and your current workload."><ChipInput id="rexp-in" aria-label="Add a category" value={v.rexp} onChange={(x) => f.set('rexp', x)} max={8} />
                <div className="suggest" id="rexpSug"><Suggestions items={C.SUPPORT_CATEGORIES} onAdd={(s) => { if (!v.rexp.includes(s) && v.rexp.length < 8) f.set('rexp', [...v.rexp, s]); }} /></div></Field>
            </div></section>
          ) : null}

          <section className="card"><div className="card-head"><h3><Icon name="shield" /> Privacy &amp; data</h3></div><div className="card-body stack">
            <label className="check"><span className="switch"><input type="checkbox" id="listed" checked={v.listed} onChange={(e) => f.set('listed', e.target.checked)} /><span /></span><span><b>List my profile in search results</b><br /><span className="hint">Off = unlisted: only people who share a project with you can open your profile.</span></span></label>
            <hr className="hr" />
            <div className="row between"><div><b>Export my data</b><div className="hint">Download a JSON copy of your account, memberships and requests.</div></div><button className="btn" type="button" id="export" onClick={async () => { try { const d2 = await api.exportMyData(); download('rcmp-my-data.json', JSON.stringify(d2, null, 2), 'application/json'); toast('Your data export was downloaded.', 'ok'); } catch (e) { fail(e); } }}><Icon name="download" /> Export</button></div>
            <div className="row between"><div><b>Delete my account</b><div className="hint">Removes your profile and memberships. See the <Link to="/privacy#retention">retention policy</Link>.</div></div><button className="btn danger" type="button" id="delete" onClick={async () => { if (!(await confirmDialog({ title: 'Delete your account?', message: 'Your profile and project memberships will be removed. This cannot be undone.', confirm: 'Delete account', danger: true }))) return; try { await api.deleteMyAccount(); nav('/'); } catch (e) { fail(e); } }}><Icon name="trash" /> Delete account</button></div>
          </div></section>
          <div className="row" style={{ justifyContent: 'flex-end' }}><Btn className="btn primary lg" type="submit" busy={busy} busyText="Saving...">Save profile</Btn></div>
        </form>

        <aside className="stack" style={{ position: 'sticky', top: 'calc(var(--topbar-h) + 16px)' }}>
          <div className="card card-pad stack" aria-live="polite"><h3>Profile strength</h3><div className="progress teal"><i id="barFill" style={{ width: pct + '%' }} /></div><p className="small muted" id="barText">{pct}% complete{miss.length ? ' - add: ' + miss.join(', ') : ' - great, collaborators can judge your fit.'}</p></div>
          <div className="notice"><Icon name="info" /><span>Fields marked with a lock icon are checked <b>on the server</b> - hidden fields are never sent to other users.</span></div>
        </aside>
      </div>
      {preview ? (
        <Modal title="Preview: how other users see you" size="lg" onClose={() => setPreview(false)} footer={<button className="btn primary" data-close onClick={() => setPreview(false)}>Close</button>}>
          <div className="stack"><div className="row nowrap"><Avatar user={{ initials: initials(d.name), color: colorFor(p.id), name: d.name }} cls="lg" /><div><h3>{d.name}</h3><p className="muted">{d.headline}</p></div></div>
            {d.visibility.overall === 'unlisted' ? <div className="notice warn"><Icon name="eye-off" /><span>You are unlisted - you will not appear in search results.</span></div> : null}
            <dl className="kv">{row('Institution', d.institution, 'institution')}{row('Experience', d.experience, 'experience')}{row('Availability', d.availability.hours + ' h/week · ' + d.availability.days.join(', '), 'availability')}{row('Link', d.link, 'link')}
              <dt>Interests</dt><dd className="tags">{d.interests.map((s) => <span className="chip" key={s}>{s}</span>)}</dd><dt>Skills</dt><dd className="tags">{d.skills.map((s) => <span className="chip mono" key={s}>{s}</span>)}</dd></dl></div>
        </Modal>
      ) : null}
    </div>
  );
}

export default function Profile() {
  const q = useLoad(() => api.getProfile(), []);
  useEffect(() => { document.title = 'My profile - RCMP'; }, []);
  if (!q.data) return <div className="content"><Skeleton n={3} h={140} /></div>;
  return <ProfileForm key={q.data.id} p={q.data} setP={(x) => q.setData(x)} />;
}
