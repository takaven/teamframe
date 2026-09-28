"use server";
import { redirect } from "next/navigation";
import { requireTenantActor } from "@/middleware/rbac";
import { listCustomFieldDefinitions, saveCustomFieldValues } from "@/services/customFieldService";

export async function savePersonCustomFieldsAction(formData: FormData): Promise<void> {
  const employeeId = String(formData.get("employee_id") ?? "");
  try { const actor = await requireTenantActor(); const definitions = await listCustomFieldDefinitions(actor); const values = Object.fromEntries(definitions.map((d) => [d.id, String(formData.get(`field_${d.id}`) ?? "")])); await saveCustomFieldValues(actor, employeeId, definitions, values); }
  catch { redirect(`/people/${employeeId}?error=INVALID_INPUT#personal`); }
  redirect(`/people/${employeeId}?status=updated#personal`);
}
