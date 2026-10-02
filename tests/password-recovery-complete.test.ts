import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  marker: "recovered-user" as string | undefined,
  getUser: vi.fn(),
  updateUser: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "tf-password-recovery" && mocks.marker
        ? { name, value: mocks.marker }
        : undefined,
  }),
}));

vi.mock("@/lib/db/supabaseServer", () => ({
  createServerClient: async () => ({
    auth: {
      getUser: mocks.getUser,
      updateUser: mocks.updateUser,
      signOut: mocks.signOut,
    },
  }),
}));

import { POST } from "@/app/auth/update-password/complete/route";

function request(password = "new-password", confirmation = password): Request {
  return new Request("https://teamframe.example/auth/update-password/complete", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ password, confirmation }),
  });
}

beforeEach(() => {
  mocks.marker = "recovered-user";
  mocks.getUser.mockReset();
  mocks.updateUser.mockReset();
  mocks.signOut.mockReset();
  mocks.getUser.mockResolvedValue({ data: { user: { id: "recovered-user" } } });
  mocks.updateUser.mockResolvedValue({ error: null });
  mocks.signOut.mockResolvedValue({ error: null });
});

describe("password recovery completion", () => {
  it("revalidates the recovery marker at mutation time before updating", async () => {
    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(mocks.updateUser).toHaveBeenCalledWith({ password: "new-password" });
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(response.headers.get("set-cookie")).toContain("tf-password-recovery=");
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });

  it("rejects an expired marker after the form was rendered", async () => {
    mocks.marker = undefined;

    const response = await POST(request());

    expect(response.status).toBe(403);
    expect(mocks.updateUser).not.toHaveBeenCalled();
    expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it("rejects a browser session that changed after render", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "different-user" } } });

    const response = await POST(request());

    expect(response.status).toBe(403);
    expect(mocks.updateUser).not.toHaveBeenCalled();
    expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it("rejects password mismatch before calling Supabase", async () => {
    const response = await POST(request("one-password", "another-password"));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ ok: false, message: "Passwords do not match." });
    expect(mocks.updateUser).not.toHaveBeenCalled();
    expect(mocks.signOut).not.toHaveBeenCalled();
  });
});
