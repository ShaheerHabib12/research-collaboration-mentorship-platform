import { useEffect, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { Modal, confirmDialog } from '../components/Modal.jsx';
import { Avatar, Badge, Btn, Empty, PageHead, Segmented, Skeleton } from '../components/ui.jsx';
import { fail, toast } from '../components/toast.jsx';
import { useSession } from '../hooks/useSession.js';
import { useAction, useLoad } from '../hooks/useLoad.js';
import { api, money } from '../lib/api.js';

const STATUS_NOTE = { draft: 'Draft - not yet submitted', awaiting_approval: 'Waiting for an administrator', approved: 'Approved - payout not yet sent', paid: 'Paid - provider confirmed', payout_failed: 'Provider reported a failure - not paid' };
const DONE = { submit: 'Submitted for approval.', approve: 'Statement approved. The researcher was notified.', return: 'Returned to draft.', exception: 'Exception recorded in the audit trail.', adjust: 'Adjustment recorded.' };

function NoteDialog({ title, label, hint, onClose, onSend, okLabel }) {
  const [t, setT] = useState('');
  return <Modal title={title} onClose={onClose} footer={<><button className="btn" type="button" data-close onClick={onClose}>Cancel</button><button className="btn primary" id="go" type="button" onClick={() => onSend(t)}>{okLabel}</button></>}><div className="field"><label htmlFor="n">{label} <span className="muted" style={{ fontWeight: 400 }}>{hint}</span></label><textarea className="textarea" id="n" maxLength={200} value={t} onChange={(e) => setT(e.target.value)} /></div></Modal>;
}
function AdjustDialog({ s, onClose, onSend }) {
  const [am, setAm] = useState(s.adjustment || 0), [note, setNote] = useState('');
  return <Modal title="Adjust statement" onClose={onClose} footer={<><button className="btn" type="button" data-close onClick={onClose}>Cancel</button><button className="btn primary" id="go" type="button" onClick={() => onSend({ amount: am, note })}>Save adjustment</button></>}>
    <div className="stack"><div className="field"><label htmlFor="am">Amount (£, negative to deduct)</label><input className="input" id="am" type="number" step="0.01" min="-500" max="500" value={am} onChange={(e) => setAm(e.target.value)} /></div><div className="field"><label htmlFor="an">Reason</label><input className="input" id="an" maxLength={120} value={note} onChange={(e) => setNote(e.target.value)} /></div></div></Modal>;
}
function PayoutDialog({ s, onClose, onSend }) {
  const [o, setO] = useState('success');
  return <Modal title="Send payout" size="sm" onClose={onClose} footer={<><button className="btn" type="button" data-close onClick={onClose}>Cancel</button><button className="btn primary" id="go" type="button" onClick={() => onSend({ outcome: o })}>Send</button></>}>
    <p className="muted">Total <b>{money(s.total)}</b> to {s.researcher.name}. Choose the sandbox provider result:</p>
    <fieldset className="field" style={{ marginTop: 12 }}><div className="radio-cards"><label className="radio-card"><input type="radio" name="o" value="success" checked={o === 'success'} onChange={() => setO('success')} /><span className="t">Payout succeeds</span></label><label className="radio-card"><input type="radio" name="o" value="failed" checked={o === 'failed'} onChange={() => setO('failed')} /><span className="t">Payout fails</span></label></div></fieldset></Modal>;
}

function Detail({ s, cfg, admin, onAct, busy }) {
  const c = s.calc, max = Math.max(c.base + cfg.bonusCap, 1), bar = (v) => Math.max(2, Math.round(v / max * 100)), sq = (bg) => <span className="badge nodot" style={{ background: bg, height: 12, padding: 0, width: 12 }} />;
  return (
    <section className="card"><div className="card-head"><div><h3>{s.researcher.name} · {s.period}</h3><div className="xs muted mono">{s.id}</div></div><Badge status={s.status} /></div>
      <div className="card-body stack">
        <p className="small muted">{STATUS_NOTE[s.status]}{s.payoutRef ? ' · ref ' + s.payoutRef : ''}</p>
        <div className="stacked-bar" role="img" aria-label={'Base ' + money(c.base) + ', requests bonus ' + money(c.requestsPart) + ', feedback bonus ' + money(c.feedbackPart)}><i style={{ width: bar(c.base) + '%', background: 'var(--navy-2)' }} /><i style={{ width: bar(c.requestsPart) + '%', background: 'var(--primary)' }} /><i style={{ width: bar(c.feedbackPart) + '%', background: 'var(--teal)' }} /></div>
        <dl className="kv" style={{ gridTemplateColumns: '1fr auto', fontSize: '.875rem' }}>
          <dt>{sq('var(--navy-2)')} Agreed base</dt><dd className="mono right">{money(c.base)}</dd>
          <dt>{sq('var(--primary)')} Requests ({s.completed} of {s.target} · {Math.round(c.completedRatio * 100)}%)</dt><dd className="mono right">{money(c.requestsPart)}</dd>
          <dt>{sq('var(--teal)')} Feedback (avg {c.feedbackAvg || '-'} · {c.feedbackCount} responses)</dt><dd className="mono right">{money(c.feedbackPart)}</dd>
          {s.adjustment ? <><dt>Adjustment</dt><dd className="mono right">{money(s.adjustment)}</dd></> : null}
          <dt><b>Total</b></dt><dd className="mono right"><b style={{ fontSize: '1.125rem' }}>{money(s.total)}</b></dd></dl>
        {c.flags.length ? <div className="notice warn"><Icon name="alert-triangle" /><div><b>Flagged for review</b><ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>{c.flags.map((f) => <li key={f}>{f}</li>)}</ul>{s.exception ? <p style={{ marginTop: 6 }}><b>Approved exception:</b> {s.exception}</p> : null}</div></div> : <div className="notice ok"><Icon name="check-circle" /><span>All contribution and feedback data present - no flags.</span></div>}
        {s.status === 'payout_failed' ? <div className="notice bad"><Icon name="alert-circle" /><span>The payout failed and is <b>not</b> shown as paid. It is kept for reconciliation and can be retried by an administrator.</span></div> : null}
        {admin ? (
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            {s.status === 'draft' ? <Btn className="btn primary" busy={busy} data-act="submit" onClick={() => onAct(s, 'submit')}>Submit for approval</Btn> : null}
            {s.status === 'awaiting_approval' ? <>
              {s.calc.needsReview && !s.exception ? <button className="btn" type="button" data-act="exception" onClick={() => onAct(s, 'exception')}>Record approved exception</button> : null}
              <Btn className="btn" busy={busy} data-act="return" onClick={() => onAct(s, 'return')}>Return to draft</Btn>
              <Btn className="btn primary" busy={busy} data-act="approve" onClick={() => onAct(s, 'approve')}><Icon name="check" size="sm" /> Approve</Btn></> : null}
            {s.status === 'approved' || s.status === 'payout_failed' ? <button className="btn primary" type="button" data-act="payout" onClick={() => onAct(s, 'payout')}><Icon name="banknote" size="sm" /> {s.status === 'approved' ? 'Send payout' : 'Retry payout'}</button> : null}
            {s.status !== 'paid' ? <button className="btn" type="button" data-act="adjust" onClick={() => onAct(s, 'adjust')}>Adjust</button> : null}
          </div>
        ) : null}
        {s.history.length ? <details><summary className="small muted" style={{ cursor: 'pointer' }}>Status history</summary><ul className="timeline" style={{ marginTop: 10 }}>{s.history.map((h, i) => <li key={i} className="done"><Badge status={h.status} /><time>{new Date(h.ts).toLocaleString('en-GB')}</time></li>)}</ul></details> : null}
      </div></section>
  );
}

export default function Compensation() {
  const me = useSession(), admin = me.role === 'admin', q = useLoad(() => api.listStatements(), []), [sel, setSel] = useState(null), [period, setPeriod] = useState('all'), [dlg, setDlg] = useState(null), [busy, run] = useAction();
  useEffect(() => { document.title = 'Compensation - RCMP'; }, []);
  const data = q.data;
  useEffect(() => { if (data && !sel && data.items.length) setSel(data.items[0].id); }, [data]); // eslint-disable-line
  let body;
  if (q.error) body = <Empty icon="alert-circle" title="Could not load statements" text={q.error.message} />;
  else if (!data) body = <Skeleton n={1} h={220} />;
  else {
    const cfg = data.config, periods = [...new Set(data.items.map((x) => x.period))], items = data.items.filter((x) => period === 'all' || x.period === period);
    const s = data.items.find((x) => x.id === sel) || items[0], total = items.reduce((a, x) => a + x.total, 0), paid = items.filter((x) => x.status === 'paid').reduce((a, x) => a + x.total, 0);
    const doAct = (st, a, payload) => run(async () => {
      try { await api.actOnStatement(st.id, a, payload); const failed = a === 'payout' && payload && payload.outcome === 'failed'; toast(a === 'payout' ? (failed ? 'Provider reported a failure - the statement is NOT marked paid.' : 'Payout confirmed by the provider.') : DONE[a], failed ? 'warn' : 'ok'); } catch (e) { fail(e); }
      await q.reload();
    });
    const onAct = async (st, a) => {
      if (a === 'exception' || a === 'adjust' || a === 'payout') return setDlg({ a, st });
      if (a === 'approve' && !(await confirmDialog({ title: 'Approve this statement?', message: st.researcher.name + ' · ' + st.period + ' · ' + money(st.total) + '. Approval is logged and the researcher is notified.', confirm: 'Approve' }))) return;
      doAct(st, a);
    };
    body = (
      <>
        <div className="grid g4 mb">
          <div className="card kpi"><div><div className="k">Statements</div><div className="v num">{items.length}</div><div className="s">{periods.length} period{periods.length === 1 ? '' : 's'}</div></div><div className="ic"><Icon name="file-text" /></div></div>
          <div className="card kpi"><div><div className="k">Total (incl. bonus)</div><div className="v num">{money(total)}</div><div className="s">calculated</div></div><div className="ic slate"><Icon name="banknote" /></div></div>
          <div className="card kpi teal"><div><div className="k">Paid</div><div className="v num">{money(paid)}</div><div className="s">provider confirmed</div></div><div className="ic teal"><Icon name="check-circle" /></div></div>
          <div className="card kpi"><div><div className="k">Needs attention</div><div className="v num">{items.filter((x) => x.calc.needsReview || x.status === 'payout_failed').length}</div><div className="s">flagged or failed</div></div><div className="ic amber"><Icon name="alert-triangle" /></div></div>
        </div>
        <div className="row mb"><Segmented id="seg" label="Period" value={period} onChange={(p) => { setPeriod(p); setSel(null); }} options={[['all', 'All periods'], ...periods.map((p) => [p, p])]} /></div>
        <div className="grid split">
          <section className="card"><div className="card-head"><h3><Icon name="banknote" /> Statements</h3></div>
            <div className="table-wrap" tabIndex={0} style={{ border: 0, borderRadius: 0 }}><table className="table" aria-label="Compensation statements"><thead><tr>{admin ? <th>Researcher</th> : null}<th>Period</th><th className="r">Base</th><th className="r">Bonus</th><th className="r">Total</th><th>Status</th></tr></thead>
              <tbody>{items.map((x) => (
                <tr key={x.id} className={x.id === (s && s.id) ? 'sel' : ''} data-row={x.id} tabIndex={0} style={{ cursor: 'pointer' }} aria-label={'Statement ' + x.id} onClick={() => setSel(x.id)} onKeyDown={(e) => { if (e.key === 'Enter') setSel(x.id); }}>
                  {admin ? <td><div className="row nowrap"><Avatar user={x.researcher} cls="sm" /><b>{x.researcher.name}</b></div></td> : null}
                  <td className="mono" style={{ whiteSpace: 'nowrap' }}>{x.period}</td><td className="r mono">{money(x.calc.base)}</td><td className="r mono">{x.calc.bonus ? money(x.calc.bonus) : '-'}</td><td className="r mono"><b>{money(x.total)}</b></td>
                  <td><Badge status={x.status} />{x.calc.needsReview ? <> <Icon name="alert-triangle" size="sm" /></> : null}</td></tr>))}</tbody></table></div></section>
          <aside id="detail" className="stack lg">{s ? <Detail s={s} cfg={cfg} admin={admin} onAct={onAct} busy={busy} /> : null}</aside>
        </div>
        <section className="card mt-lg" style={{ marginTop: 24 }}><div className="card-body stack"><h3><Icon name="scale" size="sm" /> How the bonus is calculated</h3>
          <div className="formula">bonus = <b>{money(cfg.bonusCap)}</b> × ( <b>{cfg.weightRequests * 100}%</b> × min(completed ÷ target, 1) + <b>{cfg.weightFeedback * 100}%</b> × (avg feedback ÷ 5) )<br />total = agreed base + bonus + adjustments<br />bonus = 0 and the statement is flagged if fewer than <b>{cfg.minFeedback}</b> feedback responses or the researcher was inactive.</div>
          <p className="small muted">Weights (70% requests / 30% feedback) follow FR-053. Caps and minimums are proposals pending stakeholder validation. Researchers receive base compensation under their engagement agreement; students never pay researchers directly (FR-048).</p></div></section>
        {dlg && dlg.a === 'exception' ? <NoteDialog title="Record approved exception" label="Reason" hint="(kept in the audit trail)" okLabel="Record" onClose={() => setDlg(null)} onSend={(note) => { setDlg(null); doAct(dlg.st, 'exception', { note }); }} /> : null}
        {dlg && dlg.a === 'adjust' ? <AdjustDialog s={dlg.st} onClose={() => setDlg(null)} onSend={(p) => { setDlg(null); doAct(dlg.st, 'adjust', p); }} /> : null}
        {dlg && dlg.a === 'payout' ? <PayoutDialog s={dlg.st} onClose={() => setDlg(null)} onSend={(p) => { setDlg(null); doAct(dlg.st, 'payout', p); }} /> : null}
      </>
    );
  }
  return (
    <div className="content">
      <PageHead eyebrow="Compensation" title="Compensation" sub={admin ? 'Review calculated statements, resolve flags, approve and trigger payouts. Every action is written to the audit trail.' : 'Your statements: agreed base, performance bonus and payout status. Students never pay you directly - compensation comes from the platform.'} />
      <div id="body">{body}</div>
    </div>
  );
}
