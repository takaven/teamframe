import "server-only";
import type { Actor } from "@/middleware/rbac";
import { createServiceRoleClient } from "@/lib/db/supabaseServer";

/**
 * Read access to the Phase-1 company-controlled configuration lists (departments,
 * work locations). Admin-scoped, tenant-scoped. Write/UI for these lives in the
 * later Setup/Administration phase; Phase 2B only needs to read them for the
 * position form dropdowns and for resolving ids to display names.
 */

export type DepartmentOption = { id: string; name: string; active: boolean };
export type WorkLocationOption = { id: string; name: string; country: string; active: boolean };

function requireTenant(actor: Actor): string {
  if (!actor.tenantId) throw new Error("NO_TENANT_CONTEXT");
  return actor.tenantId;
}

function requireAdmin(actor: Actor): void {
  if (actor.role !== "admin") throw new Error("FORBIDDEN");
}

export async function listDepartments(actor: Actor): Promise<DepartmentOption[]> {
  requireAdmin(actor);
  const tenantId = requireTenant(actor);
  const supabase = createServiceRoleClient();
  const query = await supabase
    .from("departments")
    .select("id, name, active")
    .eq("tenant_id", tenantId)
    .order("active", { ascending: false })
    .order("name", { ascending: true });
  if (query.error) throw new Error(`DEPARTMENTS_LIST_FAILED: ${query.error.message}`);
  return (query.data ?? []) as unknown as DepartmentOption[];
}

export async function listWorkLocations(actor: Actor): Promise<WorkLocationOption[]> {
  requireAdmin(actor);
  const tenantId = requireTenant(actor);
  const supabase = createServiceRoleClient();
  const query = await supabase
    .from("work_locations")
    .select("id, name, country, active")
    .eq("tenant_id", tenantId)
    .order("active", { ascending: false })
    .order("name", { ascending: true });
  if (query.error) throw new Error(`WORK_LOCATIONS_LIST_FAILED: ${query.error.message}`);
  return (query.data ?? []) as unknown as WorkLocationOption[];
}
