import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(join(process.cwd(), "schemas", "tenant_integrity.sql"), "utf8");
const schemaOrder = readFileSync(join(process.cwd(), "scripts", "schema-order.mjs"), "utf8");
const verifyInstall = readFileSync(join(process.cwd(), "scripts", "verify-install.mjs"), "utf8");

const requiredPreflights = [
  "documents.employee_id",
  "leaves.employee_id",
  "onboarding_tasks.employee_id",
  "compensation.employee_id",
  "employee_profiles.employee_id",
  "risk_signals.subject_employee_id",
  "risk_signals.subject_document_id",
  "action_items.risk_signal_id",
  "action_items.subject_employee_id",
];

const requiredCompositeConstraints = [
  "documents_tenant_employee_fk",
  "leaves_tenant_employee_fk",
  "onboarding_tasks_tenant_employee_fk",
  "compensation_tenant_employee_fk",
  "employee_profiles_tenant_employee_fk",
  "risk_signals_tenant_employee_fk",
  "risk_signals_tenant_document_fk",
  "action_items_tenant_risk_signal_fk",
  "action_items_tenant_employee_fk",
];

describe("tenant integrity migration", () => {
  it("runs after tenant-owned tables and before RLS policies", () => {
    expect(schemaOrder.indexOf('"acknowledgements.sql"')).toBeLessThan(
      schemaOrder.indexOf('"tenant_integrity.sql"'),
    );
    expect(schemaOrder.indexOf('"tenant_integrity.sql"')).toBeLessThan(
      schemaOrder.indexOf('"tenancy_rls.sql"'),
    );
  });

  it("fails before adding constraints when dirty cross-tenant data exists", () => {
    for (const edge of requiredPreflights) {
      expect(migration).toContain(`tenant_integrity preflight failed: ${edge}`);
    }
    expect(migration).not.toMatch(/\bdelete\s+from\b/i);
    expect(migration).not.toMatch(/\bset\s+tenant_id\s*=/i);
  });

  it("adds composite tenant foreign keys for tenant-owned relationships", () => {
    for (const constraint of requiredCompositeConstraints) {
      expect(migration).toContain(`constraint ${constraint}`);
      expect(migration).toMatch(
        new RegExp(`constraint ${constraint}[\\s\\S]+foreign key \\(tenant_id,`),
      );
    }
  });

  it("adds tenant identity unique constraints idempotently", () => {
    expect(migration).toContain("conname = 'documents_tenant_id_id_key'");
    expect(migration).toContain("conname = 'risk_signals_tenant_id_id_key'");
    expect(migration).toContain("exception when duplicate_object then null; when duplicate_table then null");
  });

  it("keeps non-table migrations out of install table checks", () => {
    expect(verifyInstall).toContain('"tenant_integrity.sql"');
    expect(verifyInstall).toContain("NON_TABLE_MIGRATIONS");
    expect(verifyInstall).toContain('"file_lifecycle.sql": ["file_operations", "export_files"]');
  });
});
