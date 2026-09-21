/**
 * TeamFrame — apply database schemas to STAGING environment.
 *
 * Reads staging credentials from the environment (or .env.staging) and applies
 * the canonical schema order to the explicitly named disposable project.
 *
 * HR5 guard: checks both public and database URLs against
 * SUPABASE_PROJECT_REF_STAGING before connecting. Exits non-zero on mismatch.
 *
 * Usage:
 *   npm run db:apply:staging
 *   node scripts/apply-schemas-staging.mjs --resume-disposable-after-early-employment
 *
 * Inspect the remote schema before running: this script has no migration journal.
 * Never run it against an existing customer project.
 */

import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import dotenv from "dotenv";
import { SCHEMA_ORDER } from "./schema-order.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");

// Load existing project env first (for HR5 comparison), then staging env.
dotenv.config({ path: join(repoRoot, ".env.local") });
dotenv.config({ path: join(repoRoot, ".env.staging") });

// ─── HR5 Guard ────────────────────────────────────────────────────────────────
if (!process.env.SUPABASE_URL_STAGING) {
  console.error("[PARITY_FAIL] SUPABASE_URL_STAGING missing — aborting.");
  process.exit(1);
}
if (process.env.SUPABASE_URL_STAGING === process.env.NEXT_PUBLIC_SUPABASE_URL) {
  console.error(
    "[PARITY_FAIL] SUPABASE_URL_STAGING must differ from NEXT_PUBLIC_SUPABASE_URL — aborting.\n" +
    "  You may be pointing staging at the existing project. This is forbidden (HR5)."
  );
  process.exit(1);
}
// ─────────────────────────────────────────────────────────────────────────────

const connectionString = process.env.SUPABASE_DB_URL_STAGING?.replace(/^"|"$/g, "");
if (!connectionString) {
  console.error("✗ SUPABASE_DB_URL_STAGING is missing from .env.staging.");
  process.exit(1);
}

// Fail closed before connecting: the public project URL and Postgres endpoint
// must both identify the explicitly selected disposable project.
const expectedRef = process.env.SUPABASE_PROJECT_REF_STAGING;
const resumePartial = process.argv.includes("--resume-disposable-after-early-employment");
let publicUrl;
let databaseUrl;
try {
  publicUrl = new URL(process.env.SUPABASE_URL_STAGING);
  databaseUrl = new URL(connectionString);
} catch {
  console.error("[PARITY_FAIL] Invalid staging project or database URL — aborting.");
  process.exit(1);
}
const publicRef = publicUrl.hostname.match(/^([a-z0-9]+)\.supabase\.co$/)?.[1];
const directRef = databaseUrl.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/)?.[1];
const poolerRef = databaseUrl.username.match(/^postgres\.([a-z0-9]+)$/)?.[1];
const dbRef = directRef ?? poolerRef;
if (
  !expectedRef || !/^[a-z0-9]+$/.test(expectedRef) ||
  publicUrl.protocol !== "https:" ||
  databaseUrl.protocol !== "postgresql:" ||
  databaseUrl.search !== "" ||
  !publicRef || !dbRef ||
  publicRef !== expectedRef || dbRef !== expectedRef ||
  (directRef && poolerRef && directRef !== poolerRef) ||
  (poolerRef && !databaseUrl.hostname.endsWith(".pooler.supabase.com"))
) {
  console.error("[PARITY_FAIL] Staging project identity mismatch — aborting before connection.");
  process.exit(1);
}
if (process.argv.includes("--check-target")) {
  console.log(`Verified staging target: ${expectedRef}`);
  process.exit(0);
}

// The canonical order already includes the v2 tenant-isolation fix.
// Reuse it directly so staging cannot apply a migration twice as the list evolves.
const STAGING_SCHEMA_ORDER = SCHEMA_ORDER;

const { Client } = pg;
const client = new Client({
  connectionString,
  ssl: {
    ca: readFileSync(join(repoRoot, "certs", "supabase-root-2021-ca.crt"), "utf8"),
    rejectUnauthorized: true,
  },
});

async function main() {
  console.log("• Connecting to STAGING Postgres…");
  console.log(`  Verified disposable project ref: ${expectedRef}`);
  await client.connect();
  await client.query("reset role");
  console.log("✓ Connected.\n");

  // One-time recovery for the fresh TAKAVEN launch-test project. A previous
  // schema order failed at transactional_mutations after early_employment.
  // Refuse a normal full apply on any already-initialized database and refuse
  // the recovery unless its exact empty, partial footprint is present.
  const { rows: [state] } = await client.query(`
    select
      to_regclass('public.companies') is not null as has_companies,
      to_regclass('public.onboarding_check_ins') is not null as has_early_employment,
      to_regclass('public.file_operations') is not null as has_file_operations,
      to_regclass('public.leave_definitions') is not null as has_leave_definitions,
      to_regclass('public.departments') is not null as has_departments,
      exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = 'teamframe_decide_leave') as has_transactional_rpc,
      (select count(*) from pg_tables where schemaname = 'public') as public_tables,
      (select count(*) from auth.users) as auth_users,
      (select count(*) from storage.objects) as stored_objects
  `);
  if (resumePartial) {
    if (expectedRef !== "syytforaidoorrvrbqwz" ||
        !state.has_companies || !state.has_early_employment ||
        state.has_file_operations || state.has_leave_definitions ||
        state.has_departments || state.has_transactional_rpc ||
        Number(state.public_tables) !== 25 ||
        Number(state.auth_users) !== 0 || Number(state.stored_objects) !== 0) {
      throw new Error("[PARITY_FAIL] Disposable partial-schema recovery preflight failed; no SQL applied.");
    }
    const { rows: [counts] } = await client.query(
      "select (select count(*) from public.companies) as companies, (select count(*) from public.employees) as employees"
    );
    if (Number(counts.companies) !== 0 || Number(counts.employees) !== 0) {
      throw new Error("[PARITY_FAIL] Disposable recovery requires empty company and employee tables; no SQL applied.");
    }
    console.log("✓ Disposable partial-schema preflight passed; resuming after early_employment.sql.\n");
  } else if (state.has_companies) {
    throw new Error("[PARITY_FAIL] Database already initialized; full schema replay refused. Inspect before recovery.");
  }

  const remainingFiles = resumePartial
    ? STAGING_SCHEMA_ORDER.slice(STAGING_SCHEMA_ORDER.indexOf("early_employment.sql") + 1)
    : STAGING_SCHEMA_ORDER;
  for (const file of remainingFiles) {
    const path = join(repoRoot, "schemas", file);
    const sql = await readFile(path, "utf8");
    process.stdout.write(`• Applying ${file}… `);
    try {
      await client.query(sql);
      console.log("✓");
    } catch (err) {
      console.log("✗");
      console.error(`\n  ${err.message}\n`);
      throw err;
    }
  }

  console.log("\n✓ All staging schemas applied.");
  console.log(`  Applied this run: ${remainingFiles.join(", ")}`);
}

main()
  .catch((err) => {
    console.error("\nStaging migration failed:", err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.end();
  });
