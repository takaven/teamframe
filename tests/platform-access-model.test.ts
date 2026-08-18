import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

describe("Independent customer access and setup architecture", () => {
  it("does not retain the superseded central SaaS / Platform Owner model", () => {
    const schema = read("schemas/access_model.sql");
    const roles = read("lib/rbac/roles.ts");
    const rbac = read("middleware/rbac.ts");
    const appShell = read("components/AppShell.tsx");

    expect(roles).toContain('export type Role = "admin" | "employee"');
    expect(roles).not.toContain("platform_owner");
    expect(rbac).not.toContain("PlatformOwner");
    expect(schema).not.toContain("platform_owners");
    expect(schema).not.toContain("membership_access_rules");
    expect(schema).not.toContain("tenant_access_invitation_rules");
    expect(appShell).not.toContain('href: "/platform"');
    expect(existsSync(join(root, "app/platform/page.tsx"))).toBe(false);
    expect(existsSync(join(root, "components/PlatformMfaClient.tsx"))).toBe(false);
  });

  it("migrates legacy role claims to the approved independent-installation baseline", () => {
    const schema = read("schemas/access_model.sql");
    const roles = read("lib/rbac/roles.ts");

    expect(schema).toContain("then 'full_access'::access_profile");
    expect(schema).toContain("else 'employee'::access_profile");
    expect(roles).toContain('return user.app_metadata?.role === "admin" ? "full_access" : "employee"');
  });

  it("stores a simple effective access matrix instead of a grant/deny engine", () => {
    const schema = read("schemas/access_model.sql");
    const roles = read("lib/rbac/roles.ts");
    const access = read("lib/rbac/access.ts");

    expect(schema).toContain("people_access_scope");
    expect(schema).toContain("salary_access_level");
    expect(schema).toContain("private_documents_scope");
    expect(schema).toContain("finance_exports_access");
    expect(schema).toContain("manage_users_access");
    expect(roles).toContain('"all_except_selected_people"');
    expect(access).toContain("matrixAllows");
    expect(access).toContain("if (actor.currentMembership) return false");
    expect(schema).not.toContain("department_access_scope");
    expect(access).not.toContain("AccessEffect");
    expect(access).not.toContain("grant");
    expect(access).not.toContain("deny");
  });

  it("keeps presets bounded and derives Manager from direct reports only", () => {
    const roles = read("lib/rbac/roles.ts");
    const access = read("lib/rbac/access.ts");
    const schema = read("schemas/access_model.sql");

    expect(roles).toContain('CUSTOMER_ACCESS_PROFILES: readonly AccessProfile[] = ["admin", "finance", "full_access", "employee"]');
    expect(access).toContain('admin: ["people_operations"]');
    expect(access).toContain('finance: ["compensation_view", "finance_payroll_exports"]');
    expect(access).toContain('"company_access_settings"');
    // Manager-derived access grants ONLY people_operations — never compensation_view.
    expect(access).toContain('if (capability !== "people_operations") return false');
    expect(access).not.toContain('capability !== "compensation_view"');
    expect(access).toContain(".eq(\"manager_id\", actor.employeeId)");
    expect(schema).toContain("p_scope = 'direct_reports'");
    expect(schema).toContain("e.manager_id = tm.employee_id");
    // The DB manager-derived branch must not list compensation_view either.
    expect(schema).not.toContain("p_capability in ('people_operations', 'compensation_view')");
    expect(schema).not.toContain("recursive");
  });

  it("protects compensation, private documents, payment data, finance exports and company access", () => {
    const schema = read("schemas/access_model.sql");
    const compensation = read("schemas/compensation.sql");
    const documents = read("services/documentService/index.ts");
    const setup = read("services/companySetupService.ts");
    const accessManagement = read("services/accessManagementService.ts");

    expect(schema).toContain("current_actor_has_capability(tenant_id, 'compensation_view'");
    expect(schema).toContain("create policy compensation_insert_access on compensation");
    expect(schema).toContain("current_actor_has_capability(tenant_id, 'private_employee_documents'");
    expect(schema).toContain("current_actor_has_capability(tenant_id, 'finance_payroll_exports'");
    expect(compensation).toContain("create table if not exists employee_payment_details");
    expect(schema).toContain("employee_payment_details_select");
    expect(schema).toContain("current_actor_has_capability(id, 'company_access_settings'");
    expect(documents).toContain('"private_employee_documents"');
    expect(documents).toContain("canRunFinanceExport");
    expect(setup).toContain('"company_access_settings"');
    expect(accessManagement).toContain("LAST_FULL_ACCESS_REQUIRED");
  });

  it("stages setup-pack users without fake auth identities or accidental sample employees", () => {
    const provisioning = read("services/customerProvisioningService.ts");
    const setupPage = read("app/setup/page.tsx");
    const schema = read("schemas/access_model.sql");

    expect(schema).toContain("create table if not exists tenant_access_invitations");
    expect(provisioning).toContain(".from(\"tenant_access_invitations\")");
    expect(provisioning).toContain("manager reporting cycle");
    expect(provisioning).toContain(".from(\"compensation\").upsert");
    expect(provisioning).toContain("people_access_scope");
    expect(provisioning).not.toContain("tenant_access_invitation_rules");
    expect(provisioning).not.toContain("00000000-0000-0000-0000-000000000000");
    expect(setupPage).not.toContain("Amina Rahman");
    expect(setupPage).not.toContain("Mateo Silva");
  });

  it("captures customer-readiness operational HR data in schema and setup packs", () => {
    const companies = read("schemas/companies.sql");
    const employees = read("schemas/employees.sql");
    const compensation = read("schemas/compensation.sql");
    const provisioning = read("services/customerProvisioningService.ts");
    const leave = read("schemas/transactional_mutations.sql");

    expect(companies).toContain("default_timezone");
    expect(companies).toContain("default_working_days");
    expect(companies).toContain("create table if not exists company_holidays");
    expect(companies).toContain("unique (tenant_id, holiday_date)");
    expect(companies).toContain("employee_number_next");
    expect(employees).toContain("employee_number");
    expect(employees).toContain("preferred_name");
    expect(employees).toContain("working_days_override");
    expect(employees).toContain("annual_leave_entitlement_override");
    expect(employees).toContain("emergency_contact_name");
    expect(compensation).toContain("pay_basis");
    expect(compensation).toContain("create table if not exists employee_payment_details");
    expect(provisioning).toContain("defaultTimezone");
    expect(provisioning).toContain("holidaysCsv");
    expect(provisioning).toContain("accessExceptionsCsv");
    expect(leave).toContain("coalesce(e.working_days_override, c.default_working_days)");
    expect(leave).toContain("company_holidays");
    expect(leave).toContain("ch.holiday_date = leave_day.day::date");
  });

  it("provides a manual company holiday maintenance surface for People Operations", () => {
    const appShell = read("components/AppShell.tsx");
    const page = read("app/company/page.tsx");
    const actions = read("app/company/actions.ts");
    const service = read("services/companyHolidayService.ts");
    const schema = read("schemas/access_model.sql");

    expect(appShell).toContain('href: "/company"');
    expect(page).toContain("Holiday calendar");
    expect(page).toContain("TeamFrame does not infer statutory");
    expect(page).toContain("View year");
    expect(actions).toContain("saveHolidayAction");
    expect(actions).toContain("deleteHolidayAction");
    expect(service).toContain("listCompanyHolidays");
    expect(service).toContain("createCompanyHoliday");
    expect(service).toContain("updateCompanyHoliday");
    expect(service).toContain("deleteCompanyHoliday");
    expect(service).toContain('"HOLIDAY_DATE_DUPLICATE"');
    expect(service).not.toMatch(/government|statutory feed|api\.gov|country.*holiday/i);
    expect(schema).toContain("alter table company_holidays enable row level security");
    expect(schema).toContain("company_holidays_insert_access");
    expect(schema).toContain("current_actor_has_capability(tenant_id, 'people_operations'");
  });

  it("keeps automation local to ordinary installation companies without tenant lifecycle gates", () => {
    const automation = read("services/hrAutomation/index.ts");

    expect(automation).toContain('.from("companies").select("id").is("archived_at", null)');
    expect(automation).not.toContain('.eq("status", "active")');
    expect(automation).not.toContain("suspended");
  });
});
