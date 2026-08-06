import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  requireTenantRole: vi.fn(),
  runSignalEngine: vi.fn(),
  revalidatePath: vi.fn(),
  createServiceRoleClient: vi.fn(),
}));

vi.mock("@/middleware/rbac", () => ({
  requireTenantRole: mocks.requireTenantRole,
}));

vi.mock("@/services/signalEngine", () => ({
  runSignalEngineForTenant: mocks.runSignalEngine,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("@/lib/db/supabaseServer", () => ({
  createServiceRoleClient: mocks.createServiceRoleClient,
}));

vi.mock("@/components/AppShell", () => ({
  AppShell: () => null,
}));

vi.mock("@/app/dashboard/SignalSection", () => ({
  SignalSection: () => null,
}));

import { executeActionItemAction } from "@/app/dashboard/actions";

beforeEach(() => {
  mocks.requireTenantRole.mockReset();
  mocks.runSignalEngine.mockReset();
  mocks.revalidatePath.mockReset();
  mocks.createServiceRoleClient.mockReset();
});

describe("dashboard authorization", () => {
  it("denies non-admin page access before service-role dashboard queries run", async () => {
    const source = readFileSync(join(process.cwd(), "app", "dashboard", "page.tsx"), "utf8");

    expect(source).toContain('import { requireTenantRole } from "@/middleware/rbac";');
    expect(source).toContain('loadDashboardData');
    expect(source).toContain('const actor = await requireTenantRole("admin");');
    expect(source.indexOf('const actor = await requireTenantRole("admin");')).toBeLessThan(
      source.indexOf("loadDashboardData({"),
    );
  });

  it("denies non-admin dashboard actions before mutating action items", async () => {
    mocks.requireTenantRole.mockRejectedValue(new Error("FORBIDDEN"));
    const formData = new FormData();
    formData.set("actionItemId", "11111111-1111-4111-8111-111111111111");
    formData.set("nextStatus", "done");

    await expect(executeActionItemAction(formData)).rejects.toThrow("FORBIDDEN");

    expect(mocks.requireTenantRole).toHaveBeenCalledWith("admin");
    expect(mocks.createServiceRoleClient).not.toHaveBeenCalled();
    expect(mocks.runSignalEngine).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
