"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireTenantActor } from "@/middleware/rbac";
import { UAE_RECORD_TYPE_VALUES } from "@/lib/countryRecords";
import {
  createEmployee,
  generateEmployeeActivationLink,
  reinviteEmployee,
  softDeleteEmployee,
  updateEmployee,
} from "@/services/employeeService";
import {
  cancelEmploymentChange,
  recordEmploymentChange,
} from "@/services/employmentChangeService";
import {
  cancelOffboarding,
  completeOffboardingItem,
  startOffboarding,
} from "@/services/offboardingService";
import {
  exportFinanceHandoffUrl,
  exportEmployeeDueDiligencePackUrl,
  getSignedDownloadUrl,
  createDocumentRequirement,
  reviewDocumentRequirement,
  softDeleteDocument,
  uploadDocument,
  uploadDocumentForRequirement,
} from "@/services/documentService";
import { setEmployeePhoto } from "@/services/employeeMasterService";
import { saveEmployeeCompensation } from "@/services/compensationService";
import { logAction } from "@/lib/telemetry/logger";
import { captureActionError } from "@/lib/telemetry/sentry";

const CreateInputSchema = z.object({
  full_name: z.string().trim().min(1),
  email: z.string().trim().toLowerCase().email(),
  role_title: z.string().trim().min(1),
  department: z.string().trim().min(1),
  timezone: z.string().trim().min(1),
  employment_type: z.enum(["full_time", "part_time", "contractor", "intern"]),
  country: z.string().trim().min(2),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const UpdateInputSchema = z.object({
  employee_id: z.string().uuid(),
  expected_updated_at: z.string().trim().min(1),
  role_title: z.string().trim().min(1),
  department: z.string().trim().min(1),
  employment_type: z.enum(["full_time", "part_time", "contractor", "intern"]),
  country: z.string().trim().min(2),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.enum(["active", "on_leave", "inactive"]),
  lifecycle_state: z.enum(["preboarding", "active", "on_leave", "offboarding", "exited"]).optional(),
});

const StartOffboardingInputSchema = z.object({
  employee_id: z.string().uuid(),
  effective_end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  expected_updated_at: z.string().trim().min(1),
  return_to: z.string().trim().optional(),
});

const CompleteOffboardingItemInputSchema = z.object({
  item_id: z.string().uuid(),
  expected_updated_at: z.string().trim().min(1),
  employee_id: z.string().uuid(),
  return_to: z.string().trim().optional(),
});

const CancelOffboardingInputSchema = z.object({
  case_id: z.string().uuid(),
  employee_id: z.string().uuid(),
  return_to: z.string().trim().optional(),
});

const ArchiveInputSchema = z.object({
  employee_id: z.string().uuid(),
  expected_updated_at: z.string().trim().min(1),
  return_to: z.string().trim().optional(),
});

const ReinviteInputSchema = z.object({
  employee_id: z.string().uuid(),
  return_to: z.string().trim().optional(),
});

const ActivationLinkInputSchema = z.object({
  employee_id: z.string().uuid(),
  return_to: z.string().trim().optional(),
});

const UploadDocumentInputSchema = z.object({
  employee_id: z.string().uuid(),
  type: z.enum(["cv", "contract", "jd", "photo"]),
  signed_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  expires_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  return_to: z.string().trim().optional(),
});

const CreateDocumentRequirementInputSchema = z.object({
  employee_id: z.string().uuid(),
  document_type: z.string().trim().min(1).max(80),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  expiry_required: z.enum(["on"]).optional(),
  review_required: z.enum(["on"]).optional(),
  employee_upload_allowed: z.enum(["on"]).optional(),
  return_to: z.string().trim().optional(),
});

const UaeRecordUploadSchema = z.object({
  employee_id: z.string().uuid(),
  type: z.enum(UAE_RECORD_TYPE_VALUES as [string, ...string[]]),
  issued_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  expires_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  reference_number: z.string().trim().min(1).max(120).optional(),
  return_to: z.string().trim().optional(),
});

const UploadRequirementDocumentInputSchema = z.object({
  requirement_id: z.string().uuid(),
  expires_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  return_to: z.string().trim().optional(),
});

const ReviewDocumentRequirementInputSchema = z.object({
  requirement_id: z.string().uuid(),
  decision: z.enum(["accepted", "rejected"]),
  return_to: z.string().trim().optional(),
});

const DownloadDocumentInputSchema = z.object({
  document_id: z.string().uuid(),
  return_to: z.string().trim().optional(),
});

const DeleteDocumentInputSchema = z.object({
  document_id: z.string().uuid(),
  employee_id: z.string().uuid(),
  return_to: z.string().trim().optional(),
});

const ExportDueDiligencePackInputSchema = z.object({
  employee_id: z.string().uuid(),
  return_to: z.string().trim().optional(),
});

const ExportFinanceHandoffInputSchema = z.object({
  return_to: z.string().trim().optional(),
});

const RecordEmploymentChangeInputSchema = z.object({
  employee_id: z.string().uuid(),
  effective_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  role_title: z.string().trim().optional(),
  department: z.string().trim().optional(),
  employment_type: z.enum(["", "full_time", "part_time", "contractor", "intern"]).optional(),
  country: z.string().trim().optional(),
  manager_id: z.string().uuid().or(z.literal("")).optional(),
  position_id: z.string().uuid().or(z.literal("")).optional(),
  return_to: z.string().trim().optional(),
});

const CancelEmploymentChangeInputSchema = z.object({
  employee_id: z.string().uuid(),
  change_id: z.string().uuid(),
  return_to: z.string().trim().optional(),
});

function safeReturnPath(path: string | undefined, fallback: string): string {
  if (!path || !path.startsWith("/") || path.startsWith("//")) {
    return fallback;
  }
  return path;
}

function optionalString(value: FormDataEntryValue | null): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function getErrorCode(error: unknown): string {
  if (error instanceof z.ZodError) return "INVALID_INPUT";
  if (error instanceof Error) {
    const message = error.message;
    const match = message.match(/^[A-Z_]+/);
    return match ? match[0] : "UNKNOWN";
  }
  return "UNKNOWN";
}

export async function createEmployeeAction(formData: FormData): Promise<void> {
  let failed = false;
  let errorCode = "UNKNOWN";

  // Observability instrumentation (Phase 1C).
  const start = Date.now();
  const requestId = crypto.randomUUID();
  let actor: Awaited<ReturnType<typeof requireTenantActor>> | null = null;
  let caughtError: unknown = null;

  try {
    actor = await requireTenantActor();
    const parsed = CreateInputSchema.parse({
      full_name: formData.get("full_name"),
      email: formData.get("email"),
      role_title: formData.get("role_title"),
      department: formData.get("department"),
      timezone: formData.get("timezone"),
      employment_type: formData.get("employment_type"),
      country: formData.get("country"),
      start_date: formData.get("start_date"),
      end_date: optionalString(formData.get("end_date")),
    });

    await createEmployee(actor, parsed);
  } catch (error) {
    failed = true;
    errorCode = getErrorCode(error);
    caughtError = error;
  }

  const durationMs = Date.now() - start;
  if (caughtError !== null) {
    captureActionError("createEmployee", caughtError, {
      actor_user_id: actor?.authUserId ?? null,
      actor_tenant_id: actor?.tenantId ?? null,
    });
    logAction({
      action: "createEmployee",
      actorUserId: actor?.authUserId ?? null,
      actorTenantId: actor?.tenantId ?? null,
      durationMs,
      outcome: "fail",
      error: caughtError,
      requestId,
    });
  } else {
    logAction({
      action: "createEmployee",
      actorUserId: actor!.authUserId,
      actorTenantId: actor!.tenantId,
      durationMs,
      outcome: "ok",
      requestId,
    });
  }

  if (failed) {
    redirect(`/employees?error=${encodeURIComponent(errorCode)}`);
  }

  redirect("/employees?status=created");
}

export async function updateEmployeeAction(formData: FormData): Promise<void> {
  let failed = false;
  let errorCode = "UNKNOWN";

  // Observability instrumentation (Phase 1B).
  const start = Date.now();
  const requestId = crypto.randomUUID();
  let actor: Awaited<ReturnType<typeof requireTenantActor>> | null = null;
  let caughtError: unknown = null;

  try {
    actor = await requireTenantActor();
    const parsed = UpdateInputSchema.parse({
      employee_id: formData.get("employee_id"),
      expected_updated_at: formData.get("expected_updated_at"),
      role_title: formData.get("role_title"),
      department: formData.get("department"),
      employment_type: formData.get("employment_type"),
      country: formData.get("country"),
      start_date: formData.get("start_date"),
      end_date: optionalString(formData.get("end_date")),
      status: formData.get("status"),
    });

    await updateEmployee(
      actor,
      parsed.employee_id,
      {
        role_title: parsed.role_title,
        department: parsed.department,
        employment_type: parsed.employment_type,
        country: parsed.country,
        start_date: parsed.start_date,
        end_date: parsed.end_date ?? null,
        status: parsed.status,
      },
      parsed.expected_updated_at,
    );
  } catch (error) {
    failed = true;
    errorCode = getErrorCode(error);
    caughtError = error;
  }

  const durationMs = Date.now() - start;
  if (caughtError !== null) {
    captureActionError("updateEmployee", caughtError, {
      actor_user_id: actor?.authUserId ?? null,
      actor_tenant_id: actor?.tenantId ?? null,
    });
    logAction({
      action: "updateEmployee",
      actorUserId: actor?.authUserId ?? null,
      actorTenantId: actor?.tenantId ?? null,
      durationMs,
      outcome: "fail",
      error: caughtError,
      requestId,
    });
  } else {
    logAction({
      action: "updateEmployee",
      actorUserId: actor!.authUserId,
      actorTenantId: actor!.tenantId,
      durationMs,
      outcome: "ok",
      requestId,
    });
  }

  if (failed) {
    redirect(`/employees?error=${encodeURIComponent(errorCode)}`);
  }

  redirect("/employees?status=updated");
}

export async function saveCompensationAction(formData: FormData): Promise<void> {
  const start = Date.now();
  const requestId = crypto.randomUUID();
  let actor: Awaited<ReturnType<typeof requireTenantActor>> | null = null;
  let caughtError: unknown = null;
  const employeeId = typeof formData.get("employee_id") === "string" ? (formData.get("employee_id") as string) : "";

  try {
    actor = await requireTenantActor();
    const num = (v: FormDataEntryValue | null): number | undefined => {
      const t = typeof v === "string" ? v.trim() : "";
      if (t === "") return undefined;
      const n = Number(t);
      return Number.isFinite(n) ? n : undefined;
    };
    // Dynamic per-component amounts arrive as component_<uuid> fields.
    const componentAmounts: Record<string, number> = {};
    for (const [key, value] of formData.entries()) {
      if (key.startsWith("component_") && typeof value === "string") {
        const id = key.slice("component_".length);
        const n = num(value);
        if (n !== undefined) componentAmounts[id] = n;
      }
    }
    await saveEmployeeCompensation(actor, employeeId, {
      currency: formData.get("currency"),
      pay_basis: formData.get("pay_basis"),
      effective_date: formData.get("effective_date"),
      note: optionalString(formData.get("note")),
      total_amount: num(formData.get("total_amount")),
      component_amounts: Object.keys(componentAmounts).length > 0 ? componentAmounts : undefined,
    });
  } catch (error) {
    caughtError = error;
  }

  const durationMs = Date.now() - start;
  logAction({
    action: "saveCompensation",
    actorUserId: actor?.authUserId ?? null,
    actorTenantId: actor?.tenantId ?? null,
    durationMs,
    outcome: caughtError ? "fail" : "ok",
    error: caughtError ?? undefined,
    requestId,
  });
  if (caughtError !== null) {
    captureActionError("saveCompensation", caughtError, { actor_user_id: actor?.authUserId ?? null, actor_tenant_id: actor?.tenantId ?? null });
    redirect(`/employees?employee=${employeeId}&error=${encodeURIComponent(getErrorCode(caughtError))}#employee-${employeeId}`);
  }
  redirect(`/employees?employee=${employeeId}&status=compensation_saved#employee-${employeeId}`);
}

export async function archiveEmployeeAction(formData: FormData): Promise<void> {
  let failed = false;
  let errorCode = "UNKNOWN";
  let employeeId = "";
  let returnTo = "/employees";

  // Observability instrumentation (Phase 1C).
  const start = Date.now();
  const requestId = crypto.randomUUID();
  let actor: Awaited<ReturnType<typeof requireTenantActor>> | null = null;
  let caughtError: unknown = null;

  try {
    actor = await requireTenantActor();
    const parsed = ArchiveInputSchema.parse({
      employee_id: formData.get("employee_id"),
      effective_end_date: formData.get("effective_end_date"),
      expected_updated_at: formData.get("expected_updated_at"),
      return_to: optionalString(formData.get("return_to")),
    });
    employeeId = parsed.employee_id;
    returnTo = safeReturnPath(parsed.return_to, "/employees");

    await softDeleteEmployee(actor, parsed.employee_id, parsed.expected_updated_at);
  } catch (error) {
    failed = true;
    errorCode = getErrorCode(error);
    caughtError = error;
  }

  const durationMs = Date.now() - start;
  if (caughtError !== null) {
    captureActionError("archiveEmployee", caughtError, {
      actor_user_id: actor?.authUserId ?? null,
      actor_tenant_id: actor?.tenantId ?? null,
      employee_id: employeeId || null,
    });
    logAction({
      action: "archiveEmployee",
      actorUserId: actor?.authUserId ?? null,
      actorTenantId: actor?.tenantId ?? null,
      durationMs,
      outcome: "fail",
      error: caughtError,
      requestId,
    });
  } else {
    logAction({
      action: "archiveEmployee",
      actorUserId: actor!.authUserId,
      actorTenantId: actor!.tenantId,
      durationMs,
      outcome: "ok",
      requestId,
    });
  }

  if (failed) {
    redirect(`${returnTo}?error=${encodeURIComponent(errorCode)}&employee=${encodeURIComponent(employeeId)}`);
  }

  redirect(`${returnTo}?status=archived&employee=${encodeURIComponent(employeeId)}`);
}

export async function startOffboardingAction(formData: FormData): Promise<void> {
  let failed = false;
  let errorCode = "UNKNOWN";
  let employeeId = "";
  let returnTo = "/employees";

  const start = Date.now();
  const requestId = crypto.randomUUID();
  let actor: Awaited<ReturnType<typeof requireTenantActor>> | null = null;
  let caughtError: unknown = null;

  try {
    actor = await requireTenantActor();
    const parsed = StartOffboardingInputSchema.parse({
      employee_id: formData.get("employee_id"),
      expected_updated_at: formData.get("expected_updated_at"),
      return_to: optionalString(formData.get("return_to")),
    });

    employeeId = parsed.employee_id;
    returnTo = safeReturnPath(parsed.return_to, "/employees");

    await startOffboarding(actor, {
      employeeId: parsed.employee_id,
      effectiveEndDate: parsed.effective_end_date,
      expectedUpdatedAt: parsed.expected_updated_at,
    });
  } catch (error) {
    failed = true;
    errorCode = getErrorCode(error);
    caughtError = error;
  }

  const durationMs = Date.now() - start;
  if (caughtError !== null) {
    captureActionError("startOffboarding", caughtError, {
      actor_user_id: actor?.authUserId ?? null,
      actor_tenant_id: actor?.tenantId ?? null,
      employee_id: employeeId || null,
    });
    logAction({
      action: "startOffboarding",
      actorUserId: actor?.authUserId ?? null,
      actorTenantId: actor?.tenantId ?? null,
      durationMs,
      outcome: "fail",
      error: caughtError,
      requestId,
    });
  } else {
    logAction({
      action: "startOffboarding",
      actorUserId: actor!.authUserId,
      actorTenantId: actor!.tenantId,
      durationMs,
      outcome: "ok",
      requestId,
    });
  }

  if (failed) {
    redirect(`${returnTo}?error=${encodeURIComponent(errorCode)}&employee=${encodeURIComponent(employeeId)}`);
  }

  redirect(`${returnTo}?status=offboarding_started&employee=${encodeURIComponent(employeeId)}`);
}

export async function completeOffboardingItemAction(formData: FormData): Promise<void> {
  let failed = false;
  let errorCode = "UNKNOWN";
  let employeeId = "";
  let returnTo = "/employees";

  try {
    const actor = await requireTenantActor();
    const parsed = CompleteOffboardingItemInputSchema.parse({
      item_id: formData.get("item_id"),
      expected_updated_at: formData.get("expected_updated_at"),
      employee_id: formData.get("employee_id"),
      return_to: optionalString(formData.get("return_to")),
    });
    employeeId = parsed.employee_id;
    returnTo = safeReturnPath(parsed.return_to, "/employees");

    await completeOffboardingItem(actor, parsed.item_id, parsed.expected_updated_at);
  } catch (error) {
    failed = true;
    errorCode = getErrorCode(error);
  }

  if (failed) {
    redirect(`${returnTo}?error=${encodeURIComponent(errorCode)}&employee=${encodeURIComponent(employeeId)}`);
  }

  redirect(`${returnTo}?status=offboarding_item_completed&employee=${encodeURIComponent(employeeId)}`);
}

export async function cancelOffboardingAction(formData: FormData): Promise<void> {
  let failed = false;
  let errorCode = "UNKNOWN";
  let employeeId = "";
  let returnTo = "/employees";

  try {
    const actor = await requireTenantActor();
    const parsed = CancelOffboardingInputSchema.parse({
      case_id: formData.get("case_id"),
      employee_id: formData.get("employee_id"),
      return_to: optionalString(formData.get("return_to")),
    });
    employeeId = parsed.employee_id;
    returnTo = safeReturnPath(parsed.return_to, "/employees");

    await cancelOffboarding(actor, parsed.case_id);
  } catch (error) {
    failed = true;
    errorCode = getErrorCode(error);
  }

  if (failed) {
    redirect(`${returnTo}?error=${encodeURIComponent(errorCode)}&employee=${encodeURIComponent(employeeId)}`);
  }

  redirect(`${returnTo}?status=offboarding_cancelled&employee=${encodeURIComponent(employeeId)}`);
}

export async function reinviteEmployeeAction(formData: FormData): Promise<void> {
  let failed = false;
  let errorCode = "UNKNOWN";
  let employeeId = "";
  let returnTo = "/employees";

  // Observability instrumentation (Phase 1C).
  const start = Date.now();
  const requestId = crypto.randomUUID();
  let actor: Awaited<ReturnType<typeof requireTenantActor>> | null = null;
  let caughtError: unknown = null;

  try {
    actor = await requireTenantActor();
    const parsed = ReinviteInputSchema.parse({
      employee_id: formData.get("employee_id"),
      return_to: optionalString(formData.get("return_to")),
    });
    employeeId = parsed.employee_id;
    returnTo = safeReturnPath(parsed.return_to, "/employees");

    await reinviteEmployee(actor, parsed.employee_id);
  } catch (error) {
    failed = true;
    errorCode = getErrorCode(error);
    caughtError = error;
  }

  const durationMs = Date.now() - start;
  if (caughtError !== null) {
    captureActionError("reinviteEmployee", caughtError, {
      actor_user_id: actor?.authUserId ?? null,
      actor_tenant_id: actor?.tenantId ?? null,
      employee_id: employeeId || null,
    });
    logAction({
      action: "reinviteEmployee",
      actorUserId: actor?.authUserId ?? null,
      actorTenantId: actor?.tenantId ?? null,
      durationMs,
      outcome: "fail",
      error: caughtError,
      requestId,
    });
  } else {
    logAction({
      action: "reinviteEmployee",
      actorUserId: actor!.authUserId,
      actorTenantId: actor!.tenantId,
      durationMs,
      outcome: "ok",
      requestId,
    });
  }

  if (failed) {
    redirect(`${returnTo}?error=${encodeURIComponent(errorCode)}&employee=${encodeURIComponent(employeeId)}`);
  }

  redirect(`${returnTo}?status=reinvited&employee=${encodeURIComponent(employeeId)}`);
}

export async function generateActivationLinkAction(formData: FormData): Promise<void> {
  let failed = false;
  let errorCode = "UNKNOWN";
  let employeeId = "";
  let returnTo = "/employees";
  let activationLink = "";

  // Observability instrumentation (Phase 1C).
  const start = Date.now();
  const requestId = crypto.randomUUID();
  let actor: Awaited<ReturnType<typeof requireTenantActor>> | null = null;
  let caughtError: unknown = null;

  try {
    actor = await requireTenantActor();
    const parsed = ActivationLinkInputSchema.parse({
      employee_id: formData.get("employee_id"),
      return_to: optionalString(formData.get("return_to")),
    });
    employeeId = parsed.employee_id;
    returnTo = safeReturnPath(parsed.return_to, "/employees");

    const result = await generateEmployeeActivationLink(actor, parsed.employee_id);
    activationLink = result.activationLink;
  } catch (error) {
    failed = true;
    errorCode = getErrorCode(error);
    caughtError = error;
  }

  const durationMs = Date.now() - start;
  if (caughtError !== null) {
    captureActionError("generateActivationLink", caughtError, {
      actor_user_id: actor?.authUserId ?? null,
      actor_tenant_id: actor?.tenantId ?? null,
      employee_id: employeeId || null,
    });
    logAction({
      action: "generateActivationLink",
      actorUserId: actor?.authUserId ?? null,
      actorTenantId: actor?.tenantId ?? null,
      durationMs,
      outcome: "fail",
      error: caughtError,
      requestId,
    });
  } else {
    logAction({
      action: "generateActivationLink",
      actorUserId: actor!.authUserId,
      actorTenantId: actor!.tenantId,
      durationMs,
      outcome: "ok",
      requestId,
    });
  }

  if (failed) {
    redirect(`${returnTo}?error=${encodeURIComponent(errorCode)}&employee=${encodeURIComponent(employeeId)}`);
  }

  redirect(
    `${returnTo}?status=activation_link_ready&employee=${encodeURIComponent(employeeId)}&activation_link=${encodeURIComponent(activationLink)}`,
  );
}

export async function uploadEmployeeDocumentAction(formData: FormData): Promise<void> {
  let failed = false;
  let errorCode = "UNKNOWN";
  let employeeId = "";
  let returnTo = "/employees";

  const start = Date.now();
  const requestId = crypto.randomUUID();
  let actor: Awaited<ReturnType<typeof requireTenantActor>> | null = null;
  let caughtError: unknown = null;

  try {
    actor = await requireTenantActor();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      throw new Error("INVALID_INPUT");
    }

    const parsed = UploadDocumentInputSchema.parse({
      employee_id: formData.get("employee_id"),
      type: formData.get("type"),
      signed_at: optionalString(formData.get("signed_at")),
      expires_at: optionalString(formData.get("expires_at")),
      return_to: optionalString(formData.get("return_to")),
    });

    employeeId = parsed.employee_id;
    returnTo = safeReturnPath(parsed.return_to, "/employees");

    await uploadDocument(actor, {
      employeeId: parsed.employee_id,
      type: parsed.type,
      file,
      signedAt: parsed.signed_at ?? null,
      expiresAt: parsed.expires_at ?? null,
    });
  } catch (error) {
    failed = true;
    errorCode = getErrorCode(error);
    caughtError = error;
  }

  const durationMs = Date.now() - start;
  if (caughtError !== null) {
    captureActionError("uploadEmployeeDocument", caughtError, {
      actor_user_id: actor?.authUserId ?? null,
      actor_tenant_id: actor?.tenantId ?? null,
      employee_id: employeeId || null,
    });
    logAction({
      action: "uploadEmployeeDocument",
      actorUserId: actor?.authUserId ?? null,
      actorTenantId: actor?.tenantId ?? null,
      durationMs,
      outcome: "fail",
      error: caughtError,
      requestId,
    });
  } else {
    logAction({
      action: "uploadEmployeeDocument",
      actorUserId: actor!.authUserId,
      actorTenantId: actor!.tenantId,
      durationMs,
      outcome: "ok",
      requestId,
    });
  }

  if (failed) {
    redirect(`${returnTo}?error=${encodeURIComponent(errorCode)}&employee=${encodeURIComponent(employeeId)}`);
  }

  redirect(`${returnTo}?status=document_uploaded&employee=${encodeURIComponent(employeeId)}`);
}

// Phase 5E: upload a country-specific (UAE) record — a specialised document with factual metadata
// (issue date, expiry, reference number). Reuses uploadDocument; the reference number is stored as
// employer-controlled PII behind the same private-document gate. Country gating is enforced in the
// admin UI (the section only appears for AE work-country employees); this action additionally
// restricts the type to the bounded UAE vocabulary.
export async function uploadUaeRecordAction(formData: FormData): Promise<void> {
  let failed = false;
  let errorCode = "UNKNOWN";
  let employeeId = "";
  let returnTo = "/employees";
  let actor: Awaited<ReturnType<typeof requireTenantActor>> | null = null;

  try {
    actor = await requireTenantActor();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) throw new Error("INVALID_INPUT");

    const parsed = UaeRecordUploadSchema.parse({
      employee_id: formData.get("employee_id"),
      type: formData.get("type"),
      issued_at: optionalString(formData.get("issued_at")),
      expires_at: optionalString(formData.get("expires_at")),
      reference_number: optionalString(formData.get("reference_number")),
      return_to: optionalString(formData.get("return_to")),
    });
    employeeId = parsed.employee_id;
    returnTo = safeReturnPath(parsed.return_to, "/employees");

    await uploadDocument(
      actor,
      {
        employeeId: parsed.employee_id,
        type: parsed.type,
        file,
        issuedAt: parsed.issued_at ?? null,
        expiresAt: parsed.expires_at ?? null,
        referenceNumber: parsed.reference_number ?? null,
      },
      { auditActionType: "document.uploaded" },
    );
  } catch (error) {
    failed = true;
    errorCode = getErrorCode(error);
    captureActionError("uploadUaeRecord", error, {
      actor_user_id: actor?.authUserId ?? null,
      actor_tenant_id: actor?.tenantId ?? null,
      employee_id: employeeId || null,
    });
  }

  if (failed) {
    redirect(`${returnTo}?error=${encodeURIComponent(errorCode)}&employee=${encodeURIComponent(employeeId)}`);
  }
  redirect(`${returnTo}?status=document_uploaded&employee=${encodeURIComponent(employeeId)}`);
}

export async function updateEmployeePhotoAction(formData: FormData): Promise<void> {
  const start = Date.now();
  const requestId = crypto.randomUUID();
  let actor: Awaited<ReturnType<typeof requireTenantActor>> | null = null;
  let caughtError: unknown = null;
  let employeeId = "";

  try {
    actor = await requireTenantActor();
    employeeId = String(formData.get("employee_id") ?? "");
    const file = formData.get("photo");
    if (!(file instanceof File) || file.size === 0) throw new Error("INVALID_INPUT");
    await setEmployeePhoto(actor, employeeId, file);
  } catch (error) {
    caughtError = error;
  }

  const durationMs = Date.now() - start;
  logAction({
    action: "updateEmployeePhoto",
    actorUserId: actor?.authUserId ?? null,
    actorTenantId: actor?.tenantId ?? null,
    durationMs,
    outcome: caughtError ? "fail" : "ok",
    error: caughtError ?? undefined,
    requestId,
  });
  if (caughtError) {
    captureActionError("updateEmployeePhoto", caughtError, {
      actor_user_id: actor?.authUserId ?? null,
      actor_tenant_id: actor?.tenantId ?? null,
      employee_id: employeeId || null,
    });
    redirect(`/employees?error=${encodeURIComponent(getErrorCode(caughtError))}&employee=${encodeURIComponent(employeeId)}`);
  }
  redirect(`/employees?status=photo_updated&employee=${encodeURIComponent(employeeId)}`);
}

export async function createDocumentRequirementAction(formData: FormData): Promise<void> {
  let failed = false;
  let errorCode = "UNKNOWN";
  let employeeId = "";
  let returnTo = "/employees";

  try {
    const actor = await requireTenantActor();
    const parsed = CreateDocumentRequirementInputSchema.parse({
      employee_id: formData.get("employee_id"),
      document_type: formData.get("document_type"),
      due_date: optionalString(formData.get("due_date")),
      expiry_required: formData.get("expiry_required"),
      review_required: formData.get("review_required"),
      employee_upload_allowed: formData.get("employee_upload_allowed"),
      return_to: optionalString(formData.get("return_to")),
    });
    employeeId = parsed.employee_id;
    returnTo = safeReturnPath(parsed.return_to, "/employees");

    await createDocumentRequirement(actor, {
      employeeId: parsed.employee_id,
      documentType: parsed.document_type,
      dueDate: parsed.due_date ?? null,
      expiryRequired: parsed.expiry_required === "on",
      reviewRequired: parsed.review_required === "on",
      employeeUploadAllowed: parsed.employee_upload_allowed !== undefined,
    });
  } catch (error) {
    failed = true;
    errorCode = getErrorCode(error);
  }

  if (failed) {
    redirect(`${returnTo}?error=${encodeURIComponent(errorCode)}&employee=${encodeURIComponent(employeeId)}`);
  }
  redirect(`${returnTo}?status=document_requested&employee=${encodeURIComponent(employeeId)}`);
}

export async function uploadRequirementDocumentAction(formData: FormData): Promise<void> {
  let failed = false;
  let errorCode = "UNKNOWN";
  let returnTo = "/me";

  try {
    const actor = await requireTenantActor();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) throw new Error("INVALID_INPUT");
    const parsed = UploadRequirementDocumentInputSchema.parse({
      requirement_id: formData.get("requirement_id"),
      expires_at: optionalString(formData.get("expires_at")),
      return_to: optionalString(formData.get("return_to")),
    });
    returnTo = safeReturnPath(parsed.return_to, "/me");

    await uploadDocumentForRequirement(actor, {
      requirementId: parsed.requirement_id,
      file,
      expiresAt: parsed.expires_at ?? null,
    });
  } catch (error) {
    failed = true;
    errorCode = getErrorCode(error);
  }

  if (failed) redirect(`${returnTo}?error=${encodeURIComponent(errorCode)}`);
  redirect(`${returnTo}?status=document_uploaded`);
}

export async function reviewDocumentRequirementAction(formData: FormData): Promise<void> {
  let failed = false;
  let errorCode = "UNKNOWN";
  let returnTo = "/employees";

  try {
    const actor = await requireTenantActor();
    const parsed = ReviewDocumentRequirementInputSchema.parse({
      requirement_id: formData.get("requirement_id"),
      decision: formData.get("decision"),
      return_to: optionalString(formData.get("return_to")),
    });
    returnTo = safeReturnPath(parsed.return_to, "/employees");
    await reviewDocumentRequirement(actor, {
      requirementId: parsed.requirement_id,
      decision: parsed.decision,
    });
  } catch (error) {
    failed = true;
    errorCode = getErrorCode(error);
  }

  if (failed) redirect(`${returnTo}?error=${encodeURIComponent(errorCode)}`);
  redirect(`${returnTo}?status=document_reviewed`);
}

export async function downloadEmployeeDocumentAction(formData: FormData): Promise<void> {
  let failed = false;
  let errorCode = "UNKNOWN";
  let returnTo = "/employees";
  let documentId = "";
  let signedUrl = "";

  try {
    const actor = await requireTenantActor();
    const parsed = DownloadDocumentInputSchema.parse({
      document_id: formData.get("document_id"),
      return_to: optionalString(formData.get("return_to")),
    });
    documentId = parsed.document_id;
    returnTo = safeReturnPath(parsed.return_to, "/employees");
    signedUrl = await getSignedDownloadUrl(actor, parsed.document_id);
  } catch (error) {
    failed = true;
    errorCode = getErrorCode(error);
  }

  if (failed) {
    redirect(`${returnTo}?error=${encodeURIComponent(errorCode)}&document=${encodeURIComponent(documentId)}`);
  }

  redirect(signedUrl);
}

export async function deleteEmployeeDocumentAction(formData: FormData): Promise<void> {
  let failed = false;
  let errorCode = "UNKNOWN";
  let employeeId = "";
  let returnTo = "/employees";

  const start = Date.now();
  const requestId = crypto.randomUUID();
  let actor: Awaited<ReturnType<typeof requireTenantActor>> | null = null;
  let caughtError: unknown = null;

  try {
    actor = await requireTenantActor();
    const parsed = DeleteDocumentInputSchema.parse({
      document_id: formData.get("document_id"),
      employee_id: formData.get("employee_id"),
      return_to: optionalString(formData.get("return_to")),
    });
    employeeId = parsed.employee_id;
    returnTo = safeReturnPath(parsed.return_to, "/employees");

    await softDeleteDocument(actor, parsed.document_id);
  } catch (error) {
    failed = true;
    errorCode = getErrorCode(error);
    caughtError = error;
  }

  const durationMs = Date.now() - start;
  if (caughtError !== null) {
    captureActionError("deleteEmployeeDocument", caughtError, {
      actor_user_id: actor?.authUserId ?? null,
      actor_tenant_id: actor?.tenantId ?? null,
      employee_id: employeeId || null,
    });
    logAction({
      action: "deleteEmployeeDocument",
      actorUserId: actor?.authUserId ?? null,
      actorTenantId: actor?.tenantId ?? null,
      durationMs,
      outcome: "fail",
      error: caughtError,
      requestId,
    });
  } else {
    logAction({
      action: "deleteEmployeeDocument",
      actorUserId: actor!.authUserId,
      actorTenantId: actor!.tenantId,
      durationMs,
      outcome: "ok",
      requestId,
    });
  }

  if (failed) {
    redirect(`${returnTo}?error=${encodeURIComponent(errorCode)}&employee=${encodeURIComponent(employeeId)}`);
  }

  redirect(`${returnTo}?status=document_deleted&employee=${encodeURIComponent(employeeId)}`);
}

export async function exportEmployeeDueDiligencePackAction(formData: FormData): Promise<void> {
  let failed = false;
  let errorCode = "UNKNOWN";
  let employeeId = "";
  let returnTo = "/employees";
  let signedUrl = "";

  try {
    const actor = await requireTenantActor();
    const parsed = ExportDueDiligencePackInputSchema.parse({
      employee_id: formData.get("employee_id"),
      return_to: optionalString(formData.get("return_to")),
    });
    employeeId = parsed.employee_id;
    returnTo = safeReturnPath(parsed.return_to, "/employees");
    signedUrl = await exportEmployeeDueDiligencePackUrl(actor, parsed.employee_id);
  } catch (error) {
    failed = true;
    errorCode = getErrorCode(error);
  }

  if (failed) {
    redirect(`${returnTo}?error=${encodeURIComponent(errorCode)}&employee=${encodeURIComponent(employeeId)}`);
  }

  redirect(signedUrl);
}

export async function exportFinanceHandoffAction(formData: FormData): Promise<void> {
  let failed = false;
  let errorCode = "UNKNOWN";
  let returnTo = "/employees";
  let signedUrl = "";

  try {
    const actor = await requireTenantActor();
    const parsed = ExportFinanceHandoffInputSchema.parse({
      return_to: optionalString(formData.get("return_to")),
    });
    returnTo = safeReturnPath(parsed.return_to, "/employees");
    signedUrl = await exportFinanceHandoffUrl(actor);
  } catch (error) {
    failed = true;
    errorCode = getErrorCode(error);
  }

  if (failed) {
    redirect(`${returnTo}?error=${encodeURIComponent(errorCode)}`);
  }

  redirect(signedUrl);
}

export async function recordEmploymentChangeAction(formData: FormData): Promise<void> {
  let failed = false;
  let errorCode = "UNKNOWN";
  let employeeId = "";
  let returnTo = "/employees";

  const start = Date.now();
  const requestId = crypto.randomUUID();
  let actor: Awaited<ReturnType<typeof requireTenantActor>> | null = null;
  let caughtError: unknown = null;

  try {
    actor = await requireTenantActor();
    const parsed = RecordEmploymentChangeInputSchema.parse({
      employee_id: formData.get("employee_id"),
      effective_date: formData.get("effective_date"),
      role_title: optionalString(formData.get("role_title")) ?? "",
      department: optionalString(formData.get("department")) ?? "",
      employment_type: optionalString(formData.get("employment_type")) ?? "",
      country: optionalString(formData.get("country")) ?? "",
      manager_id: optionalString(formData.get("manager_id")) ?? "",
      position_id: optionalString(formData.get("position_id")) ?? "",
      return_to: optionalString(formData.get("return_to")),
    });
    employeeId = parsed.employee_id;
    returnTo = safeReturnPath(parsed.return_to, "/employees");

    const patch = Object.fromEntries(
      Object.entries({
        role_title: parsed.role_title || undefined,
        department: parsed.department || undefined,
        employment_type: parsed.employment_type || undefined,
        country: parsed.country || undefined,
        manager_id: parsed.manager_id || undefined,
        position_id: parsed.position_id || undefined,
      }).filter(([, value]) => value !== undefined),
    );

    await recordEmploymentChange(actor, {
      employeeId: parsed.employee_id,
      effectiveDate: parsed.effective_date,
      patch,
    });
  } catch (error) {
    failed = true;
    errorCode = getErrorCode(error);
    caughtError = error;
  }

  const durationMs = Date.now() - start;
  if (caughtError !== null) {
    captureActionError("recordEmploymentChange", caughtError, {
      actor_user_id: actor?.authUserId ?? null,
      actor_tenant_id: actor?.tenantId ?? null,
      employee_id: employeeId || null,
    });
    logAction({
      action: "recordEmploymentChange",
      actorUserId: actor?.authUserId ?? null,
      actorTenantId: actor?.tenantId ?? null,
      durationMs,
      outcome: "fail",
      error: caughtError,
      requestId,
    });
  } else {
    logAction({
      action: "recordEmploymentChange",
      actorUserId: actor!.authUserId,
      actorTenantId: actor!.tenantId,
      durationMs,
      outcome: "ok",
      requestId,
    });
  }

  if (failed) {
    redirect(`${returnTo}?error=${encodeURIComponent(errorCode)}&employee=${encodeURIComponent(employeeId)}`);
  }

  redirect(`${returnTo}?status=employment_change_recorded&employee=${encodeURIComponent(employeeId)}`);
}

export async function cancelEmploymentChangeAction(formData: FormData): Promise<void> {
  let failed = false;
  let errorCode = "UNKNOWN";
  let employeeId = "";
  let returnTo = "/employees";

  const start = Date.now();
  const requestId = crypto.randomUUID();
  let actor: Awaited<ReturnType<typeof requireTenantActor>> | null = null;
  let caughtError: unknown = null;

  try {
    actor = await requireTenantActor();
    const parsed = CancelEmploymentChangeInputSchema.parse({
      employee_id: formData.get("employee_id"),
      change_id: formData.get("change_id"),
      return_to: optionalString(formData.get("return_to")),
    });
    employeeId = parsed.employee_id;
    returnTo = safeReturnPath(parsed.return_to, "/employees");

    await cancelEmploymentChange(actor, parsed.change_id);
  } catch (error) {
    failed = true;
    errorCode = getErrorCode(error);
    caughtError = error;
  }

  const durationMs = Date.now() - start;
  if (caughtError !== null) {
    captureActionError("cancelEmploymentChange", caughtError, {
      actor_user_id: actor?.authUserId ?? null,
      actor_tenant_id: actor?.tenantId ?? null,
      employee_id: employeeId || null,
    });
    logAction({
      action: "cancelEmploymentChange",
      actorUserId: actor?.authUserId ?? null,
      actorTenantId: actor?.tenantId ?? null,
      durationMs,
      outcome: "fail",
      error: caughtError,
      requestId,
    });
  } else {
    logAction({
      action: "cancelEmploymentChange",
      actorUserId: actor!.authUserId,
      actorTenantId: actor!.tenantId,
      durationMs,
      outcome: "ok",
      requestId,
    });
  }

  if (failed) {
    redirect(`${returnTo}?error=${encodeURIComponent(errorCode)}&employee=${encodeURIComponent(employeeId)}`);
  }

  redirect(`${returnTo}?status=employment_change_cancelled&employee=${encodeURIComponent(employeeId)}`);
}
