// ── Primitives ─────────────────────────────────────────────────────────────────
export type PlanSlug = 'starter' | 'professional' | 'business' | 'enterprise' | 'msp';

/**
 * Plans sold by conversation rather than checkout.
 *
 * Presentation only — these still carry a real price so the paid-plan guard in
 * createSubscription/updateSubscription keeps blocking self-assignment. The UI
 * shows "Contact Sales" instead of a figure and a Subscribe button.
 */
export const CONTACT_SALES_PLANS: readonly PlanSlug[] = ['enterprise', 'msp'];
export type BillingCycle = 'monthly' | 'yearly';
export type SubscriptionStatus = 'trial' | 'active' | 'past_due' | 'cancelled' | 'paused';
export type InvoiceStatus = 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';
export type DiscountType = 'percentage' | 'fixed';
export type PaymentMethodType = 'card' | 'bank_transfer' | 'wire';
export type UsageMetric = 'users' | 'frameworks' | 'evidence_gb' | 'branches' | 'departments';

// ── Subscription Plan ──────────────────────────────────────────────────────────
export interface SubscriptionPlan {
  id: string;
  name: string;
  slug: PlanSlug;
  description: string;
  priceMonthly: number;
  priceYearly: number;
  currency: string;
  maxUsers: number | null;
  maxFrameworks: number | null;
  maxEvidenceGb: number | null;
  maxBranches: number | null;
  maxDepartments: number | null;
  features: string[];
  isActive: boolean;
  isPublic: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePlanDto {
  name: string;
  slug: PlanSlug;
  description?: string;
  priceMonthly: number;
  priceYearly: number;
  currency?: string;
  maxUsers?: number | null;
  maxFrameworks?: number | null;
  maxEvidenceGb?: number | null;
  maxBranches?: number | null;
  maxDepartments?: number | null;
  features?: string[];
  isPublic?: boolean;
  sortOrder?: number;
}

export type UpdatePlanDto = Partial<CreatePlanDto> & { isActive?: boolean };

// ── Coupon ─────────────────────────────────────────────────────────────────────
export interface Coupon {
  id: string;
  code: string;
  name: string;
  description: string | null;
  discountType: DiscountType;
  discountValue: number;
  currency: string;
  maxUses: number | null;
  usesCount: number;
  minAmount: number;
  applicablePlanSlugs: string[];
  expiresAt: string | null;
  isActive: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCouponDto {
  code: string;
  name: string;
  description?: string;
  discountType: DiscountType;
  discountValue: number;
  currency?: string;
  maxUses?: number | null;
  minAmount?: number;
  applicablePlanSlugs?: string[];
  expiresAt?: string | null;
}

export type UpdateCouponDto = Partial<CreateCouponDto> & { isActive?: boolean };

export interface CouponValidation {
  valid: boolean;
  coupon: Coupon | null;
  discountedAmount: number | null;
  message: string;
}

// ── Subscription ───────────────────────────────────────────────────────────────
export interface Subscription {
  id: string;
  tenantId: string;
  planId: string;
  planName: string;
  planSlug: PlanSlug;
  status: SubscriptionStatus;
  billingCycle: BillingCycle;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  trialEndsAt: string | null;
  cancelledAt: string | null;
  cancelAtPeriodEnd: boolean;
  couponId: string | null;
  couponCode: string | null;
  discountPercent: number;
  discountFixed: number;
  nextInvoiceAmount: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSubscriptionDto {
  planId: string;
  billingCycle?: BillingCycle;
  couponCode?: string;
  trialDays?: number;
}

export interface UpdateSubscriptionDto {
  planId?: string;
  billingCycle?: BillingCycle;
  cancelAtPeriodEnd?: boolean;
  status?: SubscriptionStatus;
}

// ── Payment Method ─────────────────────────────────────────────────────────────
export interface PaymentMethod {
  id: string;
  tenantId: string;
  type: PaymentMethodType;
  label: string;
  last4: string | null;
  brand: string | null;
  expMonth: number | null;
  expYear: number | null;
  bankName: string | null;
  bankAccountLast4: string | null;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AddPaymentMethodDto {
  type: PaymentMethodType;
  label: string;
  last4?: string;
  brand?: string;
  expMonth?: number;
  expYear?: number;
  bankName?: string;
  bankAccountLast4?: string;
  setAsDefault?: boolean;
}

// ── Invoice ────────────────────────────────────────────────────────────────────
export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitAmount: number;
  amount: number;
}

export interface Invoice {
  id: string;
  tenantId: string;
  tenantName?: string;
  subscriptionId: string | null;
  number: string;
  status: InvoiceStatus;
  amountDue: number;
  amountPaid: number;
  currency: string;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  dueDate: string;
  paidAt: string | null;
  lineItems: InvoiceLineItem[];
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateInvoiceDto {
  tenantId: string;
  subscriptionId?: string;
  amountDue: number;
  currency?: string;
  billingPeriodStart: Date;
  billingPeriodEnd: Date;
  dueDate: Date;
  lineItems: InvoiceLineItem[];
  metadata?: Record<string, unknown>;
}

export interface UpdateInvoiceDto {
  status?: InvoiceStatus;
  amountPaid?: number;
  paidAt?: string | null;
}

// ── Usage ──────────────────────────────────────────────────────────────────────
export interface UsageRecord {
  id: string;
  tenantId: string;
  metric: UsageMetric;
  periodStart: string;
  periodEnd: string;
  currentValue: number;
  limitValue: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface UsageSummary {
  metric: UsageMetric;
  label: string;
  currentValue: number;
  limitValue: number | null;
  usagePercent: number | null;
  isOverLimit: boolean;
}

// ── Billing Overview ───────────────────────────────────────────────────────────
export interface BillingOverview {
  subscription: Subscription | null;
  plan: SubscriptionPlan | null;
  paymentMethods: PaymentMethod[];
  recentInvoices: Invoice[];
  usage: UsageSummary[];
}

// ── Admin ─────────────────────────────────────────────────────────────────────
export interface TenantBillingRow {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  planName: string | null;
  planSlug: string | null;
  subscriptionStatus: SubscriptionStatus | null;
  billingCycle: BillingCycle | null;
  currentPeriodEnd: string | null;
  nextInvoiceAmount: number | null;
  totalInvoiced: number;
  totalPaid: number;
  currency: string;
  /** Set once erasure has been requested; the tenant is already inaccessible. */
  deletedAt: string | null;
  /** When the data is permanently destroyed. Restorable until then. */
  purgeAfter: string | null;
}

export interface InvoiceListFilter {
  tenantId?: string;
  status?: InvoiceStatus;
  limit?: number;
  offset?: number;
}

export interface PlanListFilter {
  includeInactive?: boolean;
  publicOnly?: boolean;
}
