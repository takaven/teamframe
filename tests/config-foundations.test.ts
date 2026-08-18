import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

import {
  ISO_COUNTRIES,
  isIsoAlpha2,
  getCountryName,
  normalizeCountryCode,
} from "@/lib/geo/countries";

const root = process.cwd();
function read(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

const departments = read("schemas/departments.sql");
const workLocations = read("schemas/work_locations.sql");
const leaveDefinitions = read("schemas/leave_definitions.sql");
const leaves = read("schemas/leaves.sql");
const employees = read("schemas/employees.sql");
const earlyEmployment = read("schemas/early_employment.sql");
const companies = read("schemas/companies.sql");
const schemaOrder = read("scripts/schema-order.mjs");

describe("Phase 1 — config foundation tables are additive and tenant-safe", () => {
  it("registers the three new schema files after the tenancy RLS helpers", () => {
    const rlsIdx = schemaOrder.indexOf('"tenancy_rls_v2.sql"');
    for (const file of ['"departments.sql"', '"work_locations.sql"', '"leave_definitions.sql"']) {
      expect(schemaOrder).toContain(file);
      expect(schemaOrder.indexOf(file)).toBeGreaterThan(rlsIdx);
    }
  });

  it("creates each new table idempotently, FK-scoped to companies, with no destructive drops", () => {
    for (const sql of [departments, workLocations, leaveDefinitions]) {
      expect(sql).toMatch(/create table if not exists/);
      expect(sql).toMatch(/references companies\(id\)/);
      expect(sql).not.toMatch(/\bdrop\s+table\b/i);
      expect(sql).not.toMatch(/\bdrop\s+type\b/i);
    }
  });

  it("enables RLS and scopes reads/writes by tenant on every new table", () => {
    const cases: Array<[string, string]> = [
      [departments, "departments"],
      [workLocations, "work_locations"],
      [leaveDefinitions, "leave_definitions"],
    ];
    for (const [sql, table] of cases) {
      expect(sql).toContain(`alter table ${table} enable row level security`);
      // Tenant-scoped SELECT.
      expect(sql).toMatch(new RegExp(`create policy ${table}_select[\\s\\S]+current_actor_tenant_id\\(\\)`));
      // Admin-only write, still tenant-scoped.
      expect(sql).toMatch(
        new RegExp(`create policy ${table}_write_admin[\\s\\S]+is_current_actor_admin\\(\\)[\\s\\S]+current_actor_tenant_id\\(\\)`),
      );
    }
  });

  it("work_locations links to an ISO alpha-2 country and enforces the format", () => {
    expect(workLocations).toMatch(/country char\(2\)/);
    expect(workLocations).toMatch(/country ~ '\^\[A-Z\]\{2\}\$'/);
  });
});

describe("Phase 1 — leave definitions extend config WITHOUT touching the leave engine", () => {
  it("keeps the existing leave_type enum intact (4 system values, not replaced)", () => {
    expect(leaves).toContain("create type leave_type as enum ('annual', 'sick', 'unpaid', 'other')");
    // The config layer must not redefine or drop the enum, nor add/remove enum values.
    expect(leaveDefinitions).not.toMatch(/create type leave_type/i);
    expect(leaveDefinitions).not.toMatch(/alter type leave_type/i);
    expect(leaveDefinitions).not.toMatch(/\bdrop type\b/i);
  });

  it("maps each definition to an underlying system_leave_type (the existing enum)", () => {
    expect(leaveDefinitions).toMatch(/system_leave_type leave_type not null default 'other'/);
  });

  it("carries the founder-required per-type configuration fields", () => {
    expect(leaveDefinitions).toContain("display_name");
    expect(leaveDefinitions).toContain("active boolean not null default true");
    expect(leaveDefinitions).toContain("default_entitlement_days numeric(6,2)"); // nullable: not every type has entitlement
    expect(leaveDefinitions).toMatch(/counting_basis in \('working_days', 'calendar_days'\)/);
    expect(leaveDefinitions).toMatch(/attachment_requirement in \('not_required', 'optional', 'required'\)/);
  });

  it("seeds the four system definitions per company idempotently (backward-compatible)", () => {
    for (const code of ["'annual'", "'sick'", "'unpaid'", "'other'"]) {
      expect(leaveDefinitions).toContain(code);
    }
    // Idempotent seed — never disturbs a customer that has edited its definitions.
    const conflictClauses = leaveDefinitions.match(/on conflict \(tenant_id, code\) do nothing/g) ?? [];
    expect(conflictClauses.length).toBe(4);
    // Respects existing enable flags so behaviour is preserved.
    expect(leaveDefinitions).toMatch(/coalesce\(c\.unpaid_leave_enabled, true\)/);
    expect(leaveDefinitions).toMatch(/coalesce\(c\.other_leave_enabled, true\)/);
  });
});

describe("Phase 1 — additive columns on existing tables", () => {
  it("adds employees.gender (constrained, optional) and employees.company_phone additively", () => {
    expect(employees).toContain("add column if not exists gender text");
    expect(employees).toContain("add column if not exists company_phone text");
    expect(employees).toMatch(/gender in \('male', 'female', 'other', 'prefer_not_to_say'\)/);
    expect(employees).toMatch(/company_phone is null or char_length\(company_phone\)/);
  });

  it("adds probation_reviews.manager_recommended_outcome (Confirmed/Unsuccessful) additively", () => {
    expect(earlyEmployment).toContain("add column if not exists manager_recommended_outcome text");
    expect(earlyEmployment).toMatch(/manager_recommended_outcome is null or manager_recommended_outcome in \('confirmed', 'unsuccessful'\)/);
  });

  it("adds companies.thirty_day_check_in_enabled with a backward-compatible default", () => {
    expect(companies).toContain("thirty_day_check_in_enabled boolean not null default true");
    expect(companies).toContain("add column if not exists thirty_day_check_in_enabled boolean not null default true");
  });
});

describe("Phase 1 — ISO country source of truth", () => {
  it("recognises valid alpha-2 codes case-insensitively, including launch markets", () => {
    expect(isIsoAlpha2("AE")).toBe(true); // UAE
    expect(isIsoAlpha2("mu")).toBe(true); // Mauritius, lowercase
    expect(isIsoAlpha2(" GB ")).toBe(true); // trimmed
  });

  it("rejects non-codes", () => {
    expect(isIsoAlpha2("XX")).toBe(false);
    expect(isIsoAlpha2("")).toBe(false);
    expect(isIsoAlpha2(null)).toBe(false);
    expect(isIsoAlpha2("United Arab Emirates")).toBe(false);
  });

  it("resolves names and normalises input", () => {
    expect(getCountryName("AE")).toBe("United Arab Emirates");
    expect(getCountryName("mu")).toBe("Mauritius");
    expect(getCountryName("zz")).toBeNull();
    expect(normalizeCountryCode("gb")).toBe("GB");
    expect(normalizeCountryCode("nope")).toBeNull();
  });

  it("exposes the full sorted country list", () => {
    expect(ISO_COUNTRIES.length).toBeGreaterThan(200);
    const names = ISO_COUNTRIES.map((c) => c.name);
    const sorted = [...names].sort((a, b) => a.localeCompare(b));
    expect(names).toEqual(sorted);
  });
});
