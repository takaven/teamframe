/**
 * TeamFrame — storage bucket setup.
 *
 * Creates the single `documents` bucket used by the document hub.
 * Bucket is private — all reads/writes go through server-side signed URLs
 * issued by /services/documentService after RBAC checks.
 *
 * Idempotent: safe to re-run; will only create if missing.
 *
 * Usage:
 *   npm run storage:setup:fresh
 */

import { createClient } from "@supabase/supabase-js";
import { APPROVED_LAUNCH_PROJECT_REFS } from "./approved-launch-projects.mjs";

const projectRef = process.env.TEAMFRAME_INSTALL_PROJECT_REF;
const url = process.env.TEAMFRAME_INSTALL_SUPABASE_URL;
const serviceKey = process.env.TEAMFRAME_INSTALL_SERVICE_ROLE_KEY;
if (!projectRef || !APPROVED_LAUNCH_PROJECT_REFS.has(projectRef) ||
    url !== `https://${projectRef}.supabase.co` ||
    process.env.TEAMFRAME_INSTALL_APPROVAL !== `fresh:${projectRef}` || !serviceKey) {
  console.error("[PARITY_FAIL] Fresh storage target must be on the reviewed launch allowlist with exact identity and process-only service key.");
  process.exit(1);
}
if (process.argv.includes("--check-target")) {
  console.log(`Verified fresh-storage target: ${projectRef}`);
  process.exit(0);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Read-only credential check before the fresh installer changes a database.
// The launch handoff uses the exact project's legacy service_role JWT; an API
// round trip also verifies its signature rather than trusting decoded claims.
if (process.argv.includes("--verify-key")) {
  let claims;
  try { claims = JSON.parse(Buffer.from(serviceKey.split(".")[1], "base64url").toString("utf8")); }
  catch { console.error("[PARITY_FAIL] A legacy service_role key for this exact project is required."); process.exit(1); }
  if (claims.role !== "service_role" || claims.ref !== projectRef) {
    console.error("[PARITY_FAIL] The service_role key identifies a different project or role.");
    process.exit(1);
  }
  const { error } = await supabase.storage.listBuckets();
  if (error) {
    console.error("[PARITY_FAIL] This project's service_role key did not pass the read-only API check.");
    process.exit(1);
  }
  console.log(`Verified read-only service-role API access for ${projectRef}.`);
} else {

const BUCKET = "documents";
const BUCKET_CONFIG = {
  public: false,
  fileSizeLimit: 10 * 1024 * 1024,
  allowedMimeTypes: [
    "application/zip",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "image/jpeg",
    "image/png",
    "image/webp",
  ],
};

console.log("• Listing existing buckets…");
const { data: buckets, error: listErr } = await supabase.storage.listBuckets();
if (listErr) {
  console.error("✗ Failed to list buckets:", listErr.message);
  process.exit(1);
}

const existing = buckets.find((b) => b.name === BUCKET);

if (existing) {
  if (existing.public || existing.file_size_limit !== BUCKET_CONFIG.fileSizeLimit ||
      JSON.stringify(existing.allowed_mime_types ?? []) !== JSON.stringify(BUCKET_CONFIG.allowedMimeTypes)) {
    console.error(`✗ Existing bucket "${BUCKET}" differs from the required private configuration; refusing to overwrite it.`);
    process.exit(1);
  }
  console.log(`✓ Bucket "${BUCKET}" already has the required private configuration.`);
} else {
  console.log(`• Creating bucket "${BUCKET}"…`);
  const { error: createErr } = await supabase.storage.createBucket(BUCKET, BUCKET_CONFIG);
  if (createErr) {
    console.error("✗ Failed to create bucket:", createErr.message);
    process.exit(1);
  }
  console.log(`✓ Bucket "${BUCKET}" created (private, 10MB limit, PDF/DOC/images).`);
}

console.log("\n✓ Storage ready.");
}
