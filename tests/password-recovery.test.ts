import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  canEnterPasswordRecovery,
  classifyRecoveryHash,
  isServerRecoveryBoundToUser,
  recoveryRedirectDestination,
  updateRecoveredPassword,
} from "@/lib/auth/recovery";

describe("password recovery", () => {
  it("routes a Supabase recovery fragment without reading or logging token values", () => {
    const hash = "#access_token=secret&refresh_token=secret&type=recovery";

    expect(classifyRecoveryHash(hash)).toBe("recovery");
    expect(recoveryRedirectDestination(hash)).toBe(`/auth/update-password${hash}`);
  });

  it("routes an expired provider fragment to an explicit invalid state", () => {
    const hash = "#error=access_denied&error_code=otp_expired";

    expect(classifyRecoveryHash(hash)).toBe("invalid");
    expect(recoveryRedirectDestination(hash)).toBe(
      "/auth/update-password?reason=invalid_or_expired",
    );
  });

  it("does not intercept ordinary application fragments", () => {
    expect(recoveryRedirectDestination("#documents")).toBeNull();
  });

  it("rejects an ordinary session without a verified recovery event", () => {
    expect(
      canEnterPasswordRecovery({
        hashState: "recovery",
        serverVerifiedRecovery: false,
        recoveryEventObserved: false,
        hasSession: true,
      }),
    ).toBe(false);
  });

  it("accepts the observed implicit recovery flow only after Supabase emits recovery", () => {
    expect(
      canEnterPasswordRecovery({
        hashState: "recovery",
        serverVerifiedRecovery: false,
        recoveryEventObserved: true,
        hasSession: true,
      }),
    ).toBe(true);
  });

  it("accepts a server-verified recovery callback only with an active session", () => {
    expect(
      canEnterPasswordRecovery({
        hashState: "none",
        serverVerifiedRecovery: true,
        recoveryEventObserved: false,
        hasSession: true,
      }),
    ).toBe(true);
    expect(
      canEnterPasswordRecovery({
        hashState: "none",
        serverVerifiedRecovery: true,
        recoveryEventObserved: false,
        hasSession: false,
      }),
    ).toBe(false);
  });

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
      "app/auth/update-password/UpdatePasswordForm.tsx",
      "components/RecoveryRedirect.tsx",
      "lib/auth/recovery.ts",
    ]
      .map((file) => readFileSync(join(process.cwd(), file), "utf8"))
      .join("\n");

    expect(source).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(source).not.toContain("console.log");
    expect(source).not.toContain("console.error");
  });
});
