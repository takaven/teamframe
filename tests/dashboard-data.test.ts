import { beforeEach, describe, expect, it } from "vitest";
import { vi } from "vitest";

vi.mock("server-only", () => ({}));

type Row = Record<string, unknown>;

const db = {
  employees: [] as Row[],
  hr_automation_items: [] as Row[],
  risk_signals: [] as Row[],
  leaves: [] as Row[],
  document_requirements: [] as Row[],
  policies: [] as Row[],
  acknowledgements: [] as Row[],
  onboarding_tasks: [] as Row[],
  probation_reviews: [] as Row[],
  offboarding_cases: [] as Row[],
  offboarding_items: [] as Row[],
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
  builder.in = (column: string, values: unknown[]) => {
    filters.push((row) => values.includes(row[column]));
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

vi.mock("@/lib/db/supabaseServer", () => ({
  createServiceRoleClient: () => ({
    from: (table: string) => makeBuilder(table as keyof typeof db),
  }),
}));

import { loadControlCentreData } from "@/app/dashboard/data";

beforeEach(() => {
  stalledTable = null;
  for (const key of Object.keys(db) as Array<keyof typeof db>) {
    db[key] = [];
  }
  db.employees = [
    {
      id: "emp-active",
      tenant_id: "TENANT_A",
      full_name: "Amina Rahman",
      status: "active",
      setup_status: "active",
      lifecycle_state: "active",
      start_date: "2026-01-01",
      end_date: null,
      deleted_at: null,
    },
    {
      id: "emp-former",
      tenant_id: "TENANT_A",
      full_name: "Former Person",
      status: "inactive",
      setup_status: "active",
      lifecycle_state: "exited",
      start_date: "2025-01-01",
      end_date: "2026-01-31",
      deleted_at: "2026-02-01T00:00:00Z",
    },
  ];
});

describe("Control Centre data", () => {
  it("derives due, overdue, decision and exception totals from current source records", async () => {
    db.leaves = [
      {
        id: "leave-pending",
        tenant_id: "TENANT_A",
        employee_id: "emp-active",
        start_date: "2026-08-15",
        end_date: "2026-08-16",
        leave_type: "annual",
        status: "pending",
        updated_at: "2026-08-10T00:00:00Z",
      },
    ];
    db.document_requirements = [
      {
        id: "doc-overdue",
        tenant_id: "TENANT_A",
        employee_id: "emp-active",
        document_type: "passport",
        due_date: "2026-08-01",
        review_required: false,
        state: "requested",
        updated_at: "2026-08-01T00:00:00Z",
      },
      {
        id: "doc-review",
        tenant_id: "TENANT_A",
        employee_id: "emp-active",
        document_type: "contract",
        due_date: "2026-08-12",
        review_required: true,
        state: "received",
        updated_at: "2026-08-12T00:00:00Z",
      },
    ];
    db.risk_signals = [
      {
        id: "signal-open",
        tenant_id: "TENANT_A",
        kind: "onboarding_check_in_follow_up",
        severity: "yellow",
        subject_employee_id: "emp-active",
        evidence: { what_is_wrong: "A blocker was reported." },
        last_seen_at: "2026-08-12T00:00:00Z",
        resolved_at: null,
      },
      {
        id: "signal-resolved",
        tenant_id: "TENANT_A",
        kind: "leave_conflict",
        severity: "yellow",
        subject_employee_id: "emp-active",
        evidence: {},
        last_seen_at: "2026-08-11T00:00:00Z",
        resolved_at: "2026-08-11T12:00:00Z",
      },
    ];

    const result = await loadControlCentreData({
      tenantId: "TENANT_A",
      now: new Date("2026-08-12T12:00:00Z"),
      savedDataTimeoutMs: 50,
    });

    expect(result.savedDataStatus).toEqual({ state: "success" });
    expect(result.summary).toMatchObject({
      total: 4,
      decisions: 2,
      overdue: 1,
      due: 0,
      exceptions: 1,
      resolved: 1,
    });
    expect(result.allItems.map((item) => item.id)).toEqual([
      "signal:signal-open",
      "document:doc-review",
      "leave:leave-pending",
      "document:doc-overdue",
    ]);
  });

  it("excludes former employees, archived policies, cancelled leave and replaced documents from current state", async () => {
    db.policies = [
      {
        id: "policy-current",
        tenant_id: "TENANT_A",
        title: "Current handbook",
        version: 2,
        is_published: true,
        archived_at: null,
        updated_at: "2026-08-01T00:00:00Z",
      },
      {
        id: "policy-archived",
        tenant_id: "TENANT_A",
        title: "Old handbook",
        version: 1,
        is_published: true,
        archived_at: "2026-08-01T00:00:00Z",
        updated_at: "2026-07-01T00:00:00Z",
      },
    ];
    db.acknowledgements = [
      {
        tenant_id: "TENANT_A",
        policy_id: "policy-current",
        policy_version: 2,
        employee_id: "emp-former",
      },
    ];
    db.leaves = [
      {
        id: "leave-cancelled",
        tenant_id: "TENANT_A",
        employee_id: "emp-active",
        start_date: "2026-08-10",
        end_date: "2026-08-11",
        leave_type: "annual",
        status: "cancelled",
        updated_at: "2026-08-09T00:00:00Z",
      },
    ];
    db.document_requirements = [
      {
        id: "doc-replaced",
        tenant_id: "TENANT_A",
        employee_id: "emp-active",
        document_type: "passport",
        due_date: "2026-08-01",
        review_required: false,
        state: "replaced",
        updated_at: "2026-08-01T00:00:00Z",
      },
      {
        id: "doc-former",
        tenant_id: "TENANT_A",
        employee_id: "emp-former",
        document_type: "visa",
        due_date: "2026-08-01",
        review_required: false,
        state: "requested",
        updated_at: "2026-08-01T00:00:00Z",
      },
    ];

    const result = await loadControlCentreData({
      tenantId: "TENANT_A",
      now: new Date("2026-08-12T12:00:00Z"),
      savedDataTimeoutMs: 50,
    });

    expect(result.activeEmployeeCount).toBe(1);
    expect(result.summary.total).toBe(1);
    expect(result.allItems).toHaveLength(1);
    expect(result.allItems[0]?.id).toBe("policy:policy-current:2:emp-active");
  });

  it("keeps headline totals independent from the preview limit", async () => {
    db.onboarding_tasks = Array.from({ length: 8 }, (_, index) => ({
      id: `task-${index}`,
      tenant_id: "TENANT_A",
      employee_id: "emp-active",
      title: `Task ${index}`,
      status: "pending",
      owner_role: "employee",
      due_date: "2026-08-12",
      updated_at: `2026-08-12T00:00:0${index}Z`,
    }));

    const result = await loadControlCentreData({
      tenantId: "TENANT_A",
      now: new Date("2026-08-12T12:00:00Z"),
      savedDataTimeoutMs: 50,
    });

    expect(result.summary.total).toBe(8);
    expect(result.previewItems).toHaveLength(6);
    expect(result.allItems).toHaveLength(8);
  });

  it("does not show an all-clear when the current-state read times out", async () => {
    stalledTable = "employees";

    const result = await loadControlCentreData({
      tenantId: "TENANT_A",
      now: new Date("2026-08-12T12:00:00Z"),
      savedDataTimeoutMs: 1,
    });

    expect(result.savedDataStatus).toEqual({ state: "timeout" });
    expect(result.summary.total).toBe(0);
  });
});
