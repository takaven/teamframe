import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  isServerRecoveryBoundToUser,
  updateRecoveredPassword,
} from "@/lib/auth/recovery";

describe("password recovery", () => {
  it("rejects a stale server marker after the active user changes", () => {
    expect(isServerRecoveryBoundToUser("recovered-user", "different-user")).toBe(false);
    expect(isServerRecoveryBoundToUser("recovered-user", "recovered-user")).toBe(true);
    expect(isServerRecoveryBoundToUser(undefined, "recovered-user")).toBe(false);
  });

  it("rejects mismatched passwords without calling Supabase", async () => {
    const updateUser = vi.fn();
    const signOut = vi.fn();

    const result = await updateRecoveredPassword(
      { auth: { updateUser, signOut } },
      "one-password",
      "another-password",
    );

    expect(result).toEqual({ ok: false, message: "Passwords do not match." });
    expect(updateUser).not.toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
  });

  it("updates only the active user's password and clears the local recovery session", async () => {
    const updateUser = vi.fn().mockResolvedValue({ error: null });
    const signOut = vi.fn().mockResolvedValue({ error: null });

    const result = await updateRecoveredPassword(
      { auth: { updateUser, signOut } },
      "new-password",
      "new-password",
    );

    expect(result).toEqual({ ok: true });
    expect(updateUser).toHaveBeenCalledWith({ password: "new-password" });
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("does not report full success when the recovery session cannot be cleared", async () => {
    const updateUser = vi.fn().mockResolvedValue({ error: null });
    const signOut = vi.fn().mockResolvedValue({ error: { message: "sign-out failed" } });

    const result = await updateRecoveredPassword(
      { auth: { updateUser, signOut } },
      "new-password",
      "new-password",
    );

    expect(result).toMatchObject({ ok: false, passwordUpdated: true });
  });

  it("does not report full success when the one-time recovery marker cannot be consumed", async () => {
    const updateUser = vi.fn().mockResolvedValue({ error: null });
    const signOut = vi.fn().mockResolvedValue({ error: null });

    const result = await updateRecoveredPassword(
      { auth: { updateUser, signOut } },
      "new-password",
      "new-password",
      async () => false,
    );

    expect(result).toMatchObject({ ok: false, passwordUpdated: true });
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("keeps recovery code free of service-role access and token logging", () => {
    const source = [
      "app/auth/callback/route.ts",
      "app/auth/update-password/UpdatePasswordForm.tsx",
      "app/auth/update-password/page.tsx",
      "lib/auth/recovery.ts",
    ]
      .map((file) => readFileSync(join(process.cwd(), file), "utf8"))
      .join("\n");

    expect(source).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(source).not.toContain("console.log");
  });

  it("uses only the server-verified recovery marker and no implicit fragment flow", () => {
    const updateForm = readFileSync(
      join(process.cwd(), "app/auth/update-password/UpdatePasswordForm.tsx"),
      "utf8",
    );
    const publicPage = readFileSync(join(process.cwd(), "app/page.tsx"), "utf8");

    expect(updateForm).toContain("serverVerifiedRecovery");
    expect(updateForm).not.toContain("window.location.hash");
    expect(updateForm).not.toContain("PASSWORD_RECOVERY");
    expect(publicPage).not.toContain("RecoveryRedirect");
  });
});
