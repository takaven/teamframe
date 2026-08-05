/**
 * Cleanup expired TeamFrame export files.
 *
 * Defaults to dry-run. Pass --execute to remove storage objects and mark
 * export_files rows deleted. This script does not read .env.local.
 */

import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const execute = process.argv.includes("--execute");
const now = new Date().toISOString();

const url = process.env.EXPORT_CLEANUP_SUPABASE_URL;
const serviceKey = process.env.EXPORT_CLEANUP_SERVICE_ROLE_KEY;
const tenantId = process.env.EXPORT_CLEANUP_TENANT_ID;

if (!url || !serviceKey) {
  console.error(
    "✗ Missing EXPORT_CLEANUP_SUPABASE_URL or EXPORT_CLEANUP_SERVICE_ROLE_KEY. This script does not load .env.local.",
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let query = supabase
  .from("export_files")
  .select("id, tenant_id, storage_bucket, storage_path, deleted_at, expires_at")
  .lte("expires_at", now)
  .is("deleted_at", null)
  .order("expires_at", { ascending: true });

if (tenantId) {
  query = query.eq("tenant_id", tenantId);
}

const { data: rows, error: lookupError } = await query;
if (lookupError) {
  console.error(`✗ Export lookup failed: ${lookupError.message}`);
  process.exit(1);
}

const expired = rows ?? [];
console.log(`Expired exports found: ${expired.length}`);
console.log(`Mode: ${execute ? "execute" : "dry-run"}`);

for (const row of expired) {
  const expectedPrefix = `${row.tenant_id}/exports/`;
  if (!row.storage_path.startsWith(expectedPrefix)) {
    console.error(
      `✗ Refusing cleanup for ${row.id}: storage_path does not start with ${expectedPrefix}`,
    );
    process.exit(1);
  }

  console.log(`- ${row.id} ${row.storage_path} expired_at=${row.expires_at}`);
  if (!execute) continue;

  const idempotencyKey = `cleanup:${row.id}:${randomUUID()}`;
  const { data: op, error: opError } = await supabase
    .from("file_operations")
    .insert({
      tenant_id: row.tenant_id,
      operation_kind: "export_delete",
      status: "pending",
      idempotency_key: idempotencyKey,
      storage_bucket: row.storage_bucket,
      storage_path: row.storage_path,
      target_id: row.id,
      audit_action_type: "export.deleted_expired",
    })
    .select("id")
    .single();

  if (opError || !op) {
    console.error(`✗ Failed to create file operation for ${row.id}: ${opError?.message ?? "no row"}`);
    process.exit(1);
  }

  const { error: removeError } = await supabase.storage.from(row.storage_bucket).remove([row.storage_path]);
  if (removeError) {
    await supabase
      .from("file_operations")
      .update({
        status: "failed",
        error_message: removeError.message,
        finalized_at: new Date().toISOString(),
      })
      .eq("id", op.id);
    console.error(`✗ Failed to remove ${row.storage_path}: ${removeError.message}`);
    process.exit(1);
  }

  const deletedAt = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("export_files")
    .update({ deleted_at: deletedAt, deletion_operation_id: op.id })
    .eq("tenant_id", row.tenant_id)
    .eq("id", row.id)
    .is("deleted_at", null);

  if (updateError) {
    await supabase
      .from("file_operations")
      .update({
        status: "compensation_required",
        error_message: updateError.message,
        finalized_at: new Date().toISOString(),
      })
      .eq("id", op.id);
    console.error(`✗ Removed storage but failed to mark export ${row.id} deleted: ${updateError.message}`);
    process.exit(1);
  }

  const { error: auditError } = await supabase.from("audit_logs").insert({
    tenant_id: row.tenant_id,
    actor_user_id: null,
    action_type: "export.deleted_expired",
    target_id: row.id,
  });
  if (auditError) {
    await supabase
      .from("file_operations")
      .update({
        status: "compensation_required",
        error_message: auditError.message,
        finalized_at: new Date().toISOString(),
      })
      .eq("id", op.id);
    console.error(`✗ Export ${row.id} deleted but audit failed: ${auditError.message}`);
    process.exit(1);
  }

  const { error: finalizeError } = await supabase
    .from("file_operations")
    .update({ status: "succeeded", finalized_at: new Date().toISOString() })
    .eq("id", op.id);
  if (finalizeError) {
    console.error(`✗ Cleanup succeeded but operation finalization failed: ${finalizeError.message}`);
    process.exit(1);
  }
}

console.log(execute ? "✓ Expired export cleanup complete." : "✓ Dry-run complete.");
