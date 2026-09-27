import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { validateCustomerImplementationPack } from "@/services/customerImplementationService";

vi.mock("server-only", () => ({}));

type Pack = Record<string, any>;

function employee(overrides: Record<number, string> = {}): string {
  const cells = ["CRA-0001", "Synthetic Person", "", "person001@customer.invalid", "", "", "", "", "AE", "Analyst", "Advisory", "", "2025-01-01", "full_time", "existing", "Dubai", "AE"];
  for (const [index, value] of Object.entries(overrides)) cells[Number(index)] = value;
  return cells.join(",");
}

function validPack(): Pack {
  return {
    setupPack: {
      companyCsv: "Crescent Ridge Advisory LLC,AE,Dubai,25,15,Asia/Dubai,Mon Tue Wed Thu Fri,CRA,-,4,1",
      usersCsv: "Implementation Operator,operator@customer.invalid,no,full_access",
      employeesCsv: employee(),
      holidaysCsv: "2026-12-02,UAE National Day",
    },
    departments: ["Advisory"],
    workLocations: [{ name: "Dubai", country: "AE" }],
    positions: [{ key: "analyst", title: "Analyst", department: "Advisory", workLocation: "Dubai", employeeEmail: "person001@customer.invalid" }],
    leaveDefinitions: [{ display_name: "Annual Leave", system_leave_type: "annual", active: true, default_entitlement_days: 25, counting_basis: "working_days", attachment_requirement: "not_required" }],
    onboarding: { name: "Standard onboarding", tasks: [{ title: "Read handbook", ownerRole: "employee", dueOffsetDays: 0, completionMode: "manual_confirmation" }] },
    documentRequirements: [{ employeeEmail: "person001@customer.invalid", documentType: "passport", dueDate: "2026-10-01", reviewRequired: true }],
    policies: [{ title: "Employee handbook", body: "Synthetic policy", version: 1, effectiveDate: "2026-01-01", publish: true }],
  };
}

describe("maintained customer implementation pack", () => {
  it("returns IMPLEMENTATION READY semantics for a valid standard pack", () => {
    expect(validateCustomerImplementationPack(validPack()).validationErrors).toEqual([]);
  });

  it("keeps the maintained operator example valid", () => {
    const example = JSON.parse(readFileSync(join(process.cwd(), "docs/operations/customer-implementation-pack.example.json"), "utf8"));
    expect(validateCustomerImplementationPack(example).validationErrors).toEqual([]);
  });

  const cases: Array<[string, (pack: Pack) => void, string]> = [
    ["duplicate email", (pack) => { pack.setupPack.employeesCsv += `\n${employee({ 0: "CRA-0002" })}`; }, "duplicate employee"],
    ["duplicate employee number", (pack) => { pack.setupPack.employeesCsv += `\n${employee({ 3: "person002@customer.invalid" })}`; }, "duplicate employee number"],
    ["malformed date", (pack) => { pack.setupPack.employeesCsv = employee({ 12: "2026-02-31" }); }, "invalid date"],
    ["invalid timezone", (pack) => { pack.setupPack.companyCsv = pack.setupPack.companyCsv.replace("Asia/Dubai", "Mars/Olympus"); }, "invalid timezone"],
    ["invalid country", (pack) => { pack.setupPack.companyCsv = pack.setupPack.companyCsv.replace(",AE,Dubai", ",XX,Dubai"); }, "invalid country"],
    ["unresolved manager", (pack) => { pack.setupPack.employeesCsv = employee({ 11: "missing@customer.invalid" }); }, "unknown manager"],
    ["reporting cycle", (pack) => { pack.setupPack.employeesCsv = `${employee({ 11: "person002@customer.invalid" })}\n${employee({ 0: "CRA-0002", 1: "Other Person", 3: "person002@customer.invalid", 11: "person001@customer.invalid" })}`; }, "manager reporting cycle"],
    ["unknown department", (pack) => { pack.setupPack.employeesCsv = employee({ 10: "Unknown" }); }, "unknown department"],
    ["unknown location", (pack) => { pack.setupPack.employeesCsv = employee({ 15: "Abu Dhabi" }); }, "unknown location"],
    ["invalid employment type", (pack) => { pack.setupPack.employeesCsv = employee({ 13: "freelance" }); }, "invalid employment type"],
  ];

  it.each(cases)("rejects %s before writes", (_name, mutate, expected) => {
    const pack = validPack(); mutate(pack);
    expect(validateCustomerImplementationPack(pack).validationErrors.join(" | ")).toContain(expected);
  });

  it("rejects a position cycle before writes", () => {
    const pack = validPack();
    pack.positions = [
      { key: "one", title: "One", department: "Advisory", parentKey: "two" },
      { key: "two", title: "Two", department: "Advisory", parentKey: "one" },
    ];
    expect(validateCustomerImplementationPack(pack).validationErrors.join(" | ")).toContain("position reporting cycle");
  });
});
