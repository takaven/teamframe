import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ref = "syytforaidoorrvrbqwz";
const root = process.cwd();

function run(script: string, extra: Record<string, string> = {}, args: string[] = []) {
  return spawnSync(process.execPath, [join(root, "scripts", script), ...args], {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      TEAMFRAME_INSTALL_PROJECT_REF: ref,
      TEAMFRAME_INSTALL_SUPABASE_URL: `https://${ref}.supabase.co`,
      TEAMFRAME_INSTALL_DB_URL: `postgresql://postgres.${ref}:test-only@aws-0-ap-south-1.pooler.supabase.com:5432/postgres`,
      TEAMFRAME_INSTALL_SERVICE_ROLE_KEY: "test-only",
      TEAMFRAME_INSTALL_APPROVAL: `fresh:${ref}`,
      TEAMFRAME_AUDIT_INTEGRATION: "authorised-disposable",
      AUDIT_SUPABASE_PROJECT_REF: ref,
      AUDIT_SUPABASE_URL: `https://${ref}.supabase.co`,
      AUDIT_SUPABASE_ANON_KEY: "test-only",
      AUDIT_SUPABASE_SERVICE_ROLE_KEY: "test-only",
      ALLOW_DESTRUCTIVE_RESET: "true",
      ...extra,
    },
  });
}

describe("repository execution safety", () => {
  it("retires direct legacy destructive, setup and replay entry points", () => {
    for (const script of ["reset-and-apply.mjs", "reset-and-apply-staging.mjs", "setup-staging-project.mjs", "apply-schemas.mjs", "verify-install.mjs"]) {
      const result = run(script);
      expect(result.status, script).not.toBe(0);
      expect(result.stderr, script).toContain("[RETIRED]");
    }
    const scripts = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).scripts;
    for (const alias of ["db:reset", "db:reset:staging", "setup:staging", "db:apply", "db:apply:staging", "verify:install", "verify:rls", "storage:setup"]) {
      expect(scripts).not.toHaveProperty(alias);
    }
  }, 20_000);

  it("preflights a matching fresh install without connecting", () => {
    const result = run("apply-schemas-fresh.mjs", {}, ["--check-target"]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain(`Verified fresh-install target: ${ref}`);
  });

  it("rejects an install without explicit matching approval", () => {
    const result = run("apply-schemas-fresh.mjs", { TEAMFRAME_INSTALL_APPROVAL: "" }, ["--check-target"]);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("[PARITY_FAIL]");
  });

  it("rejects mismatched database identity and TLS URL override", () => {
    const other = "xjdobcfzwluozumhnjng";
    for (const dbUrl of [
      `postgresql://postgres.${other}:test-only@aws-0-ap-south-1.pooler.supabase.com:5432/postgres`,
      `postgresql://postgres.${ref}:test-only@aws-0-ap-south-1.pooler.supabase.com:5432/postgres?sslmode=no-verify`,
    ]) {
      expect(run("apply-schemas-fresh.mjs", { TEAMFRAME_INSTALL_DB_URL: dbUrl }, ["--check-target"]).status).not.toBe(0);
    }
  }, 15_000);

  it("rejects the ARIE-associated ref even with matching URLs and self-declared approval", () => {
    const other = "qrsxoumymbcehtltbtgn";
    const overrides = {
      TEAMFRAME_INSTALL_PROJECT_REF: other,
      TEAMFRAME_INSTALL_SUPABASE_URL: `https://${other}.supabase.co`,
      TEAMFRAME_INSTALL_DB_URL: `postgresql://postgres.${other}:test-only@aws-0-ap-south-1.pooler.supabase.com:5432/postgres`,
      TEAMFRAME_INSTALL_APPROVAL: `fresh:${other}`,
    };
    expect(run("apply-schemas-fresh.mjs", overrides, ["--check-target"]).status).not.toBe(0);
    expect(run("setup-storage.mjs", overrides, ["--check-target"]).status).not.toBe(0);
  }, 15_000);

  it("only preflights RLS on the approved exact disposable project", () => {
    expect(run("verify-rls.mjs", {}, ["--check-target"]).status).toBe(0);
    expect(run("verify-rls.mjs", { AUDIT_SUPABASE_PROJECT_REF: "qrsxoumymbcehtltbtgn" }, ["--check-target"]).status).not.toBe(0);
  }, 15_000);

  it("guards storage setup with the same explicit target approval", () => {
    expect(run("setup-storage.mjs", {}, ["--check-target"]).status).toBe(0);
    expect(run("setup-storage.mjs", { TEAMFRAME_INSTALL_APPROVAL: "" }, ["--check-target"]).status).not.toBe(0);
  }, 15_000);

  it("rejects another project's service-role key before a fresh install write", () => {
    const wrongProjectJwt = `e30.${Buffer.from(JSON.stringify({ role: "service_role", ref: "jxiiinglydqqhwjglxtg" })).toString("base64url")}.e30`;
    const result = run("setup-storage.mjs", { TEAMFRAME_INSTALL_SERVICE_ROLE_KEY: wrongProjectJwt }, ["--verify-key"]);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("different project or role");
  });

  it("retains empty-state and verified TLS checks in the only installer", () => {
    const source = readFileSync(join(root, "scripts/apply-schemas-fresh.mjs"), "utf8");
    expect(source).toContain("rejectUnauthorized: true");
    expect(source).toContain("Number(state.public_tables) !== 0");
    expect(source).toContain("Number(state.auth_users) !== 0");
    expect(source).toContain("Number(state.stored_objects) !== 0");
  });
});
