import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(join(process.cwd(), "schemas", "transactional_mutations.sql"), "utf8");
const employeeService = readFileSync(join(process.cwd(), "services", "employeeService", "index.ts"), "utf8");
const leaveService = readFileSync(join(process.cwd(), "services", "leaveService", "index.ts"), "utf8");
const schemaOrder = readFileSync(join(process.cwd(), "scripts", "schema-order.mjs"), "utf8");

const expectedFunctions = [
  "teamframe_derive_employee_lifecycle",
  "teamframe_complete_company_setup",
  "teamframe_create_employee",
  "teamframe_update_employee",
  "teamframe_archive_employee",
  "teamframe_submit_leave",
  "teamframe_decide_leave",
];

describe("transactional mutation RPCs", () => {
  it("are included after tenant integrity and before RLS policies", () => {
    expect(schemaOrder.indexOf('"tenant_integrity.sql"')).toBeLessThan(
      schemaOrder.indexOf('"transactional_mutations.sql"'),
    );
    expect(schemaOrder.indexOf('"transactional_mutations.sql"')).toBeLessThan(
      schemaOrder.indexOf('"tenancy_rls.sql"'),
    );
  });

  it("write audit rows inside the same database function as the mutation", () => {
    for (const fn of expectedFunctions.filter((name) => name !== "teamframe_derive_employee_lifecycle")) {
      const start = migration.indexOf(`function ${fn}`);
      expect(start, `${fn} exists`).toBeGreaterThanOrEqual(0);
      const nextFunction = migration.indexOf("create or replace function", start + 1);
      const body = migration.slice(start, nextFunction === -1 ? undefined : nextFunction);
      expect(body).toContain("insert into audit_logs");
      expect(body).toMatch(/return(?:ing)? \* into v_/i);
    }
  });

  it("derives employee lifecycle at the transactional write boundary", () => {
    expect(migration).toContain("function teamframe_derive_employee_lifecycle");
    expect(migration).toContain("p_status = 'inactive'");
    expect(migration).toContain("p_requested_lifecycle = 'exited'");
    expect(migration).toContain("p_setup_status <> 'active'");
    expect(migration).toContain("p_start_date is not null and p_start_date > current_date");
    expect(migration).not.toContain("p_status = 'on_leave'");
    expect(migration).not.toContain("return 'on_leave'");
    expect(migration).toContain("teamframe_derive_employee_lifecycle(p_status, p_setup_status, p_start_date, p_end_date, null)");
    expect(migration).toContain("lifecycle_state = teamframe_derive_employee_lifecycle");
  });

  it("archives employees into former state and vacates occupied positions", () => {
    const start = migration.indexOf("function teamframe_archive_employee");
    const nextFunction = migration.indexOf("create or replace function", start + 1);
    const body = migration.slice(start, nextFunction === -1 ? undefined : nextFunction);

    expect(body).toContain("status = 'inactive'");
    expect(body).toContain("lifecycle_state = 'exited'");
    expect(body).toContain("teamframe_timestamp_matches(updated_at, p_expected_updated_at)");
    expect(body).toContain("update positions");
    expect(body).toContain("set assigned_employee_id = null");
    expect(body).toContain("position.vacated_by_employee_archive");
  });

  it("prevents non-eligible employees from submitting leave in the RPC", () => {
    const start = migration.indexOf("function teamframe_submit_leave");
    const nextFunction = migration.indexOf("create or replace function", start + 1);
    const body = migration.slice(start, nextFunction === -1 ? undefined : nextFunction);

    expect(body).toContain("teamframe_derive_employee_lifecycle");
    expect(body).toContain("not in ('active', 'offboarding')");
    expect(body).toContain("LEAVE_EMPLOYEE_NOT_ELIGIBLE");
  });

  it("routes employee and leave database mutations through RPCs", () => {
    for (const fn of [
      "teamframe_create_employee",
      "teamframe_update_employee",
      "teamframe_archive_employee",
    ]) {
      expect(employeeService).toContain(`.rpc("${fn}"`);
    }
    expect(employeeService).not.toMatch(/from\("employees"\)\s*\n\s*\.update\(\{ deleted_at/i);

    for (const fn of ["teamframe_submit_leave", "teamframe_decide_leave"]) {
      expect(leaveService).toContain(`.rpc("${fn}"`);
    }
    expect(leaveService).not.toMatch(/from\("leaves"\)\s*\n\s*\.insert\(/);
    expect(leaveService).not.toMatch(/from\("leaves"\)\s*\n\s*\.update\(/);
  });

  it("does not expose transactional RPCs to browser-facing database roles", () => {
    expect(migration).toContain("revoke all on function teamframe_timestamp_matches");
    expect(migration).toContain("grant execute on function teamframe_timestamp_matches");

    for (const fn of expectedFunctions) {
      expect(migration).toContain(`revoke all on function ${fn}`);
      expect(migration).toContain("from public, anon, authenticated");
      expect(migration).toContain(`grant execute on function ${fn}`);
      expect(migration).toContain("to service_role");
    }
  });
});
