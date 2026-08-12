import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("dashboard authorization", () => {
  it("requires admin authorization before service-role Control Centre queries run", () => {
    const source = readFileSync(join(process.cwd(), "app", "dashboard", "page.tsx"), "utf8");

    expect(source).toContain('import { requireTenantRole } from "@/middleware/rbac";');
    expect(source).toContain("loadControlCentreData");
    expect(source).toContain('const actor = await requireTenantRole("admin");');
    expect(source.indexOf('const actor = await requireTenantRole("admin");')).toBeLessThan(
      source.indexOf("loadControlCentreData({"),
    );
  });

  it("does not expose a generic dashboard Mark done mutation for Signals", () => {
    expect(existsSync(join(process.cwd(), "app", "dashboard", "actions.ts"))).toBe(false);

    const dashboardSource = readFileSync(join(process.cwd(), "app", "dashboard", "page.tsx"), "utf8");
    expect(dashboardSource).not.toContain("executeActionItemAction");
    expect(dashboardSource).not.toContain("Mark done");
  });
});
