import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("customer implementation operator gate", () => {
  const run = (args: string[], overrides: Record<string, string> = {}) => spawnSync(
    process.execPath,
    ["scripts/customer-implementation.mjs", ...args],
    { cwd: process.cwd(), encoding: "utf8", env: {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL: "",
      SUPABASE_SERVICE_ROLE_KEY: "",
      TEAMFRAME_IMPLEMENTATION_PROJECT_REF: "",
      TEAMFRAME_IMPLEMENTATION_DB_URL: "",
      TEAMFRAME_IMPLEMENTATION_APPROVAL: "",
      TEAMFRAME_IMPLEMENTATION_CONTEXT: "",
      ...overrides,
    } },
  );

  it("refuses missing mode and target identity", () => {
    const result = run([]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Customer implementation refused");
  });

  it("refuses an unapproved target", () => {
    const ref = "qrsxoumymbcehtltbtgn";
    const tenant = "11111111-1111-4111-8111-111111111111";
    const result = run(["--preflight", "--pack", "package.json", "--tenant-id", tenant, "--confirm-workspace", "synthetic"], {
      TEAMFRAME_IMPLEMENTATION_PROJECT_REF: ref,
      NEXT_PUBLIC_SUPABASE_URL: `https://${ref}.supabase.co`,
      SUPABASE_SERVICE_ROLE_KEY: "test-only",
      TEAMFRAME_IMPLEMENTATION_DB_URL: `postgresql://postgres:password@db.${ref}.supabase.co:5432/postgres`,
      TEAMFRAME_IMPLEMENTATION_APPROVAL: `preflight:${ref}:${tenant}`,
      TEAMFRAME_IMPLEMENTATION_CONTEXT: "synthetic-customer-rehearsal",
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Customer implementation refused");
  });

  it("refuses a mismatched API URL", () => {
    const ref = "dcfxyjrfsrkibhpbmjnw";
    const tenant = "11111111-1111-4111-8111-111111111111";
    const result = run(["--execute", "--pack", "package.json", "--tenant-id", tenant, "--confirm-workspace", "synthetic"], {
      TEAMFRAME_IMPLEMENTATION_PROJECT_REF: ref,
      NEXT_PUBLIC_SUPABASE_URL: "https://example.invalid",
      SUPABASE_SERVICE_ROLE_KEY: "test-only",
      TEAMFRAME_IMPLEMENTATION_DB_URL: `postgresql://postgres:password@db.${ref}.supabase.co:5432/postgres`,
      TEAMFRAME_IMPLEMENTATION_APPROVAL: `execute:${ref}:${tenant}`,
      TEAMFRAME_IMPLEMENTATION_CONTEXT: "synthetic-customer-rehearsal",
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Customer implementation refused");
  });
});
