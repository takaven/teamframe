"use server";
/* eslint-disable @typescript-eslint/no-explicit-any -- notification ledger is a versioned table not yet present in generated Supabase types. */
import { revalidatePath } from "next/cache";
import { requireTenantRole } from "@/middleware/rbac";
import { createServiceRoleClient } from "@/lib/db/supabaseServer";
import { notifyBestEffort, retryDelivery } from "@/services/notificationService";

const text = (value: FormDataEntryValue | null) => typeof value === "string" ? value.trim() : "";
const label = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
const day = () => new Date().toISOString().slice(0, 10);

export async function remindDocumentAction(formData: FormData): Promise<void> {
  const actor = await requireTenantRole("admin");
  const id = text(formData.get("requirement_id"));
  const db: any = createServiceRoleClient();
  const { data, error } = await db.from("document_requirements").select("id,employee_id,document_type,due_date,state").eq("tenant_id", actor.tenantId).eq("id", id).single();
  if (error || !data || ["accepted", "replaced", "cancelled"].includes(data.state)) throw new Error("DOCUMENT_REMINDER_NOT_AVAILABLE");
  await notifyBestEffort({ tenantId: actor.tenantId, recipientEmployeeId: data.employee_id, type: "document_action", eventKey: `document-request:${id}:reminder:${day()}`, subject: `${label(data.document_type)} needed`, text: `Please upload ${label(data.document_type)}${data.due_date ? ` by ${data.due_date}` : ""}.`, actionPath: "/documents-and-policies#documents", relatedEntityType: "document_requirement", relatedEntityId: id });
  revalidatePath("/documents");
}

export async function remindPolicyAction(formData: FormData): Promise<void> {
  const actor = await requireTenantRole("admin");
  const policyId = text(formData.get("policy_id"));
  const employeeId = text(formData.get("employee_id"));
  const db: any = createServiceRoleClient();
  const { data, error } = await db.from("policies").select("id,title,version,is_published").eq("tenant_id", actor.tenantId).eq("id", policyId).single();
  if (error || !data?.is_published) throw new Error("POLICY_REMINDER_NOT_AVAILABLE");
  const { count } = await db.from("acknowledgements").select("id", { count: "exact", head: true }).eq("tenant_id", actor.tenantId).eq("policy_id", policyId).eq("policy_version", data.version).eq("employee_id", employeeId);
  if (count) return;
  await notifyBestEffort({ tenantId: actor.tenantId, recipientEmployeeId: employeeId, type: "policy_acknowledgement", eventKey: `policy:${policyId}:${data.version}:ack:${employeeId}:reminder:${day()}`, subject: "Policy acknowledgement needed", text: `${data.title} is ready for you to read and acknowledge.`, actionPath: "/documents-and-policies#policies", relatedEntityType: "policy", relatedEntityId: policyId });
  revalidatePath("/policies");
}

export async function retryNotificationAction(formData: FormData): Promise<void> {
  const actor = await requireTenantRole("admin");
  await retryDelivery(actor, text(formData.get("delivery_id")));
  revalidatePath("/dashboard");
}
