import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { C } from '../lib/shared.js';
import { useSession } from '../hooks/useSession.js';

const gbp = (n) => (n === 0 ? 'Free' : '£' + n.toFixed(2));
const FAQ = [
  ['What counts as a request?', 'A request is one researcher-support request (for example a methodology or statistics question) or one mentorship request. Each plan includes a monthly allowance. Requests that are declined or withdrawn before work starts are returned to your allowance.'],
  ['What happens when I use my allowance?', 'You can keep collaborating, browsing and managing projects. To send another support request you can upgrade your plan or wait for the next period.'],
  ['Can I cancel?', 'Yes, from the Subscription page. Cancellation takes effect at the end of the current period, so you keep what you paid for.'],
  ['How do researchers get paid?', 'Researchers receive a base payment plus a bonus calculated from completed requests (70%) and student feedback (30%), capped each period. Students never pay researchers directly.'],
  ['Is my payment information safe?', 'Card details are never stored on RCMP. Only the provider reference and the payment status are kept.']
];
export default function Pricing() {
  const me = useSession();
  useEffect(() => { document.title = 'Plans and pricing - RCMP'; }, []);
  return (
    <>
      <section className="page-hero"><div className="in">
        <div className="eyebrow"><span className="badge info">Plans &amp; pricing</span></div>
        <h1>Start free. Add expert help when you need it.</h1>
        <p className="lead">Collaboration tools are free for every student. A monthly plan adds an allowance of researcher-support and mentorship requests for the moments you get stuck.</p>
      </div></section>
      <section className="section" aria-label="Plans"><div className="in">
        <div className="plan-grid tilt-group" id="plans">
          {C.PLANS.map((p) => (
            <article key={p.id} className={'plan tilt' + (p.featured ? ' featured' : '')}>
              {p.featured ? <span className="plan-flag">Most popular</span> : null}
              <h3>{p.name}</h3><p className="plan-tag">{p.tagline}</p>
              <div className="plan-price"><b>{gbp(p.price)}</b>{p.price ? <span>/ month</span> : null}</div>
              <div className="plan-allow">{p.allowance ? p.allowance + ' requests per month' : 'No request allowance'}</div>
              <ul>{p.features.map((f) => <li key={f}><Icon name="check" size="sm" /><span>{f}</span></li>)}</ul>
              {me
                ? <Link className={'btn block' + (p.featured ? ' primary' : '')} to="/subscription">{p.price ? 'Choose in your account' : 'Included with your account'}</Link>
                : <Link className={'btn block' + (p.featured ? ' primary' : '')} to={'/register?plan=' + p.id}>{p.price ? 'Get ' + p.name : 'Start free'}</Link>}
            </article>
          ))}
        </div>
        <p className="hint center" style={{ marginTop: 20 }}>Prices in GBP per month. Cancel at any time: your plan stays active until the end of the period you have paid for. We never store card details.</p>
      </div></section>
      <section className="section alt" aria-labelledby="h-faq"><div className="in narrow">
        <div className="section-head"><h2 id="h-faq">Questions about plans</h2></div>
        <div className="faq">{FAQ.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}</div>
        <p className="center" style={{ marginTop: 24 }}>Still unsure? <Link to="/contact">Ask us a question</Link>.</p>
      </div></section>
    </>
  );
}
