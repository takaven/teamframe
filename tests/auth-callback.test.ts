import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  verifyOtp: vi.fn(),
  exchangeCodeForSession: vi.fn(),
  getUser: vi.fn(),
  resolveIdentity: vi.fn(),
  track: vi.fn(),
}));

vi.mock("@/lib/db/supabaseServer", () => ({
  createServerClient: async () => ({
    auth: {
      verifyOtp: mocks.verifyOtp,
      exchangeCodeForSession: mocks.exchangeCodeForSession,
      getUser: mocks.getUser,
    },
  }),
}));

vi.mock("@/lib/rbac/roles", () => ({
  resolveIdentity: mocks.resolveIdentity,
}));

vi.mock("@/lib/telemetry/track", () => ({
  track: mocks.track,
}));

import { GET } from "@/app/auth/callback/route";

beforeEach(() => {
  mocks.verifyOtp.mockReset();
  mocks.exchangeCodeForSession.mockReset();
  mocks.getUser.mockReset();
  mocks.resolveIdentity.mockReset();
  mocks.track.mockReset();
  mocks.getUser.mockResolvedValue({ data: { user: null } });
});

function redirectLocation(response: Response): string {
  return response.headers.get("location") ?? "";
}

describe("auth callback", () => {
  it("returns a helpful expired-link reason for expired magic links", async () => {
    mocks.verifyOtp.mockResolvedValue({
      data: { user: null },
      error: { message: "Token has expired" },
    });

    const response = await GET(
      new Request("https://teamframe.example/auth/callback?token_hash=old&type=magiclink"),
    );

    expect(redirectLocation(response)).toBe(
      "https://teamframe.example/auth?error=callback_failed&reason=expired_link",
    );
  });

  it("rejects employee sessions that are not linked to an employee and tenant", async () => {
    mocks.verifyOtp.mockResolvedValue({
      data: { user: { id: "auth-user-1" } },
      error: null,
    });
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "auth-user-1" } },
    });
    mocks.resolveIdentity.mockResolvedValue({
      authUserId: "auth-user-1",
      email: "employee@example.test",
      employeeId: null,
      tenantId: "TENANT_A",
      role: "employee",
    });

    const response = await GET(
      new Request("https://teamframe.example/auth/callback?token_hash=fresh&type=magiclink"),
    );

    expect(redirectLocation(response)).toBe(
      "https://teamframe.example/auth?error=callback_failed&reason=invalid_tenant",
    );
    expect(mocks.track).not.toHaveBeenCalled();
  });

  it("sends a valid linked employee session to the self-service hub", async () => {
    mocks.verifyOtp.mockResolvedValue({
      data: { user: { id: "auth-user-1" } },
      error: null,
    });
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "auth-user-1" } },
    });
    mocks.resolveIdentity.mockResolvedValue({
      authUserId: "auth-user-1",
      email: "employee@example.test",
      employeeId: "emp-a",
      tenantId: "TENANT_A",
      role: "employee",
    });
    mocks.track.mockResolvedValue(undefined);

    const response = await GET(
      new Request("https://teamframe.example/auth/callback?token_hash=fresh&type=magiclink"),
    );

    expect(redirectLocation(response)).toBe("https://teamframe.example/me");
    expect(mocks.track).toHaveBeenCalledWith({
      tenantId: "TENANT_A",
      userId: "auth-user-1",
      eventName: "session_started",
      properties: { role: "employee" },
    });
  });
});
