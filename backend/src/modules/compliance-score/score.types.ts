export interface FrameworkScore {
  frameworkId: string | null;
  frameworkName: string | null;
  score: number | null;
  total: number;
  implemented: number;
  partiallyImplemented: number;
  notImplemented: number;
  notApplicable: number;
  planned: number;
}

export interface ComplianceScore {
  overall: number | null;
  byFramework: FrameworkScore[];
  controlCounts: {
    total: number;
    implemented: number;
    partiallyImplemented: number;
    notImplemented: number;
    notApplicable: number;
    planned: number;
  };
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
