import "server-only";

import { z } from "zod";
import { createServiceRoleClient } from "@/lib/db/supabaseServer";
import type { Actor } from "@/middleware/rbac";
import { runAutomationItem } from "@/services/hrAutomation";
import { assertCurrentDirectManager, listCurrentDirectReports } from "@/services/managerAuthorization";

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
  manager_input: string | null;
  manager_recommended_outcome: "confirmed" | "unsuccessful" | null;
  manager_input_submitted_at: string | null;
  manager_input_submitted_by_user_id: string | null;
  manager_input_automation_item_id: string | null;
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

const ManagerProbationInputSchema = z.object({
  reviewId: z.string().uuid(),
  input: z.string().trim().min(1).max(1200),
  // Manager RECOMMENDATION only — Confirmed / Unsuccessful. The final probation outcome
  // remains an authorised Admin/People-Ops action; this never changes employment status.
  recommendedOutcome: z.enum(["confirmed", "unsuccessful"]).nullable().optional(),
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
    manager_input: (row.manager_input as string | null) ?? null,
    manager_recommended_outcome: (row.manager_recommended_outcome as "confirmed" | "unsuccessful" | null) ?? null,
    manager_input_submitted_at: (row.manager_input_submitted_at as string | null) ?? null,
    manager_input_submitted_by_user_id: (row.manager_input_submitted_by_user_id as string | null) ?? null,
    manager_input_automation_item_id: (row.manager_input_automation_item_id as string | null) ?? null,
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
  const supabase = createServiceRoleClient();

  const [checkInsResult, probationResult] = await Promise.all([
    supabase
      .from("onboarding_check_ins")
      .select("id, employee_id, due_date, status, questions, responses, flagged_follow_up, follow_up_action_item_id, submitted_at, created_at, updated_at")
      .eq("tenant_id", tenantId)
      .order("due_date", { ascending: true }),
    supabase
      .from("probation_reviews")
      .select("id, employee_id, probation_end_date, review_due_date, status, review_owner_user_id, manager_input, manager_recommended_outcome, manager_input_submitted_at, manager_input_submitted_by_user_id, manager_input_automation_item_id, outcome, outcome_notes, completed_at, created_at, updated_at")
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
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from("onboarding_check_ins")
    .select("id, employee_id, due_date, status, questions, responses, flagged_follow_up, follow_up_action_item_id, submitted_at, created_at, updated_at")
    .eq("tenant_id", tenantId)
    .eq("employee_id", employeeId)
    .order("due_date", { ascending: true });

  if (error) throw new Error(`CHECK_IN_LIST_FAILED: ${error.message}`);
  return (data ?? []).map(toCheckIn);
}

// Whether the tenant currently treats the 30-day check-in as an obligation.
async function isCheckInEnabledForTenant(tenantId: string): Promise<boolean> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("companies")
    .select("thirty_day_check_in_enabled")
    .eq("id", tenantId)
    .single();
  if (error) throw new Error(`COMPANY_SETTING_FETCH_FAILED: ${error.message}`);
  return (data as unknown as { thirty_day_check_in_enabled?: boolean } | null)?.thirty_day_check_in_enabled ?? true;
}

export type MyCheckInState =
  | { state: "none"; checkIn: null }
  | { state: "not_yet_due" | "available" | "submitted"; checkIn: OnboardingCheckIn };

/**
 * The employee's own 30-day check-in, reduced to a presentation state. Respects the company
 * setting: when disabled, nothing is presented as due ("none"). Availability is derived from the
 * due date (start + 30) — "not_yet_due" before it, "available" on/after it, "submitted" once done.
 */
export async function getMyCheckInState(actor: Actor): Promise<MyCheckInState> {
  const tenantId = requireTenant(actor);
  requireEmployee(actor);

  if (!(await isCheckInEnabledForTenant(tenantId))) {
    return { state: "none", checkIn: null };
  }

  const checkIns = await listMyOnboardingCheckIns(actor);
  const submitted = checkIns.find((c) => c.status === "submitted");
  const scheduled = checkIns.find((c) => c.status === "scheduled");
  if (scheduled) {
    const today = new Date().toISOString().slice(0, 10);
    return { state: scheduled.due_date > today ? "not_yet_due" : "available", checkIn: scheduled };
  }
  if (submitted) return { state: "submitted", checkIn: submitted };
  return { state: "none", checkIn: null };
}

export type DirectReportCheckIn = OnboardingCheckIn & { employee_full_name: string };

/**
 * Submitted 30-day check-ins for the acting manager's CURRENT direct reports (read-only). Scoped
 * strictly to direct reports — a manager never sees non-reports. No mutation is exposed.
 */
export async function listDirectReportCheckIns(actor: Actor): Promise<DirectReportCheckIn[]> {
  const tenantId = requireTenant(actor);
  const directReports = await listCurrentDirectReports(actor);
  if (directReports.length === 0) return [];
  const nameById = new Map(directReports.map((e) => [e.id, e.full_name]));

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("onboarding_check_ins")
    .select("id, employee_id, due_date, status, questions, responses, flagged_follow_up, follow_up_action_item_id, submitted_at, created_at, updated_at")
    .eq("tenant_id", tenantId)
    .in("employee_id", directReports.map((e) => e.id))
    .eq("status", "submitted")
    .order("submitted_at", { ascending: false });

  if (error) throw new Error(`DIRECT_REPORT_CHECK_IN_LIST_FAILED: ${error.message}`);
  return ((data ?? []) as unknown as Array<Record<string, unknown>>).map((row) => ({
    ...toCheckIn(row),
    employee_full_name: nameById.get(String(row.employee_id)) ?? "Team member",
  }));
}

export async function submitMyOnboardingCheckIn(
  actor: Actor,
  checkInId: string,
  input: unknown,
): Promise<OnboardingCheckIn> {
  const tenantId = requireTenant(actor);
  const employeeId = requireEmployee(actor);
  const parsed = CheckInResponseSchema.parse(input);
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .rpc("teamframe_submit_onboarding_check_in", {
      p_tenant_id: tenantId,
      p_actor_user_id: actor.authUserId,
      p_employee_id: employeeId,
      p_check_in_id: checkInId,
      p_responses: parsed,
    } as never)
    .maybeSingle();

  if (error) throw new Error(`CHECK_IN_SUBMIT_FAILED: ${error.message}`);
  if (!data) throw new Error("CHECK_IN_NOT_FOUND");
  return toCheckIn(data as Record<string, unknown>);
}

export async function completeProbationReview(
  actor: Actor,
  input: unknown,
): Promise<ProbationReview> {
  requireAdmin(actor);
  const tenantId = requireTenant(actor);
  const parsed = CompleteProbationSchema.parse(input);
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .rpc("teamframe_complete_probation_review", {
      p_tenant_id: tenantId,
      p_actor_user_id: actor.authUserId,
      p_review_id: parsed.reviewId,
      p_outcome: parsed.outcome,
      p_outcome_notes: parsed.outcomeNotes ?? null,
      p_extended_until: parsed.extendedUntil ?? null,
    } as never)
    .maybeSingle();

  if (error) throw new Error(`PROBATION_REVIEW_COMPLETE_FAILED: ${error.message}`);
  if (!data) throw new Error("PROBATION_REVIEW_NOT_FOUND");
  return toProbationReview(data);
}

export async function listManagerProbationReviews(actor: Actor): Promise<ProbationReview[]> {
  const tenantId = requireTenant(actor);
  const directReports = await listCurrentDirectReports(actor);
  const directReportIds = directReports.map((employee) => employee.id);
  if (directReportIds.length === 0) return [];

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("probation_reviews")
    .select("id, employee_id, probation_end_date, review_due_date, status, review_owner_user_id, manager_input, manager_recommended_outcome, manager_input_submitted_at, manager_input_submitted_by_user_id, manager_input_automation_item_id, outcome, outcome_notes, completed_at, created_at, updated_at")
    .eq("tenant_id", tenantId)
    .in("employee_id", directReportIds)
    .in("status", ["scheduled", "due"])
    .order("review_due_date", { ascending: true });

  if (error) throw new Error(`MANAGER_PROBATION_LIST_FAILED: ${error.message}`);
  return (data ?? []).map(toProbationReview);
}

export async function submitManagerProbationInput(actor: Actor, input: unknown): Promise<ProbationReview> {
  const tenantId = requireTenant(actor);
  const parsed = ManagerProbationInputSchema.parse(input);
  const supabase = createServiceRoleClient();

  const { data: reviewData, error: reviewError } = await supabase
    .from("probation_reviews")
    .select("id, employee_id, probation_end_date, review_due_date, status, review_owner_user_id, manager_input, manager_recommended_outcome, manager_input_submitted_at, manager_input_submitted_by_user_id, manager_input_automation_item_id, outcome, outcome_notes, completed_at, created_at, updated_at")
    .eq("tenant_id", tenantId)
    .eq("id", parsed.reviewId)
    .in("status", ["scheduled", "due"])
    .maybeSingle();

  if (reviewError) throw new Error(`MANAGER_PROBATION_LOOKUP_FAILED: ${reviewError.message}`);
  if (!reviewData) throw new Error("PROBATION_REVIEW_NOT_FOUND");

  const review = toProbationReview(reviewData);
  await assertCurrentDirectManager(actor, review.employee_id);

  const { data, error } = await supabase
    .from("probation_reviews")
    .update({
      manager_input: parsed.input,
      manager_recommended_outcome: parsed.recommendedOutcome ?? null,
      manager_input_submitted_at: new Date().toISOString(),
      manager_input_submitted_by_user_id: actor.authUserId,
    } as never)
    .eq("tenant_id", tenantId)
    .eq("id", parsed.reviewId)
    .in("status", ["scheduled", "due"])
    .select("id, employee_id, probation_end_date, review_due_date, status, review_owner_user_id, manager_input, manager_recommended_outcome, manager_input_submitted_at, manager_input_submitted_by_user_id, manager_input_automation_item_id, outcome, outcome_notes, completed_at, created_at, updated_at")
    .maybeSingle();

  if (error) throw new Error(`MANAGER_PROBATION_INPUT_FAILED: ${error.message}`);
  if (!data) throw new Error("PROBATION_REVIEW_NOT_FOUND");

  const updated = toProbationReview(data);
  if (updated.manager_input_automation_item_id) {
    await runAutomationItem({
      tenantId,
      itemId: updated.manager_input_automation_item_id,
      complete: true,
      eventContext: {
        source: "probation.manager_input_submitted",
        probation_review_id: parsed.reviewId,
      },
    });
  }

  const { error: auditError } = await supabase.from("audit_logs").insert({
    tenant_id: tenantId,
    actor_user_id: actor.authUserId,
    actor_type: "human",
    action_type: "probation.manager_input_submitted",
    target_id: parsed.reviewId,
  } as never);
  if (auditError) throw new Error(`AUDIT_LOG_FAILED: ${auditError.message}`);

  return updated;
}
