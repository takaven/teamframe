"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireTenantActor } from "@/middleware/rbac";
import {
  acknowledgePolicy,
  archivePolicy,
  createPolicy,
  publishPolicy,
} from "@/services/policyService";
import { logAction } from "@/lib/telemetry/logger";
import { captureActionError } from "@/lib/telemetry/sentry";

const CreateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(20000),
  version: z.coerce.number().int().min(1).max(1000),
});

const PublishSchema = z.object({
  policy_id: z.string().uuid(),
  expected_updated_at: z.string().trim().min(1),
});

const ArchiveSchema = PublishSchema;

const AcknowledgeSchema = z.object({
  policy_id: z.string().uuid(),
  policy_version: z.coerce.number().int().min(1),
  return_to: z.string().trim().optional(),
});

function optionalString(value: FormDataEntryValue | null): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function safeReturnPath(path: string | undefined, fallback: string): string {
  if (!path || !path.startsWith("/") || path.startsWith("//")) {
    return fallback;
  }
  return path;
}

function getErrorCode(error: unknown): string {
  if (error instanceof z.ZodError) return "INVALID_INPUT";
  if (error instanceof Error) {
    const match = error.message.match(/^[A-Z_]+/);
    return match ? match[0] : "UNKNOWN";
  }
  return "UNKNOWN";
}

export async function createPolicyAction(formData: FormData): Promise<void> {
  let failed = false;
  let errorCode = "UNKNOWN";

  const start = Date.now();
  const requestId = crypto.randomUUID();
  let actor: Awaited<ReturnType<typeof requireTenantActor>> | null = null;
  let caughtError: unknown = null;

  try {
    actor = await requireTenantActor();
    const parsed = CreateSchema.parse({
      title: formData.get("title"),
      body: formData.get("body"),
      version: formData.get("version"),
    });
    await createPolicy(actor, parsed);
  } catch (error) {
    failed = true;
    errorCode = getErrorCode(error);
    caughtError = error;
  }

  const durationMs = Date.now() - start;
  if (caughtError !== null) {
    captureActionError("createPolicy", caughtError, {
      actor_user_id: actor?.authUserId ?? null,
      actor_tenant_id: actor?.tenantId ?? null,
    });
    logAction({
      action: "createPolicy",
      actorUserId: actor?.authUserId ?? null,
      actorTenantId: actor?.tenantId ?? null,
      durationMs,
      outcome: "fail",
      error: caughtError,
      requestId,
    });
  } else {
    logAction({
      action: "createPolicy",
      actorUserId: actor!.authUserId,
      actorTenantId: actor!.tenantId,
      durationMs,
      outcome: "ok",
      requestId,
    });
  }

  if (failed) {
    redirect(`/policies?error=${encodeURIComponent(errorCode)}`);
  }
  redirect("/policies?status=created");
}

export async function publishPolicyAction(formData: FormData): Promise<void> {
  let failed = false;
  let errorCode = "UNKNOWN";
  let policyId = "";

  const start = Date.now();
  const requestId = crypto.randomUUID();
  let actor: Awaited<ReturnType<typeof requireTenantActor>> | null = null;
  let caughtError: unknown = null;

  try {
    actor = await requireTenantActor();
    const parsed = PublishSchema.parse({
      policy_id: formData.get("policy_id"),
      expected_updated_at: formData.get("expected_updated_at"),
    });
    policyId = parsed.policy_id;
    await publishPolicy(actor, parsed.policy_id, parsed.expected_updated_at);
  } catch (error) {
    failed = true;
    errorCode = getErrorCode(error);
    caughtError = error;
  }

  const durationMs = Date.now() - start;
  if (caughtError !== null) {
    captureActionError("publishPolicy", caughtError, {
      actor_user_id: actor?.authUserId ?? null,
      actor_tenant_id: actor?.tenantId ?? null,
      policy_id: policyId || null,
    });
    logAction({
      action: "publishPolicy",
      actorUserId: actor?.authUserId ?? null,
      actorTenantId: actor?.tenantId ?? null,
      durationMs,
      outcome: "fail",
      error: caughtError,
      requestId,
    });
  } else {
    logAction({
      action: "publishPolicy",
      actorUserId: actor!.authUserId,
      actorTenantId: actor!.tenantId,
      durationMs,
      outcome: "ok",
      requestId,
    });
  }

  if (failed) {
    redirect(`/policies?error=${encodeURIComponent(errorCode)}`);
  }
  redirect("/policies?status=published");
}

export async function archivePolicyAction(formData: FormData): Promise<void> {
  let failed = false;
  let errorCode = "UNKNOWN";
  let policyId = "";

  const start = Date.now();
  const requestId = crypto.randomUUID();
  let actor: Awaited<ReturnType<typeof requireTenantActor>> | null = null;
  let caughtError: unknown = null;

  try {
    actor = await requireTenantActor();
    const parsed = ArchiveSchema.parse({
      policy_id: formData.get("policy_id"),
      expected_updated_at: formData.get("expected_updated_at"),
    });
    policyId = parsed.policy_id;
    await archivePolicy(actor, parsed.policy_id, parsed.expected_updated_at);
  } catch (error) {
    failed = true;
    errorCode = getErrorCode(error);
    caughtError = error;
  }

  const durationMs = Date.now() - start;
  if (caughtError !== null) {
    captureActionError("archivePolicy", caughtError, {
      actor_user_id: actor?.authUserId ?? null,
      actor_tenant_id: actor?.tenantId ?? null,
      policy_id: policyId || null,
    });
    logAction({
      action: "archivePolicy",
      actorUserId: actor?.authUserId ?? null,
      actorTenantId: actor?.tenantId ?? null,
      durationMs,
      outcome: "fail",
      error: caughtError,
      requestId,
    });
  } else {
    logAction({
      action: "archivePolicy",
      actorUserId: actor!.authUserId,
      actorTenantId: actor!.tenantId,
      durationMs,
      outcome: "ok",
      requestId,
    });
  }

  if (failed) {
    redirect(`/policies?error=${encodeURIComponent(errorCode)}`);
  }
  redirect("/policies?status=archived");
}

export async function acknowledgePolicyAction(formData: FormData): Promise<void> {
  let failed = false;
  let errorCode = "UNKNOWN";
  let policyId = "";
  let returnTo = "/me";

  const start = Date.now();
  const requestId = crypto.randomUUID();
  let actor: Awaited<ReturnType<typeof requireTenantActor>> | null = null;
  let caughtError: unknown = null;

  try {
    actor = await requireTenantActor();
    const parsed = AcknowledgeSchema.parse({
      policy_id: formData.get("policy_id"),
      policy_version: formData.get("policy_version"),
      return_to: optionalString(formData.get("return_to")),
    });
    policyId = parsed.policy_id;
    returnTo = safeReturnPath(parsed.return_to, "/me");
    await acknowledgePolicy(actor, {
      policyId: parsed.policy_id,
      policyVersion: parsed.policy_version,
    });
  } catch (error) {
    failed = true;
    errorCode = getErrorCode(error);
    caughtError = error;
  }

  const durationMs = Date.now() - start;
  if (caughtError !== null) {
    captureActionError("acknowledgePolicy", caughtError, {
      actor_user_id: actor?.authUserId ?? null,
      actor_tenant_id: actor?.tenantId ?? null,
      policy_id: policyId || null,
    });
    logAction({
      action: "acknowledgePolicy",
      actorUserId: actor?.authUserId ?? null,
      actorTenantId: actor?.tenantId ?? null,
      durationMs,
      outcome: "fail",
      error: caughtError,
      requestId,
    });
  } else {
    logAction({
      action: "acknowledgePolicy",
      actorUserId: actor!.authUserId,
      actorTenantId: actor!.tenantId,
      durationMs,
      outcome: "ok",
      requestId,
    });
  }

  if (failed) {
    redirect(`${returnTo}?error=${encodeURIComponent(errorCode)}`);
  }
  redirect(`${returnTo}?status=policy_acknowledged`);
}
