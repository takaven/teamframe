import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/telemetry/logger", () => ({ logAction: vi.fn() }));
vi.mock("@/lib/telemetry/sentry", () => ({ captureActionError: vi.fn() }));
vi.mock("@/services/signalEngine", () => ({
  runSignalEngineForTenant: vi.fn(async () => {}),
}));

const rows = {
  employees: [] as Array<Record<string, unknown>>,
  compensation: [] as Array<Record<string, unknown>>,
  leaves: [] as Array<Record<string, unknown>>,
  documents: [] as Array<Record<string, unknown>>,
  file_operations: [] as Array<Record<string, unknown>>,
  export_files: [] as Array<Record<string, unknown>>,
  audit_logs: [] as Array<Record<string, unknown>>,
};

const storageUpload = vi.fn();
const storageSignedUrl = vi.fn();

function applyFilters(data: Array<Record<string, unknown>>, filters: Array<(row: Record<string, unknown>) => boolean>) {
  return data.filter((row) => filters.every((fn) => fn(row)));
}

function makeBuilder(table: keyof typeof rows) {
  let mode: "select" | "insert" | "update" = "select";
  let insertRows: Array<Record<string, unknown>> = [];
  let patch: Record<string, unknown> = {};
  let single = false;
  const filters: Array<(row: Record<string, unknown>) => boolean> = [];

  const resolve = () => {
    const currentRows = rows[table];
    const matching = applyFilters(currentRows, filters);
    if (mode === "select") {
      const data = single ? matching[0] ?? null : matching;
      return { data, error: null };
    }
    if (mode === "insert") {
      const inserted = insertRows.map((row, index) => ({ id: row.id ?? `${table}-${index + 1}`, ...row }));
      currentRows.push(...inserted);
      return { data: single ? inserted[0] ?? null : inserted, error: null };
    }
    for (const row of matching) {
      Object.assign(row, patch);
    }
    return { data: single ? matching[0] ?? null : matching, error: null };
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
      filters.push((row) => (value === null ? row[column] == null : row[column] === value));
      return builder;
    },
    in: (column: string, values: unknown[]) => {
      filters.push((row) => values.includes(row[column]));
      return builder;
    },
    gte: (column: string, value: string) => {
      filters.push((row) => typeof row[column] === "string" && row[column] >= value);
      return builder;
    },
    lte: (column: string, value: string) => {
      filters.push((row) => typeof row[column] === "string" && row[column] <= value);
      return builder;
    },
    insert: (payload: unknown) => {
      mode = "insert";
      insertRows = Array.isArray(payload)
        ? (payload as Array<Record<string, unknown>>)
        : [payload as Record<string, unknown>];
      return builder;
    },
    update: (payload: unknown) => {
      mode = "update";
      patch = payload as Record<string, unknown>;
      return builder;
    },
    single: async () => {
      single = true;
      return resolve();
    },
    maybeSingle: async () => {
      single = true;
      return resolve();
    },
    then: (fn: (value: unknown) => unknown) => fn(resolve()),
  };
  return builder;
}

vi.mock("@/lib/db/supabaseServer", () => ({
  createServiceRoleClient: () => ({
    from: (table: string) => makeBuilder(table as keyof typeof rows),
    storage: {
      from: () => ({
        upload: storageUpload,
        createSignedUrl: storageSignedUrl,
      }),
    },
  }),
}));

import { exportFinanceHandoffUrl } from "@/services/documentService";
import type { Actor } from "@/middleware/rbac";

const actor: Actor = {
  authUserId: "admin-user",
  tenantId: "TENANT_A",
  employeeId: "admin-employee",
  role: "admin",
} as Actor;

beforeEach(() => {
  vi.clearAllMocks();
  for (const key of Object.keys(rows) as Array<keyof typeof rows>) {
    rows[key] = [];
  }
  rows.employees = [
    {
      id: "emp-a",
      tenant_id: "TENANT_A",
      full_name: "Amina Rahman",
      employment_type: "full_time",
      country: "UAE",
      start_date: "2026-01-01",
      end_date: null,
      lifecycle_state: "active",
      status: "active",
      deleted_at: null,
    },
  ];
  storageUpload.mockResolvedValue({ error: null });
});

describe("export reliability", () => {
  it("marks export metadata deleted and operation failed when retrieval URL generation fails", async () => {
    storageSignedUrl.mockResolvedValue({ data: null, error: { message: "provider unavailable" } });

    await expect(exportFinanceHandoffUrl(actor)).rejects.toThrow("DOCUMENT_EXPORT_FAILED: provider unavailable");

    expect(rows.export_files).toHaveLength(1);
    expect(rows.export_files[0]?.deleted_at).toBeTruthy();
    expect(rows.file_operations).toHaveLength(1);
    expect(rows.file_operations[0]?.status).toBe("failed");
    expect(rows.audit_logs).toHaveLength(0);
  });

  it("records successful export only after a retrievable signed URL exists", async () => {
    storageSignedUrl.mockResolvedValue({
      data: { signedUrl: "https://signed.example/export.zip" },
      error: null,
    });

    const url = await exportFinanceHandoffUrl(actor);

    expect(url).toBe("https://signed.example/export.zip");
    expect(rows.export_files).toHaveLength(1);
    expect(rows.export_files[0]?.deleted_at).toBeUndefined();
    expect(rows.file_operations[0]?.status).toBe("succeeded");
    expect(rows.audit_logs[0]?.action_type).toBe("document.exported_finance_handoff");
  });
});
