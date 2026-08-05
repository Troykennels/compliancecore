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
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// Enriched view with branch name and head user info
export interface DepartmentWithRelations extends Department {
  branchName: string | null;
  parentDepartmentName: string | null;
  headUserName: string | null;
  headUserEmail: string | null;
  // memberCount removed. The list query counted the whole ORGANISATION for
  // every department — the subquery never referenced the department at all — so
  // six departments in a 40-person org each reported 40, while the detail query
  // hard-coded 0 and disagreed with it. Nothing rendered the field, so it was a
  // wrong number nobody saw.
  //
  // A real count needs a link between a membership and a department, which the
  // schema does not have. Worth adding as a feature; not worth faking here.
}

// Recursive tree node for the hierarchy view
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
