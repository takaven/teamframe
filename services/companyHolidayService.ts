import "server-only";
import { z } from "zod";
import type { Actor } from "@/middleware/rbac";
import { createServiceRoleClient } from "@/lib/db/supabaseServer";
import { requireCapability } from "@/lib/rbac/access";

export type CompanyHoliday = {
  id: string;
  holiday_date: string;
  name: string;
  created_at: string;
  updated_at: string;
};

const DateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const HolidayInputSchema = z.object({
  date: DateString,
  name: z.string().trim().min(1).max(160),
});

function requireTenant(actor: Actor): string {
  if (!actor.tenantId) throw new Error("NO_TENANT_CONTEXT");
  return actor.tenantId;
}

async function requireHolidayAccess(actor: Actor): Promise<void> {
  await requireCapability(actor, "people_operations");
}

export async function listCompanyHolidays(actor: Actor, year = new Date().getUTCFullYear()): Promise<CompanyHoliday[]> {
  await requireHolidayAccess(actor);
  const tenantId = requireTenant(actor);
  if (!Number.isInteger(year) || year < 1900 || year > 2200) throw new Error("INVALID_YEAR");
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("company_holidays")
    .select("id, holiday_date, name, created_at, updated_at")
    .eq("tenant_id", tenantId)
    .gte("holiday_date", `${year}-01-01`)
    .lte("holiday_date", `${year}-12-31`)
    .order("holiday_date", { ascending: true });

  if (error) throw new Error(`HOLIDAYS_FETCH_FAILED: ${error.message}`);
  return (data ?? []) as CompanyHoliday[];
}

export async function createCompanyHoliday(actor: Actor, input: unknown): Promise<CompanyHoliday> {
  await requireHolidayAccess(actor);
  const tenantId = requireTenant(actor);
  const parsed = HolidayInputSchema.parse(input);
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("company_holidays")
    .insert({ tenant_id: tenantId, holiday_date: parsed.date, name: parsed.name } as never)
    .select("id, holiday_date, name, created_at, updated_at")
    .single();

  if (error) {
    if (error.code === "23505") throw new Error("HOLIDAY_DATE_DUPLICATE");
    throw new Error(`HOLIDAY_CREATE_FAILED: ${error.message}`);
  }
  return data as CompanyHoliday;
}

export async function updateCompanyHoliday(actor: Actor, holidayId: string, input: unknown): Promise<CompanyHoliday> {
  await requireHolidayAccess(actor);
  const tenantId = requireTenant(actor);
  const parsed = HolidayInputSchema.parse(input);
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("company_holidays")
    .update({ holiday_date: parsed.date, name: parsed.name, updated_at: new Date().toISOString() } as never)
    .eq("tenant_id", tenantId)
    .eq("id", holidayId)
    .select("id, holiday_date, name, created_at, updated_at")
    .maybeSingle();

  if (error) {
    if (error.code === "23505") throw new Error("HOLIDAY_DATE_DUPLICATE");
    throw new Error(`HOLIDAY_UPDATE_FAILED: ${error.message}`);
  }
  if (!data) throw new Error("HOLIDAY_NOT_FOUND");
  return data as CompanyHoliday;
}

export async function deleteCompanyHoliday(actor: Actor, holidayId: string): Promise<void> {
  await requireHolidayAccess(actor);
  const tenantId = requireTenant(actor);
  const supabase = createServiceRoleClient();
  const { error, count } = await supabase.from("company_holidays").delete({ count: "exact" }).eq("tenant_id", tenantId).eq("id", holidayId);

  if (error) throw new Error(`HOLIDAY_DELETE_FAILED: ${error.message}`);
  if (count === 0) throw new Error("HOLIDAY_NOT_FOUND");
}

export async function importCompanyHolidays(actor: Actor, csv: string, year: number): Promise<number> {
  await requireHolidayAccess(actor);
  const tenantId = requireTenant(actor);
  if (!Number.isInteger(year) || year < 1900 || year > 2200 || csv.length > 50_000) throw new Error("INVALID_INPUT");
  const rows = csv.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (rows[0]?.toLowerCase().replaceAll(" ", "") === "date,name") rows.shift();
  const seen = new Set<string>();
  const parsed = rows.map((line) => {
    const separator = line.indexOf(",");
    if (separator < 0) throw new Error("HOLIDAY_IMPORT_INVALID_ROW");
    const date = line.slice(0, separator).trim();
    const name = line.slice(separator + 1).trim();
    const value = HolidayInputSchema.parse({ date, name });
    if (!date.startsWith(`${year}-`) || seen.has(date)) throw new Error("HOLIDAY_IMPORT_INVALID_YEAR_OR_DUPLICATE");
    seen.add(date);
    return { tenant_id: tenantId, holiday_date: value.date, name: value.name, updated_at: new Date().toISOString() };
  });
  if (parsed.length === 0 || parsed.length > 80) throw new Error("HOLIDAY_IMPORT_INVALID_COUNT");
  const db = createServiceRoleClient();
  const result = await db.from("company_holidays").upsert(parsed as never, { onConflict: "tenant_id,holiday_date" });
  if (result.error) throw new Error(`HOLIDAY_IMPORT_FAILED: ${result.error.message}`);
  const audit = await db.from("audit_logs").insert({ tenant_id: tenantId, actor_user_id: actor.authUserId, action_type: "company.holidays_imported" } as never);
  if (audit.error) throw new Error(`AUDIT_LOG_FAILED: ${audit.error.message}`);
  return parsed.length;
}
