import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { computeDueDate, dueOffsetLabel } from "@/services/onboardingService/templates";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("persistent onboarding checklist closure", () => {
  it("computes bounded before/start/after dates and human labels", () => {
    expect(computeDueDate("2026-10-15", -7)).toBe("2026-10-08");
    expect(computeDueDate("2026-10-15", 0)).toBe("2026-10-15");
    expect(computeDueDate("2026-10-15", 30)).toBe("2026-11-14");
    expect(dueOffsetLabel(-7)).toBe("7 days before start");
    expect(dueOffsetLabel(0)).toBe("Day 1");
  });

  it("enforces tenant ownership, one active default and settings capability", () => {
    const schema = read("schemas/20260924_onboarding_checklists.sql");
    expect(schema).toContain("onboarding_checklist_templates_one_default");
    expect(schema).toContain("where active and is_default");
    expect(schema).toContain("current_actor_tenant_id()");
    expect(schema).toContain("'company_access_settings'::access_capability");
    expect(schema).toContain("due_offset_days between -90 and 365");
  });

  it("copies blueprints into ordinary tasks without linking historical assignments", () => {
    const service = read("services/onboardingService/checklistTemplates.ts");
    expect(service).toContain('rpc("teamframe_assign_default_onboarding_checklist"');
    const schema = read("schemas/20260924_onboarding_checklists.sql");
    expect(schema).toContain("onboarding_checklist_assignments");
    expect(schema).toContain("unique (tenant_id, employee_id)");
    expect(schema).toContain("onboarding_tasks_checklist_assignment_fk");
    expect(schema).toContain("foreign key (tenant_id, source_checklist_assignment_id)");
    expect(schema).toContain("if v_assignment_id is null then return 0");
    expect(schema).toMatch(/delete from onboarding_tasks[\s\S]*source_checklist_assignment_id is null[\s\S]*Sign your employment contract/i);
    expect(schema).toContain("source_checklist_assignment_id");
  });

  it("integrates the default once in Add Person and HirePass paths", () => {
    expect(read("app/employees/actions.ts")).toContain("await assignDefaultChecklist(actor, created.id)");
    expect(read("services/hirePeopleHandoff.ts")).toContain("await assignDefaultChecklist(actor, employeeId)");
  });

  it("keeps starter packs as copyable sources, not a second editable model", () => {
    const settings = read("app/setup/page.tsx");
    expect(settings).toContain("Copy ${pack.name}");
    expect(settings).toContain("listChecklistTemplates(actor)");
    expect(settings).not.toContain("persistent template editing requires");
  });
});
