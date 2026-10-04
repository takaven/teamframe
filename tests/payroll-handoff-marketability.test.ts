import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const service = readFileSync(join(root, "services", "documentService", "index.ts"), "utf8");
const preview = readFileSync(join(root, "services", "payrollHandoffService.ts"), "utf8");
const component = readFileSync(join(root, "components", "ReportsExports.tsx"), "utf8");
const access = readFileSync(join(root, "schemas", "access_model.sql"), "utf8");
const actions = readFileSync(join(root, "app", "employees", "actions.ts"), "utf8");

describe("M3 period-aware payroll handoff", () => {
  it("requires a selected monthly period and only aggregates overlapping approved leave", () => {
    expect(service).toContain("INVALID_PAYROLL_PERIOD");
    expect(service).toContain('const periodStart = `${period}-01`');
    expect(service).toContain('.lte("start_date", periodEnd)');
    expect(service).toContain('.gte("end_date", periodStart)');
    expect(component).toContain('type="month"');
    expect(actions).toContain('period: formData.get("period")');
  });

  it("exports the agreed finance fields and change flags without calculating payroll", () => {
    for (const field of ["employee_number", "joiner_flag", "leaver_flag", "salary_amount", "currency", "bank_name", "account_number_iban", "start_date", "end_date", "approved_unpaid_leave_days_period", "change_flags_period"]) {
      expect(service).toContain(`"${field}"`);
    }
    expect(service).toContain('changes.add("salary")');
    expect(service).toContain('changes.add("payment_details")');
    expect(component).toContain("does not calculate payroll");
    expect(service).toContain("cross-period; review");
    expect(service).toContain("employee.start_date <= periodEnd");
  });

  it("retains the Finance export capability boundary", () => {
    expect(service).toContain("canRunFinanceExport(actor)");
    expect(access).toContain("finance_payroll_exports");
  });

  it("provides a period-aware Payroll changes view", () => {
    expect(preview).toContain("listPayrollChanges");
    expect(preview).toContain('requireCapability(actor,"finance_payroll_exports")');
    expect(preview).toContain("Payment details");
    expect(preview).toContain("unpaidLeaveDays");
    expect(service).toContain('"compensation_components"');
  });
});
