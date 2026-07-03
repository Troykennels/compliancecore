import { Prisma } from '@prisma/client';
import type { ScoreSnapshot, ScoreTrend } from './score.types';

type Tx = Prisma.TransactionClient;

export const scoreRepository = {
  async saveSnapshot(
    tx: Tx,
    data: {
      snapshotDate: Date;
      overallScore: number | null;
      frameworkScores: Record<string, unknown>;
      controlCounts: Record<string, number>;
    },
  ): Promise<void> {
    await tx.$executeRaw`
      INSERT INTO compliance_score_snapshots (snapshot_date, overall_score, framework_scores, control_counts)
      VALUES (
        ${data.snapshotDate}::date,
        ${data.overallScore},
        ${JSON.stringify(data.frameworkScores)}::jsonb,
        ${JSON.stringify(data.controlCounts)}::jsonb
      )
      ON CONFLICT (snapshot_date) DO UPDATE SET
        overall_score    = EXCLUDED.overall_score,
        framework_scores = EXCLUDED.framework_scores,
        control_counts   = EXCLUDED.control_counts
    `;
  },

  async getLatestSnapshot(tx: Tx): Promise<ScoreSnapshot | null> {
    const rows = await tx.$queryRaw<Record<string, unknown>[]>`
      SELECT id, snapshot_date AS "snapshotDate", overall_score AS "overallScore",
             framework_scores AS "frameworkScores", control_counts AS "controlCounts",
             created_at AS "createdAt"
      FROM compliance_score_snapshots
      ORDER BY snapshot_date DESC
      LIMIT 1
    `;
    if (!rows[0]) return null;
    const r = rows[0];
    return {
      id:              r.id as string,
      snapshotDate:    new Date(r.snapshotDate as string),
      overallScore:    r.overallScore !== null ? Number(r.overallScore) : null,
      frameworkScores: r.frameworkScores as Record<string, never>,
      controlCounts:   r.controlCounts as ScoreSnapshot['controlCounts'],
      createdAt:       new Date(r.createdAt as string),
    };
  },

  async getTrend(tx: Tx, days: number): Promise<ScoreTrend[]> {
    const rows = await tx.$queryRaw<{ snapshotDate: Date; overallScore: number | null }[]>`
      SELECT snapshot_date AS "snapshotDate", overall_score AS "overallScore"
      FROM compliance_score_snapshots
      WHERE snapshot_date >= CURRENT_DATE - (${days} || ' days')::interval
      ORDER BY snapshot_date ASC
    `;
    return rows.map((r) => ({
      date:  r.snapshotDate.toISOString().split('T')[0],
      score: r.overallScore !== null ? Number(r.overallScore) : null,
    }));
  },
};
