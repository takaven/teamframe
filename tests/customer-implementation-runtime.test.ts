import { performance } from "node:perf_hooks";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import { expect, it, vi } from "vitest";
import { APPROVED_LAUNCH_PROJECT_REFS } from "../scripts/approved-launch-projects.mjs";
import { EXPECTED_PUBLIC_TABLES } from "../scripts/schema-order.mjs";

vi.mock("server-only", () => ({}));

it.skipIf(process.env.TEAMFRAME_IMPLEMENTATION_INVOKED !== "1")("runs one guarded customer implementation pack", async () => {
  const ref = process.env.TEAMFRAME_IMPLEMENTATION_PROJECT_REF!;
  const tenantId = process.env.TEAMFRAME_IMPLEMENTATION_TENANT_ID!;
  const workspaceSlug = process.env.TEAMFRAME_IMPLEMENTATION_WORKSPACE_SLUG!;
  const mode = process.env.TEAMFRAME_IMPLEMENTATION_MODE!;
  const packPath = process.env.TEAMFRAME_IMPLEMENTATION_PACK!;
  const apiUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const dbString = process.env.TEAMFRAME_IMPLEMENTATION_DB_URL!;
  if (!APPROVED_LAUNCH_PROJECT_REFS.has(ref) || apiUrl !== `https://${ref}.supabase.co` ||
      process.env.TEAMFRAME_IMPLEMENTATION_CONTEXT !== "synthetic-customer-rehearsal" ||
      process.env.TEAMFRAME_IMPLEMENTATION_APPROVAL !== `${mode}:${ref}:${tenantId}` || !serviceKey || !dbString) {
    throw new Error("IMPLEMENTATION_TARGET_GUARD_FAILED");
  }

  const dbUrl = new URL(dbString);
  const directRef = dbUrl.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/)?.[1];
  const poolerRef = dbUrl.username.match(/^postgres\.([a-z0-9]+)$/)?.[1];
  if (dbUrl.protocol !== "postgresql:" || dbUrl.search || dbUrl.hash || (directRef ?? poolerRef) !== ref ||
      (directRef && dbUrl.username !== "postgres") || (poolerRef && !dbUrl.hostname.endsWith(".pooler.supabase.com"))) {
    throw new Error("IMPLEMENTATION_DB_TARGET_GUARD_FAILED");
  }

  const pack = JSON.parse(readFileSync(packPath, "utf8")) as unknown;
  const { validateCustomerImplementationPack, executeCustomerImplementation } = await import("@/services/customerImplementationService");
  const validation = validateCustomerImplementationPack(pack);
  if (!validation.pack || !validation.setupPreview || validation.validationErrors.length) {
    throw new Error(`IMPLEMENTATION_PACK_INVALID:${validation.validationErrors.join("|")}`);
  }

  const db = new pg.Client({ connectionString: dbString, ssl: {
    ca: readFileSync(resolve("certs/supabase-root-2021-ca.crt"), "utf8"), rejectUnauthorized: true,
  } });
  const api = createClient(apiUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  await db.connect();
  try {
    const { rows: publicTables } = await db.query("select tablename from pg_tables where schemaname = 'public' order by tablename");
    const installed = publicTables.map(({ tablename }) => String(tablename));
    expect(installed).toEqual(EXPECTED_PUBLIC_TABLES);
    const allowedRows: Record<string, number> = { companies: 1, tenant_memberships: 1 };
    for (const table of installed) {
      if (!/^[a-z_]+$/.test(table)) throw new Error("IMPLEMENTATION_UNEXPECTED_TABLE_IDENTIFIER");
      const { rows: [row] } = await db.query(`select count(*)::int as count from public."${table}"`);
      if (row.count !== (allowedRows[table] ?? 0)) throw new Error(`IMPLEMENTATION_TARGET_DIRTY:${table}:${row.count}`);
    }
    const { rows: [identity] } = await db.query(`select c.id, c.name, c.slug, tm.auth_user_id, tm.email, tm.profile, tm.active,
      (select count(*)::int from auth.users) as auth_users,
      (select count(*)::int from storage.objects) as storage_objects
      from public.companies c join public.tenant_memberships tm on tm.tenant_id = c.id`);
    if (identity?.id !== tenantId || identity?.slug !== workspaceSlug || identity?.profile !== "full_access" || !identity?.active ||
        identity?.auth_users !== 1 || identity?.storage_objects !== 0) throw new Error("IMPLEMENTATION_WORKSPACE_IDENTITY_FAILED");
    const { data: buckets, error: bucketError } = await api.storage.listBuckets();
    if (bucketError || !buckets?.some((bucket) => bucket.name === "documents" && !bucket.public)) throw new Error("IMPLEMENTATION_STORAGE_PREFLIGHT_FAILED");
    const { data: authUser, error: authError } = await api.auth.admin.getUserById(identity.auth_user_id);
    if (authError || authUser.user?.email?.toLowerCase() !== String(identity.email).toLowerCase()) throw new Error("IMPLEMENTATION_OPERATOR_IDENTITY_FAILED");

    console.info(`IMPLEMENTATION READY ${JSON.stringify({ ref, tenantId, workspace: identity.slug, company: validation.setupPreview.company.name,
      employees: validation.setupPreview.employees.length, departments: validation.pack.departments.length,
      locations: validation.pack.workLocations.length, positions: validation.pack.positions.length })}`);
    if (mode === "preflight") return;

    const actor = { authUserId: identity.auth_user_id, email: identity.email, employeeId: null,
      tenantId, role: "admin" as const, accessProfile: "full_access" as const };
    const started = performance.now();
    const result = await executeCustomerImplementation(actor, validation.pack, (stage) => console.info(`IMPLEMENTATION STAGE: ${stage}`));
    console.info(`IMPLEMENTATION COMPLETE ${JSON.stringify({ ...result, elapsedSeconds: (performance.now() - started) / 1000 })}`);
    expect(result.reconciliation).toBe("PASS");
    expect(result.createdEmployees).toBe(validation.setupPreview.employees.length);
  } catch (error) {
    console.error(`IMPLEMENTATION STOP ${error instanceof Error ? error.message : "unknown failure"}`);
    throw error;
  } finally {
    await db.end();
  }
}, 600_000);
