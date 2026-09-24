import "server-only";

import type { Actor } from "@/middleware/rbac";
import { listCurrentDirectReports, type ManagerEmployeeRow } from "@/services/managerAuthorization";
import { listPendingLeavesForManager, type PendingLeaveWithEmployee } from "@/services/leaveService";
import { listManagerOnboardingTasks, type OnboardingTask } from "@/services/onboardingService";
import { listManagerProbationReviews, type ProbationReview } from "@/services/earlyEmploymentService";
import { listManagerOffboardingItems, type OffboardingItem } from "@/services/offboardingService";
import { createServiceRoleClient } from "@/lib/db/supabaseServer";

export type ManagerUpcomingItem = {
  id: string;
  date: string;
  label: string;
  employee_name: string | null;
  kind: "start" | "probation" | "leave" | "holiday";
};

export type ManagerDashboard = {
  directReports: ManagerEmployeeRow[];
  pendingLeaves: PendingLeaveWithEmployee[];
  onboardingTasks: OnboardingTask[];
  probationReviews: ProbationReview[];
  offboardingItems: OffboardingItem[];
  upcoming: ManagerUpcomingItem[];
};

async function listManagerUpcoming(actor: Actor, directReports: ManagerEmployeeRow[], probationReviews: ProbationReview[]): Promise<ManagerUpcomingItem[]> {
  if (!actor.tenantId || directReports.length === 0) return [];
  const today = new Date();
  const until = new Date(today);
  until.setDate(until.getDate() + 60);
  const fromDate = today.toISOString().slice(0, 10);
  const untilDate = until.toISOString().slice(0, 10);
  const reportIds = directReports.map((employee) => employee.id);
  const names = new Map(directReports.map((employee) => [employee.id, employee.full_name]));
  const supabase = createServiceRoleClient();
  const [leaveResult, holidayResult] = await Promise.all([
    supabase.from("leaves").select("id,employee_id,start_date,end_date").eq("tenant_id", actor.tenantId).in("employee_id", reportIds).eq("status", "approved").gte("end_date", fromDate).lte("start_date", untilDate),
    supabase.from("company_holidays").select("id,holiday_date,name").eq("tenant_id", actor.tenantId).gte("holiday_date", fromDate).lte("holiday_date", untilDate),
  ]);
  if (leaveResult.error) throw new Error(`MANAGER_UPCOMING_LEAVE_FAILED: ${leaveResult.error.message}`);
  if (holidayResult.error) throw new Error(`MANAGER_UPCOMING_HOLIDAY_FAILED: ${holidayResult.error.message}`);

  const items: ManagerUpcomingItem[] = [];
  for (const employee of directReports) {
    if (employee.start_date && employee.start_date >= fromDate && employee.start_date <= untilDate) {
      items.push({ id: `start-${employee.id}`, date: employee.start_date, label: "Starts", employee_name: employee.full_name, kind: "start" });
    }
  }
  for (const review of probationReviews) {
    if (review.review_due_date >= fromDate && review.review_due_date <= untilDate && review.status !== "completed" && review.status !== "cancelled") {
      items.push({ id: `probation-${review.id}`, date: review.review_due_date, label: "Probation review", employee_name: names.get(review.employee_id) ?? "Direct report", kind: "probation" });
    }
  }
  for (const leave of (leaveResult.data ?? []) as Array<{ id: string; employee_id: string; start_date: string; end_date: string }>) {
    items.push({ id: `leave-${leave.id}`, date: leave.start_date, label: leave.start_date === leave.end_date ? "Away" : `Away until ${leave.end_date}`, employee_name: names.get(leave.employee_id) ?? "Direct report", kind: "leave" });
  }
  for (const holiday of (holidayResult.data ?? []) as Array<{ id: string; holiday_date: string; name: string }>) {
    items.push({ id: `holiday-${holiday.id}`, date: holiday.holiday_date, label: holiday.name, employee_name: null, kind: "holiday" });
  }
  return items.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 12);
}

export async function getManagerDashboard(actor: Actor): Promise<ManagerDashboard> {
  const directReports = await listCurrentDirectReports(actor);
  if (directReports.length === 0) {
    return {
      directReports,
      pendingLeaves: [],
      onboardingTasks: [],
      probationReviews: [],
      offboardingItems: [],
      upcoming: [],
    };
  }

  const [pendingLeaves, onboardingTasks, probationReviews, offboardingItems] = await Promise.all([
    listPendingLeavesForManager(actor),
    listManagerOnboardingTasks(actor),
    listManagerProbationReviews(actor),
    listManagerOffboardingItems(actor),
  ]);
  const upcoming = await listManagerUpcoming(actor, directReports, probationReviews);

  return {
    directReports,
    pendingLeaves,
    onboardingTasks,
    probationReviews,
    offboardingItems,
    upcoming,
  };
}
