/**
 * TeamFrame — provision a Platform Owner identity.
 *
 * This is deliberately separate from seed-admin. Platform Owner is not a
 * tenant user and must not create an employee row or company membership.
 *
 * Usage:
 *   PLATFORM_OWNER_EMAIL='owner@example.com' PLATFORM_OWNER_NAME='Name' PLATFORM_OWNER_PASSWORD='...' node scripts/provision-platform-owner.mjs
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
dotenv.config({ path: join(repoRoot, ".env.local"), quiet: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.PLATFORM_OWNER_EMAIL?.trim().toLowerCase();
const displayName = process.env.PLATFORM_OWNER_NAME?.trim();
const password = process.env.PLATFORM_OWNER_PASSWORD;

if (!url || !serviceKey) {
  console.error("Missing Supabase URL or service-role key.");
  process.exit(1);
}
if (!email || !displayName || !password) {
  console.error("Platform Owner identity is incomplete. Supply email, name and password through environment variables.");
  process.exit(2);
}
if (password.length < 12) {
  console.error("Platform Owner password must be at least 12 characters.");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function findAuthUserByEmail(targetEmail) {
  let page = 1;
  const perPage = 200;
  while (page <= 25) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const hit = data.users.find((user) => (user.email ?? "").toLowerCase() === targetEmail);
    if (hit) return hit;
    if (data.users.length < perPage) return null;
    page += 1;
  }
  return null;
}

let user = await findAuthUserByEmail(email);
if (!user) {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role: "platform_owner" },
  });
  if (error || !data.user) {
    console.error("Platform Owner auth user creation failed:", error?.message ?? "no user returned");
    process.exit(1);
  }
  user = data.user;
} else {
  const { data, error } = await supabase.auth.admin.updateUserById(user.id, {
    password,
    email_confirm: true,
    app_metadata: { ...(user.app_metadata ?? {}), role: "platform_owner" },
  });
  if (error || !data.user) {
    console.error("Platform Owner auth user update failed:", error?.message ?? "no user returned");
    process.exit(1);
  }
  user = data.user;
}

const { error: ownerError } = await supabase.from("platform_owners").upsert(
  {
    auth_user_id: user.id,
    email,
    display_name: displayName,
    active: true,
    mfa_required: true,
    revoked_at: null,
  },
  { onConflict: "auth_user_id" },
);
if (ownerError) {
  console.error("Platform Owner database upsert failed:", ownerError.message);
  process.exit(1);
}

console.log("Platform Owner provisioning completed. TOTP enrollment and AAL2 verification are still required before activation.");
console.log(`Auth user id: ${user.id}`);
