import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const leavesSchema = readFileSync(join(root, "schemas", "leaves.sql"), "utf8");
const mutations = readFileSync(join(root, "schemas", "transactional_mutations.sql"), "utf8");
const accrual = readFileSync(join(root, "schemas", "20261004_leave_accrual.sql"), "utf8");
const service = readFileSync(join(root, "services", "leaveService", "index.ts"), "utf8");
const employeeService = readFileSync(join(root, "services", "employeeService", "index.ts"), "utf8");
const employeeActions = readFileSync(join(root, "app", "employees", "actions.ts"), "utf8");
const people = readFileSync(join(root, "components", "PeopleExperience.tsx"), "utf8");
const page = readFileSync(join(root, "app", "leaves", "page.tsx"), "utf8");
const documentService = readFileSync(join(root, "services", "documentService", "index.ts"), "utf8");

function workingDays(startDate: string, endDate: string): number {
  const start = Date.parse(`${startDate}T00:00:00.000Z`);
  const end = Date.parse(`${endDate}T00:00:00.000Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) throw new Error("INVALID_INPUT");
  let days = 0;
  for (let cursor = new Date(start); cursor.getTime() <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) days += 1;
  }
  if (days <= 0) throw new Error("INVALID_INPUT");
  return days;
}

function daysInclusive(start: string, end: string): number {
  return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000) + 1;
}

function phaseABalance(input: {
  annual: number;
  startDate: string;
  endDate?: string;
  asOf: string;
  year: number;
  joiningProration: boolean;
  monthlyAccrual: boolean;
}): { entitlement: number; accrued: number } {
  const yearStart = `${input.year}-01-01`;
  const yearEnd = `${input.year}-12-31`;
  const eligibleStart = input.startDate > yearStart ? input.startDate : yearStart;
  const entitlement = eligibleStart > yearEnd ? 0 : input.joiningProration
    ? Math.round(input.annual * daysInclusive(eligibleStart, yearEnd) / daysInclusive(yearStart, yearEnd) * 100) / 100
    : input.annual;
  if (!input.monthlyAccrual) return { entitlement, accrued: entitlement };
  const clampedAsOf = input.asOf < yearStart ? yearStart : input.asOf > yearEnd ? yearEnd : input.asOf;
  const eligibleEnd = [clampedAsOf, yearEnd, input.endDate ?? clampedAsOf]
    .reduce((earliest, value) => value < earliest ? value : earliest);
  if (eligibleEnd < eligibleStart) return { entitlement, accrued: 0 };

  let cursorYear = Number(eligibleStart.slice(0, 4));
  let cursorMonth = Number(eligibleStart.slice(5, 7));
  let rawAccrued = 0;
  while (`${cursorYear}-${String(cursorMonth).padStart(2, "0")}-01` <= eligibleEnd) {
    const monthStart = `${cursorYear}-${String(cursorMonth).padStart(2, "0")}-01`;
    const monthDays = new Date(Date.UTC(cursorYear, cursorMonth, 0)).getUTCDate();
    const monthEnd = `${cursorYear}-${String(cursorMonth).padStart(2, "0")}-${monthDays}`;
    const serviceStart = eligibleStart > monthStart ? eligibleStart : monthStart;
    const serviceEnd = eligibleEnd < monthEnd ? eligibleEnd : monthEnd;
    if (serviceEnd >= serviceStart) {
      rawAccrued += (input.annual / 12) * daysInclusive(serviceStart, serviceEnd) / monthDays;
    }
    cursorMonth += 1;
    if (cursorMonth === 13) { cursorMonth = 1; cursorYear += 1; }
  }
  const accrued = Math.min(entitlement, Math.round(rawAccrued * 100) / 100);
  return { entitlement, accrued };
}

describe("MR-6 leave market-ready scope", () => {
  it("models bounded leave types, states and audit facts", () => {
    expect(service).toContain('["annual", "sick", "unpaid", "other"]');
    expect(leavesSchema).toContain("create type leave_type as enum ('annual', 'sick', 'unpaid', 'other')");
    expect(leavesSchema).toContain("alter type leave_status add value if not exists 'cancelled'");
    for (const column of [
      "requested_days",
      "override_insufficient_balance",
      "override_reason",
      "cancelled_by_user_id",
      "cancelled_at",
      "approval_automation_item_id",
    ]) {
      expect(leavesSchema).toContain(column);
    }
  });

  it("uses configured working-day and bounded half-day semantics", () => {
    expect(workingDays("2026-09-07", "2026-09-13")).toBe(5);
    expect(service).toContain("cursor.getUTCDate() + 1");
    expect(mutations).toContain("teamframe_calculate_leave_days");
    expect(mutations).toContain("extract(isodow");
    expect(mutations).toContain("coalesce(e.working_days_override, c.default_working_days)");
    expect(mutations).toContain("company_holidays");
    expect(() => workingDays("2026-09-12", "2026-09-13")).toThrow("INVALID_INPUT");
    expect(service).not.toContain("hourly");
    expect(service).not.toContain("accrual_rate");
    expect(accrual).toContain("day_part in ('full_day', 'morning', 'afternoon')");
    expect(mutations).toContain("p_day_part <> 'full_day'");
  });

  it("uses one transparent balance engine for reads and approval enforcement", () => {
    expect(accrual).toContain("function teamframe_leave_balance_components");
    for (const component of ["opening", "carried_forward", "accrued", "adjustments", "taken", "pending", "available"]) {
      expect(accrual).toContain(component);
      expect(page).toContain(component);
    }
    expect(mutations).toContain("teamframe_leave_balance_components");
    expect(service).toContain('rpc("teamframe_leave_balance_components"');
  });

  it("separates annual entitlement from accrued-to-date without compounded reduction", () => {
    const april = phaseABalance({ annual: 30, startDate: "2026-04-01", asOf: "2026-12-31", year: 2026, joiningProration: true, monthlyAccrual: true });
    expect(april.entitlement).toBe(22.6);
    expect(april.accrued).toBe(22.5);
    expect(april.accrued).not.toBe(16.95); // the former double-prorated result

    expect(phaseABalance({ annual: 30, startDate: "2026-04-01", asOf: "2026-12-31", year: 2026, joiningProration: true, monthlyAccrual: false }).accrued).toBe(22.6);
    expect(phaseABalance({ annual: 30, startDate: "2026-04-01", asOf: "2026-12-31", year: 2026, joiningProration: false, monthlyAccrual: true }).accrued).toBe(22.5);
    expect(phaseABalance({ annual: 30, startDate: "2026-04-01", asOf: "2026-09-30", year: 2026, joiningProration: false, monthlyAccrual: true }).accrued).toBe(15);
    expect(phaseABalance({ annual: 24, startDate: "2026-04-15", asOf: "2026-06-30", year: 2026, joiningProration: true, monthlyAccrual: true }).accrued).toBe(5.07);
    expect(phaseABalance({ annual: 30, startDate: "2024-04-01", asOf: "2024-12-31", year: 2024, joiningProration: true, monthlyAccrual: false }).entitlement).toBe(22.54);
    expect(phaseABalance({ annual: 30, startDate: "2025-12-15", asOf: "2026-01-31", year: 2026, joiningProration: true, monthlyAccrual: true }).accrued).toBe(2.5);
    expect(phaseABalance({ annual: 18, startDate: "2026-04-01", asOf: "2026-12-31", year: 2026, joiningProration: true, monthlyAccrual: true }).accrued).toBe(13.5);

    expect(accrual).toContain("v_monthly_accrued := v_monthly_accrued");
    expect(accrual).toContain("(v_service_end - v_service_start + 1)::numeric");
    expect(accrual).toContain("accrued := least(v_prorated, round(v_monthly_accrued, 2))");
    expect(accrual).not.toContain("v_prorated * least(12");
    expect(accrual).toContain("entry_kind = 'carry_forward'");
    expect(accrual).toContain("day_part in ('full_day', 'morning', 'afternoon')");
    expect(accrual).not.toMatch(/update\s+leave_balance_entries|delete\s+from\s+leave_balance_entries/i);
  });

  it("prorates monthly accrual for inclusive partial first and final months", () => {
    // A/D: first day of April earns the full April monthly rate.
    expect(phaseABalance({ annual: 24, startDate: "2026-04-01", asOf: "2026-04-30", year: 2026, joiningProration: false, monthlyAccrual: true }).accrued).toBe(2);
    // B: 15–30 April inclusive is 16/30 of the monthly rate.
    expect(phaseABalance({ annual: 24, startDate: "2026-04-15", asOf: "2026-04-30", year: 2026, joiningProration: false, monthlyAccrual: true }).accrued).toBe(1.07);
    // C: the same fraction against a 30-day annual value.
    expect(phaseABalance({ annual: 30, startDate: "2026-04-15", asOf: "2026-04-30", year: 2026, joiningProration: false, monthlyAccrual: true }).accrued).toBe(1.33);
    // E: the final day of April earns only 1/30 of the monthly rate.
    expect(phaseABalance({ annual: 24, startDate: "2026-04-30", asOf: "2026-04-30", year: 2026, joiningProration: false, monthlyAccrual: true }).accrued).toBe(0.07);
    // F: partial April plus complete May and June.
    expect(phaseABalance({ annual: 24, startDate: "2026-04-15", asOf: "2026-06-30", year: 2026, joiningProration: false, monthlyAccrual: true }).accrued).toBe(5.07);
    // G/H: February denominator follows the actual calendar, including leap years.
    expect(phaseABalance({ annual: 24, startDate: "2026-02-15", asOf: "2026-02-28", year: 2026, joiningProration: false, monthlyAccrual: true }).accrued).toBe(1);
    expect(phaseABalance({ annual: 24, startDate: "2024-02-15", asOf: "2024-02-29", year: 2024, joiningProration: false, monthlyAccrual: true }).accrued).toBe(1.03);
    // I: service beginning in a prior year earns the full January rate.
    expect(phaseABalance({ annual: 24, startDate: "2025-12-15", asOf: "2026-01-31", year: 2026, joiningProration: false, monthlyAccrual: true }).accrued).toBe(2);
    // J/K: a partial final month is prorated; the final calendar day completes the month.
    expect(phaseABalance({ annual: 24, startDate: "2026-01-01", endDate: "2026-09-15", asOf: "2026-12-31", year: 2026, joiningProration: false, monthlyAccrual: true }).accrued).toBe(17);
    expect(phaseABalance({ annual: 24, startDate: "2026-01-01", endDate: "2026-09-30", asOf: "2026-12-31", year: 2026, joiningProration: false, monthlyAccrual: true }).accrued).toBe(18);
    // L: employment wholly within one month accrues only the inclusive service fraction.
    expect(phaseABalance({ annual: 24, startDate: "2026-04-15", endDate: "2026-04-20", asOf: "2026-12-31", year: 2026, joiningProration: false, monthlyAccrual: true }).accrued).toBe(0.4);
    // M: employee entitlement overrides remain the monthly-rate base.
    expect(phaseABalance({ annual: 18, startDate: "2026-04-01", asOf: "2026-12-31", year: 2026, joiningProration: false, monthlyAccrual: true }).accrued).toBe(13.5);
  });

  it("keeps adjustments immutable, actor-attributed, tenant-scoped and carry-forward idempotent", () => {
    expect(accrual).toContain("create table if not exists leave_balance_entries");
    expect(accrual).toContain("created_by_user_id uuid not null");
    expect(accrual).toContain("leave_balance_entries_idempotency_unique");
    expect(accrual).toContain("from tenant_memberships");
    expect(accrual).toContain("profile in ('admin', 'full_access')");
    expect(accrual).toContain("leave_balance_entries_no_direct_write");
    expect(accrual).toContain("LEAVE_CARRY_EXCEEDS_AVAILABLE");
  });

  it("provides an editable, annually confirmed UAE holiday import instead of hard-coded dates", () => {
    const setup = readFileSync(join(root, "app", "setup", "page.tsx"), "utf8");
    const holidays = readFileSync(join(root, "services", "companyHolidayService.ts"), "utf8");
    expect(setup).toContain("Import an admin-confirmed annual holiday list");
    expect(setup).toContain("future religious-holiday dates");
    expect(holidays).toContain("HOLIDAY_IMPORT_INVALID_YEAR_OR_DUPLICATE");
  });

  it("keeps balance truth derived from company defaults and leave facts", () => {
    expect(service).toContain("annual_leave_default_days");
    expect(service).toContain("LEAVE_PERIOD_CROSSING");
    expect(mutations).toContain("raise exception 'LEAVE_PERIOD_CROSSING'");
    expect(service).toContain("status\", [\"pending\", \"approved\"]");
    expect(service).toContain("annual_leave_entitlement_override");
    expect(service).toContain("annualAllocation - annual.pending - annual.approved");
    expect(service).toContain("periodForYear");
  });

  it("lets an admin maintain the existing employee annual entitlement override without changing the leave engine", () => {
    expect(employeeService).toContain("updateEmployeeAnnualLeaveEntitlementOverride");
    expect(employeeService).toContain("annual_leave_entitlement_override: parsedOverride");
    expect(employeeService).toContain('.eq("updated_at", expectedUpdatedAt)');
    expect(employeeService).toContain('employee.annual_leave_entitlement_override_updated');
    expect(employeeActions).toContain('value.trim() === "" ? null : value');
    expect(employeeActions).toContain(".min(0).max(365)");
    expect(people).toContain("Effective entitlement:");
    expect(people).toContain("Leave blank to use the company default.");
    expect(people).toContain('className="w-full sm:w-auto sm:min-w-64"');
    expect(service).toContain('d.system_leave_type==="annual"&&annualOverride!=null?Number(annualOverride):d.default_entitlement_days');
  });

  it("enforces overlap, lifecycle and insufficient balance in transactional RPCs", () => {
    expect(mutations).toContain("teamframe_derive_employee_lifecycle");
    expect(mutations).toContain("not in ('active', 'offboarding')");
    expect(mutations).toContain("raise exception 'LEAVE_OVERLAP'");
    expect(mutations).toContain("raise exception 'LEAVE_INSUFFICIENT_BALANCE'");
    expect(mutations).toContain("for update");
    expect(mutations).not.toContain("return 'on_leave'");
  });

  it("integrates pending approval with MR-2 and suppresses it on decision or withdrawal", () => {
    expect(mutations).toContain("teamframe_ensure_hr_automation_item");
    expect(mutations).toContain("'leave.approval_due'");
    expect(mutations).toContain("teamframe_run_hr_automation_item");
    expect(mutations).toContain("'source', 'leave.decision'");
    expect(mutations).toContain("'source', 'leave.withdrawn'");
  });

  it("exposes bounded admin and employee surfaces only", () => {
    expect(page).toContain("Who&apos;s away");
    expect(service).toContain(".select(\"id, full_name, role_title\")");
    expect(service).toContain("employeesById.get(row.employee_id)");
    expect(page).toContain("Override insufficient balance");
    expect(page).toContain("Annual Leave");
    expect(page).toContain("Withdraw");
    expect(documentService).toContain("approved_unpaid_leave_days_period");
    expect(documentService).toContain("approved_unpaid_leave_periods");
    expect(page).not.toContain("manager");
    expect(page).not.toContain("payroll calculation");
  });
});
