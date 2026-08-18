import { describe, it, expect, vi, beforeEach } from "vitest";

// Bypass Next's server-only guard so the service module loads under Node.
vi.mock("server-only", () => ({}));

// A configurable Supabase mock: from(table) resolves to a per-table result, and
// rpc() resolves to the created leave row. Tests mutate `definitionResult` to shape
// the definition the request resolves against.
type Result = { data: unknown; error: unknown; count?: number };

let definitionResult: Result = { data: null, error: null };

const createdLeaveRow = {
  id: "leave-created",
  tenant_id: "TENANT_A",
  employee_id: "emp-1",
  start_date: "2026-06-01",
  end_date: "2026-06-02",
  leave_type: "other",
  leave_definition_id: "def-1",
  requested_days: 2,
  reason: null,
  status: "pending",
  decided_by_user_id: null,
  decided_at: null,
  decision_note: null,
  override_insufficient_balance: false,
  override_reason: null,
  cancelled_by_user_id: null,
  cancelled_at: null,
  cancellation_reason: null,
  approval_automation_item_id: null,
  created_at: "2026-05-30T00:00:00Z",
  updated_at: "2026-05-30T00:00:00Z",
};

const eligibleEmployee = {
  id: "emp-1",
  status: "active",
  setup_status: "active",
  lifecycle_state: "active",
  start_date: "2025-01-01",
  end_date: null,
  deleted_at: null,
};

function builderFor(result: Result) {
  const builder: Record<string, unknown> = {};
  const chain = () => () => builder;
  for (const m of ["select", "eq", "in", "is", "order", "limit", "single", "maybeSingle", "insert", "update", "delete"]) {
    builder[m] = chain();
  }
  (builder as { then: unknown }).then = (resolve: (v: unknown) => unknown) => resolve(result);
  return builder;
}

const fakeClient = {
  from: (table: string) => {
    if (table === "leave_definitions") return builderFor(definitionResult);
    if (table === "employees") return builderFor({ data: eligibleEmployee, error: null });
    if (table === "leaves") return builderFor({ data: [], error: null, count: 1 });
    return builderFor({ data: null, error: null });
  },
  rpc: () => builderFor({ data: createdLeaveRow, error: null }),
};

vi.mock("@/lib/db/supabaseServer", () => ({
  createServiceRoleClient: () => fakeClient,
  createServerClient: () => fakeClient,
}));
vi.mock("@/lib/telemetry/track", () => ({ track: vi.fn(async () => {}) }));
vi.mock("@/services/onboardingService", () => ({ maybeFireActivationCompleted: vi.fn(async () => {}) }));
vi.mock("@/services/offboardingService", () => ({
  assertLeaveDoesNotExceedActiveOffboardingEndDate: vi.fn(async () => {}),
}));
const uploadDocumentMock = vi.fn(async () => ({ id: "evidence-doc-1" }));
const softDeleteDocumentMock = vi.fn(async () => {});
vi.mock("@/services/documentService", () => ({
  uploadDocument: (...args: unknown[]) => uploadDocumentMock(...(args as [])),
  softDeleteDocument: (...args: unknown[]) => softDeleteDocumentMock(...(args as [])),
}));

const evidenceFile = () => new File([new Uint8Array([1, 2, 3, 4])], "note.pdf", { type: "application/pdf" });

import { submitLeaveRequest } from "@/services/leaveService";
import type { Actor } from "@/middleware/rbac";

const actor: Actor = {
  authUserId: "user-1",
  email: "emp@example.com",
  employeeId: "emp-1",
  tenantId: "TENANT_A",
  role: "employee",
};

function def(overrides: Record<string, unknown>) {
  definitionResult = {
    data: { id: "def-1", system_leave_type: "other", counting_basis: "working_days", attachment_requirement: "not_required", active: true, archived_at: null, ...overrides },
    error: null,
  };
}

beforeEach(() => {
  definitionResult = { data: null, error: null };
  uploadDocumentMock.mockClear();
  softDeleteDocumentMock.mockClear();
});

describe("submitLeaveRequest — definition + attachment enforcement", () => {
  it("C: required attachment blocks submission without evidence", async () => {
    def({ attachment_requirement: "required" });
    await expect(
      submitLeaveRequest(actor, { startDate: "2026-06-01", endDate: "2026-06-02", leaveDefinitionId: "def-1" }),
    ).rejects.toThrow("LEAVE_ATTACHMENT_REQUIRED");
    expect(uploadDocumentMock).not.toHaveBeenCalled();
  });

  it("C: required attachment is accepted and the evidence is stored via document infra", async () => {
    def({ attachment_requirement: "required" });
    const rec = await submitLeaveRequest(actor, { startDate: "2026-06-01", endDate: "2026-06-02", leaveDefinitionId: "def-1", attachment: evidenceFile() });
    expect(rec.id).toBe("leave-created");
    expect(uploadDocumentMock).toHaveBeenCalledTimes(1);
  });

  it("D: optional attachment allows submission without evidence", async () => {
    def({ attachment_requirement: "optional" });
    const rec = await submitLeaveRequest(actor, { startDate: "2026-06-01", endDate: "2026-06-02", leaveDefinitionId: "def-1" });
    expect(rec.id).toBe("leave-created");
    expect(uploadDocumentMock).not.toHaveBeenCalled();
  });

  it("E: not_required attachment allows submission without evidence", async () => {
    def({ attachment_requirement: "not_required" });
    const rec = await submitLeaveRequest(actor, { startDate: "2026-06-01", endDate: "2026-06-02", leaveDefinitionId: "def-1" });
    expect(rec.id).toBe("leave-created");
  });

  it("stores evidence even when the type does not require it (optional + file)", async () => {
    def({ attachment_requirement: "optional" });
    const rec = await submitLeaveRequest(actor, { startDate: "2026-06-01", endDate: "2026-06-02", leaveDefinitionId: "def-1", attachment: evidenceFile() });
    expect(rec.id).toBe("leave-created");
    expect(uploadDocumentMock).toHaveBeenCalledTimes(1);
  });

  it("rejects a definition that does not resolve (wrong tenant / missing)", async () => {
    definitionResult = { data: null, error: null };
    await expect(
      submitLeaveRequest(actor, { startDate: "2026-06-01", endDate: "2026-06-02", leaveDefinitionId: "def-x", attachment: evidenceFile() }),
    ).rejects.toThrow("LEAVE_DEFINITION_INVALID");
  });

  it("rejects an inactive definition", async () => {
    def({ active: false });
    await expect(
      submitLeaveRequest(actor, { startDate: "2026-06-01", endDate: "2026-06-02", leaveDefinitionId: "def-1", attachment: evidenceFile() }),
    ).rejects.toThrow("LEAVE_DEFINITION_INVALID");
  });
});
