import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (p: string): string => readFileSync(path.join(root, p), "utf8");

// Walk app/ and components/ for .tsx files.
function tsxFiles(dir: string): string[] {
  const abs = path.join(root, dir);
  const out: string[] = [];
  for (const entry of readdirSync(abs)) {
    const rel = path.join(dir, entry);
    const st = statSync(path.join(root, rel));
    if (st.isDirectory()) out.push(...tsxFiles(rel));
    else if (entry.endsWith(".tsx")) out.push(rel);
  }
  return out;
}

// Raw `<button type="submit">` inside a mutating form skips the shared pending affordance. These
// three are the only legitimate raw submits: two GET filter/search forms (navigation, not a
// mutation) and the error-boundary reset. Everything else must go through the shared primitives or
// a useFormStatus-driven button.
const ALLOWED = new Set([
  path.normalize("app/company/page.tsx"), // year filter (GET navigation)
  path.normalize("app/employees/page.tsx"), // directory search (GET navigation)
  path.normalize("app/error.tsx"), // error boundary reset()
]);

describe("Global async processing-feedback coverage", () => {
  it("routes every mutating submit through the shared pending primitives (no raw holdouts)", () => {
    const offenders: string[] = [];
    for (const file of [...tsxFiles("app"), ...tsxFiles("components")]) {
      const src = read(file);
      // A file that drives its button with useFormStatus (or IS the shared primitive) already
      // implements the pending affordance — those are correct, not holdouts.
      if (src.includes("useFormStatus")) continue;
      if (/<button\s+type="submit"/.test(src) && !ALLOWED.has(path.normalize(file))) {
        offenders.push(file);
      }
    }
    expect(offenders, `raw submit buttons found (wire through PendingSubmitButton/useFormStatus): ${offenders.join(", ")}`).toEqual([]);
  });

  it("gives the previously-raw mutation surfaces a contextual pending state", () => {
    expect(read("app/manager/page.tsx")).toMatch(/pendingLabel="(Approving|Declining)…"/);
    expect(read("components/EmployeeSelfRecord.tsx")).toContain("PendingSubmitButton");
    expect(read("components/EmployeeSelfRecord.tsx")).toMatch(/pendingLabel="Saving…"/);
    expect(read("components/SignOutButton.tsx")).toContain("Signing out…");
    expect(read("app/auth/check-email/ResendLinkForm.tsx")).toContain("useFormStatus");
    expect(read("app/auth/page.tsx")).toMatch(/pendingLabel="(Continuing|Switching)…"/);
    expect(read("components/EmployeeMasterSections.tsx")).toMatch(/pendingLabel="Uploading…"/);
  });

  it("shows an in-flight affordance on async signed-URL downloads", () => {
    for (const file of ["app/leaves/page.tsx", "app/me/page.tsx", "app/policies/page.tsx", "components/LeaveCalendar.tsx"]) {
      expect(read(file)).toMatch(/pendingLabel="Opening…"/);
    }
  });
});
