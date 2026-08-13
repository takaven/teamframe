import "server-only";
import type { Actor } from "@/middleware/rbac";
import type { AccessCapability, AccessProfile, PeopleAccessScope, PrivateDocumentsScope, SalaryAccessScope } from "@/lib/rbac/roles";
import { createServiceRoleClient } from "@/lib/db/supabaseServer";

export type CapabilityTarget = {
  employeeId?: string | null;
};

const PROFILE_CAPABILITIES: Record<AccessProfile, readonly AccessCapability[]> = {
  admin: ["people_operations"],
  finance: ["compensation_view", "finance_payroll_exports"],
  full_access: [
    "people_operations",
    "compensation_view",
    "compensation_manage",
    "private_employee_documents",
    "finance_payroll_exports",
    "company_access_settings",
  ],
  employee: [],
};

function effectiveProfile(actor: Actor): AccessProfile {
  if (actor.accessProfile) return actor.accessProfile;
  if (actor.role === "admin") return "full_access";
  return "employee";
}

async function isDirectReport(actor: Actor, employeeId: string | null | undefined): Promise<boolean> {
  if (!actor.employeeId || !employeeId || !actor.tenantId) return false;
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("employees")
    .select("id")
    .eq("tenant_id", actor.tenantId)
    .eq("id", employeeId)
    .eq("manager_id", actor.employeeId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(`ACCESS_DIRECT_REPORT_LOOKUP_FAILED: ${error.message}`);
  return Boolean(data);
}

async function hasManagerDerivedAccess(
  actor: Actor,
  capability: AccessCapability,
  target: CapabilityTarget,
): Promise<boolean> {
  if (capability !== "people_operations" && capability !== "compensation_view") return false;
  return isDirectReport(actor, target.employeeId);
}

function profileAllows(actor: Actor, capability: AccessCapability): boolean {
  if (actor.currentMembership) return false;
  return PROFILE_CAPABILITIES[effectiveProfile(actor)]?.includes(capability) ?? false;
}

async function scopedEmployeeAccess(
  actor: Actor,
  targetEmployeeId: string | null | undefined,
  scope: PeopleAccessScope | PrivateDocumentsScope | SalaryAccessScope,
  selectedEmployeeIds: string[],
): Promise<boolean> {
  if (scope === "all") return true;
  if (scope === "none") return false;
  if (!targetEmployeeId) return false;
  if (scope === "direct_reports") return isDirectReport(actor, targetEmployeeId);
  const selected = selectedEmployeeIds.includes(targetEmployeeId);
  if (scope === "selected_people") return selected;
  if (scope === "all_except_selected_people") return !selected;
  return false;
}

async function matrixAllows(actor: Actor, capability: AccessCapability, target: CapabilityTarget): Promise<boolean> {
  const membership = actor.currentMembership;
  if (!membership) return false;
  if (capability === "people_operations") {
    return scopedEmployeeAccess(actor, target.employeeId, membership.peopleAccess, membership.peopleSelectedEmployeeIds);
  }
  if (capability === "compensation_view") {
    if (membership.salaryAccessLevel === "none") return false;
    return scopedEmployeeAccess(actor, target.employeeId, membership.salaryAccessScope, membership.salarySelectedEmployeeIds);
  }
  if (capability === "compensation_manage") {
    if (membership.salaryAccessLevel !== "manage") return false;
    return scopedEmployeeAccess(actor, target.employeeId, membership.salaryAccessScope, membership.salarySelectedEmployeeIds);
  }
  if (capability === "private_employee_documents") {
    return scopedEmployeeAccess(actor, target.employeeId, membership.privateDocumentsScope, membership.privateDocumentsSelectedEmployeeIds);
  }
  if (capability === "finance_payroll_exports") return membership.financeExportsAccess;
  if (capability === "company_access_settings") return membership.manageUsersAccess;
  return false;
}

export async function hasCapability(
  actor: Actor,
  capability: AccessCapability,
  target: CapabilityTarget = {},
): Promise<boolean> {
  if (!actor.tenantId) return false;
  if (await matrixAllows(actor, capability, target)) return true;
  if (profileAllows(actor, capability)) return true;
  if (await hasManagerDerivedAccess(actor, capability, target)) return true;
  return false;
}

export async function requireCapability(
  actor: Actor,
  capability: AccessCapability,
  target: CapabilityTarget = {},
): Promise<void> {
  if (!(await hasCapability(actor, capability, target))) {
    throw new Error("FORBIDDEN");
  }
}

export async function canReadOwnEmployeeRecord(actor: Actor, employeeId: string): Promise<boolean> {
  return Boolean(actor.employeeId && actor.employeeId === employeeId);
}

export async function canReadEmployeeProfile(actor: Actor, employeeId: string): Promise<boolean> {
  if (await canReadOwnEmployeeRecord(actor, employeeId)) return true;
  return hasCapability(actor, "people_operations", { employeeId });
}

export async function canViewCompensation(actor: Actor, employeeId: string): Promise<boolean> {
  return hasCapability(actor, "compensation_view", { employeeId });
}

export async function canManageCompensation(actor: Actor, employeeId: string): Promise<boolean> {
  return hasCapability(actor, "compensation_manage", { employeeId });
}

export async function canReadPrivateDocuments(actor: Actor, employeeId: string): Promise<boolean> {
  if (await canReadOwnEmployeeRecord(actor, employeeId)) return true;
  return hasCapability(actor, "private_employee_documents", { employeeId });
}

export async function canManageAccess(actor: Actor): Promise<boolean> {
  return hasCapability(actor, "company_access_settings", {});
}

export async function canRunFinanceExport(actor: Actor): Promise<boolean> {
  return hasCapability(actor, "finance_payroll_exports", {});
}
