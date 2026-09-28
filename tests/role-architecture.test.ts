import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("final role architecture", () => {
  it("keeps Home, Me and Documents & policies as distinct routes", () => {
    const shell = read("components/AppShell.tsx");
    expect(shell).toContain('{ href: "/home", label: "Home" }');
    expect(shell).toContain('{ href: "/me", label: "Me" }');
    expect(shell).toContain('{ href: "/documents-and-policies", label: "Documents & policies" }');
    expect(shell).not.toMatch(/href:\s*"\/me#/);
    expect(shell).toContain("const isActive = (href: string) => href === effectiveActivePath");
  });

  it("gives managers the approved four-item navigation in priority order", () => {
    const shell = read("components/AppShell.tsx");
    expect(shell).toMatch(/const MANAGER_LINKS = \[\s*\{ href: "\/home", label: "Home" \},\s*MANAGER_PRIORITIES_LINK,\s*\{ href: "\/leaves", label: "Time off" \},\s*\{ href: "\/me", label: "Me" \}/);
  });

  it("migrates authentication, notifications and action returns away from legacy Home anchors", () => {
    expect(read("app/auth/callback/route.ts")).toContain('role === "employee" ? "/home" : "/dashboard"');
    expect(read("app/review/login/page.tsx")).toContain('role === "admin" ? "/dashboard" : "/home"');
    const notifications = `${read("services/notificationService.ts")}\n${read("app/notifications/actions.ts")}`;
    expect(notifications).not.toMatch(/\/me#(?:documents|policies|check-in)/);
    expect(notifications).toContain("/documents-and-policies#documents");
    expect(notifications).toContain("/documents-and-policies#policies");
    expect(notifications).toContain("/home#check-in");
  });

  it("keeps a bounded compatibility bridge for important old fragment bookmarks", () => {
    const compatibility = read("components/LegacyMeHashRedirect.tsx");
    expect(compatibility).toContain('"#documents": "/documents-and-policies#documents"');
    expect(compatibility).toContain('"#policies": "/documents-and-policies#policies"');
    expect(compatibility).toContain('"#check-in": "/home#check-in"');
  });

  it("keeps employee-record actions on the canonical People routes", () => {
    const experience = read("components/PeopleExperience.tsx");
    const actions = read("app/employees/actions.ts");
    expect(experience).not.toContain('name="return_to" value="/employees"');
    expect(actions).not.toContain('returnTo = "/employees"');
    expect(actions).not.toContain('safeReturnPath(parsed.return_to, "/employees")');
  });
});
