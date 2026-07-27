import { apiClient } from '@/lib/api-client';

export interface PaymentConfig {
  configured: boolean;
  provider: string;
  publicKey: string | null;
  currencies: string[];
}

export interface PlanPrice {
  planId: string;
  currency: string;
  priceMonthly: number;
  priceYearly: number;
}

export interface CheckoutResult {
  authorizationUrl: string;
  reference: string;
  amount: number;
  currency: string;
}

export interface ConfirmResult {
  status: string;
  alreadyApplied: boolean;
}

export const paymentsApi = {
  // Unauthenticated: tells the UI whether to offer payment at all, and in which
  // currencies. A deployment with no Paystack keys returns configured:false, and
  // the plans page falls back to plain plan switching.
  getConfig: async (): Promise<PaymentConfig> =>
    (await apiClient.get('/payments/config')).data.data,

  getPlanPrices: async (planId: string): Promise<PlanPrice[]> =>
    (await apiClient.get(`/payments/plans/${planId}/prices`)).data.data,

  createCheckout: async (dto: {
    planId: string;
    currency: string;
    billingCycle: 'monthly' | 'yearly';
  }): Promise<CheckoutResult> =>
    (await apiClient.post('/payments/checkout', dto)).data.data,

  // Called on return from Paystack. Idempotent server-side, so a page refresh
  // cannot double-apply a payment.
  confirm: async (reference: string): Promise<ConfirmResult> =>
    (await apiClient.get('/payments/confirm', { params: { reference } })).data.data,
};
