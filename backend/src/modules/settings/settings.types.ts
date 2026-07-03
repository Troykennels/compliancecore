export type UserRole =
  | 'owner'
  | 'admin'
  | 'compliance_manager'
  | 'control_owner'
  | 'auditor'
  | 'viewer';

export interface TeamMember {
  id: string;         // membership id
  userId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  role: UserRole;
  isActive: boolean;
  emailVerifiedAt: Date | null;
  joinedAt: Date | null;
  invitedBy: string | null;
  inviterEmail: string | null;
  createdAt: Date;
}

export interface InviteMemberDto {
  email: string;
  role: UserRole;
}

export interface UpdateMemberRoleDto {
  role: UserRole;
}

export interface ApiKeyPublic {
  id: string;
  name: string;
  keyPrefix: string;
  permissions: string[];
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
}

export interface ApiKeyCreated extends ApiKeyPublic {
  rawKey: string; // shown once, not stored
}

export interface CreateApiKeyDto {
  name: string;
  permissions: string[];
  expiresAt?: Date | null;
}

export interface WebhookPublic {
  id: string;
  name: string;
  url: string;
  events: string[];
  isActive: boolean;
  lastTriggeredAt: Date | null;
  lastStatusCode: number | null;
  failureCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateWebhookDto {
  name: string;
  url: string;
  events: string[];
}

export interface UpdateWebhookDto extends Partial<CreateWebhookDto> {
  isActive?: boolean;
}

export interface WebhookCreated extends WebhookPublic {
  secret: string; // HMAC-SHA256 signing secret, shown once
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
