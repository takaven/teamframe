import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EXPECTED_PUBLIC_TABLES, SCHEMA_ORDER } from "../scripts/schema-order.mjs";

const ref = "dcfxyjrfsrkibhpbmjnw";
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
  it("keeps one exact canonical public-table inventory for fresh and rehearsal verification", () => {
    const tablesFromSchemas = new Set<string>();
    for (const file of SCHEMA_ORDER) {
      const sql = readFileSync(join(root, "schemas", file), "utf8");
      for (const match of sql.matchAll(/create\s+table\s+if\s+not\s+exists\s+(?:public\.)?([a-z_][a-z0-9_]*)/gi)) {
        const tableName = match[1];
        if (tableName) tablesFromSchemas.add(tableName.toLowerCase());
      }
    }
    expect(EXPECTED_PUBLIC_TABLES).toHaveLength(49);
    expect([...EXPECTED_PUBLIC_TABLES].sort()).toEqual(EXPECTED_PUBLIC_TABLES);
    expect([...tablesFromSchemas].sort()).toEqual(EXPECTED_PUBLIC_TABLES);

    const installer = readFileSync(join(root, "scripts", "apply-schemas-fresh.mjs"), "utf8");
    const rehearsalBootstrap = readFileSync(join(root, "scripts", "bootstrap-factory-disposable.mjs"), "utf8");
    const integrationGate = readFileSync(join(root, "scripts", "verify-integration.mjs"), "utf8");
    const parityGate = readFileSync(join(root, "scripts", "verify-parity.mjs"), "utf8");
    expect(installer).toContain("EXPECTED_PUBLIC_TABLES");
    expect(rehearsalBootstrap).toContain("EXPECTED_PUBLIC_TABLES");
    expect(integrationGate).toContain("EXPECTED_PUBLIC_TABLES");
    expect(parityGate).toContain("EXPECTED_PUBLIC_TABLES");
    expect(installer).not.toMatch(/installed\.tables\s*!==\s*\d+/);
    expect(rehearsalBootstrap).not.toMatch(/tables\.length\s*!==\s*\d+/);

    const apiPrivileges = readFileSync(join(root, "schemas", "api_privileges.sql"), "utf8");
    expect(apiPrivileges).toMatch(/revoke\s+all\s+privileges\s+on\s+all\s+tables\s+in\s+schema\s+public\s+from\s+anon/i);
    expect(apiPrivileges).toMatch(/alter\s+default\s+privileges\s+in\s+schema\s+public\s+revoke\s+all\s+privileges\s+on\s+tables\s+from\s+anon/i);
  });

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

  it("rejects retired install and storage targets", () => {
    const freshRef = "tosrbylwchodbeaculgi";
    const target = {
      TEAMFRAME_INSTALL_PROJECT_REF: freshRef,
      TEAMFRAME_INSTALL_SUPABASE_URL: `https://${freshRef}.supabase.co`,
      TEAMFRAME_INSTALL_DB_URL: `postgresql://postgres.${freshRef}:test-only@aws-0-ap-south-1.pooler.supabase.com:5432/postgres`,
      TEAMFRAME_INSTALL_APPROVAL: `fresh:${freshRef}`,
    };
    expect(run("apply-schemas-fresh.mjs", target, ["--check-target"]).status).not.toBe(0);
    expect(run("setup-storage.mjs", target, ["--check-target"]).status).not.toBe(0);
    expect(run("apply-schemas-fresh.mjs", { ...target, TEAMFRAME_INSTALL_DB_URL: `postgresql://postgres.${ref}:test-only@aws-0-ap-south-1.pooler.supabase.com:5432/postgres` }, ["--check-target"]).status).not.toBe(0);
    expect(run("setup-storage.mjs", { ...target, TEAMFRAME_INSTALL_SUPABASE_URL: `https://${ref}.supabase.co` }, ["--check-target"]).status).not.toBe(0);
  }, 15_000);

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

  it("rejects the externally associated ref even with matching URLs and self-declared approval", () => {
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

  it("admits only the exact active RLS target and rejects unrelated projects", () => {
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

  it("refuses legacy direct writers before credential loading or client creation", () => {
    const retiredRef = "syytforaidoorrvrbqwz";
    for (const script of [
      "force-create-admin.mjs",
      "gen-magic-link.mjs",
      "smoke-core-loop.mjs",
      "verify-customer-readiness.mjs",
      "cleanup-expired-exports.mjs",
      "seed-admin.mjs",
      "seed-demo.mjs",
      "bootstrap-full-access.mjs",
    ]) {
      const result = run(script, {
        TEAMFRAME_MUTATION_PROJECT_REF: retiredRef,
        TEAMFRAME_MUTATION_APPROVAL: `${script === "bootstrap-full-access.mjs" ? "access-bootstrap" : script.replace(/\.mjs$/, "")}:${retiredRef}`,
        NEXT_PUBLIC_SUPABASE_URL: `https://${retiredRef}.supabase.co`,
        SUPABASE_SERVICE_ROLE_KEY: "test-only",
        EXPORT_CLEANUP_SUPABASE_URL: `https://${retiredRef}.supabase.co`,
        EXPORT_CLEANUP_SERVICE_ROLE_KEY: "test-only",
      }, script === "cleanup-expired-exports.mjs" ? ["--execute"] : []);
      expect(result.status, script).not.toBe(0);
      expect(result.stderr, script).toContain("refused");
      expect(result.stdout, script).not.toContain("CALLBACK_URL");
    }
  }, 20_000);
});
