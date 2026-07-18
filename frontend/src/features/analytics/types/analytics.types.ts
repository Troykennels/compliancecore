export interface AnalyticsOverview {
  controlsByStatus: {
    implemented: number;
    partially_implemented: number;
    not_implemented: number;
    planned: number;
    not_applicable: number;
  };
  risksBySeverity: {
    high: number;
    medium: number;
    low: number;
  };
  risksByStatus: {
    open: number;
    in_treatment: number;
    mitigated: number;
    accepted: number;
    closed: number;
  };
  policiesByStatus: {
    draft: number;
    in_review: number;
    approved: number;
    published: number;
    archived: number;
  };
  vendorsByRisk: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  openAuditFindings: number;
  trainingCompletion: {
    completed: number;
    assigned: number;
    overdue: number;
  };
  totals: {
    controls: number;
    risks: number;
    policies: number;
    vendors: number;
    audits: number;
    trainingPrograms: number;
  };
}
