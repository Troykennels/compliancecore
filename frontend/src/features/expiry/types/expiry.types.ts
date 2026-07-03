export type ExpiryEntityType =
  | 'certificate' | 'policy' | 'contract' | 'license' | 'iso_certification'
  | 'penetration_test' | 'insurance' | 'vendor_assessment' | 'audit_report'
  | 'training_certification' | 'subscription' | 'custom';

export type ExpiryStatus = 'active' | 'expiring_soon' | 'expired' | 'renewed' | 'cancelled';

export interface ExpiryItem {
  id: string;
  name: string;
  entityType: ExpiryEntityType;
  expiryDate: string;
  ownerId: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  status: ExpiryStatus;
  reminderDays: number[];
  notes: string | null;
  autoDetected: boolean;
  linkedEntityType: string | null;
  linkedEntityId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateExpiryItemDto {
  name: string;
  entityType: ExpiryEntityType;
  expiryDate: string;
  ownerId?: string | null;
  reminderDays?: number[];
  notes?: string | null;
  linkedEntityType?: string | null;
  linkedEntityId?: string | null;
}

export interface ExpiryFilters {
  status?: ExpiryStatus;
  entityType?: ExpiryEntityType;
  ownerId?: string;
  expiringWithinDays?: number;
  page?: number;
  limit?: number;
  q?: string;
}

export const ENTITY_TYPE_LABELS: Record<ExpiryEntityType, string> = {
  certificate:           'Certificate',
  policy:                'Policy',
  contract:              'Contract',
  license:               'License',
  iso_certification:     'ISO Certification',
  penetration_test:      'Penetration Test',
  insurance:             'Insurance',
  vendor_assessment:     'Vendor Assessment',
  audit_report:          'Audit Report',
  training_certification:'Training Certification',
  subscription:          'Subscription',
  custom:                'Custom',
};

export const STATUS_CONFIG: Record<ExpiryStatus, { label: string; className: string }> = {
  active:        { label: 'Active',         className: 'bg-green-100 text-green-700' },
  expiring_soon: { label: 'Expiring Soon',  className: 'bg-amber-100 text-amber-700' },
  expired:       { label: 'Expired',        className: 'bg-red-100 text-red-700' },
  renewed:       { label: 'Renewed',        className: 'bg-blue-100 text-blue-700' },
  cancelled:     { label: 'Cancelled',      className: 'bg-slate-100 text-slate-500' },
};
