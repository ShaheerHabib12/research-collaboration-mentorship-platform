import { useEffect, useState } from 'react';
import Icon from './Icon.jsx';
import { ApiError } from '../lib/api.js';

/* A tiny store so toast() can be called from anywhere (event handlers, API helpers). */
let items = [], seq = 0; const subs = new Set();
const publish = () => subs.forEach((f) => f(items));
export function dismissToast(id) { items = items.filter((t) => t.id !== id); publish(); }
/** @param {'ok'|'bad'|'warn'|'info'} type */
export function toast(message, type = 'info', title, ms) {
  const id = ++seq; items = [...items, { id, message, type, title }]; publish();
  setTimeout(() => dismissToast(id), ms || (type === 'bad' ? 8000 : 4500));
}

export function ToastHost() {
  const [list, setList] = useState(items);
  useEffect(() => { subs.add(setList); return () => subs.delete(setList); }, []);
  return (
    <div className="toasts" role="status" aria-live="polite">
      {list.map((t) => (
        <div key={t.id} className={'toast ' + t.type} role={t.type === 'bad' ? 'alert' : undefined}>
          <Icon name={t.type === 'ok' ? 'check-circle' : t.type === 'bad' ? 'alert-circle' : t.type === 'warn' ? 'alert-triangle' : 'info'} />
          <div className="grow">{t.title ? <b>{t.title}</b> : null}{t.message}</div>
          <button type="button" aria-label="Dismiss" onClick={() => dismissToast(t.id)}><Icon name="x" size="sm" /></button>
        </div>
      ))}
    </div>
  );
}

/**
 * Central API error handler (one place for 0/401/402/403/409/413/500). Returns the error so callers can read err.fields.
 * 401 -> back to sign-in (the caller keeps the form data), others -> toast.
 */
export function fail(err, opts = {}) {
  if (!(err instanceof ApiError)) { console.error(err); toast('Something unexpected went wrong. Please try again.', 'bad'); return err; }
  if (err.status === 401) {
    toast(err.message, 'warn', 'Signed out');
    if (!opts.noRedirect) setTimeout(() => { window.location.href = '/login?expired=1&next=' + encodeURIComponent(window.location.pathname + window.location.search); }, 1400);
  } else if (err.status === 0) toast(err.message, 'bad', 'Offline');
  else if (err.status === 403) toast(err.message, 'bad', 'Not allowed (403)');
  else if (err.status === 409) toast(err.message, 'warn', 'Conflict (409)');
  else if (err.status === 413) toast(err.message, 'bad', 'File too large (413)');
  else if (err.status === 402) toast(err.message, 'warn', 'Plan limit');
  else if (err.status === 500) toast(err.message, 'bad', 'Not saved (500)');
  else toast(err.message, 'bad');
  return err;
}
