import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  maybeSingle: vi.fn(),
  listRows: [] as Array<Record<string, unknown>>,
  employeeRows: [] as Array<Record<string, unknown>>,
  canProcess: vi.fn(),
  upload: vi.fn(),
  softDelete: vi.fn(),
  signedUrl: vi.fn(),
  notifyReady: vi.fn(),
}));

vi.mock("@/lib/db/supabaseServer", () => ({
  createServiceRoleClient: () => ({
    rpc: mocks.rpc,
    from: (table: string) => {
      const filters: Array<(row: Record<string, unknown>) => boolean> = [];
      const builder: Record<string, unknown> = {};
      builder.select = () => builder;
      builder.eq = (column: string, value: unknown) => { filters.push((row) => row[column] === value); return builder; };
      builder.in = (column: string, values: unknown[]) => { filters.push((row) => values.includes(row[column])); return builder; };
      const result = () => (table === "employees" ? mocks.employeeRows : mocks.listRows).filter((row) => filters.every((filter) => filter(row)));
      builder.order = () => Promise.resolve({ data: result(), error: null });
      builder.then = (resolve: (value: unknown) => unknown) => resolve({ data: result(), error: null });
      builder.maybeSingle = mocks.maybeSingle;
      return builder;
    },
  }),
}));

vi.mock("@/lib/rbac/access", () => ({
  canProcessEmployeeDocumentRequest: mocks.canProcess,
}));

vi.mock("@/services/documentService", () => ({
  uploadDocument: mocks.upload,
  softDeleteDocument: mocks.softDelete,
  getSignedDownloadUrl: mocks.signedUrl,
}));

vi.mock("@/services/notificationService", () => ({
  notifyEmployeeDocumentReady: mocks.notifyReady,
}));

import {
  EMPLOYEE_DOCUMENT_REQUEST_TYPES,
  isSalarySensitiveEmployeeDocumentRequest,
  isSalarySensitiveHrIssuedDocumentType,
  parseEmployeeDocumentRequestInput,
} from "@/lib/employeeDocumentRequests";
import {
  canAccessEmployeeDocumentRequest,
  completeEmployeeDocumentRequest,
  createEmployeeDocumentRequest,
  getEmployeeDocumentRequestDownloadUrl,
  listOwnEmployeeDocumentRequests,
  listProcessableEmployeeDocumentRequests,
  markEmployeeDocumentRequestInProgress,
} from "@/services/employeeDocumentRequestService";
import type { Actor } from "@/middleware/rbac";
import { EXPECTED_PUBLIC_TABLES, SCHEMA_ORDER } from "../scripts/schema-order.mjs";

const root = process.cwd();
const tenantId = "22222222-2222-4222-8222-222222222222";
const employeeId = "33333333-3333-4333-8333-333333333333";
const requestId = "44444444-4444-4444-8444-444444444444";
const documentId = "55555555-5555-4555-8555-555555555555";
const actor: Actor = {
  authUserId: "11111111-1111-4111-8111-111111111111",
  email: "aisha@example.test",
  role: "employee",
  tenantId,
  employeeId,
};

const requestRow = {
  id: requestId,
  tenant_id: tenantId,
  employee_id: employeeId,
  request_type: "salary_certificate",
  details: "Address to Emirates NBD",
  needed_by: "2026-10-20",
  status: "requested",
  final_document_id: null,
  automation_item_id: "66666666-6666-4666-8666-666666666666",
  requested_by_user_id: actor.authUserId,
  requested_at: "2026-10-08T08:00:00.000Z",
  completed_by_user_id: null,
  completed_at: null,
  created_at: "2026-10-08T08:00:00.000Z",
  updated_at: "2026-10-08T08:00:00.000Z",
};

function read(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.listRows = [];
  mocks.employeeRows = [];
  mocks.canProcess.mockResolvedValue(false);
  mocks.softDelete.mockResolvedValue(undefined);
  mocks.notifyReady.mockResolvedValue(undefined);
});

describe("employee document requests", () => {
  it("accepts exactly the fixed v1 types and requires useful details for Other", () => {
    expect(EMPLOYEE_DOCUMENT_REQUEST_TYPES).toEqual([
      "salary_certificate", "salary_transfer_letter", "noc",
      "employment_certificate", "experience_letter", "other",
    ]);
    for (const requestType of EMPLOYEE_DOCUMENT_REQUEST_TYPES.filter((type) => type !== "other")) {
      expect(parseEmployeeDocumentRequestInput({ requestType }, new Date("2026-10-08T00:00:00Z")).requestType).toBe(requestType);
    }
    expect(() => parseEmployeeDocumentRequestInput({ requestType: "other", details: "" })).toThrow();
    expect(parseEmployeeDocumentRequestInput({ requestType: "other", details: "Visa copy letter" }).details).toBe("Visa copy letter");
    expect(() => parseEmployeeDocumentRequestInput({ requestType: "noc", neededBy: "2026-10-07" }, new Date("2026-10-08T00:00:00Z"))).toThrow("EMPLOYEE_DOCUMENT_REQUEST_NEEDED_BY_PAST");
    expect(isSalarySensitiveEmployeeDocumentRequest("salary_certificate")).toBe(true);
    expect(isSalarySensitiveEmployeeDocumentRequest("salary_transfer_letter")).toBe(true);
    expect(isSalarySensitiveEmployeeDocumentRequest("noc")).toBe(false);
    expect(isSalarySensitiveHrIssuedDocumentType("hr_issued_salary_certificate")).toBe(true);
    expect(isSalarySensitiveHrIssuedDocumentType("hr_issued_noc")).toBe(false);
  });

  it("derives the employee from the authenticated actor when creating a request", async () => {
    mocks.rpc.mockResolvedValue({ data: requestRow, error: null });
    await createEmployeeDocumentRequest(actor, {
      requestType: "salary_certificate",
      details: "Address to Emirates NBD",
      neededBy: "2026-10-20",
    });
    expect(mocks.rpc).toHaveBeenCalledWith("teamframe_create_employee_document_request", expect.objectContaining({
      p_tenant_id: tenantId,
      p_employee_id: employeeId,
      p_request_type: "salary_certificate",
      p_actor_user_id: actor.authUserId,
    }));
    await expect(createEmployeeDocumentRequest({ ...actor, employeeId: null }, { requestType: "noc" })).rejects.toThrow("NO_EMPLOYEE_RECORD");
  });

  it("lists only the signed-in employee's tenant-scoped requests", async () => {
    mocks.listRows = [requestRow];
    const rows = await listOwnEmployeeDocumentRequests(actor);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.label).toBe("Salary Certificate");
  });

  it("does not grant access to another employee unless both processing scopes pass", async () => {
    expect(await canAccessEmployeeDocumentRequest(actor, employeeId, "salary_certificate")).toBe(true);
    expect(await canAccessEmployeeDocumentRequest(actor, "other-employee", "salary_certificate")).toBe(false);
    mocks.canProcess.mockResolvedValue(true);
    expect(await canAccessEmployeeDocumentRequest(actor, "other-employee", "salary_certificate")).toBe(true);
  });

  it("filters the processing queue by target employee and request type", async () => {
    mocks.listRows = [requestRow, { ...requestRow, id: "request-2", request_type: "noc" }, { ...requestRow, id: "request-3", employee_id: "employee-2", request_type: "noc" }];
    mocks.employeeRows = [
      { id: employeeId, tenant_id: tenantId, full_name: "Aisha Rahman", role_title: "Consultant" },
      { id: "employee-2", tenant_id: tenantId, full_name: "Other Person", role_title: "Analyst" },
    ];
    mocks.canProcess.mockImplementation(async (_actor: Actor, targetEmployeeId: string, requestType: string) => targetEmployeeId === employeeId && requestType === "noc");
    const rows = await listProcessableEmployeeDocumentRequests({ ...actor, role: "admin" });
    expect(rows).toEqual([expect.objectContaining({ id: "request-2", employee_name: "Aisha Rahman", request_type: "noc" })]);
    expect(mocks.canProcess).toHaveBeenCalledWith(expect.anything(), employeeId, "salary_certificate");
    expect(mocks.canProcess).toHaveBeenCalledWith(expect.anything(), employeeId, "noc");
  });

  it("repeats request-type-aware authorization for direct processor actions", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: requestRow, error: null });
    mocks.canProcess.mockResolvedValue(false);
    const processor = { ...actor, employeeId: "processor", role: "admin" as const };
    await expect(markEmployeeDocumentRequestInProgress(processor, requestId)).rejects.toThrow("FORBIDDEN");
    await expect(completeEmployeeDocumentRequest(processor, { requestId, file: { size: 100 } as File })).rejects.toThrow("FORBIDDEN");
    await expect(getEmployeeDocumentRequestDownloadUrl(processor, requestId)).rejects.toThrow("FORBIDDEN");
    expect(mocks.canProcess).toHaveBeenCalledWith(processor, employeeId, "salary_certificate");
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it("uploads once, atomically links Ready, and emits the employee notification once", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: requestRow, error: null });
    mocks.canProcess.mockResolvedValue(true);
    mocks.upload.mockResolvedValue({ id: documentId });
    mocks.rpc.mockResolvedValue({
      data: { ...requestRow, status: "ready", final_document_id: documentId, completed_at: "2026-10-08T09:00:00.000Z" },
      error: null,
    });
    const file = { size: 100 } as File;
    const result = await completeEmployeeDocumentRequest({ ...actor, role: "admin" }, { requestId, file });
    expect(mocks.upload).toHaveBeenCalledTimes(1);
    expect(mocks.upload).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      employeeId,
      type: "hr_issued_salary_certificate",
      file,
    }), expect.anything());
    expect(mocks.rpc).toHaveBeenCalledWith("teamframe_complete_employee_document_request", expect.objectContaining({ p_document_id: documentId }));
    expect(mocks.notifyReady).toHaveBeenCalledTimes(1);
    expect(result.status).toBe("ready");
  });

  it("compensates the private upload if the atomic request link fails", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: requestRow, error: null });
    mocks.canProcess.mockResolvedValue(true);
    mocks.upload.mockResolvedValue({ id: documentId });
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "concurrent completion" } });
    await expect(completeEmployeeDocumentRequest({ ...actor, role: "admin" }, { requestId, file: { size: 100 } as File })).rejects.toThrow("EMPLOYEE_DOCUMENT_REQUEST_COMPLETE_FAILED");
    expect(mocks.softDelete).toHaveBeenCalledWith(expect.anything(), documentId);
    expect(mocks.notifyReady).not.toHaveBeenCalled();
  });

  it("gates final download by request ownership and Ready status", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: { ...requestRow, status: "ready", final_document_id: documentId }, error: null });
    mocks.signedUrl.mockResolvedValue("https://signed.example.test/document");
    await expect(getEmployeeDocumentRequestDownloadUrl(actor, requestId)).resolves.toContain("signed.example.test");
    mocks.maybeSingle.mockResolvedValue({ data: { ...requestRow, employee_id: "other", status: "ready", final_document_id: documentId }, error: null });
    await expect(getEmployeeDocumentRequestDownloadUrl(actor, requestId)).rejects.toThrow("FORBIDDEN");
  });

  it("installs a narrow tenant-safe table without altering evidence completeness", () => {
    const schema = read("schemas/employee_document_requests.sql");
    const migration = read("migrations/20261008_employee_document_requests.sql");
    const rls = read("schemas/access_model.sql");
    const reports = read("services/reportingService.ts");
    const completeness = read("lib/ui/documentLabels.ts");
    expect(SCHEMA_ORDER).toContain("employee_document_requests.sql");
    expect(EXPECTED_PUBLIC_TABLES).toContain("employee_document_requests");
    expect(schema).toContain("employee_document_requests_employee_same_tenant_fk");
    expect(schema).toContain("employee_document_requests_document_same_tenant_fk");
    expect(schema).toContain("teamframe_complete_employee_document_request");
    expect(schema).toContain("EMPLOYEE_DOCUMENT_REQUEST_ALREADY_READY");
    expect(schema).toContain("if p_needed_by is not null then");
    expect(schema).not.toContain("coalesce((p_needed_by::text");
    expect(migration).toMatch(/^--[\s\S]*begin;[\s\S]*commit;\s*$/);
    expect(rls).toContain("employee_document_requests_select");
    expect(rls).toContain("'people_operations'::access_capability");
    expect(rls).toContain("'private_employee_documents'::access_capability");
    expect(rls).toContain("'compensation_view'::access_capability");
    expect(rls).toContain("hr_issued_salary_certificate");
    expect(migration).toContain("hr_issued_salary_transfer_letter");
    expect(reports).not.toContain("employee_document_requests");
    expect(completeness).not.toContain("employee_document_requests");
  });

  it("keeps browser writes blocked, private files non-deletable while linked, and notifications idempotent", () => {
    const tenancy = read("schemas/tenancy_rls.sql");
    const documents = read("services/documentService/index.ts");
    const notifications = read("services/notificationService.ts");
    expect(tenancy).toContain("employee_document_requests_insert_blocked");
    expect(tenancy).toContain("employee_document_requests_update_blocked");
    expect(tenancy).toContain("employee_document_requests_delete_blocked");
    expect(documents).toContain("DOCUMENT_IN_USE_BY_EMPLOYEE_REQUEST");
    expect(notifications).toContain('employee-document-request:${requestId}:ready');
    expect(notifications).not.toContain("Address to Emirates NBD");
  });

  it("uses native existing surfaces and a mobile-safe single selected workflow", () => {
    const employeePage = read("app/documents-and-policies/page.tsx");
    const adminPage = read("app/documents/page.tsx");
    const dashboardData = read("app/dashboard/data.ts");
    expect(employeePage).toContain("Documents I&apos;ve requested");
    expect(employeePage).toContain("w-full tf-primary-action");
    expect(employeePage).toContain("sm:flex-row");
    expect(adminPage).toContain("Employee requests");
    expect(adminPage).toContain("canAccessEmployeeDocumentRequestQueue(actor)");
    expect(adminPage).toContain('id !== "employee-requests" || canAccessEmployeeRequestQueue');
    expect(adminPage).toContain("Upload & mark ready");
    expect(adminPage).toContain("The document is ready for the employee.");
    expect(adminPage).not.toContain("document generator");
    expect(dashboardData).not.toContain("employee_document_requests");
  });
});
