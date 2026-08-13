/**
 * TeamFrame — create or recover a local Full Access user.
 *
 * This is an infrastructure-side recovery utility for an independent customer
 * installation. It requires direct Supabase service-role authority for that
 * installation and never grants cross-customer access.
 *
 * Required env:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   FULL_ACCESS_EMAIL
 *   FULL_ACCESS_PASSWORD
 *
 * Optional env:
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY       enables password-login self-check
 *   FULL_ACCESS_NAME                    display name
 *   TEAMFRAME_TENANT_ID                 target company id
 *   TEAMFRAME_TENANT_SLUG               target company slug
 *   TEAMFRAME_TENANT_NAME               create/find fallback company name
 *   TEAMFRAME_ENV_FILE                  env file to load instead of .env.local
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
dotenv.config({ path: process.env.TEAMFRAME_ENV_FILE || join(repoRoot, ".env.local"), quiet: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const email = process.env.FULL_ACCESS_EMAIL?.trim().toLowerCase();
const password = process.env.FULL_ACCESS_PASSWORD;
const displayName = process.env.FULL_ACCESS_NAME?.trim() || email;

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

function toSlug(input) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

if (!url || !serviceKey) fail("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
if (!email) fail("Missing FULL_ACCESS_EMAIL.");
if (!password || password.length < 8) fail("FULL_ACCESS_PASSWORD must be at least 8 characters.");

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function findAuthUserByEmail(targetEmail) {
  for (let page = 1; page <= 25; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((user) => (user.email ?? "").toLowerCase() === targetEmail);
    if (hit) return hit;
    if (data.users.length < 200) return null;
  }
  return null;
}

async function resolveCompany() {
  if (process.env.TEAMFRAME_TENANT_ID) {
    const { data, error } = await supabase
      .from("companies")
      .select("id, name")
      .eq("id", process.env.TEAMFRAME_TENANT_ID)
      .maybeSingle();
    if (error) fail(`Company lookup failed: ${error.message}`);
    if (!data) fail("TEAMFRAME_TENANT_ID did not match a company.");
    return data;
  }

  const slug = process.env.TEAMFRAME_TENANT_SLUG?.trim();
  if (slug) {
    const { data, error } = await supabase.from("companies").select("id, name").eq("slug", slug).maybeSingle();
    if (error) fail(`Company lookup failed: ${error.message}`);
    if (data) return data;
  }

  const { data: companies, error } = await supabase.from("companies").select("id, name, slug").limit(2);
  if (error) fail(`Company lookup failed: ${error.message}`);
  if ((companies ?? []).length === 1) return companies[0];
  if ((companies ?? []).length > 1) fail("Multiple companies found. Set TEAMFRAME_TENANT_ID or TEAMFRAME_TENANT_SLUG.");

  const name = process.env.TEAMFRAME_TENANT_NAME?.trim();
  if (!name) fail("No company exists. Set TEAMFRAME_TENANT_NAME to create the initial company.");
  const { data: created, error: createError } = await supabase
    .from("companies")
    .insert({ name, slug: slug || toSlug(name) || `company-${Date.now()}` })
    .select("id, name")
    .single();
  if (createError || !created) fail(`Company create failed: ${createError?.message ?? "no row"}`);
  return created;
}

const company = await resolveCompany();
let user = await findAuthUserByEmail(email);
if (!user) {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role: "admin", tenant_id: company.id },
  });
  if (error || !data?.user) fail(`Auth user create failed: ${error?.message ?? "no user"}`);
  user = data.user;
} else {
  const { error } = await supabase.auth.admin.updateUserById(user.id, {
    password,
    email_confirm: true,
    app_metadata: { ...(user.app_metadata ?? {}), role: "admin", tenant_id: company.id },
  });
  if (error) fail(`Auth user update failed: ${error.message}`);
}

const { error: membershipError } = await supabase.from("tenant_memberships").upsert(
  {
    tenant_id: company.id,
    auth_user_id: user.id,
    employee_id: null,
    email,
    display_name: displayName,
    profile: "full_access",
    people_access_scope: "all",
    people_selected_employee_ids: [],
    salary_access_level: "manage",
    salary_access_scope: "all",
    salary_selected_employee_ids: [],
    private_documents_scope: "all",
    private_documents_selected_employee_ids: [],
    finance_exports_access: true,
    manage_users_access: true,
    active: true,
    removed_at: null,
  },
  { onConflict: "tenant_id,auth_user_id" },
);
if (membershipError) fail(`Full Access membership upsert failed: ${membershipError.message}`);

if (anonKey) {
  const anon = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await anon.auth.signInWithPassword({ email, password });
  if (error || !data?.session) fail(`Login self-check failed: ${error?.message ?? "no session"}`);
  await anon.auth.signOut();
}

console.log("✓ Full Access recovery complete.");
console.log(`  Company: ${company.name} (${company.id})`);
console.log(`  User: ${email}`);
console.log("  Access: Full Access");
