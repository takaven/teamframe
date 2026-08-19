"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireTenantActor } from "@/middleware/rbac";
import {
  acknowledgePolicy,
  attachPolicyFile,
  archivePolicy,
  createPolicy,
  getPolicyFileSignedUrl,
  publishPolicy,
} from "@/services/policyService";
import { logAction } from "@/lib/telemetry/logger";
import { captureActionError } from "@/lib/telemetry/sentry";

const CreateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(20000),
  version: z.coerce.number().int().min(1).max(1000),
  effective_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

// Upload-first creation: file is required; body is optional (the document is the substance).
const UploadSchema = z.object({
  title: z.string().trim().min(1).max(200),
  version: z.coerce.number().int().min(1).max(1000),
  effective_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  body: z.string().trim().max(20000).optional(),
});

const DownloadSchema = z.object({
  policy_id: z.string().uuid(),
  return_to: z.string().trim().optional(),
});

const PublishSchema = z.object({
  policy_id: z.string().uuid(),
  expected_updated_at: z.string().trim().min(1),
});

const ArchiveSchema = PublishSchema;

const AttachFileSchema = z.object({
  policy_id: z.string().uuid(),
});

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
      effective_date: optionalString(formData.get("effective_date")),
    });
    await createPolicy(actor, { title: parsed.title, body: parsed.body, version: parsed.version, effectiveDate: parsed.effective_date });
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

// Primary upload-first flow: create the version, attach its file, and optionally publish — one
// action. File first (needs the new policy id for its storage path); publish last (uses the
// post-attach updated_at). A fileless draft is left only if attach fails after create.
export async function uploadPolicyAction(formData: FormData): Promise<void> {
  let failed = false;
  let errorCode = "UNKNOWN";
  const start = Date.now();
  const requestId = crypto.randomUUID();
  let actor: Awaited<ReturnType<typeof requireTenantActor>> | null = null;
  let caughtError: unknown = null;

  try {
    actor = await requireTenantActor();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) throw new Error("POLICY_FILE_REQUIRED");
    const parsed = UploadSchema.parse({
      title: formData.get("title"),
      version: formData.get("version"),
      effective_date: formData.get("effective_date"),
      body: optionalString(formData.get("body")),
    });
    const shouldPublish = formData.get("publish") === "on";

    const created = await createPolicy(actor, {
      title: parsed.title,
      body: parsed.body,
      version: parsed.version,
      effectiveDate: parsed.effective_date,
    });
    const attached = await attachPolicyFile(actor, { policyId: created.id, file });
    if (shouldPublish) {
      await publishPolicy(actor, created.id, attached.updated_at);
    }
  } catch (error) {
    failed = true;
    errorCode = getErrorCode(error);
    caughtError = error;
  }

  const durationMs = Date.now() - start;
  logAction({
    action: "uploadPolicy",
    actorUserId: actor?.authUserId ?? null,
    actorTenantId: actor?.tenantId ?? null,
    durationMs,
    outcome: caughtError ? "fail" : "ok",
    error: caughtError ?? undefined,
    requestId,
  });
  if (caughtError) {
    captureActionError("uploadPolicy", caughtError, {
      actor_user_id: actor?.authUserId ?? null,
      actor_tenant_id: actor?.tenantId ?? null,
    });
  }

  if (failed) {
    redirect(`/policies?error=${encodeURIComponent(errorCode)}`);
  }
  redirect("/policies?status=uploaded");
}

export async function downloadPolicyFileAction(formData: FormData): Promise<void> {
  let failed = false;
  let errorCode = "UNKNOWN";
  let returnTo = "/me";
  let signedUrl = "";

  try {
    const actor = await requireTenantActor();
    const parsed = DownloadSchema.parse({
      policy_id: formData.get("policy_id"),
      return_to: optionalString(formData.get("return_to")),
    });
    returnTo = safeReturnPath(parsed.return_to, "/me");
    signedUrl = await getPolicyFileSignedUrl(actor, parsed.policy_id);
  } catch (error) {
    failed = true;
    errorCode = getErrorCode(error);
  }

  if (failed) {
    redirect(`${returnTo}?error=${encodeURIComponent(errorCode)}`);
  }
  redirect(signedUrl);
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

export async function attachPolicyFileAction(formData: FormData): Promise<void> {
  let failed = false;
  let errorCode = "UNKNOWN";
  let policyId = "";

  try {
    const actor = await requireTenantActor();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) throw new Error("INVALID_INPUT");
    const parsed = AttachFileSchema.parse({
      policy_id: formData.get("policy_id"),
    });
    policyId = parsed.policy_id;
    await attachPolicyFile(actor, { policyId: parsed.policy_id, file });
  } catch (error) {
    failed = true;
    errorCode = getErrorCode(error);
  }

  if (failed) {
    redirect(`/policies?error=${encodeURIComponent(errorCode)}&policy=${encodeURIComponent(policyId)}`);
  }
  redirect("/policies?status=file_attached");
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
