import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Icon from '../components/Icon.jsx';

export default function ContactThanks() {
  const loc = useLocation(), ref = (loc.state && loc.state.ref) || '';
  useEffect(() => { document.title = 'Thank you - RCMP'; }, []);
  const ok = /^MSG-\d+$/.test(ref || '');
  return (
    <section className="thanks"><div className="in">
      <div className="ok-mark xl" aria-hidden="true"><Icon name="check" size="lg" /></div>
      <h1>Thank you for contacting us</h1>
      <p className="lead">We have received your message and a member of the RCMP team will reach out to you within <b>2 to 3 business days</b>.</p>
      {ok ? <p className="ref" id="refline">Your reference number is <b className="mono" id="ref">{ref}</b>. Please quote it if you contact us again.</p> : null}
      <ol className="next-steps">
        <li><span>1</span><div><b>We read your message</b><p>It goes to the platform administrators, who pick it up in the order it arrived.</p></div></li>
        <li><span>2</span><div><b>We look into it</b><p>If it is about your account, a plan or something that is not working, we check it before replying.</p></div></li>
        <li><span>3</span><div><b>We reply to you</b><p>We answer at the email address you gave us, within 2 to 3 business days.</p></div></li>
      </ol>
      <div className="row center-row"><Link className="btn primary lg" to="/">Back to home</Link><Link className="btn lg" to="/pricing">See plans</Link><Link className="btn lg" to="/contact">Send another message</Link></div>
    </div></section>
  );
}
