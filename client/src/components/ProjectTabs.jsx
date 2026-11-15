import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';

/** Overview / Workspace / Team agreement links shown to project members. */
export default function ProjectTabs({ id, current }) {
  const t = [['project', 'file-text', 'Overview'], ['workspace', 'kanban', 'Workspace'], ['agreement', 'clipboard-check', 'Team agreement']];
  return <div className="tabs">{t.map(([k, ic, l]) => <Link key={k} className="tab" aria-current={current === k ? 'page' : undefined} to={'/' + k + '?id=' + id}><Icon name={ic} size="sm" /> {l}</Link>)}</div>;
}
