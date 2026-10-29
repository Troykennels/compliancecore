import { NavLink } from 'react-router-dom';
import { PATHS } from '@/routes/paths';

const TABS: Array<[string, string]> = [[PATHS.REPORTS, 'Overview'], [PATHS.COMPLIANCE_SCORE, 'Compliance score'], [PATHS.ANALYTICS, 'Analytics']];

/** Reports is one menu item; its three views are tabs. */
export function ReportTabs(): JSX.Element {
  return (
    <nav aria-label="Report views" className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1.5">
      {TABS.map(([to, label]) => (
        <NavLink key={to} to={to} end className={({ isActive }) => `rounded-lg px-3.5 py-2 text-sm font-semibold ${isActive ? 'bg-brand-600 text-white' : 'text-slate-700 hover:bg-brand-50'}`}>{label}</NavLink>
      ))}
    </nav>
  );
}
