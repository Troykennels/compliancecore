import { Link } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { hasPermission } from '@/config/role-permissions';

export function CiDemoGuide() {
  const role = useAuthStore(s => s.activeTenant?.role);
  const link = (to: string, label: string, scope: string) => hasPermission(role, scope)
    ? <Link to={to} className="underline">{label}</Link>
    : <span>{label}</span>;
  return (
    <details className="border-b border-indigo-100 bg-indigo-50 px-4 py-3 text-xs text-indigo-950 sm:px-5">
      <summary className="cursor-pointer font-semibold">Demonstration workspace — explore the compliance workflow</summary>
      <p className="mt-2 max-w-4xl leading-relaxed">Start with stakeholder scope, review the duties that apply, then assess risks and collect proof. This fictional workspace includes a completed corrective-action example and work still awaiting review. Its wider framework assessments remain in progress. Sample records and non-payable invoices do not describe C&amp;I’s actual compliance position.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {[
          ['1. Agree scope and duties', 'Open an assessment to read the stakeholder answers. Review source-backed duties separately; undecided legal applicability stays pending.', '/frameworks?workflow=obligations', 'Start with scope and duties', 'frameworks:read'],
          ['2. Assess the risks', 'Explore the asset-based worksheet, scoring reasons, treatment owners and independent remaining-risk reviews. Download the real Excel workbook.', '/risks', 'Open the risk assessment', 'risks:read'],
          ['3. Explain the rules', 'Use a tailored policy or an editable template. A separate person approves publication; readers acknowledge the exact published version.', '/policies?workflow=acknowledgments', 'Read policies and acknowledgements', 'policies:read'],
          ['4. Test the safeguards', 'Compare the passing and failed sample tests, their evidence versions and independent review. A status alone does not prove effectiveness.', '/controls?workflow=tests', 'Inspect the control tests', 'controls:read'],
          ['5. Verify the correction', 'Follow the completed access-review correction and the marine follow-up awaiting verification. Check the root cause, proof and reviewer.', '/tasks?workflow=actions', 'Follow the corrective actions', 'tasks:read'],
          ['6. See the whole picture', 'Review the targeted audit, wider open findings, upcoming dates and management view. An internal score is not certification.', '/reports', 'Open the management view', 'reports:read'],
        ].filter(([, , , , scope]) => hasPermission(role, scope)).map(([title, description, to, action]) => (
          <div key={title} className="rounded-lg border border-indigo-100 bg-white p-3">
            <p className="font-semibold">{title}</p><p className="my-2 leading-relaxed">{description}</p>
            <Link className="font-medium text-indigo-700 underline underline-offset-2" to={to}>{action}</Link>
          </div>
        ))}
      </div>
      <p className="mt-3">{link('/policy-templates', 'Explore editable policies and working forms', 'policies:read')}, or <Link to="/guide" className="font-semibold underline">open the plain-language user guide</Link>.</p>
      <p className="mt-3 leading-relaxed">Applicability follows scope, duties, risks and treatment. ISO 27001 uses a later Statement of Applicability; other frameworks use their appropriate coverage record. Explore {link('/vendors?workflow=vendors', 'supplier due diligence', 'vendors:read')}, {link('/training?workflow=training', 'verified training', 'training:read')}, {link('/incidents?workflow=incidents', 'incident decisions', 'incidents:read')} and {link('/calendar', 'review dates', 'calendar:read')}. External example automations are disabled; no vehicles, vessels, payroll or tracking devices are connected.</p>
    </details>
  );
}
