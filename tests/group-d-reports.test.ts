import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { csv } from "@/lib/reports/csv";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("Group D fixed reports", () => {
  it("adds Reports to admin navigation without exposing it to employee navigation", () => {
    const shell = read("components/AppShell.tsx");
    expect(shell).toContain('{ href: "/reports", label: "Reports" }');
    expect(shell.indexOf('{ href: "/reports"')).toBeLessThan(shell.indexOf("const EMPLOYEE_LINKS"));
  });

  it("ships the eight fixed report destinations and no report builder", () => {
    const page = read("app/reports/page.tsx");
    for (const label of ["Headcount", "Joiners & leavers", "Time off", "Who's away", "Documents", "Onboarding & probation", "Policy acknowledgements", "Exports"]) expect(page).toContain(label);
    expect(page).not.toMatch(/report builder|query builder/i);
  });

  it("keeps payroll and full export actions in Reports and removes them from Settings", () => {
    const reports = read("app/reports/page.tsx");
    const setup = read("app/setup/page.tsx");
    expect(reports).toContain("exportFinanceHandoffAction");
    expect(reports).toContain("exportTenantDataAction");
    expect(setup).not.toContain("exportFinanceHandoffAction");
    expect(setup).not.toContain("exportTenantDataAction");
  });

  it("creates spreadsheet-safe CSV", () => {
    expect(csv([{ person: 'Hugo "H" Salcedo', department: "People, Ops", value: 0, unknown: null }]))
      .toBe('"person","department","value","unknown"\r\n"Hugo ""H"" Salcedo","People, Ops","0",""');
  });
});
