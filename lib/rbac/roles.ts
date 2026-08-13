/**
 * Identity + membership resolution for TeamFrame.
 *
 * Session/auth identity establishes WHO the user is. Database-backed
 * memberships, access profiles and exceptions establish WHAT the user may do
 * right now. Legacy app_metadata.role/app_metadata.tenant_id is used only as a
 * compatibility fallback while old environments migrate into memberships.
 */

import "server-only";
import { createServiceRoleClient } from "@/lib/db/supabaseServer";
import { isSelfServiceEligibleEmployee, type LegacyEmployeeLifecycleState } from "@/services/employeeLifecycle";

export type Role = "admin" | "employee" | "platform_owner";
export type AccessProfile = "admin" | "finance" | "full_access" | "employee";
export type AccessCapability =
  | "people_operations"
  | "compensation_view"
  | "compensation_manage"
  | "private_employee_documents"
  | "finance_payroll_exports"
  | "company_access_settings";
export type AccessScope = "whole_company" | "own_team" | "department" | "selected_people";
export type AccessEffect = "allow" | "restrict";

export const ROLES: readonly Role[] = ["admin", "employee", "platform_owner"] as const;
export const CUSTOMER_ACCESS_PROFILES: readonly AccessProfile[] = ["admin", "finance", "full_access", "employee"] as const;

export type MembershipAccessRule = {
  id: string;
  capability: AccessCapability;
  effect: AccessEffect;
  scope: AccessScope;
  department: string | null;
  employeeId: string | null;
};

export type ResolvedMembership = {
  id: string;
  tenantId: string;
  employeeId: string | null;
  profile: AccessProfile;
  displayProfile: "Admin" | "Finance" | "Full Access" | "Employee" | "Custom";
  tenantStatus: "active" | "suspended" | "closed";
  rules: MembershipAccessRule[];
};

export type ResolvedIdentity = {
  authUserId: string;
  email: string;
  employeeId: string | null;
  tenantId: string | null;
  role: Role;
  isPlatformOwner: boolean;
  accessProfile: AccessProfile | "platform_owner";
  membershipId: string | null;
  memberships: ResolvedMembership[];
  currentMembership: ResolvedMembership | null;
  tenantStatus?: "active" | "suspended" | "closed";
};

type AuthUser = {
  id: string;
  email?: string | null;
  app_metadata?: Record<string, unknown>;
  factors?: Array<{ status?: string; factor_type?: string }>;
};

type EmployeeRow = {
  id: string;
  tenant_id: string;
  auth_user_id: string | null;
  status: "active" | "on_leave" | "inactive";
  setup_status: "incomplete" | "ready" | "active";
  lifecycle_state: LegacyEmployeeLifecycleState;
  start_date: string | null;
  end_date: string | null;
  deleted_at: string | null;
};

type MembershipRow = {
  id: string;
  tenant_id: string;
  employee_id: string | null;
  email: string;
  display_name: string;
  profile: AccessProfile;
  active: boolean;
  removed_at: string | null;
};

type RuleRow = {
  id: string;
  membership_id: string;
  capability: AccessCapability;
  effect: AccessEffect;
  scope: AccessScope;
  department: string | null;
  employee_id: string | null;
};

function displayProfile(profile: AccessProfile, rules: MembershipAccessRule[]): ResolvedMembership["displayProfile"] {
  if (rules.length > 0) return "Custom";
  if (profile === "admin") return "Admin";
  if (profile === "finance") return "Finance";
  if (profile === "full_access") return "Full Access";
  return "Employee";
}

function legacyProfileFromAppMetadata(user: AuthUser): AccessProfile {
  return user.app_metadata?.role === "admin" ? "full_access" : "employee";
}

function compatibilityRole(profile: AccessProfile | "platform_owner"): Role {
  if (profile === "platform_owner") return "platform_owner";
  if (profile === "admin" || profile === "full_access") return "admin";
  return "employee";
}

function preferredTenantFromMetadata(user: AuthUser): string | null {
  const systemValue = user.app_metadata?.platform_view_tenant_id;
  if (typeof systemValue === "string" && systemValue.length > 0) return systemValue;
  const value = user.app_metadata?.tenant_id;
  return typeof value === "string" && value.length > 0 ? value : null;
}

async function resolveTenantStatus(tenantId: string | null): Promise<"active" | "suspended" | "closed" | undefined> {
  if (!tenantId) return undefined;
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.from("companies").select("status").eq("id", tenantId).maybeSingle();
  if (error) throw new Error(`RBAC: failed to resolve tenant status (${error.message})`);
  return ((data as { status?: "active" | "suspended" | "closed" } | null)?.status ?? "active");
}

async function resolvePlatformTenantId(preferredTenantId: string | null): Promise<string | null> {
  const supabase = createServiceRoleClient();
  if (!preferredTenantId) return null;

  if (preferredTenantId) {
    const { data, error } = await supabase
      .from("companies")
      .select("id")
      .eq("id", preferredTenantId)
      .neq("status", "closed")
      .maybeSingle();
    if (error) throw new Error(`RBAC: failed to resolve platform tenant context (${error.message})`);
    if (data) return (data as { id: string }).id;
  }
  return null;
}

async function listMembershipRules(membershipIds: string[]): Promise<Map<string, MembershipAccessRule[]>> {
  if (membershipIds.length === 0) return new Map();
  const supabase = createServiceRoleClient();
  let result;
  try {
    result = await supabase
      .from("membership_access_rules")
      .select("id, membership_id, capability, effect, scope, department, employee_id")
      .in("membership_id", membershipIds);
  } catch {
    return new Map();
  }
  const { data, error } = result;

  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("membership_access_rules") || message.includes("does not exist")) return new Map();
    throw new Error(`RBAC: failed to resolve access rules (${error.message})`);
  }

  const byMembership = new Map<string, MembershipAccessRule[]>();
  for (const row of (data ?? []) as RuleRow[]) {
    const next = byMembership.get(row.membership_id) ?? [];
    next.push({
      id: row.id,
      capability: row.capability,
      effect: row.effect,
      scope: row.scope,
      department: row.department,
      employeeId: row.employee_id,
    });
    byMembership.set(row.membership_id, next);
  }
  return byMembership;
}

async function listDatabaseMemberships(user: AuthUser): Promise<ResolvedMembership[]> {
  const supabase = createServiceRoleClient();
  let result;
  try {
    result = await supabase
      .from("tenant_memberships")
      .select("id, tenant_id, employee_id, email, display_name, profile, active, removed_at")
      .eq("auth_user_id", user.id)
      .eq("active", true)
      .is("removed_at", null)
      .order("created_at", { ascending: true });
  } catch {
    return [];
  }
  const { data, error } = result;

  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("tenant_memberships") || message.includes("does not exist")) return [];
    throw new Error(`RBAC: failed to resolve memberships (${error.message})`);
  }

  const rows = (data ?? []) as MembershipRow[];
  const ruleMap = await listMembershipRules(rows.map((row) => row.id));
  const tenantIds = [...new Set(rows.map((row) => row.tenant_id))];
  const statusMap = new Map<string, "active" | "suspended" | "closed">();
  if (tenantIds.length > 0) {
    try {
      const { data: companies, error: companyError } = await supabase
        .from("companies")
        .select("id, status")
        .in("id", tenantIds);
      if (companyError) throw new Error(`RBAC: failed to resolve tenant status (${companyError.message})`);
      for (const company of (companies ?? []) as Array<{ id: string; status?: "active" | "suspended" | "closed" | null }>) {
        statusMap.set(company.id, company.status ?? "active");
      }
    } catch {
      for (const tenantId of tenantIds) statusMap.set(tenantId, "active");
    }
  }
  return rows.map((row) => {
    const rules = ruleMap.get(row.id) ?? [];
    return {
      id: row.id,
      tenantId: row.tenant_id,
      employeeId: row.employee_id,
      profile: row.profile,
      displayProfile: displayProfile(row.profile, rules),
      tenantStatus: statusMap.get(row.tenant_id) ?? "active",
      rules,
    };
  });
}

async function acceptPendingInvitations(user: AuthUser, email: string): Promise<void> {
  const supabase = createServiceRoleClient();
  let invitationResult;
  try {
    invitationResult = await supabase
      .from("tenant_access_invitations")
      .select("id, tenant_id, employee_id, email, display_name, profile")
      .eq("email", email)
      .eq("active", true)
      .is("accepted_at", null);
  } catch {
    return;
  }

  const { data: invitations, error } = invitationResult;
  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("tenant_access_invitations") || message.includes("does not exist")) return;
    throw new Error(`RBAC: failed to resolve pending invitations (${error.message})`);
  }

  for (const invitation of (invitations ?? []) as Array<{
    id: string;
    tenant_id: string;
    employee_id: string | null;
    display_name: string;
    profile: AccessProfile;
  }>) {
    const { data: membership, error: membershipError } = await supabase
      .from("tenant_memberships")
      .upsert(
        {
          tenant_id: invitation.tenant_id,
          auth_user_id: user.id,
          employee_id: invitation.employee_id,
          email,
          display_name: invitation.display_name || email,
          profile: invitation.profile,
          active: true,
          removed_at: null,
        } as never,
        { onConflict: "tenant_id,auth_user_id" },
      )
      .select("id")
      .single();

    if (membershipError || !membership) {
      throw new Error(`RBAC: failed to accept invitation (${membershipError?.message ?? "no membership"})`);
    }

    const membershipId = (membership as { id: string }).id;
    let stagedRulesResult;
    try {
      stagedRulesResult = await supabase
        .from("tenant_access_invitation_rules")
        .select("capability, effect, scope, department, employee_id")
        .eq("tenant_id", invitation.tenant_id)
        .eq("invitation_id", invitation.id);
    } catch {
      stagedRulesResult = null;
    }

    if (stagedRulesResult?.error) {
      const message = stagedRulesResult.error.message.toLowerCase();
      if (!message.includes("tenant_access_invitation_rules") && !message.includes("does not exist")) {
        throw new Error(`RBAC: failed to resolve invitation access rules (${stagedRulesResult.error.message})`);
      }
    } else if (stagedRulesResult?.data?.length) {
      const { error: ruleError } = await supabase.from("membership_access_rules").upsert(
        (stagedRulesResult.data as Array<{
          capability: AccessCapability;
          effect: AccessEffect;
          scope: AccessScope;
          department: string | null;
          employee_id: string | null;
        }>).map((rule) => ({
          tenant_id: invitation.tenant_id,
          membership_id: membershipId,
          capability: rule.capability,
          effect: rule.effect,
          scope: rule.scope,
          department: rule.department,
          employee_id: rule.employee_id,
        })) as never,
      );
      if (ruleError) throw new Error(`RBAC: failed to accept invitation access rules (${ruleError.message})`);
    }

    await supabase
      .from("tenant_access_invitations")
      .update({ accepted_membership_id: membershipId, accepted_at: new Date().toISOString() } as never)
      .eq("tenant_id", invitation.tenant_id)
      .eq("id", invitation.id);
  }
}

async function resolveLegacyEmployee(user: AuthUser, tenantId: string | null, email: string): Promise<EmployeeRow | null> {
  if (!tenantId) return null;
  const supabase = createServiceRoleClient();
  const { data: linkedEmployeeData, error: linkedEmpErr } = await supabase
    .from("employees")
    .select("id, tenant_id, auth_user_id, status, setup_status, lifecycle_state, start_date, end_date, deleted_at")
    .eq("auth_user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (linkedEmpErr) {
    throw new Error(`RBAC: failed to resolve employee link (${linkedEmpErr.message})`);
  }

  if (linkedEmployeeData) {
    const employee = linkedEmployeeData as EmployeeRow;
    if (employee.tenant_id !== tenantId) {
      console.error("[TENANT_MISMATCH] employee auth_user_id link differs from selected tenant", {
        authUserId: user.id,
        employeeTenantId: employee.tenant_id,
        tenantId,
      });
      throw new Error("RBAC: tenant mismatch");
    }
    return employee;
  }

  const { data: employeeByEmail, error: empErr } = await supabase
    .from("employees")
    .select("id, tenant_id, auth_user_id, status, setup_status, lifecycle_state, start_date, end_date, deleted_at")
    .eq("email", email)
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .limit(2);

  if (empErr) {
    throw new Error(`RBAC: failed to resolve employee record (${empErr.message})`);
  }
  if ((employeeByEmail ?? []).length > 1) {
    throw new Error("RBAC: ambiguous employee mapping for this email");
  }
  return ((employeeByEmail?.[0] as EmployeeRow | undefined) ?? null);
}

async function ensureEmployeeLink(user: AuthUser, employee: EmployeeRow | null): Promise<void> {
  if (!employee || employee.auth_user_id) return;
  const supabase = createServiceRoleClient();
  await supabase
    .from("employees")
    .update({ auth_user_id: user.id } as never)
    .eq("id", employee.id)
    .eq("tenant_id", employee.tenant_id)
    .is("auth_user_id", null);
}

async function markActivatedOnLogin(employee: EmployeeRow | null): Promise<void> {
  if (!employee || employee.setup_status === "active") return;
  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .from("employees")
    .update({
      setup_status: "active",
      activated_at: new Date().toISOString(),
      invite_last_error: null,
    } as never)
    .eq("id", employee.id)
    .eq("tenant_id", employee.tenant_id)
    .is("deleted_at", null);

  if (error && (error.message.includes("activated_at") || error.message.includes("invite_last_error"))) {
    await supabase
      .from("employees")
      .update({ setup_status: "active" } as never)
      .eq("id", employee.id)
      .eq("tenant_id", employee.tenant_id)
      .is("deleted_at", null);
  }
}

async function isPlatformOwner(user: AuthUser): Promise<boolean> {
  const supabase = createServiceRoleClient();
  let result;
  try {
    result = await supabase
      .from("platform_owners")
      .select("auth_user_id, active, revoked_at")
      .eq("auth_user_id", user.id)
      .eq("active", true)
      .is("revoked_at", null)
      .maybeSingle();
  } catch {
    return false;
  }
  const { data, error } = result;

  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("platform_owners") || message.includes("does not exist")) return false;
    throw new Error(`RBAC: failed to resolve platform owner (${error.message})`);
  }
  return Boolean(data);
}

function selectCurrentMembership(memberships: ResolvedMembership[], preferredTenantId: string | null): ResolvedMembership | null {
  if (memberships.length === 0) return null;
  if (preferredTenantId) {
    const preferred = memberships.find((membership) => membership.tenantId === preferredTenantId);
    if (preferred) return preferred;
  }
  return memberships[0] ?? null;
}

export async function resolveIdentity(authUserId: string): Promise<ResolvedIdentity> {
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase.auth.admin.getUserById(authUserId);
  if (error || !data?.user || !data.user.email) {
    throw new Error("RBAC: failed to resolve auth user");
  }

  const user = data.user as AuthUser;
  const email = data.user.email.toLowerCase();
  await acceptPendingInvitations(user, email);
  const systemOwner = await isPlatformOwner(user);
  const memberships = await listDatabaseMemberships(user);
  const preferredTenantId = preferredTenantFromMetadata(user);
  const selectedMembership = selectCurrentMembership(memberships, preferredTenantId);

  if (systemOwner) {
    const tenantId = await resolvePlatformTenantId(preferredTenantId);
    const tenantStatus = await resolveTenantStatus(tenantId);
    return {
      authUserId: user.id,
      email,
      employeeId: null,
      tenantId,
      role: "platform_owner",
      isPlatformOwner: true,
      accessProfile: "platform_owner",
      membershipId: null,
      memberships,
      currentMembership: null,
      tenantStatus,
    };
  }

  if (selectedMembership) {
    const employee = await resolveLegacyEmployee(user, selectedMembership.tenantId, email);
    if (employee && !isSelfServiceEligibleEmployee(employee) && selectedMembership.profile === "employee") {
      throw new Error("RBAC: employee lifecycle is not eligible for self-service");
    }
    await ensureEmployeeLink(user, employee);
    await markActivatedOnLogin(employee);
    return {
      authUserId: user.id,
      email,
      employeeId: selectedMembership.employeeId ?? employee?.id ?? null,
      tenantId: selectedMembership.tenantId,
      role: compatibilityRole(selectedMembership.profile),
      isPlatformOwner: false,
      accessProfile: selectedMembership.profile,
      membershipId: selectedMembership.id,
      memberships,
      currentMembership: selectedMembership,
      tenantStatus: selectedMembership.tenantStatus,
    };
  }

  const legacyTenantId = preferredTenantFromMetadata(user);
  const employee = await resolveLegacyEmployee(user, legacyTenantId, email);
  if (employee && !isSelfServiceEligibleEmployee(employee)) {
    throw new Error("RBAC: employee lifecycle is not eligible for self-service");
  }
  await ensureEmployeeLink(user, employee);
  await markActivatedOnLogin(employee);
  const legacyProfile = legacyProfileFromAppMetadata(user);

  return {
    authUserId: user.id,
    email,
    employeeId: employee?.id ?? null,
    tenantId: legacyTenantId,
    role: compatibilityRole(legacyProfile),
    isPlatformOwner: false,
    accessProfile: legacyProfile,
    membershipId: null,
    memberships,
    currentMembership: null,
    tenantStatus: "active",
  };
}
