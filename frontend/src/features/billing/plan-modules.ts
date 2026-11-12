import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth.store';
import { PATHS } from '@/routes/paths';

// Plan modules (catalogue 2026.2). Same keys as the API (backend
// src/lib/plan-modules.ts), which is what actually enforces a lock; this file
// only shows it. A module is locked only when the plan explicitly switches it
// off; earlier plans (and grandfathered customers) have every module.

export interface ModuleInfo { key: string; label: string; benefit: string }

export const PLAN_MODULE_INFO: ModuleInfo[] = [
  { key: 'risks', label: 'Risk assessment', benefit: 'Score, treat and track risks with owners and review dates.' },
  { key: 'policy_templates', label: 'Policy templates', benefit: 'Start policies from ready-made templates instead of a blank page.' },
  { key: 'audits', label: 'Audits', benefit: 'Plan audits, record findings and follow corrective actions to closure.' },
  { key: 'approvals', label: 'Approvals', benefit: 'Route documents and decisions for sign-off with a full trail.' },
  { key: 'training', label: 'Training', benefit: 'Assign training, track completion and keep proof for auditors.' },
  { key: 'incidents', label: 'Incidents', benefit: 'Log, investigate and report incidents within deadlines.' },
  { key: 'analytics', label: 'Analytics (enhanced reporting)', benefit: 'Trends and breakdowns across frameworks, risks and tasks.' },
  { key: 'signatures', label: 'Signatures', benefit: 'Collect verifiable electronic signatures on policies and records.' },
  { key: 'vendors', label: 'Vendors', benefit: 'Assess and monitor third parties and their documents.' },
  { key: 'escalations', label: 'Escalations', benefit: 'Escalate overdue or high-risk items automatically to the right people.' },
  { key: 'privacy_ropa', label: 'Records of processing', benefit: 'Keep the record of processing activities privacy laws require.' },
  { key: 'privacy_dsar', label: 'Data subject requests', benefit: 'Receive, track and answer data subject requests on time.' },
  { key: 'privacy_dpia', label: 'Impact assessments', benefit: 'Run and decide data protection impact assessments.' },
  { key: 'msp_portfolio', label: 'Client portfolio', benefit: 'Manage several client organisations from one portfolio.' },
  { key: 'scheduled_reports', label: 'Scheduled reports (advanced reporting)', benefit: 'Send board and management reports automatically on a schedule.' },
  { key: 'integrations', label: 'Integrations', benefit: 'Connect approved tools so evidence and alerts flow in automatically.' },
  { key: 'ai', label: 'AI tools', benefit: 'Draft and review with AI assistance (always checked by a person).' },
];
export const MODULE_INFO: Record<string, ModuleInfo> = Object.fromEntries(PLAN_MODULE_INFO.map((m) => [m.key, m]));

// Menu path -> module. Pages not listed are never locked.
export const PATH_MODULE: Record<string, string> = {
  [PATHS.RISKS]: 'risks',
  [PATHS.POLICY_TEMPLATES]: 'policy_templates',
  [PATHS.AUDITS]: 'audits',
  [PATHS.APPROVALS]: 'approvals',
  [PATHS.TRAINING]: 'training',
  [PATHS.INCIDENTS]: 'incidents',
  [PATHS.ANALYTICS]: 'analytics',
  [PATHS.SIGNATURES]: 'signatures',
  [PATHS.VENDORS]: 'vendors',
  [PATHS.ESCALATIONS]: 'escalations',
  [PATHS.PRIVACY_ROPA]: 'privacy_ropa',
  [PATHS.PRIVACY_DSAR]: 'privacy_dsar',
  [PATHS.PRIVACY_DPIA]: 'privacy_dpia',
  [PATHS.MSP_PORTFOLIO]: 'msp_portfolio',
  [PATHS.INTEGRATIONS]: 'integrations',
  [PATHS.AI_TOOLS]: 'ai',
};

/** The module behind a page path (exact or its first two segments), or null. */
export function moduleForPath(pathname: string): string | null {
  if (PATH_MODULE[pathname]) return PATH_MODULE[pathname];
  const parts = pathname.split('/').filter(Boolean);
  for (let n = parts.length - 1; n >= 1; n--) {
    const key = '/' + parts.slice(0, n).join('/');
    if (PATH_MODULE[key]) return PATH_MODULE[key];
  }
  return null;
}

export interface EntitlementData {
  state: 'trialing' | 'active' | 'expiring' | 'grace' | 'read_only' | 'suspended' | 'cancelled';
  canWrite: boolean;
  expiresAt: string | null;
  daysRemaining: number | null;
  hoursRemaining: number | null;
  planName: string | null;
  planSlug: string | null;
  lockedModules: string[];
  aiRequestsMonthly: number | null;
  aiRequestsUsed: number | null;
}

/** The organisation's entitlement (shared with the banner's request). */
export function useEntitlement() {
  return useQuery<EntitlementData | null>({
    queryKey: ['billing', 'entitlement'],
    queryFn: async () => (await apiClient.get('/billing/entitlement')).data.data,
    staleTime: 60_000,
    retry: false,
  });
}

/** Locked module keys; empty for the platform owner, while loading, and on any problem. */
export function usePlanLocks(): Set<string> {
  const isSuperadmin = useAuthStore((s) => s.user?.isSuperadmin);
  const { data } = useEntitlement();
  const list = data?.lockedModules;
  return useMemo(() => new Set(!isSuperadmin && Array.isArray(list) ? list : []), [list, isSuperadmin]);
}
