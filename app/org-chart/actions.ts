"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireTenantActor } from "@/middleware/rbac";
import {
  createPosition,
  deleteVacantPosition,
  getPositionJobDescriptionUrl,
  removePositionJobDescription,
  updatePosition,
  uploadPositionJobDescription,
} from "@/services/positionService";
import { captureActionError } from "@/lib/telemetry/sentry";
import { logAction } from "@/lib/telemetry/logger";

const PositionFormSchema = z.object({
  title: z.string().trim().min(1),
  department: z.string().trim().min(1),
  parent_position_id: z.string().uuid().optional(),
  assigned_employee_id: z.string().uuid().optional(),
  note: z.string().trim().max(500).optional(),
  department_id: z.string().uuid().optional(),
  work_location_id: z.string().uuid().optional(),
  budgeted: z.enum(["budgeted", "non_budgeted"]).optional(),
});

const UpdatePositionFormSchema = PositionFormSchema.extend({
  position_id: z.string().uuid(),
  expected_updated_at: z.string().trim().min(1),
});

const DeletePositionFormSchema = z.object({
  position_id: z.string().uuid(),
  expected_updated_at: z.string().trim().min(1),
});

const PositionJdFormSchema = z.object({
  position_id: z.string().uuid(),
});

function optionalString(value: FormDataEntryValue | null): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function getOptionalFile(value: FormDataEntryValue | null): File | null {
  if (!(value instanceof File)) return null;
  return value.size > 0 || value.name.length > 0 ? value : null;
}

function getErrorCode(error: unknown): string {
  if (error instanceof z.ZodError) return "INVALID_INPUT";
  if (error instanceof Error) {
    const match = error.message.match(/^[A-Z_]+/);
    return match ? match[0] : "UNKNOWN";
  }
  return "UNKNOWN";
}

function redirectWith(path: string, key: "status" | "error", value: string): never {
  redirect(`${path}?${key}=${encodeURIComponent(value)}`);
}

async function runOrgAction(
  action: string,
  work: (actor: Awaited<ReturnType<typeof requireTenantActor>>) => Promise<void>,
  success: string,
): Promise<void> {
  const start = Date.now();
  const requestId = crypto.randomUUID();
  let actor: Awaited<ReturnType<typeof requireTenantActor>> | null = null;
  let caughtError: unknown = null;

  try {
    actor = await requireTenantActor();
    await work(actor);
  } catch (error) {
    caughtError = error;
  }

  const durationMs = Date.now() - start;
  if (caughtError) {
    captureActionError(action, caughtError, {
      actor_user_id: actor?.authUserId ?? null,
      actor_tenant_id: actor?.tenantId ?? null,
    });
    logAction({
      action,
      actorUserId: actor?.authUserId ?? null,
      actorTenantId: actor?.tenantId ?? null,
      durationMs,
      outcome: "fail",
      error: caughtError,
      requestId,
    });
    redirectWith("/org-chart", "error", getErrorCode(caughtError));
  }

  logAction({
    action,
    actorUserId: actor!.authUserId,
    actorTenantId: actor!.tenantId,
    durationMs,
    outcome: "ok",
    requestId,
  });
  redirectWith("/org-chart", "status", success);
}

function parsePositionInput(formData: FormData): z.infer<typeof PositionFormSchema> {
  return PositionFormSchema.parse({
    title: formData.get("title"),
    department: formData.get("department"),
    parent_position_id: optionalString(formData.get("parent_position_id")),
    assigned_employee_id: optionalString(formData.get("assigned_employee_id")),
    note: optionalString(formData.get("note")),
    department_id: optionalString(formData.get("department_id")),
    work_location_id: optionalString(formData.get("work_location_id")),
    budgeted: optionalString(formData.get("budgeted")),
  });
}

// "budgeted"/"non_budgeted" → boolean; unspecified → undefined (leave unchanged).
function toBudgeted(value: "budgeted" | "non_budgeted" | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  return value === "budgeted";
}

export async function createPositionAction(formData: FormData): Promise<void> {
  await runOrgAction(
    "createPosition",
    async (actor) => {
      const input = parsePositionInput(formData);
      const position = await createPosition(actor, {
        title: input.title,
        department: input.department,
        parentPositionId: input.parent_position_id ?? null,
        assignedEmployeeId: input.assigned_employee_id ?? null,
        note: input.note ?? null,
        departmentId: input.department_id,
        workLocationId: input.work_location_id,
        budgeted: toBudgeted(input.budgeted),
      });
      const file = getOptionalFile(formData.get("job_description"));
      if (file) {
        await uploadPositionJobDescription(actor, position.id, file);
      }
    },
    "created",
  );
}

export async function updatePositionAction(formData: FormData): Promise<void> {
  await runOrgAction(
    "updatePosition",
    async (actor) => {
      const parsed = UpdatePositionFormSchema.parse({
        ...parsePositionInput(formData),
        position_id: formData.get("position_id"),
        expected_updated_at: formData.get("expected_updated_at"),
      });
      await updatePosition(
        actor,
        parsed.position_id,
        {
          title: parsed.title,
          department: parsed.department,
          parentPositionId: parsed.parent_position_id ?? null,
          assignedEmployeeId: parsed.assigned_employee_id ?? null,
          note: parsed.note ?? null,
          departmentId: parsed.department_id,
          workLocationId: parsed.work_location_id,
          budgeted: toBudgeted(parsed.budgeted),
        },
        parsed.expected_updated_at,
      );
    },
    "updated",
  );
}

export async function deletePositionAction(formData: FormData): Promise<void> {
  await runOrgAction(
    "deletePosition",
    async (actor) => {
      const parsed = DeletePositionFormSchema.parse({
        position_id: formData.get("position_id"),
        expected_updated_at: formData.get("expected_updated_at"),
      });
      await deleteVacantPosition(actor, parsed.position_id, parsed.expected_updated_at);
    },
    "deleted",
  );
}

export async function uploadPositionJdAction(formData: FormData): Promise<void> {
  await runOrgAction(
    "uploadPositionJd",
    async (actor) => {
      const parsed = PositionJdFormSchema.parse({ position_id: formData.get("position_id") });
      const file = getOptionalFile(formData.get("job_description"));
      if (!file) throw new Error("POSITION_JD_EMPTY_FILE");
      await uploadPositionJobDescription(actor, parsed.position_id, file);
    },
    "jd_uploaded",
  );
}

export async function removePositionJdAction(formData: FormData): Promise<void> {
  await runOrgAction(
    "removePositionJd",
    async (actor) => {
      const parsed = PositionJdFormSchema.parse({ position_id: formData.get("position_id") });
      await removePositionJobDescription(actor, parsed.position_id);
    },
    "jd_removed",
  );
}

export async function downloadPositionJdAction(formData: FormData): Promise<void> {
  const actor = await requireTenantActor();
  const parsed = PositionJdFormSchema.parse({ position_id: formData.get("position_id") });
  redirect(await getPositionJobDescriptionUrl(actor, parsed.position_id));
}
