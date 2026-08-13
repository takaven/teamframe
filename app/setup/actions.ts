"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireTenantCapability } from "@/middleware/rbac";
import { completeGuidedCompanySetup } from "@/services/companySetupService";
import { logAction } from "@/lib/telemetry/logger";
import { captureActionError } from "@/lib/telemetry/sentry";

const SetupFormSchema = z.object({
  company_name: z.string().trim().min(1),
  country: z.string().trim().min(2),
  location: z.string().trim().optional(),
  annual_leave_default_days: z.string().trim().min(1),
  sick_leave_default_days: z.string().trim().min(1),
  positions: z.string().trim().min(1),
  employees: z.string().trim().min(1),
});

function optionalString(value: FormDataEntryValue | null): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function getErrorCode(error: unknown): string {
  if (error instanceof z.ZodError) return "INVALID_INPUT";
  if (error instanceof Error) {
    const match = error.message.match(/^[A-Z_]+/);
    return match ? match[0] : "UNKNOWN";
  }
  return "UNKNOWN";
}

export async function completeGuidedSetupAction(formData: FormData): Promise<void> {
  const start = Date.now();
  const requestId = crypto.randomUUID();
  let actor: Awaited<ReturnType<typeof requireTenantCapability>> | null = null;
  let caughtError: unknown = null;

  try {
    actor = await requireTenantCapability("company_access_settings");
    const parsed = SetupFormSchema.parse({
      company_name: formData.get("company_name"),
      country: formData.get("country"),
      location: optionalString(formData.get("location")),
      annual_leave_default_days: formData.get("annual_leave_default_days"),
      sick_leave_default_days: formData.get("sick_leave_default_days"),
      positions: formData.get("positions"),
      employees: formData.get("employees"),
    });

    await completeGuidedCompanySetup(actor, {
      companyName: parsed.company_name,
      country: parsed.country,
      location: parsed.location,
      annualLeaveDefaultDays: parsed.annual_leave_default_days,
      sickLeaveDefaultDays: parsed.sick_leave_default_days,
      positionsText: parsed.positions,
      employeesText: parsed.employees,
    });
  } catch (error) {
    caughtError = error;
  }

  const durationMs = Date.now() - start;
  if (caughtError) {
    captureActionError("completeGuidedSetup", caughtError, {
      actor_user_id: actor?.authUserId ?? null,
      actor_tenant_id: actor?.tenantId ?? null,
    });
    logAction({
      action: "completeGuidedSetup",
      actorUserId: actor?.authUserId ?? null,
      actorTenantId: actor?.tenantId ?? null,
      durationMs,
      outcome: "fail",
      error: caughtError,
      requestId,
    });
    redirect(`/setup?error=${encodeURIComponent(getErrorCode(caughtError))}`);
  }

  logAction({
    action: "completeGuidedSetup",
    actorUserId: actor!.authUserId,
    actorTenantId: actor!.tenantId,
    durationMs,
    outcome: "ok",
    requestId,
  });
  redirect("/setup?status=completed");
}
