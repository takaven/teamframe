"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireTenantActor } from "@/middleware/rbac";
import { updateOwnProfile, upsertOwnPaymentDetails } from "@/services/selfServiceService";
import { setEmployeePhoto } from "@/services/employeeMasterService";
import { captureActionError } from "@/lib/telemetry/sentry";
import { logAction } from "@/lib/telemetry/logger";

function code(error: unknown): string {
  if (error instanceof z.ZodError) return "INVALID_INPUT";
  if (error instanceof Error) return error.message.match(/^[A-Z_]+/)?.[0] ?? "UNKNOWN";
  return "UNKNOWN";
}
function s(v: FormDataEntryValue | null): string { return typeof v === "string" ? v : ""; }

async function run(action: string, work: (actor: Awaited<ReturnType<typeof requireTenantActor>>) => Promise<void>, successStatus: string): Promise<void> {
  const start = Date.now();
  const requestId = crypto.randomUUID();
  let actor: Awaited<ReturnType<typeof requireTenantActor>> | null = null;
  let err: unknown = null;
  try {
    actor = await requireTenantActor();
    await work(actor);
  } catch (error) {
    err = error;
  }
  logAction({ action, actorUserId: actor?.authUserId ?? null, actorTenantId: actor?.tenantId ?? null, durationMs: Date.now() - start, outcome: err ? "fail" : "ok", error: err ?? undefined, requestId });
  if (err) {
    captureActionError(action, err, { actor_user_id: actor?.authUserId ?? null, actor_tenant_id: actor?.tenantId ?? null });
    redirect(`/me?error=${encodeURIComponent(code(err))}`);
  }
  redirect(`/me?status=${successStatus}`);
}

// The employee is ALWAYS derived from the authenticated actor inside the service —
// none of these actions read an employee id from the form.
export async function updateOwnProfileAction(formData: FormData): Promise<void> {
  await run("updateOwnProfile", (actor) => updateOwnProfile(actor, {
    preferred_name: s(formData.get("preferred_name")),
    date_of_birth: s(formData.get("date_of_birth")),
    gender: s(formData.get("gender")),
    nationality: s(formData.get("nationality")),
    personal_email: s(formData.get("personal_email")),
    mobile: s(formData.get("mobile")),
    residential_address: s(formData.get("residential_address")),
    emergency_contact_name: s(formData.get("emergency_contact_name")),
    emergency_contact_relationship: s(formData.get("emergency_contact_relationship")),
    emergency_contact_phone: s(formData.get("emergency_contact_phone")),
    emergency_contact_email: s(formData.get("emergency_contact_email")),
  }), "profile_updated");
}

export async function updateOwnPaymentAction(formData: FormData): Promise<void> {
  await run("updateOwnPayment", (actor) => upsertOwnPaymentDetails(actor, {
    account_holder_name: s(formData.get("account_holder_name")),
    bank_name: s(formData.get("bank_name")),
    account_number_iban: s(formData.get("account_number_iban")),
    routing_sort_branch_code: s(formData.get("routing_sort_branch_code")),
    swift_bic: s(formData.get("swift_bic")),
    account_currency: s(formData.get("account_currency")),
  }), "payment_updated");
}

export async function updateOwnPhotoAction(formData: FormData): Promise<void> {
  await run("updateOwnPhoto", async (actor) => {
    if (!actor.employeeId) throw new Error("NO_EMPLOYEE_RECORD");
    const file = formData.get("photo");
    if (!(file instanceof File) || file.size === 0) throw new Error("INVALID_INPUT");
    await setEmployeePhoto(actor, actor.employeeId, file); // own id from actor, not the form
  }, "photo_updated");
}
