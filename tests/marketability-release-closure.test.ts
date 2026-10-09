import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read=(path:string)=>readFileSync(join(process.cwd(),path),"utf8");

describe("marketability release closure",()=>{
  it("provides an admin-confirmed UAE holiday template/import without authoritative future dates",()=>{
    const page=read("app/setup/page.tsx");const service=read("services/companyHolidayService.ts");const template=read("public/templates/uae-holidays-template.csv");
    expect(template.trim()).toBe("date,name");expect(page).toContain("Import an admin-confirmed annual holiday list");expect(page).toContain("does not supply or certify future religious-holiday dates");expect(service).toContain("importCompanyHolidays");expect(service).toContain("company.holidays_imported");
  });
  it("keeps the TeamFrame Hire bridge customer-hidden and server-disabled by default",()=>{
    const page=read("components/PeopleExperience.tsx");const action=read("app/employees/actions.ts");
    expect(page).toContain('process.env.TEAMFRAME_HIRE_BRIDGE_ENABLED === "true"');expect(action).toContain('process.env.TEAMFRAME_HIRE_BRIDGE_ENABLED !== "true"');expect(page).toContain("TeamFrame Hire");expect(page).not.toContain("HirePass");expect(page).not.toContain("operator-attested");
  });
  it("requires explicit confirmation before applying the reusable UAE setup pack",()=>{
    const service=read("services/uaeSetupPackService.ts");const page=read("app/setup/page.tsx");
    expect(service).toContain("confirmed: z.literal(true)");expect(service).toContain('country: "AE"');expect(service).toContain("UAE starter checklist");expect(page).toContain("I reviewed these editable company choices");expect(page).toContain("not a legal conclusion");
    expect(page).toContain('definition?.accrual_enabled && definition.joining_date_pro_rata');
    expect(page).toContain('Needs review — choose one timing method');
  });
  it("removes the stale landing screenshot and internal demo-policy disclaimers",()=>{
    const landing=read("app/page.tsx");const demo=read("scripts/lib/demo-plan.mjs");
    expect(landing).not.toContain("dashboard-risk-signals.png");expect(landing).toContain("Current TeamFrame overview illustrated with synthetic data");expect(demo).not.toContain("Synthetic demo policy");expect(demo).not.toContain("It contains no real");
  });
});
