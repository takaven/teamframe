import "server-only";
import type { Actor } from "@/middleware/rbac";
import type { AccessCapability, AccessProfile, MembershipAccessRule } from "@/lib/rbac/roles";
import { createServiceRoleClient } from "@/lib/db/supabaseServer";

export type CapabilityTarget = {
  employeeId?: string | null;
  department?: string | null;
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

function requireTenant(actor: Actor): string {
  if (!actor.tenantId) throw new Error("NO_TENANT_CONTEXT");
  return actor.tenantId;
}

function effectiveProfile(actor: Actor): AccessProfile {
  if (actor.accessProfile && actor.accessProfile !== "platform_owner") return actor.accessProfile;
  if (actor.role === "admin") return "full_access";
  return "employee";
}

async function getTargetDepartment(actor: Actor, target: CapabilityTarget): Promise<string | null> {
  if (target.department) return target.department;
  if (!target.employeeId) return null;
  const tenantId = requireTenant(actor);
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("employees")
    .select("department")
    .eq("tenant_id", tenantId)
    .eq("id", target.employeeId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(`ACCESS_TARGET_LOOKUP_FAILED: ${error.message}`);
  return (data as { department: string } | null)?.department ?? null;
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

async function ruleApplies(actor: Actor, rule: MembershipAccessRule, target: CapabilityTarget): Promise<boolean> {
  if (rule.scope === "whole_company") return true;
  if (rule.scope === "selected_people") return Boolean(target.employeeId && rule.employeeId === target.employeeId);
  if (rule.scope === "own_team") return isDirectReport(actor, target.employeeId);
  if (rule.scope === "department") {
    const department = await getTargetDepartment(actor, target);
    return Boolean(department && rule.department === department);
  }
  return false;
}

async function hasRuleEffect(
  actor: Actor,
  capability: AccessCapability,
  effect: "allow" | "restrict",
  target: CapabilityTarget,
): Promise<boolean> {
  const rules = actor.currentMembership?.rules ?? [];
  for (const rule of rules) {
    if (rule.capability !== capability || rule.effect !== effect) continue;
    if (await ruleApplies(actor, rule, target)) return true;
  }
  return false;
}

async function hasManagerDerivedAccess(
  actor: Actor,
  capability: AccessCapability,
  target: CapabilityTarget,
): Promise<boolean> {
  if (capability !== "people_operations" && capability !== "compensation_view") return false;
  return isDirectReport(actor, target.employeeId);
}

export async function hasCapability(
  actor: Actor,
  capability: AccessCapability,
  target: CapabilityTarget = {},
): Promise<boolean> {
  if (actor.isPlatformOwner) return true;
  if (!actor.tenantId) return false;
  if (actor.tenantStatus && actor.tenantStatus !== "active") return false;
  if (await hasRuleEffect(actor, capability, "restrict", target)) return false;
  if (await hasRuleEffect(actor, capability, "allow", target)) return true;
  if (PROFILE_CAPABILITIES[effectiveProfile(actor)]?.includes(capability)) return true;
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
