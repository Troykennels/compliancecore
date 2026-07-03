export type MemberRole = 'owner' | 'admin' | 'compliance_manager' | 'control_owner' | 'auditor' | 'viewer';

export interface TeamMember {
  id: string;
  userId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  role: MemberRole;
  isActive: boolean;
  emailVerifiedAt: string | null;
  joinedAt: string | null;
  invitedBy: string | null;
  inviterEmail: string | null;
  createdAt: string;
}

export interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  permissions: string[];
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface ApiKeyCreated extends ApiKey {
  rawKey: string;
}

export interface Webhook {
  id: string;
  name: string;
  url: string;
  events: string[];
  isActive: boolean;
  lastTriggeredAt: string | null;
  lastStatusCode: number | null;
  failureCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookCreated extends Webhook {
  secret: string;
}

export interface NotificationSettings {
  emailAlerts: {
    controlDue: boolean;
    controlOverdue: boolean;
    evidenceRequested: boolean;
    auditStarted: boolean;
    riskCreated: boolean;
    incidentCreated: boolean;
    frameworkAssigned: boolean;
  };
  digestFrequency: 'realtime' | 'daily' | 'weekly' | 'never';
  slackWebhookUrl: string | null;
  teamsWebhookUrl: string | null;
}

export const ROLE_LABELS: Record<MemberRole, string> = {
  owner:              'Owner',
  admin:              'Admin',
  compliance_manager: 'Compliance Manager',
  control_owner:      'Control Owner',
  auditor:            'Auditor',
  viewer:             'Viewer',
};

export const WEBHOOK_EVENTS = [
  { value: 'control.created',    label: 'Control Created' },
  { value: 'control.updated',    label: 'Control Updated' },
  { value: 'control.completed',  label: 'Control Completed' },
  { value: 'control.overdue',    label: 'Control Overdue' },
  { value: 'evidence.uploaded',  label: 'Evidence Uploaded' },
  { value: 'evidence.requested', label: 'Evidence Requested' },
  { value: 'framework.assigned', label: 'Framework Assigned' },
  { value: 'risk.created',       label: 'Risk Created' },
  { value: 'risk.updated',       label: 'Risk Updated' },
  { value: 'audit.started',      label: 'Audit Started' },
  { value: 'audit.completed',    label: 'Audit Completed' },
  { value: 'incident.created',   label: 'Incident Created' },
  { value: 'incident.resolved',  label: 'Incident Resolved' },
  { value: 'user.invited',       label: 'User Invited' },
  { value: 'user.removed',       label: 'User Removed' },
] as const;
