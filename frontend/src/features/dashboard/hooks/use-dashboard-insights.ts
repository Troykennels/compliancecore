import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

/**
 * Data for the expanded dashboard.
 *
 * Every figure here is derived in the browser from endpoints that already
 * exist — no new routes, no change to any service, repository or query. Where a
 * widget needs an aggregate the API does not offer, the rows are fetched and
 * grouped here rather than adding backend surface.
 *
 * The queries are deliberately separate so one slow or failing module degrades
 * its own card instead of blanking the dashboard.
 */

/**
 * Per-page maximum, which is NOT the same on every endpoint — tasks validates
 * `limit` at 100 while controls, risks and policies allow 200. Sending one
 * blanket value gets a 422 from whichever module has the lower cap.
 */
const PAGE_LIMIT = { default: 200, tasks: 100 } as const;

async function fetchAll<T>(
  path: string,
  pick: (d: unknown) => { items: T[]; total: number },
  limit: number = PAGE_LIMIT.default,
): Promise<T[]> {
  const url = (page: number) =>
    `${path}${path.includes('?') ? '&' : '?'}limit=${limit}&page=${page}`;

  // Most tenants fit in one page. Pull further pages only when the total says so,
  // and stop at 5 to keep a very large tenant from stalling the dashboard.
  const first = await apiClient.get(url(1));
  const { items, total } = pick(first.data.data);
  const pages = Math.min(Math.ceil(total / limit), 5);
  if (pages <= 1) return items;

  const rest = await Promise.all(
    Array.from({ length: pages - 1 }, (_, i) =>
      apiClient
        .get(url(i + 2))
        .then((r) => pick(r.data.data).items)
        .catch(() => [] as T[]),
    ),
  );
  return items.concat(...rest);
}

// ── Shapes we read (subset of each module's model) ──────────────────────────
export interface ControlRow {
  id: string;
  controlRef: string;
  title: string;
  category: string | null;
  criticality: 'critical' | 'high' | 'medium' | 'low';
  implementationStatus: string;
  ownerName?: string | null;
  dueDate?: string | null;
}
export interface RiskRow {
  id: string; title: string; status: string; category: string;
  inherentScore?: number; residualScore?: number; createdAt: string; updatedAt: string;
}
export interface TaskRow {
  id: string; title: string; status: string; priority: string;
  assigneeName?: string | null; dueDate?: string | null; completedAt?: string | null;
}
export interface PolicyRow {
  id: string; title: string; status: string; reviewDueDate: string | null; ownerName?: string | null;
}
export interface AuditRow { id: string; title: string; status: string; }
export interface FindingRow {
  id: string; title: string; severity: string; status?: string; createdAt?: string; auditTitle?: string;
}

export function useControlsForInsights() {
  return useQuery({
    queryKey: ['insights', 'controls'],
    queryFn: () => fetchAll<ControlRow>('/controls', (d) => {
      const x = d as { controls?: ControlRow[]; items?: ControlRow[]; total: number };
      return { items: x.controls ?? x.items ?? [], total: x.total ?? 0 };
    }),
    staleTime: 60_000,
  });
}

export function useRisksForInsights() {
  return useQuery({
    queryKey: ['insights', 'risks'],
    queryFn: () => fetchAll<RiskRow>('/risks', (d) => {
      const x = d as { risks?: RiskRow[]; items?: RiskRow[]; total: number };
      return { items: x.risks ?? x.items ?? [], total: x.total ?? 0 };
    }),
    staleTime: 60_000,
  });
}

export function useTasksForInsights() {
  return useQuery({
    queryKey: ['insights', 'tasks'],
    queryFn: () => fetchAll<TaskRow>('/tasks', (d) => {
      const x = d as { items?: TaskRow[]; total: number };
      return { items: x.items ?? [], total: x.total ?? 0 };
    }, PAGE_LIMIT.tasks),
    staleTime: 60_000,
  });
}

export function usePoliciesForInsights() {
  return useQuery({
    queryKey: ['insights', 'policies'],
    queryFn: () => fetchAll<PolicyRow>('/policies?sortBy=review_due_date&sortDir=asc', (d) => {
      const x = d as { policies?: PolicyRow[]; items?: PolicyRow[]; total: number };
      return { items: x.policies ?? x.items ?? [], total: x.total ?? 0 };
    }),
    staleTime: 60_000,
  });
}

/**
 * Recent findings across audits.
 *
 * Findings are only exposed per audit, so this walks the most recent few rather
 * than every one — enough for a "recent findings" card, and it bounds the
 * request count instead of issuing one per audit in the tenant.
 */
export function useRecentFindings() {
  return useQuery({
    queryKey: ['insights', 'findings'],
    queryFn: async (): Promise<FindingRow[]> => {
      const res = await apiClient.get('/audits?limit=5&sortDir=desc');
      const payload = res.data.data as { audits?: AuditRow[]; items?: AuditRow[] };
      const audits = payload.audits ?? payload.items ?? [];

      const perAudit = await Promise.all(
        audits.slice(0, 5).map((a) =>
          apiClient
            .get(`/audits/${a.id}/findings`)
            .then((r) => {
              const d = r.data.data as { findings?: FindingRow[]; items?: FindingRow[] } | FindingRow[];
              const list = Array.isArray(d) ? d : d.findings ?? d.items ?? [];
              return list.map((f) => ({ ...f, auditTitle: a.title }));
            })
            .catch(() => [] as FindingRow[]),
        ),
      );
      return perAudit.flat();
    },
    staleTime: 60_000,
  });
}

// ── Derivations ────────────────────────────────────────────────────────────

const IMPLEMENTED_WEIGHT: Record<string, number> = {
  implemented: 1, partially_implemented: 0.5,
};

/** Percentage implemented, with partial counted as half. Excludes N/A. */
export function implementationPct(controls: ControlRow[]): number | null {
  const inScope = controls.filter((c) => c.implementationStatus !== 'not_applicable');
  if (!inScope.length) return null;
  const earned = inScope.reduce((sum, c) => sum + (IMPLEMENTED_WEIGHT[c.implementationStatus] ?? 0), 0);
  return Math.round((earned / inScope.length) * 100);
}

export interface HeatCell { category: string; criticality: string; total: number; pct: number | null }

/** Category × criticality grid — where the gaps actually are. */
export function buildHeatmap(controls: ControlRow[]): { categories: string[]; cells: HeatCell[] } {
  const CRITS = ['critical', 'high', 'medium', 'low'];
  const byCategory = new Map<string, ControlRow[]>();
  for (const c of controls) {
    const key = c.category?.trim() || 'Uncategorised';
    if (!byCategory.has(key)) byCategory.set(key, []);
    byCategory.get(key)!.push(c);
  }
  // Busiest categories first, capped so the grid stays readable.
  const categories = [...byCategory.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 10)
    .map(([name]) => name);

  const cells: HeatCell[] = [];
  for (const category of categories) {
    for (const criticality of CRITS) {
      const subset = (byCategory.get(category) ?? []).filter((c) => c.criticality === criticality);
      cells.push({ category, criticality, total: subset.length, pct: implementationPct(subset) });
    }
  }
  return { categories, cells };
}

export interface OwnerRank { owner: string; total: number; pct: number }

/**
 * Ranking by control owner.
 *
 * This is deliberately by OWNER, not department: no table links a control,
 * risk or task to a department, so a department ranking cannot be computed from
 * the data that exists. Owner is the closest true signal.
 */
export function rankByOwner(controls: ControlRow[]): OwnerRank[] {
  const byOwner = new Map<string, ControlRow[]>();
  for (const c of controls) {
    const key = c.ownerName?.trim() || 'Unassigned';
    if (!byOwner.has(key)) byOwner.set(key, []);
    byOwner.get(key)!.push(c);
  }
  return [...byOwner.entries()]
    .map(([owner, list]) => ({ owner, total: list.length, pct: implementationPct(list) ?? 0 }))
    .sort((a, b) => b.pct - a.pct || b.total - a.total)
    .slice(0, 8);
}

export interface RiskPoint { month: string; opened: number; closed: number }

/**
 * Risks opened vs closed by month.
 *
 * There is no risk history table, so "closed" is inferred from a risk currently
 * in a resolved state and the month it was last updated. That is an
 * approximation, and it is the honest limit of what the stored data supports.
 */
export function riskTrend(risks: RiskRow[], months = 6): RiskPoint[] {
  const CLOSED = new Set(['mitigated', 'accepted', 'closed']);
  const now = new Date();
  const buckets: RiskPoint[] = [];
  const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({
      month: d.toLocaleString('en-GB', { month: 'short' }),
      opened: 0,
      closed: 0,
    });
  }
  const index = new Map<string, number>();
  for (let i = months - 1, slot = 0; i >= 0; i--, slot++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    index.set(key(d), slot);
  }

  for (const r of risks) {
    const openedSlot = index.get(key(new Date(r.createdAt)));
    if (openedSlot !== undefined) buckets[openedSlot].opened++;
    if (CLOSED.has(r.status)) {
      const closedSlot = index.get(key(new Date(r.updatedAt)));
      if (closedSlot !== undefined) buckets[closedSlot].closed++;
    }
  }
  return buckets;
}

export interface ProductivityRow { name: string; completed: number; open: number; overdue: number }

export function teamProductivity(tasks: TaskRow[]): ProductivityRow[] {
  const now = Date.now();
  const byPerson = new Map<string, ProductivityRow>();
  for (const t of tasks) {
    const name = t.assigneeName?.trim() || 'Unassigned';
    if (!byPerson.has(name)) byPerson.set(name, { name, completed: 0, open: 0, overdue: 0 });
    const row = byPerson.get(name)!;
    if (t.status === 'completed') row.completed++;
    else {
      row.open++;
      if (t.dueDate && new Date(t.dueDate).getTime() < now) row.overdue++;
    }
  }
  return [...byPerson.values()]
    .sort((a, b) => b.completed + b.open - (a.completed + a.open))
    .slice(0, 6);
}

export interface Recommendation { id: string; severity: 'high' | 'medium' | 'low'; text: string; action?: string }

/**
 * Recommendations derived from the tenant's own numbers.
 *
 * Rule-based rather than a model call: these need to be instant, free, and the
 * same every time the page loads. A language model would be slower, cost money
 * per render, and could word the same situation differently on each refresh —
 * none of which suits a dashboard card.
 */
export function buildRecommendations(input: {
  controls: ControlRow[];
  risks: RiskRow[];
  tasks: TaskRow[];
  policies: PolicyRow[];
  overdueExpiry: number;
  score: number | null;
}): Recommendation[] {
  const out: Recommendation[] = [];
  const { controls, risks, tasks, policies, overdueExpiry, score } = input;

  const criticalOpen = controls.filter(
    (c) => c.criticality === 'critical' && c.implementationStatus === 'not_implemented',
  );
  if (criticalOpen.length) {
    out.push({
      id: 'critical-controls',
      severity: 'high',
      text: `${criticalOpen.length} critical control${criticalOpen.length === 1 ? '' : 's'} not implemented. These move your score most.`,
      action: 'Review controls',
    });
  }

  const unowned = controls.filter((c) => !c.ownerName);
  if (unowned.length > 0) {
    out.push({
      id: 'unowned',
      severity: unowned.length > controls.length / 2 ? 'high' : 'medium',
      text: `${unowned.length} control${unowned.length === 1 ? ' has' : 's have'} no owner. Unowned controls rarely get done.`,
      action: 'Assign owners',
    });
  }

  const overdueTasks = tasks.filter(
    (t) => t.status !== 'completed' && t.dueDate && new Date(t.dueDate).getTime() < Date.now(),
  );
  if (overdueTasks.length) {
    out.push({
      id: 'overdue-tasks',
      severity: 'medium',
      text: `${overdueTasks.length} task${overdueTasks.length === 1 ? ' is' : 's are'} past their due date.`,
      action: 'Open tasks',
    });
  }

  const staleReviews = policies.filter(
    (p) => p.reviewDueDate && new Date(p.reviewDueDate).getTime() < Date.now(),
  );
  if (staleReviews.length) {
    out.push({
      id: 'policy-review',
      severity: 'medium',
      text: `${staleReviews.length} polic${staleReviews.length === 1 ? 'y is' : 'ies are'} overdue for review. Auditors check review dates.`,
      action: 'Review policies',
    });
  }

  const untreated = risks.filter((r) => r.status === 'open');
  if (untreated.length) {
    out.push({
      id: 'open-risks',
      severity: untreated.length > 5 ? 'high' : 'low',
      text: `${untreated.length} risk${untreated.length === 1 ? '' : 's'} still open with no treatment recorded.`,
      action: 'Open risk register',
    });
  }

  if (overdueExpiry > 0) {
    out.push({
      id: 'expiring',
      severity: 'high',
      text: `${overdueExpiry} tracked item${overdueExpiry === 1 ? '' : 's'} expiring within 30 days.`,
      action: 'Open expiry tracker',
    });
  }

  if (!out.length) {
    out.push({
      id: 'clear',
      severity: 'low',
      text: score !== null && score >= 80
        ? 'Nothing urgent. Keep review dates current so this stays true.'
        : 'Nothing urgent outstanding. Work through unimplemented controls to raise your score.',
    });
  }

  const rank = { high: 0, medium: 1, low: 2 };
  return out.sort((a, b) => rank[a.severity] - rank[b.severity]).slice(0, 5);
}
