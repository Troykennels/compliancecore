import { Prisma } from '@prisma/client';
import { withTenantSchema } from '../../lib/prisma';
import type { AnalyticsOverview } from './analytics.types';

type Tx = Prisma.TransactionClient;

// Tables this module aggregates over. Every one is provisioned from the tenant
// template, but we still guard each block so a tenant that predates a given
// table (or a partially-provisioned schema) returns zeros for it rather than
// 500-ing — and, critically, so a missing table never errors mid-transaction.
const AGG_TABLES = [
  'controls',
  'risks',
  'policies',
  'vendors',
  'audit_findings',
  'training_records',
  'training_programs',
  'audits',
] as const;

interface GroupRow {
  key: string;
  count: number;
}

/**
 * Which of the aggregate tables actually exist in the tenant schema.
 *
 * We probe up front with a single catalog query rather than wrapping each count
 * in try/catch: inside a Postgres transaction (withTenantSchema opens one), a
 * query against a non-existent table aborts the whole transaction, so every
 * subsequent statement would fail too. Checking existence first keeps each block
 * independent — a tenant missing one table still gets counts for the rest.
 */
async function presentTables(tx: Tx): Promise<Set<string>> {
  const rows = await tx.$queryRaw<{ table_name: string }[]>`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = current_schema()
  `;
  return new Set(rows.map((r) => r.table_name));
}

// Turn GROUP BY rows into a fully-populated record keyed on the expected buckets,
// defaulting every bucket to 0 and ignoring any unexpected keys.
function tally<T extends string>(rows: GroupRow[], keys: readonly T[]): Record<T, number> {
  const out = {} as Record<T, number>;
  for (const k of keys) out[k] = 0;
  for (const r of rows) {
    if ((keys as readonly string[]).includes(r.key)) {
      out[r.key as T] = Number(r.count);
    }
  }
  return out;
}

// Extract a single COUNT(*) scalar from a one-row result set.
function firstCount(rows: { count: number }[]): number {
  return rows[0] ? Number(rows[0].count) : 0;
}

export const analyticsService = {
  async getOverview(schemaName: string): Promise<AnalyticsOverview> {
    // This aggregation runs many sequential counts in one transaction; give it
    // generous headroom so a slow DB doesn't trip the default 5s interactive
    // timeout. On a fast (prod) DB this completes in well under a second.
    return withTenantSchema(schemaName, async (tx) => {
      const has = await presentTables(tx);

      // ── Controls by implementation status ────────────────────────────────
      let controlsByStatus = {
        implemented: 0,
        partially_implemented: 0,
        not_implemented: 0,
        planned: 0,
        not_applicable: 0,
      };
      if (has.has('controls')) {
        const rows = await tx.$queryRaw<GroupRow[]>`
          SELECT implementation_status AS key, COUNT(*)::int AS count
          FROM controls
          WHERE deleted_at IS NULL
          GROUP BY implementation_status
        `;
        controlsByStatus = tally(rows, [
          'implemented',
          'partially_implemented',
          'not_implemented',
          'planned',
          'not_applicable',
        ]);
      }

      // ── Risks bucketed by residual score, plus lifecycle status ──────────
      let risksBySeverity = { high: 0, medium: 0, low: 0 };
      let risksByStatus = { open: 0, in_treatment: 0, mitigated: 0, accepted: 0, closed: 0 };
      if (has.has('risks')) {
        const severityRows = await tx.$queryRaw<GroupRow[]>`
          SELECT
            CASE
              WHEN residual_score >= 15 THEN 'high'
              WHEN residual_score >= 8  THEN 'medium'
              ELSE 'low'
            END AS key,
            COUNT(*)::int AS count
          FROM risks
          WHERE deleted_at IS NULL
          GROUP BY 1
        `;
        risksBySeverity = tally(severityRows, ['high', 'medium', 'low']);

        const statusRows = await tx.$queryRaw<GroupRow[]>`
          SELECT status AS key, COUNT(*)::int AS count
          FROM risks
          WHERE deleted_at IS NULL
          GROUP BY status
        `;
        risksByStatus = tally(statusRows, ['open', 'in_treatment', 'mitigated', 'accepted', 'closed']);
      }

      // ── Policies by status ───────────────────────────────────────────────
      let policiesByStatus = { draft: 0, in_review: 0, approved: 0, published: 0, archived: 0 };
      if (has.has('policies')) {
        const rows = await tx.$queryRaw<GroupRow[]>`
          SELECT status AS key, COUNT(*)::int AS count
          FROM policies
          WHERE deleted_at IS NULL
          GROUP BY status
        `;
        policiesByStatus = tally(rows, ['draft', 'in_review', 'approved', 'published', 'archived']);
      }

      // ── Vendors by risk level ────────────────────────────────────────────
      let vendorsByRisk = { critical: 0, high: 0, medium: 0, low: 0 };
      if (has.has('vendors')) {
        const rows = await tx.$queryRaw<GroupRow[]>`
          SELECT risk_level AS key, COUNT(*)::int AS count
          FROM vendors
          WHERE deleted_at IS NULL
          GROUP BY risk_level
        `;
        vendorsByRisk = tally(rows, ['critical', 'high', 'medium', 'low']);
      }

      // ── Open audit findings ──────────────────────────────────────────────
      let openAuditFindings = 0;
      if (has.has('audit_findings')) {
        const rows = await tx.$queryRaw<{ count: number }[]>`
          SELECT COUNT(*)::int AS count
          FROM audit_findings
          WHERE status = 'open'
        `;
        openAuditFindings = firstCount(rows);
      }

      // ── Training completion ──────────────────────────────────────────────
      let trainingCompletion = { completed: 0, assigned: 0, overdue: 0 };
      if (has.has('training_records')) {
        const rows = await tx.$queryRaw<GroupRow[]>`
          SELECT status AS key, COUNT(*)::int AS count
          FROM training_records
          GROUP BY status
        `;
        trainingCompletion = tally(rows, ['completed', 'assigned', 'overdue']);
      }

      // ── Totals per module ────────────────────────────────────────────────
      const totals = {
        controls: 0,
        risks: 0,
        policies: 0,
        vendors: 0,
        audits: 0,
        trainingPrograms: 0,
      };
      if (has.has('controls')) {
        totals.controls = firstCount(
          await tx.$queryRaw<{ count: number }[]>`SELECT COUNT(*)::int AS count FROM controls WHERE deleted_at IS NULL`,
        );
      }
      if (has.has('risks')) {
        totals.risks = firstCount(
          await tx.$queryRaw<{ count: number }[]>`SELECT COUNT(*)::int AS count FROM risks WHERE deleted_at IS NULL`,
        );
      }
      if (has.has('policies')) {
        totals.policies = firstCount(
          await tx.$queryRaw<{ count: number }[]>`SELECT COUNT(*)::int AS count FROM policies WHERE deleted_at IS NULL`,
        );
      }
      if (has.has('vendors')) {
        totals.vendors = firstCount(
          await tx.$queryRaw<{ count: number }[]>`SELECT COUNT(*)::int AS count FROM vendors WHERE deleted_at IS NULL`,
        );
      }
      if (has.has('audits')) {
        totals.audits = firstCount(
          await tx.$queryRaw<{ count: number }[]>`SELECT COUNT(*)::int AS count FROM audits WHERE deleted_at IS NULL`,
        );
      }
      if (has.has('training_programs')) {
        totals.trainingPrograms = firstCount(
          await tx.$queryRaw<{ count: number }[]>`SELECT COUNT(*)::int AS count FROM training_programs WHERE deleted_at IS NULL`,
        );
      }

      return {
        controlsByStatus,
        risksBySeverity,
        risksByStatus,
        policiesByStatus,
        vendorsByRisk,
        openAuditFindings,
        trainingCompletion,
        totals,
      };
    }, { timeout: 20_000, maxWait: 10_000 });
  },
};

// Referenced only to keep the AGG_TABLES documentation list in sync with the
// tables probed above; exported for tests/introspection.
export const analyticsAggregateTables = AGG_TABLES;
