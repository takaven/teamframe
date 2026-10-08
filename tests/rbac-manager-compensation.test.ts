import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

// Mock the service-role client used by isDirectReport(). "rep" reports to "mgr".
const DIRECT_REPORTS: Record<string, Set<string>> = { mgr: new Set(["rep"]) };
vi.mock("@/lib/db/supabaseServer", () => ({
  createServiceRoleClient: () => ({
    from: () => {
      const filters: Record<string, unknown> = {};
      const b: Record<string, unknown> = {
        select: () => b,
        eq: (col: string, val: unknown) => { filters[col] = val; return b; },
        is: () => b,
        maybeSingle: async () => {
          const id = filters["id"] as string;
          const mgr = filters["manager_id"] as string;
          const isReport = DIRECT_REPORTS[mgr]?.has(id) ?? false;
          return { data: isReport ? { id } : null, error: null };
        },
      };
      return b;
    },
  }),
}));

import { canViewCompensation, canReadEmployeeProfile, canReadEmergencyContact, canRunFinanceExport, canProcessEmployeeDocumentRequest, canAccessEmployeeDocumentRequestQueue, canRunFullTenantExport } from "@/lib/rbac/access";
import type { Actor } from "@/middleware/rbac";
import type { ResolvedMembership } from "@/lib/rbac/roles";

function membership(over: Partial<ResolvedMembership>): ResolvedMembership {
  return {
    id: "m", tenantId: "t1", employeeId: null, profile: "employee", displayProfile: "Employee",
    peopleAccess: "none", peopleSelectedEmployeeIds: [],
    salaryAccessLevel: "none", salaryAccessScope: "all", salarySelectedEmployeeIds: [],
    privateDocumentsScope: "none", privateDocumentsSelectedEmployeeIds: [],
    financeExportsAccess: false, manageUsersAccess: false,
    ...over,
  };
}
function actor(over: Partial<Actor>): Actor {
  return { authUserId: "u", email: "e", employeeId: null, tenantId: "t1", role: "employee", currentMembership: null, ...over };
}

describe("RBAC — manager-derived access grants people_operations but NEVER compensation", () => {
  it("Manager + direct report + NO salary permission → no compensation, but keeps profile visibility", async () => {
    const mgr = actor({ employeeId: "mgr", currentMembership: membership({ employeeId: "mgr", peopleAccess: "none", salaryAccessLevel: "none" }) });
    expect(await canViewCompensation(mgr, "rep")).toBe(false);
    expect(await canReadEmployeeProfile(mgr, "rep")).toBe(true); // people_operations manager-derived preserved
    expect(await canReadEmergencyContact(mgr, "rep")).toBe(false); // relationship alone is insufficient
  });

  it("allows emergency contacts only for self or explicit People/Admin scope", async () => {
    const self = actor({ employeeId: "rep" });
    const scopedPeopleOps = actor({ employeeId: "mgr", currentMembership: membership({ employeeId: "mgr", peopleAccess: "direct_reports" }) });
    const admin = actor({ role: "admin", accessProfile: "admin", currentMembership: null });
    const unrelated = actor({ employeeId: "other", currentMembership: membership({ employeeId: "other", peopleAccess: "none" }) });

    expect(await canReadEmergencyContact(self, "rep")).toBe(true);
    expect(await canReadEmergencyContact(scopedPeopleOps, "rep")).toBe(true);
    expect(await canReadEmergencyContact(admin, "rep")).toBe(true);
    expect(await canReadEmergencyContact(unrelated, "rep")).toBe(false);
  });

  it("Manager + direct report + EXPLICIT salary scope (direct_reports) → compensation visible", async () => {
    const mgr = actor({ employeeId: "mgr", currentMembership: membership({ employeeId: "mgr", salaryAccessLevel: "view", salaryAccessScope: "direct_reports" }) });
    expect(await canViewCompensation(mgr, "rep")).toBe(true);
    // ...but only within that explicit scope: a non-report is still denied.
    expect(await canViewCompensation(mgr, "other")).toBe(false);
  });

  it("Manager + NON-report + no independent permission → no compensation", async () => {
    const mgr = actor({ employeeId: "mgr", currentMembership: membership({ employeeId: "mgr", salaryAccessLevel: "none" }) });
    expect(await canViewCompensation(mgr, "other")).toBe(false);
    expect(await canReadEmployeeProfile(mgr, "other")).toBe(false);
  });

  it("Admin WITHOUT salary permission → no compensation (membership + legacy profile paths)", async () => {
    const adminMembership = actor({ employeeId: "adm", role: "admin", currentMembership: membership({ employeeId: "adm", profile: "admin", peopleAccess: "all", salaryAccessLevel: "none" }) });
    expect(await canViewCompensation(adminMembership, "rep")).toBe(false);
    expect(await canReadEmployeeProfile(adminMembership, "rep")).toBe(true); // ordinary admin still administers people
    const adminLegacy = actor({ employeeId: "adm2", role: "admin", accessProfile: "admin", currentMembership: null });
    expect(await canViewCompensation(adminLegacy, "rep")).toBe(false);
  });

  it("Finance / Full Access → compensation per configured permission", async () => {
    const finance = actor({ employeeId: "fin", currentMembership: membership({ employeeId: "fin", profile: "finance", salaryAccessLevel: "view", salaryAccessScope: "all", financeExportsAccess: true }) });
    expect(await canViewCompensation(finance, "rep")).toBe(true);
    expect(await canRunFinanceExport(finance)).toBe(true);
    const financeLegacy = actor({ accessProfile: "finance", currentMembership: null });
    expect(await canViewCompensation(financeLegacy, "rep")).toBe(true);
    const fullAccess = actor({ employeeId: "fa", currentMembership: membership({ employeeId: "fa", profile: "full_access", salaryAccessLevel: "manage", salaryAccessScope: "all" }) });
    expect(await canViewCompensation(fullAccess, "rep")).toBe(true);
  });

  it("requires explicit People Ops and private-document scopes to process employee document requests", async () => {
    const managerOnly = actor({ employeeId: "mgr", currentMembership: membership({ employeeId: "mgr", peopleAccess: "direct_reports", privateDocumentsScope: "none" }) });
    const financeOnly = actor({ employeeId: "fin", currentMembership: membership({ employeeId: "fin", profile: "finance", salaryAccessLevel: "view", financeExportsAccess: true }) });
    const adminWithoutDocuments = actor({ employeeId: "adm", role: "admin", currentMembership: membership({ employeeId: "adm", profile: "admin", peopleAccess: "all", privateDocumentsScope: "none" }) });
    const scopedProcessor = actor({ employeeId: "ops", currentMembership: membership({ employeeId: "ops", peopleAccess: "selected_people", peopleSelectedEmployeeIds: ["rep"], privateDocumentsScope: "selected_people", privateDocumentsSelectedEmployeeIds: ["rep"] }) });
    const salaryProcessor = actor({ employeeId: "ops-salary", currentMembership: membership({ employeeId: "ops-salary", peopleAccess: "selected_people", peopleSelectedEmployeeIds: ["rep"], privateDocumentsScope: "selected_people", privateDocumentsSelectedEmployeeIds: ["rep"], salaryAccessLevel: "view", salaryAccessScope: "selected_people", salarySelectedEmployeeIds: ["rep"] }) });
    const fullAccess = actor({ role: "admin", accessProfile: "full_access", currentMembership: null });

    expect(await canProcessEmployeeDocumentRequest(managerOnly, "rep", "noc")).toBe(false);
    expect(await canProcessEmployeeDocumentRequest(financeOnly, "rep", "salary_certificate")).toBe(false);
    expect(await canProcessEmployeeDocumentRequest(adminWithoutDocuments, "rep", "noc")).toBe(false);
    expect(canAccessEmployeeDocumentRequestQueue(adminWithoutDocuments)).toBe(false);
    expect(await canProcessEmployeeDocumentRequest(scopedProcessor, "rep", "noc")).toBe(true);
    expect(await canProcessEmployeeDocumentRequest(scopedProcessor, "rep", "employment_certificate")).toBe(true);
    expect(await canProcessEmployeeDocumentRequest(scopedProcessor, "rep", "salary_certificate")).toBe(false);
    expect(await canProcessEmployeeDocumentRequest(scopedProcessor, "rep", "salary_transfer_letter")).toBe(false);
    expect(canAccessEmployeeDocumentRequestQueue(scopedProcessor)).toBe(true);
    expect(await canProcessEmployeeDocumentRequest(scopedProcessor, "other", "noc")).toBe(false);
    expect(await canProcessEmployeeDocumentRequest(salaryProcessor, "rep", "salary_certificate")).toBe(true);
    expect(await canProcessEmployeeDocumentRequest(fullAccess, "rep", "salary_transfer_letter")).toBe(true);
    expect(canAccessEmployeeDocumentRequestQueue(fullAccess)).toBe(true);
    expect(canAccessEmployeeDocumentRequestQueue(managerOnly)).toBe(false);
    expect(canAccessEmployeeDocumentRequestQueue(financeOnly)).toBe(false);
  });

  it("reserves the whole-tenant export for the complete Full Access matrix", () => {
    const manageUsersOnly = actor({ currentMembership: membership({ manageUsersAccess: true }) });
    const restrictedFullAccessProfile = actor({ currentMembership: membership({ profile: "full_access", manageUsersAccess: true, peopleAccess: "all", privateDocumentsScope: "all" }) });
    const fullAccess = actor({ currentMembership: membership({ profile: "full_access", peopleAccess: "all", privateDocumentsScope: "all", salaryAccessLevel: "manage", salaryAccessScope: "all", financeExportsAccess: true, manageUsersAccess: true }) });
    const legacyFullAccess = actor({ role: "admin", accessProfile: "full_access", currentMembership: null });

    expect(canRunFullTenantExport(manageUsersOnly)).toBe(false);
    expect(canRunFullTenantExport(restrictedFullAccessProfile)).toBe(false);
    expect(canRunFullTenantExport(fullAccess)).toBe(true);
    expect(canRunFullTenantExport(legacyFullAccess)).toBe(true);
  });
});
