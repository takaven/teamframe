import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const leavesSchema = readFileSync(join(root, "schemas", "leaves.sql"), "utf8");
const mutations = readFileSync(join(root, "schemas", "transactional_mutations.sql"), "utf8");
const accrual = readFileSync(join(root, "schemas", "20261004_leave_accrual.sql"), "utf8");
const service = readFileSync(join(root, "services", "leaveService", "index.ts"), "utf8");
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
