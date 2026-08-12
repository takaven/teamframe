import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

describe("MR-7 bounded offboarding workflow", () => {
  it("adds the offboarding schema to the canonical install order after lifecycle primitives", () => {
    const order = read("scripts/schema-order.mjs");
    const transactional = order.indexOf('"transactional_mutations.sql"');
    const offboarding = order.indexOf('"offboarding.sql"');

    expect(offboarding).toBeGreaterThan(transactional);
    expect(offboarding).toBeGreaterThan(order.indexOf('"tenancy_rls_v2.sql"'));
  });

  it("models offboarding cases and checklist items without payroll/legal/asset-platform scope", () => {
    const schema = read("schemas/offboarding.sql");

    expect(schema).toContain("create table if not exists offboarding_cases");
    expect(schema).toContain("create table if not exists offboarding_items");
    expect(schema).toContain("effective_end_date date not null");
    expect(schema).toContain("create unique index if not exists offboarding_cases_one_active_idx");
    expect(schema).toContain("'handover_plan'");
    expect(schema).toContain("'final_documents'");
    expect(schema).toContain("'exit_document'");
    expect(schema).not.toMatch(/payroll_calculation|statutory|legal_advice|it_provisioning/i);
  });

  it("starts offboarding atomically through a service-role RPC with default work and automation", () => {
    const schema = read("schemas/offboarding.sql");
    const service = read("services/offboardingService/index.ts");
    const actions = read("app/employees/actions.ts");

    expect(schema).toContain("create or replace function teamframe_start_offboarding");
    expect(schema).toContain("update employees");
    expect(schema).toContain("lifecycle_state = 'offboarding'");
    expect(schema).toContain("'offboarding.item_due'");
    expect(schema).toContain("'offboarding.closure_due'");
    expect(service).toContain('rpc("teamframe_start_offboarding"');
    expect(actions).toContain("await startOffboarding(actor");
    expect(actions).not.toContain("signalEngine.emit");
  });

  it("closes only after end date and required work are complete, then makes the employee former and vacates positions", () => {
    const schema = read("schemas/offboarding.sql");
    const automation = read("services/hrAutomation/index.ts");

    expect(schema).toContain("v_case.effective_end_date > p_as_of");
    expect(schema).toContain("and required");
    expect(schema).toContain("and status = 'pending'");
    expect(schema).toContain("lifecycle_state = 'exited'");
    expect(schema).toContain("deleted_at = coalesce(deleted_at, clock_timestamp())");
    expect(schema).toContain("set assigned_employee_id = null");
    expect(schema).toContain("position.vacated_by_offboarding_completion");
    expect(automation).toContain('item.rule_key === "offboarding.closure_due"');
    expect(automation).toContain("evaluateOffboardingClosureFromAutomation");
  });

  it("keeps evidence-backed exit document completion non-bypassable and synced from MR-5 evidence", () => {
    const schema = read("schemas/offboarding.sql");
    const page = read("app/employees/page.tsx");

    expect(schema).toContain("v_item.completion_mode <> 'manual_confirmation'");
    expect(schema).toContain("raise exception 'EVIDENCE_REQUIRED'");
    expect(schema).toContain("teamframe_sync_offboarding_document_evidence_tasks");
    expect(schema).toContain("document_requirements_sync_offboarding_evidence");
    expect(page).toContain("Needs evidence");
  });

  it("uses MR-3B manager boundaries for handover work without widening manager authority", () => {
    const service = read("services/offboardingService/index.ts");
    const managerService = read("services/managerService/index.ts");
    const managerPage = read("app/manager/page.tsx");

    expect(service).toContain("assertCurrentDirectManager(actor, item.employee_id)");
    expect(service).toContain("listManagerOffboardingItems");
    expect(managerService).toContain("offboardingItems");
    expect(managerPage).toContain("Offboarding handover");
    expect(managerPage).toContain("Only manager-owned handover tasks");
  });

  it("prevents new leave after the effective end date while leaving MR-6 balance rules intact", () => {
    const leaveService = read("services/leaveService/index.ts");
    const offboardingService = read("services/offboardingService/index.ts");

    expect(leaveService).toContain("assertLeaveDoesNotExceedActiveOffboardingEndDate");
    expect(offboardingService).toContain("LEAVE_AFTER_OFFBOARDING_END_DATE");
    expect(leaveService).toContain("LEAVE_PERIOD_CROSSING");
  });

  it("keeps finance handoff bounded to factual exit fields", () => {
    const documents = read("services/documentService/index.ts");

    expect(documents).toContain('"end_date"');
    expect(documents).toContain('"employment_status"');
    expect(documents).toContain('"lifecycle_state"');
    expect(documents).not.toMatch(/gratuity|final_salary|tax_calculation/i);
  });
});
