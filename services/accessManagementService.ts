import "server-only";
import { z } from "zod";
import type { Actor } from "@/middleware/rbac";
import { createServiceRoleClient } from "@/lib/db/supabaseServer";
import { requireCapability } from "@/lib/rbac/access";
import type { AccessProfile, PeopleAccessScope, PrivateDocumentsScope, SalaryAccessLevel, SalaryAccessScope } from "@/lib/rbac/roles";

export type AccessMembershipRow = {
  id: string;
  email: string;
  display_name: string;
  profile: AccessProfile;
  display_profile: "Admin" | "Finance" | "Full Access" | "Employee" | "Custom";
  employee_id: string | null;
  active: boolean;
  people_access_scope: PeopleAccessScope;
  people_selected_employee_ids: string[];
  salary_access_level: SalaryAccessLevel;
  salary_access_scope: SalaryAccessScope;
  salary_selected_employee_ids: string[];
  private_documents_scope: PrivateDocumentsScope;
  private_documents_selected_employee_ids: string[];
  finance_exports_access: boolean;
  manage_users_access: boolean;
};

const ProfileSchema = z.enum(["admin", "finance", "full_access", "employee"]);
const PeopleScopeSchema = z.enum(["none", "all", "direct_reports", "selected_people", "all_except_selected_people"]);
const SalaryLevelSchema = z.enum(["none", "view", "manage"]);
const SalaryScopeSchema = z.enum(["all", "direct_reports", "selected_people", "all_except_selected_people"]);
const PrivateDocumentsScopeSchema = z.enum(["none", "all", "selected_people", "all_except_selected_people"]);

const MatrixSchema = z.object({
  peopleAccessScope: PeopleScopeSchema,
  peopleSelectedEmployeeIds: z.array(z.string().uuid()).default([]),
  salaryAccessLevel: SalaryLevelSchema,
  salaryAccessScope: SalaryScopeSchema,
  salarySelectedEmployeeIds: z.array(z.string().uuid()).default([]),
  privateDocumentsScope: PrivateDocumentsScopeSchema,
  privateDocumentsSelectedEmployeeIds: z.array(z.string().uuid()).default([]),
  financeExportsAccess: z.boolean(),
  manageUsersAccess: z.boolean(),
});

export type AccessMatrixInput = z.infer<typeof MatrixSchema>;

function requireTenant(actor: Actor): string {
  if (!actor.tenantId) throw new Error("NO_TENANT_CONTEXT");
  return actor.tenantId;
}

async function requireAccessManager(actor: Actor): Promise<string> {
  const tenantId = requireTenant(actor);
  await requireCapability(actor, "company_access_settings");
  return tenantId;
}

function presetMatrix(profile: AccessProfile): AccessMatrixInput {
  if (profile === "full_access") {
    return {
      peopleAccessScope: "all",
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
      peopleAccessScope: "all",
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
      peopleAccessScope: "none",
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
    peopleAccessScope: "none",
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

function displayProfile(row: AccessMembershipRow): AccessMembershipRow["display_profile"] {
  const preset = presetMatrix(row.profile);
  const matches =
    row.people_access_scope === preset.peopleAccessScope &&
    row.people_selected_employee_ids.length === 0 &&
    row.salary_access_level === preset.salaryAccessLevel &&
    row.salary_access_scope === preset.salaryAccessScope &&
    row.salary_selected_employee_ids.length === 0 &&
    row.private_documents_scope === preset.privateDocumentsScope &&
    row.private_documents_selected_employee_ids.length === 0 &&
    row.finance_exports_access === preset.financeExportsAccess &&
    row.manage_users_access === preset.manageUsersAccess;
  if (!matches) return "Custom";
  if (row.profile === "admin") return "Admin";
  if (row.profile === "finance") return "Finance";
  if (row.profile === "full_access") return "Full Access";
  return "Employee";
}

async function assertNotLastFullAccess(tenantId: string, membershipId: string, nextProfile?: AccessProfile, deactivate = false): Promise<void> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("tenant_memberships")
    .select("id, profile, active, removed_at")
    .eq("tenant_id", tenantId)
    .eq("profile", "full_access")
    .eq("active", true)
    .is("removed_at", null);
  if (error) throw new Error(`ACCESS_FULL_ACCESS_CHECK_FAILED: ${error.message}`);
  const fullAccessIds = ((data ?? []) as Array<{ id: string }>).map((row) => row.id);
  if (fullAccessIds.length === 1 && fullAccessIds[0] === membershipId && (deactivate || nextProfile !== "full_access")) {
    throw new Error("LAST_FULL_ACCESS_REQUIRED");
  }
}

export async function listAccessMemberships(actor: Actor): Promise<{ memberships: AccessMembershipRow[] }> {
  const tenantId = await requireAccessManager(actor);
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("tenant_memberships")
    .select("id, email, display_name, profile, employee_id, active, people_access_scope, people_selected_employee_ids, salary_access_level, salary_access_scope, salary_selected_employee_ids, private_documents_scope, private_documents_selected_employee_ids, finance_exports_access, manage_users_access")
    .eq("tenant_id", tenantId)
    .is("removed_at", null)
    .order("display_name", { ascending: true });
  if (error) throw new Error(`ACCESS_MEMBERSHIPS_FAILED: ${error.message}`);

  const memberships = ((data ?? []) as Array<Omit<AccessMembershipRow, "display_profile">>).map((row) => {
    const normalized: AccessMembershipRow = {
      ...row,
      people_access_scope: row.people_access_scope ?? presetMatrix(row.profile).peopleAccessScope,
      people_selected_employee_ids: row.people_selected_employee_ids ?? [],
      salary_access_level: row.salary_access_level ?? presetMatrix(row.profile).salaryAccessLevel,
      salary_access_scope: row.salary_access_scope ?? presetMatrix(row.profile).salaryAccessScope,
      salary_selected_employee_ids: row.salary_selected_employee_ids ?? [],
      private_documents_scope: row.private_documents_scope ?? presetMatrix(row.profile).privateDocumentsScope,
      private_documents_selected_employee_ids: row.private_documents_selected_employee_ids ?? [],
      finance_exports_access: row.finance_exports_access ?? presetMatrix(row.profile).financeExportsAccess,
      manage_users_access: row.manage_users_access ?? presetMatrix(row.profile).manageUsersAccess,
      display_profile: "Employee",
    };
    return { ...normalized, display_profile: displayProfile(normalized) };
  });
  return { memberships };
}

export async function updateAccessProfile(actor: Actor, input: { membershipId: string; profile: AccessProfile }): Promise<void> {
  const tenantId = await requireAccessManager(actor);
  const parsed = z.object({ membershipId: z.string().uuid(), profile: ProfileSchema }).parse(input);
  await assertNotLastFullAccess(tenantId, parsed.membershipId, parsed.profile);
  const preset = presetMatrix(parsed.profile);
  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .from("tenant_memberships")
    .update({
      profile: parsed.profile,
      people_access_scope: preset.peopleAccessScope,
      people_selected_employee_ids: preset.peopleSelectedEmployeeIds,
      salary_access_level: preset.salaryAccessLevel,
      salary_access_scope: preset.salaryAccessScope,
      salary_selected_employee_ids: preset.salarySelectedEmployeeIds,
      private_documents_scope: preset.privateDocumentsScope,
      private_documents_selected_employee_ids: preset.privateDocumentsSelectedEmployeeIds,
      finance_exports_access: preset.financeExportsAccess,
      manage_users_access: preset.manageUsersAccess,
    } as never)
    .eq("tenant_id", tenantId)
    .eq("id", parsed.membershipId);
  if (error) throw new Error(`ACCESS_PROFILE_UPDATE_FAILED: ${error.message}`);
}

export async function updateAccessMatrix(actor: Actor, input: { membershipId: string; matrix: AccessMatrixInput }): Promise<void> {
  const tenantId = await requireAccessManager(actor);
  const parsed = z.object({ membershipId: z.string().uuid(), matrix: MatrixSchema }).parse(input);
  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .from("tenant_memberships")
    .update({
      people_access_scope: parsed.matrix.peopleAccessScope,
      people_selected_employee_ids: parsed.matrix.peopleSelectedEmployeeIds,
      salary_access_level: parsed.matrix.salaryAccessLevel,
      salary_access_scope: parsed.matrix.salaryAccessScope,
      salary_selected_employee_ids: parsed.matrix.salarySelectedEmployeeIds,
      private_documents_scope: parsed.matrix.privateDocumentsScope,
      private_documents_selected_employee_ids: parsed.matrix.privateDocumentsSelectedEmployeeIds,
      finance_exports_access: parsed.matrix.financeExportsAccess,
      manage_users_access: parsed.matrix.manageUsersAccess,
    } as never)
    .eq("tenant_id", tenantId)
    .eq("id", parsed.membershipId);
  if (error) throw new Error(`ACCESS_MATRIX_UPDATE_FAILED: ${error.message}`);
}

export async function setMembershipActive(actor: Actor, input: { membershipId: string; active: boolean }): Promise<void> {
  const tenantId = await requireAccessManager(actor);
  const parsed = z.object({ membershipId: z.string().uuid(), active: z.boolean() }).parse(input);
  if (!parsed.active) await assertNotLastFullAccess(tenantId, parsed.membershipId, undefined, true);
  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .from("tenant_memberships")
    .update({ active: parsed.active } as never)
    .eq("tenant_id", tenantId)
    .eq("id", parsed.membershipId);
  if (error) throw new Error(`ACCESS_MEMBERSHIP_UPDATE_FAILED: ${error.message}`);
}
