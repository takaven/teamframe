import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");

const svc = read("services/selfServiceService.ts");
const meActions = read("app/me/actions.ts");
const shell = read("components/AppShell.tsx");
const early = read("services/earlyEmploymentService/index.ts");

describe("Phase 4 — employee self-service security", () => {
  it("derives the employee from the authenticated actor, never from the client", () => {
    expect(svc).toContain("actor.employeeId");
    expect(svc).toContain('.eq("id", employeeId)'); // update scoped to own id
    expect(svc).toContain('.eq("tenant_id", tenantId)'); // tenant-scoped
    // The service never reads an employee id from arbitrary input, and the actions never
    // send one.
    expect(svc).not.toContain("input.employee_id");
    expect(meActions).not.toContain('get("employee_id")');
  });

  it("whitelists only employee-owned fields; employer-controlled fields are not writable", () => {
    // Editable keys present.
    expect(svc).toContain("preferred_name:");
    expect(svc).toContain("emergency_contact_name:");
    expect(svc).toContain("account_number_iban:");
    // Employer-controlled keys are NOT part of any self-service schema.
    for (const forbidden of ["full_name:", "employee_number:", "role_title:", "company_phone:", "start_date:", "base_salary:"]) {
      expect(svc).not.toContain(forbidden);
    }
  });

  it("audits self-service mutations and does not broaden generic RLS", () => {
    expect(svc).toContain("audit_logs");
    expect(svc).toContain("employee.self_profile_updated");
    expect(svc).toContain("employee.self_payment_updated");
    // No RLS/policy changes in this service (bounded server-side path only).
    expect(svc).not.toMatch(/create policy|alter table .* enable row level/i);
  });

  it("manager probation recommendation supports Confirmed/Unsuccessful (recommendation, not final outcome)", () => {
    expect(early).toContain("manager_recommended_outcome");
    expect(early).toContain("recommendedOutcome");
    expect(early).toMatch(/enum\(\["confirmed", "unsuccessful"\]\)/);
  });

  it("employee nav drops standalone Documents/Policies; My Team is manager-derived", () => {
    expect(shell).not.toContain('{ href: "/me#documents", label: "Documents" }');
    expect(shell).not.toContain('{ href: "/me#policies", label: "Policies" }');
    expect(shell).toContain('label: "My Team"');
    expect(shell).toContain("hasDirectReports");
  });
});
