/**
 * TeamFrame access/provisioning disposable runtime gate.
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

function base32Decode(input) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const char of input.replace(/=+$/g, "").toUpperCase()) {
    const value = alphabet.indexOf(char);
    if (value < 0) continue;
    bits += value.toString(2).padStart(5, "0");
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(Number.parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

function totp(secret) {
  const counter = Math.floor(Date.now() / 1000 / 30);
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac("sha1", base32Decode(secret)).update(buffer).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code = ((hmac[offset] & 0x7f) << 24) | ((hmac[offset + 1] & 0xff) << 16) | ((hmac[offset + 2] & 0xff) << 8) | (hmac[offset + 3] & 0xff);
  return String(code % 1_000_000).padStart(6, "0");
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
  console.log(`TeamFrame access/provisioning runtime gate: ${process.env.AUDIT_SUPABASE_PROJECT_REF}`);

  const db = new pg.Client({
    connectionString: process.env.AUDIT_SUPABASE_DB_URL.replace(/^"|"$/g, ""),
    ssl: { rejectUnauthorized: false },
  });
  await db.connect();

  try {
    const emails = {
      system: `system-${RUN}@teamframe.example`,
      full: `full-${RUN}@teamframe.example`,
      admin: `admin-${RUN}@teamframe.example`,
      finance: `finance-${RUN}@teamframe.example`,
      manager: `manager-${RUN}@teamframe.example`,
      employee: `employee-${RUN}@teamframe.example`,
      custom: `custom-${RUN}@teamframe.example`,
      restricted: `restricted-${RUN}@teamframe.example`,
      otherTenantAdmin: `other-admin-${RUN}@teamframe.example`,
      suspendedAdmin: `suspended-${RUN}@teamframe.example`,
    };

    const [tenantA] = await maybeInsert(
      "companies",
      { name: `Runtime Tenant A ${RUN}`, slug: `runtime-a-${RUN}`, status: "active", setup_state: "active" },
      "id",
    );
    const [tenantB] = await maybeInsert(
      "companies",
      { name: `Runtime Tenant B ${RUN}`, slug: `runtime-b-${RUN}`, status: "active", setup_state: "active" },
      "id",
    );
    const [tenantSuspended] = await maybeInsert(
      "companies",
      { name: `Runtime Tenant Suspended ${RUN}`, slug: `runtime-s-${RUN}`, status: "suspended", setup_state: "suspended" },
      "id",
    );

    const employeePayloads = [
      [tenantA.id, "Full Access", emails.full, "Founder", "Leadership", null],
      [tenantA.id, "Admin", emails.admin, "Admin", "People", null],
      [tenantA.id, "Finance", emails.finance, "Finance", "Finance", null],
      [tenantA.id, "Manager", emails.manager, "Manager", "Ops", null],
      [tenantA.id, "Employee", emails.employee, "Analyst", "Ops", null],
      [tenantA.id, "Custom", emails.custom, "Coordinator", "People", null],
      [tenantA.id, "Restricted", emails.restricted, "Ops Lead", "Ops", null],
      [tenantB.id, "Other Admin", emails.otherTenantAdmin, "Admin", "Ops", null],
      [tenantSuspended.id, "Suspended Admin", emails.suspendedAdmin, "Admin", "Ops", null],
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

    const systemUserId = await createAuthUser(emails.system, { role: "platform_owner" });
    await maybeInsert("platform_owners", {
      auth_user_id: systemUserId,
      display_name: "Synthetic Platform Owner",
      email: emails.system,
      active: true,
      mfa_required: true,
    }, "auth_user_id");

    const userIds = new Map();
    for (const [key, email] of Object.entries(emails)) {
      if (key === "system") continue;
      const tenantId = key === "otherTenantAdmin" ? tenantB.id : key === "suspendedAdmin" ? tenantSuspended.id : tenantA.id;
      const role = key === "full" || key === "admin" || key === "otherTenantAdmin" || key === "suspendedAdmin" ? "admin" : "employee";
      const userId = await createAuthUser(email, { tenant_id: tenantId, role });
      userIds.set(email, userId);
      await admin.from("employees").update({ auth_user_id: userId }).eq("email", email);
    }

    const profileByEmail = new Map([
      [emails.full, "full_access"],
      [emails.admin, "admin"],
      [emails.finance, "finance"],
      [emails.manager, "employee"],
      [emails.employee, "employee"],
      [emails.custom, "employee"],
      [emails.restricted, "full_access"],
      [emails.otherTenantAdmin, "full_access"],
      [emails.suspendedAdmin, "full_access"],
    ]);
    const memberships = [];
    for (const [email, profile] of profileByEmail.entries()) {
      const employee = byEmail.get(email);
      const userId = userIds.get(email);
      const [membership] = await maybeInsert("tenant_memberships", {
        tenant_id: employee.tenant_id,
        auth_user_id: userId,
        employee_id: employee.id,
        email,
        display_name: email,
        profile,
        active: true,
      });
      memberships.push({ ...membership, email, profile, employee_id: employee.id, tenant_id: employee.tenant_id });
    }
    const membershipByEmail = new Map(memberships.map((membership) => [membership.email, membership]));

    await maybeInsert("membership_access_rules", {
      tenant_id: tenantA.id,
      membership_id: membershipByEmail.get(emails.custom).id,
      capability: "people_operations",
      effect: "allow",
      scope: "selected_people",
      employee_id: byEmail.get(emails.employee).id,
      created_by_user_id: userIds.get(emails.full),
    });
    await maybeInsert("membership_access_rules", {
      tenant_id: tenantA.id,
      membership_id: membershipByEmail.get(emails.restricted).id,
      capability: "compensation_view",
      effect: "restrict",
      scope: "whole_company",
      created_by_user_id: userIds.get(emails.full),
    });

    await maybeInsert("compensation", {
      tenant_id: tenantA.id,
      employee_id: byEmail.get(emails.employee).id,
      base_salary: 65000,
      currency: "GBP",
      grade_band: "A",
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
      employee_id: byEmail.get(emails.employee).id,
      email: `invite-${RUN}@teamframe.example`,
      display_name: "Invited Person",
      profile: "employee",
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

    const systemClient = await signIn(emails.system);
    const { data: aalBefore } = await systemClient.auth.mfa.getAuthenticatorAssuranceLevel();
    const { data: factor, error: enrollError } = await systemClient.auth.mfa.enroll({ factorType: "totp" });
    if (enrollError) fail(`Platform Owner TOTP enroll failed: ${enrollError.message}`);
    const secret = factor?.totp?.secret;
    assert(secret, "Platform Owner TOTP secret missing");
    const { data: challenge, error: challengeError } = await systemClient.auth.mfa.challenge({ factorId: factor.id });
    if (challengeError) fail(`Platform Owner TOTP challenge failed: ${challengeError.message}`);
    const { error: verifyError } = await systemClient.auth.mfa.verify({
      factorId: factor.id,
      challengeId: challenge.id,
      code: totp(secret),
    });
    if (verifyError) fail(`Platform Owner TOTP verify failed: ${verifyError.message}`);
    const { data: aalAfter } = await systemClient.auth.mfa.getAuthenticatorAssuranceLevel();
    assert(aalBefore?.currentLevel === "aal1", "Platform Owner should start at AAL1");
    assert(aalAfter?.currentLevel === "aal2", "Platform Owner should reach AAL2 after TOTP");
    const systemCompanies = await rows(systemClient, "companies", "id");
    assert(systemCompanies.some((row) => row.id === tenantA.id), "Platform Owner should see the installation company");
    pass("Platform Owner identity is deployment-level and TOTP reaches AAL2");

    const fullClient = await signIn(emails.full);
    const adminClient = await signIn(emails.admin);
    const financeClient = await signIn(emails.finance);
    const managerClient = await signIn(emails.manager);
    const employeeClient = await signIn(emails.employee);
    const customClient = await signIn(emails.custom);
    const restrictedClient = await signIn(emails.restricted);
    const otherTenantClient = await signIn(emails.otherTenantAdmin);
    const suspendedClient = await signIn(emails.suspendedAdmin);

    assert((await rows(fullClient, "employees", "id, tenant_id")).every((row) => row.tenant_id === tenantA.id), "Full Access saw another tenant");
    assert((await rows(otherTenantClient, "employees", "id, tenant_id")).every((row) => row.tenant_id === tenantB.id), "Tenant B user saw Tenant A");
    assert((await rows(suspendedClient, "employees", "id")).length === 0, "Suspended tenant user retained ordinary access");
    pass("Membership, tenant isolation and suspension boundaries hold");

    assert((await rows(adminClient, "compensation", "employee_id")).length === 0, "Admin should not see compensation");
    assert((await rows(financeClient, "compensation", "employee_id")).length === 1, "Finance should see compensation");
    assert((await rows(restrictedClient, "compensation", "employee_id")).length === 0, "Restrict rule should remove Full Access compensation view");
    assert((await rows(managerClient, "compensation", "employee_id")).length === 1, "Manager should derive direct-report salary access");
    pass("Salary boundaries hold for Admin, Finance, Full Access restrictions and Manager direct-report access");

    const managerEmployees = await rows(managerClient, "employees", "id");
    assert(managerEmployees.some((row) => row.id === byEmail.get(emails.employee).id), "Manager did not see direct report");
    assert(!managerEmployees.some((row) => row.id === byEmail.get(emails.admin).id), "Manager saw lateral employee");
    const customEmployees = await rows(customClient, "employees", "id");
    assert(customEmployees.some((row) => row.id === byEmail.get(emails.employee).id), "Custom selected-person grant did not apply");
    assert(!customEmployees.some((row) => row.id === byEmail.get(emails.admin).id), "Custom selected-person grant leaked laterally");
    pass("Own Team is direct reports only and Custom Access selected-person scope holds");

    assert((await rows(managerClient, "documents", "id")).length === 0, "Manager saw private direct-report document");
    assert((await rows(fullClient, "documents", "id")).length === 1, "Full Access should see private document");
    assert((await rows(employeeClient, "documents", "id")).length === 1, "Employee should see own document");
    const { data: signed, error: signedError } = await admin.storage.from("documents").createSignedUrl(storagePath, 60);
    if (signedError || !signed?.signedUrl) fail(`Signed URL creation failed: ${signedError?.message ?? "no url"}`);
    const fetchResult = await fetch(signed.signedUrl);
    assert(fetchResult.ok, "Signed private document retrieval failed");
    pass("Private document and signed-storage boundaries hold");

    assert((await rows(fullClient, "tenant_access_invitations", "id")).length === 1, "Full Access should see staged access invitation");
    assert((await rows(adminClient, "tenant_access_invitations", "id")).length === 0, "Restricted Admin should not manage company access settings");
    const { rows: openingRows } = await db.query(
      "select used_days from leave_opening_adjustments where tenant_id = $1 and employee_id = $2 and leave_type = 'annual'",
      [tenantA.id, byEmail.get(emails.employee).id],
    );
    assert(Number(openingRows[0]?.used_days) === 3, "Opening leave adjustment missing");
    pass("Setup import staging and opening leave balance records are tenant-safe");

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
    pass("Capability RPC reflects Full Access vs restricted Admin boundary");

    console.log("✓ Access/provisioning runtime gate completed");
  } finally {
    await db.end();
  }
}

main().catch((error) => {
  console.error(`✗ ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
