import "server-only";
import { z } from "zod";
import type { Actor } from "@/middleware/rbac";
import { createServiceRoleClient } from "@/lib/db/supabaseServer";
import { requireCapability } from "@/lib/rbac/access";
import type { AccessCapability, AccessEffect, AccessProfile, AccessScope } from "@/lib/rbac/roles";

export type AccessMembershipRow = {
  id: string;
  email: string;
  display_name: string;
  profile: AccessProfile;
  employee_id: string | null;
  active: boolean;
  rule_count: number;
};

export type AccessRuleRow = {
  id: string;
  membership_id: string;
  capability: AccessCapability;
  effect: AccessEffect;
  scope: AccessScope;
  department: string | null;
  employee_id: string | null;
};

const ProfileSchema = z.enum(["admin", "finance", "full_access", "employee"]);
const CapabilitySchema = z.enum([
  "people_operations",
  "compensation_view",
  "compensation_manage",
  "private_employee_documents",
  "finance_payroll_exports",
  "company_access_settings",
]);
const ScopeSchema = z.enum(["whole_company", "own_team", "department", "selected_people"]);
const EffectSchema = z.enum(["allow", "restrict"]);

function requireTenant(actor: Actor): string {
  if (!actor.tenantId) throw new Error("NO_TENANT_CONTEXT");
  return actor.tenantId;
}

async function requireAccessManager(actor: Actor): Promise<string> {
  const tenantId = requireTenant(actor);
  await requireCapability(actor, "company_access_settings");
  return tenantId;
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

export async function listAccessMemberships(actor: Actor): Promise<{
  memberships: AccessMembershipRow[];
  rules: AccessRuleRow[];
}> {
  const tenantId = await requireAccessManager(actor);
  const supabase = createServiceRoleClient();
  const [{ data: membershipsData, error: membershipsError }, { data: rulesData, error: rulesError }] = await Promise.all([
    supabase
      .from("tenant_memberships")
      .select("id, email, display_name, profile, employee_id, active")
      .eq("tenant_id", tenantId)
      .is("removed_at", null)
      .order("display_name", { ascending: true }),
    supabase
      .from("membership_access_rules")
      .select("id, membership_id, capability, effect, scope, department, employee_id")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: true }),
  ]);
  if (membershipsError) throw new Error(`ACCESS_MEMBERSHIPS_FAILED: ${membershipsError.message}`);
  if (rulesError) throw new Error(`ACCESS_RULES_FAILED: ${rulesError.message}`);

  const rules = (rulesData ?? []) as AccessRuleRow[];
  const ruleCounts = new Map<string, number>();
  for (const rule of rules) ruleCounts.set(rule.membership_id, (ruleCounts.get(rule.membership_id) ?? 0) + 1);
  const memberships = ((membershipsData ?? []) as Omit<AccessMembershipRow, "rule_count">[]).map((membership) => ({
    ...membership,
    rule_count: ruleCounts.get(membership.id) ?? 0,
  }));
  return { memberships, rules };
}

export async function updateAccessProfile(
  actor: Actor,
  input: { membershipId: string; profile: AccessProfile },
): Promise<void> {
  const tenantId = await requireAccessManager(actor);
  const parsed = z.object({ membershipId: z.string().uuid(), profile: ProfileSchema }).parse(input);
  await assertNotLastFullAccess(tenantId, parsed.membershipId, parsed.profile);
  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .from("tenant_memberships")
    .update({ profile: parsed.profile } as never)
    .eq("tenant_id", tenantId)
    .eq("id", parsed.membershipId);
  if (error) throw new Error(`ACCESS_PROFILE_UPDATE_FAILED: ${error.message}`);
}

export async function setMembershipActive(actor: Actor, input: { membershipId: string; active: boolean }): Promise<void> {
  const tenantId = await requireAccessManager(actor);
  const parsed = z.object({ membershipId: z.string().uuid(), active: z.boolean() }).parse(input);
  if (!parsed.active) await assertNotLastFullAccess(tenantId, parsed.membershipId, undefined, true);
  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .from("tenant_memberships")
    .update({
      active: parsed.active,
      suspended_at: parsed.active ? null : new Date().toISOString(),
    } as never)
    .eq("tenant_id", tenantId)
    .eq("id", parsed.membershipId);
  if (error) throw new Error(`ACCESS_MEMBERSHIP_UPDATE_FAILED: ${error.message}`);
}

export async function createAccessRule(
  actor: Actor,
  input: {
    membershipId: string;
    capability: AccessCapability;
    effect: AccessEffect;
    scope: AccessScope;
    department?: string | null;
    employeeId?: string | null;
  },
): Promise<void> {
  const tenantId = await requireAccessManager(actor);
  const parsed = z
    .object({
      membershipId: z.string().uuid(),
      capability: CapabilitySchema,
      effect: EffectSchema,
      scope: ScopeSchema,
      department: z.string().trim().min(1).optional().nullable(),
      employeeId: z.string().uuid().optional().nullable(),
    })
    .parse(input);
  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("membership_access_rules").insert({
    tenant_id: tenantId,
    membership_id: parsed.membershipId,
    capability: parsed.capability,
    effect: parsed.effect,
    scope: parsed.scope,
    department: parsed.scope === "department" ? parsed.department : null,
    employee_id: parsed.scope === "selected_people" ? parsed.employeeId : null,
    created_by_user_id: actor.authUserId,
  } as never);
  if (error) throw new Error(`ACCESS_RULE_CREATE_FAILED: ${error.message}`);
}

export async function deleteAccessRule(actor: Actor, ruleId: string): Promise<void> {
  const tenantId = await requireAccessManager(actor);
  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("membership_access_rules").delete().eq("tenant_id", tenantId).eq("id", ruleId);
  if (error) throw new Error(`ACCESS_RULE_DELETE_FAILED: ${error.message}`);
}
