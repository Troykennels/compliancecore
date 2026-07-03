export interface Branch {
  id: string;
  name: string;
  code: string | null;
  isHeadquarters: boolean;
  country: string | null;
  city: string | null;
  state: string | null;
  address: string | null;
  postalCode: string | null;
  timezone: string;
  phone: string | null;
  email: string | null;
  isActive: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBranchDto {
  name: string;
  code?: string | null;
  isHeadquarters?: boolean;
  country?: string | null;
  city?: string | null;
  state?: string | null;
  address?: string | null;
  postalCode?: string | null;
  timezone?: string;
  phone?: string | null;
  email?: string | null;
}

export interface UpdateBranchDto extends Partial<CreateBranchDto> {
  isActive?: boolean;
}

export interface BranchListResult {
  branches: Branch[];
  total: number;
}
