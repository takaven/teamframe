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
import { ensureAutomationItem, runAutomationItem } from "@/services/hrAutomation";

export type DocumentType = string;
export type DocumentRequirementState =
  | "requested"
  | "received"
  | "accepted"
  | "rejected"
  | "expired"
  | "replaced"
  | "cancelled";

export type DocumentRecord = {
  id: string;
  employee_id: string;
  type: DocumentType;
  document_type: DocumentType;
  file_url: string;
  signed_at: string | null;
  expires_at: string | null;
  replaced_at: string | null;
  replaced_by_document_id: string | null;
  created_at: string;
};

export type DocumentRequirementRecord = {
  id: string;
  employee_id: string;
  document_type: string;
  due_date: string | null;
  expiry_required: boolean;
  review_required: boolean;
  employee_upload_allowed: boolean;
  state: DocumentRequirementState;
  current_document_id: string | null;
  requested_at: string;
  received_at: string | null;
  reviewed_at: string | null;
  satisfied_at: string | null;
  created_at: string;
  updated_at: string;
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

type DocumentRequirementRow = DocumentRequirementRecord & {
  tenant_id: string;
  requested_by_user_id: string;
  reviewed_by_user_id: string | null;
  replaced_by_requirement_id: string | null;
  automation_item_id: string | null;
  expiry_automation_item_id: string | null;
  review_automation_item_id: string | null;
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
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const MAX_FILE_NAME_CHARS = 180;
const MAX_METADATA_CHARS = 500;
export const EXPORT_DEFAULT_TTL_HOURS = 24;

type FileOperationKind = "document_upload" | "document_delete" | "export_generation" | "export_delete";
type FileOperationStatus = "pending" | "succeeded" | "failed" | "compensation_required" | "compensated";

export type UploadFileType = {
  extension: string;
  mimeTypes: readonly string[];
  matchesSignature: (bytes: Buffer) => boolean;
};

const UPLOAD_FILE_TYPES: readonly UploadFileType[] = [
  {
    extension: "pdf",
    mimeTypes: ["application/pdf"],
    matchesSignature: (bytes) => bytes.subarray(0, 4).toString("ascii") === "%PDF",
  },
  {
    extension: "doc",
    mimeTypes: ["application/msword"],
    matchesSignature: (bytes) => bytes.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])),
  },
  {
    extension: "docx",
    mimeTypes: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    matchesSignature: (bytes) => isLikelyDocx(bytes),
  },
  {
    extension: "jpg",
    mimeTypes: ["image/jpeg"],
    matchesSignature: (bytes) => bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
  },
  {
    extension: "jpeg",
    mimeTypes: ["image/jpeg"],
    matchesSignature: (bytes) => bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
  },
  {
    extension: "png",
    mimeTypes: ["image/png"],
    matchesSignature: (bytes) => bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  {
    extension: "webp",
    mimeTypes: ["image/webp"],
    matchesSignature: (bytes) =>
      bytes.length >= 12 &&
      bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
      bytes.subarray(8, 12).toString("ascii") === "WEBP",
  },
];

export function validateDocumentFileBeforeBuffer(file: File): UploadFileType {
  return validateUploadBeforeBuffer(file);
}

export function validateDocumentFileSignature(bytes: Buffer, fileType: UploadFileType): void {
  validateUploadSignature(bytes, fileType);
}

export function sanitizePrivateFileName(fileName: string): string {
  const normalized = fileName
    .trim()
    .replace(/[/\\:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .slice(0, MAX_FILE_NAME_CHARS);
  return normalized.length > 0 ? normalized : "document";
}

export async function assertPrivateDocumentStorageReady(): Promise<void> {
  await verifyDocumentStorageConfig();
}

export async function uploadPrivateDocumentObject(input: {
  actor: Actor;
  storagePath: string;
  bytes: Buffer;
  contentType: string;
  auditActionType: string;
  auditTargetId?: string | null;
}): Promise<void> {
  const tenantId = requireTenant(input.actor);
  const supabase = createServiceRoleClient();
  const operationId = await beginFileOperation({
    tenantId,
    kind: "document_upload",
    idempotencyKey: randomUUID(),
    storagePath: input.storagePath,
    targetId: input.auditTargetId ?? null,
    auditActionType: input.auditActionType,
  });

  const { error } = await supabase.storage
    .from(DOCUMENT_BUCKET)
    .upload(input.storagePath, input.bytes, { contentType: input.contentType, upsert: false });

  if (error) {
    await finalizeFileOperation(tenantId, operationId, "failed", error.message);
    throw new Error(`DOCUMENT_UPLOAD_FAILED: ${error.message}`);
  }

  await finalizeFileOperation(tenantId, operationId, "succeeded");
}

function bufferIncludesAscii(bytes: Buffer, needle: string): boolean {
  return bytes.indexOf(Buffer.from(needle, "ascii")) !== -1;
}

function isLikelyDocx(bytes: Buffer): boolean {
  return (
    bytes.subarray(0, 4).toString("ascii") === "PK\u0003\u0004" &&
    bufferIncludesAscii(bytes, "[Content_Types].xml") &&
    bufferIncludesAscii(bytes, "word/")
  );
}

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
  const { error } = await supabase.from("audit_logs").insert({
    tenant_id: tenantId,
    actor_user_id: actor.authUserId,
    action_type: actionType,
    target_id: targetId ?? null,
  } as never);
  if (error) {
    throw new Error(`AUDIT_LOG_FAILED: ${error.message}`);
  }
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
    replaced_at: row.replaced_at,
    replaced_by_document_id: row.replaced_by_document_id,
    created_at: row.created_at,
  };
}

function toRequirementRecord(row: DocumentRequirementRow): DocumentRequirementRecord {
  const {
    tenant_id: _tenantId,
    requested_by_user_id: _requestedBy,
    reviewed_by_user_id: _reviewedBy,
    replaced_by_requirement_id: _replacedBy,
    automation_item_id: _automation,
    expiry_automation_item_id: _expiryAutomation,
    review_automation_item_id: _reviewAutomation,
    ...record
  } = row;
  return record;
}

function normalizeDocumentType(input: string): DocumentType {
  const normalized = input.trim().toLowerCase();
  if (!/^[a-z0-9_-]{1,80}$/.test(normalized)) {
    throw new Error("DOCUMENT_TYPE_INVALID");
  }
  return normalized;
}

function dateAtUtcHour(input: string, hour = 9): Date {
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("DOCUMENT_EXPIRY_INVALID");
  }
  const due = new Date(parsed);
  due.setUTCHours(hour, 0, 0, 0);
  return due;
}

function toLegacyType(value: string): "CV" | "CONTRACT" | "JD" | "PHOTO" {
  if (value === "contract") return "CONTRACT";
  if (value === "jd") return "JD";
  if (value === "photo") return "PHOTO";
  return "CV";
}

function extensionFromFileName(fileName: string): string {
  const trimmed = fileName.trim();
  const lastDot = trimmed.lastIndexOf(".");
  if (lastDot === -1 || lastDot === trimmed.length - 1) return "";
  return trimmed.slice(lastDot + 1).toLowerCase();
}

function findUploadType(fileName: string, mimeType: string): UploadFileType {
  const extension = extensionFromFileName(fileName);
  if (!extension) throw new Error("DOCUMENT_UPLOAD_EXTENSION_REQUIRED");
  const match = UPLOAD_FILE_TYPES.find((type) => type.extension === extension);
  if (!match) throw new Error("DOCUMENT_UPLOAD_UNSUPPORTED_EXTENSION");
  if (!match.mimeTypes.includes(mimeType)) {
    throw new Error("DOCUMENT_UPLOAD_MIME_EXTENSION_MISMATCH");
  }
  return match;
}

function assertMetadataLength(value: string | null | undefined, errorCode: string): void {
  if (value && value.length > MAX_METADATA_CHARS) {
    throw new Error(errorCode);
  }
}

function validateUploadBeforeBuffer(file: File): UploadFileType {
  const fileName = file.name ?? "";
  const mimeType = file.type ?? "";
  if (fileName.length === 0 || fileName.length > MAX_FILE_NAME_CHARS) {
    throw new Error("DOCUMENT_UPLOAD_INVALID_FILENAME");
  }
  if (file.size === 0) {
    throw new Error("DOCUMENT_UPLOAD_EMPTY_FILE");
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("DOCUMENT_UPLOAD_TOO_LARGE");
  }
  if (!mimeType) {
    throw new Error("DOCUMENT_UPLOAD_MIME_REQUIRED");
  }
  return findUploadType(fileName, mimeType);
}

function validateUploadSignature(bytes: Buffer, fileType: UploadFileType): void {
  if (!fileType.matchesSignature(bytes)) {
    throw new Error("DOCUMENT_UPLOAD_SIGNATURE_MISMATCH");
  }
}

function buildStoragePath(tenantId: string, employeeId: string, extension: string): string {
  return `${tenantId}/${employeeId}/${randomUUID()}/document.${extension}`;
}

function exportExpiresAt(now: Date): Date {
  return new Date(now.getTime() + EXPORT_DEFAULT_TTL_HOURS * 60 * 60 * 1000);
}

async function verifyDocumentStorageConfig(): Promise<void> {
  const supabase = createServiceRoleClient();
  const { data: buckets, error } = await supabase.storage.listBuckets();
  if (error) {
    throw new Error(`DOCUMENT_STORAGE_CONFIG_FAILED: ${error.message}`);
  }
  const bucket = buckets.find((item) => item.name === DOCUMENT_BUCKET);
  if (!bucket) {
    throw new Error("DOCUMENT_STORAGE_BUCKET_MISSING");
  }
  if (bucket.public) {
    throw new Error("DOCUMENT_STORAGE_BUCKET_PUBLIC");
  }
}

async function beginFileOperation(input: {
  tenantId: string;
  kind: FileOperationKind;
  idempotencyKey: string;
  storagePath: string;
  targetId?: string | null;
  auditActionType?: string | null;
}): Promise<string> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("file_operations")
    .insert({
      tenant_id: input.tenantId,
      operation_kind: input.kind,
      status: "pending",
      idempotency_key: input.idempotencyKey,
      storage_bucket: DOCUMENT_BUCKET,
      storage_path: input.storagePath,
      target_id: input.targetId ?? null,
      audit_action_type: input.auditActionType ?? null,
    } as never)
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`FILE_OPERATION_BEGIN_FAILED: ${error?.message ?? "no row"}`);
  }
  return (data as { id: string }).id;
}

async function finalizeFileOperation(
  tenantId: string,
  operationId: string,
  status: FileOperationStatus,
  errorMessage?: string,
): Promise<void> {
  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .from("file_operations")
    .update({
      status,
      error_message: errorMessage?.slice(0, 1000) ?? null,
      finalized_at: new Date().toISOString(),
    } as never)
    .eq("tenant_id", tenantId)
    .eq("id", operationId);
  if (error) {
    throw new Error(`FILE_OPERATION_FINALIZE_FAILED: ${error.message}`);
  }
}

async function recordExportFile(input: {
  tenantId: string;
  exportKind: "due_diligence_pack" | "finance_handoff";
  employeeId?: string | null;
  storagePath: string;
  fileName: string;
  byteSize: number;
  expiresAt: Date;
}): Promise<void> {
  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("export_files").insert({
    tenant_id: input.tenantId,
    export_kind: input.exportKind,
    employee_id: input.employeeId ?? null,
    storage_bucket: DOCUMENT_BUCKET,
    storage_path: input.storagePath,
    file_name: input.fileName,
    content_type: EXPORT_ZIP_MIME,
    byte_size: input.byteSize,
    expires_at: input.expiresAt.toISOString(),
  } as never);
  if (error) {
    throw new Error(`EXPORT_METADATA_CREATE_FAILED: ${error.message}`);
  }
}

async function createExportFileUrl(input: {
  actor: Actor;
  exportKind: "due_diligence_pack" | "finance_handoff";
  employeeId?: string | null;
  storagePath: string;
  fileName: string;
  payload: Buffer;
  auditActionType: string;
  auditTargetId?: string;
}): Promise<string> {
  const tenantId = requireTenant(input.actor);
  const supabase = createServiceRoleClient();
  const operationId = await beginFileOperation({
    tenantId,
    kind: "export_generation",
    idempotencyKey: randomUUID(),
    storagePath: input.storagePath,
    targetId: input.auditTargetId ?? null,
    auditActionType: input.auditActionType,
  });

  const { error: uploadError } = await supabase.storage
    .from(DOCUMENT_BUCKET)
    .upload(input.storagePath, input.payload, {
      contentType: EXPORT_ZIP_MIME,
      upsert: false,
    });

  if (uploadError) {
    await finalizeFileOperation(tenantId, operationId, "failed", uploadError.message);
    throw new Error(`DOCUMENT_EXPORT_FAILED: ${uploadError.message}`);
  }

  try {
    await recordExportFile({
      tenantId,
      exportKind: input.exportKind,
      employeeId: input.employeeId,
      storagePath: input.storagePath,
      fileName: input.fileName,
      byteSize: input.payload.length,
      expiresAt: exportExpiresAt(new Date()),
    });
  } catch (metadataError) {
    const { error: removeError } = await supabase.storage.from(DOCUMENT_BUCKET).remove([input.storagePath]);
    if (removeError) {
      await finalizeFileOperation(tenantId, operationId, "compensation_required", removeError.message);
    } else {
      await finalizeFileOperation(
        tenantId,
        operationId,
        "compensated",
        metadataError instanceof Error ? metadataError.message : String(metadataError),
      );
    }
    throw metadataError;
  }

  const { data: signed, error: signedError } = await supabase.storage
    .from(DOCUMENT_BUCKET)
    .createSignedUrl(input.storagePath, 60 * 15, { download: input.fileName });

  if (signedError || !signed?.signedUrl) {
    await finalizeFileOperation(
      tenantId,
      operationId,
      "failed",
      signedError?.message ?? "missing signed URL",
    );
    throw new Error(`DOCUMENT_EXPORT_FAILED: ${signedError?.message ?? "missing signed URL"}`);
  }

  await finalizeFileOperation(tenantId, operationId, "succeeded");
  await writeAudit(input.actor, input.auditActionType, input.auditTargetId);
  return signed.signedUrl;
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
    .select("id, tenant_id, employee_id, type, document_type, file_url, signed_at, expires_at, replaced_at, replaced_by_document_id, subject_person_id, created_at, deleted_at")
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
  options: { allowEmployeeSelfUpload?: boolean; auditActionType?: string } = {},
): Promise<DocumentRecord> {
  const start = Date.now();
  const requestId = randomUUID();

  try {
    const tenantId = requireTenant(actor);
    if (options.allowEmployeeSelfUpload) {
      if (actor.role !== "admin" && actor.employeeId !== input.employeeId) {
        throw new Error("FORBIDDEN");
      }
    } else {
      requireAdmin(actor);
    }
    const normalizedInputType = normalizeDocumentType(input.type);
    const fileType = validateUploadBeforeBuffer(input.file);
    assertMetadataLength(input.subjectPersonId, "DOCUMENT_UPLOAD_METADATA_TOO_LONG");
    assertMetadataLength(input.signedAt, "DOCUMENT_UPLOAD_METADATA_TOO_LONG");
    assertMetadataLength(input.expiresAt, "DOCUMENT_UPLOAD_METADATA_TOO_LONG");

    const supabase = createServiceRoleClient();
    await verifyDocumentStorageConfig();
    const bytes = Buffer.from(await input.file.arrayBuffer());
    validateUploadSignature(bytes, fileType);
    const path = buildStoragePath(tenantId, input.employeeId, fileType.extension);
    const operationId = await beginFileOperation({
        tenantId,
        kind: "document_upload",
        idempotencyKey: requestId,
        storagePath: path,
        auditActionType: options.auditActionType ?? "document.uploaded",
    });

    const { error: uploadError } = await supabase.storage
      .from(DOCUMENT_BUCKET)
      .upload(path, bytes, { contentType: fileType.mimeTypes[0], upsert: false });

    if (uploadError) {
      await finalizeFileOperation(tenantId, operationId, "failed", uploadError.message);
      throw new Error(`DOCUMENT_UPLOAD_FAILED: ${uploadError.message}`);
    }

    const { data, error } = await supabase
      .from("documents")
      .insert({
        tenant_id: tenantId,
        employee_id: input.employeeId,
        type: toLegacyType(normalizedInputType),
        document_type: normalizedInputType,
        subject_person_id: input.subjectPersonId ?? input.employeeId,
        signed_at: input.signedAt ?? null,
        expires_at: input.expiresAt ?? null,
        file_url: path,
      } as never)
      .select("id, tenant_id, employee_id, type, document_type, file_url, signed_at, expires_at, replaced_at, replaced_by_document_id, subject_person_id, created_at, deleted_at")
      .single();

    if (error) {
      // Compensating delete: the storage object exists but the DB row does not.
      // BUG-1 fix (Wave 4, no-silent-failures audit): the remove result must be
      // checked — a failed compensation means an orphaned file in the bucket,
      // which must be visible to operators, not silent.
      const { error: removeError } = await supabase.storage.from(DOCUMENT_BUCKET).remove([path]);
      if (removeError) {
        await finalizeFileOperation(tenantId, operationId, "compensation_required", removeError.message);
        console.error("DOCUMENT_COMPENSATING_DELETE_FAILED", {
          tenant_id: tenantId,
          employee_id: input.employeeId,
          storage_path: path,
          ...toStorageErrorLog(removeError),
        });
        captureActionError("uploadDocumentCompensatingDelete", removeError, {
          actor_user_id: actor.authUserId,
          actor_tenant_id: actor.tenantId ?? null,
          storage_path: path,
        });
      } else {
        await finalizeFileOperation(tenantId, operationId, "compensated", error.message);
      }
      throw new Error(`DOCUMENT_RECORD_CREATE_FAILED: ${error.message}`);
    }

    const created = data as DocumentRow;
    await finalizeFileOperation(tenantId, operationId, "succeeded");
    await writeAudit(actor, options.auditActionType ?? "document.uploaded", created.id);
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

export async function createDocumentRequirement(
  actor: Actor,
  input: {
    employeeId: string;
    documentType: string;
    dueDate?: string | null;
    expiryRequired?: boolean;
    reviewRequired?: boolean;
    employeeUploadAllowed?: boolean;
  },
): Promise<DocumentRequirementRecord> {
  requireAdmin(actor);
  const tenantId = requireTenant(actor);
  const documentType = normalizeDocumentType(input.documentType);
  const supabase: any = createServiceRoleClient();

  const { data, error } = await supabase
    .from("document_requirements")
    .insert({
      tenant_id: tenantId,
      employee_id: input.employeeId,
      document_type: documentType,
      due_date: input.dueDate ?? null,
      expiry_required: input.expiryRequired ?? false,
      review_required: input.reviewRequired ?? false,
      employee_upload_allowed: input.employeeUploadAllowed ?? true,
      requested_by_user_id: actor.authUserId,
    })
    .select("*")
    .single();

  if (error) throw new Error(`DOCUMENT_REQUIREMENT_CREATE_FAILED: ${error.message}`);
  const created = data as DocumentRequirementRow;

  let automationItemId: string | null = null;
  if (input.dueDate) {
    automationItemId = await ensureAutomationItem({
      tenantId,
      ruleKey: "document.request_due",
      idempotencyKey: `document_request:${created.id}:due`,
      subjectType: "document_requirement",
      subjectId: created.id,
      ownerEmployeeId: input.employeeId,
      dueAt: new Date(`${input.dueDate}T09:00:00.000Z`),
      notificationLevel: "routine_reminder",
      metadata: { document_type: documentType },
    });

    const { error: updateError } = await supabase
      .from("document_requirements")
      .update({ automation_item_id: automationItemId })
      .eq("tenant_id", tenantId)
      .eq("id", created.id);
    if (updateError) throw new Error(`DOCUMENT_REQUIREMENT_AUTOMATION_FAILED: ${updateError.message}`);
  }

  await writeAudit(actor, "document_requirement.created", created.id);
  return toRequirementRecord({ ...created, automation_item_id: automationItemId });
}

export async function listDocumentRequirementsForEmployee(
  actor: Actor,
  employeeId: string,
): Promise<DocumentRequirementRecord[]> {
  const tenantId = requireTenant(actor);
  if (!(await canReadEmployeeDocuments(actor, employeeId))) throw new Error("FORBIDDEN");

  const supabase: any = createServiceRoleClient();
  const { data, error } = await supabase
    .from("document_requirements")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("employee_id", employeeId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`DOCUMENT_REQUIREMENT_LIST_FAILED: ${error.message}`);
  return ((data ?? []) as DocumentRequirementRow[]).map(toRequirementRecord);
}

export async function uploadDocumentForRequirement(
  actor: Actor,
  input: {
    requirementId: string;
    file: File;
    expiresAt?: string | null;
  },
): Promise<DocumentRequirementRecord> {
  const tenantId = requireTenant(actor);
  const supabase: any = createServiceRoleClient();
  const { data: requirementData, error: requirementError } = await supabase
    .from("document_requirements")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("id", input.requirementId)
    .maybeSingle();

  if (requirementError) throw new Error(`DOCUMENT_REQUIREMENT_LOOKUP_FAILED: ${requirementError.message}`);
  if (!requirementData) throw new Error("DOCUMENT_REQUIREMENT_NOT_FOUND");

  const requirement = requirementData as DocumentRequirementRow;
  if (!["requested", "rejected", "expired", "accepted"].includes(requirement.state)) {
    throw new Error("DOCUMENT_REQUIREMENT_NOT_UPLOADABLE");
  }
  if (!requirement.employee_upload_allowed && actor.role !== "admin") {
    throw new Error("FORBIDDEN");
  }
  if (actor.role !== "admin" && actor.employeeId !== requirement.employee_id) {
    throw new Error("FORBIDDEN");
  }

  const document = await uploadDocument(
    actor,
    {
      employeeId: requirement.employee_id,
      type: requirement.document_type,
      file: input.file,
      expiresAt: input.expiresAt ?? null,
    },
    { allowEmployeeSelfUpload: true, auditActionType: "document_requirement.uploaded" },
  );

  const nextState: DocumentRequirementState = requirement.review_required ? "received" : "accepted";
  const patch: Record<string, unknown> = {
    state: nextState,
    current_document_id: document.id,
    received_at: new Date().toISOString(),
  };
  if (nextState === "accepted") {
    patch.satisfied_at = new Date().toISOString();
  }

  const { data: updatedData, error: updateError } = await supabase
    .from("document_requirements")
    .update(patch)
    .eq("tenant_id", tenantId)
    .eq("id", requirement.id)
    .select("*")
    .single();

  if (updateError) throw new Error(`DOCUMENT_REQUIREMENT_RECEIPT_FAILED: ${updateError.message}`);
  const updated = updatedData as DocumentRequirementRow;

  if (requirement.current_document_id && requirement.current_document_id !== document.id) {
    const { error: replacedError } = await supabase
      .from("documents")
      .update({
        replaced_at: new Date().toISOString(),
        replaced_by_document_id: document.id,
      } as never)
      .eq("tenant_id", tenantId)
      .eq("id", requirement.current_document_id)
      .is("replaced_at", null);

    if (replacedError) throw new Error(`DOCUMENT_REPLACEMENT_MARK_FAILED: ${replacedError.message}`);
  }

  if (requirement.automation_item_id) {
    await runAutomationItem({
      tenantId,
      itemId: requirement.automation_item_id,
      complete: true,
      eventContext: { source: "document_requirement.uploaded", document_id: document.id },
    });
  }

  if (requirement.expiry_automation_item_id) {
    await runAutomationItem({
      tenantId,
      itemId: requirement.expiry_automation_item_id,
      complete: true,
      eventContext: { source: "document_requirement.replaced", document_id: document.id },
    });
  }

  if (requirement.review_required) {
    const reviewItemId = await ensureAutomationItem({
      tenantId,
      ruleKey: "document.review_due",
      idempotencyKey: `document_request:${requirement.id}:review`,
      subjectType: "document_requirement",
      subjectId: requirement.id,
      dueAt: new Date(),
      notificationLevel: "decision",
      metadata: { document_type: requirement.document_type },
    });
    await supabase
      .from("document_requirements")
      .update({ review_automation_item_id: reviewItemId })
      .eq("tenant_id", tenantId)
      .eq("id", requirement.id);
  } else if (document.expires_at && requirement.expiry_required) {
    const expiryItemId = await ensureAutomationItem({
      tenantId,
      ruleKey: "document.expiry_due",
      idempotencyKey: `document_request:${requirement.id}:expiry:${document.id}`,
      subjectType: "document_requirement",
      subjectId: requirement.id,
      ownerEmployeeId: requirement.employee_id,
      dueAt: dateAtUtcHour(document.expires_at),
      notificationLevel: "routine_reminder",
      metadata: { document_type: requirement.document_type, document_id: document.id },
    });
    await supabase
      .from("document_requirements")
      .update({ expiry_automation_item_id: expiryItemId })
      .eq("tenant_id", tenantId)
      .eq("id", requirement.id);
  }

  await writeAudit(actor, nextState === "accepted" ? "document_requirement.accepted" : "document_requirement.received", updated.id);
  return toRequirementRecord(updated);
}

export async function reviewDocumentRequirement(
  actor: Actor,
  input: { requirementId: string; decision: "accepted" | "rejected" },
): Promise<DocumentRequirementRecord> {
  requireAdmin(actor);
  const tenantId = requireTenant(actor);
  const supabase: any = createServiceRoleClient();
  const { data: existingData, error: existingError } = await supabase
    .from("document_requirements")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("id", input.requirementId)
    .maybeSingle();

  if (existingError) throw new Error(`DOCUMENT_REQUIREMENT_LOOKUP_FAILED: ${existingError.message}`);
  if (!existingData) throw new Error("DOCUMENT_REQUIREMENT_NOT_FOUND");
  const existing = existingData as DocumentRequirementRow;
  if (existing.state !== "received") throw new Error("DOCUMENT_REQUIREMENT_NOT_REVIEWABLE");

  const accepted = input.decision === "accepted";
  const { data, error } = await supabase
    .from("document_requirements")
    .update({
      state: input.decision,
      reviewed_at: new Date().toISOString(),
      reviewed_by_user_id: actor.authUserId,
      satisfied_at: accepted ? new Date().toISOString() : null,
    })
    .eq("tenant_id", tenantId)
    .eq("id", input.requirementId)
    .select("*")
    .single();

  if (error) throw new Error(`DOCUMENT_REQUIREMENT_REVIEW_FAILED: ${error.message}`);

  if (accepted && existing.review_automation_item_id) {
    await runAutomationItem({
      tenantId,
      itemId: existing.review_automation_item_id,
      complete: true,
      eventContext: { source: "document_requirement.reviewed" },
    });
  }

  await writeAudit(actor, accepted ? "document_requirement.review_accepted" : "document_requirement.review_rejected", input.requirementId);
  return toRequirementRecord(data as DocumentRequirementRow);
}

export async function getSignedDownloadUrl(
  actor: Actor,
  documentId: string,
): Promise<string> {
  const tenantId = requireTenant(actor);
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from("documents")
    .select("id, tenant_id, employee_id, type, document_type, file_url, signed_at, expires_at, replaced_at, replaced_by_document_id, subject_person_id, created_at, deleted_at")
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

  const { data: existing, error: fetchError } = await supabase
    .from("documents")
    .select("id, tenant_id, employee_id, type, document_type, file_url, signed_at, expires_at, replaced_at, replaced_by_document_id, subject_person_id, created_at, deleted_at")
    .eq("tenant_id", tenantId)
    .eq("id", documentId)
    .is("deleted_at", null)
    .maybeSingle();

  if (fetchError) {
    throw new Error(`DOCUMENT_FETCH_FAILED: ${fetchError.message}`);
  }
  if (!existing) {
    throw new Error("NOT_FOUND");
  }

  const document = existing as DocumentRow;
  const operationId = await beginFileOperation({
    tenantId,
    kind: "document_delete",
    idempotencyKey: randomUUID(),
    storagePath: document.file_url,
    targetId: documentId,
    auditActionType: "document.deleted",
  });

  const { data, error } = await supabase
    .from("documents")
    .update({ deleted_at: new Date().toISOString() } as never)
    .eq("tenant_id", tenantId)
    .eq("id", documentId)
    .is("deleted_at", null)
    .select("id, tenant_id, employee_id, type, document_type, file_url, signed_at, expires_at, replaced_at, replaced_by_document_id, subject_person_id, created_at, deleted_at")
    .maybeSingle();

  if (error) {
    await finalizeFileOperation(tenantId, operationId, "failed", error.message);
    throw new Error(`DOCUMENT_DELETE_FAILED: ${error.message}`);
  }
  if (!data) {
    await finalizeFileOperation(tenantId, operationId, "failed", "NOT_FOUND");
    throw new Error("NOT_FOUND");
  }

  const { error: removeError } = await supabase.storage.from(DOCUMENT_BUCKET).remove([document.file_url]);
  if (removeError) {
    await finalizeFileOperation(tenantId, operationId, "compensation_required", removeError.message);
    throw new Error(`DOCUMENT_DELETE_STORAGE_FAILED: ${removeError.message}`);
  }

  await finalizeFileOperation(tenantId, operationId, "succeeded");
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

  return createExportFileUrl({
    actor,
    exportKind: "due_diligence_pack",
    employeeId,
    storagePath,
    fileName,
    payload,
    auditActionType: "document.exported_due_diligence_pack",
    auditTargetId: employeeId,
  });
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

  return createExportFileUrl({
    actor,
    exportKind: "finance_handoff",
    employeeId: null,
    storagePath,
    fileName,
    payload,
    auditActionType: "document.exported_finance_handoff",
  });
}
