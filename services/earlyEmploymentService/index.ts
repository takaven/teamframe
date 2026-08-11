import "server-only";

import { z } from "zod";
import { createServiceRoleClient } from "@/lib/db/supabaseServer";
import type { Actor } from "@/middleware/rbac";

export const CHECK_IN_DEFAULTS = {
  milestoneDays: 30,
} as const;

export const PROBATION_DEFAULTS = {
  durationDays: 90,
  reviewLeadDays: 14,
} as const;

export type CheckInStatus = "scheduled" | "submitted" | "cancelled" | "suppressed";
export type ProbationReviewStatus = "scheduled" | "due" | "completed" | "cancelled" | "suppressed";
export type ProbationReviewOutcome = "confirmed" | "extended" | "employment_ending";

export type OnboardingCheckIn = {
  id: string;
  employee_id: string;
  due_date: string;
  status: CheckInStatus;
  questions: Array<{ key: string; label: string; type: "choice" | "boolean" | "text" }>;
  responses: Record<string, unknown> | null;
  flagged_follow_up: boolean;
  follow_up_action_item_id: string | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ProbationReview = {
  id: string;
  employee_id: string;
  probation_end_date: string;
  review_due_date: string;
  status: ProbationReviewStatus;
  review_owner_user_id: string;
  outcome: ProbationReviewOutcome | null;
  outcome_notes: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type EarlyEmploymentAdminState = {
  checkIns: OnboardingCheckIn[];
  probationReviews: ProbationReview[];
};

const CheckInResponseSchema = z
  .object({
    role_clarity: z.enum(["clear", "mostly_clear", "unclear", "needs_help"]),
    manager_team_clarity: z.enum(["clear", "mostly_clear", "unclear", "needs_help"]),
    tools_ready: z.boolean(),
    training_clear: z.enum(["clear", "mostly_clear", "unclear", "needs_help"]),
    policies_clear: z.enum(["clear", "mostly_clear", "unclear", "needs_help"]),
    support_available: z.boolean(),
    has_blockers: z.boolean(),
    improvement_note: z.string().trim().max(1000).optional(),
  })
  .strict();

const CompleteProbationSchema = z.object({
  reviewId: z.string().uuid(),
  outcome: z.enum(["confirmed", "extended", "employment_ending"]),
  outcomeNotes: z.string().trim().max(1200).optional(),
  extendedUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

function requireTenant(actor: Actor): string {
  if (!actor.tenantId) throw new Error("NO_TENANT_CONTEXT");
  return actor.tenantId;
}

function requireAdmin(actor: Actor): void {
  if (actor.role !== "admin") throw new Error("FORBIDDEN");
}

function requireEmployee(actor: Actor): string {
  if (!actor.employeeId) throw new Error("NO_EMPLOYEE_RECORD");
  return actor.employeeId;
}

function toCheckIn(row: Record<string, unknown>): OnboardingCheckIn {
  return {
    id: String(row.id),
    employee_id: String(row.employee_id),
    due_date: String(row.due_date),
    status: row.status as CheckInStatus,
    questions: row.questions as OnboardingCheckIn["questions"],
    responses: (row.responses ?? null) as Record<string, unknown> | null,
    flagged_follow_up: Boolean(row.flagged_follow_up),
    follow_up_action_item_id: (row.follow_up_action_item_id as string | null) ?? null,
    submitted_at: (row.submitted_at as string | null) ?? null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function toProbationReview(row: Record<string, unknown>): ProbationReview {
  return {
    id: String(row.id),
    employee_id: String(row.employee_id),
    probation_end_date: String(row.probation_end_date),
    review_due_date: String(row.review_due_date),
    status: row.status as ProbationReviewStatus,
    review_owner_user_id: String(row.review_owner_user_id),
    outcome: (row.outcome as ProbationReviewOutcome | null) ?? null,
    outcome_notes: (row.outcome_notes as string | null) ?? null,
    completed_at: (row.completed_at as string | null) ?? null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export async function listEarlyEmploymentForAdmin(actor: Actor): Promise<EarlyEmploymentAdminState> {
  requireAdmin(actor);
  const tenantId = requireTenant(actor);
  const supabase: any = createServiceRoleClient();

  const [checkInsResult, probationResult] = await Promise.all([
    supabase
      .from("onboarding_check_ins")
      .select("id, employee_id, due_date, status, questions, responses, flagged_follow_up, follow_up_action_item_id, submitted_at, created_at, updated_at")
      .eq("tenant_id", tenantId)
      .order("due_date", { ascending: true }),
    supabase
      .from("probation_reviews")
      .select("id, employee_id, probation_end_date, review_due_date, status, review_owner_user_id, outcome, outcome_notes, completed_at, created_at, updated_at")
      .eq("tenant_id", tenantId)
      .order("review_due_date", { ascending: true }),
  ]);

  if (checkInsResult.error) throw new Error(`CHECK_IN_LIST_FAILED: ${checkInsResult.error.message}`);
  if (probationResult.error) throw new Error(`PROBATION_REVIEW_LIST_FAILED: ${probationResult.error.message}`);

  return {
    checkIns: (checkInsResult.data ?? []).map(toCheckIn),
    probationReviews: (probationResult.data ?? []).map(toProbationReview),
  };
}

export async function listMyOnboardingCheckIns(actor: Actor): Promise<OnboardingCheckIn[]> {
  const tenantId = requireTenant(actor);
  const employeeId = requireEmployee(actor);
  const supabase: any = createServiceRoleClient();

  const { data, error } = await supabase
    .from("onboarding_check_ins")
    .select("id, employee_id, due_date, status, questions, responses, flagged_follow_up, follow_up_action_item_id, submitted_at, created_at, updated_at")
    .eq("tenant_id", tenantId)
    .eq("employee_id", employeeId)
    .order("due_date", { ascending: true });

  if (error) throw new Error(`CHECK_IN_LIST_FAILED: ${error.message}`);
  return (data ?? []).map(toCheckIn);
}

export async function submitMyOnboardingCheckIn(
  actor: Actor,
  checkInId: string,
  input: unknown,
): Promise<OnboardingCheckIn> {
  const tenantId = requireTenant(actor);
  const employeeId = requireEmployee(actor);
  const parsed = CheckInResponseSchema.parse(input);
  const supabase: any = createServiceRoleClient();

  const { data, error } = await supabase
    .rpc("teamframe_submit_onboarding_check_in", {
      p_tenant_id: tenantId,
      p_actor_user_id: actor.authUserId,
      p_employee_id: employeeId,
      p_check_in_id: checkInId,
      p_responses: parsed,
    })
    .maybeSingle();

  if (error) throw new Error(`CHECK_IN_SUBMIT_FAILED: ${error.message}`);
  if (!data) throw new Error("CHECK_IN_NOT_FOUND");
  return toCheckIn(data);
}

export async function completeProbationReview(
  actor: Actor,
  input: unknown,
): Promise<ProbationReview> {
  requireAdmin(actor);
  const tenantId = requireTenant(actor);
  const parsed = CompleteProbationSchema.parse(input);
  const supabase: any = createServiceRoleClient();

  const { data, error } = await supabase
    .rpc("teamframe_complete_probation_review", {
      p_tenant_id: tenantId,
      p_actor_user_id: actor.authUserId,
      p_review_id: parsed.reviewId,
      p_outcome: parsed.outcome,
      p_outcome_notes: parsed.outcomeNotes ?? null,
      p_extended_until: parsed.extendedUntil ?? null,
    })
    .maybeSingle();

  if (error) throw new Error(`PROBATION_REVIEW_COMPLETE_FAILED: ${error.message}`);
  if (!data) throw new Error("PROBATION_REVIEW_NOT_FOUND");
  return toProbationReview(data);
}
