/**
 * TeamFrame independent-installation access/provisioning runtime gate.
 *
 * Requires AUDIT_* disposable Supabase variables. Does not load .env.local and
 * refuses known persistent refs. Synthetic data only.
 */

import crypto from "node:crypto";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";

const REQUIRED = [
  "TEAMFRAME_AUDIT_INTEGRATION",
  "AUDIT_SUPABASE_PROJECT_REF",
  "AUDIT_SUPABASE_URL",
  "AUDIT_SUPABASE_ANON_KEY",
  "AUDIT_SUPABASE_SERVICE_ROLE_KEY",
  "AUDIT_SUPABASE_DB_URL",
];

const KNOWN_NON_DISPOSABLE_REFS = new Set([
  "zylllrvcmockvfcfubkp",
  "jjsvkvkvhowofmdtpztb",
  "eucnsrtdjxcylknbuglw",
  "zydhgtmgrbdyghmvuldc",
]);

const PASSWORD = `Tf-${crypto.randomBytes(18).toString("base64url")}1!`;
const RUN = `access-${Date.now()}`;

function fail(message) {
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function pass(message) {
  console.log(`✓ ${message}`);
}

function requireEnv() {
  const missing = REQUIRED.filter((name) => !process.env[name]?.trim());
  if (missing.length) fail(`Missing required env: ${missing.join(", ")}`);
  if (process.env.TEAMFRAME_AUDIT_INTEGRATION !== "authorised-disposable") {
    fail("TEAMFRAME_AUDIT_INTEGRATION must be authorised-disposable");
  }
  if (KNOWN_NON_DISPOSABLE_REFS.has(process.env.AUDIT_SUPABASE_PROJECT_REF)) {
    fail(`Refusing known non-disposable ref ${process.env.AUDIT_SUPABASE_PROJECT_REF}`);
  }
  const url = new URL(process.env.AUDIT_SUPABASE_URL);
  if (!url.hostname.includes(process.env.AUDIT_SUPABASE_PROJECT_REF)) {
    fail("AUDIT_SUPABASE_URL does not match AUDIT_SUPABASE_PROJECT_REF");
  }
}

const admin = createClient(process.env.AUDIT_SUPABASE_URL, process.env.AUDIT_SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function anonClient() {
  return createClient(process.env.AUDIT_SUPABASE_URL, process.env.AUDIT_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function createAuthUser(email, metadata = {}) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    app_metadata: metadata,
  });
  if (error || !data?.user) fail(`Auth user create failed for ${email}: ${error?.message ?? "no user"}`);
  return data.user.id;
}

async function signIn(email) {
  const client = anonClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error || !data?.session) fail(`Sign-in failed for ${email}: ${error?.message ?? "no session"}`);
  return client;
}

async function rows(client, table, select = "id", query = (q) => q) {
  const { data, error } = await query(client.from(table).select(select));
  if (error) fail(`${table} query failed: ${error.message}`);
  return data ?? [];
}

async function maybeInsert(table, payload, select = "id") {
  const { data, error } = await admin.from(table).insert(payload).select(select);
  if (error) fail(`${table} insert failed: ${error.message}`);
  return data;
}

async function main() {
  requireEnv();
  console.log(`TeamFrame independent access runtime gate: ${process.env.AUDIT_SUPABASE_PROJECT_REF}`);

  const db = new pg.Client({
    connectionString: process.env.AUDIT_SUPABASE_DB_URL.replace(/^"|"$/g, ""),
    ssl: { rejectUnauthorized: false },
  });
  await db.connect();

  try {
    const emails = {
      full: `full-${RUN}@teamframe.example`,
      admin: `admin-${RUN}@teamframe.example`,
      finance: `finance-${RUN}@teamframe.example`,
      manager: `manager-${RUN}@teamframe.example`,
      employee: `employee-${RUN}@teamframe.example`,
      custom: `custom-${RUN}@teamframe.example`,
      externalFinance: `external-finance-${RUN}@teamframe.example`,
      otherTenantAdmin: `other-admin-${RUN}@teamframe.example`,
    };

    const [tenantA] = await maybeInsert("companies", { name: `Runtime Customer A ${RUN}`, slug: `runtime-a-${RUN}` }, "id");
    const [tenantB] = await maybeInsert("companies", { name: `Runtime Customer B ${RUN}`, slug: `runtime-b-${RUN}` }, "id");

    const employeePayloads = [
      [tenantA.id, "Full Access", emails.full, "Founder", "Leadership", null],
      [tenantA.id, "Admin", emails.admin, "People Admin", "People", null],
      [tenantA.id, "Finance", emails.finance, "Finance", "Finance", null],
      [tenantA.id, "Manager", emails.manager, "Manager", "Ops", null],
      [tenantA.id, "Employee", emails.employee, "Analyst", "Ops", null],
      [tenantA.id, "Custom", emails.custom, "Coordinator", "People", null],
      [tenantB.id, "Other Admin", emails.otherTenantAdmin, "Admin", "Ops", null],
    ].map(([tenant_id, full_name, email, role_title, department, manager_id]) => ({
      tenant_id,
      full_name,
      email,
      role_title,
      department,
      timezone: "UTC",
      setup_status: "active",
      status: "active",
      manager_id,
    }));
    const employees = await maybeInsert("employees", employeePayloads, "id, tenant_id, email, department");
    const byEmail = new Map(employees.map((employee) => [employee.email, employee]));

    await admin
      .from("employees")
      .update({ manager_id: byEmail.get(emails.manager).id })
      .eq("tenant_id", tenantA.id)
      .eq("id", byEmail.get(emails.employee).id);

    const userIds = new Map();
    for (const [key, email] of Object.entries(emails)) {
      const tenantId = key === "otherTenantAdmin" ? tenantB.id : tenantA.id;
      const role = key === "full" || key === "admin" || key === "otherTenantAdmin" ? "admin" : "employee";
      const userId = await createAuthUser(email, { tenant_id: tenantId, role });
      userIds.set(email, userId);
      await admin.from("employees").update({ auth_user_id: userId }).eq("email", email);
    }

    const memberships = [
      [emails.full, "full_access", byEmail.get(emails.full).id, "all", "manage", "all", "all", true, true],
      [emails.admin, "admin", byEmail.get(emails.admin).id, "all", "none", "all", "none", false, false],
      [emails.finance, "finance", byEmail.get(emails.finance).id, "none", "view", "all", "none", true, false],
      [emails.manager, "employee", byEmail.get(emails.manager).id, "none", "none", "all", "none", false, false],
      [emails.employee, "employee", byEmail.get(emails.employee).id, "none", "none", "all", "none", false, false],
      [emails.custom, "employee", byEmail.get(emails.custom).id, "selected_people", "view", "selected_people", "selected_people", false, false],
      [emails.externalFinance, "finance", null, "none", "view", "all", "none", true, false],
      [emails.otherTenantAdmin, "full_access", byEmail.get(emails.otherTenantAdmin).id, "all", "manage", "all", "all", true, true],
    ];

    for (const [email, profile, employeeId, peopleScope, salaryLevel, salaryScope, docsScope, financeExports, manageUsers] of memberships) {
      const tenantId = email === emails.otherTenantAdmin ? tenantB.id : tenantA.id;
      const selected = email === emails.custom ? [byEmail.get(emails.employee).id] : [];
      await maybeInsert("tenant_memberships", {
        tenant_id: tenantId,
        auth_user_id: userIds.get(email),
        employee_id: employeeId,
        email,
        display_name: email,
        profile,
        people_access_scope: peopleScope,
        people_selected_employee_ids: selected,
        salary_access_level: salaryLevel,
        salary_access_scope: salaryScope,
        salary_selected_employee_ids: selected,
        private_documents_scope: docsScope,
        private_documents_selected_employee_ids: selected,
        finance_exports_access: financeExports,
        manage_users_access: manageUsers,
        active: true,
      });
    }

    await maybeInsert("compensation", {
      tenant_id: tenantA.id,
      employee_id: byEmail.get(emails.employee).id,
      base_salary: 65000,
      currency: "GBP",
      grade_band: "A",
    }, "employee_id");
    await maybeInsert("employee_payment_details", {
      tenant_id: tenantA.id,
      employee_id: byEmail.get(emails.employee).id,
      account_holder_name: "Employee",
      bank_name: "Runtime Bank",
      account_number_iban: "GB00RUNTIME00000000000000",
      account_currency: "GBP",
    }, "employee_id");
    await maybeInsert("documents", {
      tenant_id: tenantA.id,
      employee_id: byEmail.get(emails.employee).id,
      type: "CONTRACT",
      document_type: "contract",
      file_url: "runtime/private/contract.pdf",
      sensitivity: "private",
      content_access_class: "private_employee",
    });
    const storagePath = `${tenantA.id}/${byEmail.get(emails.employee).id}/runtime-${RUN}.pdf`;
    const { error: uploadError } = await admin.storage
      .from("documents")
      .upload(storagePath, new Blob(["%PDF-1.4\n% runtime evidence\n"], { type: "application/pdf" }));
    if (uploadError) fail(`Storage upload failed: ${uploadError.message}`);

    await maybeInsert("tenant_access_invitations", {
      tenant_id: tenantA.id,
      employee_id: null,
      email: `invite-${RUN}@teamframe.example`,
      display_name: "External Consultant",
      profile: "finance",
      salary_access_level: "view",
      salary_access_scope: "all",
      finance_exports_access: true,
      active: true,
      invited_by_user_id: userIds.get(emails.full),
    });
    await maybeInsert("leave_opening_adjustments", {
      tenant_id: tenantA.id,
      employee_id: byEmail.get(emails.employee).id,
      period_year: new Date().getUTCFullYear(),
      leave_type: "annual",
      used_days: 3,
      note: "Runtime opening balance",
      created_by_user_id: userIds.get(emails.full),
    });

    const fullClient = await signIn(emails.full);
    const adminClient = await signIn(emails.admin);
    const financeClient = await signIn(emails.finance);
    const managerClient = await signIn(emails.manager);
    const employeeClient = await signIn(emails.employee);
    const customClient = await signIn(emails.custom);
    const externalFinanceClient = await signIn(emails.externalFinance);
    const otherTenantClient = await signIn(emails.otherTenantAdmin);

    assert((await rows(fullClient, "employees", "id, tenant_id")).every((row) => row.tenant_id === tenantA.id), "Full Access saw another tenant");
    assert((await rows(otherTenantClient, "employees", "id, tenant_id")).every((row) => row.tenant_id === tenantB.id), "Tenant B user saw Tenant A");
    pass("Independent installation membership and tenant isolation hold");

    assert((await rows(adminClient, "compensation", "employee_id")).length === 0, "Admin should not see compensation");
    assert((await rows(financeClient, "compensation", "employee_id")).length === 1, "Finance should see compensation");
    assert((await rows(externalFinanceClient, "employees", "id")).length === 0, "Access-only Finance should not become an employee/headcount row");
    assert((await rows(externalFinanceClient, "compensation", "employee_id")).length === 1, "Access-only Finance should see payroll compensation");
    assert((await rows(managerClient, "compensation", "employee_id")).length === 1, "Manager should derive direct-report salary view");
    pass("Salary, finance and access-only user boundaries hold");

    const managerEmployees = await rows(managerClient, "employees", "id");
    assert(managerEmployees.some((row) => row.id === byEmail.get(emails.employee).id), "Manager did not see direct report");
    assert(!managerEmployees.some((row) => row.id === byEmail.get(emails.admin).id), "Manager saw lateral employee");
    const customEmployees = await rows(customClient, "employees", "id");
    assert(customEmployees.some((row) => row.id === byEmail.get(emails.employee).id), "Custom selected-person scope did not apply");
    assert(!customEmployees.some((row) => row.id === byEmail.get(emails.admin).id), "Custom selected-person scope leaked laterally");
    pass("Own Team direct-report and Custom selected-person scopes hold");

    assert((await rows(managerClient, "documents", "id")).length === 0, "Manager saw private direct-report document");
    assert((await rows(adminClient, "documents", "id")).length === 0, "Admin saw private employee document");
    assert((await rows(fullClient, "documents", "id")).length === 1, "Full Access should see private document");
    assert((await rows(employeeClient, "documents", "id")).length === 1, "Employee should see own document");
    const { data: signed, error: signedError } = await admin.storage.from("documents").createSignedUrl(storagePath, 60);
    if (signedError || !signed?.signedUrl) fail(`Signed URL creation failed: ${signedError?.message ?? "no url"}`);
    const fetchResult = await fetch(signed.signedUrl);
    assert(fetchResult.ok, "Signed private document retrieval failed");
    pass("Private document and signed-storage proof completed");

    assert((await rows(fullClient, "tenant_access_invitations", "id")).length === 1, "Full Access should manage staged access");
    assert((await rows(adminClient, "tenant_access_invitations", "id")).length === 0, "Admin preset should not manage access");
    const { rows: openingRows } = await db.query(
      "select used_days from leave_opening_adjustments where tenant_id = $1 and employee_id = $2 and leave_type = 'annual'",
      [tenantA.id, byEmail.get(emails.employee).id],
    );
    assert(Number(openingRows[0]?.used_days) === 3, "Opening leave adjustment missing");
    pass("Access staging and opening leave balance records are tenant-safe");

    const { data: fullCanManage } = await fullClient.rpc("current_actor_has_capability", {
      p_tenant_id: tenantA.id,
      p_capability: "company_access_settings",
      p_employee_id: null,
      p_department: null,
    });
    const { data: adminCanManage } = await adminClient.rpc("current_actor_has_capability", {
      p_tenant_id: tenantA.id,
      p_capability: "company_access_settings",
      p_employee_id: null,
      p_department: null,
    });
    assert(fullCanManage === true, "Full Access should have company access settings");
    assert(adminCanManage === false, "Admin preset should not have company access settings");
    pass("Capability RPC reflects Full Access vs Admin boundary");
  } finally {
    await db.end();
  }
}

main().catch((error) => {
  console.error(`✗ ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
