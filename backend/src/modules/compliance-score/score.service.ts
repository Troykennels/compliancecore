import { withTenantSchema } from '../../lib/prisma';
import { controlsRepository } from '../controls/controls.repository';
import { scoreRepository } from './score.repository';
import type { ComplianceScore, FrameworkScore } from './score.types';
import { CRITICALITY_WEIGHT } from '../controls/controls.types';

// Weighted compliance score formula:
//   Each control contributes its criticality weight to the denominator (unless not_applicable).
//   implemented       → full weight
//   partially_implemented → half weight
//   All other statuses  → 0 points
function buildFrameworkScore(
  stats: { implementationStatus: string; criticality: string; count: number }[],
  frameworkId: string | null,
  frameworkName: string | null,
): FrameworkScore {
  let points = 0;
  let maxPoints = 0;
  const counts = { implemented: 0, partiallyImplemented: 0, notImplemented: 0, notApplicable: 0, planned: 0, total: 0 };

  for (const stat of stats) {
    const weight = CRITICALITY_WEIGHT[stat.criticality as keyof typeof CRITICALITY_WEIGHT] ?? 1;
    const count  = stat.count;
    counts.total += count;

    switch (stat.implementationStatus) {
      case 'implemented':
        counts.implemented += count;
        points    += weight * count;
        maxPoints += weight * count;
        break;
      case 'partially_implemented':
        counts.partiallyImplemented += count;
        points    += weight * count * 0.5;
        maxPoints += weight * count;
        break;
      case 'not_implemented':
        counts.notImplemented += count;
        maxPoints += weight * count;
        break;
      case 'planned':
        counts.planned += count;
        maxPoints += weight * count;
        break;
      case 'not_applicable':
        counts.notApplicable += count;
        break;
    }
  }

  return {
    frameworkId,
    frameworkName,
    score: maxPoints === 0 ? null : Math.round((points / maxPoints) * 10000) / 100,
    controlCounts: {
      implemented:          counts.implemented,
      partiallyImplemented: counts.partiallyImplemented,
      notImplemented:       counts.notImplemented,
      notApplicable:        counts.notApplicable,
      planned:              counts.planned,
      total:                counts.total,
    },
  };
}

export const scoreService = {
  async calculateCurrentScore(schemaName: string): Promise<ComplianceScore> {
    return withTenantSchema(schemaName, async (tx) => {
      const allStats = await controlsRepository.getStatusCountsByFramework(tx);

      // Real framework names, keyed by id, from the shared reference catalogue.
      const nameRows = await tx.$queryRaw<{ id: string; name: string }[]>`
        SELECT id, name FROM framework_data.frameworks WHERE deleted_at IS NULL
      `;
      const nameById = new Map(nameRows.map((r) => [r.id, r.name]));

      // Group by frameworkId
      const byFramework = new Map<string | null, typeof allStats>();
      for (const stat of allStats) {
        const key = stat.frameworkId ?? null;
        if (!byFramework.has(key)) byFramework.set(key, []);
        byFramework.get(key)!.push(stat);
      }

      const frameworks: FrameworkScore[] = [];
      for (const [frameworkId, stats] of byFramework) {
        // Label the no-framework bucket explicitly — the frontend types treat
        // frameworkName as non-null and one consumer reads .length on it.
        const frameworkName = frameworkId ? nameById.get(frameworkId) ?? 'Unmapped' : 'Unmapped';
        frameworks.push(buildFrameworkScore(stats, frameworkId, frameworkName));
      }

      // Overall: aggregate across all controls regardless of framework
      const overallFrame = buildFrameworkScore(allStats, null, 'All Frameworks');
      const overall = overallFrame.score;
      const controlCounts = overallFrame.controlCounts;

      return { overall, frameworks, controlCounts, calculatedAt: new Date() };
    });
  },

  async getScoreTrend(schemaName: string, days = 180) {
    return withTenantSchema(schemaName, (tx) => scoreRepository.getTrend(tx, days));
  },

  async getLatestSnapshot(schemaName: string) {
    return withTenantSchema(schemaName, (tx) => scoreRepository.getLatestSnapshot(tx));
  },

  // Called by the daily snapshot job
  async takeSnapshot(schemaName: string): Promise<void> {
    const score = await scoreService.calculateCurrentScore(schemaName);

    const frameworkScoresMap: Record<string, unknown> = {};
    for (const fs of score.frameworks) {
      frameworkScoresMap[fs.frameworkId ?? 'ungrouped'] = fs;
    }

    await withTenantSchema(schemaName, (tx) =>
      scoreRepository.saveSnapshot(tx, {
        snapshotDate:    new Date(),
        overallScore:    score.overall,
        frameworkScores: frameworkScoresMap,
        controlCounts:   score.controlCounts as unknown as Record<string, number>,
      }),
    );
  },
};
