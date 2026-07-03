import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

type Row = Record<string, unknown>;

const db = {
  employees: [] as Row[],
  policies: [] as Row[],
  acknowledgements: [] as Row[],
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

import type { Actor } from "@/middleware/rbac";
import {
  acknowledgePolicy,
  createPolicy,
  listUnacknowledgedForEmployee,
  publishPolicy,
} from "@/services/policyService";
import { reconcileUnacknowledgedPolicySignals } from "@/services/signalEngine/unacknowledgedPolicy";

const adminActor: Actor = {
  authUserId: "admin-user",
  email: "admin@tenant-a.test",
  employeeId: null,
  tenantId: "TENANT_A",
  role: "admin",
};

const employeeActor: Actor = {
  authUserId: "employee-user",
  email: "emp-a@tenant-a.test",
  employeeId: "emp-a",
  tenantId: "TENANT_A",
  role: "employee",
};

beforeEach(() => {
  db.employees = [];
  db.policies = [];
  db.acknowledgements = [];
  db.risk_signals = [];
  db.action_items = [];
  db.audit_logs = [];
  nextId = 1;
});

describe("policy loop — unacknowledged policy signals", () => {
  it("fires a signal for every active employee once a policy is published", async () => {
    db.employees = [
      { id: "emp-a", tenant_id: "TENANT_A", lifecycle_state: "active", deleted_at: null },
      { id: "emp-b", tenant_id: "TENANT_A", lifecycle_state: "active", deleted_at: null },
      { id: "emp-x", tenant_id: "TENANT_X", lifecycle_state: "active", deleted_at: null },
    ];

    const created = await createPolicy(adminActor, {
      title: "Remote work policy",
      body: "Work from anywhere with overlap hours 10:00-14:00 UTC.",
      version: 1,
    });
    expect(created.is_published).toBe(false);

    const storedPolicy = db.policies.find((row) => row.id === created.id) as Row;
    storedPolicy.created_at = "2026-07-01T00:00:00Z";
    storedPolicy.updated_at = "2026-07-01T00:00:00Z";
    storedPolicy.archived_at = null;

    // Draft policies generate nothing.
    const draftRun = await reconcileUnacknowledgedPolicySignals({
      tenantId: "TENANT_A",
      actorUserId: "admin-user",
      now: new Date("2026-07-02T00:00:00Z"),
    });
    expect(draftRun.createdSignals).toBe(0);
    expect(db.risk_signals).toHaveLength(0);

    const published = await publishPolicy(adminActor, created.id, "2026-07-01T00:00:00Z");
    expect(published.is_published).toBe(true);
    expect(
      db.audit_logs.some(
        (log) => log.action_type === "policy.published" && log.target_id === created.id,
      ),
    ).toBe(true);

    const result = await reconcileUnacknowledgedPolicySignals({
      tenantId: "TENANT_A",
      actorUserId: "admin-user",
      now: new Date("2026-07-02T00:00:00Z"),
    });

    expect(result.createdSignals).toBe(2);
    expect(result.resolvedSignals).toBe(0);

    const signals = db.risk_signals as Array<{
      tenant_id: string;
      kind: string;
      severity: string;
      subject_employee_id: string;
      resolved_at: string | null;
    }>;
    expect(signals).toHaveLength(2);
    expect(signals.every((s) => s.tenant_id === "TENANT_A")).toBe(true);
    expect(signals.every((s) => s.kind === "unacknowledged_policy")).toBe(true);
    expect(signals.every((s) => s.severity === "yellow")).toBe(true);
    expect(signals.map((s) => s.subject_employee_id).sort()).toEqual(["emp-a", "emp-b"]);

    const actions = db.action_items as Array<{ tenant_id: string; category: string; status: string }>;
    expect(actions).toHaveLength(2);
    expect(actions.every((a) => a.tenant_id === "TENANT_A")).toBe(true);
    expect(actions.every((a) => a.category === "unacknowledged_policy")).toBe(true);
    expect(actions.every((a) => a.status === "open")).toBe(true);

    const pending = await listUnacknowledgedForEmployee(employeeActor);
    expect(pending).toHaveLength(1);
    expect(pending[0]?.id).toBe(created.id);
  });

  it("resolves the signal and action item after the employee acknowledges", async () => {
    db.employees = [
      { id: "emp-a", tenant_id: "TENANT_A", lifecycle_state: "active", deleted_at: null },
    ];
    db.policies = [
      {
        id: "11111111-1111-4111-8111-111111111111",
        tenant_id: "TENANT_A",
        title: "Code of conduct",
        body: "Be excellent to each other.",
        version: 1,
        is_published: true,
        created_at: "2026-07-01T00:00:00Z",
        updated_at: "2026-07-01T00:00:00Z",
        archived_at: null,
      },
    ];
    db.risk_signals = [
      {
        id: "signal-open",
        tenant_id: "TENANT_A",
        kind: "unacknowledged_policy",
        severity: "yellow",
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
        category: "unacknowledged_policy",
        status: "open",
      },
    ];

    await acknowledgePolicy(employeeActor, { policyId: "11111111-1111-4111-8111-111111111111", policyVersion: 1 });

    const acks = db.acknowledgements as Array<{
      tenant_id: string;
      policy_id: string;
      policy_version: number;
      employee_id: string;
    }>;
    expect(acks).toHaveLength(1);
    expect(acks[0]).toMatchObject({
      tenant_id: "TENANT_A",
      policy_id: "11111111-1111-4111-8111-111111111111",
      policy_version: 1,
      employee_id: "emp-a",
    });
    expect(db.audit_logs.some((log) => log.action_type === "policy.acknowledged")).toBe(true);

    // Acknowledging again is idempotent — no duplicate rows, no error.
    await acknowledgePolicy(employeeActor, { policyId: "11111111-1111-4111-8111-111111111111", policyVersion: 1 });
    expect(db.acknowledgements).toHaveLength(1);

    const result = await reconcileUnacknowledgedPolicySignals({
      tenantId: "TENANT_A",
      actorUserId: "admin-user",
      now: new Date("2026-07-03T00:00:00Z"),
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

    expect(
      db.audit_logs.some((log) => log.action_type === "signal.unacknowledged_policy.resolved"),
    ).toBe(true);

    const pending = await listUnacknowledgedForEmployee(employeeActor);
    expect(pending).toHaveLength(0);
  });

  it("refuses acknowledgement of drafts, archived policies, and stale versions", async () => {
    db.employees = [
      { id: "emp-a", tenant_id: "TENANT_A", lifecycle_state: "active", deleted_at: null },
    ];
    db.policies = [
      {
        id: "22222222-2222-4222-8222-222222222222",
        tenant_id: "TENANT_A",
        title: "Draft policy",
        body: "Not yet published.",
        version: 1,
        is_published: false,
        created_at: "2026-07-01T00:00:00Z",
        updated_at: "2026-07-01T00:00:00Z",
        archived_at: null,
      },
      {
        id: "33333333-3333-4333-8333-333333333333",
        tenant_id: "TENANT_A",
        title: "Old policy",
        body: "Superseded.",
        version: 1,
        is_published: true,
        created_at: "2026-07-01T00:00:00Z",
        updated_at: "2026-07-01T00:00:00Z",
        archived_at: "2026-07-02T00:00:00Z",
      },
      {
        id: "44444444-4444-4444-8444-444444444444",
        tenant_id: "TENANT_A",
        title: "Live policy",
        body: "Current version is 2.",
        version: 2,
        is_published: true,
        created_at: "2026-07-01T00:00:00Z",
        updated_at: "2026-07-01T00:00:00Z",
        archived_at: null,
      },
    ];

    await expect(
      acknowledgePolicy(employeeActor, { policyId: "22222222-2222-4222-8222-222222222222", policyVersion: 1 }),
    ).rejects.toThrow("POLICY_NOT_PUBLISHED");
    await expect(
      acknowledgePolicy(employeeActor, { policyId: "33333333-3333-4333-8333-333333333333", policyVersion: 1 }),
    ).rejects.toThrow("POLICY_NOT_PUBLISHED");
    await expect(
      acknowledgePolicy(employeeActor, { policyId: "44444444-4444-4444-8444-444444444444", policyVersion: 1 }),
    ).rejects.toThrow("STALE_WRITE");
    expect(db.acknowledgements).toHaveLength(0);

    // Only the live, published, non-archived policy is surfaced to the employee.
    const pending = await listUnacknowledgedForEmployee(employeeActor);
    expect(pending.map((p) => p.id)).toEqual(["44444444-4444-4444-8444-444444444444"]);
  });
});
