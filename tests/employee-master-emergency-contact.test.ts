import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const access = vi.hoisted(() => ({
  canReadEmployeeProfile: vi.fn(),
  canReadEmergencyContact: vi.fn(),
  canReadOwnEmployeeRecord: vi.fn(),
  canViewCompensation: vi.fn(),
  canRunFinanceExport: vi.fn(),
}));

vi.mock("@/lib/rbac/access", () => access);

const employee = {
  id: "employee-1", tenant_id: "tenant-1", employee_number: "E-001", full_name: "Synthetic Person",
  preferred_name: null, email: "synthetic@example.test", personal_email: null, mobile: null,
  company_phone: null, residential_address: null, date_of_birth: null, gender: null, nationality: null,
  work_location: null, country: "AE", timezone: "Asia/Dubai", role_title: "Analyst", department: "Operations",
  manager_id: "manager-1", employment_type: "full_time", status: "active", setup_status: "active",
  lifecycle_state: "active", start_date: "2026-01-01", end_date: null, grade: null,
  working_days_override: null, annual_leave_entitlement_override: null,
  emergency_contact_name: "Synthetic Contact", emergency_contact_relationship: "Friend",
  emergency_contact_phone: "+971500000000", emergency_contact_email: "contact@example.test",
};

function builder(table: string) {
  const filters = new Map<string, unknown>();
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn((column: string, value: unknown) => { filters.set(column, value); return chain; }),
    is: vi.fn((column: string, value: unknown) => { filters.set(column, value); return chain; }),
    maybeSingle: vi.fn(async () => {
      if (table === "employees") {
        const matches = filters.get("tenant_id") === employee.tenant_id && filters.get("id") === employee.id;
        return { data: matches ? employee : null, error: null };
      }
      if (table === "employee_profiles") return { data: null, error: null };
      return { data: null, error: null };
    }),
  };
  return chain;
}

vi.mock("@/lib/db/supabaseServer", () => ({
  createServiceRoleClient: () => ({ from: (table: string) => builder(table) }),
}));

import { getEmployeeMasterRecord } from "@/services/employeeMasterService";
import type { Actor } from "@/middleware/rbac";

function actor(authUserId: string, tenantId = "tenant-1"): Actor {
  return {
    authUserId,
    tenantId,
    employeeId: authUserId === "self" ? "employee-1" : "manager-1",
    email: `${authUserId}@example.test`,
    role: authUserId === "admin" ? "admin" : "employee",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  access.canReadEmployeeProfile.mockImplementation(async (value: Actor) => value.authUserId !== "unrelated");
  access.canReadEmergencyContact.mockImplementation(async (value: Actor) => ["self", "admin", "peopleops"].includes(value.authUserId));
  access.canReadOwnEmployeeRecord.mockResolvedValue(false);
  access.canViewCompensation.mockResolvedValue(false);
  access.canRunFinanceExport.mockResolvedValue(false);
});

describe("employee master emergency-contact projection", () => {
  it("redacts every field for a relationship-only manager", async () => {
    const record = await getEmployeeMasterRecord(actor("manager"), "employee-1");
    expect(record.emergency_contact).toEqual({ canView: false, name: null, relationship: null, phone: null, email: null });
  });

  it.each(["self", "admin", "peopleops"])("returns the contact for authorised %s access", async (identity) => {
    const record = await getEmployeeMasterRecord(actor(identity), "employee-1");
    expect(record.emergency_contact).toEqual({
      canView: true,
      name: "Synthetic Contact",
      relationship: "Friend",
      phone: "+971500000000",
      email: "contact@example.test",
    });
  });

  it("denies an unrelated employee before reading the record", async () => {
    await expect(getEmployeeMasterRecord(actor("unrelated"), "employee-1")).rejects.toThrow("FORBIDDEN");
  });

  it("cannot resolve the same employee id across a different tenant", async () => {
    await expect(getEmployeeMasterRecord(actor("peopleops", "tenant-2"), "employee-1")).rejects.toThrow("NOT_FOUND");
  });
});
