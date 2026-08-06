import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

type Row = Record<string, unknown>;

const db = {
  employees: [] as Row[],
};

let authUser: {
  id: string;
  email: string;
  app_metadata: Record<string, unknown>;
} | null = null;

const updates: Row[] = [];

function makeBuilder(table: keyof typeof db) {
  let mode: "select" | "update" = "select";
  let updatePatch: Row = {};
  let single = false;
  let limitCount: number | null = null;
  const filters: Array<(row: Row) => boolean> = [];

  const resolveNow = () => {
    const rows = db[table].filter((row) => filters.every((fn) => fn(row)));
    const limitedRows = limitCount === null ? rows : rows.slice(0, limitCount);

    if (mode === "update") {
      for (const row of limitedRows) {
        Object.assign(row, updatePatch);
        updates.push({ table, id: row.id, ...updatePatch });
      }
    }

    if (single) return { data: limitedRows[0] ?? null, error: null };
    return { data: limitedRows, error: null };
  };

  const builder: Record<string, unknown> = {
    select: () => builder,
    eq: (column: string, value: unknown) => {
      filters.push((row) => row[column] === value);
      return builder;
    },
    is: (column: string, value: unknown) => {
      if (value === null) filters.push((row) => row[column] == null);
      return builder;
    },
    limit: (count: number) => {
      limitCount = count;
      return builder;
    },
    update: (payload: unknown) => {
      mode = "update";
      updatePatch = payload as Row;
      return builder;
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
    auth: {
      admin: {
        getUserById: async () => ({ data: { user: authUser }, error: null }),
      },
    },
    from: (table: string) => makeBuilder(table as keyof typeof db),
  }),
}));

import { resolveIdentity } from "@/lib/rbac/roles";

beforeEach(() => {
  db.employees = [];
  updates.length = 0;
  authUser = {
    id: "auth-user-1",
    email: "shared@example.test",
    app_metadata: { role: "employee", tenant_id: "TENANT_A" },
  };
});

describe("resolveIdentity tenant binding", () => {
  it("scopes email fallback to the JWT tenant before linking or activation", async () => {
    db.employees = [
      {
        id: "emp-b",
        tenant_id: "TENANT_B",
        auth_user_id: null,
        email: "shared@example.test",
        setup_status: "ready",
        deleted_at: null,
      },
      {
        id: "emp-a",
        tenant_id: "TENANT_A",
        auth_user_id: null,
        email: "shared@example.test",
        setup_status: "ready",
        deleted_at: null,
      },
    ];

    const identity = await resolveIdentity("auth-user-1");

    expect(identity).toMatchObject({
      authUserId: "auth-user-1",
      employeeId: "emp-a",
      tenantId: "TENANT_A",
      role: "employee",
    });
    expect(db.employees.find((row) => row.id === "emp-a")?.auth_user_id).toBe("auth-user-1");
    expect(db.employees.find((row) => row.id === "emp-b")?.auth_user_id).toBeNull();
  });

  it("hard-fails before writes when an auth_user_id link belongs to another tenant", async () => {
    db.employees = [
      {
        id: "emp-b",
        tenant_id: "TENANT_B",
        auth_user_id: "auth-user-1",
        email: "shared@example.test",
        setup_status: "ready",
        deleted_at: null,
      },
      {
        id: "emp-a",
        tenant_id: "TENANT_A",
        auth_user_id: null,
        email: "shared@example.test",
        setup_status: "ready",
        deleted_at: null,
      },
    ];

    await expect(resolveIdentity("auth-user-1")).rejects.toThrow("RBAC: tenant mismatch");

    expect(updates).toHaveLength(0);
    expect(db.employees.find((row) => row.id === "emp-a")?.auth_user_id).toBeNull();
    expect(db.employees.find((row) => row.id === "emp-b")?.setup_status).toBe("ready");
  });

  it("does not bind by email when the JWT tenant has no matching employee", async () => {
    db.employees = [
      {
        id: "emp-b",
        tenant_id: "TENANT_B",
        auth_user_id: null,
        email: "shared@example.test",
        setup_status: "ready",
        deleted_at: null,
      },
    ];

    const identity = await resolveIdentity("auth-user-1");

    expect(identity).toMatchObject({
      authUserId: "auth-user-1",
      employeeId: null,
      tenantId: "TENANT_A",
      role: "employee",
    });
    expect(updates).toHaveLength(0);
    expect(db.employees[0]?.auth_user_id).toBeNull();
  });

  it("returns an unlinked employee identity when tenant metadata is missing", async () => {
    authUser = {
      id: "auth-user-1",
      email: "shared@example.test",
      app_metadata: { role: "employee" },
    };
    db.employees = [
      {
        id: "emp-a",
        tenant_id: "TENANT_A",
        auth_user_id: null,
        email: "shared@example.test",
        setup_status: "ready",
        deleted_at: null,
      },
    ];

    const identity = await resolveIdentity("auth-user-1");

    expect(identity).toMatchObject({
      authUserId: "auth-user-1",
      employeeId: null,
      tenantId: null,
      role: "employee",
    });
    expect(updates).toHaveLength(0);
    expect(db.employees[0]?.auth_user_id).toBeNull();
  });
});
