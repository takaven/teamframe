"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireTenantActor } from "@/middleware/rbac";
import { createAccessRule, deleteAccessRule, setMembershipActive, updateAccessProfile } from "@/services/accessManagementService";

const ProfileSchema = z.object({
  membership_id: z.string().uuid(),
  profile: z.enum(["admin", "finance", "full_access", "employee"]),
});

const ActiveSchema = z.object({
  membership_id: z.string().uuid(),
  active: z.enum(["true", "false"]),
});

const RuleSchema = z.object({
  membership_id: z.string().uuid(),
  capability: z.enum([
    "people_operations",
    "compensation_view",
    "compensation_manage",
    "private_employee_documents",
    "finance_payroll_exports",
    "company_access_settings",
  ]),
  effect: z.enum(["allow", "restrict"]),
  scope: z.enum(["whole_company", "own_team", "department", "selected_people"]),
  department: z.string().optional().nullable(),
  employee_id: z.string().optional().nullable(),
});

function errorCode(error: unknown): string {
  return error instanceof Error ? (error.message.split(":")[0] ?? "UNKNOWN") : "UNKNOWN";
}

export async function updateAccessProfileAction(formData: FormData): Promise<void> {
  try {
    const actor = await requireTenantActor();
    const parsed = ProfileSchema.parse({
      membership_id: formData.get("membership_id"),
      profile: formData.get("profile"),
    });
    await updateAccessProfile(actor, { membershipId: parsed.membership_id, profile: parsed.profile });
  } catch (error) {
    redirect(`/access?error=${encodeURIComponent(errorCode(error))}`);
  }
  redirect("/access?status=updated");
}

export async function setMembershipActiveAction(formData: FormData): Promise<void> {
  try {
    const actor = await requireTenantActor();
    const parsed = ActiveSchema.parse({
      membership_id: formData.get("membership_id"),
      active: formData.get("active"),
    });
    await setMembershipActive(actor, { membershipId: parsed.membership_id, active: parsed.active === "true" });
  } catch (error) {
    redirect(`/access?error=${encodeURIComponent(errorCode(error))}`);
  }
  redirect("/access?status=updated");
}

export async function createAccessRuleAction(formData: FormData): Promise<void> {
  try {
    const actor = await requireTenantActor();
    const parsed = RuleSchema.parse({
      membership_id: formData.get("membership_id"),
      capability: formData.get("capability"),
      effect: formData.get("effect"),
      scope: formData.get("scope"),
      department: formData.get("department"),
      employee_id: formData.get("employee_id") || null,
    });
    await createAccessRule(actor, {
      membershipId: parsed.membership_id,
      capability: parsed.capability,
      effect: parsed.effect,
      scope: parsed.scope,
      department: parsed.department,
      employeeId: parsed.employee_id,
    });
  } catch (error) {
    redirect(`/access?error=${encodeURIComponent(errorCode(error))}`);
  }
  redirect("/access?status=rule_added");
}

export async function deleteAccessRuleAction(formData: FormData): Promise<void> {
  try {
    const actor = await requireTenantActor();
    const ruleId = z.string().uuid().parse(formData.get("rule_id"));
    await deleteAccessRule(actor, ruleId);
  } catch (error) {
    redirect(`/access?error=${encodeURIComponent(errorCode(error))}`);
  }
  redirect("/access?status=rule_removed");
}
