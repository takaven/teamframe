import "server-only";
import { z } from "zod";
import type { Actor } from "@/middleware/rbac";
import { createServiceRoleClient } from "@/lib/db/supabaseServer";
import { requireCapability } from "@/lib/rbac/access";

export type CustomFieldDefinition = { id: string; label: string; field_type: "text"|"number"|"date"|"yes_no"|"single_select"; choices: string[]; active: boolean };
export type CustomFieldValue = { definition_id: string; value: unknown };
const Definition = z.object({ label: z.string().trim().min(1).max(120), fieldType: z.enum(["text","number","date","yes_no","single_select"]), choices: z.array(z.string().trim().min(1).max(100)).max(50).default([]) });

function tenant(actor: Actor): string { if (!actor.tenantId) throw new Error("NO_TENANT_CONTEXT"); return actor.tenantId; }
function missing(error: { message?: string } | null): boolean { return Boolean(error?.message?.includes("custom_field_") && error.message.includes("does not exist")); }

export async function listCustomFieldDefinitions(actor: Actor): Promise<CustomFieldDefinition[]> {
  const { data, error } = await createServiceRoleClient().from("custom_field_definitions").select("id,label,field_type,choices,active").eq("tenant_id", tenant(actor)).order("created_at");
  if (missing(error)) return [];
  if (error) throw new Error(`CUSTOM_FIELD_LIST_FAILED: ${error.message}`);
  return (data ?? []) as CustomFieldDefinition[];
}
export async function createCustomFieldDefinition(actor: Actor, input: unknown): Promise<void> {
  await requireCapability(actor, "people_operations"); const parsed = Definition.parse(input);
  if (parsed.fieldType === "single_select" && parsed.choices.length === 0) throw new Error("CUSTOM_FIELD_CHOICES_REQUIRED");
  const { error } = await createServiceRoleClient().from("custom_field_definitions").insert({ tenant_id: tenant(actor), label: parsed.label, field_type: parsed.fieldType, choices: parsed.choices } as never);
  if (error) throw new Error(`CUSTOM_FIELD_CREATE_FAILED: ${error.message}`);
}
export async function setCustomFieldActive(actor: Actor, id: string, active: boolean): Promise<void> {
  await requireCapability(actor, "people_operations");
  const { error } = await createServiceRoleClient().from("custom_field_definitions").update({ active, updated_at: new Date().toISOString() } as never).eq("tenant_id", tenant(actor)).eq("id", id);
  if (error) throw new Error(`CUSTOM_FIELD_UPDATE_FAILED: ${error.message}`);
}
export async function listCustomFieldValues(actor: Actor, employeeId: string): Promise<CustomFieldValue[]> {
  await requireCapability(actor, "people_operations", { employeeId });
  const { data, error } = await createServiceRoleClient().from("custom_field_values").select("definition_id,value").eq("tenant_id", tenant(actor)).eq("employee_id", employeeId);
  if (missing(error)) return [];
  if (error) throw new Error(`CUSTOM_FIELD_VALUE_LIST_FAILED: ${error.message}`); return (data ?? []) as CustomFieldValue[];
}
export async function saveCustomFieldValues(actor: Actor, employeeId: string, definitions: CustomFieldDefinition[], values: Record<string,string>): Promise<void> {
  await requireCapability(actor, "people_operations", { employeeId }); const tenantId = tenant(actor);
  const rows = definitions.filter((d) => d.active).map((definition) => {
    const raw = values[definition.id] ?? ""; let value: unknown = raw;
    if (definition.field_type === "number") value = z.coerce.number().parse(raw);
    if (definition.field_type === "date") value = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse(raw);
    if (definition.field_type === "yes_no") value = z.enum(["yes","no"]).parse(raw);
    if (definition.field_type === "single_select") value = z.enum(definition.choices as [string, ...string[]]).parse(raw);
    return { tenant_id: tenantId, employee_id: employeeId, definition_id: definition.id, value };
  });
  if (rows.length === 0) return;
  const { error } = await createServiceRoleClient().from("custom_field_values").upsert(rows as never, { onConflict: "tenant_id,definition_id,employee_id" });
  if (error) throw new Error(`CUSTOM_FIELD_VALUE_SAVE_FAILED: ${error.message}`);
}
