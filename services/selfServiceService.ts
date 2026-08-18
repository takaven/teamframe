import "server-only";
import { z } from "zod";
import type { Actor } from "@/middleware/rbac";
import { createServiceRoleClient } from "@/lib/db/supabaseServer";

/**
 * Employee self-service writes (Phase 4).
 *
 * SECURITY MODEL: the target employee is ALWAYS derived from the authenticated actor
 * (`actor.employeeId`) — never from the browser. These functions update only the
 * caller's own record, only the field whitelist below (employer-controlled fields are
 * never writable here), scoped to the actor's tenant, and audit-logged. The generic
 * table RLS (employees = admin-only, payment = finance/compensation_manage) is left
 * UNCHANGED; this is a bounded server-side path, not an RLS broadening.
 */

function ownEmployeeId(actor: Actor): { tenantId: string; employeeId: string } {
  if (!actor.tenantId) throw new Error("NO_TENANT_CONTEXT");
  if (!actor.employeeId) throw new Error("NO_EMPLOYEE_RECORD");
  return { tenantId: actor.tenantId, employeeId: actor.employeeId };
}

async function audit(actor: Actor, tenantId: string, actionType: string, targetId: string): Promise<void> {
  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("audit_logs").insert({
    tenant_id: tenantId, actor_user_id: actor.authUserId, action_type: actionType, target_id: targetId,
  } as never);
  if (error) throw new Error(`AUDIT_LOG_FAILED: ${error.message}`);
}

const emptyToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);
const OwnProfileSchema = z.object({
  preferred_name: z.preprocess(emptyToNull, z.string().trim().max(120).nullable()),
  date_of_birth: z.preprocess(emptyToNull, z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable()),
  gender: z.preprocess(emptyToNull, z.enum(["male", "female", "other", "prefer_not_to_say"]).nullable()),
  nationality: z.preprocess(emptyToNull, z.string().trim().max(100).nullable()),
  personal_email: z.preprocess(emptyToNull, z.string().trim().toLowerCase().email().max(254).nullable()),
  mobile: z.preprocess(emptyToNull, z.string().trim().max(40).nullable()),
  residential_address: z.preprocess(emptyToNull, z.string().trim().max(400).nullable()),
  emergency_contact_name: z.preprocess(emptyToNull, z.string().trim().max(160).nullable()),
  emergency_contact_relationship: z.preprocess(emptyToNull, z.string().trim().max(80).nullable()),
  emergency_contact_phone: z.preprocess(emptyToNull, z.string().trim().max(40).nullable()),
  emergency_contact_email: z.preprocess(emptyToNull, z.string().trim().toLowerCase().email().max(254).nullable()),
});

export async function updateOwnProfile(actor: Actor, input: unknown): Promise<void> {
  const { tenantId, employeeId } = ownEmployeeId(actor);
  const parsed = OwnProfileSchema.parse(input);
  const supabase = createServiceRoleClient();
  // Whitelist only — full_name, employee_number, company email/phone, employment and
  // all org fields are NOT present here and can never be written via this path.
  const { error } = await supabase
    .from("employees")
    .update(parsed as never)
    .eq("tenant_id", tenantId)
    .eq("id", employeeId)
    .is("deleted_at", null);
  if (error) throw new Error(`SELF_PROFILE_UPDATE_FAILED: ${error.message}`);
  await audit(actor, tenantId, "employee.self_profile_updated", employeeId);
}

const OwnPaymentSchema = z.object({
  account_holder_name: z.preprocess(emptyToNull, z.string().trim().max(160).nullable()),
  bank_name: z.preprocess(emptyToNull, z.string().trim().max(160).nullable()),
  account_number_iban: z.preprocess(emptyToNull, z.string().trim().max(60).nullable()),
  routing_sort_branch_code: z.preprocess(emptyToNull, z.string().trim().max(40).nullable()),
  swift_bic: z.preprocess(emptyToNull, z.string().trim().max(20).nullable()),
  account_currency: z.preprocess(emptyToNull, z.string().trim().length(3).nullable()),
});

export async function upsertOwnPaymentDetails(actor: Actor, input: unknown): Promise<void> {
  const { tenantId, employeeId } = ownEmployeeId(actor);
  const parsed = OwnPaymentSchema.parse(input);
  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .from("employee_payment_details")
    .upsert({ tenant_id: tenantId, employee_id: employeeId, ...parsed } as never, { onConflict: "employee_id" });
  if (error) throw new Error(`SELF_PAYMENT_UPDATE_FAILED: ${error.message}`);
  await audit(actor, tenantId, "employee.self_payment_updated", employeeId);
}

export type OwnPaymentDetails = {
  account_holder_name: string | null; bank_name: string | null; account_number_iban: string | null;
  routing_sort_branch_code: string | null; swift_bic: string | null; account_currency: string | null;
};

/** Read the caller's OWN payment details (derived from actor; never a client id). */
export async function getOwnPaymentDetails(actor: Actor): Promise<OwnPaymentDetails | null> {
  const { tenantId, employeeId } = ownEmployeeId(actor);
  const supabase = createServiceRoleClient();
  const query = await supabase
    .from("employee_payment_details")
    .select("account_holder_name, bank_name, account_number_iban, routing_sort_branch_code, swift_bic, account_currency")
    .eq("tenant_id", tenantId)
    .eq("employee_id", employeeId)
    .maybeSingle();
  if (query.error) throw new Error(`SELF_PAYMENT_FETCH_FAILED: ${query.error.message}`);
  return (query.data as unknown as OwnPaymentDetails | null) ?? null;
}
