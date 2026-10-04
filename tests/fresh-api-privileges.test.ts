import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("fresh API privilege contract", () => {
  it("grants only the 48 named TeamFrame tables to the server-only service role", () => {
    const sql = read("schemas/api_privileges.sql");
    const executableSql = sql.replace(/^--.*$/gm, "");
    const names = [...sql.matchAll(/public\.([a-z_]+)/g)].map((match) => match[1]);
    expect(names).toHaveLength(48);
    expect(new Set(names).size).toBe(48);
    expect(names).toContain("companies");
    expect(names).toContain("tenant_memberships");
    expect(names).toContain("setup_import_batches");
    expect(names).toContain("custom_field_definitions");
    expect(names).toContain("custom_field_values");
    expect(sql).toMatch(/grant select, insert, update, delete on table[\s\S]+to service_role;/);
    expect(executableSql).not.toMatch(/grant\b[^;]*\bto\s+anon\b/i);
    expect(sql).toMatch(/revoke\s+all\s+privileges\s+on\s+all\s+tables\s+in\s+schema\s+public\s+from\s+anon/i);
    expect(sql).toMatch(/alter\s+default\s+privileges\s+in\s+schema\s+public\s+revoke\s+all\s+privileges\s+on\s+tables\s+from\s+anon/i);
    expect(sql).not.toMatch(/disable row level security|bypassrls/i);
  });

  it("applies grants after all table creators and verifies service access", () => {
    const order = read("scripts/schema-order.mjs");
    expect(order.indexOf('"api_privileges.sql"')).toBeGreaterThan(order.indexOf('"phase8_corrections.sql"'));
    const installer = read("scripts/apply-schemas-fresh.mjs");
    expect(installer).toContain("privileges.service_tables !== installedTables.length");
    expect(installer).toContain("privileges.anon_tables !== 0");
    expect(installer).toContain("has_table_privilege('service_role'");
  });

  it("keeps the employee projection invoker-scoped and closed to authenticated", () => {
    const sql = read("schemas/employees.sql");
    expect(sql).toMatch(/create or replace view employees_public with \(security_invoker = true\) as/i);
    expect(sql).toMatch(/revoke all on table employees_public from authenticated;/i);
    expect(sql).toMatch(/grant select on table employees_public to service_role;/i);
    expect(sql).not.toMatch(/grant\s+select\s+on\s+(?:table\s+)?employees_public\s+to\s+authenticated/i);

    const order = read("scripts/schema-order.mjs");
    const viewIndex = order.indexOf('"employees.sql"');
    expect(viewIndex).toBeGreaterThanOrEqual(0);
    const laterFiles = [...order.slice(viewIndex + '"employees.sql"'.length).matchAll(/^\s*"([a-z0-9_-]+\.sql)",?$/gm)]
      .map((match) => match[1]);
    for (const file of laterFiles) {
      expect(read(`schemas/${file}`), file).not.toMatch(/grant\s+select\s+on\s+(?:table\s+)?(?:public\.)?employees_public\s+to\s+authenticated/i);
    }
  });
});
