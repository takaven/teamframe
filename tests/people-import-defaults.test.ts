import { describe, expect, it } from "vitest";
import { parseEmployeeCsv } from "@/lib/people/importCsv";

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
});
