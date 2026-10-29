import { useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth.store';
import { hasPermission } from '@/config/role-permissions';

type RecordData = Record<string, unknown>;
type Option = { id: string; title: string };
type Proof = { id: string; version?: string };
const object = (value: unknown): RecordData => value && typeof value === 'object' && !Array.isArray(value) ? value as RecordData : {};
const text = (value: unknown) => typeof value === 'string' || typeof value === 'number' ? String(value) : '';

/** A readable review copy of the existing record, without exposing raw internal JSON. */
export function ComplianceRecordDetails({ kind, record, options, expanded }: {
  kind: string; record: RecordData; options: Record<string, Option[]>; expanded: boolean;
}) {
  const role = useAuthStore(s => s.activeTenant?.role);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fields: Array<[string, unknown]> = [];
  const proofs: Proof[] = [];
  const action = object(record.corrective_action);
  const decision = object(record.notification_decision);
  const person = (id: unknown) => options.members?.find(m => m.id === id)?.title || (id ? 'Former or unavailable team member' : '');
  const proof = (id: unknown, version?: unknown) => { if (typeof id === 'string' && !proofs.some(p => p.id === id)) proofs.push({ id, version: typeof version === 'string' ? version : undefined }); };
  if (kind === 'tests') {
    const data = object(record.test_data);
    fields.push(['Review period', data.period], ['Expected result', data.criteria], ['Population and sample', data.sample], ['How the test was performed', data.method], ['Observed result', record.result], ['Recorded observations', record.notes]);
    if (Array.isArray(record.evidence_versions)) for (const value of record.evidence_versions) { const v = object(value); proof(v.id, v.current_version_id); }
  } else if (kind === 'actions') {
    fields.push(['Root cause', action.rootCause], ['Immediate correction', action.correction], ['Preventing a repeat', action.prevention], ['Effectiveness criteria', action.effectivenessCriteria], ['Due date', action.dueDate], ['Verification outcome', text(action.state).replace(/_/g, ' ')], ['Reviewer conclusion', action.reviewNote]);
    proof(action.evidenceId, action.evidenceVersionId);
  } else if (kind === 'vendors') {
    const data = object(record.responses);
    fields.push(['Service being assessed', data.service], ['Information and system access', data.dataAccess], ['Assurance checked', data.assurance], ['Contract safeguards', data.contract], ['Continuity arrangements', data.continuity], ['Exceptions and concerns', data.exceptions], ['Next review', record.review_due], ['Reviewer conclusion', record.review_note]);
    proof(data.evidenceId, data.evidenceVersionId);
  } else if (kind === 'risks') {
    const risk = object(record.risk_snapshot);
    fields.push(['Asset or service', risk.asset_name], ['Threat or event', risk.threat], ['Weakness or exposure', risk.vulnerability], ['Business consequence', risk.consequence], ['Initial likelihood / impact', `${text(risk.inherent_likelihood)} / ${text(risk.inherent_impact)}`], ['Treatment decision', risk.treatment], ['Treatment plan', risk.mitigation_plan], ['Remaining likelihood / impact', `${text(risk.residual_likelihood)} / ${text(risk.residual_impact)}`], ['Basis for remaining risk', risk.residual_basis], ['Independent review reasoning', record.notes], ['Review valid until', record.expires_on]);
  } else if (kind === 'incidents') {
    fields.push(['Notification decision', text(decision.decision).replace(/_/g, ' ')], ['When the organisation became aware', decision.awarenessAt], ['Verified reporting deadline', decision.deadlineAt], ['Intended recipient', decision.recipient], ['Facts and reason', decision.rationale], ['Decision recorded', decision.decidedAt]);
    proof(decision.evidenceId, decision.evidenceVersionId);
  } else if (kind === 'training') {
    fields.push(['Assigned person', person(record.user_id)], ['Completion date', record.completed_at], ['What the verifier checked', record.completion_note]);
    proof(record.completion_evidence_id, record.completion_evidence_version_id);
  } else if (kind === 'obligations') {
    fields.push(['Authority', record.authority], ['Source edition', record.source_version], ['Jurisdiction', record.jurisdiction], ['Relevant sector', record.sector], ['Source last checked', record.verified_on], ['Confirmed effective date', record.effective_on], ['Applicability decision', text(record.applicability).replace(/_/g, ' ')], ['Duty deadline', record.due_date], ['Next source review', record.review_date]);
    proof(record.evidence_id);
  } else if (kind === 'audits') {
    fields.push(['Report review date', record.reviewed_at], ['Report review conclusion', record.report_review_note]);
    proof(record.report_evidence_id, record.report_evidence_version_id);
  } else return null;
  fields.push(['Responsible person', person(record.owner_id ?? record.assigned_to)], ['Prepared by', person(record.tested_by ?? record.recorded_by ?? action.preparedBy)], ['Reviewed or verified by', person(record.reviewed_by ?? record.verified_by ?? action.reviewedBy ?? decision.decidedBy)], ['Review recorded', record.reviewed_at ?? action.reviewedAt], ['Review conclusion', record.review_note]);
  const visible = fields.filter(([, value]) => text(value).trim());
  if (!visible.length && !proofs.length) return null;
  async function download(p: Proof) {
    setError(''); setBusy(true);
    try {
      const endpoint = p.version ? `/evidence/${p.id}/versions/${p.version}/download` : `/evidence/${p.id}/download`;
      const response = await apiClient.get<{ data: { downloadUrl: string } }>(endpoint);
      const a = document.createElement('a'); a.href = response.data.data.downloadUrl; a.target = '_blank'; a.rel = 'noopener noreferrer'; document.body.appendChild(a); a.click(); a.remove();
    } catch { setError('The supporting file could not be downloaded. Open its version history or retry.'); }
    finally { setBusy(false); }
  }
  return <details open={expanded || undefined} className="mt-3 w-full min-w-0 rounded-lg bg-slate-50 p-3 text-sm">
    <summary className="cursor-pointer font-semibold text-indigo-800">Read recorded details and supporting proof</summary>
    <dl className="mt-3 grid min-w-0 gap-3 md:grid-cols-2">{visible.map(([label, value], index) => <div key={label + index} className="min-w-0"><dt className="text-xs font-semibold text-slate-500">{label}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-slate-800">{text(value)}</dd></div>)}</dl>
    {hasPermission(role, 'evidence:read') && proofs.length > 0 && <div className="mt-4 space-y-3">{proofs.map((p, index) => <div key={p.id} className="flex flex-wrap items-center gap-3"><button type="button" disabled={busy} onClick={() => void download(p)} className="font-semibold text-indigo-700 underline disabled:opacity-50">{p.version ? 'Download the recorded proof version' : 'Download the current supporting file'}{proofs.length > 1 ? ` ${index + 1}` : ''}</button><Link className="text-indigo-700 underline" to={'/evidence/' + p.id}>Open evidence and version history</Link></div>)}</div>}
    {error && <p role="alert" className="mt-3 text-red-800">{error}</p>}
  </details>;
}
