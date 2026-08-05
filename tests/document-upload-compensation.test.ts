/**
 * BUG-1 regression test (no-silent-failures audit, fixed Wave 4).
 *
 * When the documents DB insert fails after the storage upload succeeded,
 * uploadDocument must run a compensating storage delete AND check its result:
 *  - compensation attempted exactly once with the uploaded path
 *  - a failed compensation is logged (console.error) and captured to Sentry —
 *    never silent — while the original DOCUMENT_RECORD_CREATE_FAILED still
 *    propagates to the caller
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/telemetry/logger", () => ({ logAction: vi.fn() }));
vi.mock("@/lib/telemetry/sentry", () => ({ captureActionError: vi.fn() }));
vi.mock("@/services/signalEngine", () => ({
  runSignalEngineForTenant: vi.fn(async () => {}),
}));

const storageUpload = vi.fn();
const storageRemove = vi.fn();
const storageListBuckets = vi.fn();

const insertSingle = vi.fn();
const fileOperationSingle = vi.fn();
const fileOperationUpdateEq = vi.fn();
const auditInsert = vi.fn();

function makeDocumentBuilder() {
  return {
    insert: () => ({
      select: () => ({
        single: insertSingle,
      }),
    }),
  };
}

function makeFileOperationBuilder() {
  return {
    insert: () => ({
      select: () => ({
        single: fileOperationSingle,
      }),
    }),
    update: () => ({
      eq: fileOperationUpdateEq,
    }),
  };
}

function makeAuditBuilder() {
  return {
    insert: auditInsert,
  };
}

vi.mock("@/lib/db/supabaseServer", () => ({
  createServiceRoleClient: () => ({
    from: (table: string) => {
      if (table === "documents") return makeDocumentBuilder();
      if (table === "file_operations") return makeFileOperationBuilder();
      if (table === "audit_logs") return makeAuditBuilder();
      throw new Error(`unexpected table in test: ${table}`);
    },
    storage: {
      from: () => ({
        upload: storageUpload,
        remove: storageRemove,
      }),
      listBuckets: storageListBuckets,
    },
  }),
}));

import { uploadDocument } from "@/services/documentService";
import { captureActionError } from "@/lib/telemetry/sentry";
import type { Actor } from "@/middleware/rbac";

const adminActor: Actor = {
  authUserId: "auth-user-1",
  tenantId: "tenant-1",
  role: "admin",
  employeeId: "employee-admin",
} as Actor;

function makeFile(): File {
  return new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])], "contract.pdf", {
    type: "application/pdf",
  });
}

describe("uploadDocument compensating storage delete (BUG-1)", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    storageListBuckets.mockResolvedValue({ data: [{ name: "documents", public: false }], error: null });
    storageUpload.mockResolvedValue({ error: null });
    fileOperationSingle.mockResolvedValue({ data: { id: "file-op-1" }, error: null });
    fileOperationUpdateEq.mockResolvedValue({ data: null, error: null });
    auditInsert.mockResolvedValue({ data: null, error: null });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("runs the compensating delete when the DB insert fails", async () => {
    insertSingle.mockResolvedValue({ data: null, error: { message: "insert exploded" } });
    storageRemove.mockResolvedValue({ data: null, error: null });

    await expect(
      uploadDocument(adminActor, {
        employeeId: "employee-1",
        type: "contract",
        file: makeFile(),
      }),
    ).rejects.toThrow("DOCUMENT_RECORD_CREATE_FAILED: insert exploded");

    expect(storageRemove).toHaveBeenCalledTimes(1);
    const removedPaths = storageRemove.mock.calls[0]?.[0] as string[];
    expect(removedPaths).toHaveLength(1);
    expect(removedPaths[0]).toContain("tenant-1/employee-1/");

    // Successful compensation: no orphan-specific error surface.
    const orphanLogs = consoleErrorSpy.mock.calls.filter(
      (call: unknown[]) => call[0] === "DOCUMENT_COMPENSATING_DELETE_FAILED",
    );
    expect(orphanLogs).toHaveLength(0);
    expect(fileOperationUpdateEq).toHaveBeenCalled();
  });

  it("surfaces a failed compensating delete instead of swallowing it", async () => {
    insertSingle.mockResolvedValue({ data: null, error: { message: "insert exploded" } });
    storageRemove.mockResolvedValue({
      data: null,
      error: { message: "bucket unavailable", status: 503 },
    });

    await expect(
      uploadDocument(adminActor, {
        employeeId: "employee-1",
        type: "contract",
        file: makeFile(),
      }),
    ).rejects.toThrow("DOCUMENT_RECORD_CREATE_FAILED: insert exploded");

    // Orphaned file must be visible: structured console.error with the path.
    const orphanLogs = consoleErrorSpy.mock.calls.filter(
      (call: unknown[]) => call[0] === "DOCUMENT_COMPENSATING_DELETE_FAILED",
    );
    expect(orphanLogs).toHaveLength(1);
    const logPayload = orphanLogs[0]?.[1] as Record<string, unknown>;
    expect(logPayload.tenant_id).toBe("tenant-1");
    expect(String(logPayload.storage_path)).toContain("tenant-1/employee-1/");

    // ...and captured to Sentry under its own action name.
    const captureCalls = vi.mocked(captureActionError).mock.calls;
    expect(
      captureCalls.some((call) => call[0] === "uploadDocumentCompensatingDelete"),
    ).toBe(true);
  });

  it("rejects oversized uploads before reading file bytes", async () => {
    const arrayBuffer = vi.fn(async () => new ArrayBuffer(0));
    const oversizedFile = {
      name: "contract.pdf",
      type: "application/pdf",
      size: 10 * 1024 * 1024 + 1,
      arrayBuffer,
    } as unknown as File;

    await expect(
      uploadDocument(adminActor, {
        employeeId: "employee-1",
        type: "contract",
        file: oversizedFile,
      }),
    ).rejects.toThrow("DOCUMENT_UPLOAD_TOO_LARGE");

    expect(arrayBuffer).not.toHaveBeenCalled();
    expect(storageListBuckets).not.toHaveBeenCalled();
    expect(storageUpload).not.toHaveBeenCalled();
  });

  it("rejects spoofed MIME/extension content before storage upload", async () => {
    const spoofedPdf = new File([new Uint8Array([0x50, 0x4b, 0x03, 0x04])], "contract.pdf", {
      type: "application/pdf",
    });

    await expect(
      uploadDocument(adminActor, {
        employeeId: "employee-1",
        type: "contract",
        file: spoofedPdf,
      }),
    ).rejects.toThrow("DOCUMENT_UPLOAD_SIGNATURE_MISMATCH");

    expect(storageListBuckets).toHaveBeenCalled();
    expect(fileOperationSingle).not.toHaveBeenCalled();
    expect(storageUpload).not.toHaveBeenCalled();
  });
});
