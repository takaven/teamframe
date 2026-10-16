import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));
vi.mock("@/middleware/rbac", () => ({ requireTenantActor: vi.fn() }));
vi.mock("@/services/employeeService", () => ({
  createEmployee: vi.fn(),
  generateEmployeeActivationLink: vi.fn(),
  reinviteEmployee: vi.fn(),
  softDeleteEmployee: vi.fn(),
  updateEmployee: vi.fn(),
  updateEmployeeAnnualLeaveEntitlementOverride: vi.fn(),
}));
vi.mock("@/services/onboardingService/checklistTemplates", () => ({ assignDefaultChecklist: vi.fn() }));
vi.mock("@/services/notificationService", () => ({ notifyDocumentRequest: vi.fn(), notifyOffboardingAssignment: vi.fn() }));
vi.mock("@/services/employmentChangeService", () => ({ cancelEmploymentChange: vi.fn(), recordEmploymentChange: vi.fn() }));
vi.mock("@/services/offboardingService", () => ({ cancelOffboarding: vi.fn(), completeOffboardingItem: vi.fn(), startOffboarding: vi.fn() }));
vi.mock("@/services/documentService", () => ({
  exportFinanceHandoffUrl: vi.fn(), exportEmployeeDueDiligencePackUrl: vi.fn(), getSignedDownloadUrl: vi.fn(),
  createDocumentRequirement: vi.fn(), reviewDocumentRequirement: vi.fn(), softDeleteDocument: vi.fn(),
  uploadDocument: vi.fn(), uploadDocumentForRequirement: vi.fn(),
}));
vi.mock("@/services/employeeMasterService", () => ({ setEmployeePhoto: vi.fn() }));
vi.mock("@/services/selfServiceService", () => ({ updateEmployeePersonalProfile: vi.fn() }));
vi.mock("@/services/compensationService", () => ({ saveEmployeeCompensation: vi.fn() }));
vi.mock("@/services/hirePeopleHandoff", () => ({ createEmployeeFromReviewedHire: vi.fn() }));
vi.mock("@/lib/telemetry/logger", () => ({ logAction: vi.fn() }));
vi.mock("@/lib/telemetry/sentry", () => ({ captureActionError: vi.fn() }));

import { redirect } from "next/navigation";
import { requireTenantActor } from "@/middleware/rbac";
import { createEmployee } from "@/services/employeeService";
import { assignDefaultChecklist } from "@/services/onboardingService/checklistTemplates";
import { createEmployeeAction } from "@/app/employees/actions";

const actor = { role: "admin", tenantId: "tenant-1", authUserId: "operator-1" } as const;

function employeeForm(): FormData {
  const form = new FormData();
  form.set("full_name", "Synthetic Person");
  form.set("email", "synthetic@example.invalid");
  form.set("role_title", "Analyst");
  form.set("department", "Operations");
  form.set("timezone", "UTC");
  form.set("employment_type", "full_time");
  form.set("country", "MU");
  form.set("start_date", "2026-10-20");
  form.set("probation_used", "no");
  return form;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireTenantActor).mockResolvedValue(actor as never);
  vi.mocked(createEmployee).mockResolvedValue({ id: "employee-1" } as never);
  vi.mocked(assignDefaultChecklist).mockResolvedValue(1);
});

describe("employee creation completion feedback", () => {
  it("reports complete success when the default checklist assignment succeeds", async () => {
    await expect(createEmployeeAction(employeeForm())).rejects.toThrow("REDIRECT:/people/employee-1?status=created");
    expect(createEmployee).toHaveBeenCalledTimes(1);
    expect(assignDefaultChecklist).toHaveBeenCalledTimes(1);
  });

  it("keeps the employee and reports partial success when checklist assignment fails", async () => {
    vi.mocked(assignDefaultChecklist).mockRejectedValueOnce(new Error("synthetic checklist failure"));

    await expect(createEmployeeAction(employeeForm())).rejects.toThrow(
      "REDIRECT:/people/employee-1?status=created_onboarding_incomplete",
    );
    expect(createEmployee).toHaveBeenCalledTimes(1);
    expect(assignDefaultChecklist).toHaveBeenCalledTimes(1);
    expect(redirect).toHaveBeenCalledWith("/people/employee-1?status=created_onboarding_incomplete");
  });
});
