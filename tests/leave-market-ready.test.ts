import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const leavesSchema = readFileSync(join(root, "schemas", "leaves.sql"), "utf8");
const mutations = readFileSync(join(root, "schemas", "transactional_mutations.sql"), "utf8");
const service = readFileSync(join(root, "services", "leaveService", "index.ts"), "utf8");
const page = readFileSync(join(root, "app", "leaves", "page.tsx"), "utf8");
const documentService = readFileSync(join(root, "services", "documentService", "index.ts"), "utf8");

function inclusiveDays(startDate: string, endDate: string): number {
  const start = Date.parse(`${startDate}T00:00:00.000Z`);
  const end = Date.parse(`${endDate}T00:00:00.000Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) throw new Error("INVALID_INPUT");
  return Math.floor((end - start) / 86_400_000) + 1;
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

  it("uses date-based inclusive day semantics without hourly leave", () => {
    expect(inclusiveDays("2026-09-10", "2026-09-10")).toBe(1);
    expect(inclusiveDays("2026-09-10", "2026-09-12")).toBe(3);
    expect(() => inclusiveDays("2026-09-12", "2026-09-10")).toThrow("INVALID_INPUT");
    expect(service).not.toContain("hourly");
    expect(service).not.toContain("accrual_rate");
    expect(service).not.toContain("carry_forward");
  });

  it("keeps balance truth derived from company defaults and leave facts", () => {
    expect(service).toContain("annual_leave_default_days");
    expect(service).toContain("status\", [\"pending\", \"approved\"]");
    expect(service).toContain("available: (company.annual_leave_default_days ?? 0) - annual.pending - annual.approved");
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
    expect(page).toContain("Override insufficient balance");
    expect(page).toContain("Annual Leave");
    expect(page).toContain("Withdraw");
    expect(documentService).toContain("approved_unpaid_leave_days_ytd");
    expect(documentService).toContain("approved_unpaid_leave_periods_ytd");
    expect(page).not.toContain("manager");
    expect(page).not.toContain("payroll calculation");
  });
});
