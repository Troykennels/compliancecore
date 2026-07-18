export interface FrameworkControlCounts {
  implemented: number;
  partiallyImplemented: number;
  notImplemented: number;
  notApplicable: number;
  planned: number;
  total: number;
}

export interface FrameworkScore {
  frameworkId: string | null;
  frameworkName: string | null;
  score: number | null;
  controlCounts: FrameworkControlCounts;
}

export interface ComplianceScore {
  overall: number | null;
  // Per-framework breakdown. Matches the frontend `OverallScore.frameworks`
  // shape (counts nested under `controlCounts`).
  frameworks: FrameworkScore[];
  // Aggregate counts across all frameworks — persisted with each snapshot.
  controlCounts: FrameworkControlCounts;
  calculatedAt: Date;
}

export interface ScoreSnapshot {
  id: string;
  snapshotDate: Date;
  overallScore: number | null;
  frameworkScores: Record<string, FrameworkScore>;
  controlCounts: {
    total: number;
    implemented: number;
    partiallyImplemented: number;
    notImplemented: number;
    notApplicable: number;
    planned: number;
  };
  createdAt: Date;
}

export interface ScoreTrend {
  date: string;
  score: number | null;
}
