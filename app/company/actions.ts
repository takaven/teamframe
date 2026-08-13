"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireTenantActor } from "@/middleware/rbac";
import { createCompanyHoliday, deleteCompanyHoliday, updateCompanyHoliday } from "@/services/companyHolidayService";

const DateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const HolidaySchema = z.object({
  holiday_id: z.string().uuid().optional().nullable(),
  holiday_date: DateString,
  name: z.string().trim().min(1).max(160),
  year: z.coerce.number().int().min(1900).max(2200),
});
const DeleteSchema = z.object({
  holiday_id: z.string().uuid(),
  year: z.coerce.number().int().min(1900).max(2200),
});

function errorCode(error: unknown): string {
  if (error instanceof z.ZodError) return "INVALID_INPUT";
  if (error instanceof Error) return error.message.split(":")[0] ?? "UNKNOWN";
  return "UNKNOWN";
}

export async function saveHolidayAction(formData: FormData): Promise<void> {
  let year = new Date().getUTCFullYear();
  try {
    const actor = await requireTenantActor();
    const parsed = HolidaySchema.parse({
      holiday_id: formData.get("holiday_id") || null,
      holiday_date: formData.get("holiday_date"),
      name: formData.get("name"),
      year: formData.get("year"),
    });
    year = parsed.year;
    const input = { date: parsed.holiday_date, name: parsed.name };
    if (parsed.holiday_id) {
      await updateCompanyHoliday(actor, parsed.holiday_id, input);
    } else {
      await createCompanyHoliday(actor, input);
    }
  } catch (error) {
    redirect(`/company?year=${encodeURIComponent(String(year))}&error=${encodeURIComponent(errorCode(error))}`);
  }
  redirect(`/company?year=${encodeURIComponent(String(year))}&status=holiday_saved`);
}

export async function deleteHolidayAction(formData: FormData): Promise<void> {
  let year = new Date().getUTCFullYear();
  try {
    const actor = await requireTenantActor();
    const parsed = DeleteSchema.parse({
      holiday_id: formData.get("holiday_id"),
      year: formData.get("year"),
    });
    year = parsed.year;
    await deleteCompanyHoliday(actor, parsed.holiday_id);
  } catch (error) {
    redirect(`/company?year=${encodeURIComponent(String(year))}&error=${encodeURIComponent(errorCode(error))}`);
  }
  redirect(`/company?year=${encodeURIComponent(String(year))}&status=holiday_removed`);
}
