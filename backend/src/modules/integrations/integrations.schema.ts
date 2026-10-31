import { z } from 'zod';
import { webhookUrl } from './connector-network';
export const providers = ['slack','teams','email'] as const;
export const eventTypes = ['approval_requested','approval_decided','approval_deadline_warning','task_assigned','task_comment','control_overdue','expiry_warning','calendar_reminder','score_drop','escalation','reminder','system'] as const;
export const providerSchema = z.enum(providers);
export type Provider = z.infer<typeof providerSchema>;
export const configSchema = z.object({
  events: z.array(z.enum(eventTypes)).min(1).max(eventTypes.length),
  includeDetails: z.boolean().default(false),
  transport: z.enum(['smtp','brevo']).default('smtp'),
  host: z.string().max(253).optional(),
  port: z.union([z.literal(465),z.literal(587)]).default(587),
  from: z.email().optional(),
}).strict();
export const saveSchema = z.object({config:configSchema,secrets:z.object({webhookUrl:z.string().max(4096).optional(),username:z.string().max(320).optional(),password:z.string().max(1000).optional(),apiKey:z.string().max(500).optional()}).strict().default({})}).strict();
export function validateWebhook(provider: Provider, value: string) {if(provider!=='email')webhookUrl(provider,value);}
export type ConnectorConfig = z.infer<typeof configSchema>;
