"use server";
import { redirect } from "next/navigation";
import { requireTenantActor } from "@/middleware/rbac";
import { createCustomFieldDefinition, setCustomFieldActive } from "@/services/customFieldService";

export async function createCustomFieldAction(formData: FormData): Promise<void> {
  try { const actor = await requireTenantActor(); await createCustomFieldDefinition(actor, { label: formData.get("label"), fieldType: formData.get("field_type"), choices: String(formData.get("choices") ?? "").split(",").map((v) => v.trim()).filter(Boolean) }); }
  catch { redirect("/setup?section=company&error=INVALID_INPUT"); }
  redirect("/setup?section=company&status=custom_field_created");
}
export async function toggleCustomFieldAction(formData: FormData): Promise<void> {
  try { const actor = await requireTenantActor(); await setCustomFieldActive(actor, String(formData.get("id")), formData.get("active") === "true"); }
  catch { redirect("/setup?section=company&error=INVALID_INPUT"); }
  redirect("/setup?section=company&status=custom_field_updated");
}
