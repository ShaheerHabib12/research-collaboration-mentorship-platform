import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import { V } from '../lib/shared.js';
import { toast } from './toast.jsx';

/* ------------------------------ small renderers ------------------------------ */
// Avatar colours are darkened so the white initials always reach the 4.5:1 contrast required by WCAG AA (NFR-013).
const darken = (hex, f = 0.62) => { const m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return '#475569'; const n = parseInt(m[1], 16); return 'rgb(' + [n >> 16, (n >> 8) & 255, n & 255].map((c) => Math.round(c * f)).join(',') + ')'; };
export function Avatar({ user, cls = '', decor = false }) {
  const u = user || { initials: '?', color: '#475569', name: '' };
  // decor: initials are painted by CSS (data-i) so a button that wraps the avatar has no visible text to mismatch its label
  if (decor) return <span className={'avatar ' + cls} style={{ background: darken(u.color) }} data-i={u.initials} aria-hidden="true" />;
  return <span className={'avatar ' + cls} style={{ background: darken(u.color) }} {...(u.name ? { role: 'img', 'aria-label': u.name } : { 'aria-hidden': 'true' })}>{u.initials}</span>;
}
export function AvatarStack({ list, max = 4 }) {
  return (
    <span className="avatar-stack">
      {list.slice(0, max).map((u, i) => <Avatar key={u.id || i} user={u} cls="sm" />)}
      {list.length > max ? <span className="avatar sm" style={{ background: '#64748b' }}>+{list.length - max}</span> : null}
    </span>
  );
}
const BADGE = {
  pending: 'pending', awaiting_approval: 'pending', reopened: 'pending', clarify: 'pending', paused: 'pending', open: 'active', accepted: 'active', active: 'active', paid: 'active', completed: 'active', succeeded: 'active', verified: 'active', actioned: 'active',
  approved: 'published', assigned: 'info', in_progress: 'info', published: 'published',
  declined: 'bad', failed: 'bad', payout_failed: 'bad', suspended: 'bad', rejected: 'bad',
  done: 'active', new: 'pending', read: 'info', answered: 'active',
  draft: '', closed: '', withdrawn: '', dismissed: '', none: ''
};
const LABEL = { awaiting_approval: 'Awaiting approval', payout_failed: 'Payout failed', in_progress: 'In progress', clarify: 'Needs clarification', none: 'Not verified', pending_verification: 'Verification pending' };
export function Badge({ status, label, cls }) {
  const s = String(status);
  return <span className={'badge ' + (cls !== undefined ? cls : (BADGE[s] || ''))}>{label || LABEL[s] || (s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' '))}</span>;
}
export function Empty({ icon = 'inbox', title, text, children }) {
  return <div className="empty"><div className="ic"><Icon name={icon} size="lg" /></div><h3>{title}</h3>{text ? <p>{text}</p> : null}{children}</div>;
}
export function Skeleton({ n = 3, h = 88 }) {
  return <>{Array.from({ length: n }, (_, i) => <div key={i} className="skeleton" style={{ height: h, marginBottom: 12 }} />)}</>;
}
export function LockView({ code, title, text }) {
  return <div className="card"><div className="lock"><div className="code">{code}</div><h2>{title}</h2><p className="muted" style={{ maxWidth: '52ch' }}>{text}</p><Link className="btn primary" to="/dashboard">Back to dashboard</Link></div></div>;
}
export function Stars({ n }) {
  return <span className="stars" role="img" aria-label={n + ' out of 5'}>{[1, 2, 3, 4, 5].map((i) => <svg key={i} className="icon sm" viewBox="0 0 24 24" aria-hidden="true" style={{ fill: i <= n ? 'currentColor' : 'none' }} dangerouslySetInnerHTML={{ __html: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>' }} />)}</span>;
}
export const fileIcon = (ext) => ['png', 'jpg', 'jpeg'].includes(ext) ? 'file-image' : ['xlsx', 'csv', 'parquet'].includes(ext) ? 'file-spreadsheet' : 'file-text';
export function Spinner() { return <span className="spinner" />; }

/** Submit/action button that disables itself and shows a spinner while its task runs. */
export function Btn({ busy, busyText = 'Working...', children, className = 'btn', ...rest }) {
  return <button className={className} disabled={busy || rest.disabled} {...rest}>{busy ? <><Spinner /> {busyText}</> : children}</button>;
}

/* ------------------------------ forms ------------------------------ */
/** Field wrapper: label, control, hint, and the red error (cleared as soon as the user edits it). */
export function Field({ name, label, hint, error, children, htmlFor, className = '', labelExtra }) {
  return (
    <div className={'field ' + className} data-field={name}>
      {label ? <label htmlFor={htmlFor || name}>{label}{labelExtra}</label> : null}
      {children}
      {hint ? <div className="hint">{hint}</div> : null}
      {error ? <div className="error-text" role="alert"><Icon name="alert-circle" size="sm" /><span>{error}</span></div> : null}
    </div>
  );
}
/**
 * Form state: values, per-field errors, and a bind() helper. Editing a field clears its error,
 * unless `live` is true (then the page revalidates itself). The first invalid control gets focus.
 */
export function useForm(initial, { live = false } = {}) {
  const [values, setValues] = useState(initial), [errors, setErr] = useState({}), formRef = useRef(null), focusNext = useRef(false);
  const clear = (name) => { if (!live) setErr((e) => { if (!e[name]) return e; const n = { ...e }; delete n[name]; return n; }); };
  const set = (name, v) => { setValues((x) => ({ ...x, [name]: v })); clear(name); };
  const bind = (name) => ({
    name, id: name, value: values[name] ?? '',
    onChange: (ev) => set(name, ev.target.type === 'checkbox' ? ev.target.checked : ev.target.value),
    'aria-invalid': errors[name] ? 'true' : undefined
  });
  const setErrors = (e) => { focusNext.current = true; setErr(e || {}); };
  useEffect(() => {
    if (!focusNext.current) return; focusNext.current = false;
    const root = formRef.current || document, el = root.querySelector('[aria-invalid="true"]');
    if (el) (el.matches('.chip-input') ? el.querySelector('input') : el).focus();
  }, [errors]);
  return { values, setValues, errors, setErrors, set, bind, formRef, clear: () => setErr({}) };
}

/** Live "n / max" counter that turns amber/red outside the allowed range (FR-042/043). */
export function Counter({ value, min, max }) {
  const n = V.sanitizeText(value || '').length;
  return <span className={'counter' + (n > max ? ' bad' : (min && n > 0 && n < min) ? ' warn' : '')}>{n} / {max}</span>;
}

/** Chip input for skills / tags. Controlled: value is an array. */
export function ChipInput({ value, onChange, max, validate, placeholder = 'Type and press Enter', hint, maxMessage, id, 'aria-label': ariaLabel, invalid }) {
  const [text, setText] = useState(''), ref = useRef(null);
  const full = max && value.length >= max;
  function add(raw) {
    const val = V.sanitizeText(raw).replace(/,$/, ''); if (!val) return true;
    if (value.some((x) => x.toLowerCase() === val.toLowerCase())) { toast('"' + val + '" is already added.', 'warn'); return false; }
    if (max && value.length >= max) return false;
    if (validate) { const r = validate([...value, val], val); if (!r.ok) { toast(r.error, 'warn'); return false; } }
    onChange([...value, val]); return true;
  }
  return (
    <>
      <div className="chip-input" aria-invalid={invalid ? 'true' : undefined} onClick={(e) => { if (e.target === e.currentTarget) ref.current.focus(); }}>
        {value.map((v, i) => (
          <span className="chip" key={v}>{v}<button type="button" aria-label={'Remove ' + v} onClick={() => { onChange(value.filter((_, j) => j !== i)); ref.current.focus(); }}><Icon name="x" size="sm" /></button></span>
        ))}
        <input ref={ref} id={id} aria-label={ariaLabel} disabled={!!full} placeholder={full ? '' : placeholder} value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); if (add(text)) setText(''); }
            else if (e.key === 'Backspace' && !text && value.length) onChange(value.slice(0, -1));
          }}
          onBlur={() => { if (text.trim() && add(text)) setText(''); }} />
      </div>
      {(full ? (maxMessage || 'Maximum ' + max + ' reached') : hint) ? <div className="hint">{full ? (maxMessage || 'Maximum ' + max + ' reached') : hint}</div> : null}
    </>
  );
}
export function Suggestions({ items, onAdd }) {
  return <>{items.map((s) => <button key={s} type="button" className="chip chip-toggle" onClick={() => onAdd(s)}>+ {s}</button>)}</>;
}

/** Numbered pagination (NFR-015). */
export function Pager({ page, pages, onChange }) {
  if (pages <= 1) return null;
  return (
    <nav className="pager" aria-label="Pagination">
      <button type="button" disabled={page <= 1} aria-label="Previous page" onClick={() => onChange(page - 1)}><Icon name="chevron-left" size="sm" /></button>
      {Array.from({ length: pages }, (_, i) => i + 1).map((i) => <button key={i} type="button" aria-current={i === page ? 'page' : undefined} onClick={() => onChange(i)}>{i}</button>)}
      <button type="button" disabled={page >= pages} aria-label="Next page" onClick={() => onChange(page + 1)}><Icon name="chevron-right" size="sm" /></button>
    </nav>
  );
}
/** ARIA tabs (arrow keys move between tabs). The caller renders the matching panel. */
export function Tabs({ tabs, value, onChange, label }) {
  const refs = useRef([]);
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {tabs.map((t, i) => (
        <button key={t.id} type="button" role="tab" className="tab" data-tab={t.id} aria-selected={value === t.id} tabIndex={value === t.id ? 0 : -1} ref={(el) => { refs.current[i] = el; }}
          onClick={() => onChange(t.id)}
          onKeyDown={(e) => {
            const n = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : null;
            if (n !== null) { e.preventDefault(); const k = (n + tabs.length) % tabs.length; onChange(tabs[k].id); refs.current[k].focus(); }
          }}>{t.label}</button>
      ))}
    </div>
  );
}
export function download(name, text, mime = 'text/plain') {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: mime })); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
}

export function PageHead({ eyebrow, title, sub, children }) {
  return <div className="page-head"><div>{eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}<h1>{title}</h1>{sub ? <p>{sub}</p> : null}</div>{children ? <div className="actions">{children}</div> : null}</div>;
}

/** Segmented filter buttons. options: [value, label] pairs. */
export function Segmented({ options, value, onChange, label, id }) {
  return <div className="segmented" role="group" aria-label={label} id={id}>{options.map(([v, l]) => <button key={v} type="button" data-f={v} data-s={v} aria-pressed={value === v} onClick={() => onChange(v)}>{l}</button>)}</div>;
}
/** Labelled on/off switch row. */
export function SwitchRow({ title, hint, checked, onChange, ...rest }) {
  return <label className="row between nowrap"><span><b className="small">{title}</b><br /><span className="hint">{hint}</span></span><span className="switch"><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} {...rest} /><span /></span></label>;
}
