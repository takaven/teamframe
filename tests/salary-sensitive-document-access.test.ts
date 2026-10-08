import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  documentRows: [] as Array<Record<string, unknown>>,
  employeeRows: [] as Array<Record<string, unknown>>,
  requirementRows: [] as Array<Record<string, unknown>>,
  canReadPrivate: vi.fn(),
  canViewCompensation: vi.fn(),
  requireCapability: vi.fn(),
  createSignedUrl: vi.fn(),
}));

function makeBuilder(table: string) {
  const filters: Array<(row: Record<string, unknown>) => boolean> = [];
  const builder: Record<string, unknown> = {};
  const source = () => table === "documents"
    ? mocks.documentRows
    : table === "employees"
      ? mocks.employeeRows
      : table === "document_requirements"
        ? mocks.requirementRows
        : [];
  const result = () => source().filter((row) => filters.every((filter) => filter(row)));
  builder.select = () => builder;
  builder.eq = (column: string, value: unknown) => { filters.push((row) => row[column] === value); return builder; };
  builder.is = (column: string, value: unknown) => { filters.push((row) => row[column] === value); return builder; };
  builder.in = (column: string, values: unknown[]) => { filters.push((row) => values.includes(row[column])); return builder; };
  builder.order = () => Promise.resolve({ data: result(), error: null });
  builder.maybeSingle = () => Promise.resolve({ data: result()[0] ?? null, error: null });
  builder.then = (resolve: (value: unknown) => unknown) => resolve({ data: result(), error: null });
  return builder;
}

vi.mock("@/lib/db/supabaseServer", () => ({
  createServiceRoleClient: () => ({
    from: (table: string) => makeBuilder(table),
    storage: {
      from: () => ({ createSignedUrl: mocks.createSignedUrl }),
    },
  }),
}));

vi.mock("@/lib/rbac/access", () => ({
  canReadPrivateDocuments: mocks.canReadPrivate,
  canViewCompensation: mocks.canViewCompensation,
  requireCapability: mocks.requireCapability,
  canRunFinanceExport: vi.fn(async () => false),
}));

vi.mock("@/lib/telemetry/logger", () => ({ logAction: vi.fn() }));
vi.mock("@/lib/telemetry/sentry", () => ({ captureActionError: vi.fn() }));
vi.mock("@/services/signalEngine", () => ({ runSignalEngineForTenant: vi.fn() }));
vi.mock("@/services/hrAutomation", () => ({ ensureAutomationItem: vi.fn(), runAutomationItem: vi.fn() }));

import {
  getSignedDownloadUrl,
  listDocumentsForEmployee,
  listWorkspaceDocuments,
} from "@/services/documentService";
import type { Actor } from "@/middleware/rbac";

const tenantId = "22222222-2222-4222-8222-222222222222";
const employeeId = "33333333-3333-4333-8333-333333333333";
const processor: Actor = { authUserId: "processor", email: "ops@example.test", role: "admin", tenantId, employeeId: null };
const employee: Actor = { authUserId: "employee", email: "employee@example.test", role: "employee", tenantId, employeeId };

const salaryDocument = {
  id: "salary-document",
  tenant_id: tenantId,
  employee_id: employeeId,
  type: "other",
  document_type: "hr_issued_salary_certificate",
  file_url: `${tenantId}/${employeeId}/salary.pdf`,
  signed_at: null,
  issued_at: null,
  reference_number: null,
  expires_at: null,
  replaced_at: null,
  replaced_by_document_id: null,
  subject_person_id: employeeId,
  created_at: "2026-10-08T00:00:00.000Z",
  deleted_at: null,
};

const nocDocument = {
  ...salaryDocument,
  id: "noc-document",
  document_type: "hr_issued_noc",
  file_url: `${tenantId}/${employeeId}/noc.pdf`,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.documentRows = [salaryDocument, nocDocument];
  mocks.employeeRows = [{ id: employeeId, tenant_id: tenantId, full_name: "Aisha Rahman", role_title: "Consultant" }];
  mocks.requirementRows = [];
  mocks.canReadPrivate.mockResolvedValue(true);
  mocks.canViewCompensation.mockResolvedValue(false);
  mocks.requireCapability.mockResolvedValue(undefined);
  mocks.createSignedUrl.mockResolvedValue({ data: { signedUrl: "https://signed.example.test/document" }, error: null });
});

describe("salary-sensitive HR-issued document access", () => {
  it("filters salary-bearing metadata from employee and workspace lists without compensation access", async () => {
    const employeeDocuments = await listDocumentsForEmployee(processor, employeeId);
    expect(employeeDocuments.map((document) => document.id)).toEqual(["noc-document"]);

    const workspace = await listWorkspaceDocuments(processor);
    expect(workspace.documents.map((document) => document.id)).toEqual(["noc-document"]);
  });

  it("allows authorised compensation viewers to see salary-bearing documents", async () => {
    mocks.canViewCompensation.mockResolvedValue(true);
    const documents = await listDocumentsForEmployee(processor, employeeId);
    expect(documents.map((document) => document.id)).toEqual(["salary-document", "noc-document"]);
  });

  it("denies a direct signed URL for salary documents while preserving non-salary access", async () => {
    await expect(getSignedDownloadUrl(processor, "salary-document")).rejects.toThrow("FORBIDDEN");
    expect(mocks.createSignedUrl).not.toHaveBeenCalled();

    await expect(getSignedDownloadUrl(processor, "noc-document")).resolves.toContain("signed.example.test");
  });

  it("preserves employee self-access to their own salary-bearing document", async () => {
    mocks.canReadPrivate.mockResolvedValue(true);
    mocks.canViewCompensation.mockResolvedValue(false);
    await expect(getSignedDownloadUrl(employee, "salary-document")).resolves.toContain("signed.example.test");
    const documents = await listDocumentsForEmployee(employee, employeeId);
    expect(documents.map((document) => document.id)).toContain("salary-document");
  });

  it("enforces the same salary gate on upload/delete source paths and RLS", () => {
    const service = readFileSync(join(process.cwd(), "services/documentService/index.ts"), "utf8");
    const accessModel = readFileSync(join(process.cwd(), "schemas/access_model.sql"), "utf8");
    expect(service).toContain("isSalarySensitiveHrIssuedDocumentType(normalizedInputType)");
    expect(service).toContain('requireCapability(actor, "compensation_view", { employeeId: input.employeeId })');
    expect(service).toContain("isSalarySensitiveHrIssuedDocumentType(document.document_type ?? document.type)");
    expect(accessModel).toContain("hr_issued_salary_certificate");
    expect(accessModel).toContain("'compensation_view'::access_capability");
  });
});
