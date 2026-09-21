/** One-shot, synthetic-only Full Access bootstrap for the measured factory run. */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";
import { APPROVED_LAUNCH_PROJECT_REFS } from "./approved-launch-projects.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ref = process.env.TEAMFRAME_FACTORY_PROJECT_REF;
const apiUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const dbString = process.env.TEAMFRAME_FACTORY_DB_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.FULL_ACCESS_PASSWORD;
const email = "factory-bootstrap@teamframe.invalid";
const companyName = "TeamFrame Factory Synthetic 120";
const companySlug = "teamframe-factory-synthetic-120";

function refuse(message) {
  console.error(`Factory bootstrap refused: ${message}`);
  process.exit(1);
}

let dbUrl;
try { dbUrl = new URL(dbString); } catch { refuse("valid process-only database URL required"); }
const directRef = dbUrl.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/)?.[1];
const poolerRef = dbUrl.username.match(/^postgres\.([a-z0-9]+)$/)?.[1];
if (!ref || !APPROVED_LAUNCH_PROJECT_REFS.has(ref) ||
    process.env.TEAMFRAME_FACTORY_BOOTSTRAP_APPROVAL !== `bootstrap:${ref}` ||
    apiUrl !== `https://${ref}.supabase.co` ||
    dbUrl.protocol !== "postgresql:" || dbUrl.search || dbUrl.hash ||
    (directRef ?? poolerRef) !== ref ||
    (directRef && dbUrl.username !== "postgres") ||
    (poolerRef && !dbUrl.hostname.endsWith(".pooler.supabase.com")) ||
    (directRef && poolerRef && directRef !== poolerRef) ||
    !serviceKey || !password || password.length < 12) {
  refuse("exact approved project/API/DB identity, bootstrap:<ref> approval, service key and synthetic password required");
}
if (process.argv.includes("--check-target")) {
  console.log(`Verified disposable factory bootstrap target: ${ref}`);
  process.exit(0);
}

const db = new pg.Client({
  connectionString: dbString,
  ssl: { ca: readFileSync(join(root, "certs", "supabase-root-2021-ca.crt"), "utf8"), rejectUnauthorized: true },
});
const api = createClient(apiUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
let writeAttempted = false;

async function counts() {
  const { rows: tables } = await db.query(`select tablename from pg_tables where schemaname = 'public' order by tablename`);
  if (tables.length !== 39) throw new Error(`expected 39 installed public tables, found ${tables.length}`);
  const publicCounts = new Map();
  for (const { tablename } of tables) {
    if (!/^[a-z_]+$/.test(tablename)) throw new Error("unexpected public table identifier");
    const { rows: [row] } = await db.query(`select count(*)::int as total from public."${tablename}"`);
    publicCounts.set(tablename, row.total);
  }
  const { rows: [state] } = await db.query(`select
    (select count(*)::int from auth.users) as auth_users,
    (select count(*)::int from storage.objects) as stored_objects`);
  return { publicCounts, ...state };
}

async function main() {
  await db.connect();
  try {
    const before = await counts();
    if (before.auth_users !== 0 || before.stored_objects !== 0 ||
        [...before.publicCounts.values()].some((total) => total !== 0)) {
      throw new Error("target is not completely empty; no bootstrap attempted");
    }
    const { data: buckets, error: bucketError } = await api.storage.listBuckets();
    if (bucketError || !buckets?.some((bucket) => bucket.name === "documents" && !bucket.public)) {
      throw new Error("required private documents bucket not verified");
    }
    console.log(`Verified empty synthetic factory target: ${ref}; starting one bootstrap attempt.`);
    writeAttempted = true;
    const child = spawnSync(process.execPath, [join(root, "scripts", "bootstrap-full-access.mjs")], {
      cwd: root,
      stdio: "inherit",
      env: {
        SystemRoot: process.env.SystemRoot,
        WINDIR: process.env.WINDIR,
        PATH: process.env.PATH,
        TEMP: process.env.TEMP,
        TMP: process.env.TMP,
        TEAMFRAME_ENV_FILE: join(root, ".env.factory-bootstrap-not-present"),
        NEXT_PUBLIC_SUPABASE_URL: apiUrl,
        SUPABASE_SERVICE_ROLE_KEY: serviceKey,
        FULL_ACCESS_EMAIL: email,
        FULL_ACCESS_NAME: "Factory Synthetic Operator",
        FULL_ACCESS_PASSWORD: password,
        TEAMFRAME_CREATE_ONLY_BOOTSTRAP: "1",
        TEAMFRAME_TENANT_NAME: companyName,
        TEAMFRAME_TENANT_SLUG: companySlug,
      },
    });
    if (child.error || child.status !== 0) {
      throw new Error("bootstrap failed; quarantine this target and do not retry or clean up automatically");
    }
    const after = await counts();
    if (after.auth_users !== 1 || after.stored_objects !== 0 ||
        [...after.publicCounts].some(([table, total]) => total !== (table === "companies" || table === "tenant_memberships" ? 1 : 0))) {
      throw new Error("post-bootstrap state differs from exactly one company/member/auth user; quarantine target");
    }
    const { rows: [identity] } = await db.query(`select c.name, c.slug, tm.email, tm.profile, tm.active,
      tm.auth_user_id = u.id as linked
      from public.companies c join public.tenant_memberships tm on tm.tenant_id = c.id
      join auth.users u on u.id = tm.auth_user_id`);
    if (identity.name !== companyName || identity.slug !== companySlug || identity.email !== email ||
        identity.profile !== "full_access" || !identity.active || !identity.linked) {
      throw new Error("post-bootstrap identity mismatch; quarantine target");
    }
    console.log("Factory bootstrap PASS: exactly one synthetic company, one Full Access member/auth user, no employees, files, or other public rows.");
  } finally {
    await db.end();
  }
}

main().catch((error) => {
  console.error(`Factory bootstrap STOP: ${error.message}`);
  if (writeAttempted) console.error("QUARANTINE: a write may have partially succeeded. Do not retry this target or assume cleanup; inspect it before any further use.");
  process.exitCode = 1;
});
