import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("People architecture", () => {
  it("uses canonical directory, record and creation routes", () => {
    expect(read("app/people/page.tsx")).toContain('view="directory"');
    expect(read("app/people/[id]/page.tsx")).toContain('view="record"');
    expect(read("app/people/add/page.tsx")).toContain('view="create"');
  });

  it("keeps legacy employee links as compatibility redirects", () => {
    const legacy = read("app/employees/page.tsx");
    expect(legacy).toContain('redirect(`${destination}');
    expect(legacy).toContain('/people/${encodeURIComponent(employee)}');
  });

  it("deep-links Home items into canonical employee sections", () => {
    const dashboardData = read("app/dashboard/data.ts");
    expect(dashboardData).toContain('return `/people/${encodeURIComponent(employeeId)}#${encodeURIComponent(section)}`');
    expect(dashboardData).toContain('documents: "documents"');
    expect(dashboardData).toContain('account: "onboarding-offboarding"');
    expect(dashboardData).not.toContain('href: `/onboarding?employee=');
    expect(dashboardData).not.toContain('href: `/early-employment#probation-');
  });

  it("does not advertise finance export from the People surface", () => {
    const people = read("components/PeopleExperience.tsx");
    const setup = read("app/setup/page.tsx");
    const reports = read("app/reports/page.tsx");
    expect(people).not.toContain("Export finance handoff");
    expect(setup).toContain('/reports?view=exports');
    expect(reports).toContain("Export payroll data");
  });

  it("keeps every People toolbar destination and GET filter contract intact", () => {
    const people = read("components/PeopleExperience.tsx");
    expect(people).toContain('href="/org-chart"');
    expect(people).toContain('href="/people/import"');
    expect(people).toContain('href="/people/add"');
    expect(people).toContain('name="q"');
    expect(people).toContain('name="filter"');
    for (const value of ["all", "attention", "active", "pre_start", "offboarding", "archived"]) {
      expect(people).toContain(`value="${value}"`);
    }
    expect(people).toContain('className="tf-people-filters"');
    expect(people).toContain(">Organisation</Link>");
    expect(people).not.toContain(">Org chart</Link>");
  });
});
