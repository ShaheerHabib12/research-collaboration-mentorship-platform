import { useState } from 'react';
import { Modal } from './Modal.jsx';
import { Btn, Counter, Field } from './ui.jsx';
import { fail, toast } from './toast.jsx';
import { V } from '../lib/shared.js';
import { useAction } from '../hooks/useLoad.js';

/** Message dialog (FR-014): 10-500 characters, duplicate / conflict handled by the API (409). */
export default function MessageDialog({ title, intro, label = 'Your message', placeholder = 'Say what you bring and what you hope to do together.', sendLabel = 'Send', okMsg, onSend, onClose, onDone, children }) {
  const [msg, setMsg] = useState(''), [err, setErr] = useState(''), [busy, run] = useAction();
  const go = () => {
    const v = V.validateMessage(msg); if (!v.ok) return setErr(v.error);
    setErr('');
    run(async () => {
      try { await onSend(v.value); onClose(); toast(okMsg, 'ok', 'Sent'); if (onDone) onDone(); }
      catch (e) { if (e.fields) setErr(e.fields.message || Object.values(e.fields)[0]); else if (e.status === 409) { onClose(); fail(e); if (onDone) onDone(); } else fail(e); }
    });
  };
  return (
    <Modal title={title} onClose={onClose} footer={<><button className="btn" type="button" data-close onClick={onClose}>Cancel</button><Btn className="btn primary" id="go" busy={busy} busyText="Sending..." onClick={go}>{sendLabel}</Btn></>}>
      <form noValidate className="stack" onSubmit={(e) => { e.preventDefault(); go(); }}>
        {intro ? <p className="muted">{intro}</p> : null}
        {children}
        <Field name="message" label={label} labelExtra={<> <span className="counter" id="mc"><Counter value={msg} min={10} max={500} /></span></>} htmlFor="msg" error={err}>
          <textarea className="textarea" id="msg" maxLength={520} placeholder={placeholder} value={msg} aria-invalid={err ? 'true' : undefined} onChange={(e) => { setMsg(e.target.value); setErr(''); }} />
        </Field>
      </form>
    </Modal>
  );
}
