import { useEffect } from 'react';
import Icon from '../components/Icon.jsx';

const ROWS = [
  ['Name, email, role, password hash', 'Create and secure your account (FR-001, FR-002)', 'You; email is never shown to others'],
  ['Profile: interests, skills, experience, availability, links', 'Let collaborators judge whether you match (FR-003, FR-004)', 'As you set per field: everyone, team members only, or only you'],
  ['Project briefs and agreements', 'Recruit and coordinate collaborators (FR-007-011, FR-023-026)', 'As the owner sets; agreements only to members'],
  ['Tasks, milestones, files', 'Run the private workspace (FR-027-032)', 'Authorised project members only'],
  ['Requests, notifications, reports', 'Show request status, notify you, handle abuse (FR-014-017, FR-033-038)', 'The people involved; administrators for reports'],
  ['Subscription status and payment provider reference', 'Apply plan allowances (FR-045-047)', <>You and billing administrators. <strong>Card details are never stored by RCMP.</strong></>],
  ['Researcher compensation records', 'Calculate and audit payouts (FR-052-056)', 'The researcher and administrators']
];
const List = ({ items }) => <ul className="stack sm" style={{ margin: 0, paddingLeft: 20, color: 'var(--text-2)' }}>{items.map((t, i) => <li key={i}>{t}</li>)}</ul>;

export default function Privacy() {
  useEffect(() => { document.title = 'Privacy notice - RCMP'; }, []);
  return (
    <div className="content" style={{ maxWidth: 920, margin: '0 auto' }}>
      <div className="page-head"><div><div className="eyebrow">Your data</div><h1>Privacy notice</h1><p>What RCMP collects, why, who can see it, and how you can review, export or delete it. Last updated 7 November 2026.</p></div></div>
      <div className="notice mb"><Icon name="info" /><div><strong>Your session.</strong> Your sign-in token is kept in this browser only and is removed when you sign out. Please do not share your password or reset links with anyone.</div></div>
      <section className="card mb" aria-labelledby="h1"><div className="card-head"><h3 id="h1"><Icon name="database" /> Data we collect and why</h3></div>
        <div className="table-wrap" tabIndex={0} style={{ border: 0, borderRadius: 0 }}><table className="table">
          <thead><tr><th>Data</th><th>Purpose</th><th>Who can see it</th></tr></thead>
          <tbody>{ROWS.map((r) => <tr key={r[0]}><td>{r[0]}</td><td>{r[1]}</td><td>{r[2]}</td></tr>)}</tbody>
        </table></div></section>
      <section className="card mb" id="retention" aria-labelledby="h2"><div className="card-body stack">
        <h3 id="h2"><Icon name="history" size="sm" /> Retention, review and deletion</h3>
        <List items={[<>You can review and update your profile at any time from <b>My profile</b>.</>, <>You can export your data and delete your account from <b>My profile &rarr; Data &amp; privacy</b>.</>, 'Planned behaviour: account data is removed from active systems within 30 days of deletion; backups are overwritten within 90 days (NFR-006 test scenario).', 'Administrator actions on sensitive records are kept in an audit trail (FR-038).']} />
      </div></section>
      <section className="card mb" aria-labelledby="h3"><div className="card-body stack">
        <h3 id="h3"><Icon name="shield-check" size="sm" /> Security measures</h3>
        <List items={['Passwords are salted and hashed with bcrypt; they are never logged (NFR-002, NFR-016).', 'Traffic uses HTTPS/TLS; inputs are validated and output is escaped to guard against injection and cross-site scripting (NFR-003, NFR-004).', 'Permissions are enforced on the server for every request, so hidden profile fields and private files are never returned to unauthorised users (NFR-001).']} />
      </div></section>
      <section className="card" aria-labelledby="h4"><div className="card-body stack">
        <h3 id="h4"><Icon name="alert-triangle" size="sm" /> Important limits</h3>
        <p className="muted">Mentorship on RCMP is not official supervision. Team agreements record expectations only; they do not replace institutional rules, research governance, ethics approval or authorship policies. RCMP cannot guarantee compatibility, publication or mentor quality.</p>
      </div></section>
    </div>
  );
}
