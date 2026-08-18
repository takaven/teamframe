"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireTenantActor } from "@/middleware/rbac";
import { completeProbationReview } from "@/services/earlyEmploymentService";
import { logAction } from "@/lib/telemetry/logger";
import { captureActionError } from "@/lib/telemetry/sentry";

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

// Authorised Admin/People-Ops final probation outcome. Relocated off /onboarding (Phase 5C
// boundary): the manager RECOMMENDATION stays on /manager; this records the final decision.
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
    redirect(`/early-employment?error=${encodeURIComponent(errorCode)}`);
  }
  redirect("/early-employment?status=probation_completed");
}
