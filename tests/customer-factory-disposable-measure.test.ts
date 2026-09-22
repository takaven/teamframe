import { performance } from "node:perf_hooks";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import { expect, it, vi } from "vitest";
import { customerFactory120Pack } from "./fixtures/customer-factory-120";
import { APPROVED_LAUNCH_PROJECT_REFS } from "../scripts/approved-launch-projects.mjs";

vi.mock("server-only", () => ({}));

// Excluded from ordinary test runs by a fail-closed environment gate. A failure
// quarantines the target for inspection; this test never retries or cleans rows.
it.skipIf(process.env.TEAMFRAME_FACTORY_INVOKED !== "1")("measures the unchanged 120-person commit on a clean synthetic tenant", async () => {
  const ref = process.env.TEAMFRAME_FACTORY_PROJECT_REF;
  if (!ref || !APPROVED_LAUNCH_PROJECT_REFS.has(ref) || process.env.TEAMFRAME_FACTORY_APPROVAL !== `measure:${ref}` ||
      process.env.NEXT_PUBLIC_SUPABASE_URL !== `https://${ref}.supabase.co` ||
      !process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.TEAMFRAME_FACTORY_DB_URL) throw new Error("FACTORY_TARGET_GUARD_FAILED");
  const dbUrl = new URL(process.env.TEAMFRAME_FACTORY_DB_URL);
  const directRef = dbUrl.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/)?.[1];
  const poolerRef = dbUrl.username.match(/^postgres\.([a-z0-9]+)$/)?.[1];
  if (dbUrl.protocol !== "postgresql:" || dbUrl.search || dbUrl.hash || (directRef ?? poolerRef) !== ref ||
      (directRef && dbUrl.username !== "postgres") ||
      (poolerRef && !dbUrl.hostname.endsWith(".pooler.supabase.com"))) throw new Error("FACTORY_DB_TARGET_GUARD_FAILED");
  const db = new pg.Client({ connectionString: dbUrl.toString(), ssl: {
    ca: readFileSync(resolve("certs/supabase-root-2021-ca.crt"), "utf8"), rejectUnauthorized: true,
  } });
  await db.connect();
  try {

  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const count = async (table: string, tenantId: string) => {
    const result = await client.from(table).select("id", { head: true, count: "exact" }).eq("tenant_id", tenantId);
    if (result.error) throw new Error(`FACTORY_COUNT_FAILED:${table}:${result.error.message}`);
    return result.count ?? 0;
  };
  const { data: companies, error: companyError } = await client.from("companies").select("id,name,slug").limit(2);
  if (companyError || companies?.length !== 1 || !companies[0]?.name.toLowerCase().includes("synthetic")) {
    throw new Error("FACTORY_REQUIRES_ONE_CLEAN_SYNTHETIC_COMPANY");
  }
  const company = companies[0];
  const { rows: [projectState] } = await db.query(`select (select count(*)::int from auth.users) as auth_users,
    (select count(*)::int from storage.objects) as storage_objects`);
  if (projectState.auth_users !== 1 || projectState.storage_objects !== 0) {
    throw new Error(`FACTORY_PROJECT_DIRTY:${JSON.stringify(projectState)}`);
  }
  const { data: memberships, error: membershipError } = await client.from("tenant_memberships")
    .select("auth_user_id,email,profile,active").eq("tenant_id", company.id);
  if (membershipError || memberships?.length !== 1 || memberships[0]?.profile !== "full_access" || !memberships[0]?.active ||
      memberships[0].email !== "factory-bootstrap@teamframe.invalid") throw new Error("FACTORY_REQUIRES_ONE_SYNTHETIC_FULL_ACCESS_ACTOR");
  const { data: authUser, error: authError } = await client.auth.admin.getUserById(memberships[0].auth_user_id);
  if (authError || authUser.user?.email?.toLowerCase() !== memberships[0].email.toLowerCase()) {
    throw new Error("FACTORY_ACTOR_AUTH_MISMATCH");
  }
  const { rows: publicTables } = await db.query("select tablename from pg_tables where schemaname = 'public'");
  const allowedRows: Record<string, number> = { companies: 1, tenant_memberships: 1 };
  const publicCounts: Record<string, number> = {};
  for (const { tablename } of publicTables) {
    const quoted = String(tablename).replaceAll('"', '""');
    const { rows: [row] } = await db.query(`select count(*)::int as count from public."${quoted}"`);
    publicCounts[tablename] = row.count;
    if (row.count !== (allowedRows[tablename] ?? 0)) {
      throw new Error(`FACTORY_PUBLIC_TABLE_DIRTY:${tablename}:${row.count}`);
    }
  }
  if (publicTables.length !== 39 || !("companies" in publicCounts) || !("tenant_memberships" in publicCounts)) {
    throw new Error(`FACTORY_SCHEMA_UNEXPECTED:${publicTables.length}`);
  }
  const tables = ["employees", "setup_import_batches", "tenant_access_invitations", "leave_opening_adjustments", "company_holidays"];
  const before = Object.fromEntries(await Promise.all(tables.map(async (table) => [table, await count(table, company.id)])));
  if (Object.values(before).some((value) => value !== 0)) throw new Error(`FACTORY_TARGET_DIRTY:${JSON.stringify(before)}`);

  const { recordSetupPackPreview, commitSetupPack } = await import("@/services/customerProvisioningService");
  const actor = { authUserId: memberships[0].auth_user_id, email: memberships[0].email, employeeId: null,
    tenantId: company.id, role: "admin" as const, accessProfile: "full_access" as const };
  const started = performance.now();
  try {
    const previewStart = performance.now();
    const result = await recordSetupPackPreview(actor, { tenantId: company.id, fileName: "synthetic-120", ...customerFactory120Pack() });
    const previewSeconds = (performance.now() - previewStart) / 1000;
    if (result.preview.validationErrors.length) throw new Error(`FACTORY_PREVIEW_INVALID:${result.preview.validationErrors.join("|")}`);
    const commitStart = performance.now();
    const committedTenant = await commitSetupPack(actor, result.id);
    expect(committedTenant).toBe(company.id);
    const after = Object.fromEntries(await Promise.all(tables.map(async (table) => [table, await count(table, company.id)])));
    expect(after.employees).toBe(120);
    expect(after.tenant_access_invitations).toBe(121);
    expect(after.setup_import_batches).toBe(1);
    expect(after.company_holidays).toBe(2);
    expect(after.leave_opening_adjustments).toBe(116);
    const { rows: [relationships] } = await db.query(`select
      (select count(*)::int from public.employees where tenant_id = $1 and manager_id is not null) as manager_links,
      (select count(*)::int from public.employees where tenant_id = $1 and employee_number is not null) as employee_numbers,
      (select count(distinct employee_number)::int from public.employees where tenant_id = $1) as distinct_employee_numbers,
      (select count(*)::int from public.tenant_access_invitations where tenant_id = $1 and employee_id is not null) as linked_invitations,
      (select count(*)::int from public.setup_import_batches where tenant_id = $1 and state = 'committed') as committed_batches,
      (select employee_number_next from public.companies where id = $1) as next_employee_number`, [company.id]);
    expect(relationships).toEqual({ manager_links: 108, employee_numbers: 120, distinct_employee_numbers: 120,
      linked_invitations: 120, committed_batches: 1, next_employee_number: 121 });
    console.info(`FACTORY_RELATIONSHIPS ${JSON.stringify(relationships)}`);
    const { rows: [joinWork] } = await db.query(`select
      (select count(*)::int from public.employee_join_initializations j join public.employees e on e.id = j.employee_id
        where e.tenant_id = $1 and e.start_date = date '2024-01-15') as existing_initializations,
      (select count(*)::int from public.onboarding_tasks t join public.employees e on e.id = t.employee_id
        where e.tenant_id = $1 and e.start_date = date '2024-01-15') as existing_tasks,
      (select count(*)::int from public.onboarding_check_ins c join public.employees e on e.id = c.employee_id
        where e.tenant_id = $1 and e.start_date = date '2024-01-15') as existing_check_ins,
      (select count(*)::int from public.probation_reviews p join public.employees e on e.id = p.employee_id
        where e.tenant_id = $1 and e.start_date = date '2024-01-15') as existing_probation,
      (select count(*)::int from public.hr_automation_items a join public.employees e on e.id::text = (a.metadata ->> 'employee_id')
        where e.tenant_id = $1 and e.start_date = date '2024-01-15' and a.tenant_id = $1
          and a.rule_key in ('onboarding.manager_task_due', 'onboarding.check_in.due', 'probation.review_due', 'probation.manager_input_due')) as existing_join_automation,
      (select count(*)::int from public.employee_join_initializations j join public.employees e on e.id = j.employee_id
        where e.tenant_id = $1 and e.start_date = date '2026-10-15') as starter_initializations,
      (select count(*)::int from public.onboarding_tasks t join public.employees e on e.id = t.employee_id
        where e.tenant_id = $1 and e.start_date = date '2026-10-15') as starter_tasks,
      (select count(*)::int from public.onboarding_tasks t join public.employees e on e.id = t.employee_id
        where e.tenant_id = $1 and e.start_date = date '2026-10-15' and t.owner_role = 'manager' and t.owner_employee_id = e.manager_id) as starter_manager_tasks,
      (select count(*)::int from public.onboarding_check_ins c join public.employees e on e.id = c.employee_id
        where e.tenant_id = $1 and e.start_date = date '2026-10-15') as starter_check_ins,
      (select count(*)::int from public.probation_reviews p join public.employees e on e.id = p.employee_id
        where e.tenant_id = $1 and e.start_date = date '2026-10-15') as starter_probation`, [company.id]);
    expect(joinWork).toEqual({ existing_initializations: 0, existing_tasks: 0, existing_check_ins: 0,
      existing_probation: 0, existing_join_automation: 0, starter_initializations: 4, starter_tasks: 24, starter_manager_tasks: 4,
      starter_check_ins: 4, starter_probation: 4 });
    console.info(`FACTORY_JOIN_WORK ${JSON.stringify(joinWork)}`);
    console.info(`FACTORY_RESULT ${JSON.stringify({ ref, previewSeconds, commitSeconds: (performance.now() - commitStart) / 1000,
      totalSeconds: (performance.now() - started) / 1000, before, after })}`);
  } catch (error) {
    const afterFailure = Object.fromEntries(await Promise.all(tables.map(async (table) => [table, await count(table, company.id).catch(() => "count-failed")])));
    console.error(`FACTORY_QUARANTINE ${JSON.stringify({ ref, afterFailure, message: error instanceof Error ? error.message : "unknown" })}`);
    throw error;
  }
  } finally {
    await db.end();
  }
}, 300_000);
