import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");

const config = read("services/configurationService.ts");
const setupPage = read("app/setup/page.tsx");
const setupActions = read("app/setup/actions.ts");
const appShell = read("components/AppShell.tsx");

describe("Phase 3 — Setup / Administration configuration", () => {
  it("provides admin-only, tenant-scoped CRUD for the configured lists", () => {
    for (const fn of ["createDepartment", "renameDepartment", "setDepartmentActive", "createWorkLocation", "updateWorkLocation", "createLeaveDefinition", "updateLeaveDefinition", "updateCompanySettings"]) {
      expect(config).toContain(`export async function ${fn}`);
    }
    // Every write requires admin + tenant scoping.
    const requireAdminCount = (config.match(/requireAdmin\(actor\)/g) ?? []).length;
    expect(requireAdminCount).toBeGreaterThanOrEqual(8);
    expect((config.match(/requireTenant\(actor\)/g) ?? []).length).toBeGreaterThanOrEqual(8);
  });

  it("validates country against the ISO source and deactivates (never destructively deletes) departments", () => {
    expect(config).toContain("normalizeCountryCode");
    expect(config).toContain("INVALID_COUNTRY");
    expect(config).toContain("setDepartmentActive"); // deactivate/reactivate, no hard delete of referenced departments
    expect(config).not.toMatch(/\.from\("departments"\)\.delete\(\)/);
  });

  it("keeps the leave engine intact — definitions are additive config, no enum/engine mutation", () => {
    expect(config).toContain("system_leave_type"); // routes to existing enum category
    expect(config).not.toMatch(/alter type leave_type/i);
    expect(config).not.toMatch(/teamframe_calculate_leave_days/);
  });

  it("Setup hub covers all sections and drops the bootstrap anti-patterns", () => {
    for (const s of ["Company", "Departments", "Work locations", "Working days", "Holidays", "Leave", "30-day check-in", "Users & Access"]) {
      expect(setupPage).toContain(s);
    }
    expect(setupPage).toContain("admin-only");
    expect(setupPage).not.toContain("Initial organisation structure");
    expect(setupPage).not.toContain("First employees");
    expect(setupActions).not.toContain("completeGuidedSetupAction");
  });

  it("navigation re-homes Company and Access under Setup (removed from primary admin nav)", () => {
    expect(appShell).toContain('{ href: "/setup", label: "Setup" }');
    expect(appShell).not.toContain('{ href: "/company", label: "Company" }');
    expect(appShell).not.toContain('{ href: "/access", label: "Access" }');
    // Setup entry-point leads with presets and re-homes access + holidays.
    expect(setupPage).toContain('href="/access"');
    expect(setupPage).toContain('href="/company"');
    expect(setupPage).toContain("Full Access");
  });
});
