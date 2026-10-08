import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/supabaseServer", () => ({ createServiceRoleClient: vi.fn(), createServerClient: vi.fn() }));
vi.mock("@/lib/telemetry/track", () => ({ track: vi.fn() }));
vi.mock("@/services/onboardingService", () => ({ maybeFireActivationCompleted: vi.fn() }));
vi.mock("@/services/documentService", () => ({ uploadDocument: vi.fn(), softDeleteDocument: vi.fn() }));
vi.mock("@/services/offboardingService", () => ({ assertLeaveDoesNotExceedActiveOffboardingEndDate: vi.fn() }));

import { projectEntitlementTiming } from "@/services/leaveService";
import { readFileSync } from "node:fs";

describe("leave entitlement timing projection", () => {
  it("preserves every supported single timing strategy", () => {
    expect(projectEntitlementTiming({ accrual_enabled: false, accrual_frequency: "monthly", joining_date_pro_rata: false })).toBe("upfront");
    expect(projectEntitlementTiming({ accrual_enabled: false, accrual_frequency: "monthly", joining_date_pro_rata: true })).toBe("joining_date_proration");
    expect(projectEntitlementTiming({ accrual_enabled: true, accrual_frequency: "monthly", joining_date_pro_rata: false })).toBe("monthly_accrual");
    expect(projectEntitlementTiming({ accrual_enabled: true, accrual_frequency: "annual", joining_date_pro_rata: false })).toBe("annual_accrual");
  });

  it("flags a legacy dual setting instead of reinterpreting it", () => {
    expect(projectEntitlementTiming({ accrual_enabled: true, accrual_frequency: "annual", joining_date_pro_rata: true })).toBe("legacy_review_required");
  });

  it("requires an explicit valid edit choice and preserves annual frequency", () => {
    const settings = readFileSync("components/LeaveDefinitionsSettings.tsx", "utf8");
    const actions = readFileSync("app/setup/actions.ts", "utf8");
    const leaveService = readFileSync("services/leaveService/index.ts", "utf8");
    expect(settings).toContain('value="annual_accrual"');
    expect(settings).toContain('definition.accrual_frequency === "annual" ? "annual_accrual"');
    expect(settings).toContain('name="entitlement_timing"');
    expect(settings).toContain("required className=\"tf-select mt-1\"");
    expect(actions).toContain('z.enum(["upfront", "joining_date_proration", "monthly_accrual", "annual_accrual"])');
    expect(actions).toContain('timing === "annual_accrual" ? "annual" : "monthly"');
    expect(leaveService).toContain("default_entitlement_days, accrual_enabled, accrual_frequency, joining_date_pro_rata");
  });
});
