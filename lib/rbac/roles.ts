/**
 * Identity + membership resolution for TeamFrame.
 *
 * Session/auth identity establishes WHO the user is. Database-backed
 * memberships, access profiles and effective access fields establish WHAT the user may do
 * right now. Legacy app_metadata.role/app_metadata.tenant_id is used only as a
 * compatibility fallback while old environments migrate into memberships.
 */

import "server-only";
import { createServiceRoleClient } from "@/lib/db/supabaseServer";
import { isSelfServiceEligibleEmployee, type LegacyEmployeeLifecycleState } from "@/services/employeeLifecycle";

export type Role = "admin" | "employee";
export type AccessProfile = "admin" | "finance" | "full_access" | "employee";
export type PeopleAccessScope = "none" | "all" | "direct_reports" | "selected_people" | "all_except_selected_people";
export type SalaryAccessLevel = "none" | "view" | "manage";
export type SalaryAccessScope = "all" | "direct_reports" | "selected_people" | "all_except_selected_people";
export type PrivateDocumentsScope = "none" | "all" | "selected_people" | "all_except_selected_people";
export type AccessCapability =
  | "people_operations"
  | "compensation_view"
  | "compensation_manage"
  | "private_employee_documents"
  | "finance_payroll_exports"
  | "company_access_settings";

export const ROLES: readonly Role[] = ["admin", "employee"] as const;
export const CUSTOMER_ACCESS_PROFILES: readonly AccessProfile[] = ["admin", "finance", "full_access", "employee"] as const;

export type ResolvedMembership = {
  id: string;
  tenantId: string;
  employeeId: string | null;
  profile: AccessProfile;
  displayProfile: "Admin" | "Finance" | "Full Access" | "Employee" | "Custom";
  peopleAccess: PeopleAccessScope;
  peopleSelectedEmployeeIds: string[];
  salaryAccessLevel: SalaryAccessLevel;
  salaryAccessScope: SalaryAccessScope;
  salarySelectedEmployeeIds: string[];
  privateDocumentsScope: PrivateDocumentsScope;
  privateDocumentsSelectedEmployeeIds: string[];
  financeExportsAccess: boolean;
  manageUsersAccess: boolean;
};

export type ResolvedIdentity = {
  authUserId: string;
  email: string;
  employeeId: string | null;
  tenantId: string | null;
  role: Role;
  accessProfile: AccessProfile;
  membershipId: string | null;
  memberships: ResolvedMembership[];
  currentMembership: ResolvedMembership | null;
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
  people_access_scope: PeopleAccessScope | null;
  people_selected_employee_ids: string[] | null;
  salary_access_level: SalaryAccessLevel | null;
  salary_access_scope: SalaryAccessScope | null;
  salary_selected_employee_ids: string[] | null;
  private_documents_scope: PrivateDocumentsScope | null;
  private_documents_selected_employee_ids: string[] | null;
  finance_exports_access: boolean | null;
  manage_users_access: boolean | null;
};

function presetAccess(profile: AccessProfile): Omit<ResolvedMembership, "id" | "tenantId" | "employeeId" | "profile" | "displayProfile"> {
  if (profile === "full_access") {
    return {
      peopleAccess: "all",
      peopleSelectedEmployeeIds: [],
      salaryAccessLevel: "manage",
      salaryAccessScope: "all",
      salarySelectedEmployeeIds: [],
      privateDocumentsScope: "all",
      privateDocumentsSelectedEmployeeIds: [],
      financeExportsAccess: true,
      manageUsersAccess: true,
    };
  }
  if (profile === "admin") {
    return {
      peopleAccess: "all",
      peopleSelectedEmployeeIds: [],
      salaryAccessLevel: "none",
      salaryAccessScope: "all",
      salarySelectedEmployeeIds: [],
      privateDocumentsScope: "none",
      privateDocumentsSelectedEmployeeIds: [],
      financeExportsAccess: false,
      manageUsersAccess: false,
    };
  }
  if (profile === "finance") {
    return {
      peopleAccess: "none",
      peopleSelectedEmployeeIds: [],
      salaryAccessLevel: "view",
      salaryAccessScope: "all",
      salarySelectedEmployeeIds: [],
      privateDocumentsScope: "none",
      privateDocumentsSelectedEmployeeIds: [],
      financeExportsAccess: true,
      manageUsersAccess: false,
    };
  }
  return {
    peopleAccess: "none",
    peopleSelectedEmployeeIds: [],
    salaryAccessLevel: "none",
    salaryAccessScope: "all",
    salarySelectedEmployeeIds: [],
    privateDocumentsScope: "none",
    privateDocumentsSelectedEmployeeIds: [],
    financeExportsAccess: false,
    manageUsersAccess: false,
  };
}

function accessForRow(row: MembershipRow): Omit<ResolvedMembership, "id" | "tenantId" | "employeeId" | "profile" | "displayProfile"> {
  const preset = presetAccess(row.profile);
  return {
    peopleAccess: row.people_access_scope ?? preset.peopleAccess,
    peopleSelectedEmployeeIds: row.people_selected_employee_ids ?? preset.peopleSelectedEmployeeIds,
    salaryAccessLevel: row.salary_access_level ?? preset.salaryAccessLevel,
    salaryAccessScope: row.salary_access_scope ?? preset.salaryAccessScope,
    salarySelectedEmployeeIds: row.salary_selected_employee_ids ?? preset.salarySelectedEmployeeIds,
    privateDocumentsScope: row.private_documents_scope ?? preset.privateDocumentsScope,
    privateDocumentsSelectedEmployeeIds: row.private_documents_selected_employee_ids ?? preset.privateDocumentsSelectedEmployeeIds,
    financeExportsAccess: row.finance_exports_access ?? preset.financeExportsAccess,
    manageUsersAccess: row.manage_users_access ?? preset.manageUsersAccess,
  };
}

function accessMatchesPreset(profile: AccessProfile, access: ReturnType<typeof presetAccess>): boolean {
  const preset = presetAccess(profile);
  return (
    access.peopleAccess === preset.peopleAccess &&
    access.peopleSelectedEmployeeIds.length === 0 &&
    access.salaryAccessLevel === preset.salaryAccessLevel &&
    access.salaryAccessScope === preset.salaryAccessScope &&
    access.salarySelectedEmployeeIds.length === 0 &&
    access.privateDocumentsScope === preset.privateDocumentsScope &&
    access.privateDocumentsSelectedEmployeeIds.length === 0 &&
    access.financeExportsAccess === preset.financeExportsAccess &&
    access.manageUsersAccess === preset.manageUsersAccess
  );
}

function displayProfile(profile: AccessProfile, access: ReturnType<typeof presetAccess>): ResolvedMembership["displayProfile"] {
  if (!accessMatchesPreset(profile, access)) return "Custom";
  if (profile === "admin") return "Admin";
  if (profile === "finance") return "Finance";
  if (profile === "full_access") return "Full Access";
  return "Employee";
}

function legacyProfileFromAppMetadata(user: AuthUser): AccessProfile {
  return user.app_metadata?.role === "admin" ? "full_access" : "employee";
}

function compatibilityRole(profile: AccessProfile): Role {
  if (profile === "admin" || profile === "full_access") return "admin";
  return "employee";
}

function preferredTenantFromMetadata(user: AuthUser): string | null {
  const value = user.app_metadata?.tenant_id;
  return typeof value === "string" && value.length > 0 ? value : null;
}

async function listDatabaseMemberships(user: AuthUser): Promise<ResolvedMembership[]> {
  const supabase = createServiceRoleClient();
  let result;
  try {
    result = await supabase
      .from("tenant_memberships")
      .select("id, tenant_id, employee_id, email, display_name, profile, active, removed_at, people_access_scope, people_selected_employee_ids, salary_access_level, salary_access_scope, salary_selected_employee_ids, private_documents_scope, private_documents_selected_employee_ids, finance_exports_access, manage_users_access")
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
  return rows.map((row) => {
    const access = accessForRow(row);
    return {
      id: row.id,
      tenantId: row.tenant_id,
      employeeId: row.employee_id,
      profile: row.profile,
      displayProfile: displayProfile(row.profile, access),
      ...access,
    };
  });
}

async function acceptPendingInvitations(user: AuthUser, email: string): Promise<void> {
  const supabase = createServiceRoleClient();
  let invitationResult;
  try {
    invitationResult = await supabase
      .from("tenant_access_invitations")
      .select("id, tenant_id, employee_id, email, display_name, profile, people_access_scope, people_selected_employee_ids, salary_access_level, salary_access_scope, salary_selected_employee_ids, private_documents_scope, private_documents_selected_employee_ids, finance_exports_access, manage_users_access")
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
    people_access_scope: PeopleAccessScope | null;
    people_selected_employee_ids: string[] | null;
    salary_access_level: SalaryAccessLevel | null;
    salary_access_scope: SalaryAccessScope | null;
    salary_selected_employee_ids: string[] | null;
    private_documents_scope: PrivateDocumentsScope | null;
    private_documents_selected_employee_ids: string[] | null;
    finance_exports_access: boolean | null;
    manage_users_access: boolean | null;
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
          people_access_scope: invitation.people_access_scope,
          people_selected_employee_ids: invitation.people_selected_employee_ids,
          salary_access_level: invitation.salary_access_level,
          salary_access_scope: invitation.salary_access_scope,
          salary_selected_employee_ids: invitation.salary_selected_employee_ids,
          private_documents_scope: invitation.private_documents_scope,
          private_documents_selected_employee_ids: invitation.private_documents_selected_employee_ids,
          finance_exports_access: invitation.finance_exports_access,
          manage_users_access: invitation.manage_users_access,
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
    await supabase
      .from("tenant_access_invitations")
      .update({ accepted_membership_id: (membership as { id: string }).id, accepted_at: new Date().toISOString() } as never)
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
  const memberships = await listDatabaseMemberships(user);
  const preferredTenantId = preferredTenantFromMetadata(user);
  const selectedMembership = selectCurrentMembership(memberships, preferredTenantId);

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
      accessProfile: selectedMembership.profile,
      membershipId: selectedMembership.id,
      memberships,
      currentMembership: selectedMembership,
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
    accessProfile: legacyProfile,
    membershipId: null,
    memberships,
    currentMembership: null,
  };
}
