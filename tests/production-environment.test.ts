import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const base = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "public-test-value",
  SUPABASE_SERVICE_ROLE_KEY: "server-test-value",
  SITE_URL: "https://teamframe.example.org",
  DEEP_HEALTH_SECRET: "health-test-value",
  TEAMFRAME_AUTOMATION_SECRET: "automation-test-value",
  CRON_SECRET: "automation-test-value",
  RESEND_API_KEY: "provider-test-value",
  TEAMFRAME_EMAIL_FROM: "TeamFrame <teamframe@example.org>",
  SENTRY_DSN: "",
  NEXT_PUBLIC_SENTRY_DSN: "",
};

function run(overrides: Record<string, string> = {}) {
  return spawnSync(process.execPath, ["scripts/validate-env.mjs", "production"], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: { ...base, ...overrides },
  });
}

describe("production environment preflight", () => {
  it("passes a complete production-shaped environment without printing values", () => {
    const result = run();
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Environment validation passed for mode 'production'");
    expect(result.stdout).not.toContain("server-test-value");
    expect(result.stdout).not.toContain("provider-test-value");
  });

  it("rejects synthetic projects, mismatched cron secrets and reserved senders", () => {
    const result = run({
      NEXT_PUBLIC_SUPABASE_URL: "https://dcfxyjrfsrkibhpbmjnw.supabase.co",
      CRON_SECRET: "different",
      TEAMFRAME_EMAIL_FROM: "TeamFrame <demo@teamframe.invalid>",
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("must not use an approved synthetic launch/review project");
    expect(result.stderr).toContain("CRON_SECRET must match TEAMFRAME_AUTOMATION_SECRET");
    expect(result.stderr).toContain("must not use a reserved test domain");
  });
});
