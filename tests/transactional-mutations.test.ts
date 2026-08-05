import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(join(process.cwd(), "schemas", "transactional_mutations.sql"), "utf8");
const employeeService = readFileSync(join(process.cwd(), "services", "employeeService", "index.ts"), "utf8");
const leaveService = readFileSync(join(process.cwd(), "services", "leaveService", "index.ts"), "utf8");
const schemaOrder = readFileSync(join(process.cwd(), "scripts", "schema-order.mjs"), "utf8");

const expectedFunctions = [
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
    for (const fn of expectedFunctions) {
      const start = migration.indexOf(`function ${fn}`);
      expect(start, `${fn} exists`).toBeGreaterThanOrEqual(0);
      const nextFunction = migration.indexOf("create or replace function", start + 1);
      const body = migration.slice(start, nextFunction === -1 ? undefined : nextFunction);
      expect(body).toContain("insert into audit_logs");
      expect(body).toMatch(/return(?:ing)? \* into v_/i);
    }
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
    for (const fn of expectedFunctions) {
      expect(migration).toContain(`revoke all on function ${fn}`);
      expect(migration).toContain("from public, anon, authenticated");
      expect(migration).toContain(`grant execute on function ${fn}`);
      expect(migration).toContain("to service_role");
    }
  });
});
