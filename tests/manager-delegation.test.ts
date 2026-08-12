import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

describe("MR-3B bounded manager delegation", () => {
  it("derives manager authority from reporting truth without introducing a manager RBAC role", () => {
    const rbac = read("middleware/rbac.ts");
    const roles = read("lib/rbac/roles.ts");
    const appShell = read("components/AppShell.tsx");
    const managerAuth = read("services/managerAuthorization.ts");

    expect(roles).toContain('export type Role = "admin" | "employee"');
    expect(roles).toContain('export const ROLES: readonly Role[] = ["admin", "employee"]');
    expect(rbac).not.toContain('"manager"');
    expect(roles).not.toContain('"manager"');
    expect(appShell).not.toContain('href: "/manager"');
    expect(managerAuth).toContain("actor.employeeId");
    expect(managerAuth).toContain("projectEmployeeLifecycle(row) === \"ACTIVE\"");
    expect(managerAuth).toContain(".eq(\"manager_id\", manager.id)");
    expect(managerAuth).toContain("projectEmployeeLifecycle(row) !== \"FORMER\"");
  });

  it("exposes manager work only from self-service when direct-report work exists", () => {
    const mePage = read("app/me/page.tsx");
    const managerPage = read("app/manager/page.tsx");

    expect(mePage).toContain("getOptionalManagerDashboard");
    expect(mePage).toContain("managerDashboard.directReports.length > 0");
    expect(mePage).toContain('href="/manager"');
    expect(managerPage).toContain("No manager work is assigned to you.");
    expect(managerPage).toContain("Admin HR records, documents, policies and organisation changes remain restricted.");
  });

  it("allows direct-report leave decisions while forbidding manager balance overrides", () => {
    const leaveService = read("services/leaveService/index.ts");
    const managerPage = read("app/manager/page.tsx");
    const mutations = read("schemas/transactional_mutations.sql");

    expect(leaveService).toContain("listPendingLeavesForManager");
    expect(leaveService).toContain("decideLeaveRequestAsManager");
    expect(leaveService).toContain("assertCurrentDirectManager(actor, pendingLeave.employee_id)");
    expect(leaveService).toContain("MANAGER_LEAVE_OVERRIDE_FORBIDDEN");
    expect(leaveService).toContain("p_override_insufficient_balance: false");
    expect(managerPage).not.toContain("overrideInsufficientBalance");
    expect(managerPage).toContain("Manager override is not available");
    expect(mutations).toContain("'leave.approval_due'");
    expect(mutations).toContain("v_employee.manager_id");
  });

  it("limits manager-owned onboarding completion to manual tasks and current direct reports", () => {
    const onboardingSchema = read("schemas/onboarding_tasks.sql");
    const onboardingService = read("services/onboardingService/index.ts");
    const onboardingActions = read("app/onboarding/actions.ts");
    const earlyEmployment = read("schemas/early_employment.sql");

    expect(onboardingSchema).toContain("create type onboarding_task_owner_role as enum ('employee', 'manager', 'admin', 'system')");
    expect(onboardingSchema).toContain("onboarding_tasks_tenant_owner_employee_fk");
    expect(onboardingService).toContain("completeManagerOnboardingTask");
    expect(onboardingService).toContain(".eq(\"owner_role\", \"manager\")");
    expect(onboardingService).toContain("assertCurrentDirectManager(actor, existing.employee_id)");
    expect(onboardingService).toContain('throw new Error("EVIDENCE_REQUIRED")');
    expect(onboardingService).toContain("runAutomationItem");
    expect(onboardingActions).toContain("owner_role");
    expect(earlyEmployment).toContain("if v_employee.manager_id is not null then");
    expect(earlyEmployment).toContain("'onboarding.manager_task_due'");
  });

  it("captures manager probation input without granting probation outcome authority", () => {
    const earlySchema = read("schemas/early_employment.sql");
    const earlyService = read("services/earlyEmploymentService/index.ts");
    const managerActions = read("app/manager/actions.ts");
    const managerPage = read("app/manager/page.tsx");

    expect(earlySchema).toContain("manager_input text");
    expect(earlySchema).toContain("manager_input_automation_item_id");
    expect(earlySchema).toContain("'probation.manager_input_due'");
    expect(earlyService).toContain("submitManagerProbationInput");
    expect(earlyService).toContain("assertCurrentDirectManager(actor, review.employee_id)");
    expect(earlyService).toContain("probation.manager_input_submitted");
    expect(managerActions).toContain("submitManagerProbationInputAction");
    expect(managerPage).toContain("Input only. Admin records the final probation outcome.");
    expect(managerActions).not.toContain("completeProbationReview");
  });

  it("keeps manager delegation out of documents, policies, organisation and employment-change administration", () => {
    const documentService = read("services/documentService/index.ts");
    const policyService = read("services/policyService/index.ts");
    const orgPage = read("app/org-chart/page.tsx");
    const employmentChanges = read("services/employmentChangeService/index.ts");
    const managerService = read("services/managerService/index.ts");

    expect(documentService).toContain("requireAdmin(actor)");
    expect(policyService).toContain("requireAdmin(actor)");
    expect(orgPage).not.toContain("/manager");
    expect(employmentChanges).toContain("requireAdmin(actor)");
    expect(managerService).toContain("pendingLeaves");
    expect(managerService).toContain("onboardingTasks");
    expect(managerService).toContain("probationReviews");
    expect(managerService).not.toContain("document");
    expect(managerService).not.toContain("policy");
    expect(managerService).not.toContain("employmentChange");
  });

  it("transfers or suppresses manager-owned operational work when reporting truth changes", () => {
    const employmentChangesSchema = read("schemas/employment_changes.sql");
    const archiveMutation = read("schemas/transactional_mutations.sql");

    expect(employmentChangesSchema).toContain("else (v_change.new_values ->> 'manager_id')::uuid");
    expect(employmentChangesSchema).toContain("subject_type = 'leave'");
    expect(employmentChangesSchema).toContain("subject_type = 'onboarding_task'");
    expect(employmentChangesSchema).toContain("rule_key = 'probation.manager_input_due'");
    expect(archiveMutation).toContain("owner_employee_id = null");
    expect(archiveMutation).toContain("owner_employee_id = p_employee_id");
  });
});
