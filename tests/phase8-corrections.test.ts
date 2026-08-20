import { readFileSync } from "node:fs";
import { access } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (p: string): string => readFileSync(path.join(root, p), "utf8");
const expectFile = async (p: string) => expect(access(path.join(root, p))).resolves.toBeUndefined();

describe("Phase 8 — consolidated founder correction pass", () => {
  it("ships the additive schema (logo, compensation mode, department integrity, compensation config)", () => {
    const sql = read("schemas/phase8_corrections.sql");
    expect(sql).toContain("add column if not exists logo_path");
    expect(sql).toContain("add column if not exists compensation_mode");
    expect(sql).toContain("add column if not exists department_id");
    expect(sql).toContain("create table if not exists compensation_components");
    expect(sql).toContain("create table if not exists compensation_component_amounts");
    expect(sql).toContain("create table if not exists compensation_history");
    // department_id stays resolved from the department name on every employee/position write.
    expect(sql).toContain("employees_set_department_id");
    expect(sql).toContain("positions_set_department_id");
  });

  it("registers the phase-8 schema in the apply order", () => {
    expect(read("scripts/schema-order.mjs")).toContain("phase8_corrections.sql");
  });

  it("keeps salary tables gated by the compensation capability (never admin-only, never org-chart)", () => {
    const sql = read("schemas/phase8_corrections.sql");
    expect(sql).toContain("current_actor_has_capability(tenant_id, 'compensation_view'::access_capability, employee_id)");
    expect(sql).toContain("current_actor_has_capability(tenant_id, 'compensation_manage'::access_capability, employee_id)");
  });

  it("locks compensation scope to storage only (no payroll/tax/payslips/WPS)", () => {
    for (const file of ["services/compensationService.ts", "services/configurationService.ts"]) {
      const src = read(file);
      expect(src).toMatch(/payroll/i);
      expect(src).toMatch(/payslip/i);
      expect(src).toMatch(/WPS/);
    }
  });

  it("provides the shared UI primitives introduced for the pass", async () => {
    await Promise.all([
      "components/FileInput.tsx",
      "components/SectionTabs.tsx",
      "components/Tabs.tsx",
      "components/CompensationPanel.tsx",
      "components/OverviewQueue.tsx",
      "components/EmployeeAvatar.tsx",
      "components/TakavenEndorsement.tsx",
      "lib/company/identity.ts",
      "public/brand/teamframe-by-takaven-primary.svg",
      "public/brand/teamframe-by-takaven-reversed.svg",
    ].map(expectFile));
  });

  it("redirects friendly aliases to canonical routes", () => {
    const cfg = read("next.config.ts");
    expect(cfg).toContain('source: "/overview"');
    expect(cfg).toContain('destination: "/dashboard"');
    expect(cfg).toContain('source: "/login"');
    expect(cfg).toContain('destination: "/auth"');
  });

  it("shows the customer company identity in the shell and drops the generic TeamFrame workspace label", () => {
    const shell = read("components/AppShell.tsx");
    expect(shell).toContain("getCompanyIdentity");
    expect(shell).toContain("identity.name");
    expect(shell).not.toContain("TeamFrame workspace");
    // Redesign brand hierarchy: TeamFrame product identity at top, customer workspace context,
    // quiet TAKAVEN endorsement at the bottom.
    expect(shell).toContain("Workspace");
    expect(shell).toContain("Conceptualised by");
  });

  it("keeps the developer-narration 'Admin queue' eyebrow out of customer pages", () => {
    for (const p of ["app/employees/page.tsx", "app/onboarding/page.tsx", "app/policies/page.tsx"]) {
      expect(read(p)).not.toContain("Admin queue");
    }
  });
});
