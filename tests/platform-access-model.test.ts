import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

describe("Platform access and setup architecture", () => {
  it("models Platform Owner outside customer employee and membership identity", () => {
    const schema = read("schemas/access_model.sql");
    const roles = read("lib/rbac/roles.ts");
    const provision = read("scripts/provision-platform-owner.mjs");

    expect(schema).toContain("create table if not exists platform_owners");
    expect(schema).toContain("create table if not exists platform_owner_transfer_requests");
    expect(roles).toContain('role: "platform_owner"');
    expect(roles).toContain("employeeId: null");
    expect(roles).toContain('accessProfile: "platform_owner"');
    expect(provision).toContain("platform_owners");
    expect(provision).not.toContain(".from(\"employees\")");
    expect(provision).not.toContain(".from(\"tenant_memberships\")");
  });

  it("supports Platform Owner handover without direct database editing", () => {
    const service = read("services/platformOwnerService.ts");
    const page = read("app/platform/transfer/page.tsx");

    expect(service).toContain("nominatePlatformOwnerTransfer");
    expect(service).toContain("acceptPlatformOwnerTransfer");
    expect(service).toContain("LAST_PLATFORM_OWNER_REQUIRED");
    expect(page).toContain("Accept handover");
  });

  it("migrates legacy role claims to the approved access baseline", () => {
    const schema = read("schemas/access_model.sql");
    const roles = read("lib/rbac/roles.ts");

    expect(schema).toContain("then 'full_access'::access_profile");
    expect(schema).toContain("else 'employee'::access_profile");
    expect(roles).toContain('return user.app_metadata?.role === "admin" ? "full_access" : "employee"');
  });

  it("keeps profiles as capability presets and derives Own Team from direct reports only", () => {
    const access = read("lib/rbac/access.ts");
    const schema = read("schemas/access_model.sql");

    expect(access).toContain("PROFILE_CAPABILITIES");
    expect(access).toContain('admin: ["people_operations"]');
    expect(access).toContain('finance: ["compensation_view", "finance_payroll_exports"]');
    expect(access).toContain('"company_access_settings"');
    expect(access).toContain('if (capability !== "people_operations" && capability !== "compensation_view") return false');
    expect(access).toContain(".eq(\"manager_id\", actor.employeeId)");
    expect(schema).toContain("mar.scope = 'own_team'");
    expect(schema).toContain("e.manager_id = tm.employee_id");
    expect(schema).toContain("p_capability in ('people_operations', 'compensation_view')");
    expect(schema).not.toContain("recursive");
  });

  it("protects compensation, private documents, finance exports and company settings with capabilities", () => {
    const schema = read("schemas/access_model.sql");
    const documents = read("services/documentService/index.ts");
    const setup = read("services/companySetupService.ts");

    expect(schema).toContain("current_actor_has_capability(tenant_id, 'compensation_view'");
    expect(schema).toContain("create policy compensation_insert_access on compensation");
    expect(schema).not.toContain("create policy compensation_write_access on compensation\nfor all");
    expect(schema).toContain("current_actor_has_capability(tenant_id, 'private_employee_documents'");
    expect(schema).toContain("current_actor_has_capability(tenant_id, 'finance_payroll_exports'");
    expect(schema).toContain("current_actor_has_capability(id, 'company_access_settings'");
    expect(documents).toContain('"private_employee_documents"');
    expect(documents).toContain("canRunFinanceExport");
    expect(setup).toContain('"company_access_settings"');
  });

  it("stages setup-pack users without fake auth identities or accidental sample employees", () => {
    const provisioning = read("services/customerProvisioningService.ts");
    const setupPage = read("app/setup/page.tsx");
    const schema = read("schemas/access_model.sql");

    expect(schema).toContain("create table if not exists tenant_access_invitations");
    expect(provisioning).toContain(".from(\"tenant_access_invitations\")");
    expect(provisioning).toContain("manager reporting cycle");
    expect(provisioning).toContain(".from(\"compensation\").upsert");
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
    expect(provisioning).toContain("tenant_access_invitation_rules");
    expect(leave).toContain("coalesce(e.working_days_override, c.default_working_days)");
    expect(leave).toContain("company_holidays");
  });

  it("keeps suspended or closed tenants out of ordinary automation processing", () => {
    const automation = read("services/hrAutomation/index.ts");

    expect(automation).toContain('.select("id, status")');
    expect(automation).toContain('.eq("status", "active")');
  });
});
