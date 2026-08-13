/**
 * Focused disposable runtime proof for the customer-readiness workstream.
 *
 * Requires the same AUDIT_* disposable variables as verify-integration.mjs.
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
];

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

function pass(message) {
  console.log(`✓ ${message}`);
}

for (const name of REQUIRED) {
  if (!process.env[name]?.trim()) fail(`Missing ${name}`);
}
if (process.env.TEAMFRAME_AUDIT_INTEGRATION !== "authorised-disposable") {
  fail("TEAMFRAME_AUDIT_INTEGRATION must be authorised-disposable");
}

const service = createClient(process.env.AUDIT_SUPABASE_URL, process.env.AUDIT_SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const anon = createClient(process.env.AUDIT_SUPABASE_URL, process.env.AUDIT_SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const pgClient = new pg.Client({ connectionString: process.env.AUDIT_SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });

async function insert(table, payload) {
  const { data, error } = await service.from(table).insert(payload).select("*").single();
  if (error) fail(`${table} insert failed: ${error.message}`);
  return data;
}

async function main() {
  console.log(`TeamFrame customer-readiness runtime gate: ${process.env.AUDIT_SUPABASE_PROJECT_REF}`);
  await pgClient.connect();

  const tenant = await insert("companies", {
    name: "Runtime Customer Co",
    slug: `runtime-customer-${Date.now()}`,
    country: "United Kingdom",
    location: "London",
    default_timezone: "Europe/London",
    default_working_days: [2, 3, 4, 5, 6],
    annual_leave_default_days: 20,
    sick_leave_default_days: 10,
    employee_number_prefix: "RC",
    employee_number_separator: "-",
    employee_number_digits: 4,
    employee_number_next: 2,
    status: "active",
    setup_state: "active",
  });

  await service.from("company_holidays").insert({
    tenant_id: tenant.id,
    holiday_date: "2026-09-10",
    name: "Company closure day",
  });

  const manager = await insert("employees", {
    tenant_id: tenant.id,
    full_name: "Morgan Manager",
    email: `morgan-${Date.now()}@runtime.example`,
    role_title: "Head of Ops",
    department: "Operations",
    timezone: "Europe/London",
    employment_type: "full_time",
    country: "United Kingdom",
    start_date: "2026-01-01",
    status: "active",
    setup_status: "active",
    lifecycle_state: "active",
    employee_number: "RC-0001",
  });

  const employee = await insert("employees", {
    tenant_id: tenant.id,
    full_name: "Taylor Employee",
    preferred_name: "Taylor",
    email: `taylor-${Date.now()}@runtime.example`,
    personal_email: "taylor.personal@runtime.example",
    mobile: "+441234567890",
    residential_address: "10 Runtime Road",
    date_of_birth: "1990-01-01",
    nationality: "British",
    work_location: "Manchester",
    role_title: "Operations Lead",
    department: "Operations",
    timezone: "Europe/London",
    manager_id: manager.id,
    employment_type: "full_time",
    country: "United Kingdom",
    start_date: "2026-01-01",
    status: "active",
    setup_status: "active",
    lifecycle_state: "active",
    employee_number: "RC-0002",
    working_days_override: [1, 2, 3, 4, 5, 7],
    annual_leave_entitlement_override: 25,
    emergency_contact_name: "Casey Contact",
    emergency_contact_relationship: "Partner",
    emergency_contact_phone: "+449999999999",
    emergency_contact_email: "casey@runtime.example",
  });

  await service.from("compensation").insert({
    tenant_id: tenant.id,
    employee_id: employee.id,
    base_salary: 72000,
    currency: "GBP",
    pay_basis: "monthly",
  });
  await service.from("employee_payment_details").insert({
    tenant_id: tenant.id,
    employee_id: employee.id,
    account_holder_name: "Taylor Employee",
    bank_name: "Runtime Bank",
    account_number_iban: "GB00RUNTIME00000000000000",
    account_currency: "GBP",
  });
  await service.from("leave_opening_adjustments").insert({
    tenant_id: tenant.id,
    employee_id: employee.id,
    period_year: 2026,
    leave_type: "annual",
    used_days: 3,
    note: "Runtime opening balance",
    created_by_user_id: "00000000-0000-0000-0000-000000000000",
  });

  const calc = await pgClient.query("select teamframe_calculate_leave_days($1::uuid, $2::uuid, $3::date, $4::date) as days", [
    tenant.id,
    employee.id,
    "2026-09-07",
    "2026-09-13",
  ]);
  if (Number(calc.rows[0].days) !== 5) fail(`Expected employee working days minus holiday to charge 5 days, got ${calc.rows[0].days}`);
  pass("Employee working-day override and company holiday exclusion drive leave-day calculation");

  const balance = await pgClient.query(
    `select coalesce(e.annual_leave_entitlement_override, c.annual_leave_default_days::numeric, 0) - coalesce(sum(loa.used_days), 0) as available
     from employees e
     join companies c on c.id = e.tenant_id
     left join leave_opening_adjustments loa on loa.tenant_id = e.tenant_id and loa.employee_id = e.id and loa.period_year = 2026 and loa.leave_type = 'annual'
     where e.tenant_id = $1 and e.id = $2
     group by e.annual_leave_entitlement_override, c.annual_leave_default_days`,
    [tenant.id, employee.id],
  );
  if (Number(balance.rows[0].available) !== 22) fail(`Expected entitlement override 25 minus opening 3 = 22, got ${balance.rows[0].available}`);
  pass("Employee annual entitlement override and opening leave adjustment affect availability once");

  const invitation = await insert("tenant_access_invitations", {
    tenant_id: tenant.id,
    employee_id: employee.id,
    email: employee.email,
    display_name: employee.full_name,
    profile: "admin",
    active: true,
    invited_by_user_id: "00000000-0000-0000-0000-000000000000",
  });
  await service.from("tenant_access_invitation_rules").insert({
    tenant_id: tenant.id,
    invitation_id: invitation.id,
    capability: "compensation_view",
    effect: "restrict",
    scope: "selected_people",
    employee_id: employee.id,
    created_by_user_id: "00000000-0000-0000-0000-000000000000",
  });
  const stagedRules = await service
    .from("tenant_access_invitation_rules")
    .select("id")
    .eq("tenant_id", tenant.id)
    .eq("invitation_id", invitation.id);
  if (stagedRules.error || stagedRules.data.length !== 1) fail("Expected one staged invitation access rule");
  pass("Setup-pack style access exception can be staged before auth user acceptance");

  const anonymous = await anon.from("employee_payment_details").select("employee_id").eq("tenant_id", tenant.id);
  if (!anonymous.error && anonymous.data.length > 0) fail("Anonymous user could read payment details");
  pass("Payment details are not anonymously readable");

  await pgClient.end();
  pass("Customer-readiness runtime gate completed");
}

main().catch(async (error) => {
  try { await pgClient.end(); } catch {}
  fail(error instanceof Error ? error.message : String(error));
});
