/**
 * TeamFrame — repeatable installation verification.
 *
 * Runs against the Supabase project configured in .env.local and asserts that
 * the documented install pipeline actually produced a working system:
 *
 *   A. schema-apply    — every file in SCHEMA_ORDER applies cleanly (idempotent re-apply).
 *   B. tenancy-rls-v2  — the LIVE definition of current_actor_tenant_id() is the V2
 *                        JWT-only version (no email fallback), and the V2 unique
 *                        index exists. Queried from the pg catalog, not the files.
 *   C. required-objects— all tables, the employees_public view, the tenancy helper
 *                        functions exist, and RLS is enabled on every table.
 *   D. seed-admin      — `seed:admin` produces a login-capable admin: runs the script
 *                        with a throwaway identity, then signs in with the ANON key
 *                        (the same path /admin/login uses), asserts the admin JWT
 *                        claims, and signs out. No browser needed.
 *   E. seed-demo       — `seed:demo` is idempotent: running it twice leaves identical
 *                        row counts in every table.
 *
 * Output: PASS/FAIL per assertion. Exits non-zero if any assertion fails.
 *
 * Usage:
 *   npm run verify:install
 *
 * Notes:
 *   - Assertion D creates/updates a fake admin (verify-admin@teamframe-verify.example)
 *     with a random password in the target project. Safe to re-run.
 *   - Requires: SUPABASE_DB_URL, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
 *     SUPABASE_SERVICE_ROLE_KEY in .env.local.
 */

import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { SCHEMA_ORDER } from "./schema-order.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
dotenv.config({ path: join(repoRoot, ".env.local"), quiet: true });

const VERIFY_ADMIN_EMAIL = "verify-admin@teamframe-verify.example";

const REQUIRED_FUNCTIONS = [
  "app_role",
  "current_actor_email",
  "current_actor_tenant_id",
  "is_current_actor_admin",
];
const REQUIRED_VIEWS = ["employees_public"];
const NON_TABLE_MIGRATIONS = new Set([
  "tenant_integrity.sql",
  "transactional_mutations.sql",
  "tenancy_rls.sql",
  "tenancy_rls_v2.sql",
]);
const TABLES_BY_MIGRATION = {
  "file_lifecycle.sql": ["file_operations", "export_files"],
};
const REQUIRED_TABLES = SCHEMA_ORDER.flatMap((f) =>
  NON_TABLE_MIGRATIONS.has(f) ? [] : TABLES_BY_MIGRATION[f] ?? [f.replace(/\.sql$/, "")],
);

const connectionString = process.env.SUPABASE_DB_URL?.replace(/^"|"$/g, "");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const missing = [];
if (!connectionString || connectionString.includes("[YOUR-PASSWORD]")) missing.push("SUPABASE_DB_URL");
if (!url) missing.push("NEXT_PUBLIC_SUPABASE_URL");
if (!anonKey) missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
if (!serviceKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");
if (missing.length > 0) {
  console.error(`✗ Missing required variables in .env.local: ${missing.join(", ")}`);
  process.exit(1);
}

const { Client } = pg;
const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

function runNodeScript(scriptRelPath, args = [], extraEnv = {}) {
  const result = spawnSync(process.execPath, [join(repoRoot, scriptRelPath), ...args], {
    cwd: repoRoot,
    env: { ...process.env, ...extraEnv },
    encoding: "utf8",
  });
  return result;
}

async function countAllRows() {
  const counts = {};
  for (const table of REQUIRED_TABLES) {
    const { rows } = await client.query(`select count(*)::int as n from public."${table}";`);
    counts[table] = rows[0].n;
  }
  return counts;
}

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------

async function assertSchemaApply() {
  for (const file of SCHEMA_ORDER) {
    const sql = await readFile(join(repoRoot, "schemas", file), "utf8");
    try {
      await client.query(sql);
    } catch (err) {
      throw new Error(`schema file ${file} failed to apply: ${err.message}`);
    }
  }
  return `all ${SCHEMA_ORDER.length} schema files applied in SCHEMA_ORDER without errors`;
}

async function assertTenancyRlsV2() {
  const { rows } = await client.query(`
    select pg_get_functiondef(p.oid) as def
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'current_actor_tenant_id';
  `);
  if (rows.length === 0) throw new Error("current_actor_tenant_id() does not exist");
  const def = rows[0].def;
  if (!def.includes("app_metadata")) {
    throw new Error("current_actor_tenant_id() does not read JWT app_metadata");
  }
  // The V1 fallback resolved tenant_id by email from the employees table.
  if (/from\s+employees/i.test(def) || /current_actor_email/i.test(def)) {
    throw new Error(
      "current_actor_tenant_id() still contains the V1 email fallback — tenancy_rls_v2.sql is NOT the live definition",
    );
  }
  const { rows: idx } = await client.query(`
    select 1 from pg_indexes
    where schemaname = 'public' and indexname = 'employees_tenant_email_active_idx';
  `);
  if (idx.length === 0) {
    throw new Error("unique index employees_tenant_email_active_idx (tenancy_rls_v2.sql) is missing");
  }
  return "live current_actor_tenant_id() is JWT-only (no email fallback); V2 unique index present";
}

async function assertRequiredObjects() {
  const { rows: tableRows } = await client.query(`
    select c.relname, c.relrowsecurity
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r';
  `);
  const tables = new Map(tableRows.map((r) => [r.relname, r.relrowsecurity]));
  for (const t of REQUIRED_TABLES) {
    if (!tables.has(t)) throw new Error(`table missing: ${t}`);
    if (!tables.get(t)) throw new Error(`RLS not enabled on table: ${t}`);
  }

  const { rows: viewRows } = await client.query(`
    select table_name from information_schema.views where table_schema = 'public';
  `);
  const views = new Set(viewRows.map((r) => r.table_name));
  for (const v of REQUIRED_VIEWS) {
    if (!views.has(v)) throw new Error(`view missing: ${v}`);
  }

  const { rows: fnRows } = await client.query(`
    select p.proname from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public';
  `);
  const fns = new Set(fnRows.map((r) => r.proname));
  for (const f of REQUIRED_FUNCTIONS) {
    if (!fns.has(f)) throw new Error(`function missing: ${f}()`);
  }

  return `${REQUIRED_TABLES.length} tables (RLS enabled on all), ${REQUIRED_VIEWS.length} view(s), ${REQUIRED_FUNCTIONS.length} function(s) present`;
}

async function assertSeedAdminLogin() {
  const password = randomBytes(18).toString("base64url");

  const result = runNodeScript("scripts/seed-admin.mjs", [VERIFY_ADMIN_EMAIL, "Verify Admin"], {
    SEED_ADMIN_PASSWORD: password,
  });
  if (result.status !== 0) {
    throw new Error(
      `seed:admin exited with code ${result.status}:\n${(result.stdout + result.stderr).trim()}`,
    );
  }

  // Independent proof: sign in exactly the way /admin/login does — anon key +
  // signInWithPassword — then assert the JWT claims and sign out.
  const anonClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await anonClient.auth.signInWithPassword({
    email: VERIFY_ADMIN_EMAIL,
    password,
  });
  if (error || !data?.session?.user) {
    throw new Error(`signInWithPassword failed for seeded admin: ${error?.message ?? "no session"}`);
  }
  const meta = data.session.user.app_metadata ?? {};
  if (meta.role !== "admin") throw new Error(`seeded admin JWT role is ${String(meta.role)}, expected "admin"`);
  if (typeof meta.tenant_id !== "string" || meta.tenant_id.length === 0) {
    throw new Error("seeded admin JWT is missing app_metadata.tenant_id");
  }
  await anonClient.auth.signOut();
  return `seed:admin produced a password-login-capable admin (role=admin, tenant_id stamped); signed in and out via anon key`;
}

async function assertSeedDemoIdempotent() {
  const first = runNodeScript("scripts/seed-demo.mjs");
  if (first.status !== 0) {
    throw new Error(`seed:demo (run 1) exited with code ${first.status}:\n${(first.stdout + first.stderr).trim()}`);
  }
  const countsAfterFirst = await countAllRows();

  const second = runNodeScript("scripts/seed-demo.mjs");
  if (second.status !== 0) {
    throw new Error(`seed:demo (run 2) exited with code ${second.status}:\n${(second.stdout + second.stderr).trim()}`);
  }
  const countsAfterSecond = await countAllRows();

  const diffs = [];
  for (const table of REQUIRED_TABLES) {
    if (countsAfterFirst[table] !== countsAfterSecond[table]) {
      diffs.push(`${table}: ${countsAfterFirst[table]} → ${countsAfterSecond[table]}`);
    }
  }
  if (diffs.length > 0) {
    throw new Error(`row counts changed between seed:demo runs — not idempotent: ${diffs.join(", ")}`);
  }
  return `seed:demo ran twice; row counts identical across all ${REQUIRED_TABLES.length} tables`;
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

const ASSERTIONS = [
  ["A. schema-apply", assertSchemaApply],
  ["B. tenancy-rls-v2", assertTenancyRlsV2],
  ["C. required-objects", assertRequiredObjects],
  ["D. seed-admin-login", assertSeedAdminLogin],
  ["E. seed-demo-idempotent", assertSeedDemoIdempotent],
];

async function main() {
  console.log(`TeamFrame install verification — project: ${url}\n`);
  await client.connect();

  let failures = 0;
  for (const [name, fn] of ASSERTIONS) {
    process.stdout.write(`• ${name} … `);
    try {
      const detail = await fn();
      console.log(`PASS\n    ${detail}`);
    } catch (err) {
      failures += 1;
      console.log(`FAIL\n    ${err.message}`);
    }
  }

  console.log(
    failures === 0
      ? `\n✓ verify:install — ${ASSERTIONS.length}/${ASSERTIONS.length} assertions PASS.`
      : `\n✗ verify:install — ${failures} assertion(s) FAILED.`,
  );
  process.exitCode = failures === 0 ? 0 : 1;
}

main()
  .catch((err) => {
    console.error("\nverify:install crashed:", err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.end();
  });
