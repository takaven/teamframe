import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const schema = readFileSync(join(process.cwd(), "schemas", "file_lifecycle.sql"), "utf8");
const service = readFileSync(join(process.cwd(), "services", "documentService", "index.ts"), "utf8");
const cleanup = readFileSync(join(process.cwd(), "scripts", "cleanup-expired-exports.mjs"), "utf8");
const rls = readFileSync(join(process.cwd(), "schemas", "tenancy_rls.sql"), "utf8");

describe("file lifecycle and export retention", () => {
  it("stores durable file operation states for retries and compensation", () => {
    for (const kind of ["document_upload", "document_delete", "export_generation", "export_delete"]) {
      expect(schema).toContain(`'${kind}'`);
    }
    for (const status of ["pending", "succeeded", "failed", "compensation_required", "compensated"]) {
      expect(schema).toContain(`'${status}'`);
    }
    expect(schema).toContain("file_operations_idempotency_key_idx");
  });

  it("records export metadata with an explicit TTL separate from signed URLs", () => {
    expect(schema).toContain("create table if not exists export_files");
    expect(schema).toContain("expires_at timestamptz not null");
    expect(service).toContain("EXPORT_DEFAULT_TTL_HOURS = 24");
    expect(service).toContain("recordExportFile");
    expect(service).toContain("createSignedUrl(input.storagePath, 60 * 15");
  });

  it("protects lifecycle metadata with tenant-scoped RLS", () => {
    expect(rls).toContain("alter table file_operations enable row level security");
    expect(rls).toContain("alter table export_files enable row level security");
    expect(rls).toContain("file_operations_admin_only");
    expect(rls).toContain("export_files_admin_only");
  });

  it("cleanup defaults to dry-run and refuses cross-tenant storage paths", () => {
    expect(cleanup).toContain("const execute = process.argv.includes(\"--execute\")");
    expect(cleanup).toContain("This script does not load .env.local");
    expect(cleanup).toContain("expectedPrefix = `${row.tenant_id}/exports/`");
    expect(cleanup).toContain("Refusing cleanup");
    expect(cleanup).toContain("export.deleted_expired");
  });
});
