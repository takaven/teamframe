import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { avatarTint } from "@/lib/ui/avatarTint";
import { buildPositionTree, type PositionRecord } from "@/services/positionService/model";

const root = process.cwd();
const read = (p: string): string => readFileSync(path.join(root, p), "utf8");

describe("Premium craft pass", () => {
  it("gives each name a deterministic, restrained (non-neon) avatar tint", () => {
    // Deterministic: same name → same tint across renders/surfaces.
    expect(avatarTint("Avery Stone")).toBe(avatarTint("Avery Stone"));
    expect(avatarTint("Maya Chen")).toBe(avatarTint("Maya Chen"));
    // Varies across people (not all identical).
    const tints = new Set(["Avery Stone", "Maya Chen", "Ravi Patel", "Sofia Ali", "Tom Ford"].map(avatarTint));
    expect(tints.size).toBeGreaterThan(1);
    // Never the neon brand green.
    for (const n of ["Avery Stone", "Maya Chen", "Ravi Patel"]) {
      expect(avatarTint(n)).not.toContain("01ff22");
      expect(avatarTint(n).toLowerCase()).not.toContain("brand-signal");
    }
  });

  it("builds a 4-level org hierarchy without flattening (recursion holds)", () => {
    const base = (id: string, parent: string | null): PositionRecord => ({
      id, title: `Role ${id}`, department: "Eng", parent_position_id: parent,
      assigned_employee_id: null, assigned_employee_name: null, note: null,
      status: "Vacant", jd_attached: false, jd_original_filename: null, jd_mime_type: null,
      jd_uploaded_at: null, created_at: "2026-01-01", updated_at: "2026-01-01",
    });
    const positions: PositionRecord[] = [
      base("l1", null),
      base("l2a", "l1"), base("l2b", "l1"),
      base("l3", "l2a"),
      base("l4", "l3"),
    ];
    const tree = buildPositionTree(positions);
    expect(tree).toHaveLength(1);
    const l1 = tree[0]!;
    expect(l1.children).toHaveLength(2); // multiple siblings at level 2
    const l2a = l1.children.find((c) => c.id === "l2a")!;
    expect(l2a.children[0]!.id).toBe("l3");
    expect(l2a.children[0]!.children[0]!.id).toBe("l4"); // 4 levels deep, not flattened
  });

  it("has a coherent motion system that respects reduced motion", () => {
    const css = read("app/globals.css");
    expect(css).toContain("prefers-reduced-motion: no-preference");
    expect(css).toContain("prefers-reduced-motion: reduce");
    expect(css).toMatch(/transition:[^;]*160ms/);
    expect(css).toContain("@keyframes tf-pop-in");
  });

  it("enforces green discipline — graphite everyday primary, brand-green reserved", () => {
    const css = read("app/globals.css");
    // Everyday primary is institutional graphite, not neon.
    expect(css).toMatch(/\.tf-primary-action\s*\{[^}]*background:\s*var\(--brand-charcoal\)/);
    // A dedicated brand-green action exists for login/brand moments.
    expect(css).toMatch(/\.tf-brand-action\s*\{[^}]*background:\s*var\(--brand-signal\)/);
    // Login sign-in uses the brand-green moment.
    expect(read("app/auth/AuthForm.tsx")).toContain("tf-brand-action");
    expect(read("app/review/login/page.tsx")).toContain("tf-brand-action");
  });

  it("defines a single focus-ring token applied to custom + native controls", () => {
    const css = read("app/globals.css");
    expect(css).toContain("focus-visible");
    expect(css).toMatch(/outline:\s*2px solid var\(--brand-signal\)/);
  });

  it("renders unset values as 'Not set' rather than a bare dash", () => {
    expect(read("components/EmployeeMasterSections.tsx")).toContain("Not set");
    expect(read("components/EmployeeSelfRecord.tsx")).toContain("Not set");
    expect(read("components/CompensationPanel.tsx")).toContain("Not set");
  });

  it("keeps the leave calendar free of forced horizontal scroll", () => {
    const cal = read("components/LeaveCalendar.tsx");
    expect(cal).not.toContain("min-w-[720px]");
    expect(cal).not.toContain("overflow-x-auto");
  });
});
