import "server-only";
import { z } from "zod";
import type { Actor } from "@/middleware/rbac";
import { createServiceRoleClient } from "@/lib/db/supabaseServer";

// This is an operator-reviewed assertion, not an authenticated HirePass API read.
// Excluding unknown keys prevents CV, salary or other candidate data crossing over.
export const HirePeopleSnapshotSchema = z.object({
  pass_candidate_id: z.number().int().positive(),
  offer_id: z.number().int().positive(),
  candidate_status: z.literal("hired"),
  offer_status: z.literal("accepted"),
  approval_reference: z.string().trim().min(1).max(240),
  full_name: z.string().trim().min(1).max(200),
  email: z.string().trim().toLowerCase().email(),
  role_title: z.string().trim().min(1).max(200),
  department: z.string().trim().min(1).max(120),
  timezone: z.string().trim().min(1).max(100),
  employment_type: z.enum(["full_time", "part_time", "contractor", "intern"]),
  country: z.string().trim().min(2).max(100),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  manager_id: z.string().uuid().nullable(),
  grade: z.string().trim().max(100).nullable(),
}).strict().refine((value) => !value.end_date || value.end_date >= value.start_date, {
  message: "HIRE_HANDOFF_END_BEFORE_START",
});

export type HirePeopleSnapshot = z.infer<typeof HirePeopleSnapshotSchema>;

export async function createEmployeeFromReviewedHire(
  actor: Actor,
  untrustedSnapshot: unknown,
): Promise<{ employeeId: string }> {
  if (actor.role !== "admin") throw new Error("FORBIDDEN");
  if (!actor.tenantId) throw new Error("NO_TENANT_CONTEXT");
  const snapshot = HirePeopleSnapshotSchema.parse(untrustedSnapshot);
  // Immutable per-customer deployment setting; never supplied by each form submission.
  const sourceNamespace = process.env.TEAMFRAME_HIREPASS_SOURCE_NAMESPACE?.trim();
  if (!sourceNamespace || sourceNamespace.length > 120 || !/^[a-zA-Z0-9._:-]+$/.test(sourceNamespace)) {
    throw new Error("HIRE_HANDOFF_SOURCE_NOT_CONFIGURED");
  }
  const { data, error } = await createServiceRoleClient()
    .rpc("teamframe_create_employee_from_hire", {
      p_tenant_id: actor.tenantId,
      p_actor_user_id: actor.authUserId,
      p_snapshot: { ...snapshot, source_namespace: sourceNamespace },
    } as never)
    .single();
  if (error) {
    if (error.message.includes("HIRE_HANDOFF_CONFLICT")) throw new Error("HIRE_HANDOFF_CONFLICT");
    if (error.message.includes("HIRE_HANDOFF_INVALID_SNAPSHOT")) throw new Error("HIRE_HANDOFF_INVALID_SNAPSHOT");
    throw new Error(`HIRE_HANDOFF_FAILED: ${error.message}`);
  }
  return { employeeId: (data as { id: string }).id };
}
