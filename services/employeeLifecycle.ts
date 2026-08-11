export type LegacyEmployeeStatus = "active" | "on_leave" | "inactive";
export type LegacyEmployeeSetupStatus = "incomplete" | "ready" | "active";
export type LegacyEmployeeLifecycleState =
  | "preboarding"
  | "active"
  | "on_leave"
  | "offboarding"
  | "exited";

export type CanonicalEmployeeLifecycle =
  | "PRE_START"
  | "ONBOARDING"
  | "ACTIVE"
  | "OFFBOARDING"
  | "FORMER";

export type EmployeeLifecycleInput = {
  status?: LegacyEmployeeStatus | null;
  setup_status?: LegacyEmployeeSetupStatus | null;
  lifecycle_state?: LegacyEmployeeLifecycleState | null;
  start_date?: string | null;
  end_date?: string | null;
  deleted_at?: string | null;
};

export const CURRENT_EMPLOYEE_DB_LIFECYCLE_STATES = [
  "preboarding",
  "active",
  "on_leave",
  "offboarding",
] as const satisfies readonly LegacyEmployeeLifecycleState[];

export const ONBOARDING_DB_LIFECYCLE_STATES = [
  "preboarding",
  "active",
] as const satisfies readonly LegacyEmployeeLifecycleState[];

function parseDateOnly(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

function utcToday(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
}

function isAfterToday(value: string | null | undefined, now: Date): boolean {
  if (!value) return false;
  const parsed = parseDateOnly(value);
  if (!parsed) return false;
  return parsed.getTime() > utcToday(now).getTime();
}

function isBeforeToday(value: string | null | undefined, now: Date): boolean {
  if (!value) return false;
  const parsed = parseDateOnly(value);
  if (!parsed) return false;
  return parsed.getTime() < utcToday(now).getTime();
}

export function projectEmployeeLifecycle(
  input: EmployeeLifecycleInput,
  now: Date = new Date(),
): CanonicalEmployeeLifecycle {
  if (input.deleted_at) return "FORMER";
  if (input.status === "inactive") return "FORMER";
  if (input.lifecycle_state === "exited") return "FORMER";
  if (input.end_date && isBeforeToday(input.end_date, now)) return "FORMER";
  if (input.lifecycle_state === "offboarding") return "OFFBOARDING";
  if (isAfterToday(input.start_date, now)) return "PRE_START";

  if (input.lifecycle_state === "preboarding") return "ONBOARDING";
  if (input.setup_status && input.setup_status !== "active") return "ONBOARDING";

  return "ACTIVE";
}

export function canonicalLifecycleLabel(lifecycle: CanonicalEmployeeLifecycle): string {
  switch (lifecycle) {
    case "PRE_START":
      return "Pre-start";
    case "ONBOARDING":
      return "Onboarding";
    case "ACTIVE":
      return "Active";
    case "OFFBOARDING":
      return "Offboarding";
    case "FORMER":
      return "Former";
  }
}

export function isCurrentEmployee(input: EmployeeLifecycleInput, now?: Date): boolean {
  return projectEmployeeLifecycle(input, now) !== "FORMER";
}

export function isPolicyEligibleEmployee(input: EmployeeLifecycleInput, now?: Date): boolean {
  return isCurrentEmployee(input, now);
}

export function isOnboardingEligibleEmployee(input: EmployeeLifecycleInput, now?: Date): boolean {
  const lifecycle = projectEmployeeLifecycle(input, now);
  return lifecycle === "PRE_START" || lifecycle === "ONBOARDING";
}

export function isLeaveRequestEligibleEmployee(input: EmployeeLifecycleInput, now?: Date): boolean {
  const lifecycle = projectEmployeeLifecycle(input, now);
  return lifecycle === "ACTIVE" || lifecycle === "OFFBOARDING";
}

export function isSelfServiceEligibleEmployee(input: EmployeeLifecycleInput, now?: Date): boolean {
  return isCurrentEmployee(input, now);
}
