/**
 * Leave service — server-side only.
 *
 * MR-6 scope:
 *  - date-based leave requests, decisions, balances, cancellation, and Who's Away
 *  - no statutory engine, accrual, carry-forward, payroll calculation, or manager delegation
 */

import "server-only";
import { z } from "zod";
import type { Actor } from "@/middleware/rbac";
import { createServiceRoleClient } from "@/lib/db/supabaseServer";
import { track } from "@/lib/telemetry/track";
import { maybeFireActivationCompleted } from "@/services/onboardingService";
import { isLeaveRequestEligibleEmployee, type LegacyEmployeeLifecycleState } from "@/services/employeeLifecycle";
import { assertCurrentDirectManager, listCurrentDirectReports } from "@/services/managerAuthorization";
import { assertLeaveDoesNotExceedActiveOffboardingEndDate } from "@/services/offboardingService";

export type LeaveType = "annual" | "sick" | "unpaid" | "other";
export type LeaveStatus = "pending" | "approved" | "rejected" | "cancelled";

export const LEAVE_TYPES = ["annual", "sick", "unpaid", "other"] as const satisfies readonly LeaveType[];

const LEAVE_COLUMNS =
  "id, tenant_id, employee_id, start_date, end_date, leave_type, requested_days, reason, status, decided_by_user_id, decided_at, decision_note, override_insufficient_balance, override_reason, cancelled_by_user_id, cancelled_at, cancellation_reason, approval_automation_item_id, created_at, updated_at";

export type LeaveRecord = {
  id: string;
  employee_id: string;
  start_date: string;
  end_date: string;
  leave_type: LeaveType;
  requested_days: number;
  reason: string | null;
  status: LeaveStatus;
  decided_by_user_id: string | null;
  decided_at: string | null;
  decision_note: string | null;
  override_insufficient_balance: boolean;
  override_reason: string | null;
  cancelled_by_user_id: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  approval_automation_item_id: string | null;
  created_at: string;
  updated_at: string;
};

type LeaveRow = Omit<LeaveRecord, "requested_days"> & {
  tenant_id: string;
  requested_days: string | number;
};

type EmployeeLifecycleRow = {
  id: string;
  status: "active" | "on_leave" | "inactive";
  setup_status: "incomplete" | "ready" | "active";
  lifecycle_state: LegacyEmployeeLifecycleState;
  start_date: string | null;
  end_date: string | null;
  deleted_at: string | null;
};

export type LeaveBalanceSummary = {
  leave_type: LeaveType;
  tracked: boolean;
  allocation: number | null;
  pending: number;
  approved_taken: number;
  available: number | null;
  period_start: string;
  period_end: string;
};

export type LeaveOverview = {
  balances: LeaveBalanceSummary[];
  requests: LeaveRecord[];
};

export type PendingLeaveWithEmployee = LeaveRecord & {
  employee_full_name: string;
  employee_role_title: string;
  annual_balance?: LeaveBalanceSummary;
};

export type WhoIsAwayEntry = {
  leave_id: string;
  employee_id: string;
  employee_full_name: string;
  employee_role_title: string;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  requested_days: number;
  updated_at: string;
};

function requireTenant(actor: Actor): string {
  if (!actor.tenantId) throw new Error("NO_TENANT_CONTEXT");
  return actor.tenantId;
}

function requireAdmin(actor: Actor): void {
  if (actor.role !== "admin") throw new Error("FORBIDDEN");
}

function requireLinkedEmployee(actor: Actor): string {
  if (!actor.employeeId) throw new Error("NO_EMPLOYEE_RECORD");
  return actor.employeeId;
}

const DateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const SubmitLeaveSchema = z
  .object({
    startDate: DateString,
    endDate: DateString,
    leaveType: z.enum(LEAVE_TYPES).default("annual"),
    reason: z.string().trim().max(500).optional().nullable(),
  })
  .refine((d) => d.endDate >= d.startDate, { message: "INVALID_INPUT" });

const DecisionInputSchema = z.object({
  overrideInsufficientBalance: z.boolean().default(false),
  overrideReason: z.string().trim().max(500).optional().nullable(),
  decisionNote: z.string().trim().max(500).optional().nullable(),
});

function toDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year!, month! - 1, day!, 0, 0, 0, 0));
}

function todayIso(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function calculateLeaveDays(startDate: string, endDate: string): number {
  return calculateLeaveDaysForCalendar(startDate, endDate, [1, 2, 3, 4, 5], new Set());
}

export function calculateLeaveDaysForCalendar(
  startDate: string,
  endDate: string,
  workingDays: number[],
  holidays: Set<string>,
): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate) || endDate < startDate) {
    throw new Error("INVALID_INPUT");
  }
  if (workingDays.length === 0 || workingDays.some((day) => day < 1 || day > 7)) throw new Error("INVALID_WORKING_DAYS");
  let days = 0;
  const workdaySet = new Set(workingDays);
  for (let cursor = toDate(startDate); cursor <= toDate(endDate); cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const iso = cursor.toISOString().slice(0, 10);
    const isoDay = cursor.getUTCDay() === 0 ? 7 : cursor.getUTCDay();
    if (workdaySet.has(isoDay) && !holidays.has(iso)) days += 1;
  }
  if (days <= 0) throw new Error("INVALID_INPUT");
  return days;
}

function periodForYear(year: number): { start: string; end: string } {
  return { start: `${year}-01-01`, end: `${year}-12-31` };
}

function rowToRecord(row: LeaveRow): LeaveRecord {
  const { tenant_id: _tenantId, requested_days, ...rest } = row;
  return {
    ...rest,
    requested_days: Number(requested_days),
  };
}

async function getEmployeeForLeave(actor: Actor, employeeId: string): Promise<EmployeeLifecycleRow> {
  const tenantId = requireTenant(actor);
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("employees")
    .select("id, status, setup_status, lifecycle_state, start_date, end_date, deleted_at")
    .eq("tenant_id", tenantId)
    .eq("id", employeeId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw new Error(`LEAVE_EMPLOYEE_FETCH_FAILED: ${error.message}`);
  if (!data) throw new Error("NO_EMPLOYEE_RECORD");
  return data as EmployeeLifecycleRow;
}

async function assertLeaveEligible(actor: Actor, employeeId: string): Promise<void> {
  const employee = await getEmployeeForLeave(actor, employeeId);
  if (!isLeaveRequestEligibleEmployee(employee)) {
    throw new Error("LEAVE_EMPLOYEE_NOT_ELIGIBLE");
  }
}

export async function listLeaveBalancesForEmployee(
  actor: Actor,
  employeeId: string,
  year = new Date().getUTCFullYear(),
): Promise<LeaveBalanceSummary[]> {
  const tenantId = requireTenant(actor);
  if (actor.role !== "admin" && actor.employeeId !== employeeId) {
    await assertCurrentDirectManager(actor, employeeId);
  }
  const period = periodForYear(year);
  const supabase = createServiceRoleClient();
  const [
    { data: companyData, error: companyError },
    { data: employeeData, error: employeeError },
    { data: leaveData, error: leaveError },
    { data: openingData, error: openingError },
  ] = await Promise.all([
    supabase
      .from("companies")
      .select("annual_leave_default_days, sick_leave_default_days, unpaid_leave_enabled, other_leave_enabled")
      .eq("id", tenantId)
      .single(),
    supabase
      .from("employees")
      .select("annual_leave_entitlement_override")
      .eq("tenant_id", tenantId)
      .eq("id", employeeId)
      .single(),
    supabase
      .from("leaves")
      .select("leave_type, status, requested_days, start_date")
      .eq("tenant_id", tenantId)
      .eq("employee_id", employeeId)
      .gte("start_date", period.start)
      .lte("start_date", period.end)
      .in("status", ["pending", "approved"]),
    supabase
      .from("leave_opening_adjustments")
      .select("leave_type, used_days")
      .eq("tenant_id", tenantId)
      .eq("employee_id", employeeId)
      .eq("period_year", year),
  ]);

  if (companyError) throw new Error(`LEAVE_COMPANY_FETCH_FAILED: ${companyError.message}`);
  if (employeeError) throw new Error(`LEAVE_EMPLOYEE_FETCH_FAILED: ${employeeError.message}`);
  if (leaveError) throw new Error(`LEAVE_BALANCE_FETCH_FAILED: ${leaveError.message}`);
  if (openingError) throw new Error(`LEAVE_OPENING_BALANCE_FETCH_FAILED: ${openingError.message}`);

  const byType = new Map<LeaveType, { pending: number; approved: number }>();
  for (const type of LEAVE_TYPES) byType.set(type, { pending: 0, approved: 0 });
  for (const row of (openingData ?? []) as Array<{ leave_type: LeaveType; used_days: string | number }>) {
    const bucket = byType.get(row.leave_type) ?? { pending: 0, approved: 0 };
    bucket.approved += Number(row.used_days);
    byType.set(row.leave_type, bucket);
  }
  for (const row of (leaveData ?? []) as Array<{ leave_type: LeaveType; status: LeaveStatus; requested_days: string | number }>) {
    const bucket = byType.get(row.leave_type) ?? { pending: 0, approved: 0 };
    if (row.status === "pending") bucket.pending += Number(row.requested_days);
    if (row.status === "approved") bucket.approved += Number(row.requested_days);
    byType.set(row.leave_type, bucket);
  }

  const company = companyData as {
    annual_leave_default_days: number | null;
    sick_leave_default_days: number | null;
    unpaid_leave_enabled: boolean | null;
    other_leave_enabled: boolean | null;
  };
  const employee = employeeData as { annual_leave_entitlement_override: string | number | null };
  const annualAllocation = employee.annual_leave_entitlement_override == null
    ? (company.annual_leave_default_days ?? 0)
    : Number(employee.annual_leave_entitlement_override);

  const annual = byType.get("annual")!;
  return [
    {
      leave_type: "annual",
      tracked: true,
      allocation: annualAllocation,
      pending: annual.pending,
      approved_taken: annual.approved,
      available: annualAllocation - annual.pending - annual.approved,
      period_start: period.start,
      period_end: period.end,
    },
    {
      leave_type: "sick",
      tracked: false,
      allocation: company.sick_leave_default_days ?? null,
      pending: byType.get("sick")!.pending,
      approved_taken: byType.get("sick")!.approved,
      available: null,
      period_start: period.start,
      period_end: period.end,
    },
    {
      leave_type: "unpaid",
      tracked: false,
      allocation: null,
      pending: byType.get("unpaid")!.pending,
      approved_taken: byType.get("unpaid")!.approved,
      available: null,
      period_start: period.start,
      period_end: period.end,
    },
    {
      leave_type: "other",
      tracked: false,
      allocation: null,
      pending: byType.get("other")!.pending,
      approved_taken: byType.get("other")!.approved,
      available: null,
      period_start: period.start,
      period_end: period.end,
    },
  ];
}

export async function getLeaveOverviewForEmployee(actor: Actor, employeeId: string): Promise<LeaveOverview> {
  const requests = await listLeavesForEmployee(actor, employeeId);
  const balances = await listLeaveBalancesForEmployee(actor, employeeId);
  return { balances, requests };
}

export async function listLeavesForEmployee(actor: Actor, employeeId: string): Promise<LeaveRecord[]> {
  const tenantId = requireTenant(actor);
  if (actor.role !== "admin" && actor.employeeId !== employeeId) {
    throw new Error("FORBIDDEN");
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("leaves")
    .select(LEAVE_COLUMNS)
    .eq("tenant_id", tenantId)
    .eq("employee_id", employeeId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`LEAVE_LIST_FAILED: ${error.message}`);
  return ((data ?? []) as LeaveRow[]).map(rowToRecord);
}

export async function listPendingLeavesWithEmployee(actor: Actor): Promise<PendingLeaveWithEmployee[]> {
  requireAdmin(actor);
  const tenantId = requireTenant(actor);

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("leaves")
    .select(LEAVE_COLUMNS)
    .eq("tenant_id", tenantId)
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error) throw new Error(`LEAVE_LIST_PENDING_FAILED: ${error.message}`);

  const leaves = ((data ?? []) as LeaveRow[]).map(rowToRecord);
  const employeeIds = Array.from(new Set(leaves.map((leave) => leave.employee_id)));
  const employeesById = new Map<string, { full_name: string; role_title: string }>();

  if (employeeIds.length > 0) {
    const { data: employeeData, error: employeeError } = await supabase
      .from("employees")
      .select("id, full_name, role_title")
      .eq("tenant_id", tenantId)
      .in("id", employeeIds)
      .is("deleted_at", null);

    if (employeeError) throw new Error(`LEAVE_EMPLOYEE_LIST_FAILED: ${employeeError.message}`);
    for (const employee of (employeeData ?? []) as Array<{ id: string; full_name: string; role_title: string }>) {
      employeesById.set(employee.id, {
        full_name: employee.full_name,
        role_title: employee.role_title,
      });
    }
  }

  const annualBalances = new Map<string, LeaveBalanceSummary>();
  for (const employeeId of employeeIds) {
    annualBalances.set(employeeId, (await listLeaveBalancesForEmployee(actor, employeeId))[0]!);
  }

  return leaves.map((row) => {
    const employee = employeesById.get(row.employee_id);
    return {
      ...row,
      employee_full_name: employee?.full_name ?? "(unknown)",
      employee_role_title: employee?.role_title ?? "(unknown)",
      annual_balance: annualBalances.get(row.employee_id),
    };
  });
}

export async function listPendingLeavesForManager(actor: Actor): Promise<PendingLeaveWithEmployee[]> {
  const tenantId = requireTenant(actor);
  const directReports = await listCurrentDirectReports(actor);
  const directReportIds = directReports.map((employee) => employee.id);
  if (directReportIds.length === 0) return [];

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("leaves")
    .select(LEAVE_COLUMNS)
    .eq("tenant_id", tenantId)
    .eq("status", "pending")
    .in("employee_id", directReportIds)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`MANAGER_LEAVE_LIST_FAILED: ${error.message}`);

  const leaves = ((data ?? []) as LeaveRow[]).map(rowToRecord);
  const employeesById = new Map(directReports.map((employee) => [
    employee.id,
    {
      full_name: employee.full_name,
      role_title: employee.role_title,
    },
  ]));

  const annualBalances = new Map<string, LeaveBalanceSummary>();
  for (const employeeId of directReportIds) {
    annualBalances.set(employeeId, (await listLeaveBalancesForEmployee(actor, employeeId))[0]!);
  }

  return leaves.map((row) => {
    const employee = employeesById.get(row.employee_id);
    return {
      ...row,
      employee_full_name: employee?.full_name ?? "(unknown)",
      employee_role_title: employee?.role_title ?? "(unknown)",
      annual_balance: annualBalances.get(row.employee_id),
    };
  });
}

export async function listWhoIsAway(actor: Actor, input: { from?: string; to?: string } = {}): Promise<WhoIsAwayEntry[]> {
  requireAdmin(actor);
  const tenantId = requireTenant(actor);
  const from = input.from ?? todayIso();
  const to = input.to ?? todayIso(new Date(Date.now() + 30 * 86_400_000));
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("leaves")
    .select(LEAVE_COLUMNS)
    .eq("tenant_id", tenantId)
    .eq("status", "approved")
    .lte("start_date", to)
    .gte("end_date", from)
    .order("start_date", { ascending: true });

  if (error) throw new Error(`LEAVE_WHO_IS_AWAY_FAILED: ${error.message}`);
  const leaveRows = (data ?? []) as LeaveRow[];
  const employeeIds = [...new Set(leaveRows.map((row) => row.employee_id))];
  const employeesById = new Map<string, { full_name: string; role_title: string }>();
  if (employeeIds.length > 0) {
    const { data: employeeData, error: employeeError } = await supabase
      .from("employees")
      .select("id, full_name, role_title")
      .eq("tenant_id", tenantId)
      .in("id", employeeIds);
    if (employeeError) throw new Error(`LEAVE_WHO_IS_AWAY_FAILED: ${employeeError.message}`);
    for (const employee of (employeeData ?? []) as Array<{ id: string; full_name: string; role_title: string }>) {
      employeesById.set(employee.id, employee);
    }
  }
  return leaveRows.map((row) => {
    const employee = employeesById.get(row.employee_id);
    return {
    leave_id: row.id,
    employee_id: row.employee_id,
    employee_full_name: employee?.full_name ?? "(unknown)",
    employee_role_title: employee?.role_title ?? "(unknown)",
    leave_type: row.leave_type,
    start_date: row.start_date,
    end_date: row.end_date,
    requested_days: Number(row.requested_days),
    updated_at: row.updated_at,
    };
  });
}

export async function submitLeaveRequest(
  actor: Actor,
  input: { startDate: string; endDate: string; leaveType?: LeaveType; reason?: string | null },
): Promise<LeaveRecord> {
  const tenantId = requireTenant(actor);
  const employeeId = requireLinkedEmployee(actor);
  const parsed = SubmitLeaveSchema.safeParse(input);
  if (!parsed.success) throw new Error("INVALID_INPUT");
  if (parsed.data.leaveType === "annual" && parsed.data.startDate.slice(0, 4) !== parsed.data.endDate.slice(0, 4)) {
    throw new Error("LEAVE_PERIOD_CROSSING");
  }

  await assertLeaveEligible(actor, employeeId);
  await assertLeaveDoesNotExceedActiveOffboardingEndDate(actor, employeeId, parsed.data.endDate);

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .rpc("teamframe_submit_leave", {
      p_tenant_id: tenantId,
      p_actor_user_id: actor.authUserId,
      p_employee_id: employeeId,
      p_start_date: parsed.data.startDate,
      p_end_date: parsed.data.endDate,
      p_leave_type: parsed.data.leaveType,
      p_reason: parsed.data.reason ?? null,
    } as never)
    .single();

  if (error) throw new Error(`LEAVE_SUBMIT_FAILED: ${error.message}`);

  const created = data as LeaveRow;
  const countResult = await supabase.from("leaves").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId);
  if ((countResult.count ?? 0) === 1) {
    await track({ tenantId, userId: actor.authUserId, eventName: "first_leave_requested", properties: { leave_id: created.id } });
  }

  return rowToRecord(created);
}

export async function decideLeaveRequest(
  actor: Actor,
  leaveId: string,
  decision: "approved" | "rejected",
  expectedUpdatedAt: string,
  input: { overrideInsufficientBalance?: boolean; overrideReason?: string | null; decisionNote?: string | null } = {},
): Promise<LeaveRecord> {
  requireAdmin(actor);
  const tenantId = requireTenant(actor);
  if (!expectedUpdatedAt) throw new Error("MISSING_EXPECTED_UPDATED_AT");
  const parsed = DecisionInputSchema.parse(input);

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .rpc("teamframe_decide_leave", {
      p_tenant_id: tenantId,
      p_actor_user_id: actor.authUserId,
      p_leave_id: leaveId,
      p_decision: decision,
      p_expected_updated_at: expectedUpdatedAt,
      p_override_insufficient_balance: parsed.overrideInsufficientBalance,
      p_override_reason: parsed.overrideReason ?? null,
      p_decision_note: parsed.decisionNote ?? null,
    } as never)
    .maybeSingle();

  if (error) throw new Error(`LEAVE_DECISION_FAILED: ${error.message}`);
  if (!data) throw new Error("STALE_WRITE");

  if (decision === "approved") {
    const countResult = await supabase
      .from("leaves")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("status", "approved");
    if ((countResult.count ?? 0) === 1) {
      await track({ tenantId, userId: actor.authUserId, eventName: "first_leave_approved", properties: { leave_id: leaveId } });
      await maybeFireActivationCompleted(tenantId, actor.authUserId);
    }
  }

  return rowToRecord(data as LeaveRow);
}

export async function decideLeaveRequestAsManager(
  actor: Actor,
  leaveId: string,
  decision: "approved" | "rejected",
  expectedUpdatedAt: string,
  input: { decisionNote?: string | null; overrideInsufficientBalance?: boolean } = {},
): Promise<LeaveRecord> {
  const tenantId = requireTenant(actor);
  if (!expectedUpdatedAt) throw new Error("MISSING_EXPECTED_UPDATED_AT");
  if (input.overrideInsufficientBalance) throw new Error("MANAGER_LEAVE_OVERRIDE_FORBIDDEN");

  const supabase = createServiceRoleClient();
  const { data: leaveData, error: leaveLookupError } = await supabase
    .from("leaves")
    .select(LEAVE_COLUMNS)
    .eq("tenant_id", tenantId)
    .eq("id", leaveId)
    .eq("status", "pending")
    .maybeSingle();

  if (leaveLookupError) throw new Error(`MANAGER_LEAVE_LOOKUP_FAILED: ${leaveLookupError.message}`);
  if (!leaveData) throw new Error("LEAVE_NOT_FOUND");

  const pendingLeave = leaveData as LeaveRow;
  await assertCurrentDirectManager(actor, pendingLeave.employee_id);

  const { data, error } = await supabase
    .rpc("teamframe_decide_leave", {
      p_tenant_id: tenantId,
      p_actor_user_id: actor.authUserId,
      p_leave_id: leaveId,
      p_decision: decision,
      p_expected_updated_at: expectedUpdatedAt,
      p_override_insufficient_balance: false,
      p_override_reason: null,
      p_decision_note: input.decisionNote ?? null,
    } as never)
    .maybeSingle();

  if (error) throw new Error(`LEAVE_DECISION_FAILED: ${error.message}`);
  if (!data) throw new Error("STALE_WRITE");

  if (decision === "approved") {
    const countResult = await supabase
      .from("leaves")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("status", "approved");
    if ((countResult.count ?? 0) === 1) {
      await track({ tenantId, userId: actor.authUserId, eventName: "first_leave_approved", properties: { leave_id: leaveId } });
      await maybeFireActivationCompleted(tenantId, actor.authUserId);
    }
  }

  return rowToRecord(data as LeaveRow);
}

export async function withdrawPendingLeave(
  actor: Actor,
  leaveId: string,
  expectedUpdatedAt: string,
  reason?: string | null,
): Promise<LeaveRecord> {
  const tenantId = requireTenant(actor);
  const employeeId = requireLinkedEmployee(actor);
  if (!expectedUpdatedAt) throw new Error("MISSING_EXPECTED_UPDATED_AT");
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .rpc("teamframe_withdraw_leave", {
      p_tenant_id: tenantId,
      p_actor_user_id: actor.authUserId,
      p_employee_id: employeeId,
      p_leave_id: leaveId,
      p_expected_updated_at: expectedUpdatedAt,
      p_reason: reason ?? null,
    } as never)
    .maybeSingle();

  if (error) throw new Error(`LEAVE_WITHDRAW_FAILED: ${error.message}`);
  if (!data) throw new Error("STALE_WRITE");
  return rowToRecord(data as LeaveRow);
}

export async function cancelApprovedLeave(
  actor: Actor,
  leaveId: string,
  expectedUpdatedAt: string,
  reason?: string | null,
): Promise<LeaveRecord> {
  requireAdmin(actor);
  const tenantId = requireTenant(actor);
  if (!expectedUpdatedAt) throw new Error("MISSING_EXPECTED_UPDATED_AT");
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .rpc("teamframe_cancel_approved_leave", {
      p_tenant_id: tenantId,
      p_actor_user_id: actor.authUserId,
      p_leave_id: leaveId,
      p_expected_updated_at: expectedUpdatedAt,
      p_reason: reason ?? null,
    } as never)
    .maybeSingle();

  if (error) throw new Error(`LEAVE_CANCEL_FAILED: ${error.message}`);
  if (!data) throw new Error("STALE_WRITE");
  return rowToRecord(data as LeaveRow);
}
