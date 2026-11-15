import { useEffect, useId, useRef, useState } from 'react';
import Icon from './Icon.jsx';

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])';

/** Accessible dialog: role=dialog, aria-modal, focus moves in, Tab is trapped, Esc closes, focus returns (NFR-011..013). */
export function Modal({ title, size = '', onClose, footer, dismissible = true, children }) {
  const ref = useRef(null), tid = useId();
  useEffect(() => {
    const prev = document.activeElement, dlg = ref.current;
    document.body.style.overflow = 'hidden';
    const first = dlg.querySelector('[autofocus], input:not([type=hidden]), textarea, select') || dlg.querySelector('.modal-body button, .modal-foot button:not([data-close])') || dlg.querySelector('button');
    if (first) first.focus();
    function onKey(e) {
      if (e.key === 'Escape' && dismissible) { e.stopPropagation(); onClose(); }
      if (e.key === 'Tab') {
        const f = [...dlg.querySelectorAll(FOCUSABLE)].filter((x) => x.offsetParent !== null);
        if (!f.length) return;
        const a = f[0], z = f[f.length - 1];
        if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
        else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
      }
    }
    document.addEventListener('keydown', onKey, true);
    return () => { document.removeEventListener('keydown', onKey, true); document.body.style.overflow = ''; if (prev && prev.focus) prev.focus(); };
  }, []);
  return (
    <div className="modal-wrap" onMouseDown={(e) => { if (e.target === e.currentTarget && dismissible) onClose(); }}>
      <div className={'modal ' + size} role="dialog" aria-modal="true" aria-labelledby={tid} ref={ref}>
        <div className="modal-head">
          <h2 id={tid} style={{ fontSize: '1.25rem', lineHeight: '1.75rem' }}>{title}</h2>
          <button type="button" className="icon-btn" aria-label="Close dialog" onClick={() => onClose()}><Icon name="x" /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-foot">{footer}</div> : null}
      </div>
    </div>
  );
}

/* Promise-based confirmation dialog, callable from any handler. */
let current = null; const subs = new Set();
const set = (c) => { current = c; subs.forEach((f) => f(c)); };
export function confirmDialog(o) { return new Promise((resolve) => set({ ...o, resolve })); }
export function ConfirmHost() {
  const [c, setC] = useState(current);
  useEffect(() => { subs.add(setC); return () => subs.delete(setC); }, []);
  if (!c) return null;
  const done = (v) => { set(null); c.resolve(v); };
  return (
    <Modal title={c.title} size="sm" onClose={() => done(false)}
      footer={<><button className="btn" type="button" data-close onClick={() => done(false)}>{c.cancel || 'Cancel'}</button><button className={'btn ' + (c.danger ? 'danger-solid' : 'primary')} type="button" data-ok onClick={() => done(true)}>{c.confirm || 'Confirm'}</button></>}>
      <p style={{ color: 'var(--text-2)' }}>{c.message}</p>
    </Modal>
  );
}
