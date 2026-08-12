"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireTenantActor } from "@/middleware/rbac";
import { cancelApprovedLeave, decideLeaveRequest, submitLeaveRequest, withdrawPendingLeave } from "@/services/leaveService";
import { logAction } from "@/lib/telemetry/logger";
import { captureActionError } from "@/lib/telemetry/sentry";

const SubmitSchema = z
  .object({
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    leave_type: z.enum(["annual", "sick", "unpaid", "other"]),
    reason: z.string().trim().max(500).optional(),
  })
  .refine((d) => d.end_date >= d.start_date, { message: "INVALID_INPUT" });

const DecideSchema = z.object({
  leave_id: z.string().uuid(),
  expected_updated_at: z.string().trim().min(1),
  decision: z.enum(["approved", "rejected"]),
  override_insufficient_balance: z.string().optional(),
  override_reason: z.string().trim().max(500).optional(),
  decision_note: z.string().trim().max(500).optional(),
  return_to: z.string().trim().optional(),
});

const CancelSchema = z.object({
  leave_id: z.string().uuid(),
  expected_updated_at: z.string().trim().min(1),
  reason: z.string().trim().max(500).optional(),
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

export async function submitLeaveAction(formData: FormData): Promise<void> {
  let failed = false;
  let errorCode = "UNKNOWN";

  // Observability instrumentation (Phase 1C).
  const start = Date.now();
  const requestId = crypto.randomUUID();
  let actor: Awaited<ReturnType<typeof requireTenantActor>> | null = null;
  let caughtError: unknown = null;

  try {
    actor = await requireTenantActor();
    const parsed = SubmitSchema.parse({
      start_date: formData.get("start_date"),
      end_date: formData.get("end_date"),
      leave_type: formData.get("leave_type"),
      reason: optionalString(formData.get("reason")),
    });
    await submitLeaveRequest(actor, {
      startDate: parsed.start_date,
      endDate: parsed.end_date,
      leaveType: parsed.leave_type,
      reason: parsed.reason,
    });
  } catch (error) {
    failed = true;
    errorCode = getErrorCode(error);
    caughtError = error;
  }

  const durationMs = Date.now() - start;
  if (caughtError !== null) {
    captureActionError("submitLeave", caughtError, {
      actor_user_id: actor?.authUserId ?? null,
      actor_tenant_id: actor?.tenantId ?? null,
    });
    logAction({
      action: "submitLeave",
      actorUserId: actor?.authUserId ?? null,
      actorTenantId: actor?.tenantId ?? null,
      durationMs,
      outcome: "fail",
      error: caughtError,
      requestId,
    });
  } else {
    logAction({
      action: "submitLeave",
      actorUserId: actor!.authUserId,
      actorTenantId: actor!.tenantId,
      durationMs,
      outcome: "ok",
      requestId,
    });
  }

  if (failed) {
    redirect(`/leaves?error=${encodeURIComponent(errorCode)}`);
  }
  redirect("/me?status=leave_submitted");
}

export async function decideLeaveAction(formData: FormData): Promise<void> {
  let failed = false;
  let errorCode = "UNKNOWN";
  let leaveId = "";
  let decision: "approved" | "rejected" = "approved";
  let returnTo = "/leaves";

  // Observability instrumentation (Phase 1B).
  const start = Date.now();
  const requestId = crypto.randomUUID();
  let actor: Awaited<ReturnType<typeof requireTenantActor>> | null = null;
  let caughtError: unknown = null;

  try {
    actor = await requireTenantActor();
    const parsed = DecideSchema.parse({
      leave_id: formData.get("leave_id"),
      expected_updated_at: formData.get("expected_updated_at"),
      decision: formData.get("decision"),
      return_to: optionalString(formData.get("return_to")),
    });
    leaveId = parsed.leave_id;
    decision = parsed.decision;
    returnTo = safeReturnPath(parsed.return_to, "/leaves");
    await decideLeaveRequest(
      actor,
      parsed.leave_id,
      parsed.decision,
      parsed.expected_updated_at,
      {
        overrideInsufficientBalance: parsed.override_insufficient_balance === "on",
        overrideReason: parsed.override_reason,
        decisionNote: parsed.decision_note,
      },
    );
  } catch (error) {
    failed = true;
    errorCode = getErrorCode(error);
    caughtError = error;
  }

  const durationMs = Date.now() - start;
  if (caughtError !== null) {
    captureActionError("decideLeave", caughtError, {
      actor_user_id: actor?.authUserId ?? null,
      actor_tenant_id: actor?.tenantId ?? null,
      leave_id: leaveId || null,
    });
    logAction({
      action: "decideLeave",
      actorUserId: actor?.authUserId ?? null,
      actorTenantId: actor?.tenantId ?? null,
      durationMs,
      outcome: "fail",
      error: caughtError,
      requestId,
    });
  } else {
    logAction({
      action: "decideLeave",
      actorUserId: actor!.authUserId,
      actorTenantId: actor!.tenantId,
      durationMs,
      outcome: "ok",
      requestId,
    });
  }

  if (failed) {
    redirect(`${returnTo}?error=${encodeURIComponent(errorCode)}&leave=${encodeURIComponent(leaveId)}`);
  }
  redirect(`${returnTo}?status=decided_${decision}`);
}

export async function withdrawLeaveAction(formData: FormData): Promise<void> {
  let errorCode = "UNKNOWN";
  let returnTo = "/leaves";

  try {
    const actor = await requireTenantActor();
    const parsed = CancelSchema.parse({
      leave_id: formData.get("leave_id"),
      expected_updated_at: formData.get("expected_updated_at"),
      reason: optionalString(formData.get("reason")),
      return_to: optionalString(formData.get("return_to")),
    });
    returnTo = safeReturnPath(parsed.return_to, "/leaves");
    await withdrawPendingLeave(actor, parsed.leave_id, parsed.expected_updated_at, parsed.reason);
  } catch (error) {
    errorCode = getErrorCode(error);
    redirect(`${returnTo}?error=${encodeURIComponent(errorCode)}`);
  }

  redirect(`${returnTo}?status=leave_withdrawn`);
}

export async function cancelLeaveAction(formData: FormData): Promise<void> {
  let errorCode = "UNKNOWN";
  let returnTo = "/leaves";

  try {
    const actor = await requireTenantActor();
    const parsed = CancelSchema.parse({
      leave_id: formData.get("leave_id"),
      expected_updated_at: formData.get("expected_updated_at"),
      reason: optionalString(formData.get("reason")),
      return_to: optionalString(formData.get("return_to")),
    });
    returnTo = safeReturnPath(parsed.return_to, "/leaves");
    await cancelApprovedLeave(actor, parsed.leave_id, parsed.expected_updated_at, parsed.reason);
  } catch (error) {
    errorCode = getErrorCode(error);
    redirect(`${returnTo}?error=${encodeURIComponent(errorCode)}`);
  }

  redirect(`${returnTo}?status=leave_cancelled`);
}
