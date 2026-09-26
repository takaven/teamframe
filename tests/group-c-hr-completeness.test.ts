import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("Group C HR completeness", () => {
  it("keeps admin personal edits tenant-scoped and separately audited", () => {
    const service = read("services/selfServiceService.ts");
    expect(service).toContain("updateEmployeePersonalProfile");
    expect(service).toContain('.eq("tenant_id", tenantId)');
    expect(service).toContain("employee.personal_profile_updated");
  });

  it("provides a privacy-safe employee colleague directory", () => {
    const service = read("services/employeeService/index.ts");
    const page = read("app/directory/page.tsx");
    expect(service).toContain("listColleagueDirectory");
    expect(page).toContain("Work email");
    expect(page).not.toMatch(/salary|bank|private document/i);
  });

  it("uses isolated tenant-scoped custom-field tables with typed values", () => {
    const migration = read("schemas/20260924_custom_fields.sql");
    const service = read("services/customFieldService.ts");
    expect(migration).toContain("custom_field_definitions");
    expect(migration).toContain("custom_field_values");
    expect(migration).toContain("enable row level security");
    expect(service).toContain('definition.field_type === "number"');
    expect(service).toContain('definition.field_type === "single_select"');
    expect(service).toContain('.eq("tenant_id", tenant(actor))');
  });

  it("keeps CSV import preview-confirm and reuses the existing employee creation path", () => {
    const form = read("app/people/import/ImportForm.tsx");
    const action = read("app/people/import/actions.ts");
    expect(form).toContain("preview.rows");
    expect(form).toContain('type="file"');
    expect(form).toContain("readAsText");
    expect(form).toContain("manager_email");
    expect(action).toContain("createEmployee(actor");
    expect(action).toContain("applyImportedEmployeeIdentity");
    expect(action).toContain(".max(200)");
  });

  it("limits the manager calendar to current direct reports and approved leave", () => {
    const service = read("services/managerService/index.ts");
    expect(service).toContain("listCurrentDirectReports(actor)");
    expect(service).toContain('.in("employee_id", reportIds)');
    expect(service).toContain('.eq("status", "approved")');
    expect(read("app/manager/page.tsx")).toContain("Team calendar &amp; upcoming");
  });

  it("presents one New policy entry point while preserving both supported content paths", () => {
    const page = read("app/policies/page.tsx");
    expect(page).toContain('"Create a policy"');
    expect(page).toContain("uploadPolicyAction");
    expect(page).toContain("createPolicyAction");
  });
});
