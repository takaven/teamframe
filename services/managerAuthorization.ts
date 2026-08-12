import "server-only";

import type { Actor } from "@/middleware/rbac";
import { createServiceRoleClient } from "@/lib/db/supabaseServer";
import { projectEmployeeLifecycle, type LegacyEmployeeLifecycleState } from "@/services/employeeLifecycle";

export type ManagerEmployeeRow = {
  id: string;
  tenant_id: string;
  full_name: string;
  role_title: string;
  department: string;
  country: string | null;
  manager_id: string | null;
  status: "active" | "on_leave" | "inactive";
  setup_status: "incomplete" | "ready" | "active";
  lifecycle_state: LegacyEmployeeLifecycleState;
  start_date: string | null;
  end_date: string | null;
  deleted_at: string | null;
};

const MANAGER_EMPLOYEE_COLUMNS =
  "id, tenant_id, full_name, role_title, department, country, manager_id, status, setup_status, lifecycle_state, start_date, end_date, deleted_at";

function requireTenant(actor: Actor): string {
  if (!actor.tenantId) throw new Error("NO_TENANT_CONTEXT");
  return actor.tenantId;
}

function requireLinkedEmployee(actor: Actor): string {
  if (!actor.employeeId) throw new Error("NO_EMPLOYEE_RECORD");
  return actor.employeeId;
}

function isActiveManager(row: ManagerEmployeeRow): boolean {
  return projectEmployeeLifecycle(row) === "ACTIVE";
}

function isCurrentDirectReport(row: ManagerEmployeeRow): boolean {
  return projectEmployeeLifecycle(row) !== "FORMER";
}

export async function getManagerEmployee(actor: Actor): Promise<ManagerEmployeeRow> {
  const tenantId = requireTenant(actor);
  const employeeId = requireLinkedEmployee(actor);
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("employees")
    .select(MANAGER_EMPLOYEE_COLUMNS)
    .eq("tenant_id", tenantId)
    .eq("id", employeeId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw new Error(`MANAGER_LOOKUP_FAILED: ${error.message}`);
  if (!data) throw new Error("NO_EMPLOYEE_RECORD");

  const manager = data as ManagerEmployeeRow;
  if (!isActiveManager(manager)) throw new Error("MANAGER_NOT_ACTIVE");
  return manager;
}

export async function listCurrentDirectReports(actor: Actor): Promise<ManagerEmployeeRow[]> {
  const tenantId = requireTenant(actor);
  const manager = await getManagerEmployee(actor);
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("employees")
    .select(MANAGER_EMPLOYEE_COLUMNS)
    .eq("tenant_id", tenantId)
    .eq("manager_id", manager.id)
    .is("deleted_at", null)
    .order("full_name", { ascending: true });

  if (error) throw new Error(`DIRECT_REPORT_LIST_FAILED: ${error.message}`);
  return ((data ?? []) as ManagerEmployeeRow[]).filter(isCurrentDirectReport);
}

export async function assertCurrentDirectManager(actor: Actor, employeeId: string): Promise<ManagerEmployeeRow> {
  const tenantId = requireTenant(actor);
  const manager = await getManagerEmployee(actor);
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("employees")
    .select(MANAGER_EMPLOYEE_COLUMNS)
    .eq("tenant_id", tenantId)
    .eq("id", employeeId)
    .eq("manager_id", manager.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw new Error(`DIRECT_REPORT_LOOKUP_FAILED: ${error.message}`);
  if (!data) throw new Error("FORBIDDEN");

  const directReport = data as ManagerEmployeeRow;
  if (!isCurrentDirectReport(directReport)) throw new Error("FORBIDDEN");
  return directReport;
}
