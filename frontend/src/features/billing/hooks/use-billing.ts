import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { billingApi } from '../api/billing.api';
import type {
  CreateSubscriptionDto, UpdateSubscriptionDto, AddPaymentMethodDto,
  CreateCouponDto, CreatePlanDto,
} from '../types/billing.types';

const KEYS = {
  overview: ['billing', 'overview'] as const,
  subscription: ['billing', 'subscription'] as const,
  plans: ['billing', 'plans'] as const,
  publicPlans: ['billing', 'plans', 'public'] as const,
  paymentMethods: ['billing', 'payment-methods'] as const,
  invoices: (params?: object) => ['billing', 'invoices', params ?? {}] as const,
  usage: ['billing', 'usage'] as const,
  adminPlans: ['billing', 'admin', 'plans'] as const,
  adminCoupons: (inactive: boolean) => ['billing', 'admin', 'coupons', inactive] as const,
  adminTenants: ['billing', 'admin', 'tenants'] as const,
  adminInvoices: (params?: object) => ['billing', 'admin', 'invoices', params ?? {}] as const,
};

// ── Tenant hooks ───────────────────────────────────────────────────────────────
export function useBillingOverview() {
  return useQuery({
    queryKey: KEYS.overview,
    queryFn: () => billingApi.getOverview().then((r) => r.data.data),
    staleTime: 2 * 60_000,
  });
}

export function usePublicPlans() {
  return useQuery({
    queryKey: KEYS.publicPlans,
    queryFn: () => billingApi.getPublicPlans().then((r) => r.data.data),
    staleTime: 10 * 60_000,
  });
}

export function useSubscription() {
  return useQuery({
    queryKey: KEYS.subscription,
    queryFn: () => billingApi.getSubscription().then((r) => r.data.data),
  });
}

export function useCreateSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateSubscriptionDto) => billingApi.createSubscription(dto).then((r) => r.data.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['billing'] });
      toast.success('Subscription activated');
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'Failed to activate subscription';
      toast.error(msg);
    },
  });
}

export function useUpdateSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: UpdateSubscriptionDto) => billingApi.updateSubscription(dto).then((r) => r.data.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['billing'] });
      toast.success('Subscription updated');
    },
    onError: () => toast.error('Failed to update subscription'),
  });
}

export function useApplyCoupon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => billingApi.applyCoupon(code).then((r) => r.data.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['billing'] });
      toast.success('Coupon applied successfully');
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'Invalid coupon';
      toast.error(msg);
    },
  });
}

export function useRemoveCoupon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => billingApi.removeCoupon().then((r) => r.data.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['billing'] });
      toast.success('Coupon removed');
    },
  });
}

export function usePaymentMethods() {
  return useQuery({
    queryKey: KEYS.paymentMethods,
    queryFn: () => billingApi.getPaymentMethods().then((r) => r.data.data),
  });
}

export function useAddPaymentMethod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: AddPaymentMethodDto) => billingApi.addPaymentMethod(dto).then((r) => r.data.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEYS.paymentMethods });
      toast.success('Payment method added');
    },
    onError: () => toast.error('Failed to add payment method'),
  });
}

export function useSetDefaultPaymentMethod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => billingApi.setDefaultPaymentMethod(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEYS.paymentMethods });
      toast.success('Default payment method updated');
    },
  });
}

export function useRemovePaymentMethod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => billingApi.removePaymentMethod(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEYS.paymentMethods });
      toast.success('Payment method removed');
    },
  });
}

export function useInvoices(params?: { status?: string; limit?: number; offset?: number }) {
  return useQuery({
    queryKey: KEYS.invoices(params),
    queryFn: () => billingApi.getInvoices(params).then((r) => r.data.data),
  });
}

export function useDownloadInvoicePdf() {
  return useMutation({
    mutationFn: ({ id, number }: { id: string; number: string }) =>
      billingApi.downloadInvoicePdf(id, number),
    onSuccess: () => toast.success('Invoice downloaded'),
    onError: () => toast.error('Failed to download invoice'),
  });
}

export function useUsage() {
  return useQuery({
    queryKey: KEYS.usage,
    queryFn: () => billingApi.getUsage().then((r) => r.data.data),
    staleTime: 5 * 60_000,
  });
}

// ── Admin hooks ────────────────────────────────────────────────────────────────
export function useAdminPlans(includeInactive = true) {
  return useQuery({
    queryKey: KEYS.adminPlans,
    queryFn: () => billingApi.admin.getPlans(includeInactive).then((r) => r.data.data),
  });
}

export function useAdminCreatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreatePlanDto) => billingApi.admin.createPlan(dto).then((r) => r.data.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEYS.adminPlans });
      void qc.invalidateQueries({ queryKey: KEYS.publicPlans });
      toast.success('Plan created');
    },
    onError: () => toast.error('Failed to create plan'),
  });
}

export function useAdminUpdatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: Partial<CreatePlanDto> & { isActive?: boolean } }) =>
      billingApi.admin.updatePlan(id, dto).then((r) => r.data.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEYS.adminPlans });
      void qc.invalidateQueries({ queryKey: KEYS.publicPlans });
      toast.success('Plan updated');
    },
    onError: () => toast.error('Failed to update plan'),
  });
}

export function useAdminCoupons(includeInactive = false) {
  return useQuery({
    queryKey: KEYS.adminCoupons(includeInactive),
    queryFn: () => billingApi.admin.getCoupons(includeInactive).then((r) => r.data.data),
  });
}

export function useAdminCreateCoupon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateCouponDto) => billingApi.admin.createCoupon(dto).then((r) => r.data.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['billing', 'admin', 'coupons'] });
      toast.success('Coupon created');
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'Failed to create coupon';
      toast.error(msg);
    },
  });
}

export function useAdminUpdateCoupon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: Partial<CreateCouponDto> & { isActive?: boolean } }) =>
      billingApi.admin.updateCoupon(id, dto).then((r) => r.data.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['billing', 'admin', 'coupons'] });
      toast.success('Coupon updated');
    },
    onError: () => toast.error('Failed to update coupon'),
  });
}

export function useAdminTenantBilling() {
  return useQuery({
    queryKey: KEYS.adminTenants,
    queryFn: () => billingApi.admin.getAllTenantBilling().then((r) => r.data.data),
    staleTime: 60_000,
  });
}

export function useAdminInvoices(params?: { tenantId?: string; status?: string; limit?: number }) {
  return useQuery({
    queryKey: KEYS.adminInvoices(params),
    queryFn: () => billingApi.admin.getInvoices(params).then((r) => r.data.data),
  });
}

export function useAdminUpdateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: { status?: string; amountPaid?: number; paidAt?: string } }) =>
      billingApi.admin.updateInvoice(id, dto).then((r) => r.data.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['billing', 'admin', 'invoices'] });
      toast.success('Invoice updated');
    },
    onError: () => toast.error('Failed to update invoice'),
  });
}

export function useAdminUpdateSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: Record<string, unknown> }) =>
      billingApi.admin.updateSubscription(id, dto).then((r) => r.data.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['billing', 'admin'] });
      toast.success('Subscription updated');
    },
    onError: () => toast.error('Failed to update subscription'),
  });
}
