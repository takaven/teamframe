/**
 * Onboarding template packs — static data, Wave 2 (gap audit 2026-05-30, Gap 5).
 *
 * Scope lock (docs/drift-guard.md):
 *  - three fixed packs defined in code; NOT a template-management UI
 *  - NOT stored in the database; assigning a pack simply creates ordinary
 *    onboarding_tasks rows with computed due dates
 *  - no reminders, no notifications, no workflow states
 *
 * This module is intentionally free of "server-only" and DB imports: it is
 * pure static data + pure date helpers, safe to import from the client
 * component that previews a pack before assignment. The server action
 * re-expands the pack authoritatively — nothing from the client is trusted
 * beyond the pack id and kept task indexes.
 */

export type OnboardingTemplateTask = {
  title: string;
  /** Days after the employee's start date (0 = day 1). */
  dueOffsetDays: number;
  completionMode?: "manual_confirmation" | "document_required";
  requiredDocumentType?: string;
};

export type OnboardingTemplatePackId = "every_hire" | "engineering" | "operations";

export type OnboardingTemplatePack = {
  id: OnboardingTemplatePackId;
  name: string;
  description: string;
  tasks: readonly OnboardingTemplateTask[];
};

export const ONBOARDING_TEMPLATE_PACKS: readonly OnboardingTemplatePack[] = [
  {
    id: "every_hire",
    name: "Every hire",
    description: "The baseline first-two-weeks checklist every new joiner needs.",
    tasks: [
      {
        title: "Sign your employment contract",
        dueOffsetDays: 0,
        completionMode: "document_required",
        requiredDocumentType: "contract",
      },
      { title: "Complete your employee profile", dueOffsetDays: 0 },
      { title: "Meet your manager", dueOffsetDays: 2 },
      {
        title: "Upload ID and right-to-work documents",
        dueOffsetDays: 2,
        completionMode: "document_required",
        requiredDocumentType: "right_to_work",
      },
      { title: "Read and acknowledge company policies", dueOffsetDays: 7 },
      { title: "Confirm payroll and bank details", dueOffsetDays: 7 },
    ],
  },
  {
    id: "engineering",
    name: "Engineering",
    description: "Environment, access, and a first shipped change for engineers.",
    tasks: [
      { title: "Get access to the code repository", dueOffsetDays: 0 },
      { title: "Set up your development environment", dueOffsetDays: 2 },
      { title: "Meet the engineering team", dueOffsetDays: 2 },
      { title: "Review the engineering handbook and coding standards", dueOffsetDays: 7 },
      { title: "Complete the security and access review", dueOffsetDays: 7 },
      { title: "Ship your first small change", dueOffsetDays: 14 },
    ],
  },
  {
    id: "operations",
    name: "Operations",
    description: "Tooling, procedures, and a first owned process for ops hires.",
    tasks: [
      { title: "Get access to the operations toolkit", dueOffsetDays: 0 },
      { title: "Complete the data-handling and confidentiality briefing", dueOffsetDays: 2 },
      { title: "Review the standard operating procedures", dueOffsetDays: 2 },
      { title: "Shadow a teammate on core workflows", dueOffsetDays: 7 },
      { title: "Own your first recurring process end to end", dueOffsetDays: 14 },
    ],
  },
];

export function getTemplatePack(id: string): OnboardingTemplatePack | null {
  return ONBOARDING_TEMPLATE_PACKS.find((pack) => pack.id === id) ?? null;
}

/**
 * Compute a due date (YYYY-MM-DD) from a base date plus an offset in days.
 *
 * Accepts either a plain date ("2026-07-01") or a full ISO timestamp
 * (an employee created_at); only the date part is used, in UTC, so results
 * are stable regardless of server timezone.
 */
export function computeDueDate(baseDate: string, offsetDays: number): string {
  const datePart = baseDate.slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);
  if (!match) throw new Error("INVALID_BASE_DATE");
  const [, year, month, day] = match;
  const utc = Date.UTC(Number(year), Number(month) - 1, Number(day) + offsetDays);
  return new Date(utc).toISOString().slice(0, 10);
}

/**
 * Expand a template pack into insert-ready tasks.
 *
 * `keptIndexes` are positions in the pack's task list that the admin kept in
 * the assign form (tasks are individually removable before assign). Out-of-range
 * and duplicate indexes are ignored; original pack order is preserved.
 */
export function expandTemplatePack(
  packId: string,
  keptIndexes: readonly number[],
  baseDate: string,
): Array<{
  title: string;
  due_date: string;
  completion_mode: "manual_confirmation" | "document_required";
  required_document_type: string | null;
}> {
  const pack = getTemplatePack(packId);
  if (!pack) throw new Error("ONBOARDING_UNKNOWN_PACK");
  const kept = new Set(keptIndexes);
  return pack.tasks
    .map((task, index) => ({ task, index }))
    .filter(({ index }) => kept.has(index))
    .map(({ task }) => ({
      title: task.title,
      due_date: computeDueDate(baseDate, task.dueOffsetDays),
      completion_mode: task.completionMode ?? "manual_confirmation",
      required_document_type: task.requiredDocumentType ?? null,
    }));
}

/** Human label for a relative due offset, used in the assign-form preview. */
export function dueOffsetLabel(offsetDays: number): string {
  if (offsetDays <= 0) return "Day 1";
  if (offsetDays < 7) return `Day ${offsetDays + 1}`;
  const weeks = Math.floor(offsetDays / 7);
  return `Week ${weeks + (offsetDays % 7 === 0 ? 0 : 1)}`;
}

/** A pending task is overdue once today (UTC date) is past its due date. */
export function isTaskOverdue(
  dueDate: string | null,
  status: "pending" | "completed",
  today: string = new Date().toISOString().slice(0, 10),
): boolean {
  if (!dueDate || status !== "pending") return false;
  return dueDate.slice(0, 10) < today;
}
