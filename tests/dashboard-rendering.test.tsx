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
  it("renders a truthful empty Control Centre state", async () => {
    mocks.loadControlCentreData.mockResolvedValue({
      savedDataStatus: { state: "success" },
      summary: { total: 0, due: 0, overdue: 0, decisions: 0, exceptions: 0, resolved: 0 },
      previewItems: [],
      allItems: [],
      resolvedItems: [],
      activeEmployeeCount: 3,
    });

    const html = renderToStaticMarkup(await DashboardPage());

    expect(html).toContain("HR Control Centre");
    expect(html).toContain("No HR actions need your attention right now.");
    expect(html).toContain("Decisions");
    expect(html).toContain("Active");
  });

  it("shows preview count separately from the full current list", async () => {
    const allItems = Array.from({ length: 8 }, (_, index) => ({
      id: `item-${index}`,
      class: "due",
      source: "onboarding_task",
      title: `Task ${index}`,
      subjectName: "Amina Rahman",
      dueAt: "2026-08-12T00:00:00.000Z",
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

    expect(html).toContain("Showing 6 of 8 current items");
    expect(html).toContain("View all");
    expect(html).toContain("8 total");
    expect(html).toContain("Recent resolutions");
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

    expect(html).toContain("Control Centre data could not load yet.");
    expect(html).toContain("Retry");
    expect(html).toContain("The current-state read failed safely.");
  });
});
