import { Link } from 'react-router-dom';

export function CiDemoGuide() {
  return (
    <details className="border-b border-indigo-100 bg-indigo-50 px-4 py-3 text-xs text-indigo-950 sm:px-5">
      <summary className="cursor-pointer font-semibold">C&I Leasing Plc presentation — explore the daily workflows</summary>
      <p className="mt-2 max-w-4xl leading-relaxed">Fictional scenarios prepared by Orion Soft Limited. These examples describe how the platform could support your teams; the sample scores, incidents, suppliers and certificates do not describe C&I’s actual compliance position. Sample invoices are non-payable.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Fleet Management', 'Check document renewals, driver readiness and dispatch review evidence.', '/expiry', 'Review sample renewals'],
          ['Marine Services', 'Review contractor evidence, assign follow-up and record approval.', '/vendors', 'Explore contractor assurance'],
          ['Personnel Outsourcing', 'Track privacy briefings and accountable reviews of personnel-data controls.', '/training', 'Review sample learning'],
          ['Citracks / Telematics', 'Record access reviews, simulated incident decisions and closure evidence.', '/incidents', 'Open the tabletop example'],
        ].map(([title, description, to, action]) => (
          <div key={title} className="rounded-lg border border-indigo-100 bg-white p-3">
            <p className="font-semibold">{title}</p><p className="my-2 leading-relaxed">{description}</p>
            <Link className="font-medium text-indigo-700 underline underline-offset-2" to={to}>{action}</Link>
          </div>
        ))}
      </div>
      <p className="mt-3 leading-relaxed">Suggested tour: <Link to="/expiry" className="underline">renewals</Link> → <Link to="/tasks" className="underline">owner actions</Link> → <Link to="/evidence" className="underline">evidence</Link> → <Link to="/approvals" className="underline">review decision</Link> → <Link to="/reports" className="underline">management report</Link>. Example automations are disabled; this demo does not connect to vehicles, vessels, payroll or tracking devices.</p>
    </details>
  );
}
