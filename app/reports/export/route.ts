import { NextRequest, NextResponse } from "next/server";
import { requireTenantActor } from "@/middleware/rbac";
import { getReports } from "@/services/reportingService";
import { csv, humanCsvValue } from "@/lib/reports/csv";

export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const actor = await requireTenantActor();
  if (actor.role !== "admin") return new NextResponse("Forbidden", { status: 403 });
  const url = request.nextUrl;
  const reportName = url.searchParams.get("report") ?? "headcount";
  const filters = { from: url.searchParams.get("from") ?? "2000-01-01", to: url.searchParams.get("to") ?? new Date().toISOString().slice(0, 10), department: url.searchParams.get("department") || undefined, location: url.searchParams.get("location") || undefined };
  const report = await getReports(actor, filters, { includeBalances: reportName === "time-off" });
  let rows: Array<Record<string, string | number | null | undefined>> = [];
  if (reportName === "headcount") rows = report.active.map((e) => ({ employee: e.full_name, department: e.department, location: e.work_location, employment_type: humanCsvValue(e.employment_type), country: e.country, start_date: e.start_date }));
  if (reportName === "joiners") rows = [...report.joiners.map((e) => ({ employee: e.full_name, department: e.department, event: "joined", date: e.start_date })), ...report.leavers.map((e) => ({ employee: e.full_name, department: e.department, event: "left", date: e.end_date }))];
  if (reportName === "time-off") rows = report.balanceRows.map((row) => ({ employee: row.employee.full_name, leave_type: row.display_name, entitlement: row.entitlement, taken: row.taken, pending: row.pending, available: row.available }));
  if (reportName === "away") rows = report.away.map((l) => ({ employee: report.names.get(l.employee_id), leave_type: humanCsvValue(l.leave_type), start_date: l.start_date, end_date: l.end_date, days: l.requested_days, status: humanCsvValue(l.status) }));
  if (reportName === "documents") rows = report.requirementRows.map((r) => ({ employee: r.employee.full_name, required: r.required, approved: r.accepted, completeness_percent: r.required ? Math.round(r.accepted / r.required * 100) : null, outstanding: r.outstanding, awaiting_review: r.review, expired: r.expired }));
  if (reportName === "onboarding") rows = report.onboardingRows.map((r) => ({ employee: r.employee.full_name, tasks: r.tasks, completed: r.complete, completion_percent: r.tasks ? Math.round(r.complete / r.tasks * 100) : null, overdue: r.overdue, check_ins: r.checkIns.map((c) => humanCsvValue(c.status)).join(";"), probation: r.probation.map((p) => humanCsvValue(p.outcome ?? p.status)).join(";") }));
  if (reportName === "policies") rows = report.policyRows.map((r) => ({ policy: r.policy.title, version: r.policy.version, employee: r.employee.full_name, status: r.acknowledgement ? "acknowledged" : "outstanding", acknowledged_at: r.acknowledgement?.acknowledged_at ?? null }));
  return new NextResponse(`\ufeff${csv(rows)}`, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="teamframe-${reportName}-${new Date().toISOString().slice(0, 10)}.csv"`, "cache-control": "no-store" } });
}
