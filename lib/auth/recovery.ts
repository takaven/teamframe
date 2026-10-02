export type RecoveryHashState = "recovery" | "invalid" | "none";

export const RECOVERY_COOKIE_NAME = "tf-password-recovery";

function fragmentParams(hash: string): URLSearchParams {
  return new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
}

export function classifyRecoveryHash(hash: string): RecoveryHashState {
  const params = fragmentParams(hash);

  if (params.get("type") === "recovery") {
    return "recovery";
  }

  if (params.get("error") === "access_denied" && params.get("error_code")) {
    return "invalid";
  }

  return "none";
}

export function recoveryRedirectDestination(hash: string): string | null {
  const state = classifyRecoveryHash(hash);

  if (state === "recovery") {
    return `/auth/update-password${hash}`;
  }

  if (state === "invalid") {
    return "/auth/update-password?reason=invalid_or_expired";
  }

  return null;
}

export type PasswordUpdateClient = {
  auth: {
    updateUser(input: { password: string }): Promise<{ error: { message: string } | null }>;
    signOut(options: { scope: "local" }): Promise<{ error: { message?: string } | null }>;
  };
};

export type PasswordUpdateResult =
  | { ok: true }
  | { ok: false; message: string; passwordUpdated?: boolean };

export function canEnterPasswordRecovery(input: {
  hashState: RecoveryHashState;
  serverVerifiedRecovery: boolean;
  recoveryEventObserved: boolean;
  hasSession: boolean;
}): boolean {
  if (!input.hasSession) return false;
  if (input.serverVerifiedRecovery) return true;
  return input.hashState === "recovery" && input.recoveryEventObserved;
}

export function isServerRecoveryBoundToUser(
  recoveryUserId: string | undefined,
  activeUserId: string | undefined,
): boolean {
  return Boolean(recoveryUserId && activeUserId && recoveryUserId === activeUserId);
}

export async function updateRecoveredPassword(
  client: PasswordUpdateClient,
  password: string,
  confirmation: string,
  clearRecoveryMarker: () => Promise<boolean> = async () => true,
): Promise<PasswordUpdateResult> {
  if (!password) {
    return { ok: false, message: "Enter a new password." };
  }

  if (password !== confirmation) {
    return { ok: false, message: "Passwords do not match." };
  }

  const { error } = await client.auth.updateUser({ password });
  if (error) {
    return { ok: false, message: error.message || "Password could not be updated." };
  }

  let markerCleared = false;
  try {
    markerCleared = await clearRecoveryMarker();
  } catch {
    markerCleared = false;
  }

  const { error: signOutError } = await client.auth.signOut({ scope: "local" });
  if (signOutError || !markerCleared) {
    return {
      ok: false,
      passwordUpdated: true,
      message:
        "Your password was updated, but the recovery session could not be cleared. Close this browser before signing in again.",
    };
  }
  return { ok: true };
}
