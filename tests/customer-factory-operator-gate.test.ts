import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("disposable customer-factory operator gate", () => {
  const run = (overrides: Record<string, string>) => spawnSync(
    process.execPath,
    ["scripts/measure-customer-factory-disposable.mjs"],
    { cwd: process.cwd(), encoding: "utf8", env: {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL: "",
      SUPABASE_SERVICE_ROLE_KEY: "",
      TEAMFRAME_FACTORY_PROJECT_REF: "",
      TEAMFRAME_FACTORY_APPROVAL: "",
      ...overrides,
    } },
  );

  it("refuses missing credentials and approval", () => {
    const result = run({});
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Factory measurement refused");
  });

  it("refuses an unapproved project even with a matching URL and approval token", () => {
    const ref = "qrsxoumymbcehtltbtgn";
    const result = run({
      TEAMFRAME_FACTORY_PROJECT_REF: ref,
      NEXT_PUBLIC_SUPABASE_URL: `https://${ref}.supabase.co`,
      SUPABASE_SERVICE_ROLE_KEY: "test-only-not-real",
      TEAMFRAME_FACTORY_APPROVAL: `measure:${ref}`,
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Factory measurement refused");
  });

  it("refuses a mismatched URL for an approved disposable ref", () => {
    const result = run({
      TEAMFRAME_FACTORY_PROJECT_REF: "nvuijkgiqqhqeqduqqgm",
      NEXT_PUBLIC_SUPABASE_URL: "https://example.invalid",
      SUPABASE_SERVICE_ROLE_KEY: "test-only-not-real",
      TEAMFRAME_FACTORY_APPROVAL: "measure:nvuijkgiqqhqeqduqqgm",
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Factory measurement refused");
  });
});
