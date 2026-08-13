"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireTenantActor } from "@/middleware/rbac";
import { setMembershipActive, updateAccessMatrix, updateAccessProfile } from "@/services/accessManagementService";

const ProfileSchema = z.object({
  membership_id: z.string().uuid(),
  profile: z.enum(["admin", "finance", "full_access", "employee"]),
});

const ActiveSchema = z.object({
  membership_id: z.string().uuid(),
  active: z.enum(["true", "false"]),
});

const MatrixSchema = z.object({
  membership_id: z.string().uuid(),
  people_access_scope: z.enum(["none", "all", "direct_reports", "selected_people", "all_except_selected_people"]),
  people_selected_employee_ids: z.string().optional().nullable(),
  salary_access_level: z.enum(["none", "view", "manage"]),
  salary_access_scope: z.enum(["all", "direct_reports", "selected_people", "all_except_selected_people"]),
  salary_selected_employee_ids: z.string().optional().nullable(),
  private_documents_scope: z.enum(["none", "all", "selected_people", "all_except_selected_people"]),
  private_documents_selected_employee_ids: z.string().optional().nullable(),
  finance_exports_access: z.string().optional(),
  manage_users_access: z.string().optional(),
});

function errorCode(error: unknown): string {
  return error instanceof Error ? (error.message.split(":")[0] ?? "UNKNOWN") : "UNKNOWN";
}

function parseIds(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split(/[,\s]+/)
    .map((id) => id.trim())
    .filter(Boolean);
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

export async function updateAccessMatrixAction(formData: FormData): Promise<void> {
  try {
    const actor = await requireTenantActor();
    const parsed = MatrixSchema.parse({
      membership_id: formData.get("membership_id"),
      people_access_scope: formData.get("people_access_scope"),
      people_selected_employee_ids: formData.get("people_selected_employee_ids"),
      salary_access_level: formData.get("salary_access_level"),
      salary_access_scope: formData.get("salary_access_scope"),
      salary_selected_employee_ids: formData.get("salary_selected_employee_ids"),
      private_documents_scope: formData.get("private_documents_scope"),
      private_documents_selected_employee_ids: formData.get("private_documents_selected_employee_ids"),
      finance_exports_access: formData.get("finance_exports_access") ? "true" : undefined,
      manage_users_access: formData.get("manage_users_access") ? "true" : undefined,
    });
    await updateAccessMatrix(actor, {
      membershipId: parsed.membership_id,
      matrix: {
        peopleAccessScope: parsed.people_access_scope,
        peopleSelectedEmployeeIds: parseIds(parsed.people_selected_employee_ids),
        salaryAccessLevel: parsed.salary_access_level,
        salaryAccessScope: parsed.salary_access_scope,
        salarySelectedEmployeeIds: parseIds(parsed.salary_selected_employee_ids),
        privateDocumentsScope: parsed.private_documents_scope,
        privateDocumentsSelectedEmployeeIds: parseIds(parsed.private_documents_selected_employee_ids),
        financeExportsAccess: parsed.finance_exports_access === "true",
        manageUsersAccess: parsed.manage_users_access === "true",
      },
    });
  } catch (error) {
    redirect(`/access?error=${encodeURIComponent(errorCode(error))}`);
  }
  redirect("/access?status=matrix_updated");
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
