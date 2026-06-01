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
      if (value === null) {
        filters.push((row) => row[column] == null);
      }
      return builder;
    },
    not: (column: string, op: string, value: unknown) => {
      if (op === "is" && value === null) {
        filters.push((row) => row[column] != null);
      }
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

import {
  evaluateMissingContractSeverity,
  reconcileMissingContractSignals,
} from "@/services/signalEngine/missingContract";

beforeEach(() => {
  db.employees = [];
  db.documents = [];
  db.risk_signals = [];
  db.action_items = [];
  db.audit_logs = [];
  nextId = 1;
});

describe("missing contract severity transitions", () => {
  const now = new Date("2026-06-01T00:00:00Z");

  it("returns yellow for preboarding with start date >= 7 days away", () => {
    expect(
      evaluateMissingContractSeverity(
        { lifecycle_state: "preboarding", start_date: "2026-06-10" },
        false,
        now,
      ),
    ).toBe("yellow");
  });

  it("returns red for preboarding within 7 days or missing start date", () => {
    expect(
      evaluateMissingContractSeverity(
        { lifecycle_state: "preboarding", start_date: "2026-06-03" },
        false,
        now,
      ),
    ).toBe("red");

    expect(
      evaluateMissingContractSeverity(
        { lifecycle_state: "preboarding", start_date: null },
        false,
        now,
      ),
    ).toBe("red");
  });

  it("returns red for active without signed contract and null for exited", () => {
    expect(
      evaluateMissingContractSeverity(
        { lifecycle_state: "active", start_date: "2026-05-01" },
        false,
        now,
      ),
    ).toBe("red");

    expect(
      evaluateMissingContractSeverity(
        { lifecycle_state: "exited", start_date: "2026-05-01" },
        false,
        now,
      ),
    ).toBeNull();
  });

  it("returns null when signed contract exists", () => {
    expect(
      evaluateMissingContractSeverity(
        { lifecycle_state: "active", start_date: "2026-05-01" },
        true,
        now,
      ),
    ).toBeNull();
  });
});

describe("missing contract tenant isolation", () => {
  it("creates signals only for employees in the requested tenant", async () => {
    db.employees = [
      {
        id: "emp-a-yellow",
        tenant_id: "TENANT_A",
        lifecycle_state: "preboarding",
        start_date: "2026-06-20",
        deleted_at: null,
      },
      {
        id: "emp-a-covered",
        tenant_id: "TENANT_A",
        lifecycle_state: "active",
        start_date: "2026-05-01",
        deleted_at: null,
      },
      {
        id: "emp-b-leak",
        tenant_id: "TENANT_B",
        lifecycle_state: "active",
        start_date: "2026-05-01",
        deleted_at: null,
      },
    ];

    db.documents = [
      {
        id: "doc-a",
        tenant_id: "TENANT_A",
        employee_id: "emp-a-covered",
        subject_person_id: "emp-a-covered",
        signed_at: "2026-05-02T00:00:00Z",
        document_type: "contract",
        type: "CONTRACT",
        deleted_at: null,
      },
    ];

    const result = await reconcileMissingContractSignals({
      tenantId: "TENANT_A",
      actorUserId: "user-a",
      now: new Date("2026-06-01T00:00:00Z"),
    });

    expect(result.createdSignals).toBe(1);
    expect(result.resolvedSignals).toBe(0);

    const createdSignals = db.risk_signals as Array<{ tenant_id: string; subject_employee_id: string }>;
    expect(createdSignals).toHaveLength(1);
    expect(createdSignals[0]?.tenant_id).toBe("TENANT_A");
    expect(createdSignals[0]?.subject_employee_id).toBe("emp-a-yellow");

    const createdActions = db.action_items as Array<{ tenant_id: string; subject_employee_id: string }>;
    expect(createdActions).toHaveLength(1);
    expect(createdActions[0]?.tenant_id).toBe("TENANT_A");
    expect(createdActions[0]?.subject_employee_id).toBe("emp-a-yellow");

    const audits = db.audit_logs as Array<{ tenant_id: string; action_type: string }>;
    expect(audits).toHaveLength(1);
    expect(audits[0]?.tenant_id).toBe("TENANT_A");
    expect(audits[0]?.action_type).toBe("signal.missing_contract.created");
  });
});
