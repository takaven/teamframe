import { describe, expect, it } from "vitest";
import {
  canonicalLifecycleLabel,
  isCurrentEmployee,
  isLeaveRequestEligibleEmployee,
  isOnboardingEligibleEmployee,
  isPolicyEligibleEmployee,
  isSelfServiceEligibleEmployee,
  projectEmployeeLifecycle,
  type EmployeeLifecycleInput,
} from "@/services/employeeLifecycle";

const NOW = new Date("2026-08-11T12:00:00.000Z");

function employee(input: EmployeeLifecycleInput): EmployeeLifecycleInput {
  return {
    status: "active",
    setup_status: "active",
    lifecycle_state: "active",
    start_date: "2026-08-01",
    end_date: null,
    deleted_at: null,
    ...input,
  };
}

describe("canonical employee lifecycle projection", () => {
  it("projects future hires as PRE_START without requiring a new database enum value", () => {
    expect(projectEmployeeLifecycle(employee({ start_date: "2026-09-01" }), NOW)).toBe("PRE_START");
    expect(canonicalLifecycleLabel("PRE_START")).toBe("Pre-start");
  });

  it("projects started employees without activated accounts as ONBOARDING", () => {
    expect(projectEmployeeLifecycle(employee({ setup_status: "incomplete" }), NOW)).toBe("ONBOARDING");
    expect(projectEmployeeLifecycle(employee({ lifecycle_state: "preboarding", setup_status: "ready" }), NOW)).toBe(
      "ONBOARDING",
    );
  });

  it("keeps active and on-leave employees in the ACTIVE lifecycle", () => {
    expect(projectEmployeeLifecycle(employee({}), NOW)).toBe("ACTIVE");
    expect(projectEmployeeLifecycle(employee({ status: "on_leave", lifecycle_state: "on_leave" }), NOW)).toBe("ACTIVE");
  });

  it("preserves explicit offboarding until the employee becomes former", () => {
    expect(projectEmployeeLifecycle(employee({ lifecycle_state: "offboarding" }), NOW)).toBe("OFFBOARDING");
    expect(projectEmployeeLifecycle(employee({ lifecycle_state: "offboarding", end_date: "2026-08-01" }), NOW)).toBe(
      "FORMER",
    );
  });

  it("projects inactive, deleted and exited employees as FORMER", () => {
    expect(projectEmployeeLifecycle(employee({ status: "inactive" }), NOW)).toBe("FORMER");
    expect(projectEmployeeLifecycle(employee({ lifecycle_state: "exited" }), NOW)).toBe("FORMER");
    expect(projectEmployeeLifecycle(employee({ deleted_at: "2026-08-10T00:00:00.000Z" }), NOW)).toBe("FORMER");
  });

  it("uses lifecycle projections for product eligibility decisions", () => {
    const futureHire = employee({ start_date: "2026-09-01" });
    const onboarding = employee({ setup_status: "ready" });
    const active = employee({});
    const former = employee({ status: "inactive" });

    expect(isCurrentEmployee(futureHire, NOW)).toBe(true);
    expect(isPolicyEligibleEmployee(onboarding, NOW)).toBe(true);
    expect(isOnboardingEligibleEmployee(futureHire, NOW)).toBe(true);
    expect(isOnboardingEligibleEmployee(active, NOW)).toBe(false);
    expect(isLeaveRequestEligibleEmployee(active, NOW)).toBe(true);
    expect(isLeaveRequestEligibleEmployee(onboarding, NOW)).toBe(false);
    expect(isSelfServiceEligibleEmployee(former, NOW)).toBe(false);
  });
});
