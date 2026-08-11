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

function iso(date: Date): string {
  return date.toISOString();
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
