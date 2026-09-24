import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  requireTenantRole: vi.fn(),
  loadControlCentreData: vi.fn(),
}));

vi.mock("@/middleware/rbac", () => ({
  requireTenantRole: mocks.requireTenantRole,
}));

vi.mock("@/app/dashboard/data", () => ({
  loadControlCentreData: mocks.loadControlCentreData,
}));

vi.mock("@/components/AppShell", () => ({
  AppShell: () => null,
}));

import DashboardPage from "@/app/dashboard/page";

beforeEach(() => {
  mocks.requireTenantRole.mockReset();
  mocks.loadControlCentreData.mockReset();
  mocks.requireTenantRole.mockResolvedValue({
    authUserId: "admin-a",
    email: "admin-a@example.test",
    employeeId: null,
    tenantId: "TENANT_A",
    role: "admin",
  });
});

describe("dashboard rendered states", () => {
  it("renders a truthful empty Home state", async () => {
    mocks.loadControlCentreData.mockResolvedValue({
      savedDataStatus: { state: "success" },
      summary: { total: 0, due: 0, overdue: 0, decisions: 0, exceptions: 0, resolved: 0 },
      previewItems: [],
      allItems: [],
      resolvedItems: [],
      activeEmployeeCount: 3,
    });

    const html = renderToStaticMarkup(await DashboardPage());

    expect(html).toContain("Needs your attention");
    expect(html).toContain("Nothing needs attention right now.");
    expect(html).toContain("Coming up");
    expect(html).toContain("Quick actions");
  });

  it("limits the primary list and separates future work", async () => {
    const now = new Date();
    const currentDue = new Date(now);
    currentDue.setDate(currentDue.getDate() + 2);
    const futureDue = new Date(now);
    futureDue.setDate(futureDue.getDate() + 14);
    const allItems = Array.from({ length: 8 }, (_, index) => ({
      id: `item-${index}`,
      class: "due",
      source: "onboarding_task",
      title: index === 7 ? "Future-only task" : `Task ${index}`,
      subjectName: "Amina Rahman",
      owner: "Amina Rahman",
      nextAction: "Open task",
      dueAt: index === 7 ? futureDue.toISOString() : currentDue.toISOString(),
      updatedAt: `2026-08-12T00:00:0${index}Z`,
      href: "/onboarding",
      detail: "Onboarding work is due.",
      priority: 40,
    }));
    mocks.loadControlCentreData.mockResolvedValue({
      savedDataStatus: { state: "success" },
      summary: { total: 8, due: 8, overdue: 0, decisions: 0, exceptions: 0, resolved: 1 },
      previewItems: allItems.slice(0, 6),
      allItems,
      resolvedItems: [
        {
          id: "resolved-a",
          source: "signal:leave_conflict",
          title: "Leave conflict",
          subjectName: "Amina Rahman",
          resolvedAt: "2026-08-11T12:00:00Z",
          href: "/leaves",
          detail: "Resolution retained in Signal and audit history.",
        },
      ],
      activeEmployeeCount: 3,
    });

    const html = renderToStaticMarkup(await DashboardPage());

    expect(html).toContain("Needs your attention");
    expect(html).toContain("Recently done");
    expect(html).toContain("Add person");
    expect(html).not.toContain("Request document");
    expect(html).not.toContain("Record time off");
    expect(html.match(/Future-only task/g)).toHaveLength(1);
  });

  it("does not show all-clear when the current-state read fails", async () => {
    mocks.loadControlCentreData.mockResolvedValue({
      savedDataStatus: { state: "failed", message: "provider unavailable" },
      summary: { total: 0, due: 0, overdue: 0, decisions: 0, exceptions: 0, resolved: 0 },
      previewItems: [],
      allItems: [],
      resolvedItems: [],
      activeEmployeeCount: 0,
    });

    const html = renderToStaticMarkup(await DashboardPage());

    expect(html).toContain("Your attention list could not load just now.");
    expect(html).toContain("Retry");
    expect(html).not.toContain("All clear");
  });
});
