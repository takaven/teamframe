import "server-only";

import type { Actor } from "@/middleware/rbac";
import { listCurrentDirectReports, type ManagerEmployeeRow } from "@/services/managerAuthorization";
import { listPendingLeavesForManager, type PendingLeaveWithEmployee } from "@/services/leaveService";
import { listManagerOnboardingTasks, type OnboardingTask } from "@/services/onboardingService";
import { listManagerProbationReviews, type ProbationReview } from "@/services/earlyEmploymentService";
import { listManagerOffboardingItems, type OffboardingItem } from "@/services/offboardingService";

export type ManagerDashboard = {
  directReports: ManagerEmployeeRow[];
  pendingLeaves: PendingLeaveWithEmployee[];
  onboardingTasks: OnboardingTask[];
  probationReviews: ProbationReview[];
  offboardingItems: OffboardingItem[];
};

export async function getManagerDashboard(actor: Actor): Promise<ManagerDashboard> {
  const directReports = await listCurrentDirectReports(actor);
  if (directReports.length === 0) {
    return {
      directReports,
      pendingLeaves: [],
      onboardingTasks: [],
      probationReviews: [],
      offboardingItems: [],
    };
  }

  const [pendingLeaves, onboardingTasks, probationReviews, offboardingItems] = await Promise.all([
    listPendingLeavesForManager(actor),
    listManagerOnboardingTasks(actor),
    listManagerProbationReviews(actor),
    listManagerOffboardingItems(actor),
  ]);

  return {
    directReports,
    pendingLeaves,
    onboardingTasks,
    probationReviews,
    offboardingItems,
  };
}
