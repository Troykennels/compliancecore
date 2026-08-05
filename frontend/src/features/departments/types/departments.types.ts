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
  // Removed: the API's count was the whole organisation for every department.
  // Nothing displayed it. Restoring it needs a membership-to-department link.
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
