import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Bypass Next's server-only guard so service modules can load under Node.
vi.mock("server-only", () => ({}));

const root = process.cwd();
const read = (p: string): string => readFileSync(path.join(root, p), "utf8");

// ── Supabase double ─────────────────────────────────────────────────────────
//
// Records every filter applied per table so the tests can prove that a tenant
// filter is applied on EVERY dataset read, not merely on the ones a happy-path
// test happens to touch.

type Recorded = { table: string; eq: Array<[string, unknown]>; read: boolean };
const recorded: Recorded[] = [];
let rowsByTable: Record<string, Array<Record<string, unknown>>> = {};

function makeBuilder(table: string) {
  const entry: Recorded = { table, eq: [], read: false };
  recorded.push(entry);
  const rows = rowsByTable[table] ?? [];
  const builder: Record<string, unknown> = {};
  builder.select = () => {
    entry.read = true;
    return builder;
  };
  builder.eq = (column: string, value: unknown) => {
    entry.eq.push([column, value]);
    return builder;
  };
  builder.order = () => builder;
  builder.range = (from: number) =>
    Promise.resolve({ data: from === 0 ? rows : [], error: null });
  // Write side of the shared export lifecycle (file_operations / export_files).
  builder.insert = () => builder;
  builder.update = () => builder;
  builder.is = () => builder;
  builder.single = () => Promise.resolve({ data: { id: "op-1" }, error: null });
  builder.maybeSingle = () => Promise.resolve({ data: { id: "op-1" }, error: null });
  builder.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve({ data: rows, error: null }).then(resolve);
  return builder;
}

const storageDownload = vi.fn(async () => ({ data: null, error: { message: "not used" } }));
const storageUpload = vi.fn(async () => ({ error: null }));
const storageSigned = vi.fn(async () => ({
  data: { signedUrl: "https://example.test/signed.zip" },
  error: null,
}));

vi.mock("@/lib/db/supabaseServer", () => ({
  createServiceRoleClient: () => ({
    from: (table: string) => makeBuilder(table),
    storage: {
      from: () => ({
        download: storageDownload,
        upload: storageUpload,
        createSignedUrl: storageSigned,
        remove: async () => ({ error: null }),
      }),
    },
  }),
}));

const requireCapabilityMock = vi.fn(async () => {});
vi.mock("@/lib/rbac/access", () => ({
  requireCapability: (...args: unknown[]) => requireCapabilityMock(...(args as [])),
  canReadPrivateDocuments: async () => true,
  canRunFinanceExport: async () => true,
  hasCapability: async () => true,
}));

vi.mock("@/lib/telemetry/logger", () => ({ logAction: () => {} }));
vi.mock("@/lib/telemetry/sentry", () => ({ captureActionError: () => {} }));
vi.mock("@/services/signalEngine", () => ({ runSignalEngineForTenant: async () => {} }));
vi.mock("@/services/hrAutomation", () => ({
  ensureAutomationItem: async () => {},
  runAutomationItem: async () => {},
}));

const ACTOR = { tenantId: "TENANT_A", role: "admin", authUserId: "u1", employeeId: null } as never;

beforeEach(() => {
  recorded.length = 0;
  rowsByTable = {};
  requireCapabilityMock.mockClear();
  requireCapabilityMock.mockImplementation(async () => {});
});

describe("Whole-tenant export — permission and tenant isolation", () => {
  it("is refused unless the actor holds the Full Access capability", async () => {
    const { exportTenantData } = await import("@/services/documentService");
    requireCapabilityMock.mockImplementation(async () => {
      throw new Error("FORBIDDEN");
    });
    await expect(exportTenantData(ACTOR)).rejects.toThrow("FORBIDDEN");
    // Nothing was read before the capability check failed.
    expect(recorded).toHaveLength(0);
  });

  it("gates on company_access_settings, which only Full Access holds", async () => {
    const { exportTenantData } = await import("@/services/documentService");
    await exportTenantData(ACTOR);
    expect(requireCapabilityMock).toHaveBeenCalledWith(ACTOR, "company_access_settings");

    const profiles = read("lib/rbac/access.ts");
    const fullAccessBlock = profiles.slice(
      profiles.indexOf("full_access: ["),
      profiles.indexOf("employee: []"),
    );
    expect(fullAccessBlock).toContain("company_access_settings");
    // No other profile grants it.
    const adminBlock = profiles.slice(profiles.indexOf("admin: ["), profiles.indexOf("finance: ["));
    expect(adminBlock).not.toContain("company_access_settings");
    const financeBlock = profiles.slice(
      profiles.indexOf("finance: ["),
      profiles.indexOf("full_access: ["),
    );
    expect(financeBlock).not.toContain("company_access_settings");
  });

  it("applies a tenant filter to EVERY dataset it reads", async () => {
    const { exportTenantData } = await import("@/services/documentService");
    await exportTenantData(ACTOR);

    const LIFECYCLE_TABLES = new Set(["file_operations", "export_files"]);
    const datasetReads = recorded.filter((r) => r.read && !LIFECYCLE_TABLES.has(r.table));
    expect(datasetReads.length).toBeGreaterThan(25);
    for (const call of datasetReads) {
      // `companies` is the tenant root: its own id IS the tenant id.
      const column = call.table === "companies" ? "id" : "tenant_id";
      const scoped = call.eq.some(([c, v]) => c === column && v === "TENANT_A");
      expect(scoped, `${call.table} was read without .eq("${column}", tenantId)`).toBe(true);
    }
  });

  it("never reads a table without a tenant filter, even one returning no rows", async () => {
    const { exportTenantData } = await import("@/services/documentService");
    await exportTenantData(ACTOR);
    const LIFECYCLE_TABLES = new Set(["file_operations", "export_files"]);
    const unscoped = recorded
      .filter((call) => call.read && !LIFECYCLE_TABLES.has(call.table))
      .filter((call) => call.eq.length === 0);
    expect(unscoped).toEqual([]);
  });

  it("cannot be pointed at another tenant's rows", async () => {
    const { exportTenantData } = await import("@/services/documentService");
    await exportTenantData(ACTOR);
    for (const call of recorded) {
      for (const [, value] of call.eq) {
        expect(value).not.toBe("TENANT_B");
      }
    }
  });

  it("covers the principal HR datasets, not just a token few", async () => {
    const { exportTenantData } = await import("@/services/documentService");
    await exportTenantData(ACTOR);
    const tables = new Set(recorded.filter((r) => r.read).map((r) => r.table));
    for (const expected of [
      "companies",
      "employees",
      "departments",
      "positions",
      "leaves",
      "leave_definitions",
      "onboarding_tasks",
      "policies",
      "acknowledgements",
      "documents",
      "document_requirements",
      "employment_changes",
      "probation_reviews",
      "compensation",
      "tenant_memberships",
      "audit_logs",
    ]) {
      expect(tables.has(expected), `dataset missing from export: ${expected}`).toBe(true);
    }
  });

  it("exports no infrastructure, credential or telemetry tables", async () => {
    const { exportTenantData } = await import("@/services/documentService");
    await exportTenantData(ACTOR);
    const tables = new Set(recorded.map((r) => r.table));
    for (const forbidden of ["analytics_events", "setup_import_batches", "hr_automation_events", "employee_join_initializations"]) {
      expect(tables.has(forbidden), `must not export internal table: ${forbidden}`).toBe(false);
    }
    const source = read("services/documentService/index.ts");
    const exportBlock = source.slice(source.indexOf("TENANT_EXPORT_DATASETS"));
    for (const secret of ["SERVICE_ROLE", "process.env", "anon_key", "access_token"]) {
      expect(exportBlock).not.toContain(secret);
    }
  });
});

describe("Whole-tenant export — CSV shape", () => {
  it("writes a header row and one row per record, with stable columns", async () => {
    const { tenantExportRowsToCsv } = await import("@/services/documentService");
    const csv = tenantExportRowsToCsv([
      { id: "1", full_name: "Maya Chen", manager_id: null },
      { id: "2", full_name: "Jordan Vale", manager_id: "1" },
    ]);
    const lines = csv.trim().split("\n");
    expect(lines[0]).toContain("id");
    expect(lines[0]).toContain("full_name");
    expect(lines).toHaveLength(3);
    expect(csv).toContain("Maya Chen");
  });

  it("renders null as empty and objects as JSON, never [object Object]", async () => {
    const { tenantExportRowsToCsv } = await import("@/services/documentService");
    const csv = tenantExportRowsToCsv([{ a: null, b: { nested: true }, c: [1, 2] }]);
    expect(csv).not.toContain("[object Object]");
    expect(csv).toContain("nested");
  });

  it("returns empty output for an empty dataset rather than throwing", async () => {
    const { tenantExportRowsToCsv } = await import("@/services/documentService");
    expect(tenantExportRowsToCsv([])).toBe("");
  });
});

describe("Installation & support facts", () => {
  it("reports only the named fields and omits what cannot be determined", async () => {
    const { buildInstallationFacts } = await import("@/lib/company/installation");
    const facts = buildInstallationFacts({
      productVersion: "1.0.0",
      installationName: "Northstar Advisory",
      installationId: "TENANT_A",
      appUrl: null,
      releaseRef: null,
    });
    const labels = facts.map((f) => f.label);
    expect(labels).toContain("TeamFrame version");
    expect(labels).toContain("Installation");
    expect(labels).toContain("Installation ID");
    expect(labels).not.toContain("Application address");
    expect(labels).not.toContain("Release");
  });

  it("shows only the origin of an application URL, never a full URL with query", async () => {
    const { buildInstallationFacts } = await import("@/lib/company/installation");
    const facts = buildInstallationFacts({
      productVersion: "1.0.0",
      installationName: "Northstar Advisory",
      installationId: "TENANT_A",
      appUrl: "https://hr.example.com/setup?section=access&token=abc123",
    });
    const url = facts.find((f) => f.label === "Application address");
    expect(url?.value).toBe("https://hr.example.com");
    expect(url?.value).not.toContain("token");
  });

  it("ignores a malformed application URL instead of printing it raw", async () => {
    const { buildInstallationFacts } = await import("@/lib/company/installation");
    const facts = buildInstallationFacts({
      productVersion: "1.0.0",
      installationName: "N",
      installationId: null,
      appUrl: "not-a-url",
    });
    expect(facts.some((f) => f.label === "Application address")).toBe(false);
  });

  it("shortens a full commit sha to a readable release ref", async () => {
    const { buildInstallationFacts } = await import("@/lib/company/installation");
    const facts = buildInstallationFacts({
      productVersion: "1.0.0",
      installationName: "N",
      installationId: null,
      releaseRef: "b9b85072e3a3d063db0ba668463d0ad10fb25956",
    });
    expect(facts.find((f) => f.label === "Release")?.value).toBe("b9b8507");
  });

  it("states responsibilities without inventing live system status", async () => {
    const { INSTALLATION_RESPONSIBILITIES } = await import("@/lib/company/installation");
    const labels = INSTALLATION_RESPONSIBILITIES.map((f) => f.label);
    expect(labels).toContain("Backups");
    expect(labels).toContain("Support access");
    const source = read("lib/company/installation.ts");
    // Pure module: no database, no environment, no network.
    expect(source).not.toContain("process.env");
    expect(source).not.toContain("createServiceRoleClient");
    expect(source).not.toContain("fetch(");
  });
});

describe("Printable employee record", () => {
  it("prints through the browser only — no PDF engine is introduced", () => {
    const pkg = JSON.parse(read("package.json")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const all = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
    for (const banned of ["puppeteer", "pdfkit", "jspdf", "playwright", "@react-pdf/renderer", "html-pdf", "wkhtmltopdf"]) {
      expect(Object.keys(all)).not.toContain(banned);
    }
    expect(read("components/PrintRecordButton.tsx")).toContain("window.print()");
  });

  it("scopes printing to the record and hides application chrome", () => {
    const css = read("app/globals.css");
    expect(css).toContain("@media print");
    expect(css).toContain(".tf-print-record");
    expect(css).toContain(".tf-print-hide");
    // Everything is hidden first, then only the record is revealed.
    expect(css).toMatch(/body \*\s*\{\s*visibility: hidden;/);
    // Interactive controls are not part of a printed record.
    for (const selector of [".tf-print-record button", ".tf-print-record form", '.tf-print-record [role="tablist"]']) {
      expect(css).toContain(selector);
    }
  });

  it("marks the employee record for print and offers the action", () => {
    const page = read("app/employees/page.tsx");
    expect(page).toContain("tf-print-record");
    expect(page).toContain("PrintRecordButton");
    // The print action itself must not appear on the printed page.
    expect(page).toContain("tf-print-hide");
  });
});
