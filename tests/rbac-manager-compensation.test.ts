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

import { canViewCompensation, canReadEmployeeProfile, canRunFinanceExport } from "@/lib/rbac/access";
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
});
