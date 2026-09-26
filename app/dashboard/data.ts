import "server-only";

import { createServiceRoleClient } from "@/lib/db/supabaseServer";
import { projectEmployeeLifecycle } from "@/services/employeeLifecycle";
import { documentLabel } from "@/lib/ui/documentLabels";

export type DashboardSavedDataStatus =
  | { state: "success" }
  | { state: "timeout" }
  | { state: "failed"; message: string };

export type ControlCentreClass = "decision" | "overdue" | "due" | "exception";

export type ControlCentreItem = {
  id: string;
  class: ControlCentreClass;
  source: string;
  title: string;
  subjectName: string;
  owner: string;
  nextAction: string;
  dueAt: string | null;
  updatedAt: string;
  href: string;
  detail: string;
  priority: number;
};

export type ResolvedControlCentreItem = {
  id: string;
  source: string;
  title: string;
  subjectName: string;
  resolvedAt: string;
  href: string;
  detail: string;
};

export type ControlCentreSummary = {
  total: number;
  due: number;
  overdue: number;
  decisions: number;
  exceptions: number;
  resolved: number;
};

export type ControlCentreData = {
  savedDataStatus: DashboardSavedDataStatus;
  summary: ControlCentreSummary;
  previewItems: ControlCentreItem[];
  allItems: ControlCentreItem[];
  resolvedItems: ResolvedControlCentreItem[];
  activeEmployeeCount: number;
  teamSummary: {
    startingThisMonth: number;
    leavingThisMonth: number;
    awayToday: number;
  };
};

type EmployeeRow = {
  id: string;
  full_name: string;
  status: "active" | "on_leave" | "inactive";
  setup_status: "incomplete" | "ready" | "active";
  lifecycle_state: "preboarding" | "active" | "on_leave" | "offboarding" | "exited";
  start_date: string | null;
  end_date: string | null;
  deleted_at: string | null;
};

type AutomationRow = {
  id: string;
  rule_key: string;
  subject_type: string;
  subject_id: string | null;
  owner_employee_id: string | null;
  due_at: string;
  status: "scheduled" | "due" | "failed" | "escalated" | "completed" | "suppressed";
  notification_level: "background" | "routine_reminder" | "escalation" | "decision";
  last_attempt_at: string | null;
  next_attempt_at: string | null;
  error_message: string | null;
  metadata: Record<string, unknown> | null;
  updated_at: string;
};

type RiskSignalRow = {
  id: string;
  kind: string;
  severity: "red" | "yellow";
  subject_employee_id: string | null;
  evidence: Record<string, unknown> | null;
  last_seen_at: string;
  resolved_at: string | null;
};

type LeaveRow = {
  id: string;
  employee_id: string;
  start_date: string;
  end_date: string;
  leave_type: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  updated_at: string;
};

type DocumentRequirementRow = {
  id: string;
  employee_id: string;
  document_type: string;
  due_date: string | null;
  review_required: boolean;
  state: "requested" | "received" | "accepted" | "rejected" | "expired" | "replaced" | "cancelled";
  updated_at: string;
};

type PolicyRow = {
  id: string;
  title: string;
  version: number;
  is_published: boolean;
  archived_at: string | null;
  updated_at: string;
};

type AcknowledgementRow = {
  policy_id: string;
  policy_version: number;
  employee_id: string;
};

type OnboardingTaskRow = {
  id: string;
  employee_id: string;
  title: string;
  status: "pending" | "completed";
  owner_role: "employee" | "manager" | "admin" | "system";
  owner_employee_id: string | null;
  due_date: string | null;
  updated_at: string;
};

type ProbationReviewRow = {
  id: string;
  employee_id: string;
  review_due_date: string;
  status: "scheduled" | "due" | "completed" | "cancelled" | "suppressed";
  updated_at: string;
};

type OffboardingCaseRow = {
  id: string;
  employee_id: string;
  effective_end_date: string;
  status: "active" | "cancelled" | "completed";
  updated_at: string;
};

type OffboardingItemRow = {
  id: string;
  employee_id: string;
  offboarding_case_id: string;
  title: string;
  owner_role: "admin" | "manager" | "employee" | "system";
  owner_employee_id: string | null;
  due_date: string | null;
  status: "pending" | "completed" | "cancelled";
  updated_at: string;
};

const CONTROL_CENTRE_SAVED_DATA_TIMEOUT_MS = 6500;
const PREVIEW_LIMIT = 6;

function savedDataTimeoutAfter(ms: number): Promise<ControlCentreData> {
  return new Promise((resolve) => {
    setTimeout(
      () =>
        resolve({
          savedDataStatus: { state: "timeout" },
          summary: emptySummary(),
          previewItems: [],
          allItems: [],
          resolvedItems: [],
          activeEmployeeCount: 0,
          teamSummary: { startingThisMonth: 0, leavingThisMonth: 0, awayToday: 0 },
        }),
      ms,
    );
  });
}

function emptySummary(): ControlCentreSummary {
  return {
    total: 0,
    due: 0,
    overdue: 0,
    decisions: 0,
    exceptions: 0,
    resolved: 0,
  };
}

function dateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function dueDateAtStart(value: string | null): string | null {
  if (!value) return null;
  return `${value}T00:00:00.000Z`;
}

function isPastDate(value: string | null, today: string): boolean {
  return Boolean(value && value < today);
}

function employeeMap(rows: EmployeeRow[]): Map<string, EmployeeRow> {
  return new Map(rows.map((row) => [row.id, row]));
}

function employeeName(names: Map<string, EmployeeRow>, employeeId: string | null): string {
  if (!employeeId) return "Team";
  return names.get(employeeId)?.full_name ?? "Team member";
}

function currentEmployeeIds(rows: EmployeeRow[], now: Date): Set<string> {
  return new Set(
    rows
      .filter((row) => projectEmployeeLifecycle(row, now) !== "FORMER")
      .map((row) => row.id),
  );
}

function activeEmployeeIds(rows: EmployeeRow[], now: Date): Set<string> {
  return new Set(
    rows
      .filter((row) => projectEmployeeLifecycle(row, now) === "ACTIVE")
      .map((row) => row.id),
  );
}

function itemClassFromDue(input: {
  dueAt: string | null;
  today: string;
  decision?: boolean;
  exception?: boolean;
}): ControlCentreClass {
  if (input.exception) return "exception";
  if (isPastDate(input.dueAt?.slice(0, 10) ?? null, input.today)) return "overdue";
  if (input.decision) return "decision";
  return "due";
}

function taskOwner(role: string, ownerId: string | null, names: Map<string, EmployeeRow>, subjectEmployeeId?: string): string {
  if (ownerId) return names.get(ownerId)?.full_name ?? "Owner not assigned";
  if (role === "admin") return "Admin";
  if (role === "manager") return "Manager";
  if (role === "employee" && subjectEmployeeId) return employeeName(names, subjectEmployeeId);
  return "Owner not assigned";
}

function sourcePath(source: string): string {
  if (source.startsWith("document")) return "/people";
  if (source.startsWith("policy")) return "/policies";
  if (source.startsWith("onboarding")) return "/onboarding";
  if (source.startsWith("probation")) return "/onboarding";
  if (source.startsWith("leave")) return "/leaves";
  if (source.startsWith("offboarding")) return "/people";
  if (source.startsWith("automation")) return "/dashboard";
  return "/people";
}

function employeePath(employeeId: string, tab = "overview"): string {
  const sections: Record<string, string> = {
    employment: "employment",
    personal: "personal",
    compensation: "compensation-payment",
    payment: "compensation-payment",
    emergency: "personal",
    documents: "documents",
    account: "onboarding-offboarding",
  };
  const section = sections[tab] ?? tab;
  return `/people/${encodeURIComponent(employeeId)}#${encodeURIComponent(section)}`;
}

function signalTitle(kind: string): string {
  if (kind === "expired_document") return "Expired document";
  if (kind === "expiring_document") return "Document expiring soon";
  if (kind === "missing_contract") return "Missing signed contract";
  if (kind === "active_access_after_exit") return "Active access after exit";
  if (kind === "unreturned_asset") return "Unreturned asset";
  if (kind === "incomplete_offboarding") return "Offboarding needs attention";
  if (kind === "leave_conflict") return "Leave conflict";
  if (kind === "onboarding_check_in_follow_up") return "30-day check-in follow-up";
  if (kind === "missing_jurisdiction_requirement") return "Missing jurisdiction document";
  return "Something needs attention";
}

function signalDetail(signal: RiskSignalRow): string {
  const what = signal.evidence?.what_is_wrong;
  return typeof what === "string" && what.trim().length > 0
    ? what
    : "This needs review before the record is complete.";
}

function automationTitle(row: AutomationRow): string {
  if (row.rule_key === "employment_change.apply") return "Employment change failed";
  if (row.rule_key === "document.expiry_due") return "Document expiry automation failed";
  if (row.rule_key === "offboarding.closure_due") return "Offboarding closure automation failed";
  if (row.rule_key === "probation.review_due") return "Probation automation failed";
  return "Automation needs attention";
}

function automationDetail(row: AutomationRow): string {
  if (row.status === "escalated") {
    return "Background processing has exhausted retries and needs admin attention.";
  }
  if (row.status === "failed") {
    return "Background processing failed and is queued for retry.";
  }
  return "Background processing is due.";
}

function compareItems(a: ControlCentreItem, b: ControlCentreItem): number {
  const urgency = (item: ControlCentreItem) => item.class === "overdue" ? 0 : item.class === "decision" ? 1 : item.class === "due" ? 2 : 3;
  if (urgency(a) !== urgency(b)) return urgency(a) - urgency(b);
  const aDue = a.dueAt ?? a.updatedAt;
  const bDue = b.dueAt ?? b.updatedAt;
  if (aDue !== bDue) return aDue.localeCompare(bDue);
  if (a.class !== b.class) return a.class === "decision" ? -1 : 1;
  if (a.priority !== b.priority) return a.priority - b.priority;
  if (a.updatedAt !== b.updatedAt) return b.updatedAt.localeCompare(a.updatedAt);
  return a.id.localeCompare(b.id);
}

function summarize(items: ControlCentreItem[], resolvedCount: number): ControlCentreSummary {
  return {
    total: items.length,
    due: items.filter((item) => item.class === "due").length,
    overdue: items.filter((item) => item.class === "overdue").length,
    decisions: items.filter((item) => item.class === "decision").length,
    exceptions: items.filter((item) => item.class === "exception").length,
    resolved: resolvedCount,
  };
}

function buildPolicyItems(input: {
  policies: PolicyRow[];
  acknowledgements: AcknowledgementRow[];
  employees: EmployeeRow[];
  now: Date;
}): ControlCentreItem[] {
  const currentIds = currentEmployeeIds(input.employees, input.now);
  const names = employeeMap(input.employees);
  const acknowledged = new Set(
    input.acknowledgements.map((row) => `${row.employee_id}:${row.policy_id}:${row.policy_version}`),
  );
  const items: ControlCentreItem[] = [];
  for (const policy of input.policies) {
    if (!policy.is_published || policy.archived_at) continue;
    for (const employeeId of currentIds) {
      if (acknowledged.has(`${employeeId}:${policy.id}:${policy.version}`)) continue;
      items.push({
        id: `policy:${policy.id}:${policy.version}:${employeeId}`,
        class: "due",
        source: "policy_acknowledgement",
        title: `Acknowledge ${policy.title} v${policy.version}`,
        subjectName: employeeName(names, employeeId),
        owner: employeeName(names, employeeId),
        nextAction: "View policy",
        dueAt: null,
        updatedAt: policy.updated_at,
        href: `/policies#policy-${policy.id}`,
        detail: "Published policy version requires acknowledgement.",
        priority: 40,
      });
    }
  }
  return items;
}

function buildControlCentreItems(input: {
  employees: EmployeeRow[];
  automation: AutomationRow[];
  signals: RiskSignalRow[];
  leaves: LeaveRow[];
  documentRequirements: DocumentRequirementRow[];
  policies: PolicyRow[];
  acknowledgements: AcknowledgementRow[];
  onboardingTasks: OnboardingTaskRow[];
  probationReviews: ProbationReviewRow[];
  offboardingCases: OffboardingCaseRow[];
  offboardingItems: OffboardingItemRow[];
  now: Date;
}): {
  allItems: ControlCentreItem[];
  resolvedItems: ResolvedControlCentreItem[];
  activeEmployeeCount: number;
  teamSummary: ControlCentreData["teamSummary"];
} {
  const today = dateOnly(input.now);
  const names = employeeMap(input.employees);
  const currentIds = currentEmployeeIds(input.employees, input.now);
  const activeIds = activeEmployeeIds(input.employees, input.now);
  const items: ControlCentreItem[] = [];

  for (const leave of input.leaves) {
    if (leave.status !== "pending") continue;
    if (!currentIds.has(leave.employee_id)) continue;
    const dueAt = dueDateAtStart(leave.start_date);
    const itemClass = itemClassFromDue({ dueAt, today, decision: true });
    items.push({
      id: `leave:${leave.id}`,
      class: itemClass,
      source: "leave_decision",
      title: "Leave request needs decision",
      subjectName: employeeName(names, leave.employee_id),
      owner: "Manager or Admin",
      nextAction: "Review request",
      dueAt,
      updatedAt: leave.updated_at,
      href: `/leaves?leave=${encodeURIComponent(leave.id)}`,
      detail: `${leave.leave_type} leave from ${leave.start_date} to ${leave.end_date}.`,
      priority: itemClass === "overdue" ? 10 : 20,
    });
  }

  for (const request of input.documentRequirements) {
    if (!currentIds.has(request.employee_id)) continue;
    if (["accepted", "replaced", "cancelled"].includes(request.state)) continue;
    const isReviewDecision = request.state === "received" && request.review_required;
    const isExpired = request.state === "expired";
    const dueAt = dueDateAtStart(request.due_date);
    const itemClass = itemClassFromDue({
      dueAt,
      today,
      decision: isReviewDecision,
      exception: isExpired,
    });
    items.push({
      id: `document:${request.id}`,
      class: itemClass,
      source: isReviewDecision ? "document_review" : "document_request",
      title: isReviewDecision
        ? `${documentLabel(request.document_type)} needs review`
        : `${documentLabel(request.document_type)} requested`,
      subjectName: employeeName(names, request.employee_id),
      owner: isReviewDecision ? "Admin" : employeeName(names, request.employee_id),
      nextAction: isReviewDecision ? "Review document" : "Upload document",
      dueAt,
      updatedAt: request.updated_at,
      href: employeePath(request.employee_id, "documents"),
      detail: isExpired ? "This document is overdue." : "Waiting for this document.",
      priority: itemClass === "exception" || itemClass === "overdue" ? 10 : isReviewDecision ? 20 : 40,
    });
  }

  items.push(
    ...buildPolicyItems({
      policies: input.policies,
      acknowledgements: input.acknowledgements,
      employees: input.employees,
      now: input.now,
    }),
  );

  for (const task of input.onboardingTasks) {
    if (task.status !== "pending") continue;
    if (!currentIds.has(task.employee_id)) continue;
    const dueAt = dueDateAtStart(task.due_date);
    const itemClass = itemClassFromDue({
      dueAt,
      today,
      decision: task.owner_role === "admin",
    });
    items.push({
      id: `onboarding:${task.id}`,
      class: itemClass,
      source: "onboarding_task",
      title: task.title,
      subjectName: employeeName(names, task.employee_id),
      owner: taskOwner(task.owner_role, task.owner_employee_id, names, task.employee_id),
      nextAction: "Open task",
      dueAt,
      updatedAt: task.updated_at,
      href: employeePath(task.employee_id, "account"),
      detail: task.owner_role === "admin" ? "This onboarding task needs an admin decision." : "This onboarding task is due.",
      priority: itemClass === "overdue" ? 10 : task.owner_role === "admin" ? 20 : 40,
    });
  }

  for (const review of input.probationReviews) {
    if (!["scheduled", "due"].includes(review.status)) continue;
    if (!currentIds.has(review.employee_id)) continue;
    const dueAt = dueDateAtStart(review.review_due_date);
    const itemClass = itemClassFromDue({ dueAt, today, decision: true });
    items.push({
      id: `probation:${review.id}`,
      class: itemClass,
      source: "probation_review",
      title: "Probation outcome needs decision",
      subjectName: employeeName(names, review.employee_id),
      owner: "Admin",
      nextAction: "Review probation",
      dueAt,
      updatedAt: review.updated_at,
      href: employeePath(review.employee_id, "account"),
      detail: "Human probation outcome is required.",
      priority: itemClass === "overdue" ? 10 : 20,
    });
  }

  for (const item of input.offboardingItems) {
    if (item.status !== "pending") continue;
    if (!currentIds.has(item.employee_id)) continue;
    const dueAt = dueDateAtStart(item.due_date);
    const itemClass = itemClassFromDue({
      dueAt,
      today,
      decision: item.owner_role === "admin",
    });
    items.push({
      id: `offboarding_item:${item.id}`,
      class: itemClass,
      source: "offboarding_task",
      title: item.title,
      subjectName: employeeName(names, item.employee_id),
      owner: taskOwner(item.owner_role, item.owner_employee_id, names, item.employee_id),
      nextAction: "Open task",
      dueAt,
      updatedAt: item.updated_at,
      href: employeePath(item.employee_id, "account"),
      detail: "Exit workflow item is still open.",
      priority: itemClass === "overdue" ? 10 : item.owner_role === "admin" ? 20 : 40,
    });
  }

  for (const offboardingCase of input.offboardingCases) {
    if (offboardingCase.status !== "active") continue;
    if (!currentIds.has(offboardingCase.employee_id)) continue;
    if (offboardingCase.effective_end_date >= today) continue;
    const hasPendingRequiredItem = input.offboardingItems.some(
      (item) =>
        item.offboarding_case_id === offboardingCase.id &&
        item.status === "pending",
    );
    if (!hasPendingRequiredItem) continue;
    items.push({
      id: `offboarding_exception:${offboardingCase.id}`,
      class: "exception",
      source: "offboarding_exception",
      title: "Offboarding overdue after end date",
      subjectName: employeeName(names, offboardingCase.employee_id),
      owner: "Owner not assigned",
      nextAction: "Open task",
      dueAt: dueDateAtStart(offboardingCase.effective_end_date),
      updatedAt: offboardingCase.updated_at,
      href: employeePath(offboardingCase.employee_id, "account"),
      detail: "End date has passed while required exit work remains incomplete.",
      priority: 5,
    });
  }

  for (const item of input.automation) {
    if (!["failed", "escalated"].includes(item.status)) continue;
    const subjectEmployeeId =
      typeof item.metadata?.employee_id === "string" ? item.metadata.employee_id : item.owner_employee_id;
    if (subjectEmployeeId && !currentIds.has(subjectEmployeeId)) continue;
    items.push({
      id: `automation:${item.id}`,
      class: item.status === "escalated" ? "exception" : "overdue",
      source: "automation_failure",
      title: automationTitle(item),
      subjectName: employeeName(names, subjectEmployeeId ?? null),
      owner: taskOwner("system", item.owner_employee_id, names),
      nextAction: "Check issue",
      dueAt: item.next_attempt_at ?? item.due_at,
      updatedAt: item.updated_at,
      href: "/dashboard",
      detail: automationDetail(item),
      priority: item.status === "escalated" ? 5 : 30,
    });
  }

  for (const signal of input.signals) {
    if (signal.resolved_at) continue;
    if (signal.subject_employee_id && !currentIds.has(signal.subject_employee_id)) continue;
    items.push({
      id: `signal:${signal.id}`,
      class: "exception",
      source: `signal:${signal.kind}`,
      title: signalTitle(signal.kind),
      subjectName: employeeName(names, signal.subject_employee_id),
      owner: "Owner not assigned",
      nextAction: signal.kind.includes("document") || signal.kind === "missing_contract" ? "Open documents" : "Open employee",
      dueAt: null,
      updatedAt: signal.last_seen_at,
      href: signal.subject_employee_id
        ? employeePath(signal.subject_employee_id, signal.kind.includes("document") || signal.kind === "missing_contract" ? "documents" : "employment")
        : sourcePath(signal.kind),
      detail: signalDetail(signal),
      priority: signal.severity === "red" ? 5 : 15,
    });
  }

  const resolvedItems = input.signals
    .filter((signal) => signal.resolved_at)
    .filter((signal) => !signal.subject_employee_id || names.has(signal.subject_employee_id))
    .sort((a, b) => (b.resolved_at ?? "").localeCompare(a.resolved_at ?? "") || a.id.localeCompare(b.id))
    .slice(0, 6)
    .map((signal) => ({
      id: `resolved:${signal.id}`,
      source: `signal:${signal.kind}`,
      title: signalTitle(signal.kind),
      subjectName: employeeName(names, signal.subject_employee_id),
      resolvedAt: signal.resolved_at!,
      href: signal.subject_employee_id ? employeePath(signal.subject_employee_id) : sourcePath(signal.kind),
      detail: "Completion is retained in the activity history.",
    }));

  const sortedItems = items.sort(compareItems);
  return {
    allItems: sortedItems,
    resolvedItems,
    activeEmployeeCount: activeIds.size,
    teamSummary: {
      startingThisMonth: input.employees.filter((employee) => employee.start_date?.startsWith(today.slice(0, 7)) && projectEmployeeLifecycle(employee, input.now) === "PRE_START").length,
      leavingThisMonth: input.offboardingCases.filter((item) => item.status === "active" && item.effective_end_date.startsWith(today.slice(0, 7))).length,
      awayToday: input.leaves.filter((leave) => leave.status === "approved" && leave.start_date <= today && leave.end_date >= today).length,
    },
  };
}

export async function loadControlCentreData(params: {
  tenantId: string;
  now?: Date;
  savedDataTimeoutMs?: number;
}): Promise<ControlCentreData> {
  const supabase = createServiceRoleClient();
  const now = params.now ?? new Date();

  const loadSavedRows = async (): Promise<ControlCentreData> => {
    const [
      employeeResult,
      automationResult,
      signalResult,
      leaveResult,
      documentRequirementResult,
      policyResult,
      acknowledgementResult,
      onboardingTaskResult,
      probationReviewResult,
      offboardingCaseResult,
      offboardingItemResult,
    ] = await Promise.all([
      supabase
        .from("employees")
        .select("id, full_name, status, setup_status, lifecycle_state, start_date, end_date, deleted_at")
        .eq("tenant_id", params.tenantId),
      supabase
        .from("hr_automation_items")
        .select("id, rule_key, subject_type, subject_id, owner_employee_id, due_at, status, notification_level, last_attempt_at, next_attempt_at, error_message, metadata, updated_at")
        .eq("tenant_id", params.tenantId)
        .in("status", ["scheduled", "due", "failed", "escalated"]),
      supabase
        .from("risk_signals")
        .select("id, kind, severity, subject_employee_id, evidence, last_seen_at, resolved_at")
        .eq("tenant_id", params.tenantId)
        .order("resolved_at", { ascending: true, nullsFirst: true })
        .order("last_seen_at", { ascending: false })
        .limit(120),
      supabase
        .from("leaves")
        .select("id, employee_id, start_date, end_date, leave_type, status, updated_at")
        .eq("tenant_id", params.tenantId)
        .in("status", ["pending", "approved"]),
      supabase
        .from("document_requirements")
        .select("id, employee_id, document_type, due_date, review_required, state, updated_at")
        .eq("tenant_id", params.tenantId),
      supabase
        .from("policies")
        .select("id, title, version, is_published, archived_at, updated_at")
        .eq("tenant_id", params.tenantId),
      supabase
        .from("acknowledgements")
        .select("policy_id, policy_version, employee_id")
        .eq("tenant_id", params.tenantId),
      supabase
        .from("onboarding_tasks")
        .select("id, employee_id, title, status, owner_role, owner_employee_id, due_date, updated_at")
        .eq("tenant_id", params.tenantId),
      supabase
        .from("probation_reviews")
        .select("id, employee_id, review_due_date, status, updated_at")
        .eq("tenant_id", params.tenantId),
      supabase
        .from("offboarding_cases")
        .select("id, employee_id, effective_end_date, status, updated_at")
        .eq("tenant_id", params.tenantId),
      supabase
        .from("offboarding_items")
        .select("id, employee_id, offboarding_case_id, title, owner_role, owner_employee_id, due_date, status, updated_at")
        .eq("tenant_id", params.tenantId),
    ]);

    const results = [
      ["employees", employeeResult],
      ["automation", automationResult],
      ["signals", signalResult],
      ["leaves", leaveResult],
      ["document_requirements", documentRequirementResult],
      ["policies", policyResult],
      ["acknowledgements", acknowledgementResult],
      ["onboarding_tasks", onboardingTaskResult],
      ["probation_reviews", probationReviewResult],
      ["offboarding_cases", offboardingCaseResult],
      ["offboarding_items", offboardingItemResult],
    ] as const;

    for (const [label, result] of results) {
      if (result.error) {
        throw new Error(`CONTROL_CENTRE_${label.toUpperCase()}_FAILED: ${result.error.message}`);
      }
    }

    const derived = buildControlCentreItems({
      employees: (employeeResult.data ?? []) as EmployeeRow[],
      automation: (automationResult.data ?? []) as AutomationRow[],
      signals: (signalResult.data ?? []) as RiskSignalRow[],
      leaves: (leaveResult.data ?? []) as LeaveRow[],
      documentRequirements: (documentRequirementResult.data ?? []) as DocumentRequirementRow[],
      policies: (policyResult.data ?? []) as PolicyRow[],
      acknowledgements: (acknowledgementResult.data ?? []) as AcknowledgementRow[],
      onboardingTasks: (onboardingTaskResult.data ?? []) as OnboardingTaskRow[],
      probationReviews: (probationReviewResult.data ?? []) as ProbationReviewRow[],
      offboardingCases: (offboardingCaseResult.data ?? []) as OffboardingCaseRow[],
      offboardingItems: (offboardingItemResult.data ?? []) as OffboardingItemRow[],
      now,
    });
    const summary = summarize(derived.allItems, derived.resolvedItems.length);

    return {
      savedDataStatus: { state: "success" },
      summary,
      previewItems: derived.allItems.slice(0, PREVIEW_LIMIT),
      allItems: derived.allItems,
      resolvedItems: derived.resolvedItems,
      activeEmployeeCount: derived.activeEmployeeCount,
      teamSummary: derived.teamSummary,
    };
  };

  try {
    return await Promise.race([
      loadSavedRows(),
      savedDataTimeoutAfter(params.savedDataTimeoutMs ?? CONTROL_CENTRE_SAVED_DATA_TIMEOUT_MS),
    ]);
  } catch (error) {
    return {
      savedDataStatus: {
        state: "failed",
        message: error instanceof Error ? error.message : "unknown control centre data failure",
      },
      summary: emptySummary(),
      previewItems: [],
      allItems: [],
      resolvedItems: [],
      activeEmployeeCount: 0,
      teamSummary: { startingThisMonth: 0, leavingThisMonth: 0, awayToday: 0 },
    };
  }
}
