import type { ReactNode } from "react";
import { useAuthStore } from "@/stores/auth.store";
import { hasPermission } from "@/config/role-permissions";
export function PermissionAction({
  scope,
  managerOnly = false,
  assignedOnly = false,
  ownerId,
  children,
}: {
  scope: string;
  managerOnly?: boolean;
  assignedOnly?: boolean;
  ownerId?: string | null;
  children: ReactNode;
}) {
  const role = useAuthStore((s) => s.activeTenant?.role);
  const userId = useAuthStore((s) => s.user?.id);
  return hasPermission(role, scope) &&
    (!assignedOnly || role !== "control_owner" || ownerId === userId) &&
    (!managerOnly ||
      ["owner", "admin", "compliance_manager", "msp_admin"].includes(
        role ?? "",
      )) ? (
    <>{children}</>
  ) : null;
}
