import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createOnlyRefusal } from "../scripts/lib/create-only-bootstrap.mjs";

const script = "scripts/bootstrap-factory-disposable.mjs";
const ref = "nvuijkgiqqhqeqduqqgm";
const base = {
  TEAMFRAME_FACTORY_PROJECT_REF: ref,
  NEXT_PUBLIC_SUPABASE_URL: `https://${ref}.supabase.co`,
  TEAMFRAME_FACTORY_DB_URL: `postgresql://postgres.${ref}:dummy@aws-0-ap-south-1.pooler.supabase.com:5432/postgres`,
  TEAMFRAME_FACTORY_BOOTSTRAP_APPROVAL: `bootstrap:${ref}`,
  SUPABASE_SERVICE_ROLE_KEY: "dummy-key",
  FULL_ACCESS_PASSWORD: "synthetic-dummy-password",
};

function run(overrides: Record<string, string | undefined>) {
  const env = { ...process.env, ...base, ...overrides } as NodeJS.ProcessEnv;
  for (const [key, value] of Object.entries(env)) if (value === undefined) delete env[key];
  return spawnSync(process.execPath, [script, "--check-target"], { env, encoding: "utf8" });
}

describe("synthetic factory bootstrap target guard", () => {
  it("refuses adoption of existing company or auth user only in create-only mode", () => {
    expect(createOnlyRefusal(true, true, false)).toContain("existing company");
    expect(createOnlyRefusal(true, false, true)).toContain("existing auth user");
    expect(createOnlyRefusal(false, true, true)).toBeNull();
    expect(createOnlyRefusal(true, false, false)).toBeNull();
  });
  it("skips dotenv file loading in create-only mode", () => {
    const source = readFileSync("scripts/bootstrap-full-access.mjs", "utf8");
    expect(source).toMatch(/if \(process\.env\.TEAMFRAME_CREATE_ONLY_BOOTSTRAP !== "1"\) \{\s*dotenv\.config\(/);
  });
  it("accepts exact approved identity only in check mode", () => {
    const result = run({});
    expect(result.status).toBe(0);
    expect(result.stdout).toContain(`Verified disposable factory bootstrap target: ${ref}`);
  });
  it("refuses a non-allowlisted project", () => {
    expect(run({ TEAMFRAME_FACTORY_PROJECT_REF: "qrsxoumymbcehtltbtgn" }).status).not.toBe(0);
  });
  it("refuses mismatched API and database identities", () => {
    expect(run({ NEXT_PUBLIC_SUPABASE_URL: "https://syytforaidoorrvrbqwz.supabase.co" }).status).not.toBe(0);
    expect(run({ TEAMFRAME_FACTORY_DB_URL: "postgresql://postgres.syytforaidoorrvrbqwz:dummy@aws-0-ap-south-1.pooler.supabase.com:5432/postgres" }).status).not.toBe(0);
  });
  it("refuses missing approval, credentials and TLS URL override", () => {
    expect(run({ TEAMFRAME_FACTORY_BOOTSTRAP_APPROVAL: undefined }).status).not.toBe(0);
    expect(run({ SUPABASE_SERVICE_ROLE_KEY: undefined }).status).not.toBe(0);
    expect(run({ TEAMFRAME_FACTORY_DB_URL: `${base.TEAMFRAME_FACTORY_DB_URL}?sslmode=no-verify` }).status).not.toBe(0);
  });
});
