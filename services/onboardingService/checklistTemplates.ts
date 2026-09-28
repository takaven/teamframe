import "server-only";
import { z } from "zod";
import type { Actor } from "@/middleware/rbac";
import { createServiceRoleClient } from "@/lib/db/supabaseServer";
import { requireCapability } from "@/lib/rbac/access";
import { getTemplatePack } from "./templates";

export type ChecklistOwner = "employee" | "manager" | "admin";
export type ChecklistCompletion = "manual_confirmation" | "document_required";
export type ChecklistItem = {
  id: string; title: string; description: string | null; owner_role: ChecklistOwner;
  due_offset_days: number; sort_order: number; completion_mode: ChecklistCompletion;
  required_document_type: string | null; active: boolean;
};
export type ChecklistTemplate = {
  id: string; name: string; description: string | null; active: boolean; is_default: boolean;
  items: ChecklistItem[];
};

const templateInput = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional(),
});
const itemInput = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(500).optional(),
  ownerRole: z.enum(["employee", "manager", "admin"]),
  dueOffsetDays: z.number().int().min(-90).max(365),
  completionMode: z.enum(["manual_confirmation", "document_required"]),
  requiredDocumentType: z.string().trim().max(120).optional(),
}).refine((value) => value.completionMode !== "document_required" || Boolean(value.requiredDocumentType), {
  message: "DOCUMENT_TYPE_REQUIRED",
});

function tenant(actor: Actor): string {
  if (!actor.tenantId) throw new Error("NO_TENANT_CONTEXT");
  return actor.tenantId;
}
async function authorize(actor: Actor): Promise<string> {
  await requireCapability(actor, "company_access_settings");
  return tenant(actor);
}

export async function listChecklistTemplates(actor: Actor): Promise<ChecklistTemplate[]> {
  const tenantId = await authorize(actor);
  const db = createServiceRoleClient();
  const [templates, items] = await Promise.all([
    db.from("onboarding_checklist_templates").select("id,name,description,active,is_default").eq("tenant_id", tenantId).order("created_at"),
    db.from("onboarding_checklist_template_items").select("id,template_id,title,description,owner_role,due_offset_days,sort_order,completion_mode,required_document_type,active").eq("tenant_id", tenantId).order("sort_order"),
  ]);
  if (templates.error) throw new Error(`ONBOARDING_CHECKLIST_LIST_FAILED: ${templates.error.message}`);
  if (items.error) throw new Error(`ONBOARDING_CHECKLIST_LIST_FAILED: ${items.error.message}`);
  const allItems = (items.data ?? []) as Array<ChecklistItem & { template_id: string }>;
  return ((templates.data ?? []) as Omit<ChecklistTemplate, "items">[]).map((row) => ({
    ...row,
    items: allItems.filter((item) => item.template_id === row.id).map(({ template_id: _id, ...item }) => item),
  }));
}

export async function createChecklistTemplate(actor: Actor, input: unknown): Promise<string> {
  const tenantId = await authorize(actor);
  const value = templateInput.parse(input);
  const { data, error } = await createServiceRoleClient().from("onboarding_checklist_templates").insert({
    tenant_id: tenantId, name: value.name, description: value.description || null,
  } as never).select("id").single();
  if (error) throw new Error(`ONBOARDING_CHECKLIST_CREATE_FAILED: ${error.message}`);
  return (data as { id: string }).id;
}

export async function copyStarterChecklist(actor: Actor, packId: string): Promise<string> {
  const pack = getTemplatePack(packId);
  if (!pack) throw new Error("ONBOARDING_UNKNOWN_PACK");
  const templateId = await createChecklistTemplate(actor, { name: pack.name, description: pack.description });
  const tenantId = tenant(actor);
  const { error } = await createServiceRoleClient().from("onboarding_checklist_template_items").insert(pack.tasks.map((task, index) => ({
    tenant_id: tenantId, template_id: templateId, title: task.title, owner_role: "employee",
    due_offset_days: task.dueOffsetDays, sort_order: index, completion_mode: task.completionMode ?? "manual_confirmation",
    required_document_type: task.requiredDocumentType ?? null,
  })) as never);
  if (error) throw new Error(`ONBOARDING_CHECKLIST_CREATE_FAILED: ${error.message}`);
  return templateId;
}

export async function updateChecklistTemplate(actor: Actor, id: string, input: unknown): Promise<void> {
  const tenantId = await authorize(actor);
  const value = templateInput.parse(input);
  const { error } = await createServiceRoleClient().from("onboarding_checklist_templates").update({
    name: value.name, description: value.description || null,
  } as never).eq("tenant_id", tenantId).eq("id", id);
  if (error) throw new Error(`ONBOARDING_CHECKLIST_UPDATE_FAILED: ${error.message}`);
}

export async function setChecklistActive(actor: Actor, id: string, active: boolean): Promise<void> {
  const tenantId = await authorize(actor);
  const { error } = await createServiceRoleClient().from("onboarding_checklist_templates")
    .update({ active, ...(active ? {} : { is_default: false }) } as never).eq("tenant_id", tenantId).eq("id", id);
  if (error) throw new Error(`ONBOARDING_CHECKLIST_UPDATE_FAILED: ${error.message}`);
}

export async function setDefaultChecklist(actor: Actor, id: string): Promise<void> {
  const tenantId = await authorize(actor);
  const { error } = await createServiceRoleClient().rpc("teamframe_set_default_onboarding_checklist", {
    p_tenant_id: tenantId, p_template_id: id,
  } as never);
  if (error) throw new Error(`ONBOARDING_CHECKLIST_DEFAULT_FAILED: ${error.message}`);
}

export async function addChecklistItem(actor: Actor, templateId: string, input: unknown): Promise<void> {
  const tenantId = await authorize(actor);
  const value = itemInput.parse(input);
  const db = createServiceRoleClient();
  const existing = await db.from("onboarding_checklist_template_items").select("sort_order")
    .eq("tenant_id", tenantId).eq("template_id", templateId).order("sort_order", { ascending: false }).limit(1);
  if (existing.error) throw new Error(`ONBOARDING_CHECKLIST_UPDATE_FAILED: ${existing.error.message}`);
  const sortOrder = ((existing.data?.[0] as { sort_order: number } | undefined)?.sort_order ?? -1) + 1;
  const { error } = await db.from("onboarding_checklist_template_items").insert({
    tenant_id: tenantId, template_id: templateId, title: value.title, description: value.description || null,
    owner_role: value.ownerRole, due_offset_days: value.dueOffsetDays, sort_order: sortOrder,
    completion_mode: value.completionMode, required_document_type: value.requiredDocumentType || null,
  } as never);
  if (error) throw new Error(`ONBOARDING_CHECKLIST_UPDATE_FAILED: ${error.message}`);
}

export async function updateChecklistItem(actor: Actor, id: string, input: unknown): Promise<void> {
  const tenantId = await authorize(actor);
  const value = itemInput.parse(input);
  const { error } = await createServiceRoleClient().from("onboarding_checklist_template_items").update({
    title: value.title, description: value.description || null, owner_role: value.ownerRole,
    due_offset_days: value.dueOffsetDays, completion_mode: value.completionMode,
    required_document_type: value.requiredDocumentType || null,
  } as never).eq("tenant_id", tenantId).eq("id", id);
  if (error) throw new Error(`ONBOARDING_CHECKLIST_UPDATE_FAILED: ${error.message}`);
}

export async function removeChecklistItem(actor: Actor, id: string): Promise<void> {
  const tenantId = await authorize(actor);
  const { error } = await createServiceRoleClient().from("onboarding_checklist_template_items").delete().eq("tenant_id", tenantId).eq("id", id);
  if (error) throw new Error(`ONBOARDING_CHECKLIST_UPDATE_FAILED: ${error.message}`);
}

export async function moveChecklistItem(actor: Actor, id: string, direction: "up" | "down"): Promise<void> {
  const tenantId = await authorize(actor);
  const db = createServiceRoleClient();
  const current = await db.from("onboarding_checklist_template_items").select("id,template_id,sort_order").eq("tenant_id", tenantId).eq("id", id).maybeSingle();
  if (current.error || !current.data) throw new Error("ONBOARDING_CHECKLIST_ITEM_NOT_FOUND");
  const row = current.data as { id: string; template_id: string; sort_order: number };
  const neighbour = await db.from("onboarding_checklist_template_items").select("id,sort_order").eq("tenant_id", tenantId).eq("template_id", row.template_id)
    [direction === "up" ? "lt" : "gt"]("sort_order", row.sort_order).order("sort_order", { ascending: direction !== "up" }).limit(1).maybeSingle();
  if (neighbour.error) throw new Error(`ONBOARDING_CHECKLIST_UPDATE_FAILED: ${neighbour.error.message}`);
  if (!neighbour.data) return;
  const other = neighbour.data as { id: string; sort_order: number };
  const temporary = 10000;
  for (const [itemId, sortOrder] of [[row.id, temporary], [other.id, row.sort_order], [row.id, other.sort_order]] as const) {
    const result = await db.from("onboarding_checklist_template_items").update({ sort_order: sortOrder } as never).eq("tenant_id", tenantId).eq("id", itemId);
    if (result.error) throw new Error(`ONBOARDING_CHECKLIST_UPDATE_FAILED: ${result.error.message}`);
  }
}

export async function assignDefaultChecklist(actor: Actor, employeeId: string): Promise<number> {
  const tenantId = tenant(actor);
  if (actor.role !== "admin") throw new Error("FORBIDDEN");
  const { data, error } = await createServiceRoleClient().rpc("teamframe_assign_default_onboarding_checklist", {
    p_tenant_id: tenantId,
    p_employee_id: employeeId,
    p_actor_user_id: actor.authUserId,
  } as never);
  if (error) throw new Error(`ONBOARDING_CHECKLIST_ASSIGN_FAILED: ${error.message}`);
  return Number(data ?? 0);
}
