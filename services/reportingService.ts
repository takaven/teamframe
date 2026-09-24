import "server-only";
import type { Actor } from "@/middleware/rbac";
import { requireCapability } from "@/lib/rbac/access";
import { createServiceRoleClient } from "@/lib/db/supabaseServer";

type Employee = { id: string; full_name: string; department: string; work_location: string | null; employment_type: string; country: string | null; start_date: string | null; end_date: string | null; lifecycle_state: string | null; status: string };
type Leave = { employee_id: string; leave_type: string; start_date: string; end_date: string; requested_days: number; status: string };
type Requirement = { employee_id: string; state: string; due_date: string | null; current_document_id: string | null };
type Document = { employee_id: string; expires_at: string | null; deleted_at: string | null };
type Task = { employee_id: string; status: string; due_date: string | null };
type CheckIn = { employee_id: string; status: string; due_date: string };
type Probation = { employee_id: string; status: string; review_due_date: string; outcome: string | null };
type Policy = { id: string; title: string; version: number; is_published: boolean };
type Acknowledgement = { policy_id: string; policy_version: number; employee_id: string; acknowledged_at: string };

export type ReportFilters = { from: string; to: string; department?: string; location?: string };

function inRange(value: string | null, filters: ReportFilters): boolean {
  return !!value && value.slice(0, 10) >= filters.from && value.slice(0, 10) <= filters.to;
}
function countBy(rows: Employee[], key: keyof Pick<Employee, "department" | "work_location" | "employment_type" | "country">) {
  return Object.entries(rows.reduce<Record<string, number>>((acc, row) => {
    const label = String(row[key] ?? "Unknown").replace(/_/g, " ");
    acc[label] = (acc[label] ?? 0) + 1;
    return acc;
  }, {})).sort((a, b) => b[1] - a[1]);
}
function monthStart(date: Date) { return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)); }
function iso(date: Date) { return date.toISOString().slice(0, 10); }

export async function getReports(actor: Actor & { tenantId: string }, filters: ReportFilters) {
  await requireCapability(actor, "people_operations");
  const db = createServiceRoleClient();
  const tenant = actor.tenantId;
  const [employeesResult, leavesResult, requirementsResult, documentsResult, tasksResult, checksResult, probationResult, policiesResult, acknowledgementsResult] = await Promise.all([
    db.from("employees").select("id,full_name,department,work_location,employment_type,country,start_date,end_date,lifecycle_state,status").eq("tenant_id", tenant).is("deleted_at", null),
    db.from("leaves").select("employee_id,leave_type,start_date,end_date,requested_days,status").eq("tenant_id", tenant),
    db.from("document_requirements").select("employee_id,state,due_date,current_document_id").eq("tenant_id", tenant),
    db.from("documents").select("employee_id,expires_at,deleted_at").eq("tenant_id", tenant),
    db.from("onboarding_tasks").select("employee_id,status,due_date").eq("tenant_id", tenant),
    db.from("onboarding_check_ins").select("employee_id,status,due_date").eq("tenant_id", tenant),
    db.from("probation_reviews").select("employee_id,status,review_due_date,outcome").eq("tenant_id", tenant),
    db.from("policies").select("id,title,version,is_published").eq("tenant_id", tenant).eq("is_published", true).is("archived_at", null),
    db.from("acknowledgements").select("policy_id,policy_version,employee_id,acknowledged_at").eq("tenant_id", tenant),
  ]);
  const error = [employeesResult, leavesResult, requirementsResult, documentsResult, tasksResult, checksResult, probationResult, policiesResult, acknowledgementsResult].find((result) => result.error)?.error;
  if (error) throw new Error(`REPORT_READ_FAILED: ${error.message}`);
  let employees = (employeesResult.data ?? []) as Employee[];
  if (filters.department) employees = employees.filter((e) => e.department === filters.department);
  if (filters.location) employees = employees.filter((e) => (e.work_location ?? "") === filters.location);
  const employeeIds = new Set(employees.map((e) => e.id));
  const active = employees.filter((e) => e.lifecycle_state !== "former" && e.status !== "inactive");
  const leaves = ((leavesResult.data ?? []) as Leave[]).filter((row) => employeeIds.has(row.employee_id));
  const requirements = ((requirementsResult.data ?? []) as Requirement[]).filter((row) => employeeIds.has(row.employee_id));
  const documents = ((documentsResult.data ?? []) as Document[]).filter((row) => employeeIds.has(row.employee_id) && !row.deleted_at);
  const tasks = ((tasksResult.data ?? []) as Task[]).filter((row) => employeeIds.has(row.employee_id));
  const checks = ((checksResult.data ?? []) as CheckIn[]).filter((row) => employeeIds.has(row.employee_id));
  const probation = ((probationResult.data ?? []) as Probation[]).filter((row) => employeeIds.has(row.employee_id));
  const policies = (policiesResult.data ?? []) as Policy[];
  const acknowledgements = ((acknowledgementsResult.data ?? []) as Acknowledgement[]).filter((row) => employeeIds.has(row.employee_id));
  const names = new Map(employees.map((e) => [e.id, e.full_name]));
  const departments = [...new Set(((employeesResult.data ?? []) as Employee[]).map((e) => e.department))].sort();
  const locations = [...new Set(((employeesResult.data ?? []) as Employee[]).map((e) => e.work_location).filter(Boolean) as string[])].sort();
  const today = new Date().toISOString().slice(0, 10);
  const in90 = iso(new Date(Date.now() + 90 * 86400000));
  const joiners = employees.filter((e) => inRange(e.start_date, filters));
  const leavers = employees.filter((e) => inRange(e.end_date, filters));
  const periodLeaves = leaves.filter((l) => l.start_date <= filters.to && l.end_date >= filters.from);
  const away = periodLeaves.filter((l) => l.status === "approved");
  const requirementRows = employees.map((employee) => {
    const rows = requirements.filter((r) => r.employee_id === employee.id);
    const accepted = rows.filter((r) => r.state === "accepted").length;
    return { employee, required: rows.length, accepted, outstanding: rows.filter((r) => ["requested", "rejected"].includes(r.state)).length, review: rows.filter((r) => r.state === "received").length, expired: rows.filter((r) => r.state === "expired").length };
  });
  const expiry = documents.filter((d) => d.expires_at && d.expires_at.slice(0, 10) >= today && d.expires_at.slice(0, 10) <= in90);
  const onboardingRows = employees.map((employee) => {
    const rows = tasks.filter((t) => t.employee_id === employee.id);
    const complete = rows.filter((t) => t.status === "completed").length;
    return { employee, tasks: rows.length, complete, overdue: rows.filter((t) => t.status === "pending" && !!t.due_date && t.due_date < today).length, checkIns: checks.filter((c) => c.employee_id === employee.id), probation: probation.filter((p) => p.employee_id === employee.id) };
  });
  const policyRows = policies.flatMap((policy) => active.map((employee) => ({ policy, employee, acknowledgement: acknowledgements.find((a) => a.policy_id === policy.id && a.policy_version === policy.version && a.employee_id === employee.id) ?? null })));
  const trend = Array.from({ length: 12 }, (_, index) => {
    const date = monthStart(new Date()); date.setUTCMonth(date.getUTCMonth() - (11 - index));
    const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
    return { month: date.toLocaleString("en", { month: "short", year: "numeric", timeZone: "UTC" }), count: employees.filter((e) => (!e.start_date || e.start_date <= iso(end)) && (!e.end_date || e.end_date >= iso(date))).length };
  });
  const avgHeadcount = trend.length ? trend.reduce((sum, row) => sum + row.count, 0) / trend.length : 0;
  return { filters, departments, locations, employees, active, names, leaves, periodLeaves, away, joiners, leavers, turnover: avgHeadcount ? (leavers.length / avgHeadcount) * 100 : null, byDepartment: countBy(active, "department"), byLocation: countBy(active, "work_location"), byEmployment: countBy(active, "employment_type"), byCountry: countBy(active, "country"), trend, requirementRows, expiry, onboardingRows, policyRows };
}
