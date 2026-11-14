import { Link } from 'react-router-dom';

const SECTIONS = [
  ['About RCMP', <>RCMP is a teaching project built by Team 02 for the module M35376 Software Engineering Theory and Practice at the University of Portsmouth. It is a working prototype, not a commercial service. By creating an account you agree to these terms. If you do not agree, please do not register.</>],
  ['Your account', <>Give true information and keep your password private. You are responsible for what happens under your account. Tell us through the <Link to="/contact">contact page</Link> if you think someone else has used it. Administrators may suspend an account that breaks these terms.</>],
  ['Acceptable use', <>Use RCMP to find collaborators, run research projects and ask for mentorship. Do not upload anything unlawful, harmful or that you do not have the right to share. Do not try to break, overload or probe the service, or to read other people&apos;s data. Reports of abuse are reviewed by administrators.</>],
  ['Your content', <>You keep ownership of what you post. You allow RCMP to store it and show it to the people you chose, so the service can work. Team agreements are between the team members. RCMP does not judge authorship disputes.</>],
  ['Plans, payments and refunds', <>The Explorer plan is free. Scholar Basic, Plus and Pro show how paid plans would work. <strong>In this build, payments and payouts are simulated: no card is charged and no money moves.</strong> Because nothing is charged, there is nothing to refund. If RCMP ever takes real payments, this section will be replaced before that starts, with the refund rules in force for your country, and you will be asked to accept the change.</>],
  ['Mentorship and support', <>Mentors and researchers give guidance in good faith. It is not professional, legal or medical advice. Allowances reset each period as shown on the <Link to="/subscription">Subscription</Link> page.</>],
  ['Availability', <>The service is provided as it is. We try to keep it running and backed up, but we do not promise it will always be available or free of errors.</>],
  ['Liability', <>To the extent the law allows, the project team is not liable for loss that comes from using this prototype. Nothing here limits rights that cannot be limited by law.</>],
  ['Changes and contact', <>We may update these terms and will change the date below when we do. Questions: use the <Link to="/contact">contact page</Link>. How we handle personal data is in the <Link to="/privacy">privacy notice</Link>, and browser storage is in the <Link to="/cookies">cookies page</Link>.</>]
];

export default function Terms() {
  return (
    <div className="content" style={{ maxWidth: 820, margin: '0 auto' }}>
      <div className="page-head"><div><div className="eyebrow">Legal</div><h1>Terms of use</h1><p>Last updated 14 November 2026.</p></div></div>
      {SECTIONS.map((s, i) => <section className="card mb" key={s[0]} aria-labelledby={'t' + i}><div className="card-head"><h3 id={'t' + i}>{i + 1}. {s[0]}</h3></div><div className="card-body"><p style={{ margin: 0 }}>{s[1]}</p></div></section>)}
    </div>
  );
}
