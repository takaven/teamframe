import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const publicRoute = readFileSync(join(process.cwd(), "app", "api", "health", "route.ts"), "utf8");
const deepRoute = readFileSync(join(process.cwd(), "app", "api", "health", "deep", "route.ts"), "utf8");

describe("health endpoint protection", () => {
  it("keeps public health shallow and free of privileged probes", () => {
    expect(publicRoute).toContain("buildPublicHealthPayload(\"ok\")");
    expect(publicRoute).not.toContain("createServiceRoleClient");
    expect(publicRoute).not.toContain("listBuckets");
    expect(publicRoute).not.toContain("auth.admin");
    expect(publicRoute).not.toContain("companies");
  });

  it("puts deep health behind a header secret with throttling and redacted output", () => {
    expect(deepRoute).toContain("x-teamframe-health-secret");
    expect(deepRoute).toContain("DEEP_HEALTH_SECRET");
    expect(deepRoute).toContain("isRateLimited");
    expect(deepRoute).toContain("RATE_LIMIT_MAX");
    expect(deepRoute).toContain("subsystems: result");
    expect(deepRoute).not.toContain("req.nextUrl.searchParams.get");
  });

  it("rejects query-string secret attempts on deep health", () => {
    expect(deepRoute).toContain('searchParams.has("secret")');
    expect(deepRoute).toContain('searchParams.has("key")');
    expect(deepRoute).toContain('searchParams.has("healthcheck_secret")');
  });
});
