/**
 * TeamFrame disposable-environment integration gate.
 *
 * This script intentionally does not read .env.local. It requires audit-only
 * variables so a reviewer cannot accidentally validate against an existing
 * staging or production project.
 */

import pg from "pg";
import { createClient } from "@supabase/supabase-js";

const REQUIRED = [
  "TEAMFRAME_AUDIT_INTEGRATION",
  "AUDIT_SUPABASE_PROJECT_REF",
  "AUDIT_SUPABASE_URL",
  "AUDIT_SUPABASE_ANON_KEY",
  "AUDIT_SUPABASE_SERVICE_ROLE_KEY",
  "AUDIT_SUPABASE_DB_URL",
  "AUDIT_SITE_URL",
];

const KNOWN_NON_DISPOSABLE_REFS = new Set([
  "zydhgtmgrbdyghmvuldc",
  "eucnsrtdjxcylknbuglw",
]);

const REQUIRED_TABLES = [
  "action_items",
  "analytics_events",
  "audit_logs",
  "companies",
  "compensation",
  "documents",
  "employee_profiles",
  "employees",
  "employment_changes",
  "hr_automation_events",
  "hr_automation_items",
  "leaves",
  "onboarding_tasks",
  "policies",
  "acknowledgements",
  "risk_signals",
];

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

function pass(message) {
  console.log(`✓ ${message}`);
}

function requireEnv() {
  const missing = REQUIRED.filter((name) => !process.env[name]?.trim());
  if (missing.length > 0) {
    fail(
      [
        "Missing required disposable integration variables:",
        ...missing.map((name) => `  - ${name}`),
        "",
        "This command must be run only against an explicitly authorised disposable Supabase project.",
        "It does not load .env.local.",
      ].join("\n"),
    );
  }

  if (process.env.TEAMFRAME_AUDIT_INTEGRATION !== "authorised-disposable") {
    fail("TEAMFRAME_AUDIT_INTEGRATION must be exactly 'authorised-disposable'.");
  }

  const projectRef = process.env.AUDIT_SUPABASE_PROJECT_REF;
  if (KNOWN_NON_DISPOSABLE_REFS.has(projectRef)) {
    fail(`Refusing to run against known non-disposable Supabase project ref: ${projectRef}`);
  }

  const url = new URL(process.env.AUDIT_SUPABASE_URL);
  const siteUrl = new URL(process.env.AUDIT_SITE_URL);
  if (url.protocol !== "https:") fail("AUDIT_SUPABASE_URL must use https.");
  if (!url.hostname.includes(projectRef)) {
    fail("AUDIT_SUPABASE_URL hostname must include AUDIT_SUPABASE_PROJECT_REF.");
  }
  if (!["http:", "https:"].includes(siteUrl.protocol)) {
    fail("AUDIT_SITE_URL must be an http(s) URL.");
  }
}

async function verifyDatabase() {
  const client = new pg.Client({
    connectionString: process.env.AUDIT_SUPABASE_DB_URL.replace(/^"|"$/g, ""),
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  try {
    const { rows } = await client.query(
      `
        select c.relname, c.relrowsecurity
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public'
          and c.relkind = 'r'
          and c.relname = any($1::text[])
        order by c.relname;
      `,
      [REQUIRED_TABLES],
    );

    const found = new Map(rows.map((row) => [row.relname, row.relrowsecurity]));
    const missing = REQUIRED_TABLES.filter((table) => !found.has(table));
    if (missing.length > 0) fail(`Missing required tables: ${missing.join(", ")}`);

    const withoutRls = REQUIRED_TABLES.filter((table) => found.get(table) !== true);
    if (withoutRls.length > 0) fail(`RLS is not enabled on: ${withoutRls.join(", ")}`);

    pass(`Database schema present with RLS enabled on ${REQUIRED_TABLES.length} required tables`);
  } finally {
    await client.end();
  }
}

async function verifySupabaseApis() {
  const supabase = createClient(
    process.env.AUDIT_SUPABASE_URL,
    process.env.AUDIT_SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
  if (bucketError) fail(`Storage bucket listing failed: ${bucketError.message}`);

  const documents = buckets.find((bucket) => bucket.name === "documents");
  if (!documents) fail('Missing private storage bucket "documents".');
  if (documents.public) fail('Storage bucket "documents" must be private.');
  pass('Storage bucket "documents" exists and is private');

  const { error: authError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 });
  if (authError) fail(`Auth Admin low-impact probe failed: ${authError.message}`);
  pass("Auth Admin low-impact probe succeeded");
}

async function main() {
  requireEnv();
  console.log("TeamFrame disposable integration verification");
  console.log(`Project ref: ${process.env.AUDIT_SUPABASE_PROJECT_REF}`);
  await verifyDatabase();
  await verifySupabaseApis();
  pass("Disposable integration gate completed");
}

main().catch((err) => {
  fail(err instanceof Error ? err.message : String(err));
});
