import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

type Row = Record<string, unknown>;

const db = {
  employees: [] as Row[],
  documents: [] as Row[],
  leaves: [] as Row[],
  risk_signals: [] as Row[],
  action_items: [] as Row[],
  audit_logs: [] as Row[],
};

let nextId = 1;

function makeBuilder(table: keyof typeof db) {
  let mode: "select" | "insert" | "update" = "select";
  let insertRows: Row[] = [];
  let updatePatch: Row = {};
  let single = false;
  const filters: Array<(row: Row) => boolean> = [];

  const resolveNow = () => {
    const rows = db[table].filter((row) => filters.every((fn) => fn(row)));

    if (mode === "select") {
      if (single) return { data: rows[0] ?? null, error: null };
      return { data: rows, error: null };
    }

    if (mode === "insert") {
      const inserted = insertRows.map((row) => ({ id: row.id ?? `${table}-${nextId++}`, ...row }));
      db[table].push(...inserted);
      if (single) return { data: inserted[0] ?? null, error: null };
      return { data: inserted, error: null };
    }

    for (const row of rows) {
      Object.assign(row, updatePatch);
    }
    if (single) return { data: rows[0] ?? null, error: null };
    return { data: rows, error: null };
  };

  const builder: Record<string, unknown> = {
    select: () => builder,
    order: () => builder,
    limit: () => builder,
    eq: (column: string, value: unknown) => {
      filters.push((row) => row[column] === value);
      return builder;
    },
    is: (column: string, value: unknown) => {
      if (value === null) filters.push((row) => row[column] == null);
      return builder;
    },
    not: (column: string, op: string, value: unknown) => {
      if (op === "is" && value === null) filters.push((row) => row[column] != null);
      return builder;
    },
    in: (column: string, values: unknown[]) => {
      filters.push((row) => values.includes(row[column]));
      return builder;
    },
    insert: (payload: unknown) => {
      mode = "insert";
      insertRows = Array.isArray(payload) ? (payload as Row[]) : [payload as Row];
      return builder;
    },
    update: (payload: unknown) => {
      mode = "update";
      updatePatch = payload as Row;
      return builder;
    },
    single: async () => {
      single = true;
      return resolveNow();
    },
    maybeSingle: async () => {
      single = true;
      return resolveNow();
    },
    then: (resolve: (value: unknown) => unknown) => resolve(resolveNow()),
  };

  return builder;
}

vi.mock("@/lib/db/supabaseServer", () => ({
  createServiceRoleClient: () => ({
    from: (table: string) => makeBuilder(table as keyof typeof db),
  }),
}));

import { reconcileMissingJurisdictionRequirementSignals } from "@/services/signalEngine/missingJurisdictionRequirement";
import { reconcileLeaveConflictSignals } from "@/services/signalEngine/leaveConflict";

beforeEach(() => {
  db.employees = [];
  db.documents = [];
  db.leaves = [];
  db.risk_signals = [];
  db.action_items = [];
  db.audit_logs = [];
  nextId = 1;
});

describe("missing_jurisdiction_requirement manual resolution", () => {
  it("keeps the signal open while the action item is open", async () => {
    db.employees = [
      { id: "emp-a", tenant_id: "TENANT_A", country: "UAE", lifecycle_state: "active", deleted_at: null },
    ];
    db.risk_signals = [
      {
        id: "signal-open",
        tenant_id: "TENANT_A",
        kind: "missing_jurisdiction_requirement",
        subject_employee_id: "emp-a",
        resolved_at: null,
      },
    ];
    db.action_items = [
      {
        id: "action-open",
        tenant_id: "TENANT_A",
        risk_signal_id: "signal-open",
        subject_employee_id: "emp-a",
        category: "missing_jurisdiction_requirement",
        status: "open",
      },
    ];

    const result = await reconcileMissingJurisdictionRequirementSignals({
      tenantId: "TENANT_A",
      actorUserId: "admin-user",
      now: new Date("2026-07-03T00:00:00Z"),
    });

    expect(result.resolvedSignals).toBe(0);
    const signal = db.risk_signals.find((s) => s.id === "signal-open");
    expect(signal?.resolved_at).toBeNull();
  });

  it("resolves the signal after the admin marks the action item done on the dashboard", async () => {
    db.employees = [
      { id: "emp-a", tenant_id: "TENANT_A", country: "UAE", lifecycle_state: "active", deleted_at: null },
    ];
    db.risk_signals = [
      {
        id: "signal-open",
        tenant_id: "TENANT_A",
        kind: "missing_jurisdiction_requirement",
        subject_employee_id: "emp-a",
        resolved_at: null,
      },
    ];
    db.action_items = [
      {
        id: "action-done",
        tenant_id: "TENANT_A",
        risk_signal_id: "signal-open",
        subject_employee_id: "emp-a",
        category: "missing_jurisdiction_requirement",
        status: "done",
        resolved_at: "2026-07-03T00:00:00Z",
      },
    ];

    const result = await reconcileMissingJurisdictionRequirementSignals({
      tenantId: "TENANT_A",
      actorUserId: "admin-user",
      now: new Date("2026-07-03T01:00:00Z"),
    });

    expect(result.createdSignals).toBe(0);
    expect(result.resolvedSignals).toBe(1);
    const signal = db.risk_signals.find((s) => s.id === "signal-open");
    expect(signal?.resolved_at).not.toBeNull();
  });
});

describe("leave_conflict manual resolution", () => {
  it("resolves the signal after the admin marks the action item done on the dashboard", async () => {
    // Approved-approved overlap: neither leave can be edited in the V1 UI.
    db.leaves = [
      {
        id: "leave-1",
        tenant_id: "TENANT_A",
        employee_id: "emp-a",
        start_date: "2026-08-01",
        end_date: "2026-08-10",
        status: "approved",
      },
      {
        id: "leave-2",
        tenant_id: "TENANT_A",
        employee_id: "emp-a",
        start_date: "2026-08-05",
        end_date: "2026-08-12",
        status: "approved",
      },
    ];
    db.risk_signals = [
      {
        id: "signal-open",
        tenant_id: "TENANT_A",
        kind: "leave_conflict",
        subject_employee_id: "emp-a",
        resolved_at: null,
      },
    ];
    db.action_items = [
      {
        id: "action-done",
        tenant_id: "TENANT_A",
        risk_signal_id: "signal-open",
        subject_employee_id: "emp-a",
        category: "leave_conflict",
        status: "done",
        resolved_at: "2026-07-03T00:00:00Z",
      },
    ];

    const result = await reconcileLeaveConflictSignals({
      tenantId: "TENANT_A",
      actorUserId: "admin-user",
      now: new Date("2026-07-03T01:00:00Z"),
    });

    expect(result.createdSignals).toBe(0);
    expect(result.resolvedSignals).toBe(1);
    const signal = db.risk_signals.find((s) => s.id === "signal-open");
    expect(signal?.resolved_at).not.toBeNull();
  });

  it("still resolves naturally when the overlap disappears", async () => {
    db.leaves = [
      {
        id: "leave-1",
        tenant_id: "TENANT_A",
        employee_id: "emp-a",
        start_date: "2026-08-01",
        end_date: "2026-08-10",
        status: "approved",
      },
      {
        id: "leave-2",
        tenant_id: "TENANT_A",
        employee_id: "emp-a",
        start_date: "2026-08-05",
        end_date: "2026-08-12",
        status: "rejected",
      },
    ];
    db.risk_signals = [
      {
        id: "signal-open",
        tenant_id: "TENANT_A",
        kind: "leave_conflict",
        subject_employee_id: "emp-a",
        resolved_at: null,
      },
    ];
    db.action_items = [
      {
        id: "action-open",
        tenant_id: "TENANT_A",
        risk_signal_id: "signal-open",
        subject_employee_id: "emp-a",
        category: "leave_conflict",
        status: "open",
      },
    ];

    const result = await reconcileLeaveConflictSignals({
      tenantId: "TENANT_A",
      actorUserId: "admin-user",
      now: new Date("2026-07-03T01:00:00Z"),
    });

    expect(result.resolvedSignals).toBe(1);
    const signal = db.risk_signals.find((s) => s.id === "signal-open");
    expect(signal?.resolved_at).not.toBeNull();
    const action = db.action_items.find((a) => a.id === "action-open");
    expect(action?.status).toBe("done");
  });
});
