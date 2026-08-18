"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireTenantActor } from "@/middleware/rbac";
import { decideLeaveRequestAsManager } from "@/services/leaveService";
import { completeManagerOnboardingTask } from "@/services/onboardingService";
import { submitManagerProbationInput } from "@/services/earlyEmploymentService";
import { completeOffboardingItem } from "@/services/offboardingService";

const DecideLeaveSchema = z.object({
  leave_id: z.string().uuid(),
  expected_updated_at: z.string().trim().min(1),
  decision: z.enum(["approved", "rejected"]),
  decision_note: z.string().trim().max(500).optional(),
});

const CompleteTaskSchema = z.object({
  task_id: z.string().uuid(),
  expected_updated_at: z.string().trim().min(1),
});

const ProbationInputSchema = z.object({
  review_id: z.string().uuid(),
  input: z.string().trim().min(1).max(1200),
  recommended_outcome: z.enum(["confirmed", "unsuccessful"]).optional(),
});

function optionalString(value: FormDataEntryValue | null): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function getErrorCode(error: unknown): string {
  if (error instanceof z.ZodError) return "INVALID_INPUT";
  if (error instanceof Error) {
    const match = error.message.match(/^[A-Z_]+/);
    return match ? match[0] : "UNKNOWN";
  }
  return "UNKNOWN";
}

export async function decideManagerLeaveAction(formData: FormData): Promise<void> {
  try {
    const actor = await requireTenantActor();
    const parsed = DecideLeaveSchema.parse({
      leave_id: formData.get("leave_id"),
      expected_updated_at: formData.get("expected_updated_at"),
      decision: formData.get("decision"),
      decision_note: optionalString(formData.get("decision_note")),
    });
    await decideLeaveRequestAsManager(actor, parsed.leave_id, parsed.decision, parsed.expected_updated_at, {
      decisionNote: parsed.decision_note,
    });
  } catch (error) {
    redirect(`/manager?error=${encodeURIComponent(getErrorCode(error))}`);
  }

  redirect("/manager?status=leave_decided");
}

export async function completeManagerOnboardingTaskAction(formData: FormData): Promise<void> {
  try {
    const actor = await requireTenantActor();
    const parsed = CompleteTaskSchema.parse({
      task_id: formData.get("task_id"),
      expected_updated_at: formData.get("expected_updated_at"),
    });
    await completeManagerOnboardingTask(actor, parsed.task_id, parsed.expected_updated_at);
  } catch (error) {
    redirect(`/manager?error=${encodeURIComponent(getErrorCode(error))}`);
  }

  redirect("/manager?status=task_completed");
}

export async function completeManagerOffboardingItemAction(formData: FormData): Promise<void> {
  try {
    const actor = await requireTenantActor();
    const parsed = CompleteTaskSchema.parse({
      task_id: formData.get("task_id"),
      expected_updated_at: formData.get("expected_updated_at"),
    });
    await completeOffboardingItem(actor, parsed.task_id, parsed.expected_updated_at);
  } catch (error) {
    redirect(`/manager?error=${encodeURIComponent(getErrorCode(error))}`);
  }

  redirect("/manager?status=task_completed");
}

export async function submitManagerProbationInputAction(formData: FormData): Promise<void> {
  try {
    const actor = await requireTenantActor();
    const parsed = ProbationInputSchema.parse({
      review_id: formData.get("review_id"),
      input: formData.get("input"),
      recommended_outcome: formData.get("recommended_outcome") || undefined,
    });
    await submitManagerProbationInput(actor, {
      reviewId: parsed.review_id,
      input: parsed.input,
      recommendedOutcome: parsed.recommended_outcome ?? null,
    });
  } catch (error) {
    redirect(`/manager?error=${encodeURIComponent(getErrorCode(error))}`);
  }

  redirect("/manager?status=probation_input_submitted");
}
