import type { UserRole } from '@/stores/auth.store';

export const ROLE_GUIDANCE: Record<UserRole, { label: string; purpose: string }> = {
  owner: { label: 'Owner', purpose: 'Review organisation-wide progress, decisions and access.' },
  admin: { label: 'Administrator', purpose: 'Keep people, compliance records and organisation settings up to date.' },
  compliance_manager: { label: 'Compliance manager', purpose: 'Coordinate assessments, review evidence and follow up outstanding work.' },
  control_owner: { label: 'Control owner', purpose: 'Keep your assigned safeguards current and provide evidence for review.' },
  auditor: { label: 'Auditor', purpose: 'Examine evidence, test results and findings. Review decisions stay separate from preparing the work.' },
  viewer: { label: 'Viewer', purpose: 'Follow progress and read the records available to you.' },
  msp_admin: { label: 'Service provider administrator', purpose: 'Manage compliance work and authorised access in the selected client organisation.' },
  msp_analyst: { label: 'Service provider analyst', purpose: 'Review the selected client organisation\'s assessments and supporting records.' },
};
