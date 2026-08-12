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
import { randomUUID } from "node:crypto";
import { Buffer } from "node:buffer";
import type { Actor } from "@/middleware/rbac";
import { createServiceRoleClient } from "@/lib/db/supabaseServer";
import { CURRENT_EMPLOYEE_DB_LIFECYCLE_STATES, isPolicyEligibleEmployee } from "@/services/employeeLifecycle";
import {
  assertPrivateDocumentStorageReady,
  sanitizePrivateFileName,
  uploadPrivateDocumentObject,
  validateDocumentFileBeforeBuffer,
  validateDocumentFileSignature,
} from "@/services/documentService";

export type PolicyRecord = {
  id: string;
  title: string;
  body: string;
  version: number;
  is_published: boolean;
  file_storage_path: string | null;
  file_original_name: string | null;
  file_mime_type: string | null;
  file_uploaded_at: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export type PolicyAdminRecord = PolicyRecord & {
  acknowledged_count: number;
  active_employee_count: number;
  acknowledgement_evidence: PolicyAcknowledgementEvidence[];
};

export type PolicyAcknowledgementEvidence = {
  employee_id: string;
  full_name: string;
  email: string;
  status: "acknowledged" | "outstanding";
  acknowledged_at: string | null;
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
  "id, tenant_id, title, body, version, is_published, file_storage_path, file_original_name, file_mime_type, file_uploaded_at, created_at, updated_at, archived_at";

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
    .rpc("teamframe_create_policy", {
      p_tenant_id: tenantId,
      p_actor_user_id: actor.authUserId,
      p_title: parsed.data.title,
      p_body: parsed.data.body,
      p_version: parsed.data.version,
    } as never)
    .single();

  if (error || !data) {
    throw new Error(`POLICY_CREATE_FAILED: ${error?.message ?? "no row"}`);
  }

  return stripTenant(data as PolicyRow);
}

export async function attachPolicyFile(
  actor: Actor,
  input: { policyId: string; file: File },
): Promise<PolicyRecord> {
  requireAdmin(actor);
  const tenantId = requireTenant(actor);
  const fileType = validateDocumentFileBeforeBuffer(input.file);
  if (!["pdf", "doc", "docx"].includes(fileType.extension)) {
    throw new Error("POLICY_FILE_UNSUPPORTED_TYPE");
  }

  const supabase: any = createServiceRoleClient();
  const { data: policyData, error: policyError } = await supabase
    .from("policies")
    .select(POLICY_COLUMNS)
    .eq("tenant_id", tenantId)
    .eq("id", input.policyId)
    .is("archived_at", null)
    .maybeSingle();

  if (policyError) throw new Error(`POLICY_FILE_LOOKUP_FAILED: ${policyError.message}`);
  if (!policyData) throw new Error("POLICY_NOT_FOUND");

  await assertPrivateDocumentStorageReady();
  const bytes = Buffer.from(await input.file.arrayBuffer());
  validateDocumentFileSignature(bytes, fileType);
  const safeName = sanitizePrivateFileName(input.file.name);
  const storagePath = `${tenantId}/policies/${input.policyId}/${randomUUID()}/${safeName}`;

  await uploadPrivateDocumentObject({
    actor,
    storagePath,
    bytes,
    contentType: fileType.mimeTypes[0] ?? "application/octet-stream",
    auditActionType: "policy.file_uploaded",
    auditTargetId: input.policyId,
  });

  const { data, error } = await supabase
    .from("policies")
    .update({
      file_storage_path: storagePath,
      file_original_name: safeName,
      file_mime_type: fileType.mimeTypes[0],
      file_uploaded_at: new Date().toISOString(),
      file_uploaded_by: actor.authUserId,
    })
    .eq("tenant_id", tenantId)
    .eq("id", input.policyId)
    .select(POLICY_COLUMNS)
    .single();

  if (error) throw new Error(`POLICY_FILE_ATTACH_FAILED: ${error.message}`);
  return stripTenant(data as PolicyRow);
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
    .rpc("teamframe_publish_policy", {
      p_tenant_id: tenantId,
      p_actor_user_id: actor.authUserId,
      p_policy_id: policyId,
      p_expected_updated_at: expectedUpdatedAt,
    } as never)
    .maybeSingle();

  if (error) {
    throw new Error(`POLICY_PUBLISH_FAILED: ${error.message}`);
  }
  if (!data) {
    throw new Error("STALE_WRITE");
  }

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
    .rpc("teamframe_archive_policy", {
      p_tenant_id: tenantId,
      p_actor_user_id: actor.authUserId,
      p_policy_id: policyId,
      p_expected_updated_at: expectedUpdatedAt,
    } as never)
    .maybeSingle();

  if (error) {
    throw new Error(`POLICY_ARCHIVE_FAILED: ${error.message}`);
  }
  if (!data) {
    throw new Error("STALE_WRITE");
  }

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

  // Non-deleted employees who remain in the current employee lifecycle.
  const { data: employeeData, error: employeeError } = await supabase
    .from("employees")
    .select("id, tenant_id, full_name, email, lifecycle_state, deleted_at")
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .in("lifecycle_state", CURRENT_EMPLOYEE_DB_LIFECYCLE_STATES as unknown as string[]);

  if (employeeError) {
    throw new Error(`POLICY_EMPLOYEE_LIST_FAILED: ${employeeError.message}`);
  }

  const eligibleEmployees = (employeeData ?? []) as Array<{
    id: string;
    full_name: string;
    email: string;
  }>;
  const eligibleEmployeeIds = new Set(eligibleEmployees.map((row) => row.id));

  return policies.map((policy) => {
    const acknowledgementsForVersion = acknowledgements.filter(
      (ack) =>
        ack.policy_id === policy.id &&
        ack.policy_version === policy.version &&
        eligibleEmployeeIds.has(ack.employee_id),
    );
    const acknowledgementByEmployeeId = new Map(
      acknowledgementsForVersion.map((ack) => [ack.employee_id, ack]),
    );
    const acknowledgementEvidence = eligibleEmployees
      .map((employee) => {
        const acknowledgement = acknowledgementByEmployeeId.get(employee.id);
        return {
          employee_id: employee.id,
          full_name: employee.full_name,
          email: employee.email,
          status: acknowledgement ? "acknowledged" : "outstanding",
          acknowledged_at: acknowledgement?.acknowledged_at ?? null,
        } satisfies PolicyAcknowledgementEvidence;
      })
      .sort((a, b) => {
        if (a.status !== b.status) return a.status === "outstanding" ? -1 : 1;
        return a.full_name.localeCompare(b.full_name);
      });

    return {
      ...stripTenant(policy),
      acknowledged_count: acknowledgementByEmployeeId.size,
      active_employee_count: eligibleEmployeeIds.size,
      acknowledgement_evidence: acknowledgementEvidence,
    };
  });
}

export async function listUnacknowledgedForEmployee(actor: Actor): Promise<PolicyRecord[]> {
  const tenantId = requireTenant(actor);
  const employeeId = requireLinkedEmployee(actor);

  const supabase = createServiceRoleClient();
  const { data: employeeData, error: employeeError } = await supabase
    .from("employees")
    .select("status, setup_status, lifecycle_state, start_date, end_date, deleted_at")
    .eq("tenant_id", tenantId)
    .eq("id", employeeId)
    .maybeSingle();

  if (employeeError) {
    throw new Error(`POLICY_EMPLOYEE_LOOKUP_FAILED: ${employeeError.message}`);
  }
  if (!employeeData || !isPolicyEligibleEmployee(employeeData)) {
    return [];
  }

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

  const { error: acknowledgeError } = await supabase.rpc("teamframe_acknowledge_policy", {
    p_tenant_id: tenantId,
    p_actor_user_id: actor.authUserId,
    p_employee_id: employeeId,
    p_policy_id: policy.id,
    p_policy_version: policy.version,
  } as never);

  if (acknowledgeError) {
    throw new Error(`POLICY_ACKNOWLEDGE_FAILED: ${acknowledgeError.message}`);
  }
}
