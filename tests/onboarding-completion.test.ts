import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/telemetry/track", () => ({ track: vi.fn(async () => {}) }));
vi.mock("@/lib/telemetry/logger", () => ({ logAction: vi.fn() }));
vi.mock("@/lib/telemetry/sentry", () => ({ captureActionError: vi.fn() }));

let employeeUpdatePayload: Record<string, unknown> | null = null;
const countQueue: Array<{ count: number }> = [];

function promiseBuilder<T>(value: T) {
  return {
    then: (resolve: (value: T) => unknown) => resolve(value),
  };
}

function makeOnboardingTasksTable() {
  const completedTask = {
    id: "task-1",
    tenant_id: "tenant-1",
    employee_id: "employee-1",
    title: "Complete welcome steps",
    status: "completed",
    completion_mode: "manual_confirmation",
    required_document_type: null,
    required_policy_id: null,
    required_policy_version: null,
    form_requirement_key: null,
    assigned_by: "admin-1",
    due_date: null,
    completed_at: "2026-08-12T00:00:00.000Z",
    created_at: "2026-08-11T00:00:00.000Z",
    updated_at: "2026-08-12T00:00:00.000Z",
  };
  const updateBuilder: Record<string, unknown> = {
    eq: () => updateBuilder,
    select: () => updateBuilder,
    maybeSingle: async () => ({ data: completedTask, error: null }),
  };
  const lookupBuilder: Record<string, unknown> = {
    eq: () => lookupBuilder,
    maybeSingle: async () => ({
      data: { ...completedTask, status: "pending", completed_at: null, updated_at: "2026-08-11T00:00:00.000Z" },
      error: null,
    }),
  };
  const countBuilder: Record<string, unknown> = {
    eq: () => countBuilder,
    then: (resolve: (value: unknown) => unknown) => resolve({ data: [], error: null, ...(countQueue.shift() ?? { count: 0 }) }),
  };
  let selectCalls = 0;
  return {
    update: () => updateBuilder,
    select: () => {
      selectCalls += 1;
      return selectCalls === 1 ? lookupBuilder : countBuilder;
    },
  };
}

function makeEmployeesTable() {
  const builder: Record<string, unknown> = {
    eq: () => builder,
    is: () => builder,
    neq: () => builder,
    select: () => builder,
    maybeSingle: async () => ({ data: { id: "employee-1" }, error: null }),
  };
  return {
    update: (payload: Record<string, unknown>) => {
      employeeUpdatePayload = payload;
      return builder;
    },
  };
}

vi.mock("@/lib/db/supabaseServer", () => ({
  createServiceRoleClient: () => ({
    from: (table: string) => {
      if (table === "onboarding_tasks") return makeOnboardingTasksTable();
      if (table === "employees") return makeEmployeesTable();
      if (table === "audit_logs") return { insert: async () => ({ error: null }) };
      if (table === "analytics_events") {
        return {
          select: () => ({
            eq: () => ({
              in: () => promiseBuilder({ data: [], error: null }),
            }),
          }),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    },
  }),
}));

import { completeOnboardingTask } from "@/services/onboardingService";
import type { Actor } from "@/middleware/rbac";

const adminActor: Actor = {
  authUserId: "admin-1",
  email: "admin@example.test",
  employeeId: "admin-employee",
  tenantId: "tenant-1",
  role: "admin",
};

describe("onboarding completion activation", () => {
  it("activates employee setup when the final pending onboarding task is completed", async () => {
    employeeUpdatePayload = null;
    countQueue.splice(0, countQueue.length, { count: 0 }, { count: 1 });

    await expect(
      completeOnboardingTask(adminActor, "task-1", "2026-08-11T00:00:00.000Z"),
    ).resolves.toMatchObject({ id: "task-1", employee_id: "employee-1", status: "completed" });

    expect(employeeUpdatePayload).toEqual({
      setup_status: "active",
      lifecycle_state: "active",
    });
  });
});
