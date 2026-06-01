import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

type Row = Record<string, unknown>;

const db = {
  employees: [] as Row[],
  documents: [] as Row[],
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

import { reconcileExpiringDocumentSignals } from "@/services/signalEngine/expiringDocument";

beforeEach(() => {
  db.employees = [];
  db.documents = [];
  db.risk_signals = [];
  db.action_items = [];
  db.audit_logs = [];
  nextId = 1;
});

describe("expiring document signals", () => {
  it("creates yellow and red signals plus action items in one run", async () => {
    db.employees = [
      { id: "emp-a", tenant_id: "TENANT_A", lifecycle_state: "active", deleted_at: null },
      { id: "emp-b", tenant_id: "TENANT_A", lifecycle_state: "active", deleted_at: null },
      { id: "emp-x", tenant_id: "TENANT_X", lifecycle_state: "active", deleted_at: null },
    ];

    db.documents = [
      {
        id: "doc-yellow",
        tenant_id: "TENANT_A",
        employee_id: "emp-a",
        subject_person_id: "emp-a",
        document_type: "passport",
        type: "passport",
        expires_at: "2026-07-15T00:00:00Z",
        deleted_at: null,
      },
      {
        id: "doc-red",
        tenant_id: "TENANT_A",
        employee_id: "emp-b",
        subject_person_id: "emp-b",
        document_type: "emirates_id",
        type: "emirates_id",
        expires_at: "2026-05-20T00:00:00Z",
        deleted_at: null,
      },
      {
        id: "doc-other-tenant",
        tenant_id: "TENANT_X",
        employee_id: "emp-x",
        subject_person_id: "emp-x",
        document_type: "passport",
        type: "passport",
        expires_at: "2026-05-20T00:00:00Z",
        deleted_at: null,
      },
    ];

    const result = await reconcileExpiringDocumentSignals({
      tenantId: "TENANT_A",
      actorUserId: "user-a",
      now: new Date("2026-06-01T00:00:00Z"),
    });

    expect(result.createdSignals).toBe(2);
    expect(result.resolvedSignals).toBe(0);

    const signals = db.risk_signals as Array<{ tenant_id: string; kind: string; subject_document_id: string }>;
    expect(signals).toHaveLength(2);
    expect(signals.every((s) => s.tenant_id === "TENANT_A")).toBe(true);
    expect(signals.find((s) => s.subject_document_id === "doc-yellow")?.kind).toBe("expiring_document");
    expect(signals.find((s) => s.subject_document_id === "doc-red")?.kind).toBe("expired_document");

    const actions = db.action_items as Array<{ tenant_id: string; title: string }>;
    expect(actions).toHaveLength(2);
    expect(actions.every((a) => a.tenant_id === "TENANT_A")).toBe(true);
    expect(actions.some((a) => a.title.includes("Request renewal"))).toBe(true);
    expect(actions.some((a) => a.title.includes("Upload renewed"))).toBe(true);
  });

  it("resolves existing signal and action item when document is no longer in warning window", async () => {
    db.employees = [
      { id: "emp-a", tenant_id: "TENANT_A", lifecycle_state: "active", deleted_at: null },
    ];

    db.documents = [
      {
        id: "doc-passport",
        tenant_id: "TENANT_A",
        employee_id: "emp-a",
        subject_person_id: "emp-a",
        document_type: "passport",
        type: "passport",
        expires_at: "2027-01-15T00:00:00Z",
        deleted_at: null,
      },
    ];

    db.risk_signals = [
      {
        id: "signal-open",
        tenant_id: "TENANT_A",
        kind: "expiring_document",
        subject_document_id: "doc-passport",
        resolved_at: null,
      },
    ];

    db.action_items = [
      {
        id: "action-open",
        tenant_id: "TENANT_A",
        risk_signal_id: "signal-open",
        status: "open",
      },
    ];

    const result = await reconcileExpiringDocumentSignals({
      tenantId: "TENANT_A",
      actorUserId: "user-a",
      now: new Date("2026-06-01T00:00:00Z"),
    });

    expect(result.createdSignals).toBe(0);
    expect(result.resolvedSignals).toBe(1);

    const signal = (db.risk_signals as Array<{ id: string; resolved_at: string | null }>).find(
      (s) => s.id === "signal-open",
    );
    expect(signal?.resolved_at).not.toBeNull();

    const action = (db.action_items as Array<{ id: string; status: string; resolved_at?: string | null }>).find(
      (a) => a.id === "action-open",
    );
    expect(action?.status).toBe("done");
    expect(action?.resolved_at).not.toBeNull();
  });
});
