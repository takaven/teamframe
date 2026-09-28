import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { documentLabel } from "@/lib/ui/documentLabels";
import { getCountryName } from "@/lib/geo/countries";
import { getOverviewQueueCounts, getOverviewQueueView, type OverviewQueueItem } from "@/lib/ui/overviewQueue";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("final red-team UI safeguards", () => {
  it("keeps employee and manager navigation role-specific", () => {
    const shell = read("components/AppShell.tsx");
    expect(shell).toContain('label: "My team"');
    expect(shell).toContain('label: "Documents & policies"');
    expect(shell).toContain('label: "Directory"');
  });

  it("shows overdue document dates and a labelled optional expiry field", () => {
    const checklist = read("components/DocumentsChecklist.tsx");
    expect(checklist).toContain("Overdue — was due");
    expect(checklist).toContain("Expiry date (optional)");
  });

  it("uses human country and document labels", () => {
    expect(getCountryName("AE")).toBe("United Arab Emirates");
    expect(documentLabel("employment_contract")).toBe("Employment contract");
    expect(documentLabel("medical_fitness")).toBe("Medical fitness certificate");
  });

  it("does not expose employer override fields in the self-service record", () => {
    const selfRecord = read("components/EmployeeSelfRecord.tsx");
    expect(selfRecord).not.toContain("Working-days override");
    expect(selfRecord).not.toContain("Leave entitlement override");
    expect(selfRecord).not.toContain("Employment status");
  });

  it("keeps Home filter counts scoped to the active filter", () => {
    const queue = read("components/OverviewQueue.tsx");
    expect(queue).toContain("Showing {visible.length} of {counts[filter]}");
    expect(queue).toContain('aria-selected={active}');
    expect(queue).toContain("tf-count-accent");
  });

  it("filters the full attention population before applying the ten-row display cap", () => {
    const makeItem = (id: number, kind: OverviewQueueItem["class"]): OverviewQueueItem => ({
      id: String(id), class: kind, source: "documents", title: `Item ${id}`, subjectName: "Person",
      owner: "Admin", nextAction: "Review", dueAt: null, href: `/item/${id}`, detail: "Needs review.",
    });
    const items = [
      ...Array.from({ length: 17 }, (_, index) => makeItem(index, "overdue")),
      ...Array.from({ length: 33 }, (_, index) => makeItem(index + 17, "decision")),
    ];

    expect(getOverviewQueueView(items, "all").matching).toHaveLength(50);
    expect(getOverviewQueueView(items, "all").visible).toHaveLength(10);
    expect(getOverviewQueueView(items, "overdue").matching).toHaveLength(17);
    expect(getOverviewQueueView(items, "overdue").visible).toHaveLength(10);
    expect(getOverviewQueueView(items.slice(0, 4), "overdue").visible).toHaveLength(4);
    expect(getOverviewQueueView(items, "exception")).toEqual({ matching: [], visible: [] });
    expect(getOverviewQueueCounts(items)).toEqual({ all: 50, overdue: 17, decision: 33, due: 0, exception: 0 });
  });

  it("keeps the final control polish shared, legible and outside Org Chart", () => {
    const styles = read("app/globals.css");
    const setup = read("app/setup/page.tsx");
    expect(styles).toContain('.tf-app-shell:not([data-active="/org-chart"])');
    expect(styles).toContain(".tf-secondary-action :where(span, svg) { color: inherit; }");
    expect(styles).toContain(".tf-count-accent::before");
    expect(setup).toContain('<select name={name} defaultValue={value ?? ""} required className="tf-select mt-1">');
    expect(setup).not.toContain("SelectField");
  });

  it("makes document-required onboarding work actionable", () => {
    const onboarding = read("app/onboarding/page.tsx");
    expect(onboarding).toContain('href="/documents-and-policies#documents"');
    expect(onboarding).toContain("Upload the requested document to complete this step.");
  });

  it("keeps the manager direct-report view focused and useful", () => {
    const manager = read("app/manager/page.tsx");
    const home = read("app/home/page.tsx");
    const service = read("services/managerService/index.ts");
    expect(manager).toContain("← Back to My team");
    expect(manager).toContain("Probation recommendation");
    expect(manager).toContain("30-day check-in");
    expect(manager).not.toContain("Back to my profile");
    expect(manager).not.toContain("Compensation: not visible to managers");
    expect(manager).toContain("upcomingLabel(item)");
    expect(manager).toContain("getCountryName(employee.country)");
    expect(home).toContain("upcomingLabel(item)");
    expect(home).toContain("manager.directReports.length > 0");
    expect(home).toContain("Overdue — was due");
    expect(service).not.toContain("`Away until ${leave.end_date}`");
  });

  it("describes headcount scope truthfully and humanises country exports", () => {
    const report = read("app/reports/page.tsx");
    const exportRoute = read("app/reports/export/route.ts");
    const styles = read("app/globals.css");
    expect(report).toContain("Current people, including pre-start employees");
    expect(report).toContain("Current people");
    expect(report).toContain("tf-reports-nav");
    expect(styles).toContain(".tf-secondary-nav.tf-reports-nav");
    expect(exportRoute).toContain("getCountryName(e.country) ?? e.country");
  });
});
