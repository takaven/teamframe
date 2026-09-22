import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/supabaseServer", () => ({ createServiceRoleClient: vi.fn() }));

import { createServiceRoleClient } from "@/lib/db/supabaseServer";
import { listDocumentRequirementsForEmployee } from "@/services/documentService";

describe("pre-start evidence read", () => {
  it("fails closed when current-document expiry lookup fails", async () => {
    const requirement = {
      id: "requirement-1", employee_id: "employee-1", document_type: "contract",
      state: "accepted", current_document_id: "document-1", due_date: "2026-10-15",
      expiry_required: true, review_required: true, employee_upload_allowed: true,
    };
    const from = vi.fn((table: string) => ({
      select: () => table === "document_requirements"
        ? { eq: () => ({ eq: () => ({ order: async () => ({ data: [requirement], error: null }) }) }) }
        : { eq: () => ({ in: async () => ({ data: null, error: { message: "expiry unavailable" } }) }) },
    }));
    vi.mocked(createServiceRoleClient).mockReturnValue({ from } as never);
    const actor = { authUserId: "admin-1", tenantId: "tenant-1", employeeId: null, role: "admin" as const, email: "admin@example.test" };
    await expect(listDocumentRequirementsForEmployee(actor, "employee-1")).rejects.toThrow("DOCUMENT_REQUIREMENT_LIST_FAILED: expiry unavailable");
  });
  it("does not treat soft-deleted evidence as current", async () => {
    const requirement = {
      id: "requirement-1", employee_id: "employee-1", document_type: "contract",
      state: "accepted", current_document_id: "document-1", due_date: "2026-10-15",
      expiry_required: false, review_required: false, employee_upload_allowed: true,
    };
    const from = vi.fn((table: string) => ({
      select: () => table === "document_requirements"
        ? { eq: () => ({ eq: () => ({ order: async () => ({ data: [requirement], error: null }) }) }) }
        : { eq: () => ({ in: async () => ({ data: [{ id: "document-1", expires_at: null, deleted_at: "2026-10-01T00:00:00Z" }], error: null }) }) },
    }));
    vi.mocked(createServiceRoleClient).mockReturnValue({ from } as never);
    const actor = { authUserId: "admin-1", tenantId: "tenant-1", employeeId: null, role: "admin" as const, email: "admin@example.test" };
    const records = await listDocumentRequirementsForEmployee(actor, "employee-1");
    expect(records[0]?.current_document_id).toBeNull();
  });
});
