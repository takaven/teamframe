import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  runSignalEngineForTenant: vi.fn(),
}));

type Row = Record<string, unknown>;

const db = {
  risk_signals: [] as Row[],
  action_items: [] as Row[],
  employees: [] as Row[],
};
let stalledTable: keyof typeof db | null = null;

function makeBuilder(table: keyof typeof db) {
  const filters: Array<(row: Row) => boolean> = [];
  const builder: Record<string, unknown> = {};

  builder.select = () => builder;
  builder.order = () => builder;
  builder.limit = () => builder;
  builder.eq = (column: string, value: unknown) => {
    filters.push((row) => row[column] === value);
    return builder;
  };
  builder.is = (column: string, value: unknown) => {
    filters.push((row) => (value === null ? row[column] == null : row[column] === value));
    return builder;
  };
  builder.then = (resolve: (value: unknown) => unknown) => {
    if (stalledTable === table) {
      return new Promise(() => {});
    }
    const rows = db[table].filter((row) => filters.every((fn) => fn(row)));
    return resolve({ data: rows, error: null });
  };

  return builder;
}

vi.mock("@/services/signalEngine", () => ({
  runSignalEngineForTenant: mocks.runSignalEngineForTenant,
}));

vi.mock("@/lib/db/supabaseServer", () => ({
  createServiceRoleClient: () => ({
    from: (table: string) => makeBuilder(table as keyof typeof db),
  }),
}));

import { loadDashboardData } from "@/app/dashboard/data";

beforeEach(() => {
  mocks.runSignalEngineForTenant.mockReset();
  stalledTable = null;
  db.risk_signals = [
    {
      id: "signal-a",
      tenant_id: "TENANT_A",
      kind: "missing_contract",
      severity: "red",
      subject_employee_id: "emp-a",
      evidence: null,
      last_seen_at: "2026-08-06T08:00:00Z",
      resolved_at: null,
    },
  ];
  db.action_items = [
    {
      id: "action-a",
      tenant_id: "TENANT_A",
      risk_signal_id: "signal-a",
      title: "Upload contract",
      status: "open",
      created_at: "2026-08-06T08:00:00Z",
    },
  ];
  db.employees = [
    {
      id: "emp-a",
      tenant_id: "TENANT_A",
      full_name: "Amina Rahman",
      deleted_at: null,
    },
  ];
});

describe("dashboard data loading", () => {
  it("returns saved dashboard data after a successful signal refresh", async () => {
    mocks.runSignalEngineForTenant.mockResolvedValue({});

    const result = await loadDashboardData({
      tenantId: "TENANT_A",
      actorUserId: "admin-a",
      refreshTimeoutMs: 50,
    });

    expect(result.refreshStatus).toEqual({ state: "success" });
    expect(result.savedDataStatus).toEqual({ state: "success" });
    expect(result.signals).toHaveLength(1);
    expect(result.actions).toHaveLength(1);
    expect(result.employees[0]?.full_name).toBe("Amina Rahman");
  });

  it("renders from empty saved data when the tenant has no signals yet", async () => {
    mocks.runSignalEngineForTenant.mockResolvedValue({});
    db.risk_signals = [];
    db.action_items = [];

    const result = await loadDashboardData({
      tenantId: "TENANT_A",
      actorUserId: "admin-a",
      refreshTimeoutMs: 50,
    });

    expect(result.refreshStatus).toEqual({ state: "success" });
    expect(result.savedDataStatus).toEqual({ state: "success" });
    expect(result.signals).toEqual([]);
    expect(result.actions).toEqual([]);
  });

  it("does not block indefinitely when signal refresh is delayed", async () => {
    mocks.runSignalEngineForTenant.mockReturnValue(new Promise(() => {}));

    const result = await loadDashboardData({
      tenantId: "TENANT_A",
      actorUserId: "admin-a",
      refreshTimeoutMs: 1,
    });

    expect(result.refreshStatus).toEqual({ state: "timeout" });
    expect(result.savedDataStatus).toEqual({ state: "success" });
    expect(result.signals[0]?.id).toBe("signal-a");
  });

  it("returns saved data with a failed refresh status when refresh throws", async () => {
    mocks.runSignalEngineForTenant.mockRejectedValue(new Error("engine exploded"));

    const result = await loadDashboardData({
      tenantId: "TENANT_A",
      actorUserId: "admin-a",
      refreshTimeoutMs: 50,
    });

    expect(result.refreshStatus).toEqual({
      state: "failed",
      message: "engine exploded",
    });
    expect(result.savedDataStatus).toEqual({ state: "success" });
    expect(result.signals[0]?.id).toBe("signal-a");
  });

  it("returns an intentional empty state when saved dashboard rows are delayed", async () => {
    mocks.runSignalEngineForTenant.mockResolvedValue({});
    stalledTable = "risk_signals";

    const result = await loadDashboardData({
      tenantId: "TENANT_A",
      actorUserId: "admin-a",
      refreshTimeoutMs: 50,
      savedDataTimeoutMs: 1,
    });

    expect(result.refreshStatus).toEqual({ state: "success" });
    expect(result.savedDataStatus).toEqual({ state: "timeout" });
    expect(result.signals).toEqual([]);
    expect(result.actions).toEqual([]);
    expect(result.employees).toEqual([]);
  });
});
