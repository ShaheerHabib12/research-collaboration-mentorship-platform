import { Link } from 'react-router-dom';

const ITEMS = [
  ['rcmp.session.v1 (localStorage)', 'Keeps you signed in. Holds a signed token and your public profile. Removed when you sign out; the token expires after 8 hours.', 'Strictly necessary', 'Until sign-out or expiry'],
  ['rcmp.counts.v1 (localStorage)', 'Remembers the small counters shown in the sidebar so they appear at once.', 'Strictly necessary', 'Until sign-out'],
  ['rcmp.sim.v1 (localStorage)', 'Demo tools only: stores the test settings you switch on. Absent in production.', 'Development only', 'Until you reset the demo'],
  ['rcmp-theme (localStorage)', 'Remembers whether you chose the light or dark theme.', 'Preference you set', 'Until you clear browser data'],
  ['rcmp.scout.* and project draft (sessionStorage)', 'Scout chat and an unsaved project draft survive a reload so typed work is not lost.', 'Strictly necessary', 'Until you close the tab']
];

export default function Cookies() {
  return (
    <div className="content" style={{ maxWidth: 920, margin: '0 auto' }}>
      <div className="page-head"><div><div className="eyebrow">Legal</div><h1>Cookies and browser storage</h1><p>Last updated 14 November 2026.</p></div></div>
      <div className="notice mb"><div><strong>RCMP sets no tracking or advertising cookies and uses no analytics.</strong> Because we only keep items that make the service work or that you chose yourself, we show no cookie banner. If that changes, we will ask for your consent first.</div></div>
      <section className="card mb" aria-labelledby="c1"><div className="card-head"><h3 id="c1">What is kept in your browser</h3></div>
        <div className="table-wrap" tabIndex={0} style={{ border: 0, borderRadius: 0 }}><table className="table">
          <thead><tr><th>Item</th><th>What it does</th><th>Type</th><th>Lifetime</th></tr></thead>
          <tbody>{ITEMS.map((r) => <tr key={r[0]}><td>{r[0]}</td><td>{r[1]}</td><td>{r[2]}</td><td>{r[3]}</td></tr>)}</tbody>
        </table></div></section>
      <section className="card mb" aria-labelledby="c2"><div className="card-head"><h3 id="c2">Third parties</h3></div><div className="card-body"><p style={{ margin: 0 }}>The pages load two typefaces (Inter and Plus Jakarta Sans) from Google Fonts. Your browser sends your IP address to Google to fetch them. RCMP embeds no videos, maps, social buttons or advertising scripts.</p></div></section>
      <section className="card mb" aria-labelledby="c3"><div className="card-head"><h3 id="c3">Your choices</h3></div><div className="card-body"><p style={{ margin: 0 }}>You can delete these items at any time in your browser settings. Doing so signs you out and resets the theme. More about personal data is in the <Link to="/privacy">privacy notice</Link>.</p></div></section>
    </div>
  );
}
