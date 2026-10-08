import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/supabaseServer", () => ({ createServiceRoleClient: vi.fn() }));
vi.mock("@/lib/telemetry/track", () => ({ track: vi.fn() }));
vi.mock("@/lib/telemetry/logger", () => ({ logSchemaCapability: vi.fn() }));
vi.mock("@/services/onboardingService", () => ({ maybeFireActivationCompleted: vi.fn() }));

import { CreateEmployeeInputSchema } from "@/services/employeeService";

const base = {
  full_name: "Synthetic Person",
  email: "synthetic@example.test",
  role_title: "Analyst",
  department: "Operations",
  timezone: "Asia/Dubai",
  employment_type: "full_time",
  country: "AE",
  start_date: "2026-10-15",
};

describe("new-starter probation intent", () => {
  it("accepts explicit probation with an explicit contractual end date", () => {
    expect(CreateEmployeeInputSchema.safeParse({ ...base, probation_used: true, probation_end_date: "2027-01-15" }).success).toBe(true);
  });

  it("accepts explicit no-probation without a date", () => {
    expect(CreateEmployeeInputSchema.safeParse({ ...base, probation_used: false }).success).toBe(true);
  });

  it("rejects omitted intent and a date supplied without affirmative intent", () => {
    expect(CreateEmployeeInputSchema.safeParse(base).success).toBe(false);
    expect(CreateEmployeeInputSchema.safeParse({ ...base, probation_end_date: "2027-01-15" }).success).toBe(false);
  });

  it("allows an established-workforce import to omit probation intent", () => {
    expect(CreateEmployeeInputSchema.safeParse({ ...base, initialize_join_work: false, setup_status: "active" }).success).toBe(true);
    expect(CreateEmployeeInputSchema.safeParse({ ...base, initialize_join_work: false, probation_used: true, probation_end_date: "2027-01-15" }).success).toBe(false);
  });
});
