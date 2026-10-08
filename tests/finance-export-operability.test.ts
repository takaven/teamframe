import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("Finance export operability", () => {
  it("gives Finance a specific export destination without exposing the Reports suite", () => {
    const shell = read("components/AppShell.tsx");
    const financePage = read("app/reports/exports/page.tsx");
    expect(shell).toContain('href: "/reports/exports", label: "Exports"');
    expect(shell).toContain('hasCapability(actor, "finance_payroll_exports")');
    expect(financePage).toContain('hasCapability(actor, "finance_payroll_exports")');
    expect(financePage).not.toContain("getReports(");
    expect(financePage).toContain('actor.role === "admin" && await hasCapability(actor, "company_access_settings")');
  });

  it("deliberately redirects non-admin users away from general Reports", () => {
    const reports = read("app/reports/page.tsx");
    expect(reports).toContain('if (actor.role !== "admin") redirect("/home")');
    expect(reports).not.toContain('if (actor.role !== "admin") return null');
  });

  it("shows the full data export only when the complete Full Access matrix permits it", () => {
    const reports = read("app/reports/page.tsx");
    expect(reports).toContain('import { canRunFullTenantExport, hasCapability } from "@/lib/rbac/access"');
    expect(reports).toContain("const canFull = canRunFullTenantExport(actor);");
    expect(reports).not.toContain('const canFull = await hasCapability(actor, "company_access_settings");');
  });

  it("keeps payroll export service-authorised", () => {
    const exports = read("services/documentService/index.ts");
    expect(exports).toContain("if (!(await canRunFinanceExport(actor))) throw new Error(\"FORBIDDEN\")");
  });
});
