/**
 * Plain-language labels for values stored in the database. Every place that shows a stored status, role,
 * type or decision uses humanize(), so people never see snake_case or system wording.
 */
const LABELS: Record<string, string> = {
  // Control status
  not_assessed: 'Not yet assessed', not_implemented: 'Not operating', partially_implemented: 'Partly operating',
  implemented: 'Operating', not_applicable: 'Not applicable', planned: 'Planned',
  // Risk responses and states
  mitigate: 'Reduce', accept: 'Accept', transfer: 'Share or transfer', avoid: 'Avoid',
  in_treatment: 'In treatment', mitigated: 'Reduced', accepted: 'Accepted',
  // Review and lifecycle
  draft: 'Draft', open: 'Open', closed: 'Closed', in_review: 'In review', under_review: 'Under review', pending: 'Pending',
  pending_approval: 'Awaiting approval', approved: 'Approved', rejected: 'Rejected', published: 'Published', archived: 'Archived',
  in_progress: 'In progress', completed: 'Completed', cancelled: 'Cancelled', returned: 'Returned for correction',
  // Notification decisions and applicability
  required: 'Notification required', not_required: 'Notification not required', submitted: 'Notification submitted',
  applicable: 'Applicable', pending_review: 'Pending review',
  // Roles
  owner: 'Owner', admin: 'Admin', compliance_manager: 'Compliance manager', control_owner: 'Control owner',
  auditor: 'Auditor', viewer: 'Viewer', msp_admin: 'MSP admin', msp_analyst: 'MSP analyst',
  // Subscription
  active: 'Active', trialing: 'Trial', past_due: 'Payment overdue', canceled: 'Cancelled', unpaid: 'Unpaid', incomplete: 'Incomplete',
};

export function humanize(value: string | null | undefined): string {
  if (!value) return '';
  const known = LABELS[value];
  if (known) return known;
  const words = value.replace(/_/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
