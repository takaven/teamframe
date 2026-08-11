import "server-only";

import { createServiceRoleClient } from "@/lib/db/supabaseServer";

export type AutomationNotificationLevel =
  | "background"
  | "routine_reminder"
  | "escalation"
  | "decision";

export type EnsureAutomationItemInput = {
  tenantId: string;
  ruleKey: string;
  idempotencyKey: string;
  subjectType: string;
  subjectId?: string | null;
  ownerEmployeeId?: string | null;
  dueAt: Date;
  notificationLevel?: AutomationNotificationLevel;
  recurrenceKey?: string | null;
  metadata?: Record<string, unknown>;
  maxAttempts?: number;
};

export type RunAutomationItemInput = {
  tenantId: string;
  itemId: string;
  now?: Date;
  complete?: boolean;
  fail?: boolean;
  errorMessage?: string | null;
  nextRecurrenceIdempotencyKey?: string | null;
  nextDueAt?: Date | null;
  eventContext?: Record<string, unknown>;
};

export type RunAutomationItemResult = {
  outcome:
    | "not_due"
    | "reminder_recorded"
    | "completed"
    | "failed_retry_scheduled"
    | "failed_escalated"
    | "skipped_completed";
  item_id: string;
  next_item_id?: string | null;
  attempt?: number;
};

export type AutomationDueItem = {
  id: string;
  tenant_id: string;
  rule_key: string;
  subject_id: string | null;
  due_at: string;
  status: "scheduled" | "due" | "failed" | "escalated" | "completed" | "suppressed";
  next_attempt_at: string | null;
};

export type RunDueAutomationForTenantResult = {
  tenantId: string;
  checked: number;
  processed: number;
  skipped: number;
  failed: number;
  outcomes: RunAutomationItemResult[];
};

export type RunDueAutomationResult = {
  tenants: number;
  checked: number;
  processed: number;
  skipped: number;
  failed: number;
  tenantResults: RunDueAutomationForTenantResult[];
};

function iso(date: Date): string {
  return date.toISOString();
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function ensureAutomationItem(input: EnsureAutomationItemInput): Promise<string> {
  const supabase: any = createServiceRoleClient();
  const { data, error } = await supabase.rpc("teamframe_ensure_hr_automation_item", {
    p_tenant_id: input.tenantId,
    p_rule_key: input.ruleKey,
    p_idempotency_key: input.idempotencyKey,
    p_subject_type: input.subjectType,
    p_subject_id: input.subjectId ?? null,
    p_owner_employee_id: input.ownerEmployeeId ?? null,
    p_due_at: iso(input.dueAt),
    p_notification_level: input.notificationLevel ?? "background",
    p_recurrence_key: input.recurrenceKey ?? null,
    p_metadata: input.metadata ?? {},
    p_max_attempts: input.maxAttempts ?? 3,
  });

  if (error || !data) {
    throw new Error(`AUTOMATION_ENSURE_FAILED: ${error?.message ?? "no item id"}`);
  }

  return String(data);
}

export async function runAutomationItem(input: RunAutomationItemInput): Promise<RunAutomationItemResult> {
  const supabase: any = createServiceRoleClient();
  const { data, error } = await supabase.rpc("teamframe_run_hr_automation_item", {
    p_tenant_id: input.tenantId,
    p_item_id: input.itemId,
    p_now: iso(input.now ?? new Date()),
    p_complete: input.complete ?? false,
    p_fail: input.fail ?? false,
    p_error_message: input.errorMessage ?? null,
    p_next_recurrence_idempotency_key: input.nextRecurrenceIdempotencyKey ?? null,
    p_next_due_at: input.nextDueAt ? iso(input.nextDueAt) : null,
    p_event_context: input.eventContext ?? {},
  });

  if (error || !data) {
    throw new Error(`AUTOMATION_RUN_FAILED: ${error?.message ?? "no result"}`);
  }

  return data as RunAutomationItemResult;
}

export async function listDueAutomationItemsForTenant(input: {
  tenantId: string;
  now?: Date;
  limit?: number;
}): Promise<AutomationDueItem[]> {
  const supabase: any = createServiceRoleClient();
  const now = iso(input.now ?? new Date());
  const limit = input.limit ?? 50;

  const { data, error } = await supabase
    .from("hr_automation_items")
    .select("id, tenant_id, rule_key, subject_id, due_at, status, next_attempt_at")
    .eq("tenant_id", input.tenantId)
    .in("status", ["scheduled", "due", "failed"])
    .or(`due_at.lte.${now},next_attempt_at.lte.${now}`)
    .order("due_at", { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(`AUTOMATION_DUE_LOOKUP_FAILED: ${error.message}`);
  }

  return (data ?? []) as AutomationDueItem[];
}

async function applyEmploymentChangeFromAutomation(input: {
  tenantId: string;
  changeId: string;
  now: Date;
}): Promise<void> {
  const supabase: any = createServiceRoleClient();
  const { error } = await supabase.rpc("teamframe_apply_employment_change", {
    p_tenant_id: input.tenantId,
    p_change_id: input.changeId,
    p_actor_user_id: "00000000-0000-0000-0000-000000000000",
    p_actor_type: "system",
    p_effective_as_of: isoDate(input.now),
  });

  if (error) {
    throw new Error(`EMPLOYMENT_CHANGE_APPLY_FAILED: ${error.message}`);
  }
}

async function markProbationReviewDueFromAutomation(input: {
  tenantId: string;
  reviewId: string;
}): Promise<void> {
  const supabase: any = createServiceRoleClient();
  const { error } = await supabase
    .from("probation_reviews")
    .update({ status: "due" } as never)
    .eq("tenant_id", input.tenantId)
    .eq("id", input.reviewId)
    .eq("status", "scheduled");

  if (error) {
    throw new Error(`PROBATION_REVIEW_DUE_UPDATE_FAILED: ${error.message}`);
  }
}

export async function runDueAutomationForTenant(input: {
  tenantId: string;
  now?: Date;
  limit?: number;
}): Promise<RunDueAutomationForTenantResult> {
  const now = input.now ?? new Date();
  const dueItems = await listDueAutomationItemsForTenant({
    tenantId: input.tenantId,
    now,
    limit: input.limit,
  });

  const outcomes: RunAutomationItemResult[] = [];
  let failed = 0;
  for (const item of dueItems) {
    try {
      if (item.rule_key === "employment_change.apply") {
        if (!item.subject_id) {
          throw new Error("EMPLOYMENT_CHANGE_SUBJECT_MISSING");
        }

        await applyEmploymentChangeFromAutomation({
          tenantId: input.tenantId,
          changeId: item.subject_id,
          now,
        });

        outcomes.push(
          await runAutomationItem({
            tenantId: input.tenantId,
            itemId: item.id,
            now,
            complete: true,
            eventContext: {
              runner: "api.automation.run",
              rule_key: item.rule_key,
              subject_id: item.subject_id,
            },
          }),
        );
        continue;
      }

      if (item.rule_key === "probation.review_due") {
        if (!item.subject_id) {
          throw new Error("PROBATION_REVIEW_SUBJECT_MISSING");
        }

        await markProbationReviewDueFromAutomation({
          tenantId: input.tenantId,
          reviewId: item.subject_id,
        });
      }

      outcomes.push(
        await runAutomationItem({
          tenantId: input.tenantId,
          itemId: item.id,
          now,
          eventContext: {
            runner: "api.automation.run",
            rule_key: item.rule_key,
          },
        }),
      );
    } catch (error) {
      try {
        outcomes.push(
          await runAutomationItem({
            tenantId: input.tenantId,
            itemId: item.id,
            now,
            fail: true,
            errorMessage: error instanceof Error ? error.message : "AUTOMATION_RUNNER_FAILED",
            eventContext: {
              runner: "api.automation.run",
              rule_key: item.rule_key,
              subject_id: item.subject_id,
            },
          }),
        );
      } catch {
        // Preserve the runner boundary: a failed failure-recording attempt should
        // not stop remaining tenant work from being processed.
      }
      failed += 1;
    }
  }

  const processed = outcomes.filter((outcome) =>
    ["reminder_recorded", "completed", "failed_retry_scheduled", "failed_escalated"].includes(outcome.outcome),
  ).length;
  const skipped = outcomes.length - processed;

  return {
    tenantId: input.tenantId,
    checked: dueItems.length,
    processed,
    skipped,
    failed,
    outcomes,
  };
}

export async function runDueAutomation(input: { now?: Date; limitPerTenant?: number } = {}): Promise<RunDueAutomationResult> {
  const supabase: any = createServiceRoleClient();
  const { data, error } = await supabase.from("companies").select("id").is("archived_at", null);

  if (error) {
    throw new Error(`AUTOMATION_TENANT_LOOKUP_FAILED: ${error.message}`);
  }

  const tenantRows = (data ?? []) as Array<{ id: string }>;
  const tenantResults: RunDueAutomationForTenantResult[] = [];
  for (const tenant of tenantRows) {
    tenantResults.push(
      await runDueAutomationForTenant({
        tenantId: tenant.id,
        now: input.now,
        limit: input.limitPerTenant,
      }),
    );
  }

  return tenantResults.reduce<RunDueAutomationResult>(
    (summary, tenantResult) => ({
      tenants: summary.tenants + 1,
      checked: summary.checked + tenantResult.checked,
      processed: summary.processed + tenantResult.processed,
      skipped: summary.skipped + tenantResult.skipped,
      failed: summary.failed + tenantResult.failed,
      tenantResults: [...summary.tenantResults, tenantResult],
    }),
    { tenants: 0, checked: 0, processed: 0, skipped: 0, failed: 0, tenantResults: [] },
  );
}
