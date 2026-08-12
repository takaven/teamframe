import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

type EmployeeRow = {
  id: string;
  tenant_id: string;
  status: "active" | "on_leave" | "inactive";
  setup_status: "incomplete" | "ready" | "active";
  lifecycle_state: "preboarding" | "active" | "on_leave" | "offboarding" | "exited";
  start_date: string | null;
  end_date: string | null;
  deleted_at: string | null;
};

let employeeRow: EmployeeRow | null = null;
const rpcCalls: string[] = [];

function makeEmployeeBuilder() {
  const builder: Record<string, unknown> = {
    select: () => builder,
    eq: () => builder,
    is: () => builder,
    maybeSingle: async () => ({ data: employeeRow, error: null }),
  };
  return builder;
}

function makeCountBuilder() {
  const builder: Record<string, unknown> = {
    select: () => builder,
    eq: () => builder,
    then: (resolve: (value: unknown) => unknown) => resolve({ data: [], error: null, count: 1 }),
  };
  return builder;
}

function makeRpcBuilder() {
  return {
    single: async () => ({
      data: {
        id: "leave-1",
        tenant_id: "TENANT_A",
        employee_id: "emp-a",
        start_date: "2026-08-20",
        end_date: "2026-08-21",
        leave_type: "annual",
        requested_days: 2,
        reason: null,
        status: "pending",
        decided_by_user_id: null,
        decided_at: null,
        decision_note: null,
        override_insufficient_balance: false,
        override_reason: null,
        cancelled_by_user_id: null,
        cancelled_at: null,
        cancellation_reason: null,
        approval_automation_item_id: "automation-1",
        created_at: "2026-08-11T00:00:00.000Z",
        updated_at: "2026-08-11T00:00:00.000Z",
      },
      error: null,
    }),
  };
}

vi.mock("@/lib/db/supabaseServer", () => ({
  createServiceRoleClient: () => ({
    from: (table: string) => {
      if (table === "employees") return makeEmployeeBuilder();
      return makeCountBuilder();
    },
    rpc: (name: string) => {
      rpcCalls.push(name);
      return makeRpcBuilder();
    },
  }),
}));

vi.mock("@/lib/telemetry/track", () => ({ track: vi.fn(async () => {}) }));
vi.mock("@/services/onboardingService", () => ({
  maybeFireActivationCompleted: vi.fn(async () => {}),
}));

import { submitLeaveRequest } from "@/services/leaveService";
import type { Actor } from "@/middleware/rbac";

const employeeActor: Actor = {
  authUserId: "auth-a",
  email: "amina@example.test",
  employeeId: "emp-a",
  tenantId: "TENANT_A",
  role: "employee",
};

beforeEach(() => {
  rpcCalls.length = 0;
  employeeRow = {
    id: "emp-a",
    tenant_id: "TENANT_A",
    status: "active",
    setup_status: "active",
    lifecycle_state: "active",
    start_date: "2026-08-01",
    end_date: null,
    deleted_at: null,
  };
});

describe("leave lifecycle eligibility", () => {
  it("allows an active employee to submit leave", async () => {
    const leave = await submitLeaveRequest(employeeActor, {
      startDate: "2026-08-20",
      endDate: "2026-08-21",
      leaveType: "annual",
    });

    expect(leave.id).toBe("leave-1");
    expect(rpcCalls).toEqual(["teamframe_submit_leave"]);
  });

  it("treats on-leave compatibility status as current active lifecycle", async () => {
    employeeRow = { ...employeeRow!, status: "on_leave", lifecycle_state: "on_leave" };

    const leave = await submitLeaveRequest(employeeActor, {
      startDate: "2026-08-20",
      endDate: "2026-08-21",
      leaveType: "sick",
    });

    expect(leave.id).toBe("leave-1");
    expect(rpcCalls).toEqual(["teamframe_submit_leave"]);
  });

  it("blocks pre-start, onboarding and former employees before the leave RPC", async () => {
    const blockedEmployees: Array<Partial<EmployeeRow>> = [
      { start_date: "2026-09-01" },
      { setup_status: "ready" },
      { status: "inactive", lifecycle_state: "exited" },
    ];

    for (const blockedEmployee of blockedEmployees) {
      employeeRow = { ...employeeRow!, ...blockedEmployee };
      rpcCalls.length = 0;

      await expect(
        submitLeaveRequest(employeeActor, {
          startDate: "2026-08-20",
          endDate: "2026-08-21",
        }),
      ).rejects.toThrow("LEAVE_EMPLOYEE_NOT_ELIGIBLE");
      expect(rpcCalls).toHaveLength(0);
    }
  });
});
