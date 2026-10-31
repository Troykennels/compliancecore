import { Search } from 'lucide-react';
import { ComplianceRecordDetails } from './compliance-record-details';
import { ComplianceRecordPicker } from './compliance-record-picker';
import { complianceDownload } from '../compliance-download';
import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth.store';
import {
  assessmentInput as input,
  assessmentButton as button,
  assessmentSecondary as secondary,
} from './assessment-records';

type Option = {
  id: string;
  title: string;
  type?: string;
  status?: string;
  severity?: string;
  description?: string;
  due_date?: string;
  audit_title?: string;
  control_id?: string;
  test_id?: string;
  verification_current?: boolean;
};
type Row = {
  id: string;
  title?: string;
  status?: string;
  user_id?: string;
  acknowledged_at?: string;
  person?: string;
  version_number?: number;
  superseded?: boolean;
  stale?: boolean;
  revision?: number;
  [key: string]: unknown;
};
type Data = {
  records: Row[];
  options: Record<string, Option[]>;
  page: number;
  hasMore: boolean;
};
type Field = {
  name: string;
  label: string;
  hint?: string;
  options?: string;
  choices?: string[];
  type?: 'date' | 'datetime-local' | 'url' | 'text';
  multi?: boolean;
  optional?: boolean;
  long?: boolean;
};
type Workspace = {
  kind: string;
  title: string;
  help: string;
  action: string;
  fields: Field[];
  write?: string[];
};
const select = (name: string, label: string, options: string, multi = false): Field => ({
  name,
  label,
  options,
  multi,
});
const note = (name: string, label: string, hint?: string): Field => ({
  name,
  label,
  hint,
  long: true,
});
const date = (name: string, label: string): Field => ({
  name,
  label,
  type: 'date',
});
const proof = select('evidenceId', 'Supporting document (upload it in Evidence first)', 'evidence');
const workspaces: Record<string, Workspace> = {
  '/frameworks': {
    kind: 'obligations',
    title: 'Obligations and official sources',
    help: 'Record the duties that may apply to your organisation. An independent reviewer confirms the source, applicability and next review before the record becomes active. Selecting a framework does not make a legal decision.',
    action: 'Add obligation for review',
    fields: [
      {
        name: 'title',
        label: 'Duty to track',
        hint: 'Describe one specific requirement in your own words.',
      },
      { name: 'authority', label: 'Regulator or contract authority' },
      { name: 'sourceUrl', label: 'Official source link', type: 'url' },
      { name: 'sourceVersion', label: 'Source edition or document date' },
      { name: 'jurisdiction', label: 'Country / state or contractual scope' },
      { name: 'sector', label: 'Relevant service or sector' },
      date('verifiedOn', 'When did you check the source?'),
      { ...date('effectiveOn', 'Effective date (if confirmed in the source)'), optional: true },
      {
        name: 'applicability',
        label: 'Does it apply?',
        choices: ['pending', 'applicable', 'not_applicable'],
      },
      note(
        'rationale',
        'Facts and reason for the decision',
        'Explain the actual organisational facts; do not simply copy the framework name.',
      ),
      select('ownerId', 'Responsible person', 'members'),
      { ...date('dueDate', 'Duty deadline (if verified)'), optional: true },
      date('reviewDate', 'Next review'),
      { ...proof, optional: true },
      select('controlIds', 'Related safeguards (optional)', 'controls', true),
      { name: 'status', label: 'Save as', choices: ['draft', 'in_review'] },
    ],
  },
  '/controls': {
    kind: 'tests',
    title: 'Check whether safeguards work',
    help: 'Record what you tested, the period, sample and supporting files. Another authorised person reviews the result. A control status or a note alone is not a completed test.',
    action: 'Record a control test',
    write: ['owner', 'admin', 'compliance_manager', 'control_owner', 'msp_admin'],
    fields: [
      select('controlId', 'Safeguard to test', 'controls'),
      {
        ...select('auditId', 'Related audit (when your role has access)', 'audits'),
        optional: true,
      },
      {
        name: 'period',
        label: 'Period covered',
        hint: 'For example: July–September 2026',
      },
      note('criteria', 'What should happen?'),
      note('sample', 'What records or activities did you check?'),
      note('method', 'How did you check them?'),
      {
        name: 'result',
        label: 'Result',
        choices: ['pass', 'fail', 'exception'],
      },
      note('notes', 'Result and exceptions'),
      select('evidenceIds', 'Files supporting this test', 'evidence', true),
    ],
  },
  '/risks': {
    kind: 'risks',
    title: 'Independent review of remaining risk',
    help: 'First complete the risk worksheet and treatment. An authorised person who did not prepare or own the risk reviews the remaining risk, control links and review expiry. Accepting a risk cannot waive a legal duty.',
    action: 'Record a risk review',
    fields: [
      select('riskId', 'Assessed risk', 'risks'),
      {
        ...select(
          'controlIds',
          'Controls addressing this risk (may span frameworks)',
          'controls',
          true,
        ),
        optional: true,
      },
      { name: 'decision', label: 'Decision', choices: ['approve', 'return'] },
      note('note', 'Review reasoning and any conditions'),
      date('expiresOn', 'Review valid until'),
    ],
  },
  '/policies': {
    kind: 'acknowledgments',
    title: 'Ask people to read the published policy',
    help: 'Publish the approved policy first, then assign its exact version to the people who need to read it. Each assigned person acknowledges their own copy. Editing the policy does not erase previous receipts.',
    action: 'Assign policy readership',
    fields: [
      select('policyId', 'Published policy', 'policies'),
      select('userIds', 'People who must read it', 'members', true),
      date('dueDate', 'Read by'),
    ],
  },
  '/vendors': {
    kind: 'vendors',
    title: 'Supplier due diligence',
    help: 'Record what the supplier does, its data access, assurance, contractual safeguards and continuity arrangements. Attach proof and ask another authorised person to review the answers.',
    action: 'Complete supplier questionnaire',
    fields: [
      select('vendorId', 'Supplier', 'vendors'),
      note('service', 'What service do they provide?'),
      note('dataAccess', 'What data and systems can they access?'),
      note('assurance', 'What assurance have you checked?'),
      note('contract', 'What contractual safeguards apply?'),
      note('continuity', 'How would service disruption be handled?'),
      note(
        'exceptions',
        'Exceptions or conditions',
        'Explain any concerns, or why none were identified.',
      ),
      proof,
      date('reviewDue', 'Next review'),
    ],
  },
  '/tasks': {
    kind: 'actions',
    title: 'Corrective actions and effectiveness',
    help: 'Use an existing task to address a finding, incident or failed safeguard. Explain the root cause and the action taken. A separate reviewer checks effectiveness before closure.',
    action: 'Prepare corrective action',
    fields: [
      select('taskId', 'Existing action task', 'tasks'),
      select('sourceKind', 'Source record type', 'sourceKinds'),
      select('sourceId', 'Finding, incident or safeguard', 'sources'),
      note('rootCause', 'Why did the issue happen?'),
      note('correction', 'What did you do to correct it?'),
      note('prevention', 'How will recurrence be prevented?'),
      note('effectivenessCriteria', 'How will the reviewer know the action worked?'),
      proof,
      date('dueDate', 'Verification due'),
    ],
  },
  '/incidents': {
    kind: 'incidents',
    title: 'Regulatory notification decision',
    help: 'Use the actual applicable duty and facts to decide whether notification is needed. The product does not assume that every incident has a 72-hour deadline. Keep the decision and submission receipt with the incident.',
    action: 'Record notification decision',
    fields: [
      select('incidentId', 'Incident', 'incidents'),
      {
        ...select('obligationId', 'Reviewed applicable duty', 'obligations'),
        optional: true,
      },
      {
        name: 'awarenessAt',
        label: 'When did the organisation become aware? (your local time)',
        type: 'datetime-local',
      },
      {
        name: 'decision',
        label: 'Decision',
        choices: ['pending', 'required', 'not_required', 'submitted'],
      },
      {
        name: 'deadlineAt',
        label: 'Verified deadline (your local time)',
        type: 'datetime-local',
        optional: true,
      },
      { name: 'recipient', label: 'Recipient / authority', optional: true },
      note('rationale', 'Facts, legal basis and decision reasoning'),
      { ...proof, optional: true },
    ],
  },
  '/training': {
    kind: 'training',
    title: 'Verify training completion',
    help: 'Assign participants in the existing programme. Mark completion only when there is attendance, assessment or attestation evidence. Another authorised person verifies the participant’s proof.',
    action: 'Verify a participant’s completion',
    fields: [
      select('recordId', 'Assigned participant', 'records'),
      proof,
      note('note', 'What demonstrates completion?'),
    ],
  },
  '/audits': {
    kind: 'audits',
    title: 'Review the audit report',
    help: 'Record scope, summary and end date on the audit. Attach the report and ask an independent reviewer to sign off before completing it. Findings remain open until linked corrective work is independently verified.',
    action: 'Review an audit report',
    fields: [
      select('auditId', 'Audit to review', 'audits'),
      proof,
      note('note', 'Review conclusion'),
    ],
  },
  '/settings/security': {
    kind: 'history',
    title: 'Recorded compliance activity',
    help: 'Read the latest 200 append-protected activity events. The history records actors, record identifiers and state changes; it excludes document text and secrets. Database operators still require separate privilege controls.',
    action: '',
    fields: [],
  },
};
function errorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const body = error.response?.data as
      | { error?: { message?: string }; message?: string }
      | undefined;
    return (
      body?.error?.message ??
      body?.message ??
      'The request could not be completed. Check the fields and try again.'
    );
  }
  return error instanceof Error ? error.message : 'The request could not be completed.';
}
function pretty(value: unknown): string {
  return String(value ?? '').replace(/_/g, ' ');
}
function sourceLink(kind: string, row: Row): string | undefined {
  const refs: Record<string, [string, string]> = {
    tests: ['/controls', 'control_id'],
    risks: ['/risks', 'risk_id'],
    acknowledgments: ['/policies', 'policy_id'],
    vendors: ['/vendors', 'vendor_id'],
    actions: ['/tasks', 'id'],
    incidents: ['/incidents', 'id'],
    audits: ['/audits', 'id'],
  };
  const ref = refs[kind];
  return ref
    ? `${ref[0]}${kind === 'actions' ? `/${row.id}` : `?record=${String(row[ref[1]] ?? '')}&q=${encodeURIComponent(row.title ?? '')}`}`
    : undefined;
}

export function ComplianceOperationsPanel(): JSX.Element | null {
  const { pathname, search } = useLocation();
  const config = workspaces[pathname];
  const role = useAuthStore((s) => s.activeTenant?.role),
    userId = useAuthStore((s) => s.user?.id),
    tenantId = useAuthStore((s) => s.activeTenant?.id);
  if (!config) return null;
  return (
    <Operations
      key={`${tenantId}:${config.kind}`}
      config={config}
      role={role ?? ''}
      userId={userId ?? ''}
      attention={new URLSearchParams(search).get('attention') === 'review'}
      defaultOpen={new URLSearchParams(search).has('workflow')}
    />
  );
}
function Operations({
  config,
  role,
  userId,
  attention,
  defaultOpen,
}: {
  config: Workspace;
  role: string;
  userId: string;
  attention: boolean;
  defaultOpen: boolean;
}): JSX.Element {
  const qc = useQueryClient();
  const [open, setOpen] = useState(defaultOpen),
    [formOpen, setFormOpen] = useState(false),
    [editing, setEditing] = useState<Row | null>(null),
    [review, setReview] = useState<Row | null>(null),
    [outcome, setOutcome] = useState('approve'),
    [notice, setNotice] = useState(''),
    [sourceKind, setSourceKind] = useState(''),
    [auditMode, setAuditMode] = useState('report'),
    [riskMode, setRiskMode] = useState('review'),
    [page, setPage] = useState(1);
  const manager = ['owner', 'admin', 'compliance_manager', 'msp_admin'].includes(role),
    canWrite = (config.write ?? ['owner', 'admin', 'compliance_manager', 'msp_admin']).includes(
      role,
    );
  const query = useQuery({
    queryKey: ['compliance-records', config.kind, attention, page, window.location.search],
    enabled: open,
    queryFn: async () =>
      (
        await apiClient.get<{ data: Data }>(
          `/frameworks/records/${config.kind}?page=${page}${attention ? '&attention=review' : ''}${config.kind === 'tests' && new URLSearchParams(window.location.search).get('record') ? '&recordId=' + encodeURIComponent(new URLSearchParams(window.location.search).get('record')!) : ''}`,
        )
      ).data.data,
  });
  const save = useMutation({
    mutationFn: async ({ path, data }: { path: string; data: unknown }) =>
      apiClient.post('/frameworks/records/' + path, data),
    onSuccess: () => {
      setFormOpen(false);
      setReview(null);
      setEditing(null);
      setNotice('Saved. The current record and review history have been retained.');
      void qc.invalidateQueries();
    },
  });
  const fields =
    config.kind === 'risks' && riskMode === 'context'
      ? [
          select('riskId', 'Existing risk to assess', 'risks'),
          select('frameworkId', 'Framework with a saved scope', 'frameworks'),
        ]
      : config.kind === 'audits' && auditMode === 'new'
        ? [
            select('auditId', 'Audit for this finding', 'audits'),
            { name: 'title', label: 'Finding title' },
            note('description', 'Observed facts and impact'),
            {
              name: 'severity',
              label: 'Severity',
              choices: ['medium', 'high', 'critical', 'low', 'observation'],
            },
            select('ownerId', 'Responsible person', 'members'),
            date('dueDate', 'Action due'),
            note('recommendation', 'Recommended correction'),
            { ...select('controlId', 'Related safeguard', 'controls'), optional: true },
            { ...select('testId', 'Related control test', 'tests'), optional: true },
          ]
        : config.kind === 'audits' && auditMode === 'finding'
          ? [
              select('findingId', 'Finding to close', 'findings'),
              proof,
              note('note', 'Effectiveness checks and closure reasoning'),
            ]
          : config.fields;
  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const data: Record<string, unknown> = {};
    for (const field of fields) {
      let value: unknown = field.multi ? f.getAll(field.name) : f.get(field.name);
      if (field.type === 'datetime-local' && value) value = new Date(String(value)).toISOString();
      if (value === '' && field.optional) value = ['recipient'].includes(field.name) ? '' : null;
      data[field.name] = value;
    }
    if (editing) {
      data.id = editing.id;
      data.revision = editing.revision;
    }
    save.mutate({
      path:
        config.kind === 'risks' && riskMode === 'context'
          ? 'risk-context'
          : config.kind === 'audits' && auditMode === 'new'
            ? 'new-finding'
            : config.kind === 'audits' && auditMode === 'finding'
              ? 'findings'
              : config.kind,
      data,
    });
  }
  const fieldValue = (field: Field) => {
    if (!editing)
      return field.type === 'date'
        ? field.name === 'verifiedOn'
          ? new Date().toISOString().slice(0, 10)
          : ''
        : '';
    const key = field.name.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase());
    const v = editing[key];
    return Array.isArray(v)
      ? v.map(String)
      : typeof v === 'string'
        ? v.slice(0, field.type === 'date' ? 10 : undefined)
        : '';
  };
  return (
    <details
      className="mx-auto mt-3 max-w-7xl rounded-lg border border-slate-200 bg-white px-0 sm:w-[calc(100%-3rem)] w-[calc(100%-2rem)]"
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary className="cursor-pointer px-4 py-2 text-sm text-slate-600">
        <span className="font-medium text-slate-500">Related workflow:</span>{' '}
        <span className="font-semibold text-brand-800">{config.title}</span>
      </summary>
      <div className="space-y-4 border-t p-4">
        <p className="max-w-4xl text-sm leading-relaxed text-slate-600">{config.help}</p>
        <nav className="flex flex-wrap gap-4 text-sm">
          <Link className="text-indigo-700 underline" to="/frameworks">
            Scope and obligations
          </Link>
          <Link className="text-indigo-700 underline" to="/evidence">
            Upload supporting files
          </Link>
          <Link className="text-indigo-700 underline" to="/policy-templates">
            Policy templates
          </Link>
          <Link className="text-indigo-700 underline" to="/tasks">
            Follow-up actions
          </Link>
        </nav>
        {notice && (
          <p role="status" className="rounded bg-emerald-50 p-3 text-sm text-emerald-900">
            {notice}
          </p>
        )}
        {(query.isError || save.isError) && (
          <div role="alert" className="rounded bg-red-50 p-3 text-sm text-red-900">
            {errorMessage(save.error ?? query.error)}
            {query.isError && (
              <button className="ml-3 underline" onClick={() => void query.refetch()}>
                Retry
              </button>
            )}
          </div>
        )}
        {query.isLoading ? (
          <p role="status">Loading records…</p>
        ) : (
          query.data && (
            <>
              {canWrite && config.action && (
                <button
                  className={button}
                  onClick={() => {
                    setEditing(null);
                    setAuditMode('report');
                    setRiskMode('review');
                    setFormOpen(!formOpen);
                    setNotice('');
                    save.reset();
                  }}
                >
                  {config.action}
                </button>
              )}
              {manager && config.kind === 'risks' && (
                <button
                  className={secondary + ' ml-2'}
                  onClick={() => {
                    setRiskMode('context');
                    setFormOpen(true);
                    setEditing(null);
                    save.reset();
                  }}
                >
                  Assess an existing risk in a worksheet
                </button>
              )}
              {manager && config.kind === 'audits' && (
                <button
                  className={secondary + ' ml-2'}
                  onClick={() => {
                    setAuditMode('new');
                    setFormOpen(true);
                    setEditing(null);
                    save.reset();
                  }}
                >
                  Record an audit finding
                </button>
              )}
              {manager && config.kind === 'audits' && (
                <button
                  className={secondary + ' ml-2'}
                  onClick={() => {
                    setAuditMode('finding');
                    setFormOpen(true);
                    setEditing(null);
                    save.reset();
                  }}
                >
                  Close a finding after verification
                </button>
              )}
              <button
                className={secondary + ' ml-2'}
                onClick={() => {
                  void complianceDownload(
                    '/frameworks/records/' +
                      config.kind +
                      '/export?page=' +
                      page +
                      (attention ? '&attention=review' : ''),
                    'records.csv',
                  ).catch(() => setNotice('Download failed. Please try again.'));
                }}
              >
                Export these records (CSV)
              </button>
              {formOpen && (
                <form
                  key={editing?.id ?? auditMode + riskMode}
                  className="grid gap-4 rounded-lg border bg-slate-50 p-4 md:grid-cols-2"
                  onSubmit={submit}
                >
                  {fields.map((field) => (
                    <div
                      key={field.name}
                      className={
                        'block min-w-0 space-y-1 text-sm ' + (field.long ? 'md:col-span-2' : '')
                      }
                    >
                      <span className="font-medium">
                        {field.label}
                        {field.optional ? ' (optional)' : ''}
                      </span>
                      {field.options ? (
                        <ComplianceRecordPicker
                          key={field.name + (field.name === 'sourceId' ? sourceKind : '')}
                          name={field.name}
                          label={field.label}
                          kind={config.kind}
                          source={field.options}
                          options={query.data!.options[field.options] ?? []}
                          initial={fieldValue(field)}
                          multiple={field.multi}
                          required={
                            !field.optional &&
                            (!field.multi ||
                              (['evidenceIds', 'userIds', 'controlIds'].includes(field.name) &&
                                config.kind !== 'obligations'))
                          }
                          allowedType={field.name === 'sourceId' ? sourceKind : undefined}
                          onChange={(value) => {
                            if (field.name === 'sourceKind') setSourceKind(value);
                          }}
                        />
                      ) : field.choices ? (
                        <select
                          aria-label={field.label}
                          name={field.name}
                          defaultValue={fieldValue(field) || field.choices[0]}
                          className={input}
                        >
                          {field.choices.map((v) => (
                            <option key={v} value={v}>
                              {pretty(v)}
                            </option>
                          ))}
                        </select>
                      ) : field.long ? (
                        <textarea
                          aria-label={field.label}
                          name={field.name}
                          defaultValue={String(fieldValue(field))}
                          required
                          minLength={20}
                          maxLength={10000}
                          rows={3}
                          className={input}
                        />
                      ) : (
                        <input
                          aria-label={field.label}
                          name={field.name}
                          defaultValue={String(fieldValue(field))}
                          required={!field.optional}
                          type={field.type ?? 'text'}
                          minLength={field.type ? undefined : 2}
                          maxLength={2000}
                          className={input}
                        />
                      )}
                      <span className="block text-xs text-slate-500">
                        {field.hint ??
                          (field.multi
                            ? 'Select each relevant record.'
                            : field.long
                              ? 'Explain the facts in at least 20 characters.'
                              : '')}
                      </span>
                    </div>
                  ))}
                  <div className="flex flex-wrap gap-3 md:col-span-2">
                    <button disabled={save.isPending} className={button}>
                      {save.isPending ? 'Saving…' : 'Save record'}
                    </button>
                    <button
                      type="button"
                      className={secondary}
                      onClick={() => {
                        setFormOpen(false);
                        setEditing(null);
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
              {review && (
                <form
                  className="space-y-3 rounded-lg border border-indigo-200 p-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    save.mutate({
                      path: `${config.kind}/${review.id}/review`,
                      data: { decision: outcome, note: f.get('note') },
                    });
                  }}
                >
                  <h3 className="font-semibold">Independent review: {review.title ?? 'record'}</h3>
                  <label className="block text-sm">
                    Decision
                    <select
                      className={input}
                      value={outcome}
                      onChange={(e) => setOutcome(e.target.value)}
                    >
                      <option value="approve">Approve / effectiveness verified</option>
                      <option value="return">Return for correction</option>
                    </select>
                  </label>
                  <label className="block text-sm">
                    Reason and evidence checked
                    <textarea className={input} name="note" minLength={20} required rows={3} />
                  </label>
                  <button className={button} disabled={save.isPending}>
                    Save review
                  </button>
                  <button
                    type="button"
                    className={secondary + ' ml-3'}
                    onClick={() => setReview(null)}
                  >
                    Cancel
                  </button>
                </form>
              )}
              {config.kind === 'audits' && (
                <details className="rounded-lg border p-3">
                  <summary className="cursor-pointer font-semibold">Finding register</summary>
                  <div className="mt-3 space-y-3">
                    {(query.data.options.findings ?? []).map((f) => (
                      <article key={f.id} className="space-y-2 rounded border p-3 text-sm">
                        <h3 className="font-semibold">{f.title}</h3>
                        <p>
                          {f.audit_title} ? {f.severity} ? {pretty(f.status)}
                        </p>
                        {f.verification_current === false && f.status === 'resolved' && (
                          <p className="text-amber-800">
                            Closure evidence changed or expired. Arrange a fresh verification.
                          </p>
                        )}
                        <p>{f.description}</p>
                        {f.control_id && (
                          <Link
                            className="text-indigo-700 underline"
                            to={'/controls?workflow=tests&record=' + f.control_id}
                          >
                            Open related safeguard and tests
                          </Link>
                        )}
                      </article>
                    ))}
                    {!query.data.options.findings?.length && (
                      <p className="text-slate-500">
                        No findings recorded. Use Record an audit finding when fieldwork identifies
                        an issue.
                      </p>
                    )}
                  </div>
                </details>
              )}
              <div className="space-y-3">
                {query.data.records.map((r) => (
                  <article key={r.id} className="rounded-lg border p-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold">
                          {r.title ?? `${pretty(r.entity_type)} · ${pretty(r.action)}`}
                        </h3>
                        <p className="mt-1 text-xs text-slate-600">
                          {config.kind === 'history'
                            ? `${pretty(r.user_role)} · ${String(r.created_at ?? '')
                                .replace('T', ' ')
                                .slice(0, 19)} · event ${String(r.event_sequence)}`
                            : config.kind === 'acknowledgments'
                              ? `${r.person} · version ${r.version_number} · ${r.acknowledged_at ? 'acknowledged' : 'awaiting reader'}`
                              : `${pretty(r.status ?? r.decision ?? 'recorded')}${r.reviewed_by ? ' · independently reviewed' : ''}`}
                        </p>
                        {(r.stale || r.superseded) && (
                          <p className="mt-1 text-xs font-semibold text-amber-800">
                            Changed or expired — a fresh review is required.
                          </p>
                        )}
                        {Boolean(r.rationale) && (
                          <p className="mt-2 max-w-3xl whitespace-pre-wrap text-sm text-slate-600">
                            {String(r.rationale)}
                          </p>
                        )}
                        {config.kind === 'acknowledgments' && (
                          <details className="mt-2">
                            <summary className="cursor-pointer text-sm text-indigo-700">
                              Read policy version {r.version_number}
                            </summary>
                            <p className="mt-2 max-w-3xl whitespace-pre-wrap text-sm">
                              {String(
                                r.version_content ??
                                  'Published text is unavailable; ask your coordinator before acknowledging.',
                              )}
                            </p>
                          </details>
                        )}
                        {Array.isArray(r.versions) && r.versions.length > 0 && (
                          <details className="mt-2 text-sm">
                            <summary className="cursor-pointer text-indigo-700">
                              Reviewed source history
                            </summary>
                            {r.versions.map(
                              (v: {
                                revision: number;
                                snapshot: {
                                  title: string;
                                  source_version: string;
                                  rationale: string;
                                };
                                reviewedAt: string;
                              }) => (
                                <div className="mt-2 rounded border p-2" key={v.revision}>
                                  <p className="font-semibold">
                                    Revision {v.revision}: {v.snapshot.source_version}
                                  </p>
                                  <p>{v.snapshot.title}</p>
                                  <p className="mt-1 whitespace-pre-wrap text-slate-600">
                                    {v.snapshot.rationale}
                                  </p>
                                  <p className="text-xs">Reviewed {v.reviewedAt.slice(0, 10)}</p>
                                </div>
                              ),
                            )}
                          </details>
                        )}
                        {Boolean(r.source_url) && (
                          <a
                            className="text-xs text-indigo-700 underline"
                            href={String(r.source_url)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Open source document
                          </a>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {sourceLink(config.kind, r) && (
                          <Link className={secondary} to={sourceLink(config.kind, r)!}>
                            Open source record
                          </Link>
                        )}
                        {config.kind === 'obligations' && canWrite && (
                          <button
                            className={secondary}
                            onClick={() => {
                              setEditing(r);
                              setFormOpen(true);
                            }}
                          >
                            Revise record
                          </button>
                        )}
                        {manager &&
                          ['obligations', 'tests', 'vendors', 'actions'].includes(config.kind) && (
                            <button
                              className={secondary}
                              onClick={() => {
                                setReview(r);
                                setOutcome('approve');
                                save.reset();
                              }}
                            >
                              Review / return
                            </button>
                          )}
                        {config.kind === 'acknowledgments' &&
                          r.user_id === userId &&
                          !r.acknowledged_at &&
                          !r.superseded && (
                            <button
                              className={button}
                              disabled={save.isPending}
                              onClick={() => {
                                if (
                                  window.confirm(
                                    'Have you read the exact published policy version shown?',
                                  )
                                )
                                  save.mutate({
                                    path: `acknowledgments/${r.id}/acknowledge`,
                                    data: {},
                                  });
                              }}
                            >
                              I have read this version
                            </button>
                          )}
                      </div>
                    </div>
                    <ComplianceRecordDetails
                      kind={config.kind}
                      record={r}
                      options={query.data.options}
                      expanded={review?.id === r.id}
                    />
                  </article>
                ))}
                {!query.data.records.length && (
                  <p className="text-sm text-slate-500">
                    No records yet.{' '}
                    {canWrite
                      ? 'Use the action above after preparing the source record.'
                      : 'Your coordinator will assign or prepare records for review.'}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3 text-sm">
                <button
                  className={secondary}
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                >
                  Previous records
                </button>
                <span>Page {page}</span>
                <button
                  className={secondary}
                  disabled={!query.data.hasMore}
                  onClick={() => setPage(page + 1)}
                >
                  Next records
                </button>
              </div>
              <p className="text-xs text-slate-500">
                Showing up to 200 recent records
                {attention ? ' needing attention' : ''}. Saved decisions stay linked to the original
                records.
              </p>
            </>
          )
        )}
      </div>
    </details>
  );
}

export function ComplianceSearch(): JSX.Element {
  const [q, setQ] = useState(''),
    [term, setTerm] = useState('');
  const query = useQuery({
    queryKey: ['compliance-search', term],
    enabled: term.trim().length >= 2,
    queryFn: async () =>
      (
        await apiClient.get<{
          data: Array<{ id: string; title: string; type: string; url: string }>;
        }>('/frameworks/records/search', { params: { q: term } })
      ).data.data,
  });
  return (
    <div className="relative min-w-0 max-w-sm flex-1">
      <form
        className="relative"
        onSubmit={(e) => {
          e.preventDefault();
          setTerm(q);
        }}
      >
        <input
          className={input + ' !py-1.5 !pr-9'}
          aria-label="Search compliance records"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            if (!e.target.value) setTerm('');
          }}
          placeholder="Search records"
          type="search"
          enterKeyHint="search"
          minLength={2}
        />
        <button
          type="submit"
          aria-label="Run record search"
          className="absolute right-2 top-2 text-indigo-700"
        >
          <Search className="h-4 w-4" />
        </button>
      </form>
      {term && (
        <div className="absolute left-0 right-0 z-50 max-h-80 overflow-auto rounded-lg border bg-white p-3 shadow-lg">
          <button className="float-right text-xs underline" onClick={() => setTerm('')}>
            Close
          </button>
          {query.isFetching ? (
            <p className="text-xs">Searching…</p>
          ) : query.isError ? (
            <p role="alert" className="text-xs">
              Search failed. Try again.
            </p>
          ) : query.data?.length ? (
            query.data.map((r) => (
              <Link
                className="block border-b py-2 text-sm text-indigo-800"
                key={r.type + r.id}
                to={r.url}
                onClick={() => setTerm('')}
              >
                {r.title}
                <span className="block text-xs text-slate-500">{pretty(r.type)}</span>
              </Link>
            ))
          ) : (
            <p className="py-2 text-xs">No permitted records matched.</p>
          )}
        </div>
      )}
    </div>
  );
}
