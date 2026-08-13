import "server-only";

import { z } from "zod";
import { createServiceRoleClient } from "@/lib/db/supabaseServer";
import type { Actor } from "@/middleware/rbac";

const EmploymentChangePatchSchema = z
  .object({
    role_title: z.string().trim().min(1).max(200).optional(),
    department: z.string().trim().min(1).max(120).optional(),
    manager_id: z.string().uuid().nullable().optional(),
    position_id: z.string().uuid().nullable().optional(),
    employment_type: z.enum(["full_time", "part_time", "contractor", "intern"]).optional(),
    country: z.string().trim().min(2).max(100).optional(),
    grade: z.string().trim().max(100).nullable().optional(),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  })
  .strict();

const RecordEmploymentChangeSchema = z.object({
  employeeId: z.string().uuid(),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  patch: EmploymentChangePatchSchema,
  idempotencyKey: z.string().trim().min(1).max(180).optional(),
});

export type RecordEmploymentChangeInput = z.infer<typeof RecordEmploymentChangeSchema>;

export type EmploymentChangeRecord = {
  id: string;
  tenant_id: string;
  employee_id: string;
  effective_date: string;
  status: "pending" | "applied" | "cancelled" | "superseded" | "failed";
  change_keys: string[];
  old_values: Record<string, unknown>;
  new_values: Record<string, unknown>;
  recorded_by_user_id: string;
  recorded_at: string;
  applied_at: string | null;
  applied_by_actor_type: "human" | "system" | null;
  cancelled_at: string | null;
  cancelled_by_user_id: string | null;
  automation_item_id: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

function requireTenant(actor: Actor): string {
  if (!actor.tenantId) throw new Error("NO_TENANT_CONTEXT");
  return actor.tenantId;
}

function requireAdmin(actor: Actor): void {
  if (actor.role !== "admin" && !actor.isPlatformOwner) throw new Error("FORBIDDEN");
}

function removeUndefinedValues(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
}

export async function recordEmploymentChange(
  actor: Actor,
  input: unknown,
): Promise<EmploymentChangeRecord> {
  requireAdmin(actor);
  const tenantId = requireTenant(actor);
  const parsed = RecordEmploymentChangeSchema.parse(input);
  const patch = removeUndefinedValues(parsed.patch);

  if (Object.keys(patch).length === 0) {
    throw new Error("EMPLOYMENT_CHANGE_EMPTY");
  }

  const supabase: any = createServiceRoleClient();
  const { data, error } = await supabase
    .rpc("teamframe_record_employment_change", {
      p_tenant_id: tenantId,
      p_actor_user_id: actor.authUserId,
      p_employee_id: parsed.employeeId,
      p_effective_date: parsed.effectiveDate,
      p_patch: patch,
      p_idempotency_key: parsed.idempotencyKey ?? null,
    })
    .maybeSingle();

  if (error) {
    throw new Error(`EMPLOYMENT_CHANGE_RECORD_FAILED: ${error.message}`);
  }
  if (!data) {
    throw new Error("EMPLOYMENT_CHANGE_RECORD_FAILED");
  }

  return data as EmploymentChangeRecord;
}

export async function cancelEmploymentChange(
  actor: Actor,
  changeId: string,
): Promise<EmploymentChangeRecord> {
  requireAdmin(actor);
  const tenantId = requireTenant(actor);

  const supabase: any = createServiceRoleClient();
  const { data, error } = await supabase
    .rpc("teamframe_cancel_employment_change", {
      p_tenant_id: tenantId,
      p_actor_user_id: actor.authUserId,
      p_change_id: changeId,
    })
    .maybeSingle();

  if (error) {
    throw new Error(`EMPLOYMENT_CHANGE_CANCEL_FAILED: ${error.message}`);
  }
  if (!data) {
    throw new Error("EMPLOYMENT_CHANGE_NOT_FOUND");
  }

  return data as EmploymentChangeRecord;
}

export async function listEmploymentChangesForEmployee(
  actor: Actor,
  employeeId: string,
): Promise<EmploymentChangeRecord[]> {
  requireAdmin(actor);
  const tenantId = requireTenant(actor);

  const supabase: any = createServiceRoleClient();
  const { data, error } = await supabase
    .from("employment_changes")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("employee_id", employeeId)
    .order("effective_date", { ascending: false })
    .order("recorded_at", { ascending: false });

  if (error) {
    throw new Error(`EMPLOYMENT_CHANGE_LIST_FAILED: ${error.message}`);
  }

  return (data ?? []) as EmploymentChangeRecord[];
}
