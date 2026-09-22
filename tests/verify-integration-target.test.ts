import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const approvedRef = "syytforaidoorrvrbqwz";

function checkTarget(overrides: Record<string, string> = {}) {
  return spawnSync(process.execPath, [join(process.cwd(), "scripts/verify-integration.mjs"), "--check-target"], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      TEAMFRAME_AUDIT_INTEGRATION: "authorised-disposable",
      AUDIT_SUPABASE_PROJECT_REF: approvedRef,
      AUDIT_SUPABASE_URL: `https://${approvedRef}.supabase.co`,
      AUDIT_SUPABASE_SERVICE_ROLE_KEY: "test-only",
      AUDIT_SUPABASE_DB_URL: `postgresql://postgres.${approvedRef}:test-only@aws-0-ap-south-1.pooler.supabase.com:5432/postgres`,
      ...overrides,
    },
  });
}

describe("disposable integration target guard", () => {
  it("accepts an approved matching project without connecting", () => {
    const result = checkTarget();
    expect(result.status).toBe(0);
    expect(result.stdout).toContain(`Approved disposable target: ${approvedRef}`);
  });

  it("accepts the second approved disposable project", () => {
    const secondRef = "xjdobcfzwluozumhnjng";
    const result = checkTarget({
      AUDIT_SUPABASE_PROJECT_REF: secondRef,
      AUDIT_SUPABASE_URL: `https://${secondRef}.supabase.co`,
      AUDIT_SUPABASE_DB_URL: `postgresql://postgres.${secondRef}:test-only@aws-0-ap-south-1.pooler.supabase.com:5432/postgres`,
    });
    expect(result.status).toBe(0);
  });

  it("accepts the matching direct database URL", () => {
    const result = checkTarget({
      AUDIT_SUPABASE_DB_URL: `postgresql://postgres:test-only@db.${approvedRef}.supabase.co:5432/postgres`,
    });
    expect(result.status).toBe(0);
  });

  it("rejects an unapproved project even when its URLs agree", () => {
    const otherRef = "qrsxoumymbcehtltbtgn";
    const result = checkTarget({
      AUDIT_SUPABASE_PROJECT_REF: otherRef,
      AUDIT_SUPABASE_URL: `https://${otherRef}.supabase.co`,
      AUDIT_SUPABASE_DB_URL: `postgresql://postgres.${otherRef}:test-only@aws-0-ap-south-1.pooler.supabase.com:5432/postgres`,
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("not an approved TAKAVEN disposable project");
  });

  it("rejects a public URL with the right ref embedded in the wrong hostname", () => {
    const result = checkTarget({ AUDIT_SUPABASE_URL: `https://${approvedRef}.supabase.co.example.invalid` });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("exact approved project origin");
  });

  it("rejects a database URL for another project", () => {
    const result = checkTarget({
      AUDIT_SUPABASE_DB_URL: "postgresql://postgres.xjdobcfzwluozumhnjng:test-only@aws-0-ap-south-1.pooler.supabase.com:5432/postgres",
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("does not identify the approved disposable project");
  });

  it("rejects a database URL that overrides TLS validation", () => {
    const result = checkTarget({
      AUDIT_SUPABASE_DB_URL: `postgresql://postgres.${approvedRef}:test-only@aws-0-ap-south-1.pooler.supabase.com:5432/postgres?sslmode=no-verify`,
    });
    expect(result.status).not.toBe(0);
  });
});

describe("access provisioning target guard", () => {
  function checkAccessTarget(overrides: Record<string, string> = {}) {
    return spawnSync(process.execPath, [join(process.cwd(), "scripts/verify-access-provisioning.mjs"), "--check-target"], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        TEAMFRAME_AUDIT_INTEGRATION: "authorised-disposable",
        AUDIT_SUPABASE_PROJECT_REF: approvedRef,
        AUDIT_SUPABASE_URL: `https://${approvedRef}.supabase.co`,
        AUDIT_SUPABASE_ANON_KEY: "test-only",
        AUDIT_SUPABASE_SERVICE_ROLE_KEY: "test-only",
        AUDIT_SUPABASE_DB_URL: `postgresql://postgres.${approvedRef}:test-only@aws-0-ap-south-1.pooler.supabase.com:5432/postgres`,
        ...overrides,
      },
    });
  }

  it("refuses a generally approved but not write-approved project", () => {
    const result = checkAccessTarget();
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("not approved for access-proof writes");
    expect(result.stdout).not.toContain("independent access runtime gate");
  });

  it("rejects the protected buyer fixture and paused or quarantined projects", () => {
    for (const ref of ["wafkfvpsdhjfrxrmgksl", "euhvgedjldqzfczkzjqi", "syytforaidoorrvrbqwz", "xjdobcfzwluozumhnjng", "nvuijkgiqqhqeqduqqgm", "jxiiinglydqqhwjglxtg"]) {
      const result = checkAccessTarget({
        AUDIT_SUPABASE_PROJECT_REF: ref,
        AUDIT_SUPABASE_URL: `https://${ref}.supabase.co`,
        AUDIT_SUPABASE_DB_URL: `postgresql://postgres.${ref}:test-only@aws-0-ap-south-1.pooler.supabase.com:5432/postgres`,
      });
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("not approved for access-proof writes");
    }
  });

  it("rejects unapproved and mismatched targets", () => {
    expect(checkAccessTarget({ AUDIT_SUPABASE_PROJECT_REF: "qrsxoumymbcehtltbtgn" }).status).not.toBe(0);
    expect(checkAccessTarget({ AUDIT_SUPABASE_URL: `https://${approvedRef}.supabase.co.example.invalid` }).status).not.toBe(0);
    expect(checkAccessTarget({ AUDIT_SUPABASE_DB_URL: "postgresql://postgres.xjdobcfzwluozumhnjng:test-only@aws-0-ap-south-1.pooler.supabase.com:5432/postgres" }).status).not.toBe(0);
  });

  it("rejects a non-root API path", () => {
    expect(checkAccessTarget({ AUDIT_SUPABASE_URL: `https://${approvedRef}.supabase.co/other` }).status).not.toBe(0);
  });

  it("rejects database URL TLS overrides", () => {
    const result = checkAccessTarget({
      AUDIT_SUPABASE_DB_URL: `postgresql://postgres.${approvedRef}:test-only@aws-0-ap-south-1.pooler.supabase.com:5432/postgres?sslmode=no-verify`,
    });
    expect(result.status).not.toBe(0);
  });
});
