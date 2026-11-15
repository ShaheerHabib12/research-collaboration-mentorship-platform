import { useState } from 'react';
import { Modal } from './Modal.jsx';
import { Btn, Field } from './ui.jsx';
import { fail, toast } from './toast.jsx';
import { api } from '../lib/api.js';
import { useAction } from '../hooks/useLoad.js';

/** Report a profile, project or file to the administrators (FR-036). */
export default function ReportDialog({ target, onClose }) {
  const [reason, setReason] = useState(''), [details, setDetails] = useState(''), [err, setErr] = useState(''), [busy, run] = useAction();
  const go = () => run(async () => {
    try { await api.reportContent({ targetType: target.type, targetId: target.id, targetName: target.name, reason, details }); onClose(); toast('Thank you - an administrator will review this report.', 'ok', 'Report sent'); }
    catch (e) { if (e.fields && e.fields.reason) setErr(e.fields.reason); else fail(e); }
  });
  return (
    <Modal title={'Report ' + target.name} onClose={onClose}
      footer={<><button className="btn" type="button" data-close onClick={onClose}>Cancel</button><Btn className="btn danger-solid" id="go" busy={busy} busyText="Sending..." onClick={go}>Submit report</Btn></>}>
      <p className="muted" style={{ marginBottom: 12 }}>Reports are reviewed by an administrator (FR-036). The person is not told who reported them.</p>
      <Field name="reason" label="Reason" htmlFor="rr" error={err}>
        <select className="select" id="rr" value={reason} aria-invalid={err ? 'true' : undefined} onChange={(e) => { setReason(e.target.value); setErr(''); }}>
          <option value="">Choose...</option><option>Fake profile</option><option>Spam</option><option>Inappropriate content</option><option>Harassment</option><option>Other</option>
        </select>
      </Field>
      <Field name="details" label={<>Details <span className="muted" style={{ fontWeight: 400 }}>(optional)</span></>} htmlFor="rd"><textarea className="textarea" id="rd" maxLength={420} style={{ minHeight: 72 }} value={details} onChange={(e) => setDetails(e.target.value)} /></Field>
    </Modal>
  );
}
