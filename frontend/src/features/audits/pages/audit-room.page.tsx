import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import type { ApiResponse } from '@/types/api';
import { PageHeader } from '@/components/page-header';
import { useAuthStore } from '@/stores/auth.store';
import { useOrgFormat } from '@/lib/org-format';
import { humanize } from '@/lib/labels';
import { evidenceApi } from '@/features/evidence/api/evidence.api';
import { controlsApi } from '@/features/controls/api/controls.api';
import type { TeamMember } from '@/features/settings/types/settings.types';
import { settingsApi } from '@/features/settings/api/settings.api';

interface RequestRecord {
  id: string;
  reference: string;
  title: string;
  requirement: string | null;
  description: string | null;
  status: string;
  owner_id: string | null;
  owner_name: string | null;
  control_title: string | null;
  control_id: string | null;
  due_date: string | null;
  submitted_by: string | null;
  decision_note: string | null;
}
interface Attachment {
  request_id: string;
  evidence_id: string;
  evidence_version_id: string;
  title: string;
  version_number: number;
  current_version_id: string | null;
}
interface Comment {
  id: string;
  request_id: string;
  author_name: string;
  body: string;
  created_at: string;
}
interface Participant {
  user_id: string;
  name: string;
  access_from: string;
  access_until: string;
}
interface Room {
  audit: { title: string; scope: string | null };
  requests: RequestRecord[];
  attachments: Attachment[];
  comments: Comment[];
  participants: Participant[];
  requestOwnerRoles: string[];
}
const inputClass = 'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm';
const buttonClass =
  'rounded-md bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50';

function formValues(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
  return Object.fromEntries(new FormData(event.currentTarget).entries()) as Record<string, string>;
}

export function AuditRoomPage() {
  const { id = '' } = useParams();
  const role = useAuthStore((s) => s.activeTenant?.role);
  const userId = useAuthStore((s) => s.user?.id);
  const manager = ['owner', 'admin', 'compliance_manager'].includes(role ?? '');
  const fmt = useOrgFormat();
  const qc = useQueryClient();
  const base = `/audits/${id}/room`;
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['audit-room', id],
    queryFn: () => apiClient.get<ApiResponse<Room>>(base).then((r) => r.data.data),
  });
  const { data: members = [] } = useQuery({
    queryKey: ['audit-room-members'],
    enabled: manager,
    queryFn: () =>
      settingsApi.listMembers().then((r) => r.data.data.members.filter((m) => m.isActive)),
  });
  const { data: controls = [] } = useQuery({
    queryKey: ['audit-room-controls'],
    enabled: manager,
    queryFn: () => controlsApi.list({ limit: 100 }).then((r) => r.data.data.controls),
  });
  const write = useMutation({
    mutationFn: ({ path, body, remove }: { path: string; body?: unknown; remove?: boolean }) =>
      remove ? apiClient.delete(base + path) : apiClient.post(base + path, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['audit-room', id] });
      toast.success('Audit room updated.');
    },
    onError: (error: unknown) => {
      const e = error as { response?: { data?: { error?: { message?: string } } } };
      toast.error(e.response?.data?.error?.message ?? 'The audit room could not be updated.');
    },
  });
  if (isLoading)
    return (
      <div className="p-6" role="status">
        Loading audit room…
      </div>
    );
  if (isError || !data)
    return (
      <div className="space-y-3 p-6">
        <h1 className="text-xl font-semibold">Audit room unavailable</h1>
        <p>Your access window may have ended. Ask the audit manager to check your access.</p>
        <button className={buttonClass} onClick={() => void refetch()}>
          Try again
        </button>
        <Link className="ml-3 underline" to="/audits">
          Back to audits
        </Link>
      </div>
    );

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6">
      <PageHeader
        eyebrow="Audit room"
        title={data.audit.title}
        description={data.audit.scope ?? 'Coordinate evidence requests and independent review.'}
        actions={
          <div className="flex flex-wrap gap-4">
            <Link
              to={`/audits?workflow=audits&record=${id}`}
              className="text-sm font-semibold text-brand-700 underline"
            >
              Report and review
            </Link>
            <Link to="/audits" className="text-sm text-brand-700 underline">
              Back to audits
            </Link>
          </div>
        }
      />
      <p className="text-sm text-slate-600">
        Access dates apply to this room. The organisation’s auditor role also has read access to
        other registers.
      </p>
      {manager && (
        <details className="rounded-xl border bg-white p-4">
          <summary className="cursor-pointer font-semibold">Manage auditor access</summary>
          <form
            className="mt-4 grid gap-3 sm:grid-cols-4"
            onSubmit={(event) => {
              const v = formValues(event);
              write.mutate({ path: '/participants', body: v });
            }}
          >
            <label className="text-sm">
              Auditor
              <select name="userId" required className={inputClass}>
                <option value="">Choose a member</option>
                {members
                  .filter((m) => m.role === 'auditor')
                  .map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.firstName} {m.lastName} ({m.email})
                    </option>
                  ))}
              </select>
            </label>
            <label className="text-sm">
              Access starts
              <input name="accessFrom" type="date" required className={inputClass} />
            </label>
            <label className="text-sm">
              Access ends
              <input name="accessUntil" type="date" required className={inputClass} />
            </label>
            <button disabled={write.isPending} className={`${buttonClass} self-end`}>
              Save access window
            </button>
          </form>
          <ul className="mt-4 space-y-2">
            {data.participants.map((p) => (
              <li
                className="flex flex-wrap items-center justify-between gap-2 text-sm"
                key={p.user_id}
              >
                <span>
                  {p.name}: {fmt.formatDate(p.access_from)} – {fmt.formatDate(p.access_until)}
                </span>
                <button
                  disabled={write.isPending}
                  className="text-rose-700 underline"
                  onClick={() => write.mutate({ path: `/participants/${p.user_id}`, remove: true })}
                >
                  Revoke access
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
      {manager && (
        <details className="rounded-xl border bg-white p-4">
          <summary className="cursor-pointer font-semibold">New evidence request</summary>
          <RequestForm
            members={members.filter((m) =>
              (
                data.requestOwnerRoles ?? ['owner', 'admin', 'compliance_manager', 'control_owner']
              ).includes(m.role),
            )}
            controls={controls}
            pending={write.isPending}
            onSave={(body) => write.mutate({ path: '/requests', body })}
          />
        </details>
      )}
      <section className="space-y-4" aria-label="Evidence requests">
        {!data.requests.length && (
          <p className="rounded-xl border bg-white p-6 text-slate-500">No evidence requests yet.</p>
        )}
        {data.requests.map((request) => (
          <RequestCard
            key={request.id}
            request={request}
            attachments={data.attachments.filter((a) => a.request_id === request.id)}
            comments={data.comments.filter((c) => c.request_id === request.id)}
            members={members.filter((m) =>
              (
                data.requestOwnerRoles ?? ['owner', 'admin', 'compliance_manager', 'control_owner']
              ).includes(m.role),
            )}
            controls={controls}
            manager={manager}
            reviewer={manager || role === 'auditor'}
            canSubmit={manager || (role === 'control_owner' && request.owner_id === userId)}
            userId={userId}
            pending={write.isPending}
            onWrite={(path, body) => write.mutate({ path: `/requests/${request.id}${path}`, body })}
          />
        ))}
      </section>
    </div>
  );
}

function RequestCard({
  request,
  attachments,
  comments,
  manager,
  members,
  controls,
  reviewer,
  canSubmit,
  userId,
  pending,
  onWrite,
}: {
  request: RequestRecord;
  attachments: Attachment[];
  comments: Comment[];
  manager: boolean;
  members: TeamMember[];
  controls: Array<{ id: string; title: string }>;
  reviewer: boolean;
  canSubmit: boolean;
  userId?: string;
  pending: boolean;
  onWrite: (path: string, body: unknown) => void;
}) {
  const fmt = useOrgFormat();
  const [search, setSearch] = useState('');
  const { data: evidence = [] } = useQuery({
    queryKey: ['audit-room-evidence', search],
    enabled: canSubmit,
    queryFn: () =>
      evidenceApi
        .list({ q: search, status: 'active', limit: 100 })
        .then((r) => r.data.data.evidence),
  });
  const editable = ['requested', 'needs_revision'].includes(request.status);
  const canDecide = reviewer && request.submitted_by !== userId && request.owner_id !== userId;
  return (
    <article className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold">
            {request.reference} · {request.title}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {request.owner_name ?? 'Unassigned'} · Due {fmt.formatDate(request.due_date, 'No date')}
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold">
          {humanize(request.status)}
        </span>
      </div>
      {manager && (
        <details className="rounded-lg border p-3">
          <summary className="cursor-pointer text-sm font-semibold">
            Edit or reassign request
          </summary>
          <p className="mt-2 text-sm text-slate-600">
            Saving reopens this request and clears its review. The final audit report will need a
            fresh review.
          </p>
          <RequestForm
            key={JSON.stringify(request)}
            request={request}
            members={members}
            controls={controls}
            pending={pending}
            onSave={(body) => onWrite('/update', body)}
          />
          <button
            disabled={pending}
            className="mt-3 text-sm text-rose-700 underline"
            onClick={() => {
              if (
                window.confirm(
                  'Archive this evidence request? Its history is retained; the audit report will need a fresh review.',
                )
              )
                onWrite('/archive', {});
            }}
          >
            Archive request
          </button>
        </details>
      )}
      {request.control_title && (
        <p className="text-sm">
          <strong>Linked control:</strong> {request.control_title}
        </p>
      )}
      {request.requirement && (
        <p className="text-sm">
          <strong>Requirement:</strong> {request.requirement}
        </p>
      )}
      {request.description && (
        <p className="whitespace-pre-wrap text-sm text-slate-600">{request.description}</p>
      )}
      <div>
        <h3 className="text-sm font-semibold">Evidence versions</h3>
        <ul className="mt-2 space-y-2 text-sm">
          {attachments.map((a) => (
            <li key={a.evidence_version_id}>
              <Link className="text-brand-700 underline" to={`/evidence/${a.evidence_id}`}>
                {a.title}
              </Link>{' '}
              · version {a.version_number}
              {canSubmit && editable && (
                <button
                  disabled={pending}
                  className="ml-3 text-rose-700 underline"
                  onClick={() =>
                    onWrite('/evidence/remove', {
                      evidenceId: a.evidence_id,
                      evidenceVersionId: a.evidence_version_id,
                    })
                  }
                >
                  Remove attachment
                </button>
              )}
              {a.current_version_id !== a.evidence_version_id && (
                <span className="ml-2 text-amber-700">
                  A newer version exists; this request retains the submitted version.
                </span>
              )}
            </li>
          ))}
        </ul>
        {!attachments.length && (
          <p className="mt-1 text-sm text-slate-500">No evidence attached.</p>
        )}
      </div>
      {canSubmit && editable && (
        <form
          className="grid gap-2 sm:grid-cols-[1fr_auto]"
          onSubmit={(event) => {
            const v = formValues(event);
            const selected = evidence.find((e) => e.id === v.evidenceId);
            if (selected?.currentVersionId)
              onWrite('/evidence', {
                evidenceId: selected.id,
                evidenceVersionId: selected.currentVersionId,
              });
          }}
        >
          <label className="text-sm sm:col-span-2">
            Find evidence
            <input
              className={inputClass}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title"
            />
          </label>
          <label className="text-sm">
            Evidence to attach
            <select name="evidenceId" required className={inputClass}>
              <option value="">Choose uploaded evidence</option>
              {evidence
                .filter((e) => e.currentVersionId)
                .map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.title} · v{e.currentVersionNumber}
                  </option>
                ))}
            </select>
          </label>
          <button disabled={pending} className={`${buttonClass} self-end`}>
            Attach version
          </button>
        </form>
      )}
      {((canSubmit && editable) ||
        (canDecide && ['submitted', 'accepted'].includes(request.status))) && (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            const v = formValues(event);
            onWrite('/decision', { status: v.status, note: v.note });
          }}
        >
          <label className="min-w-0 flex-1 text-sm">
            Submission or review note
            <textarea name="note" required maxLength={5000} className={inputClass} />
          </label>
          <label className="text-sm">
            Next action
            <select name="status" className={inputClass}>
              {canSubmit && editable && <option value="submitted">Submit for review</option>}
              {canDecide && request.status === 'submitted' && (
                <option value="accepted">Accept evidence</option>
              )}
              {canDecide && ['submitted', 'accepted'].includes(request.status) && (
                <option value="needs_revision">Request revision</option>
              )}
            </select>
          </label>
          <button disabled={pending} className={buttonClass}>
            Record decision
          </button>
        </form>
      )}
      {request.decision_note && (
        <p className="rounded-lg bg-slate-50 p-3 text-sm">Latest note: {request.decision_note}</p>
      )}
      <details>
        <summary className="cursor-pointer text-sm font-semibold">
          Comments ({comments.length})
        </summary>
        <ol className="my-3 space-y-3">
          {comments.map((c) => (
            <li key={c.id} className="rounded-lg bg-slate-50 p-3 text-sm">
              <p className="text-xs text-slate-500">
                {c.author_name} · {fmt.formatDateTime(c.created_at)}
              </p>
              <p className="mt-1 whitespace-pre-wrap">{c.body}</p>
            </li>
          ))}
        </ol>
        {(manager || reviewer || canSubmit) && (
          <form
            className="space-y-2"
            onSubmit={(event) => {
              const v = formValues(event);
              onWrite('/comments', { body: v.body });
            }}
          >
            <label className="text-sm">
              Add a comment
              <textarea required name="body" maxLength={10000} className={inputClass} />
            </label>
            <button disabled={pending} className={buttonClass}>
              Post comment
            </button>
          </form>
        )}
      </details>
    </article>
  );
}

function RequestForm({
  request,
  members,
  controls,
  pending,
  onSave,
}: {
  request?: RequestRecord;
  members: TeamMember[];
  controls: Array<{ id: string; title: string }>;
  pending: boolean;
  onSave: (body: unknown) => void;
}) {
  return (
    <form
      className="mt-4 grid gap-3 sm:grid-cols-2"
      onSubmit={(event) => {
        const v = formValues(event);
        onSave({
          ...v,
          ownerId: v.ownerId || null,
          controlId: v.controlId || null,
          dueDate: v.dueDate || null,
        });
      }}
    >
      <label className="text-sm">
        Reference
        <input
          name="reference"
          defaultValue={request?.reference}
          maxLength={100}
          required
          className={inputClass}
        />
      </label>
      <label className="text-sm">
        Title
        <input
          name="title"
          defaultValue={request?.title}
          maxLength={500}
          required
          className={inputClass}
        />
      </label>
      <label className="text-sm">
        Requirement reference
        <input
          name="requirement"
          defaultValue={request?.requirement ?? ''}
          maxLength={2000}
          className={inputClass}
        />
      </label>
      <label className="text-sm">
        Linked control
        <select name="controlId" defaultValue={request?.control_id ?? ''} className={inputClass}>
          <option value="">No linked control</option>
          {request?.control_id && !controls.some((c) => c.id === request.control_id) && (
            <option value={request.control_id}>
              {request.control_title ?? 'Current linked control'}
            </option>
          )}
          {controls.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        Owner
        <select name="ownerId" defaultValue={request?.owner_id ?? ''} className={inputClass}>
          <option value="">Unassigned</option>
          {request?.owner_id && !members.some((m) => m.userId === request.owner_id) && (
            <option value={request.owner_id} disabled>
              {request.owner_name ?? 'Previous owner'} - choose an active owner
            </option>
          )}
          {members.map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.firstName} {m.lastName} ({m.email})
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        Due date
        <input
          name="dueDate"
          type="date"
          defaultValue={request?.due_date?.slice(0, 10) ?? ''}
          className={inputClass}
        />
      </label>
      <label className="text-sm sm:col-span-2">
        What evidence is needed?
        <textarea
          name="description"
          defaultValue={request?.description ?? ''}
          maxLength={10000}
          className={inputClass}
        />
      </label>
      <button disabled={pending} className={buttonClass + ' justify-self-start'}>
        {request ? 'Save and reopen request' : 'Create request'}
      </button>
    </form>
  );
}
