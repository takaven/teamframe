import type { OnboardingTask } from "@/services/onboardingService";
import type { DocumentRequirementRecord } from "@/services/documentService";

export type ReadinessBlocker = { label: string; owner: string; nextAction: string };

export function configuredPreStartChecks(
  startDate: string | null,
  tasks: readonly OnboardingTask[],
  requirements: readonly DocumentRequirementRecord[],
  names: ReadonlyMap<string, string>,
): { ready: boolean; checked: number; blockers: ReadinessBlocker[] } {
  const blockers: ReadinessBlocker[] = [];
  if (!startDate) {
    blockers.push({ label: "Start date is missing", owner: "Admin", nextAction: "Set the employee start date." });
  }
  if (tasks.length + requirements.length === 0) {
    blockers.push({ label: "No checks are configured", owner: "Admin", nextAction: "Configure pre-start tasks or evidence requests." });
  }
  for (const task of tasks) {
    if (!task.due_date) {
      blockers.push({ label: `${task.title}: due date is missing`, owner: "Admin", nextAction: "Set a due date to classify this task." });
      continue;
    }
    if (!startDate || task.due_date > startDate || task.status === "completed") continue;
    const owner = task.owner_employee_id ? names.get(task.owner_employee_id) ?? `${task.owner_role} (person not identified)` : task.owner_role === "employee" ? "Starter" : task.owner_role === "admin" ? "Admin" : `${task.owner_role} (person not assigned)`;
    blockers.push({ label: `${task.title} · due ${task.due_date}`, owner, nextAction: "Complete this onboarding task." });
  }
  for (const requirement of requirements) {
    if (requirement.state === "cancelled" || requirement.state === "replaced") continue;
    const label = requirement.document_type.replaceAll("_", " ");
    if (!requirement.due_date) {
      blockers.push({ label: `${label}: due date is missing`, owner: "Admin", nextAction: "Set a due date to classify this evidence request." });
      continue;
    }
    if (!startDate || requirement.due_date > startDate) continue;
    const valid = requirement.state === "accepted" && Boolean(requirement.current_document_id) &&
      (!requirement.expiry_required || Boolean(requirement.current_expires_at)) &&
      (!requirement.current_expires_at || requirement.current_expires_at.slice(0, 10) >= startDate);
    if (valid) continue;
    const review = requirement.state === "received";
    blockers.push({
      label: `${label} · ${requirement.state}${requirement.current_expires_at && requirement.current_expires_at.slice(0, 10) < startDate ? " (expires before start)" : ""}`,
      owner: review || !requirement.employee_upload_allowed ? "Admin" : "Starter",
      nextAction: review ? "Review the received evidence." : requirement.employee_upload_allowed ? "Upload acceptable, current evidence." : "Request or record acceptable, current evidence.",
    });
  }
  const checked = tasks.filter((task) => startDate && task.due_date && task.due_date <= startDate).length +
    requirements.filter((requirement) => startDate && requirement.due_date && requirement.due_date <= startDate && requirement.state !== "cancelled" && requirement.state !== "replaced").length;
  if (startDate && checked === 0) {
    blockers.push({ label: "No pre-start checks are configured", owner: "Admin", nextAction: "Confirm and configure due-by-start checks." });
  }
  return { ready: blockers.length === 0, checked, blockers };
}
