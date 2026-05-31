/**
 * Document service — server-side only.
 *
 * Scope lock (see docs/drift-guard.md):
 *  - upload, download, soft-delete, grouped export (ZIP/PDF)
 *  - NO e-signatures, approvals, versioning, retention engines, legal workflow
 *
 * Storage: Supabase Storage. Signed URLs are issued only after RBAC checks.
 */

import "server-only";
import type { Actor } from "@/middleware/rbac";
import { randomUUID } from "node:crypto";
import { Buffer } from "node:buffer";
import { createServiceRoleClient } from "@/lib/db/supabaseServer";
import { logAction } from "@/lib/telemetry/logger";
import { captureActionError } from "@/lib/telemetry/sentry";
import { runSignalEngineForTenant } from "@/services/signalEngine";

export type DocumentType = "cv" | "contract" | "jd" | "photo";

export type DocumentRecord = {
  id: string;
  employee_id: string;
  type: DocumentType;
  document_type: DocumentType;
  file_url: string;
  signed_at: string | null;
  expires_at: string | null;
  created_at: string;
};

type EmployeeExportRow = {
  id: string;
  full_name: string;
  email: string;
  role_title: string;
  department: string;
  employment_type: string | null;
  lifecycle_state: string | null;
  status: string;
  country: string | null;
  timezone: string;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
};

type PolicyAcknowledgementExportRow = {
  id: string;
  policy_id: string;
  policy_version: number;
  acknowledged_at: string;
  policies: {
    id: string;
    title: string;
    version: number;
    is_published: boolean;
    updated_at: string;
  } | null;
};

type AssetLogExportRow = {
  id: string;
  category: string;
  title: string;
  suggested_action: string;
  status: string;
  resolved_at: string | null;
  created_at: string;
};

type DocumentRow = DocumentRecord & {
  tenant_id: string;
  subject_person_id: string | null;
  deleted_at: string | null;
};

type FinanceEmployeeRow = {
  id: string;
  full_name: string;
  employment_type?: string | null;
  country?: string | null;
  start_date?: string | null;
  status: string;
};

type CompensationRow = {
  employee_id: string;
  base_salary: string | number;
  currency: string;
};

type ZipEntry = {
  name: string;
  data: Buffer;
};

const DOCUMENT_BUCKET = "documents";
const EXPORT_ZIP_MIME = "application/zip";
const EXPORT_ALLOWED_MIME_TYPES = [EXPORT_ZIP_MIME] as const;

const ID_FILE_NAME_PATTERN = /(passport|\bid\b|identity|visa|emirates|national)/i;

function makeCrcTable(): Uint32Array {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) !== 0 ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c >>> 0;
  }
  return table;
}

const CRC_TABLE = makeCrcTable();

function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) {
    const byte = data[i] ?? 0;
    const tableValue = CRC_TABLE[(crc ^ byte) & 0xff] ?? 0;
    crc = tableValue ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dateToDos(now: Date): { date: number; time: number } {
  const year = Math.max(now.getUTCFullYear(), 1980);
  const month = now.getUTCMonth() + 1;
  const day = now.getUTCDate();
  const hours = now.getUTCHours();
  const minutes = now.getUTCMinutes();
  const seconds = Math.floor(now.getUTCSeconds() / 2);
  const date = ((year - 1980) << 9) | (month << 5) | day;
  const time = (hours << 11) | (minutes << 5) | seconds;
  return { date, time };
}

function toSafeEntryName(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9._/\-]/g, "_");
  return cleaned.length > 0 ? cleaned : "file.bin";
}

function buildZip(entries: ZipEntry[], now: Date): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;
  const { date: dosDate, time: dosTime } = dateToDos(now);

  for (const entry of entries) {
    const name = toSafeEntryName(entry.name);
    const nameBuffer = Buffer.from(name, "utf-8");
    const data = entry.data;
    const crc = crc32(data);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(dosTime, 10);
    localHeader.writeUInt16LE(dosDate, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(data.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(nameBuffer.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localParts.push(localHeader, nameBuffer, data);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(dosTime, 12);
    centralHeader.writeUInt16LE(dosDate, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(data.length, 20);
    centralHeader.writeUInt32LE(data.length, 24);
    centralHeader.writeUInt16LE(nameBuffer.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    centralParts.push(centralHeader, nameBuffer);
    offset += localHeader.length + nameBuffer.length + data.length;
  }

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const endHeader = Buffer.alloc(22);
  endHeader.writeUInt32LE(0x06054b50, 0);
  endHeader.writeUInt16LE(0, 4);
  endHeader.writeUInt16LE(0, 6);
  endHeader.writeUInt16LE(entries.length, 8);
  endHeader.writeUInt16LE(entries.length, 10);
  endHeader.writeUInt32LE(centralSize, 12);
  endHeader.writeUInt32LE(offset, 16);
  endHeader.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, ...centralParts, endHeader]);
}

function extractStoredFileName(fileUrl: string): string {
  const lastSegment = fileUrl.split("/").pop() ?? "document.bin";
  const withoutUuidPrefix = lastSegment.replace(/^[0-9a-fA-F\-]{36}-/, "");
  return withoutUuidPrefix || "document.bin";
}

function toCsvField(value: string | number | null | undefined): string {
  const text = value == null ? "" : String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function buildDelimited(rows: string[][], delimiter: "," | "\t"): string {
  return rows.map((row) => row.map((cell) => toCsvField(cell)).join(delimiter)).join("\n");
}

function classifyDocumentFolder(doc: DocumentRecord): "contracts" | "ids" | "other" {
  if (doc.document_type === "contract" || doc.type === "contract") {
    return "contracts";
  }
  const fileName = extractStoredFileName(doc.file_url);
  if (ID_FILE_NAME_PATTERN.test(fileName)) {
    return "ids";
  }
  return "other";
}

async function downloadDocumentBytes(storagePath: string): Promise<Buffer> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.storage.from(DOCUMENT_BUCKET).download(storagePath);
  if (error || !data) {
    throw new Error(`DOCUMENT_EXPORT_FAILED: ${error?.message ?? "document download failed"}`);
  }
  return Buffer.from(await data.arrayBuffer());
}

function requireTenant(actor: Actor): string {
  if (!actor.tenantId) throw new Error("NO_TENANT_CONTEXT");
  return actor.tenantId;
}

function requireAdmin(actor: Actor): void {
  if (actor.role !== "admin") throw new Error("FORBIDDEN");
}

function isSchemaMissingColumnError(message: string): boolean {
  return message.toLowerCase().includes("does not exist");
}

function toStorageErrorLog(error: unknown): {
  status: number | null;
  error: string | null;
  message: string | null;
  raw: unknown;
} {
  if (!error || typeof error !== "object") {
    return {
      status: null,
      error: null,
      message: typeof error === "string" ? error : null,
      raw: error,
    };
  }

  const maybe = error as {
    status?: unknown;
    error?: unknown;
    message?: unknown;
  };

  return {
    status: typeof maybe.status === "number" ? maybe.status : null,
    error: typeof maybe.error === "string" ? maybe.error : null,
    message: typeof maybe.message === "string" ? maybe.message : null,
    raw: error,
  };
}

function assertExportMimeSupported(contentType: string): void {
  if (EXPORT_ALLOWED_MIME_TYPES.includes(contentType as (typeof EXPORT_ALLOWED_MIME_TYPES)[number])) {
    return;
  }

  throw new Error(`DOCUMENT_EXPORT_UNSUPPORTED_MIME: ${contentType}`);
}

async function writeAudit(actor: Actor, actionType: string, targetId?: string): Promise<void> {
  const tenantId = requireTenant(actor);
  const supabase = createServiceRoleClient();
  await supabase.from("audit_logs").insert({
    tenant_id: tenantId,
    actor_user_id: actor.authUserId,
    action_type: actionType,
    target_id: targetId ?? null,
  } as never);
}

function toPublicRecord(row: DocumentRow): DocumentRecord {
  const normalizedType = normalizeDocumentType(row.document_type ?? row.type);
  return {
    id: row.id,
    employee_id: row.employee_id,
    type: normalizedType,
    document_type: normalizedType,
    file_url: row.file_url,
    signed_at: row.signed_at,
    expires_at: row.expires_at,
    created_at: row.created_at,
  };
}

function normalizeDocumentType(input: string): DocumentType {
  const normalized = input.trim().toLowerCase();
  if (normalized === "contract") return "contract";
  if (normalized === "jd") return "jd";
  if (normalized === "photo") return "photo";
  return "cv";
}

function toLegacyType(value: DocumentType): "CV" | "CONTRACT" | "JD" | "PHOTO" {
  if (value === "contract") return "CONTRACT";
  if (value === "jd") return "JD";
  if (value === "photo") return "PHOTO";
  return "CV";
}

function buildStoragePath(tenantId: string, employeeId: string, fileName: string): string {
  const safeName = fileName.trim().replace(/[^a-zA-Z0-9._-]/g, "_") || "document.bin";
  return `${tenantId}/${employeeId}/${randomUUID()}-${safeName}`;
}

async function canReadEmployeeDocuments(actor: Actor, employeeId: string): Promise<boolean> {
  if (actor.role === "admin") return true;
  return actor.employeeId === employeeId;
}

export async function listDocumentsForEmployee(
  actor: Actor,
  employeeId: string,
): Promise<DocumentRecord[]> {
  const tenantId = requireTenant(actor);
  if (!(await canReadEmployeeDocuments(actor, employeeId))) {
    throw new Error("FORBIDDEN");
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("documents")
    .select("id, tenant_id, employee_id, type, document_type, file_url, signed_at, expires_at, subject_person_id, created_at, deleted_at")
    .eq("tenant_id", tenantId)
    .eq("employee_id", employeeId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`DOCUMENT_LIST_FAILED: ${error.message}`);
  }

  return ((data ?? []) as DocumentRow[]).map(toPublicRecord);
}

export async function uploadDocument(
  actor: Actor,
  input: {
    employeeId: string;
    type: DocumentType;
    file: File;
    subjectPersonId?: string;
    signedAt?: string | null;
    expiresAt?: string | null;
  },
): Promise<DocumentRecord> {
  const start = Date.now();
  const requestId = randomUUID();

  try {
    requireAdmin(actor);
    const tenantId = requireTenant(actor);

    const supabase = createServiceRoleClient();
    const path = buildStoragePath(tenantId, input.employeeId, input.file.name ?? "document.bin");
    const bytes = Buffer.from(await input.file.arrayBuffer());

    const { error: uploadError } = await supabase.storage
      .from(DOCUMENT_BUCKET)
      .upload(path, bytes, { contentType: input.file.type || "application/octet-stream", upsert: false });

    if (uploadError) {
      throw new Error(`DOCUMENT_UPLOAD_FAILED: ${uploadError.message}`);
    }

    const { data, error } = await supabase
      .from("documents")
      .insert({
        tenant_id: tenantId,
        employee_id: input.employeeId,
        type: toLegacyType(input.type),
        document_type: input.type,
        subject_person_id: input.subjectPersonId ?? input.employeeId,
        signed_at: input.signedAt ?? null,
        expires_at: input.expiresAt ?? null,
        file_url: path,
      } as never)
      .select("id, tenant_id, employee_id, type, document_type, file_url, signed_at, expires_at, subject_person_id, created_at, deleted_at")
      .single();

    if (error) {
      await supabase.storage.from(DOCUMENT_BUCKET).remove([path]);
      throw new Error(`DOCUMENT_RECORD_CREATE_FAILED: ${error.message}`);
    }

    const created = data as DocumentRow;
    await writeAudit(actor, "document.uploaded", created.id);
  await runSignalEngineForTenant({ tenantId, actorUserId: actor.authUserId });

    logAction({
      action: "uploadDocument",
      actorUserId: actor.authUserId,
      actorTenantId: actor.tenantId ?? null,
      durationMs: Date.now() - start,
      outcome: "ok",
      requestId,
    });

    return toPublicRecord(created);
  } catch (err) {
    captureActionError("uploadDocument", err, {
      actor_user_id: actor.authUserId,
      actor_tenant_id: actor.tenantId ?? null,
    });
    logAction({
      action: "uploadDocument",
      actorUserId: actor.authUserId,
      actorTenantId: actor.tenantId ?? null,
      durationMs: Date.now() - start,
      outcome: "fail",
      error: err,
      requestId,
    });
    throw err;
  }
}

export async function getSignedDownloadUrl(
  actor: Actor,
  documentId: string,
): Promise<string> {
  const tenantId = requireTenant(actor);
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from("documents")
    .select("id, tenant_id, employee_id, type, document_type, file_url, signed_at, expires_at, subject_person_id, created_at, deleted_at")
    .eq("tenant_id", tenantId)
    .eq("id", documentId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw new Error(`DOCUMENT_FETCH_FAILED: ${error.message}`);
  }
  if (!data) throw new Error("NOT_FOUND");
  if (!(await canReadEmployeeDocuments(actor, (data as DocumentRow).employee_id))) {
    throw new Error("FORBIDDEN");
  }

  const { data: signed, error: signedErr } = await supabase.storage
    .from(DOCUMENT_BUCKET)
    .createSignedUrl((data as DocumentRow).file_url, 60 * 10);

  if (signedErr || !signed?.signedUrl) {
    throw new Error(`DOCUMENT_SIGNED_URL_FAILED: ${signedErr?.message ?? "missing signed URL"}`);
  }

  return signed.signedUrl;
}

export async function softDeleteDocument(actor: Actor, documentId: string): Promise<void> {
  requireAdmin(actor);
  const tenantId = requireTenant(actor);
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from("documents")
    .update({ deleted_at: new Date().toISOString() } as never)
    .eq("tenant_id", tenantId)
    .eq("id", documentId)
    .is("deleted_at", null)
    .select("id, tenant_id, employee_id, type, document_type, file_url, signed_at, expires_at, subject_person_id, created_at, deleted_at")
    .maybeSingle();

  if (error) {
    throw new Error(`DOCUMENT_DELETE_FAILED: ${error.message}`);
  }
  if (!data) {
    throw new Error("NOT_FOUND");
  }

  await writeAudit(actor, "document.deleted", documentId);
}

export async function exportEmployeeDocumentsZip(
  actor: Actor,
  employeeId: string,
): Promise<Blob> {
  requireAdmin(actor);
  const docs = await listDocumentsForEmployee(actor, employeeId);
  const payload = JSON.stringify({
    generated_at: new Date().toISOString(),
    employee_id: employeeId,
    document_count: docs.length,
    documents: docs,
  });
  await writeAudit(actor, "document.assigned", employeeId);
  return new Blob([payload], { type: "application/json" });
}

function formatDateForFileName(date: Date): string {
  const year = String(date.getUTCFullYear());
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

export async function exportEmployeeDueDiligencePackUrl(
  actor: Actor,
  employeeId: string,
): Promise<string> {
  requireAdmin(actor);
  const tenantId = requireTenant(actor);
  const supabase = createServiceRoleClient();

  const fullEmployeeSelect =
    "id, full_name, email, role_title, department, employment_type, lifecycle_state, status, country, timezone, start_date, end_date, created_at, updated_at";
  const legacyEmployeeSelect =
    "id, full_name, email, role_title, department, status, timezone, created_at, updated_at";

  const { data: employeeData, error: employeeError } = await supabase
    .from("employees")
    .select(fullEmployeeSelect)
    .eq("tenant_id", tenantId)
    .eq("id", employeeId)
    .is("deleted_at", null)
    .maybeSingle();

  let exportEmployee = employeeData as EmployeeExportRow | null;

  if (employeeError && isSchemaMissingColumnError(employeeError.message)) {
    console.warn("DOCUMENT_EXPORT_SCHEMA_FALLBACK", {
      export_kind: "due_diligence_pack",
      tenant_id: tenantId,
      employee_id: employeeId,
      reason: employeeError.message,
    });
    const { data: legacyEmployeeData, error: legacyEmployeeError } = await supabase
      .from("employees")
      .select(legacyEmployeeSelect)
      .eq("tenant_id", tenantId)
      .eq("id", employeeId)
      .is("deleted_at", null)
      .maybeSingle();

    if (legacyEmployeeError) {
      throw new Error(`DOCUMENT_EXPORT_FAILED: ${legacyEmployeeError.message}`);
    }

    if (legacyEmployeeData) {
      const legacy = legacyEmployeeData as Omit<EmployeeExportRow, "employment_type" | "lifecycle_state" | "country" | "start_date" | "end_date">;
      exportEmployee = {
        ...legacy,
        employment_type: null,
        lifecycle_state: null,
        country: null,
        start_date: null,
        end_date: null,
      };
    }
  } else if (employeeError) {
    throw new Error(`DOCUMENT_EXPORT_FAILED: ${employeeError.message}`);
  }

  if (!exportEmployee) {
    throw new Error("NOT_FOUND");
  }

  const [documents, acknowledgementsResult, assetLogsResult] = await Promise.all([
    listDocumentsForEmployee(actor, employeeId),
    supabase
      .from("acknowledgements")
      .select("id, policy_id, policy_version, acknowledged_at, policies(id, title, version, is_published, updated_at)")
      .eq("tenant_id", tenantId)
      .eq("employee_id", employeeId)
      .order("acknowledged_at", { ascending: false }),
    supabase
      .from("action_items")
      .select("id, category, title, suggested_action, status, resolved_at, created_at")
      .eq("tenant_id", tenantId)
      .eq("subject_employee_id", employeeId)
      .or("category.ilike.%asset%,title.ilike.%asset%,suggested_action.ilike.%asset%,title.ilike.%return%,suggested_action.ilike.%return%")
      .order("created_at", { ascending: false }),
  ]);

  if (acknowledgementsResult.error) {
    throw new Error(`DOCUMENT_EXPORT_FAILED: ${acknowledgementsResult.error.message}`);
  }
  if (assetLogsResult.error) {
    throw new Error(`DOCUMENT_EXPORT_FAILED: ${assetLogsResult.error.message}`);
  }

  const now = new Date();
  const policyAcknowledgements = (acknowledgementsResult.data ?? []) as PolicyAcknowledgementExportRow[];
  const assetLogs = (assetLogsResult.data ?? []) as AssetLogExportRow[];
  const downloadedDocuments = await Promise.all(
    documents.map(async (document) => {
      const fileName = extractStoredFileName(document.file_url);
      const bytes = await downloadDocumentBytes(document.file_url);
      return {
        document,
        fileName,
        bytes,
        folder: classifyDocumentFolder(document),
      };
    }),
  );

  const manifest = {
    generated_at: now.toISOString(),
    export_kind: "due_diligence_pack",
    employee: exportEmployee,
    document_count: documents.length,
    policy_acknowledgement_count: policyAcknowledgements.length,
    asset_log_count: assetLogs.length,
    documents,
    policy_acknowledgements: policyAcknowledgements,
    asset_logs: assetLogs,
  };

  const zipEntries: ZipEntry[] = [
    {
      name: "manifest.json",
      data: Buffer.from(JSON.stringify(manifest, null, 2), "utf-8"),
    },
    {
      name: "employment/employee-record.json",
      data: Buffer.from(JSON.stringify(exportEmployee, null, 2), "utf-8"),
    },
    {
      name: "policy/policy-acknowledgements.json",
      data: Buffer.from(JSON.stringify(policyAcknowledgements, null, 2), "utf-8"),
    },
    {
      name: "assets/asset-evidence.json",
      data: Buffer.from(JSON.stringify(assetLogs, null, 2), "utf-8"),
    },
    {
      name: "documents/documents-index.json",
      data: Buffer.from(
        JSON.stringify(
          downloadedDocuments.map((item) => ({
            id: item.document.id,
            file_name: item.fileName,
            folder: item.folder,
            document_type: item.document.document_type,
            signed_at: item.document.signed_at,
            expires_at: item.document.expires_at,
          })),
          null,
          2,
        ),
        "utf-8",
      ),
    },
  ];

  for (const item of downloadedDocuments) {
    zipEntries.push({
      name: `documents/${item.folder}/${item.fileName}`,
      data: item.bytes,
    });
  }

  const payload = buildZip(zipEntries, now);
  assertExportMimeSupported(EXPORT_ZIP_MIME);

  const fileName = `due-diligence-pack-${employeeId}-${formatDateForFileName(now)}.zip`;
  const storagePath = `${tenantId}/exports/due-diligence/${employeeId}/${randomUUID()}.zip`;

  let signedUrl = "";
  try {
    const { error: uploadError } = await supabase.storage
      .from(DOCUMENT_BUCKET)
      .upload(storagePath, payload, {
        contentType: "application/zip",
        upsert: false,
      });

    if (uploadError) {
      const errorLog = toStorageErrorLog(uploadError);
      console.error("DOCUMENT_EXPORT_UPLOAD_FAILED", {
        export_kind: "due_diligence_pack",
        tenant_id: tenantId,
        employee_id: employeeId,
        storage_path: storagePath,
        ...errorLog,
      });
      throw uploadError;
    }

    const { data: signed, error: signedError } = await supabase.storage
      .from(DOCUMENT_BUCKET)
      .createSignedUrl(storagePath, 60 * 15, { download: fileName });

    if (signedError || !signed?.signedUrl) {
      const errorLog = toStorageErrorLog(signedError ?? { message: "missing signed URL" });
      console.error("DOCUMENT_EXPORT_SIGN_FAILED", {
        export_kind: "due_diligence_pack",
        tenant_id: tenantId,
        employee_id: employeeId,
        storage_path: storagePath,
        ...errorLog,
      });
      throw signedError ?? new Error("missing signed URL");
    }

    signedUrl = signed.signedUrl;
  } catch (e) {
    const errorLog = toStorageErrorLog(e);
    console.error("DOCUMENT_EXPORT_EXCEPTION", {
      export_kind: "due_diligence_pack",
      tenant_id: tenantId,
      employee_id: employeeId,
      storage_path: storagePath,
      ...errorLog,
    });
    throw new Error(`DOCUMENT_EXPORT_FAILED: ${errorLog.message ?? "unknown export error"}`);
  }

  await writeAudit(actor, "document.exported_due_diligence_pack", employeeId);
  return signedUrl;
}

export async function exportFinanceHandoffUrl(actor: Actor): Promise<string> {
  requireAdmin(actor);
  const tenantId = requireTenant(actor);
  const supabase = createServiceRoleClient();

  const employeeSelect = "id, full_name, employment_type, country, start_date, status";
  const legacyEmployeeSelect = "id, full_name, status";

  const { data: employeeData, error: employeeError } = await supabase
    .from("employees")
    .select(employeeSelect)
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .order("full_name", { ascending: true });

  let employees = (employeeData ?? []) as FinanceEmployeeRow[];

  if (employeeError && isSchemaMissingColumnError(employeeError.message)) {
    console.warn("DOCUMENT_EXPORT_SCHEMA_FALLBACK", {
      export_kind: "finance_handoff",
      tenant_id: tenantId,
      reason: employeeError.message,
    });
    const { data: legacyEmployeeData, error: legacyEmployeeError } = await supabase
      .from("employees")
      .select(legacyEmployeeSelect)
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .order("full_name", { ascending: true });

    if (legacyEmployeeError) {
      throw new Error(`DOCUMENT_EXPORT_FAILED: ${legacyEmployeeError.message}`);
    }

    employees = ((legacyEmployeeData ?? []) as FinanceEmployeeRow[]).map((employee) => ({
      ...employee,
      employment_type: null,
      country: null,
      start_date: null,
    }));
  } else if (employeeError) {
    throw new Error(`DOCUMENT_EXPORT_FAILED: ${employeeError.message}`);
  }

  const employeeIds = employees.map((employee) => employee.id);

  let compensationByEmployee = new Map<string, CompensationRow>();
  if (employeeIds.length > 0) {
    const { data: compensationData, error: compensationError } = await supabase
      .from("compensation")
      .select("employee_id, base_salary, currency")
      .eq("tenant_id", tenantId)
      .in("employee_id", employeeIds);

    if (compensationError && !isSchemaMissingColumnError(compensationError.message)) {
      throw new Error(`DOCUMENT_EXPORT_FAILED: ${compensationError.message}`);
    }

    compensationByEmployee = new Map(
      ((compensationData ?? []) as CompensationRow[]).map((row) => [row.employee_id, row]),
    );
  }

  const { data: contractDocuments, error: contractError } = await supabase
    .from("documents")
    .select("employee_id, document_type, type, signed_at")
    .eq("tenant_id", tenantId)
    .is("deleted_at", null);

  if (contractError) {
    throw new Error(`DOCUMENT_EXPORT_FAILED: ${contractError.message}`);
  }

  const signedContractEmployeeIds = new Set(
    ((contractDocuments ?? []) as Array<{ employee_id: string; document_type: string | null; type: string | null; signed_at: string | null }>)
      .filter((row) => {
        const normalizedType = (row.document_type ?? row.type ?? "").toLowerCase();
        return normalizedType === "contract" && row.signed_at;
      })
      .map((row) => row.employee_id),
  );

  const header = [
    "employee_name",
    "employment_type",
    "country",
    "salary_amount",
    "currency",
    "payment_method_reference",
    "start_date",
    "contract_status",
    "bank_account_details",
  ];

  const dataRows = employees.map((employee) => {
    const compensation = compensationByEmployee.get(employee.id);
    const salaryAmount = compensation?.base_salary == null ? "" : String(compensation.base_salary);
    return [
      employee.full_name,
      employee.employment_type ?? "",
      employee.country ?? "",
      salaryAmount,
      compensation?.currency ?? "",
      "",
      employee.start_date ?? "",
      signedContractEmployeeIds.has(employee.id) ? "signed" : "missing",
      "",
    ];
  });

  const csv = buildDelimited([header, ...dataRows], ",");
  const tsv = buildDelimited([header, ...dataRows], "\t");
  const now = new Date();

  const zipEntries: ZipEntry[] = [
    {
      name: "finance-handoff.csv",
      data: Buffer.from(csv, "utf-8"),
    },
    {
      name: "finance-handoff.tsv",
      data: Buffer.from(tsv, "utf-8"),
    },
    {
      name: "manifest.json",
      data: Buffer.from(
        JSON.stringify(
          {
            generated_at: now.toISOString(),
            export_kind: "finance_handoff",
            employee_count: employees.length,
            columns: header,
          },
          null,
          2,
        ),
        "utf-8",
      ),
    },
  ];

  const payload = buildZip(zipEntries, now);
  assertExportMimeSupported(EXPORT_ZIP_MIME);
  const fileName = `finance-handoff-${formatDateForFileName(now)}.zip`;
  const storagePath = `${tenantId}/exports/finance-handoff/${randomUUID()}.zip`;

  let signedUrl = "";
  try {
    const { error: uploadError } = await supabase.storage
      .from(DOCUMENT_BUCKET)
      .upload(storagePath, payload, {
        contentType: "application/zip",
        upsert: false,
      });

    if (uploadError) {
      const errorLog = toStorageErrorLog(uploadError);
      console.error("DOCUMENT_EXPORT_UPLOAD_FAILED", {
        export_kind: "finance_handoff",
        tenant_id: tenantId,
        storage_path: storagePath,
        ...errorLog,
      });
      throw uploadError;
    }

    const { data: signed, error: signedError } = await supabase.storage
      .from(DOCUMENT_BUCKET)
      .createSignedUrl(storagePath, 60 * 15, { download: fileName });

    if (signedError || !signed?.signedUrl) {
      const errorLog = toStorageErrorLog(signedError ?? { message: "missing signed URL" });
      console.error("DOCUMENT_EXPORT_SIGN_FAILED", {
        export_kind: "finance_handoff",
        tenant_id: tenantId,
        storage_path: storagePath,
        ...errorLog,
      });
      throw signedError ?? new Error("missing signed URL");
    }

    signedUrl = signed.signedUrl;
  } catch (e) {
    const errorLog = toStorageErrorLog(e);
    console.error("DOCUMENT_EXPORT_EXCEPTION", {
      export_kind: "finance_handoff",
      tenant_id: tenantId,
      storage_path: storagePath,
      ...errorLog,
    });
    throw new Error(`DOCUMENT_EXPORT_FAILED: ${errorLog.message ?? "unknown export error"}`);
  }

  await writeAudit(actor, "document.exported_finance_handoff");
  return signedUrl;
}
