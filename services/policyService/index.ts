/**
 * Policy service — server-side only.
 *
 * Scope lock (see docs/business/blueprint-locked.md §10.F and docs/drift-guard.md):
 *  - create, publish, archive, list (admin); acknowledge (employee)
 *  - plain-integer version field only — NO document versioning engine,
 *    NO e-signatures, NO reminders, NO approval chains, NO rich text.
 *
 * The unacknowledged_policy signal (services/signalEngine/unacknowledgedPolicy.ts)
 * fires from published, non-archived policies and resolves when every published
 * policy version is acknowledged. This service is the only write path for both
 * sides of that loop.
 */

import "server-only";
import { z } from "zod";
import type { Actor } from "@/middleware/rbac";
import { createServiceRoleClient } from "@/lib/db/supabaseServer";

export type PolicyRecord = {
  id: string;
  title: string;
  body: string;
  version: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export type PolicyAdminRecord = PolicyRecord & {
  acknowledged_count: number;
  active_employee_count: number;
};

type PolicyRow = PolicyRecord & {
  tenant_id: string;
};

type AcknowledgementRow = {
  id: string;
  policy_id: string;
  policy_version: number;
  employee_id: string;
  acknowledged_at: string;
};

const POLICY_COLUMNS =
  "id, tenant_id, title, body, version, is_published, created_at, updated_at, archived_at";

function requireTenant(actor: Actor): string {
  if (!actor.tenantId) throw new Error("NO_TENANT_CONTEXT");
  return actor.tenantId;
}

function requireAdmin(actor: Actor): void {
  if (actor.role !== "admin") throw new Error("FORBIDDEN");
}

function requireLinkedEmployee(actor: Actor): string {
  if (!actor.employeeId) throw new Error("NO_EMPLOYEE_RECORD");
  return actor.employeeId;
}

const CreatePolicySchema = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(20000),
  version: z.number().int().min(1).max(1000),
});

const AcknowledgePolicySchema = z.object({
  policyId: z.string().uuid(),
  policyVersion: z.number().int().min(1),
});

async function writeAudit(
  actor: Actor,
  actionType: string,
  targetId?: string,
  required = false,
): Promise<void> {
  const tenantId = requireTenant(actor);
  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("audit_logs").insert({
    tenant_id: tenantId,
    actor_user_id: actor.authUserId,
    action_type: actionType,
    target_id: targetId ?? null,
  } as never);
  if (error) {
    if (required) {
      throw new Error(`AUDIT_LOG_FAILED: ${error.message}`);
    }
    console.error("AUDIT_LOG_WRITE_FAILED", error.message);
  }
}

function stripTenant(row: PolicyRow): PolicyRecord {
  const { tenant_id: _tenantId, ...record } = row;
  return record;
}

export async function createPolicy(
  actor: Actor,
  input: { title: string; body: string; version: number },
): Promise<PolicyRecord> {
  requireAdmin(actor);
  const tenantId = requireTenant(actor);
  const parsed = CreatePolicySchema.safeParse(input);
  if (!parsed.success) {
    throw new Error("INVALID_INPUT");
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("policies")
    .insert({
      tenant_id: tenantId,
      title: parsed.data.title,
      body: parsed.data.body,
      version: parsed.data.version,
      is_published: false,
    } as never)
    .select(POLICY_COLUMNS)
    .single();

  if (error || !data) {
    throw new Error(`POLICY_CREATE_FAILED: ${error?.message ?? "no row"}`);
  }

  const created = data as PolicyRow;
  await writeAudit(actor, "policy.created", created.id, true);
  return stripTenant(created);
}

export async function publishPolicy(
  actor: Actor,
  policyId: string,
  expectedUpdatedAt: string,
): Promise<PolicyRecord> {
  requireAdmin(actor);
  const tenantId = requireTenant(actor);
  if (!expectedUpdatedAt) throw new Error("MISSING_EXPECTED_UPDATED_AT");

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("policies")
    .update({ is_published: true } as never)
    .eq("tenant_id", tenantId)
    .eq("id", policyId)
    .eq("is_published", false)
    .eq("updated_at", expectedUpdatedAt)
    .is("archived_at", null)
    .select(POLICY_COLUMNS)
    .maybeSingle();

  if (error) {
    throw new Error(`POLICY_PUBLISH_FAILED: ${error.message}`);
  }
  if (!data) {
    throw new Error("STALE_WRITE");
  }

  await writeAudit(actor, "policy.published", policyId, true);
  return stripTenant(data as PolicyRow);
}

export async function archivePolicy(
  actor: Actor,
  policyId: string,
  expectedUpdatedAt: string,
): Promise<PolicyRecord> {
  requireAdmin(actor);
  const tenantId = requireTenant(actor);
  if (!expectedUpdatedAt) throw new Error("MISSING_EXPECTED_UPDATED_AT");

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("policies")
    .update({ archived_at: new Date().toISOString() } as never)
    .eq("tenant_id", tenantId)
    .eq("id", policyId)
    .eq("updated_at", expectedUpdatedAt)
    .is("archived_at", null)
    .select(POLICY_COLUMNS)
    .maybeSingle();

  if (error) {
    throw new Error(`POLICY_ARCHIVE_FAILED: ${error.message}`);
  }
  if (!data) {
    throw new Error("STALE_WRITE");
  }

  await writeAudit(actor, "policy.archived", policyId, true);
  return stripTenant(data as PolicyRow);
}

export async function listPolicies(actor: Actor): Promise<PolicyAdminRecord[]> {
  requireAdmin(actor);
  const tenantId = requireTenant(actor);

  const supabase = createServiceRoleClient();
  const { data: policyData, error: policyError } = await supabase
    .from("policies")
    .select(POLICY_COLUMNS)
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (policyError) {
    throw new Error(`POLICY_LIST_FAILED: ${policyError.message}`);
  }

  const policies = (policyData ?? []) as PolicyRow[];

  const { data: acknowledgementData, error: acknowledgementError } = await supabase
    .from("acknowledgements")
    .select("id, policy_id, policy_version, employee_id, acknowledged_at")
    .eq("tenant_id", tenantId);

  if (acknowledgementError) {
    throw new Error(`POLICY_ACK_LIST_FAILED: ${acknowledgementError.message}`);
  }

  const acknowledgements = (acknowledgementData ?? []) as AcknowledgementRow[];

  // Mirror the signal engine's eligibility filter (unacknowledgedPolicy.ts):
  // non-deleted employees who are not exited.
  const { data: employeeData, error: employeeError } = await supabase
    .from("employees")
    .select("id, tenant_id, lifecycle_state, deleted_at")
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .in("lifecycle_state", ["preboarding", "active", "on_leave", "offboarding"]);

  if (employeeError) {
    throw new Error(`POLICY_EMPLOYEE_LIST_FAILED: ${employeeError.message}`);
  }

  const eligibleEmployeeIds = new Set(
    ((employeeData ?? []) as { id: string }[]).map((row) => row.id),
  );

  return policies.map((policy) => {
    const acknowledgedEmployeeIds = new Set(
      acknowledgements
        .filter(
          (ack) =>
            ack.policy_id === policy.id &&
            ack.policy_version === policy.version &&
            eligibleEmployeeIds.has(ack.employee_id),
        )
        .map((ack) => ack.employee_id),
    );
    return {
      ...stripTenant(policy),
      acknowledged_count: acknowledgedEmployeeIds.size,
      active_employee_count: eligibleEmployeeIds.size,
    };
  });
}

export async function listUnacknowledgedForEmployee(actor: Actor): Promise<PolicyRecord[]> {
  const tenantId = requireTenant(actor);
  const employeeId = requireLinkedEmployee(actor);

  const supabase = createServiceRoleClient();
  const { data: policyData, error: policyError } = await supabase
    .from("policies")
    .select(POLICY_COLUMNS)
    .eq("tenant_id", tenantId)
    .eq("is_published", true)
    .is("archived_at", null)
    .order("created_at", { ascending: true });

  if (policyError) {
    throw new Error(`POLICY_LIST_FAILED: ${policyError.message}`);
  }

  const policies = (policyData ?? []) as PolicyRow[];

  const { data: acknowledgementData, error: acknowledgementError } = await supabase
    .from("acknowledgements")
    .select("id, policy_id, policy_version, employee_id, acknowledged_at")
    .eq("tenant_id", tenantId)
    .eq("employee_id", employeeId);

  if (acknowledgementError) {
    throw new Error(`POLICY_ACK_LIST_FAILED: ${acknowledgementError.message}`);
  }

  const acknowledgedKeys = new Set(
    ((acknowledgementData ?? []) as AcknowledgementRow[]).map(
      (ack) => `${ack.policy_id}:${ack.policy_version}`,
    ),
  );

  return policies
    .filter((policy) => !acknowledgedKeys.has(`${policy.id}:${policy.version}`))
    .map(stripTenant);
}

export async function acknowledgePolicy(
  actor: Actor,
  input: { policyId: string; policyVersion: number },
): Promise<void> {
  const tenantId = requireTenant(actor);
  const employeeId = requireLinkedEmployee(actor);
  const parsed = AcknowledgePolicySchema.safeParse(input);
  if (!parsed.success) {
    throw new Error("INVALID_INPUT");
  }

  const supabase = createServiceRoleClient();
  const { data: policyRow, error: policyError } = await supabase
    .from("policies")
    .select("id, tenant_id, version, is_published, archived_at")
    .eq("tenant_id", tenantId)
    .eq("id", parsed.data.policyId)
    .maybeSingle();

  if (policyError) {
    throw new Error(`POLICY_ACKNOWLEDGE_FAILED: ${policyError.message}`);
  }
  if (!policyRow) {
    throw new Error("POLICY_NOT_FOUND");
  }

  const policy = policyRow as Pick<PolicyRow, "id" | "version" | "is_published" | "archived_at">;
  if (!policy.is_published || policy.archived_at !== null) {
    throw new Error("POLICY_NOT_PUBLISHED");
  }
  if (policy.version !== parsed.data.policyVersion) {
    throw new Error("STALE_WRITE");
  }

  const { data: existingAck, error: existingAckError } = await supabase
    .from("acknowledgements")
    .select("id, policy_id, policy_version, employee_id, acknowledged_at")
    .eq("tenant_id", tenantId)
    .eq("policy_id", policy.id)
    .eq("policy_version", policy.version)
    .eq("employee_id", employeeId)
    .maybeSingle();

  if (existingAckError) {
    throw new Error(`POLICY_ACKNOWLEDGE_FAILED: ${existingAckError.message}`);
  }
  if (existingAck) {
    // Idempotent: already acknowledged this version — nothing to change.
    return;
  }

  const { data: insertedAck, error: insertError } = await supabase
    .from("acknowledgements")
    .insert({
      tenant_id: tenantId,
      policy_id: policy.id,
      policy_version: policy.version,
      employee_id: employeeId,
    } as never)
    .select("id")
    .single();

  if (insertError || !insertedAck) {
    // Unique-violation means a concurrent acknowledge won the race — treat as done.
    if ((insertError as { code?: string } | null)?.code === "23505") {
      return;
    }
    throw new Error(`POLICY_ACKNOWLEDGE_FAILED: ${insertError?.message ?? "no row"}`);
  }

  await writeAudit(
    actor,
    "policy.acknowledged",
    (insertedAck as { id: string }).id,
    true,
  );
}
