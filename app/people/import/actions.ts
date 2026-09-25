"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireTenantActor } from "@/middleware/rbac";
import { applyImportedEmployeeIdentity, createEmployee, listColleagueDirectory } from "@/services/employeeService";
import { getCompanySettings } from "@/services/configurationService";
import { normalizeCountryCode } from "@/lib/geo/countries";
import { isValidTimeZone } from "@/lib/geo/timezones";

const Row = z.object({ full_name: z.string().min(1), email: z.string().email(), employee_number: z.string().max(80).optional(), role_title: z.string().min(1), department: z.string().min(1), manager_email: z.string().email().nullable().optional(), start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), employment_type: z.enum(["full_time","part_time","contractor","intern"]), country: z.string().optional(), timezone: z.string().optional(), work_location: z.string().max(160).optional() });
export async function importEmployeesAction(formData: FormData): Promise<void> {
  let count = 0;
  try {
    const actor = await requireTenantActor();
    const rows = z.array(Row).min(1).max(200).parse(JSON.parse(String(formData.get("rows") ?? "[]")));
    const company = await getCompanySettings(actor);
    const defaultCountry = normalizeCountryCode(company.country);
    if (!defaultCountry) throw new Error("COMPANY_COUNTRY_REQUIRED");
    if (!isValidTimeZone(company.default_timezone)) throw new Error("COMPANY_TIMEZONE_REQUIRED");
    const directory = await listColleagueDirectory(actor);
    const employeeIdByEmail = new Map(directory.map((employee) => [employee.email.toLowerCase(), employee.id]));
    for (const row of rows) {
      const managerId = row.manager_email ? employeeIdByEmail.get(row.manager_email.toLowerCase()) : null;
      if (row.manager_email && !managerId) throw new Error("IMPORT_MANAGER_NOT_FOUND");
      const country = row.country ? normalizeCountryCode(row.country) : defaultCountry;
      if (!country) throw new Error("INVALID_COUNTRY");
      const timezone = row.timezone?.trim() || company.default_timezone;
      if (!isValidTimeZone(timezone)) throw new Error("INVALID_TIMEZONE");
      const created = await createEmployee(actor, { ...row, country, manager_id: managerId, timezone, end_date: null });
      await applyImportedEmployeeIdentity(actor, created.id, { employeeNumber: row.employee_number, workLocation: row.work_location });
      employeeIdByEmail.set(created.email.toLowerCase(), created.id);
      count += 1;
    }
  } catch { redirect(`/people/import?error=INVALID_IMPORT&created=${count}`); }
  redirect(`/people?status=created&imported=${count}`);
}
