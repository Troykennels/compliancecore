export interface Department {
  id: string;
  name: string;
  code: string | null;
  branchId: string | null;
  parentDepartmentId: string | null;
  headUserId: string | null;
  description: string | null;
  isActive: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DepartmentWithRelations extends Department {
  branchName: string | null;
  parentDepartmentName: string | null;
  headUserName: string | null;
  headUserEmail: string | null;
  memberCount: number;
}

export interface DepartmentTreeNode extends Department {
  children: DepartmentTreeNode[];
}

export interface CreateDepartmentDto {
  name: string;
  code?: string | null;
  branchId?: string | null;
  parentDepartmentId?: string | null;
  headUserId?: string | null;
  description?: string | null;
}

export interface UpdateDepartmentDto extends Partial<CreateDepartmentDto> {
  isActive?: boolean;
}
