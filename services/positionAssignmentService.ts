import "server-only";
import type { Actor } from "@/middleware/rbac";
import { createServiceRoleClient } from "@/lib/db/supabaseServer";

/**
 * Position occupancy truth (Phase 2).
 *
 * position_assignments answers "who occupied this position, and between what dates?".
 * Mutations go through the transactional SQL functions (teamframe_assign_position_occupant
 * / teamframe_vacate_position) so the current-state pointer (positions.assigned_employee_id)
 * and the history stay consistent in one atomic statement. Reads are admin-only.
 */

export type PositionAssignmentRecord = {
  id: string;
  position_id: string;
  employee_id: string;
  employee_name: string | null;
  effective_start: string | null; // NULL for a migration snapshot (true start unknown)
  effective_end: string | null; // NULL = open/current assignment
  is_snapshot: boolean;
  created_at: string;
};

type AssignmentJoinRow = {
  id: string;
  position_id: string;
  employee_id: string;
  effective_start: string | null;
  effective_end: string | null;
  is_snapshot: boolean;
  created_at: string;
  employees: { full_name: string } | { full_name: string }[] | null;
};

function requireTenant(actor: Actor): string {
  if (!actor.tenantId) throw new Error("NO_TENANT_CONTEXT");
  return actor.tenantId;
}

function requireAdmin(actor: Actor): void {
  if (actor.role !== "admin") throw new Error("FORBIDDEN");
}

/**
 * Prefill guidance for employee role_title when (re)assigning a position.
 *
 * - empty current title → suggest the position title;
 * - current title merely mirrored the previous position title → safe to update;
 * - a deliberately different (custom) title → keep it; divergence is explicit, not
 *   corruption. `replacesCustomTitle` lets the UI surface the divergence instead of
 *   silently overwriting.
 */
export function suggestRoleTitle(
  currentRoleTitle: string | null | undefined,
  previousPositionTitle: string | null | undefined,
  newPositionTitle: string | null | undefined,
): { value: string; replacesCustomTitle: boolean } {
  const cur = (currentRoleTitle ?? "").trim();
  const prev = (previousPositionTitle ?? "").trim();
  const next = (newPositionTitle ?? "").trim();
  if (cur.length === 0) return { value: next, replacesCustomTitle: false };
  if (prev.length > 0 && cur.toLowerCase() === prev.toLowerCase()) return { value: next, replacesCustomTitle: false };
  return { value: cur, replacesCustomTitle: next.length > 0 && cur.toLowerCase() !== next.toLowerCase() };
}

export async function assignEmployeeToPosition(
  actor: Actor,
  positionId: string,
  employeeId: string,
  effectiveStart?: string | null,
): Promise<void> {
  requireAdmin(actor);
  const tenantId = requireTenant(actor);
  const supabase = createServiceRoleClient();
  const { error } = await supabase.rpc("teamframe_assign_position_occupant", {
    p_tenant: tenantId,
    p_position: positionId,
    p_employee: employeeId,
    p_effective_start: effectiveStart ?? null,
    p_actor: actor.authUserId ?? null,
  } as never);
  if (error) throw new Error(`POSITION_ASSIGN_FAILED: ${error.message}`);
}

export async function vacatePosition(
  actor: Actor,
  positionId: string,
  effectiveEnd?: string | null,
): Promise<void> {
  requireAdmin(actor);
  const tenantId = requireTenant(actor);
  const supabase = createServiceRoleClient();
  const { error } = await supabase.rpc("teamframe_vacate_position", {
    p_tenant: tenantId,
    p_position: positionId,
    p_effective_end: effectiveEnd ?? null,
  } as never);
  if (error) throw new Error(`POSITION_VACATE_FAILED: ${error.message}`);
}

export async function listPositionAssignments(
  actor: Actor,
  positionId: string,
): Promise<PositionAssignmentRecord[]> {
  requireAdmin(actor);
  const tenantId = requireTenant(actor);
  const supabase = createServiceRoleClient();
  const query = await supabase
    .from("position_assignments")
    .select("id, position_id, employee_id, effective_start, effective_end, is_snapshot, created_at, employees(full_name)")
    .eq("tenant_id", tenantId)
    .eq("position_id", positionId)
    .order("effective_end", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });
  if (query.error) throw new Error(`POSITION_ASSIGNMENTS_FETCH_FAILED: ${query.error.message}`);

  // Cast: position_assignments is newer than the generated Supabase types. The joined
  // `employees` may arrive as an object or a single-element array depending on the client.
  const rows = (query.data ?? []) as unknown as AssignmentJoinRow[];
  return rows.map((row) => {
    const joined = Array.isArray(row.employees) ? row.employees[0] ?? null : row.employees;
    return {
      id: row.id,
      position_id: row.position_id,
      employee_id: row.employee_id,
      employee_name: joined?.full_name ?? null,
      effective_start: row.effective_start ?? null,
      effective_end: row.effective_end ?? null,
      is_snapshot: Boolean(row.is_snapshot),
      created_at: row.created_at,
    };
  });
}
