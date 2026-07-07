/**
 * TeamFrame — bootstrap an admin (one command, no dashboard steps).
 *
 * Idempotent. For a given email, this script will:
 *   1. Ensure the tenant (companies row) exists — slug inferred from the email domain.
 *   2. Ensure the Supabase auth user exists with a PASSWORD (created directly via
 *      the admin API — no invite email is sent, so non-deliverable domains are fine).
 *   3. Stamp `app_metadata.role = 'admin'` AND `app_metadata.tenant_id` on the auth
 *      user (both are required: RLS and the middleware read tenant context from the
 *      JWT only — see schemas/tenancy_rls_v2.sql and middleware/rbac.ts).
 *   4. Ensure a matching row exists in `employees` (creates a minimal one if not).
 *   5. Verify the result: signs in with the anon key + password, asserts the admin
 *      claims, signs out. If this step fails the script exits non-zero.
 *
 * The password is read from the SEED_ADMIN_PASSWORD environment variable and is
 * NEVER printed. Re-running the script resets the password to the current value
 * of SEED_ADMIN_PASSWORD.
 *
 * Usage:
 *   SEED_ADMIN_PASSWORD='<password>' npm run seed:admin -- admin@yourcompany.com
 *   SEED_ADMIN_PASSWORD='<password>' npm run seed:admin -- admin@yourcompany.com "Full Name" "Founder" "Leadership" "UTC"
 *
 * (On Windows PowerShell: $env:SEED_ADMIN_PASSWORD='<password>'; npm run seed:admin -- admin@yourcompany.com)
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
dotenv.config({ path: join(repoRoot, ".env.local"), quiet: true });

const [, , emailArg, nameArg, titleArg, deptArg, tzArg] = process.argv;

if (!emailArg) {
  console.error("Usage: SEED_ADMIN_PASSWORD='<password>' npm run seed:admin -- admin@yourcompany.com [name] [title] [department] [timezone]");
  process.exit(1);
}

const email = emailArg.trim().toLowerCase();
const fullName = (nameArg ?? "Admin").trim();
const roleTitle = (titleArg ?? "Founder").trim();
const department = (deptArg ?? "Leadership").trim();
const timezone = (tzArg ?? "UTC").trim();
const inferredCompanyName = email.split("@")[1]?.split(".")[0] ?? "Default Company";

function toSlug(input) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !serviceKey) {
  console.error("✗ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local.");
  process.exit(1);
}

const password = process.env.SEED_ADMIN_PASSWORD;
if (!password) {
  console.error(
    "✗ SEED_ADMIN_PASSWORD is not set.\n" +
      "  Provide the admin password via the environment (it is never printed):\n" +
      "    bash:       SEED_ADMIN_PASSWORD='<password>' npm run seed:admin -- " + email + "\n" +
      "    PowerShell: $env:SEED_ADMIN_PASSWORD='<password>'; npm run seed:admin -- " + email,
  );
  process.exit(1);
}
if (password.length < 8) {
  console.error("✗ SEED_ADMIN_PASSWORD must be at least 8 characters.");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function findAuthUserByEmail(targetEmail) {
  // listUsers paginates. For a fresh bootstrap project, page 1 is enough.
  let page = 1;
  const perPage = 200;
  // Limit defensively to avoid runaway pagination on a misconfigured project.
  while (page <= 25) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const hit = data.users.find((u) => (u.email ?? "").toLowerCase() === targetEmail);
    if (hit) return hit;
    if (data.users.length < perPage) return null;
    page += 1;
  }
  return null;
}

console.log(`• Bootstrapping admin: ${email}\n`);

// ---------------------------------------------------------------------------
// 1. Ensure the tenant (companies row) exists — we need its id for the JWT
//    app_metadata.tenant_id claim before touching the auth user.
// ---------------------------------------------------------------------------
const companySlug = toSlug(inferredCompanyName) || "default-company";
const companyName = inferredCompanyName.charAt(0).toUpperCase() + inferredCompanyName.slice(1);

console.log(`• Ensuring company exists (slug: ${companySlug})…`);
const { data: existingCompany, error: companySelErr } = await supabase
  .from("companies")
  .select("id")
  .eq("slug", companySlug)
  .maybeSingle();

if (companySelErr) {
  console.error("✗ companies lookup failed:", companySelErr.message);
  process.exit(1);
}

let tenantId = existingCompany?.id;
let companyWasCreated = false;
if (!tenantId) {
  const { data: insertedCompany, error: companyInsErr } = await supabase
    .from("companies")
    .insert({ name: companyName, slug: companySlug })
    .select("id")
    .single();
  if (companyInsErr) {
    console.error("✗ Failed to create company row:", companyInsErr.message);
    process.exit(1);
  }
  tenantId = insertedCompany.id;
  companyWasCreated = true;
  console.log(`✓ company created. Id: ${tenantId}`);
} else {
  console.log(`✓ company already exists. Id: ${tenantId}`);
}

// ---------------------------------------------------------------------------
// 2. Ensure the auth user exists with password + admin role + tenant claim.
//    createUser (not inviteUserByEmail): no email is sent, so this works with
//    non-deliverable domains and projects without SMTP configured.
// ---------------------------------------------------------------------------
let user = await findAuthUserByEmail(email);

if (!user) {
  console.log("• No auth user found — creating (email confirmed, password set, admin claims stamped)…");
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role: "admin", tenant_id: tenantId },
  });
  if (error) {
    console.error("✗ createUser failed:", error.message);
    process.exit(1);
  }
  user = data.user;
  console.log(`✓ Auth user created. Id: ${user.id}`);
} else {
  console.log(`✓ Auth user already exists (Id: ${user.id}) — resetting password and re-stamping claims…`);
  const { error } = await supabase.auth.admin.updateUserById(user.id, {
    password,
    email_confirm: true,
    app_metadata: { ...(user.app_metadata ?? {}), role: "admin", tenant_id: tenantId },
  });
  if (error) {
    console.error("✗ Failed to update auth user:", error.message);
    process.exit(1);
  }
  console.log("✓ Password reset, role + tenant_id stamped, email confirmed.");
}

if (companyWasCreated) {
  const { error: trackErr } = await supabase.from("analytics_events").insert({
    tenant_id: tenantId,
    user_id: user.id,
    event_name: "company_created",
    event_properties: { slug: companySlug, name: companyName },
  });
  if (trackErr && trackErr.code !== "23505") {
    console.warn(`[track] company_created insert failed: ${trackErr.message}`);
  }
}

// ---------------------------------------------------------------------------
// 3. Ensure the employees row exists and is linked to the auth user.
// ---------------------------------------------------------------------------
console.log("• Ensuring employees row exists…");
{
  const { data: existing, error: selErr } = await supabase
    .from("employees")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (selErr) {
    console.error("✗ employees lookup failed:", selErr.message);
    process.exit(1);
  }

  if (existing) {
    const { error: updErr } = await supabase
      .from("employees")
      .update({ tenant_id: tenantId, auth_user_id: user.id })
      .eq("id", existing.id);
    if (updErr) {
      console.error("✗ employees update failed:", updErr.message);
      process.exit(1);
    }
    console.log(`✓ employees row already exists. Id: ${existing.id}`);
  } else {
    const { data: inserted, error: insErr } = await supabase
      .from("employees")
      .insert({
        tenant_id: tenantId,
        auth_user_id: user.id,
        full_name: fullName,
        email,
        role_title: roleTitle,
        department,
        timezone,
        status: "active",
        setup_status: "active",
      })
      .select("id")
      .single();
    if (insErr) {
      console.error("✗ Failed to create employees row:", insErr.message);
      process.exit(1);
    }
    console.log(`✓ employees row created. Id: ${inserted.id}`);
  }
}

// ---------------------------------------------------------------------------
// 4. Verify: sign in with email + password using the anon key (same path the
//    /admin/login page uses), assert the admin claims, sign out.
// ---------------------------------------------------------------------------
if (!anonKey) {
  console.warn(
    "\n⚠ NEXT_PUBLIC_SUPABASE_ANON_KEY is not set — skipping the login self-check.\n" +
      "  Set it in .env.local (it is required to run the app) and re-run to verify.",
  );
} else {
  console.log("• Verifying password login (anon-key signInWithPassword)…");
  const anonClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: signIn, error: signInErr } = await anonClient.auth.signInWithPassword({ email, password });
  if (signInErr || !signIn?.session?.user) {
    console.error(
      "✗ Login verification FAILED:",
      signInErr?.message ?? "no session returned",
      "\n  The auth user exists, but password sign-in did not work. Check the",
      "\n  Supabase auth configuration (email provider enabled) — see START_HERE.md step 6.",
    );
    process.exit(1);
  }
  const meta = signIn.session.user.app_metadata ?? {};
  if (meta.role !== "admin" || meta.tenant_id !== tenantId) {
    console.error(
      `✗ Login verification FAILED: JWT claims wrong (role=${String(meta.role)}, tenant_id ${meta.tenant_id === tenantId ? "ok" : "missing/mismatched"}).`,
    );
    process.exit(1);
  }
  await anonClient.auth.signOut();
  console.log("✓ Login verified: session issued, app_metadata.role=admin, app_metadata.tenant_id stamped.");
}

// ---------------------------------------------------------------------------
// 5. Success summary (the password is never printed).
// ---------------------------------------------------------------------------
const SITE_URL = process.env.SITE_URL ?? "http://localhost:3030";
console.log("\n✓ Admin bootstrap complete.");
console.log("\n  Summary");
console.log(`  - Admin email:   ${email}`);
console.log(`  - Auth user id:  ${user.id}`);
console.log(`  - Tenant id:     ${tenantId} (slug: ${companySlug})`);
console.log(`  - Password:      set from SEED_ADMIN_PASSWORD (not shown)`);
console.log("\n  Next steps");
console.log("  1. npm run dev");
console.log(`  2. Open ${SITE_URL}/admin/login`);
console.log("  3. Sign in with the email above and your SEED_ADMIN_PASSWORD value → you land on /dashboard.");
console.log("\n  Re-running this command is safe: it re-stamps the claims and resets the password.");
