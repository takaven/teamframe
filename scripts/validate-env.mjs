import fs from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { APPROVED_LAUNCH_PROJECT_REFS } from "./approved-launch-projects.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, "..", ".env.local");

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const mode = process.argv[2] ?? "build";

const REQUIRED_BY_MODE = {
  build: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SITE_URL"],
  smoke: ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"],
  db: ["SUPABASE_DB_URL"],
  production: [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SITE_URL",
    "DEEP_HEALTH_SECRET",
    "TEAMFRAME_AUTOMATION_SECRET",
    "CRON_SECRET",
    "RESEND_API_KEY",
    "TEAMFRAME_EMAIL_FROM",
  ],
};

if (!(mode in REQUIRED_BY_MODE)) {
  console.error(`✗ Unknown env validation mode: ${mode}`);
  console.error(`  Supported modes: ${Object.keys(REQUIRED_BY_MODE).join(", ")}`);
  process.exit(1);
}

const requiredVars = REQUIRED_BY_MODE[mode];
const missing = requiredVars.filter((name) => {
  const value = process.env[name];
  return !value || value.trim().length === 0;
});

if (missing.length > 0) {
  console.error(`✗ Missing required environment variables for mode '${mode}':`);
  for (const name of missing) {
    console.error(`  - ${name}`);
  }
  process.exit(1);
}

if (mode === "production") {
  const failures = [];
  let siteUrl;
  let supabaseUrl;
  try { siteUrl = new URL(process.env.SITE_URL); } catch { failures.push("SITE_URL must be a valid URL"); }
  try { supabaseUrl = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL); } catch { failures.push("NEXT_PUBLIC_SUPABASE_URL must be a valid URL"); }
  if (siteUrl?.protocol !== "https:") failures.push("SITE_URL must use HTTPS");
  const projectRef = supabaseUrl?.hostname.match(/^([a-z0-9]+)\.supabase\.co$/)?.[1];
  if (!projectRef) failures.push("NEXT_PUBLIC_SUPABASE_URL must identify a Supabase project");
  else if (APPROVED_LAUNCH_PROJECT_REFS.has(projectRef)) failures.push("Production must not use an approved synthetic launch/review project");
  if (process.env.CRON_SECRET !== process.env.TEAMFRAME_AUTOMATION_SECRET) {
    failures.push("CRON_SECRET must match TEAMFRAME_AUTOMATION_SECRET for the Vercel Cron bearer check");
  }
  if (/\.(?:invalid|example|test)(?:[>\s]|$)/i.test(process.env.TEAMFRAME_EMAIL_FROM)) {
    failures.push("TEAMFRAME_EMAIL_FROM must not use a reserved test domain");
  }
  if (Boolean(process.env.SENTRY_DSN) !== Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN)) {
    failures.push("SENTRY_DSN and NEXT_PUBLIC_SENTRY_DSN must be configured together");
  }
  if (failures.length > 0) {
    console.error("✗ Production environment validation failed:");
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exit(1);
  }
}

let sanitizedSiteUrl = "(not required for this mode)";
if (process.env.SITE_URL) {
  try {
    sanitizedSiteUrl = new URL(process.env.SITE_URL).origin;
  } catch {
    sanitizedSiteUrl = "invalid SITE_URL format";
  }
}

console.log(`✓ Environment validation passed for mode '${mode}'`);
console.log(`  Required vars present: ${requiredVars.join(", ")}`);
console.log(`  SITE_URL: ${sanitizedSiteUrl}`);
console.log(`  Has service role key: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? "yes" : "no"}`);
console.log(`  Has DB URL: ${process.env.SUPABASE_DB_URL ? "yes" : "no"}`);
if (mode === "production") {
  console.log(`  Has paired Sentry DSNs: ${process.env.SENTRY_DSN && process.env.NEXT_PUBLIC_SENTRY_DSN ? "yes" : "no (explicit operational decision required)"}`);
}
