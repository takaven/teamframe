import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { orderEmployeeImportRows, parseEmployeeCsv } from "@/lib/people/importCsv";

const required = "full_name,email,role_title,department,start_date,employment_type,country,timezone\n";

describe("People CSV defaults", () => {
  it("allows country and timezone to be omitted when company defaults exist", () => {
    const result = parseEmployeeCsv(
      "full_name,email,role_title,department,start_date,employment_type\nAmina Rahman,amina@example.invalid,Engineer,Technology,2026-10-01,full_time\n",
      "AE",
      "Asia/Dubai",
    );
    expect(result.errors).toEqual([]);
    expect(result.rows[0]?.country).toBeUndefined();
    expect(result.rows[0]?.timezone).toBeUndefined();
  });

  it("preserves explicit valid values, including quoted commas", () => {
    const result = parseEmployeeCsv(
      `${required}"Rahman, Amina",amina@example.invalid,Engineer,Technology,2026-10-01,full_time,MU,Indian/Mauritius\n`,
      "AE",
      "Asia/Dubai",
    );
    expect(result.errors).toEqual([]);
    expect(result.rows[0]).toMatchObject({ full_name: "Rahman, Amina", country: "MU", timezone: "Indian/Mauritius" });
  });

  it("blocks invalid overrides and missing company defaults", () => {
    const invalid = parseEmployeeCsv(
      `${required}Amina Rahman,amina@example.invalid,Engineer,Technology,2026-10-01,full_time,ZZ,Nowhere/City\n`,
      null,
      null,
    );
    expect(invalid.errors).toContain("Company country is not configured.");
    expect(invalid.errors).toContain("Company timezone is not configured.");
    expect(invalid.errors).toContain("Row 2: country must be an ISO two-letter code");
    expect(invalid.errors).toContain("Row 2: invalid timezone");
  });

  it("preflights the full file before writes", () => {
    const result = parseEmployeeCsv(
      [
        "full_name,email,employee_number,role_title,department,manager_email,start_date,employment_type,country,timezone,work_location",
        "Amina Rahman,existing@example.invalid,EMP-1,Engineer,Unknown,,2026-02-30,casual,AE,Asia/Dubai,Remote",
        "Duplicate Person,EXISTING@example.invalid,EMP-1,Engineer,Technology,missing@example.invalid,2026-10-01,full_time,AE,Asia/Dubai,Dubai",
      ].join("\n"),
      "AE",
      "Asia/Dubai",
      {
        departments: ["Technology"],
        workLocations: ["Dubai"],
        existingEmails: ["existing@example.invalid"],
        existingEmployeeNumbers: ["EMP-1"],
      },
    );

    expect(result.errors).toContain("Row 2: duplicate email existing@example.invalid");
    expect(result.errors).toContain("Row 2: duplicate employee number EMP-1");
    expect(result.errors).toContain("Row 2: unknown department Unknown");
    expect(result.errors).toContain("Row 2: start date must be a real YYYY-MM-DD date");
    expect(result.errors).toContain("Row 2: unsupported employment type casual");
    expect(result.errors).toContain("Row 2: unknown work location Remote");
    expect(result.errors).toContain("Row 3: manager email was not found missing@example.invalid");
  });

  it("orders in-file managers before reports and rejects reporting cycles", () => {
    const parsed = parseEmployeeCsv(
      [
        "full_name,email,role_title,department,manager_email,start_date,employment_type",
        "Report,report@example.invalid,Engineer,Technology,manager@example.invalid,2026-10-01,full_time",
        "Manager,manager@example.invalid,Manager,Technology,,2026-10-01,full_time",
      ].join("\n"),
      "AE",
      "Asia/Dubai",
    );
    expect(parsed.errors).toEqual([]);
    expect(orderEmployeeImportRows(parsed.rows).map((row) => row.email)).toEqual([
      "manager@example.invalid",
      "report@example.invalid",
    ]);

    const cycle = parseEmployeeCsv(
      [
        "full_name,email,role_title,department,manager_email,start_date,employment_type",
        "One,one@example.invalid,Manager,Technology,two@example.invalid,2026-10-01,full_time",
        "Two,two@example.invalid,Manager,Technology,one@example.invalid,2026-10-01,full_time",
      ].join("\n"),
      "AE",
      "Asia/Dubai",
    );
    expect(cycle.errors).toContain("Manager reporting relationships contain a cycle.");
  });

  it("classifies the People CSV route as an existing-workforce import", () => {
    const action = readFileSync(join(process.cwd(), "app/people/import/actions.ts"), "utf8");
    const importPage = readFileSync(join(process.cwd(), "app/people/import/page.tsx"), "utf8");
    const peopleExperience = readFileSync(join(process.cwd(), "components/PeopleExperience.tsx"), "utf8");
    const service = readFileSync(join(process.cwd(), "services/employeeService/index.ts"), "utf8");
    const schema = readFileSync(join(process.cwd(), "schemas/transactional_mutations.sql"), "utf8");

    expect(action).toContain("initialize_join_work: false");
    expect(action).toContain('setup_status: "active"');
    expect(importPage).toContain("Import existing workforce");
    expect(importPage).toContain("Historical start dates will not create onboarding, check-in or probation work.");
    expect(importPage).toContain('href="/people/add"');
    expect(peopleExperience).toContain(">Import existing workforce</Link>");
    expect(service).toContain("p_initialize_join_work: parsed.initialize_join_work ?? true");
    expect(schema).toContain("if p_initialize_join_work is null then");
    expect(schema).toContain("if p_initialize_join_work then");
  });
});
