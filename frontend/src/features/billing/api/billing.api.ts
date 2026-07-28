import { apiClient } from '@/lib/api-client';
import type {
  BillingOverview, Subscription, SubscriptionPlan, PaymentMethod, Invoice,
  UsageSummary, CouponValidation, TenantBillingRow, Coupon,
  CreateSubscriptionDto, UpdateSubscriptionDto, AddPaymentMethodDto,
  CreateCouponDto, CreatePlanDto, FxReview,
} from '../types/billing.types';

type Res<T> = Promise<{ data: { success: boolean; data: T } }>;

export const billingApi = {
  // Public
  getPublicPlans: (): Res<SubscriptionPlan[]> =>
    apiClient.get('/billing/plans/public'),

  validateCoupon: (code: string, planSlug: string, amount: number): Res<CouponValidation> =>
    apiClient.get('/billing/coupons/validate', { params: { code, planSlug, amount } }),

  // Tenant
  getOverview: (): Res<BillingOverview> =>
    apiClient.get('/billing/overview'),

  getSubscription: (): Res<Subscription | null> =>
    apiClient.get('/billing/subscription'),

  createSubscription: (dto: CreateSubscriptionDto): Res<Subscription> =>
    apiClient.post('/billing/subscription', dto),

  updateSubscription: (dto: UpdateSubscriptionDto): Res<Subscription> =>
    apiClient.patch('/billing/subscription', dto),

  applyCoupon: (code: string): Res<Subscription> =>
    apiClient.post('/billing/subscription/coupon', { code }),

  removeCoupon: (): Res<Subscription> =>
    apiClient.delete('/billing/subscription/coupon'),

  getPaymentMethods: (): Res<PaymentMethod[]> =>
    apiClient.get('/billing/payment-methods'),

  addPaymentMethod: (dto: AddPaymentMethodDto): Res<PaymentMethod> =>
    apiClient.post('/billing/payment-methods', dto),

  setDefaultPaymentMethod: (id: string): Res<null> =>
    apiClient.patch(`/billing/payment-methods/${id}/default`),

  removePaymentMethod: (id: string): Res<null> =>
    apiClient.delete(`/billing/payment-methods/${id}`),

  getInvoices: (params?: { status?: string; limit?: number; offset?: number }): Res<Invoice[]> =>
    apiClient.get('/billing/invoices', { params }),

  getInvoice: (id: string): Res<Invoice> =>
    apiClient.get(`/billing/invoices/${id}`),

  async downloadInvoicePdf(id: string, invoiceNumber: string): Promise<void> {
    const res = await apiClient.get(`/billing/invoices/${id}/download`, { responseType: 'blob' });
    const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `invoice-${invoiceNumber}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  },

  getUsage: (): Res<UsageSummary[]> =>
    apiClient.get('/billing/usage'),

  // Admin
  admin: {
    getPlans: (includeInactive = true): Res<SubscriptionPlan[]> =>
      apiClient.get('/billing/admin/plans', { params: { includeInactive } }),

    createPlan: (dto: CreatePlanDto): Res<SubscriptionPlan> =>
      apiClient.post('/billing/admin/plans', dto),

    updatePlan: (id: string, dto: Partial<CreatePlanDto> & { isActive?: boolean }): Res<SubscriptionPlan> =>
      apiClient.patch(`/billing/admin/plans/${id}`, dto),

    // Per-currency prices. The plan record holds a single currency, so NGN
    // pricing can only be read and written here.
    getPlanPrices: (planId: string): Res<Array<{ currency: string; priceMonthly: number; priceYearly: number }>> =>
      apiClient.get(`/billing/admin/plans/${planId}/prices`),

    setPlanPrice: (
      planId: string,
      dto: { currency: string; priceMonthly: number; priceYearly: number },
    ): Res<Array<{ currency: string; priceMonthly: number; priceYearly: number }>> =>
      apiClient.put(`/billing/admin/plans/${planId}/prices`, dto),

    // How far each currency's price has drifted from its USD equivalent at the
    // live rate. Advisory only — applying is a separate call.
    getFxReview: (currency = 'NGN'): Res<FxReview> =>
      apiClient.get('/billing/admin/fx-review', { params: { currency } }),

    applyFxSuggestions: (planIds: string[], currency = 'NGN'): Res<{ applied: number }> =>
      apiClient.post('/billing/admin/fx-review/apply', { planIds, currency }),

    getCoupons: (includeInactive = false): Res<Coupon[]> =>
      apiClient.get('/billing/admin/coupons', { params: { includeInactive } }),

    createCoupon: (dto: CreateCouponDto): Res<Coupon> =>
      apiClient.post('/billing/admin/coupons', dto),

    updateCoupon: (id: string, dto: Partial<CreateCouponDto> & { isActive?: boolean }): Res<Coupon> =>
      apiClient.patch(`/billing/admin/coupons/${id}`, dto),

    getAllTenantBilling: (): Res<TenantBillingRow[]> =>
      apiClient.get('/billing/admin/tenants'),

    getInvoices: (params?: { tenantId?: string; status?: string; limit?: number }): Res<Invoice[]> =>
      apiClient.get('/billing/admin/invoices', { params }),

    updateSubscription: (id: string, dto: Record<string, unknown>): Res<Subscription> =>
      apiClient.patch(`/billing/admin/subscriptions/${id}`, dto),

    updateInvoice: (id: string, dto: { status?: string; amountPaid?: number; paidAt?: string }): Res<Invoice> =>
      apiClient.patch(`/billing/admin/invoices/${id}`, dto),

    async downloadInvoicePdf(id: string): Promise<void> {
      const res = await apiClient.get(`/billing/admin/invoices/${id}/download`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    },
  },
};
