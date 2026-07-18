export type ExpiryEntityType =
  | 'certificate' | 'policy' | 'contract' | 'evidence' | 'license'
  | 'insurance' | 'vendor_agreement' | 'api_key' | 'domain'
  | 'iso_certification' | 'soc2_report' | 'custom';

export type ExpiryStatus = 'active' | 'expiring_soon' | 'expired' | 'renewed' | 'cancelled';

export interface ExpiryItem {
  id: string;
  name: string;
  description: string | null;
  entityType: ExpiryEntityType;
  entityId: string | null;
  expiryDate: Date;
  renewalDate: Date | null;
  ownerId: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  status: ExpiryStatus;
  reminderDays: number[];
  autoDetected: boolean;
  notes: string | null;
  daysUntilExpiry: number;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExpiryListResult {
  items: ExpiryItem[];
  total: number;
  page: number;
  limit: number;
}

export interface ExpiryStatusCounts {
  active: number;
  expiringSoon: number;
  expired: number;
  renewed: number;
  cancelled: number;
  total: number;
}
