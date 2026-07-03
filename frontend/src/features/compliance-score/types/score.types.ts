export interface FrameworkScore {
  frameworkId: string;
  frameworkName: string;
  score: number | null;
  controlCounts: {
    implemented: number;
    partiallyImplemented: number;
    notImplemented: number;
    notApplicable: number;
    planned: number;
    total: number;
  };
}

export interface OverallScore {
  overall: number | null;
  frameworks: FrameworkScore[];
  calculatedAt: string;
}

export interface ScoreTrendPoint {
  date: string;
  score: number | null;
}

export interface ScoreSnapshot {
  snapshotDate: string;
  overallScore: number | null;
  frameworkScores: Record<string, number | null>;
  controlCounts: Record<string, number>;
}
