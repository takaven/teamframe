"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireTenantActor } from "@/middleware/rbac";
import {
  assignOnboardingPack,
  assignOnboardingTask,
  completeOnboardingTask,
} from "@/services/onboardingService";
import {
  completeProbationReview,
  submitMyOnboardingCheckIn,
} from "@/services/earlyEmploymentService";
import { logAction } from "@/lib/telemetry/logger";
import { captureActionError } from "@/lib/telemetry/sentry";

const AssignSchema = z.object({
  employee_id: z.string().uuid(),
  title: z.string().trim().min(1),
});

const AssignPackSchema = z.object({
  employee_id: z.string().uuid(),
  pack_id: z.enum(["every_hire", "engineering", "operations"]),
  task_indexes: z.array(z.coerce.number().int().min(0)).min(1),
});

const CompleteSchema = z.object({
  task_id: z.string().uuid(),
  expected_updated_at: z.string().trim().min(1),
});

const CheckInSubmitSchema = z.object({
  check_in_id: z.string().uuid(),
  role_clarity: z.enum(["clear", "mostly_clear", "unclear", "needs_help"]),
  manager_team_clarity: z.enum(["clear", "mostly_clear", "unclear", "needs_help"]),
  tools_ready: z.enum(["yes", "no"]),
  training_clear: z.enum(["clear", "mostly_clear", "unclear", "needs_help"]),
  policies_clear: z.enum(["clear", "mostly_clear", "unclear", "needs_help"]),
  support_available: z.enum(["yes", "no"]),
  has_blockers: z.enum(["yes", "no"]),
  improvement_note: z.string().trim().optional(),
});

const CompleteProbationSchema = z.object({
  review_id: z.string().uuid(),
  outcome: z.enum(["confirmed", "extended", "employment_ending"]),
  outcome_notes: z.string().trim().optional(),
  extended_until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

function getErrorCode(error: unknown): string {
  if (error instanceof z.ZodError) return "INVALID_INPUT";
  if (error instanceof Error) {
    const match = error.message.match(/^[A-Z_]+/);
    return match ? match[0] : "UNKNOWN";
  }
  return "UNKNOWN";
}

export async function assignOnboardingTaskAction(formData: FormData): Promise<void> {
  let failed = false;
  let errorCode = "UNKNOWN";

  // Observability instrumentation (Phase 1B).
  const start = Date.now();
  const requestId = crypto.randomUUID();
  let actor: Awaited<ReturnType<typeof requireTenantActor>> | null = null;
  let caughtError: unknown = null;

  try {
    actor = await requireTenantActor();
    const parsed = AssignSchema.parse({
      employee_id: formData.get("employee_id"),
      title: formData.get("title"),
    });
    await assignOnboardingTask(actor, {
      employeeId: parsed.employee_id,
      title: parsed.title,
    });
  } catch (error) {
    failed = true;
    errorCode = getErrorCode(error);
    caughtError = error;
  }

  const durationMs = Date.now() - start;
  if (caughtError !== null) {
    captureActionError("assignOnboardingTask", caughtError, {
      actor_user_id: actor?.authUserId ?? null,
      actor_tenant_id: actor?.tenantId ?? null,
    });
    logAction({
      action: "assignOnboardingTask",
      actorUserId: actor?.authUserId ?? null,
      actorTenantId: actor?.tenantId ?? null,
      durationMs,
      outcome: "fail",
      error: caughtError,
      requestId,
    });
  } else {
    logAction({
      action: "assignOnboardingTask",
      actorUserId: actor!.authUserId,
      actorTenantId: actor!.tenantId,
      durationMs,
      outcome: "ok",
      requestId,
    });
  }

  if (failed) {
    redirect(`/onboarding?error=${encodeURIComponent(errorCode)}`);
  }
  redirect("/onboarding?status=assigned");
}

export async function assignOnboardingPackAction(formData: FormData): Promise<void> {
  let failed = false;
  let errorCode = "UNKNOWN";

  // Observability instrumentation (matches assignOnboardingTaskAction).
  const start = Date.now();
  const requestId = crypto.randomUUID();
  let actor: Awaited<ReturnType<typeof requireTenantActor>> | null = null;
  let caughtError: unknown = null;

  try {
    actor = await requireTenantActor();
    const parsed = AssignPackSchema.parse({
      employee_id: formData.get("employee_id"),
      pack_id: formData.get("pack_id"),
      task_indexes: formData.getAll("task_index"),
    });
    await assignOnboardingPack(actor, {
      employeeId: parsed.employee_id,
      packId: parsed.pack_id,
      keptIndexes: parsed.task_indexes,
    });
  } catch (error) {
    failed = true;
    errorCode = getErrorCode(error);
    caughtError = error;
  }

  const durationMs = Date.now() - start;
  if (caughtError !== null) {
    captureActionError("assignOnboardingPack", caughtError, {
      actor_user_id: actor?.authUserId ?? null,
      actor_tenant_id: actor?.tenantId ?? null,
    });
    logAction({
      action: "assignOnboardingPack",
      actorUserId: actor?.authUserId ?? null,
      actorTenantId: actor?.tenantId ?? null,
      durationMs,
      outcome: "fail",
      error: caughtError,
      requestId,
    });
  } else {
    logAction({
      action: "assignOnboardingPack",
      actorUserId: actor!.authUserId,
      actorTenantId: actor!.tenantId,
      durationMs,
      outcome: "ok",
      requestId,
    });
  }

  if (failed) {
    redirect(`/onboarding?error=${encodeURIComponent(errorCode)}`);
  }
  redirect("/onboarding?status=pack_assigned");
}

export async function completeOnboardingTaskAction(formData: FormData): Promise<void> {
  let failed = false;
  let errorCode = "UNKNOWN";

  // Observability instrumentation (Phase 1C).
  const start = Date.now();
  const requestId = crypto.randomUUID();
  let actor: Awaited<ReturnType<typeof requireTenantActor>> | null = null;
  let caughtError: unknown = null;

  try {
    actor = await requireTenantActor();
    const parsed = CompleteSchema.parse({
      task_id: formData.get("task_id"),
      expected_updated_at: formData.get("expected_updated_at"),
    });
    await completeOnboardingTask(actor, parsed.task_id, parsed.expected_updated_at);
  } catch (error) {
    failed = true;
    errorCode = getErrorCode(error);
    caughtError = error;
  }

  const durationMs = Date.now() - start;
  if (caughtError !== null) {
    captureActionError("completeOnboardingTask", caughtError, {
      actor_user_id: actor?.authUserId ?? null,
      actor_tenant_id: actor?.tenantId ?? null,
    });
    logAction({
      action: "completeOnboardingTask",
      actorUserId: actor?.authUserId ?? null,
      actorTenantId: actor?.tenantId ?? null,
      durationMs,
      outcome: "fail",
      error: caughtError,
      requestId,
    });
  } else {
    logAction({
      action: "completeOnboardingTask",
      actorUserId: actor!.authUserId,
      actorTenantId: actor!.tenantId,
      durationMs,
      outcome: "ok",
      requestId,
    });
  }

  if (failed) {
    redirect(`/onboarding?error=${encodeURIComponent(errorCode)}`);
  }
  redirect("/me?status=task_completed");
}

export async function submitOnboardingCheckInAction(formData: FormData): Promise<void> {
  let failed = false;
  let errorCode = "UNKNOWN";
  const start = Date.now();
  const requestId = crypto.randomUUID();
  let actor: Awaited<ReturnType<typeof requireTenantActor>> | null = null;
  let caughtError: unknown = null;

  try {
    actor = await requireTenantActor();
    const parsed = CheckInSubmitSchema.parse({
      check_in_id: formData.get("check_in_id"),
      role_clarity: formData.get("role_clarity"),
      manager_team_clarity: formData.get("manager_team_clarity"),
      tools_ready: formData.get("tools_ready"),
      training_clear: formData.get("training_clear"),
      policies_clear: formData.get("policies_clear"),
      support_available: formData.get("support_available"),
      has_blockers: formData.get("has_blockers"),
      improvement_note: formData.get("improvement_note") ?? "",
    });

    await submitMyOnboardingCheckIn(actor, parsed.check_in_id, {
      role_clarity: parsed.role_clarity,
      manager_team_clarity: parsed.manager_team_clarity,
      tools_ready: parsed.tools_ready === "yes",
      training_clear: parsed.training_clear,
      policies_clear: parsed.policies_clear,
      support_available: parsed.support_available === "yes",
      has_blockers: parsed.has_blockers === "yes",
      improvement_note: parsed.improvement_note ?? "",
    });
  } catch (error) {
    failed = true;
    errorCode = getErrorCode(error);
    caughtError = error;
  }

  const durationMs = Date.now() - start;
  if (caughtError !== null) {
    captureActionError("submitOnboardingCheckIn", caughtError, {
      actor_user_id: actor?.authUserId ?? null,
      actor_tenant_id: actor?.tenantId ?? null,
    });
    logAction({
      action: "submitOnboardingCheckIn",
      actorUserId: actor?.authUserId ?? null,
      actorTenantId: actor?.tenantId ?? null,
      durationMs,
      outcome: "fail",
      error: caughtError,
      requestId,
    });
  }

  if (failed) {
    redirect(`/onboarding?error=${encodeURIComponent(errorCode)}`);
  }
  redirect("/me?status=check_in_submitted");
}

export async function completeProbationReviewAction(formData: FormData): Promise<void> {
  let failed = false;
  let errorCode = "UNKNOWN";
  const start = Date.now();
  const requestId = crypto.randomUUID();
  let actor: Awaited<ReturnType<typeof requireTenantActor>> | null = null;
  let caughtError: unknown = null;

  try {
    actor = await requireTenantActor();
    const parsed = CompleteProbationSchema.parse({
      review_id: formData.get("review_id"),
      outcome: formData.get("outcome"),
      outcome_notes: formData.get("outcome_notes") ?? "",
      extended_until: formData.get("extended_until") || undefined,
    });
    await completeProbationReview(actor, {
      reviewId: parsed.review_id,
      outcome: parsed.outcome,
      outcomeNotes: parsed.outcome_notes,
      extendedUntil: parsed.extended_until,
    });
  } catch (error) {
    failed = true;
    errorCode = getErrorCode(error);
    caughtError = error;
  }

  const durationMs = Date.now() - start;
  if (caughtError !== null) {
    captureActionError("completeProbationReview", caughtError, {
      actor_user_id: actor?.authUserId ?? null,
      actor_tenant_id: actor?.tenantId ?? null,
    });
    logAction({
      action: "completeProbationReview",
      actorUserId: actor?.authUserId ?? null,
      actorTenantId: actor?.tenantId ?? null,
      durationMs,
      outcome: "fail",
      error: caughtError,
      requestId,
    });
  }

  if (failed) {
    redirect(`/onboarding?error=${encodeURIComponent(errorCode)}`);
  }
  redirect("/onboarding?status=probation_completed");
}
