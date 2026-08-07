import { readFileSync } from "node:fs";
import { access } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

async function expectFile(relativePath: string) {
  await expect(access(path.join(root, relativePath))).resolves.toBeUndefined();
}

describe("TeamFrame brand system", () => {
  it("keeps logo and app icon assets available from stable paths", async () => {
    const requiredAssets = [
      "public/brand/teamframe-mark-primary.svg",
      "public/brand/teamframe-mark-reversed.svg",
      "public/brand/teamframe-mark-monochrome-dark.svg",
      "public/brand/teamframe-mark-monochrome-light.svg",
      "public/brand/teamframe-lockup-primary.svg",
      "public/brand/teamframe-lockup-reversed.svg",
      "public/brand/teamframe-lockup-monochrome-dark.svg",
      "public/brand/teamframe-lockup-monochrome-light.svg",
      "public/brand/teamframe-wordmark.svg",
      "public/favicon.svg",
      "app/icon.svg",
      "app/favicon.svg",
      "app/apple-icon.png",
    ];

    await Promise.all(requiredAssets.map((asset) => expectFile(asset)));
  });

  it("references only valid app icon assets in metadata", () => {
    const layout = read("app/layout.tsx");

    expect(layout).toContain('description: "People operations, made ready."');
    expect(layout).toContain('url: "/favicon.svg"');
    expect(layout).toContain('url: "/icon.svg"');
    expect(layout).toContain('url: "/apple-icon.png"');
  });

  it("uses central brand tokens and keeps lime separate from semantic status colour", () => {
    const globals = read("app/globals.css");
    const statusPill = read("components/StatusPill.tsx");

    expect(globals).toContain("--color-brand-signal: #c8f500");
    expect(globals).toContain("--brand-signal: #c8f500");
    expect(globals).toContain("--color-signal-green");
    expect(statusPill).toContain("bg-signal-green/10");
    expect(statusPill).not.toContain("brand-signal");
  });

  it("keeps active product language out of performance-management positioning", () => {
    const activeSources = [
      "app/page.tsx",
      "app/layout.tsx",
      "app/admin/login/page.tsx",
      "app/auth/page.tsx",
      "components/AppShell.tsx",
      "README.md",
      "package.json",
    ]
      .map((file) => read(file))
      .join("\n");

    expect(activeSources).not.toMatch(/Powering People and Performance/i);
    expect(activeSources).not.toMatch(/performance overview/i);
    expect(activeSources).not.toMatch(/performance management/i);
    expect(activeSources).not.toMatch(/productivity monitoring/i);
    expect(activeSources).not.toMatch(/48.?72/i);
  });

  it("uses accurate navigation labels for the current product routes", () => {
    const appShell = read("components/AppShell.tsx");

    expect(appShell).toContain('{ href: "/dashboard", label: "Overview" }');
    expect(appShell).toContain('{ href: "/employees", label: "Employees" }');
    expect(appShell).toContain('{ href: "/onboarding", label: "Onboarding" }');
    expect(appShell).toContain('{ href: "/leaves", label: "Leave" }');
    expect(appShell).toContain('{ href: "/policies", label: "Policies" }');
    expect(appShell).not.toContain('label: "Performance"');
  });
});
