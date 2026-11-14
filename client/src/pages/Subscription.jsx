import { useEffect, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { Modal, confirmDialog } from '../components/Modal.jsx';
import { Badge, Btn, Empty, PageHead, Skeleton } from '../components/ui.jsx';
import { fail, toast } from '../components/toast.jsx';
import { useAction, useLoad } from '../hooks/useLoad.js';
import { api, fmtDate, money } from '../lib/api.js';

function Checkout({ plan, d, onClose, onDone }) {
  const [out, setOut] = useState('success'), [busy, run] = useAction(), down = plan.allowance < d.plan.allowance, over = d.usage.used > plan.allowance;
  const pay = () => run(async () => {
    try {
      const r = await api.subscribe(plan.id, plan.price ? out : 'success'); onClose();
      if (r.status === 'succeeded') toast('You are now on ' + plan.name + '. Your entitlements were updated.', 'ok', 'Subscription active');
      else if (r.status === 'pending') toast('Payment is pending. Nothing changes until it is confirmed.', 'warn', 'Pending');
      else toast('The provider declined the payment. No plan change was made and no entitlement was granted.', 'bad', 'Payment failed');
      onDone();
    } catch (e) { if (e.status === 409) onClose(); fail(e); }
  });
  return (
    <Modal title={plan.price ? 'Confirm ' + plan.name : 'Switch to Explorer'} onClose={onClose}
      footer={<><button className="btn" type="button" data-close onClick={onClose}>Cancel</button><Btn className="btn primary" id="pay" busy={busy} busyText="Contacting provider..." onClick={pay}>{plan.price ? 'Continue to provider' : 'Switch plan'}</Btn></>}>
      <div className="stack">
        <dl className="kv" style={{ gridTemplateColumns: '140px 1fr' }}><dt>Plan</dt><dd><b>{plan.name}</b></dd><dt>Price</dt><dd>{plan.price ? money(plan.price) + ' per month' : 'Free'}</dd><dt>Billing period</dt><dd>Monthly, renews automatically</dd><dt>Allowance</dt><dd>{plan.allowance} requests / month</dd></dl>
        {over ? <div className="notice warn"><Icon name="alert-triangle" /><span>You have already used <b>{d.usage.used}</b> requests this period, which is more than {plan.name} includes. Extra requests will be <b>blocked</b> until renewal.</span></div>
          : down ? <div className="notice"><Icon name="info" /><span>This plan has a lower allowance. Your usage this period is kept.</span></div> : null}
        {plan.price ? <>
          <div className="notice"><Icon name="shield-check" /><span>You will pay on the approved provider's secure page. RCMP stores only a reference and the payment status - never card details.</span></div>
          <fieldset className="field"><legend>Sandbox provider result <span className="muted" style={{ fontWeight: 400 }}>(demo only)</span></legend>
            <div className="radio-cards">{[['success', 'check-circle', 'Payment succeeds'], ['failed', 'alert-circle', 'Payment fails'], ['pending', 'clock', 'Pending']].map(([v, ic, t]) => <label className="radio-card" key={v}><input type="radio" name="out" value={v} checked={out === v} onChange={() => setOut(v)} /><span className="t"><Icon name={ic} /> {t}</span></label>)}</div></fieldset></> : null}
      </div>
    </Modal>
  );
}

export default function Subscription() {
  const q = useLoad(() => api.getSubscription(), []), [plan, setPlan] = useState(null), [busy, run] = useAction();
  useEffect(() => { document.title = 'Subscription - RCMP'; }, []);
  const d = q.data;
  let body;
  if (q.error) body = <Empty icon="alert-circle" title="Could not load your subscription" text={q.error.message} />;
  else if (!d) body = <Skeleton n={1} h={240} />;
  else {
    const u = d.usage, sub = d.subscription, pct = u.allowance ? Math.min(100, Math.round(u.used / u.allowance * 100)) : 100, pend = d.billing.find((b) => b.status === 'pending');
    body = (
      <>
        {pend ? <div className="notice warn mb"><Icon name="clock" /><div className="row between grow"><span><b>A payment is pending</b> ({pend.ref}). Your plan changes only when the provider confirms it.</span><Btn className="btn sm" id="settle" busy={busy} onClick={() => run(async () => { try { await api.settlePending(pend.id); toast('The provider confirmed the payment. Your plan is now active.', 'ok', 'Payment confirmed'); } catch (e) { fail(e); } await q.reload(); })}>Check payment status</Btn></div></div> : null}
        <div className="grid split mb">
          <section className="card card-pad stack"><div className="row between"><div><div className="eyebrow" style={{ margin: 0 }}>Current plan</div><h2>{d.plan.name}</h2></div>{sub && sub.status === 'active' ? <Badge status="active" label={sub.cancelAtEnd ? 'Ends ' + fmtDate(sub.periodEnd) : 'Active'} /> : <Badge status="none" label="Free" />}</div>
            <div className="row between small"><span>{u.used} of {u.allowance} requests used this period</span><b className="num">{u.remaining} remaining</b></div>
            <div className={'progress ' + (u.blocked ? 'bad' : pct > 66 ? 'amber' : 'teal')} role="progressbar" aria-valuenow={pct} aria-valuemin="0" aria-valuemax="100" aria-label="Allowance used"><i style={{ width: pct + '%' }} /></div>
            {u.blocked ? <div className="notice warn"><Icon name="lock" /><span>{u.allowance === 0 ? 'Your plan has no support allowance. Choose a plan below.' : 'Allowance used up. New support and mentorship requests are blocked until renewal or an upgrade.'}</span></div> : null}
            {sub && sub.status === 'active' ? <>
              <dl className="kv"><dt>Billing period</dt><dd>{fmtDate(sub.periodStart)} – {fmtDate(sub.periodEnd)}</dd><dt>Renews</dt><dd>{sub.cancelAtEnd ? 'No - cancels at period end' : fmtDate(sub.periodEnd)}</dd></dl>
              {!sub.cancelAtEnd && d.plan.price ? <div><button className="btn danger" id="cancel" type="button" onClick={async () => { if (await confirmDialog({ title: 'Cancel your subscription?', message: 'You keep your allowance until ' + fmtDate(sub.periodEnd) + ', then move to Explorer.', confirm: 'Cancel subscription', danger: true })) { try { await api.cancelSubscription(); toast('Cancellation recorded.', 'ok'); q.reload(); } catch (e) { fail(e); } } }}>Cancel at period end</button></div> : null}</> : null}</section>
          <section className="card card-pad stack"><h3>What counts toward your allowance</h3><ul className="stack sm small" style={{ margin: 0, paddingLeft: 18, color: 'var(--text-2)' }}><li>Each researcher-support request and each mentorship request uses one.</li><li>Declined, rejected or withdrawn requests return theirs.</li><li>Changing plan keeps this period's usage - if you have already used more than the new plan allows, extra requests are blocked and the reason is shown.</li></ul></section>
        </div>
        <h2 style={{ fontSize: '1.25rem', marginBottom: 16 }}>Plans</h2>
        <div className="grid g4">{d.plans.map((p) => { const cur = p.id === d.plan.id; return (
          <article key={p.id} className={'card plan ' + (p.featured ? 'featured' : '')}>{p.featured ? <span className="badge published ribbon">Most popular</span> : null}
            <div><h3>{p.name}</h3><p className="small muted" style={{ marginTop: 4, minHeight: 40 }}>{p.tagline}</p></div>
            <div className="price">{p.price ? money(p.price) : 'Free'}{p.price ? <small> / month</small> : null}</div>
            <div className="mono small" style={{ color: 'var(--teal-strong)' }}>{p.allowance} request{p.allowance === 1 ? '' : 's'} / month</div>
            <ul>{p.features.map((f) => <li key={f}><Icon name="check" size="sm" /><span>{f}</span></li>)}</ul>
            <div style={{ marginTop: 'auto' }}>{cur ? <button className="btn block" disabled>Current plan</button> : <button className={'btn block' + (p.featured ? ' primary' : '')} type="button" data-plan={p.id} onClick={() => setPlan(p)}>{p.price ? 'Choose ' + p.name : 'Switch to Explorer'}</button>}</div></article>); })}</div>
        <section className="card mt-lg" style={{ marginTop: 32 }}><div className="card-head"><h3><Icon name="history" /> Billing events</h3></div>
          {d.billing.length ? <div className="table-wrap" tabIndex={0} style={{ border: 0, borderRadius: 0 }}><table className="table"><thead><tr><th>Date</th><th>Event</th><th>Plan</th><th className="r">Amount</th><th>Status</th><th>Provider ref</th></tr></thead><tbody>{d.billing.map((b) => { const pl = d.plans.find((x) => x.id === b.planId); return <tr key={b.id}><td>{fmtDate(b.ts)}</td><td>{b.type.replace('_', ' ')}</td><td>{pl ? pl.name : b.planId}</td><td className="r mono">{money(b.amount)}</td><td><Badge status={b.status} /></td><td className="mono">{b.ref}</td></tr>; })}</tbody></table></div> : <Empty icon="credit-card" title="No billing events yet" />}</section>
      </>
    );
  }
  return (
    <div className="content">
      <PageHead eyebrow="Plans and billing" title="Subscription & entitlements" sub="Choose the plan that fits the support you need. Collaboration features are free; plans add researcher support and mentorship requests." />
      <div className="notice warn mb"><Icon name="info" /><div><strong>Illustrative pricing.</strong> Plan prices and allowances are proposals pending stakeholder validation (Table 14 of the specification). Payments are handled by an approved external provider - RCMP never sees or stores card details.</div></div>
      <div id="body">{body}</div>
      {plan && d ? <Checkout plan={plan} d={d} onClose={() => setPlan(null)} onDone={q.reload} /> : null}
    </div>
  );
}
