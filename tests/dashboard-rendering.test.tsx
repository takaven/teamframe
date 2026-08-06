import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  requireTenantRole: vi.fn(),
  loadDashboardData: vi.fn(),
}));

vi.mock("@/middleware/rbac", () => ({
  requireTenantRole: mocks.requireTenantRole,
}));

vi.mock("@/app/dashboard/data", () => ({
  loadDashboardData: mocks.loadDashboardData,
}));

vi.mock("@/components/AppShell", () => ({
  AppShell: () => null,
}));

vi.mock("@/app/dashboard/SignalSection", () => ({
  SignalSection: ({ title, signals }: { title: string; signals: unknown[] }) => (
    <section>
      <h2>{title}</h2>
      <p>{signals.length} signals</p>
    </section>
  ),
}));

import DashboardPage from "@/app/dashboard/page";

beforeEach(() => {
  mocks.requireTenantRole.mockReset();
  mocks.loadDashboardData.mockReset();
  mocks.requireTenantRole.mockResolvedValue({
    authUserId: "admin-a",
    email: "admin-a@example.test",
    employeeId: null,
    tenantId: "TENANT_A",
    role: "admin",
  });
});

describe("dashboard rendered states", () => {
  it("keeps showing saved signals without a warning when live refresh times out", async () => {
    mocks.loadDashboardData.mockResolvedValue({
      refreshStatus: { state: "timeout" },
      savedDataStatus: { state: "success" },
      signals: [
        {
          id: "signal-a",
          kind: "missing_contract",
          severity: "red",
          subject_employee_id: "emp-a",
          evidence: null,
          last_seen_at: "2026-08-06T08:00:00Z",
          resolved_at: null,
        },
      ],
      actions: [],
      employees: [{ id: "emp-a", full_name: "Amina Rahman" }],
    });

    const html = renderToStaticMarkup(await DashboardPage());

    expect(html).not.toContain("Showing the latest saved signals.");
    expect(html).toContain("People-ops risk dashboard");
    expect(html).toContain("Priority signal");
  });

  it("shows a retryable empty state when saved dashboard data times out", async () => {
    mocks.loadDashboardData.mockResolvedValue({
      refreshStatus: { state: "success" },
      savedDataStatus: { state: "timeout" },
      signals: [],
      actions: [],
      employees: [],
    });

    const html = renderToStaticMarkup(await DashboardPage());

    expect(html).toContain("Dashboard data could not load yet.");
    expect(html).toContain("Retry dashboard");
    expect(html).toContain("No open risk signals right now.");
  });
});
