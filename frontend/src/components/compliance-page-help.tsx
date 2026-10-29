import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BookOpen, HelpCircle, X } from 'lucide-react';
type Help={purpose:string;steps:string[];next:Array<[string,string]>};
const help:Record<string,Help>={
 '/controls':{purpose:'Controls are the checks and safeguards that support your obligations. Record who performs each one, how it works and the proof that it was checked.',steps:['Select the relevant framework and responsible person.','Describe the current safeguard and attach evidence.','Record the check result and follow up any failures.'],next:[['Assess risks','/risks'],['Supporting evidence','/evidence'],['Corrective actions','/tasks']]},
 '/policies':{purpose:'Policies explain the organisation’s rules. Start from a template or a draft, tailor it, obtain independent approval and keep the published version current.',steps:['Choose a template and replace every placeholder.','Assign an owner, link the relevant framework and set the review date.','Submit for review; a different authorised person approves before publication.'],next:[['Policy templates','/policy-templates'],['Compliance assessment','/frameworks']]},
 '/evidence':{purpose:'Evidence is the record that supports a compliance claim: for example an approved policy, completed review, report or test result.',steps:['Upload the actual file with a meaningful title.','Link it to the control or record it supports.','Check the uploaded file opens and review its version, access and retention.'],next:[['Controls and checks','/controls'],['Policies','/policies'],['Audit records','/audits']]},
 '/risks':{purpose:'A risk describes what could go wrong and why it matters. Use the worksheet to connect assets or activities, unwanted events, consequences and relevant controls.',steps:['Confirm scope and assessment criteria.','Review suggested scenarios and explain likelihood and impact.','Assign treatment, ownership and dates, then review the remaining risk.'],next:[['Scope and requirements','/frameworks'],['Controls and checks','/controls']]},
 '/tasks':{purpose:'Actions show what needs attention, who is responsible and when it is due. Closing an action should point to the work and evidence that resolved it.',steps:['Create or open an action and choose the responsible person.','Record progress, proof and any decisions.','Complete the action when the required result has been checked.'],next:[['Evidence','/evidence'],['Audit findings','/audits']]},
 '/approvals':{purpose:'Approvals record an authorised decision on a request. They do not automatically publish a policy or certify compliance.',steps:['Describe the decision and link the relevant record.','Choose the workflow or named reviewers.','Review the supporting material and retain the decision.'],next:[['Policies and publication','/policies'],['Actions','/tasks']]},
 '/audits':{purpose:'Audits record the scope, checks, findings and follow-up from an assessment. Choose the audit type appropriate to the framework; not every framework is a certification scheme.',steps:['Agree scope, framework reference, reviewer and dates.','Record what was checked and the findings.','Resolve findings and retain the conclusion and supporting evidence.'],next:[['Assessment readiness','/frameworks'],['Corrective actions','/tasks'],['Evidence','/evidence']]},
 '/vendors':{purpose:'Supplier assurance keeps ownership, services, due diligence and review dates together. A supplier name alone is not evidence that its service meets your obligations.',steps:['Record the provider, service and responsible owner.','Review its relevant contracts and assurance evidence.','Track findings, renewal dates and changes.'],next:[['Assess supplier risk','/risks'],['Supporting evidence','/evidence'],['Review dates','/expiry']]},
 '/incidents':{purpose:'Record suspected incidents promptly, reduce harm and track decisions and notification duties. Do not wait for an assessment score before meeting a legal deadline.',steps:['Record what happened, when it was discovered and affected services or people.','Assign response, assess harm and check notification requirements.','Retain the timeline, decisions, recovery proof and follow-up.'],next:[['Response actions','/tasks'],['Supporting evidence','/evidence']]},
 '/training':{purpose:'Keep evidence that people understand the obligations relevant to their work. Course creation alone is not a completion record.',steps:['Choose the relevant programme and audience.','Record attendance or completion and its proof.','Review who still needs training and any refresher date.'],next:[['Policies people must understand','/policies'],['Evidence','/evidence']]},
 '/signatures':{purpose:'A signature records who acknowledged or signed a particular document version. It is separate from policy approval and publication.',steps:['Select the saved document by name.','Read the correct version before signing.','Retain the signed record; record a reason if revocation is required.'],next:[['Policy approval','/policies'],['Evidence records','/evidence']]},
 '/expiry':{purpose:'Track documents, contracts and other obligations that need review or renewal before a date.',steps:['Record the item, owner and expiry or review date.','Set sensible reminders.','Renew or review the item and retain the updated proof.'],next:[['Calendar','/calendar'],['Supporting evidence','/evidence']]},
 '/calendar':{purpose:'Plan the dates that matter: reviews, audits, renewals and other compliance activities.',steps:['Review upcoming and overdue activities.','Open the linked record or assign the required action.','Update the actual record when the activity is completed.'],next:[['Actions','/tasks'],['Review and renewal dates','/expiry']]},
 '/reports':{purpose:'Use the management view to see priorities, ownership and supporting records. Scores summarise recorded data; they are not legal opinions or certificates.',steps:['Check the organisation and reporting period.','Read overdue work, risk and evidence coverage together.','Follow the source records before drawing a conclusion.'],next:[['Assessment readiness','/frameworks'],['Risk worksheet','/risks'],['Actions','/tasks']]},
 '/analytics':{purpose:'Explore trends and coverage to decide where follow-up is needed. Verify the underlying records before relying on a chart.',steps:['Choose the relevant period and view.','Look for missing evidence, overdue work and changing risks.','Open the source register and assign follow-up.'],next:[['Management report','/reports'],['Controls','/controls']]},
 '/compliance-score':{purpose:'The score summarises recorded control status and coverage. A high score does not confirm legal compliance, independent assurance or certification.',steps:['Check which frameworks and records contribute.','Review missing proof and unresolved assessments.','Use the result to prioritise checks, not to issue a compliance claim.'],next:[['Actual assessment readiness','/frameworks'],['Supporting evidence','/evidence']]},
 '/departments':{purpose:'Organise the teams responsible for compliance work so ownership is clear.',steps:['Record the department and its purpose.','Confirm the people and responsibilities with the organisation owner.','Use the stakeholder questionnaire to capture the team’s obligations and concerns.'],next:[['Team and roles','/settings/team'],['Stakeholder scoping','/frameworks']]},
 '/branches':{purpose:'Keep the locations and business units relevant to scope visible.',steps:['Record the branch or operating location.','Check which services, records and people are in scope.','Update assessments when locations or operations change.'],next:[['Organisation profile','/settings/organization'],['Compliance scope','/frameworks']]},
 '/escalations':{purpose:'Escalation rules raise overdue or important matters to the right people. Review recipients and thresholds before enabling a rule.',steps:['Agree the trigger and responsible recipient.','Check the rule and notification settings.','Monitor events and resolve the underlying action.'],next:[['Open actions','/tasks'],['Notification settings','/settings/notifications']]},
 '/integrations':{purpose:'Connect only approved services. An integration listing does not mean the organisation is already connected to that service.',steps:['Confirm the business purpose and access required.','Configure it with an authorised administrator.','Test the connection and review what data is shared.'],next:[['API access','/settings/api-keys'],['Webhook settings','/settings/webhooks']]},
 '/ai-tools':{purpose:'Assisted drafting produces suggestions for human review. It does not independently assess the organisation or approve compliance.',steps:['Choose the task and provide suitable non-sensitive context.','Review the result against actual requirements and facts.','Save only the reviewed content through the relevant register.'],next:[['Policy templates','/policy-templates'],['Risk assessment','/risks']]},
};
const settings:Help={purpose:'Settings control the organisation profile, people, access and notifications. Confirm the correct organisation and involve an authorised administrator before changing shared settings.',steps:['Keep organisation details, scope and responsible people current.','Give each person only the access needed for their work.','Review security, notification recipients and approved connections.'],next:[['Organisation','/settings/organization'],['Team and access','/settings/team'],['Account security','/settings/security'],['Notifications','/settings/notifications']]};
const billing:Help={purpose:'Review the agreed plan, charges and invoices. Subscription and onboarding charges are separate from compliance assessment results.',steps:['Read onboarding and recurring fees separately.','Review the exact amount before any payment.','Keep invoices and renewal consent with the authorised account owner.'],next:[['Billing overview','/billing'],['Plans and charges','/billing/plans'],['Invoices','/billing/invoices']]};

function helpFor(pathname: string): Help | null {
  const root = '/' + pathname.split('/').filter(Boolean)[0];
  return help[root] ?? (root === '/settings' ? settings : root === '/billing' ? billing : null);
}

/** Page guidance on demand: a Help button in the top bar opens a side panel, so guidance never pushes the page title down. */
export function PageHelpButton(): JSX.Element | null {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const item = helpFor(pathname);
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
  if (!item) return null;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900">
        <HelpCircle className="h-4 w-4" aria-hidden="true" /><span className="hidden sm:inline">Help</span>
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={() => setOpen(false)}>
          <aside role="dialog" aria-modal="true" aria-label="Help for this page" onClick={e => e.stopPropagation()}
            className="flex h-full w-full max-w-md flex-col gap-4 overflow-y-auto bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-900">Help for this page</h2>
              <button type="button" aria-label="Close help" onClick={() => setOpen(false)}><X className="h-5 w-5" /></button>
            </div>
            <p className="text-sm leading-relaxed text-slate-700">{item.purpose}</p>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">How to use it</h3>
              <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-slate-700">{item.steps.map(s => <li key={s}>{s}</li>)}</ol>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Related pages</h3>
              <ul className="mt-2 space-y-1.5 text-sm">{item.next.map(([label, to]) => <li key={to}><Link to={to} className="font-medium text-brand-700 underline">{label}</Link></li>)}</ul>
            </div>
            <Link to="/guide" className="mt-auto inline-flex items-center gap-2 text-sm font-semibold text-brand-700"><BookOpen className="h-4 w-4" />Open the full guide</Link>
          </aside>
        </div>
      )}
    </>
  );
}
