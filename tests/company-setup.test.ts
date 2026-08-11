import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/supabaseServer", () => ({ createServiceRoleClient: vi.fn() }));
vi.mock("@/services/employeeService", () => ({ createEmployee: vi.fn() }));
vi.mock("@/services/positionService", () => ({ createPosition: vi.fn() }));

import {
  orderPositionsForCreation,
  parseSetupEmployees,
  parseSetupPositions,
} from "@/services/companySetupService";

const root = process.cwd();

function read(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

describe("guided company setup parsing", () => {
  it("parses positions and orders parents before children", () => {
    const positions = parseSetupPositions(`
      Operations Coordinator | Operations | Head of Operations
      Managing Director | Leadership
      Head of Operations | Operations | Managing Director
    `);

    expect(positions).toEqual([
      { title: "Operations Coordinator", department: "Operations", reportsToTitle: "Head of Operations" },
      { title: "Managing Director", department: "Leadership", reportsToTitle: null },
      { title: "Head of Operations", department: "Operations", reportsToTitle: "Managing Director" },
    ]);

    expect(orderPositionsForCreation(positions).map((position) => position.title)).toEqual([
      "Managing Director",
      "Head of Operations",
      "Operations Coordinator",
    ]);
  });

  it("rejects invalid position hierarchy input before creating records", () => {
    expect(() => parseSetupPositions("Head of Operations | Operations | Missing Parent")).toThrow(
      "SETUP_POSITION_PARENT_UNKNOWN",
    );
    expect(() => parseSetupPositions("Head of Operations | Operations | Head of Operations")).toThrow(
      "SETUP_POSITION_PARENT_SELF",
    );
    expect(() =>
      parseSetupPositions("Head of Operations | Operations\nhead of operations | Operations"),
    ).toThrow("SETUP_POSITION_TITLE_DUPLICATE");
  });

  it("parses first employees and rejects duplicate or invalid employee lines", () => {
    expect(
      parseSetupEmployees(`
        Amina Rahman | AMINA.RAHMAN@SETUP.EXAMPLE | Managing Director | Leadership | 2026-08-17
        Mateo Silva | mateo.silva@setup.example | Operations Coordinator | Operations | 2026-08-24
      `),
    ).toEqual([
      {
        fullName: "Amina Rahman",
        email: "amina.rahman@setup.example",
        roleTitle: "Managing Director",
        department: "Leadership",
        startDate: "2026-08-17",
      },
      {
        fullName: "Mateo Silva",
        email: "mateo.silva@setup.example",
        roleTitle: "Operations Coordinator",
        department: "Operations",
        startDate: "2026-08-24",
      },
    ]);

    expect(() =>
      parseSetupEmployees("Amina Rahman | amina@setup.example | Managing Director | Leadership | 17-08-2026"),
    ).toThrow("SETUP_EMPLOYEE_START_DATE_INVALID");
    expect(() =>
      parseSetupEmployees(`
        Amina Rahman | amina@setup.example | Managing Director | Leadership | 2026-08-17
        Amina Other | AMINA@SETUP.EXAMPLE | Finance Manager | Finance | 2026-08-17
      `),
    ).toThrow("SETUP_EMPLOYEE_EMAIL_DUPLICATE");
  });
});

describe("guided company setup source contracts", () => {
  it("adds company setup metadata without enabling public signup", () => {
    const companies = read("schemas/companies.sql");
    const authRules = read("docs/auth-rules.md");
    const setupPage = read("app/setup/page.tsx");

    expect(companies).toContain("country text");
    expect(companies).toContain("annual_leave_default_days integer");
    expect(companies).toContain("setup_completed_at timestamptz");
    expect(authRules).toContain("Guided company setup does not itself authorize public/open self-registration");
    expect(setupPage).toContain("already-provisioned admin");
  });

  it("uses one atomic setup RPC for first employees and positions", () => {
    const service = read("services/companySetupService.ts");
    const appShell = read("components/AppShell.tsx");

    expect(service).toContain('rpc("teamframe_complete_guided_company_setup"');
    expect(service).toContain("p_positions: orderedPositions");
    expect(service).toContain("p_employees: employees");
    expect(service).not.toContain("createEmployee(actor");
    expect(service).not.toContain("createPosition(actor");
    expect(service).toContain("SETUP_ALREADY_COMPLETED");
    expect(appShell).toContain('{ href: "/setup", label: "Setup" }');
  });

  it("keeps company setup completion transactional and audited at the database boundary", () => {
    const migration = read("schemas/transactional_mutations.sql");

    expect(migration).toContain("function teamframe_complete_company_setup");
    expect(migration).toContain("function teamframe_complete_guided_company_setup");
    expect(migration).toContain("teamframe_derive_employee_lifecycle");
    expect(migration).toContain("'incomplete'");
    expect(migration).toContain("jsonb_array_elements(p_employees)");
    expect(migration).toContain("jsonb_array_elements(p_positions)");
    expect(migration).toContain("update companies");
    expect(migration).toContain("company.setup_completed");
    expect(migration).toContain("employee.created");
    expect(migration).toContain("position.employee_assigned");
    expect(migration).toContain("SETUP_ALREADY_COMPLETED");
    expect(migration).toContain("revoke all on function teamframe_complete_company_setup");
    expect(migration).toContain("revoke all on function teamframe_complete_guided_company_setup");
    expect(migration).toContain("grant execute on function teamframe_complete_company_setup");
    expect(migration).toContain("grant execute on function teamframe_complete_guided_company_setup");
  });
});
