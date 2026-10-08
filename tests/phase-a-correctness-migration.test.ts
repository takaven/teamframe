import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

describe("Phase A existing-install migration", () => {
  const migration = read("migrations/20261008_phase_a_correctness.sql");

  it("is transactional, history preserving, and does not replay the schema pack", () => {
    expect(migration.trimStart()).toMatch(/^-- Phase A existing-install migration/);
    expect(migration).toContain("begin;");
    expect(migration).toContain("commit;");
    expect(migration).not.toMatch(/update\s+leave_balance_entries/i);
    expect(migration).not.toMatch(/delete\s+from\s+leave_balance_entries/i);
    expect(migration).not.toMatch(/update\s+probation_reviews\s+set\s+probation_end_date/i);
    expect(migration).not.toMatch(/delete\s+from\s+probation_reviews/i);
    expect(migration).not.toContain("SCHEMA_ORDER");
  });

  it("prevents new dual-strategy leave settings while preserving legacy rows", () => {
    expect(migration).toContain("leave_definitions_single_entitlement_timing_check");
    expect(migration).toContain("not valid");
    expect(migration).toContain("v_eligible_end := least(v_as_of, v_year_end, coalesce(v_employee.end_date, v_as_of))");
    expect(migration).toContain("(v_service_end - v_service_start + 1)::numeric");
    expect(migration).toContain("accrued := least(v_prorated, round(v_monthly_accrued, 2))");
    expect(migration).not.toContain("v_prorated * least(12");
  });

  it("replaces inferred probation with an explicit scheduling path", () => {
    expect(migration).toContain("function teamframe_initialize_join_work");
    expect(migration).toContain("'probation_review_id', null");
    expect(migration).not.toContain("v_base_date + 90");
    expect(migration).toContain("function teamframe_schedule_probation_review");
    expect(migration).toContain("p_probation_end_date date");
  });

  it("retires inferred document signals audibly and idempotently", () => {
    expect(migration).toContain("RULE RETIRED — APPLICABILITY REQUIRES EXPLICIT CONFIRMATION");
    expect(migration).toContain("signal.missing_jurisdiction_requirement.rule_retired");
    expect(migration).toContain("not exists (");
    expect(migration).toContain("a.tenant_id = r.tenant_id");
    expect(migration).toContain("a.risk_signal_id = r.id");
  });
});
