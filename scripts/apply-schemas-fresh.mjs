/**
 * TeamFrame — one-time fresh schema installation on an explicitly approved isolated project.
 *
 * Reads process-only install credentials and applies the canonical schema order
 * only if the target has zero public tables, auth users and stored objects.
 *
 * Requires TEAMFRAME_INSTALL_APPROVAL=fresh:<exact project ref>. This is an
 * operator acknowledgement, not a substitute for founder approval of the
 * first real customer deployment. Existing installations need a separate migration.
 *
 * Usage:
 *   npm run db:install:fresh
 *
 * Inspect the remote schema before running: this script has no migration journal.
 * Never run it against an existing customer project.
 */

import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { SCHEMA_ORDER } from "./schema-order.mjs";
import { APPROVED_LAUNCH_PROJECT_REFS } from "./approved-launch-projects.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");

const connectionString = process.env.TEAMFRAME_INSTALL_DB_URL?.replace(/^"|"$/g, "");
if (!connectionString) {
  console.error("[PARITY_FAIL] TEAMFRAME_INSTALL_DB_URL is required in process memory; no .env file is loaded.");
  process.exit(1);
}

// Fail closed before connecting: the public project URL and Postgres endpoint
// must both identify the explicitly selected disposable project.
const expectedRef = process.env.TEAMFRAME_INSTALL_PROJECT_REF;
let publicUrl;
let databaseUrl;
try {
  publicUrl = new URL(process.env.TEAMFRAME_INSTALL_SUPABASE_URL);
  databaseUrl = new URL(connectionString);
} catch {
  console.error("[PARITY_FAIL] Invalid fresh-install project or database URL — aborting.");
  process.exit(1);
}
const publicRef = publicUrl.hostname.match(/^([a-z0-9]+)\.supabase\.co$/)?.[1];
const directRef = databaseUrl.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/)?.[1];
const poolerRef = databaseUrl.username.match(/^postgres\.([a-z0-9]+)$/)?.[1];
const dbRef = directRef ?? poolerRef;
if (
  !expectedRef || !APPROVED_LAUNCH_PROJECT_REFS.has(expectedRef) ||
  process.env.TEAMFRAME_INSTALL_APPROVAL !== `fresh:${expectedRef}` ||
  publicUrl.protocol !== "https:" ||
  publicUrl.hostname !== `${expectedRef}.supabase.co` ||
  publicUrl.username || publicUrl.password || publicUrl.port || publicUrl.search || publicUrl.hash ||
  databaseUrl.protocol !== "postgresql:" ||
  databaseUrl.search !== "" || databaseUrl.hash !== "" ||
  !publicRef || !dbRef ||
  publicRef !== expectedRef || dbRef !== expectedRef ||
  (directRef && poolerRef && directRef !== poolerRef) ||
  (poolerRef && !databaseUrl.hostname.endsWith(".pooler.supabase.com")) ||
  (directRef && databaseUrl.username !== "postgres")
) {
  console.error("[PARITY_FAIL] Fresh-install target is not on the reviewed launch allowlist, or identity/acknowledgement mismatches — aborting before connection.");
  process.exit(1);
}
if (process.argv.includes("--check-target")) {
  console.log(`Verified fresh-install target: ${expectedRef}`);
  process.exit(0);
}

// The canonical order already includes the v2 tenant-isolation fix.
// Reuse it directly so fresh installs cannot apply a migration twice as the list evolves.
const FRESH_SCHEMA_ORDER = SCHEMA_ORDER;

const { Client } = pg;
const client = new Client({
  connectionString,
  ssl: {
    ca: readFileSync(join(repoRoot, "certs", "supabase-root-2021-ca.crt"), "utf8"),
    rejectUnauthorized: true,
  },
});

async function main() {
  console.log("• Connecting to approved fresh-install Postgres…");
  console.log(`  Verified project ref: ${expectedRef}`);
  await client.connect();
  await client.query("reset role");
  console.log("✓ Connected.\n");

  // This runner is for a clean disposable install only. Existing projects need
  // a separately reviewed migration path, not a replay of the full schema.
  const { rows: [state] } = await client.query(`
    select
      to_regclass('public.companies') is not null as has_companies,
      (select count(*) from pg_tables where schemaname = 'public') as public_tables,
      (select count(*) from auth.users) as auth_users,
      (select count(*) from storage.objects) as stored_objects
  `);
  if (state.has_companies || Number(state.public_tables) !== 0 ||
      Number(state.auth_users) !== 0 || Number(state.stored_objects) !== 0) {
    throw new Error("[PARITY_FAIL] Fresh install requires zero public tables, auth users, and stored objects; no SQL applied.");
  }

  for (const file of FRESH_SCHEMA_ORDER) {
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

  const { rows: [installed] } = await client.query(`
    select
      count(*)::int as tables,
      count(*) filter (where c.relrowsecurity)::int as rls_tables
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
  `);
  if (installed.tables !== 39 || installed.rls_tables !== installed.tables) {
    throw new Error(`[PARITY_FAIL] Post-install verification failed: ${installed.tables} public tables, ${installed.rls_tables} with RLS.`);
  }
  const { rows: [objects] } = await client.query(`
    select
      to_regprocedure('public.current_actor_tenant_id()') is not null as tenant_helper,
      to_regclass('public.employees_public') is not null as employee_view,
      to_regclass('public.employees_tenant_email_active_idx') is not null as tenant_index
  `);
  if (!objects.tenant_helper || !objects.employee_view || !objects.tenant_index) {
    throw new Error('[PARITY_FAIL] Post-install required function, view or index missing.');
  }
  const { rows: [privileges] } = await client.query(`
    select
      count(*) filter (where
        has_table_privilege('service_role', format('%I.%I', schemaname, tablename), 'SELECT')
        and has_table_privilege('service_role', format('%I.%I', schemaname, tablename), 'INSERT')
        and has_table_privilege('service_role', format('%I.%I', schemaname, tablename), 'UPDATE')
        and has_table_privilege('service_role', format('%I.%I', schemaname, tablename), 'DELETE')
      )::int as service_tables,
      count(*) filter (where
        has_table_privilege('anon', format('%I.%I', schemaname, tablename), 'SELECT')
        or has_table_privilege('anon', format('%I.%I', schemaname, tablename), 'INSERT')
        or has_table_privilege('anon', format('%I.%I', schemaname, tablename), 'UPDATE')
        or has_table_privilege('anon', format('%I.%I', schemaname, tablename), 'DELETE')
      )::int as anon_tables
    from pg_tables where schemaname = 'public'
  `);
  if (privileges.service_tables !== installed.tables || privileges.anon_tables !== 0) {
    throw new Error(`[PARITY_FAIL] Post-install API privileges failed: ${privileges.service_tables}/${installed.tables} service-role tables, ${privileges.anon_tables} anon-accessible tables.`);
  }
  console.log(`\n✓ Fresh schema installation verified: ${installed.tables} public tables, all RLS enabled; required objects and service-role privileges present; no anon table access.`);
  console.log(`  Applied this run: ${FRESH_SCHEMA_ORDER.join(", ")}`);
}

main()
  .catch((err) => {
    console.error("\nFresh installation failed:", err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.end();
  });
