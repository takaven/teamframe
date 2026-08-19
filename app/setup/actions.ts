"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireTenantActor } from "@/middleware/rbac";
import {
  createDepartment,
  renameDepartment,
  setDepartmentActive,
  createWorkLocation,
  updateWorkLocation,
  createLeaveDefinition,
  updateLeaveDefinition,
  updateCompanySettings,
  updateCompanyLogo,
  removeCompanyLogo,
  setCompensationMode,
  createCompensationComponent,
  renameCompensationComponent,
  setCompensationComponentActive,
} from "@/services/configurationService";
import { captureActionError } from "@/lib/telemetry/sentry";
import { logAction } from "@/lib/telemetry/logger";

function code(error: unknown): string {
  if (error instanceof z.ZodError) return "INVALID_INPUT";
  if (error instanceof Error) return error.message.match(/^[A-Z_]+/)?.[0] ?? "UNKNOWN";
  return "UNKNOWN";
}
function s(v: FormDataEntryValue | null): string { return typeof v === "string" ? v.trim() : ""; }
function optNum(v: FormDataEntryValue | null): number | null { const t = s(v); return t === "" ? null : Number(t); }

async function run(action: string, section: string, work: (actor: Awaited<ReturnType<typeof requireTenantActor>>) => Promise<void>): Promise<void> {
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
    redirect(`/setup?section=${section}&error=${encodeURIComponent(code(err))}`);
  }
  redirect(`/setup?section=${section}&status=saved`);
}

export async function saveCompanySettingsAction(formData: FormData): Promise<void> {
  await run("saveCompanySettings", "company", async (actor) => {
    const days = formData.getAll("working_day").map((d) => Number(d)).filter((n) => n >= 1 && n <= 7);
    await updateCompanySettings(actor, {
      name: s(formData.get("name")),
      country: s(formData.get("country")) || undefined,
      default_timezone: s(formData.get("timezone")),
      default_working_days: days.length > 0 ? days : [1, 2, 3, 4, 5],
      thirty_day_check_in_enabled: formData.get("thirty_day_check_in_enabled") === "on",
      employee_number_prefix: s(formData.get("employee_number_prefix")),
      employee_number_separator: typeof formData.get("employee_number_separator") === "string" ? (formData.get("employee_number_separator") as string) : "-",
      employee_number_digits: Number(s(formData.get("employee_number_digits")) || "4"),
    });
  });
}

export async function saveCompanyLogoAction(formData: FormData): Promise<void> {
  await run("saveCompanyLogo", "company", async (actor) => {
    const file = formData.get("logo");
    if (!(file instanceof File)) throw new Error("LOGO_EMPTY_FILE");
    await updateCompanyLogo(actor, file);
  });
}
export async function removeCompanyLogoAction(): Promise<void> {
  await run("removeCompanyLogo", "company", (actor) => removeCompanyLogo(actor));
}

export async function setCompensationModeAction(formData: FormData): Promise<void> {
  await run("setCompensationMode", "compensation", (actor) => setCompensationMode(actor, s(formData.get("mode"))));
}
export async function createCompensationComponentAction(formData: FormData): Promise<void> {
  await run("createCompensationComponent", "compensation", (actor) => createCompensationComponent(actor, s(formData.get("name"))));
}
export async function renameCompensationComponentAction(formData: FormData): Promise<void> {
  await run("renameCompensationComponent", "compensation", (actor) => renameCompensationComponent(actor, s(formData.get("id")), s(formData.get("name"))));
}
export async function toggleCompensationComponentAction(formData: FormData): Promise<void> {
  await run("toggleCompensationComponent", "compensation", (actor) => setCompensationComponentActive(actor, s(formData.get("id")), formData.get("active") === "true"));
}

export async function createDepartmentAction(formData: FormData): Promise<void> {
  await run("createDepartment", "departments", (actor) => createDepartment(actor, s(formData.get("name"))));
}
export async function renameDepartmentAction(formData: FormData): Promise<void> {
  await run("renameDepartment", "departments", (actor) => renameDepartment(actor, s(formData.get("id")), s(formData.get("name"))));
}
export async function toggleDepartmentAction(formData: FormData): Promise<void> {
  await run("toggleDepartment", "departments", (actor) => setDepartmentActive(actor, s(formData.get("id")), formData.get("active") === "true"));
}

export async function createWorkLocationAction(formData: FormData): Promise<void> {
  await run("createWorkLocation", "locations", (actor) => createWorkLocation(actor, s(formData.get("name")), s(formData.get("country"))));
}
export async function updateWorkLocationAction(formData: FormData): Promise<void> {
  await run("updateWorkLocation", "locations", (actor) => updateWorkLocation(actor, s(formData.get("id")), s(formData.get("name")), s(formData.get("country")), formData.get("active") === "on"));
}

export async function createLeaveDefinitionAction(formData: FormData): Promise<void> {
  await run("createLeaveDefinition", "leave", (actor) => createLeaveDefinition(actor, {
    display_name: s(formData.get("display_name")),
    system_leave_type: s(formData.get("system_leave_type")),
    active: formData.get("active") === "on",
    default_entitlement_days: optNum(formData.get("default_entitlement_days")),
    counting_basis: s(formData.get("counting_basis")),
    attachment_requirement: s(formData.get("attachment_requirement")),
  }));
}
export async function updateLeaveDefinitionAction(formData: FormData): Promise<void> {
  await run("updateLeaveDefinition", "leave", (actor) => updateLeaveDefinition(actor, s(formData.get("id")), {
    display_name: s(formData.get("display_name")),
    system_leave_type: s(formData.get("system_leave_type")),
    active: formData.get("active") === "on",
    default_entitlement_days: optNum(formData.get("default_entitlement_days")),
    counting_basis: s(formData.get("counting_basis")),
    attachment_requirement: s(formData.get("attachment_requirement")),
  }));
}
