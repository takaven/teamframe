import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { csv, humanCsvValue } from "@/lib/reports/csv";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("Group D fixed reports", () => {
  it("adds Reports to admin navigation without exposing it to employee navigation", () => {
    const shell = read("components/AppShell.tsx");
    expect(shell).toContain('{ href: "/reports", label: "Reports" }');
    expect(shell.indexOf('{ href: "/reports"')).toBeLessThan(shell.indexOf("const EMPLOYEE_LINKS"));
  });

  it("ships the management snapshot and eight fixed report destinations with no report builder", () => {
    const page = read("app/reports/page.tsx");
    for (const label of ["Management snapshot", "Headcount", "Joiners & leavers", "Time off", "Who's away", "Documents", "Onboarding & probation", "Policy acknowledgements", "Exports"]) expect(page).toContain(label);
    expect(page).not.toMatch(/report builder|query builder/i);
  });

  it("keeps the management snapshot factual and reuses existing operational data", () => {
    const page = read("app/reports/page.tsx");
    expect(page).toContain("loadControlCentreData");
    expect(page).toContain("Employee files incomplete");
    expect(page).toContain("Policy acknowledgements outstanding");
    expect(page).toContain("not a legal or compliance score");
  });

  it("keeps payroll and full export actions in Reports and removes them from Settings", () => {
    const reports = read("app/reports/page.tsx");
    const exports = read("components/ReportsExports.tsx");
    const setup = read("app/setup/page.tsx");
    expect(reports).toContain("ReportsExports");
    expect(exports).toContain("exportFinanceHandoffAction");
    expect(exports).toContain("exportTenantDataAction");
    expect(setup).not.toContain("exportFinanceHandoffAction");
    expect(setup).not.toContain("exportTenantDataAction");
  });

  it("creates spreadsheet-safe CSV", () => {
    expect(csv([{ person: 'Hugo "H" Salcedo', department: "People, Ops", value: 0, unknown: null }]))
      .toBe('"person","department","value","unknown"\r\n"Hugo ""H"" Salcedo","People, Ops","0",""');
  });

  it("exports human-readable enum values", () => {
    expect(humanCsvValue("full_time")).toBe("Full Time");
    expect(humanCsvValue("awaiting_review")).toBe("Awaiting Review");
    expect(humanCsvValue(null)).toBe("");
  });
});
