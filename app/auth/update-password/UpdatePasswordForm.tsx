"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { BrandLogo } from "@/components/BrandLogo";
import { FloatingField } from "@/components/FloatingField";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";
import {
  canEnterPasswordRecovery,
  classifyRecoveryHash,
  updateRecoveredPassword,
} from "@/lib/auth/recovery";

type RecoveryStatus =
  | "checking"
  | "ready"
  | "submitting"
  | "success"
  | "invalid"
  | "cleanup_failed";

function requiredPublicEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing public authentication configuration: ${name}`);
  }
  return value;
}

export function UpdatePasswordForm({
  serverVerifiedRecovery,
  invalidReason,
}: {
  serverVerifiedRecovery: boolean;
  invalidReason: string | null;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<RecoveryStatus>("checking");
  const [message, setMessage] = useState<string | null>(null);
  const supabaseRef = useRef<ReturnType<typeof createBrowserClient> | null>(null);

  useEffect(() => {
    let active = true;
    let recoveryEventObserved = false;
    let invalidationTimer: number | null = null;
    const hashState = classifyRecoveryHash(window.location.hash);

    if (hashState === "invalid" || invalidReason) {
      setStatus("invalid");
      return;
    }

    if (hashState !== "recovery" && !serverVerifiedRecovery) {
      setStatus("invalid");
      return;
    }

    const supabase = createBrowserClient(
      requiredPublicEnv("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
      requiredPublicEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    );
    supabaseRef.current = supabase;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active || event !== "PASSWORD_RECOVERY" || !session?.user) return;
      recoveryEventObserved = true;
      setStatus("ready");
    });

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      const hasSession = Boolean(data.session) && !error;
      if (
        canEnterPasswordRecovery({
          hashState,
          serverVerifiedRecovery,
          recoveryEventObserved,
          hasSession,
        })
      ) {
        setStatus("ready");
        return;
      }

      if (!hasSession) {
        setStatus("invalid");
        return;
      }

      // Supabase emits PASSWORD_RECOVERY just after URL-session initialization.
      // A normal existing session never emits it and must not unlock this page.
      invalidationTimer = window.setTimeout(() => {
        if (active && !recoveryEventObserved) setStatus("invalid");
      }, 1000);
    });

    return () => {
      active = false;
      if (invalidationTimer !== null) window.clearTimeout(invalidationTimer);
      subscription.unsubscribe();
    };
  }, [invalidReason, serverVerifiedRecovery]);

  async function submitPassword(formData: FormData) {
    setMessage(null);
    setStatus("submitting");

    const supabase = supabaseRef.current;
    if (!supabase) {
      setMessage("Password reset is not ready. Open a fresh recovery link and try again.");
      setStatus("invalid");
      return;
    }

    const result = await updateRecoveredPassword(
      supabase,
      String(formData.get("password") ?? ""),
      String(formData.get("password_confirmation") ?? ""),
      async () => {
        const response = await fetch("/auth/update-password/complete", { method: "POST" });
        return response.ok;
      },
    );

    if (!result.ok) {
      setMessage(result.message);
      setStatus(result.passwordUpdated ? "cleanup_failed" : "ready");
      return;
    }

    setStatus("success");
    window.setTimeout(() => router.replace("/admin/login?password_updated=1"), 1200);
  }

  const invalid = status === "invalid";
  const success = status === "success";
  const pending = status === "checking" || status === "submitting";

  return (
    <main className="tf-auth-page">
      <div className="tf-auth-panel">
        <section className="tf-auth-brand-panel">
          <BrandLogo variant="lockup" className="h-7 w-auto" priority />
          <div className="mt-auto max-w-[420px]">
            <h1 className="text-[30px] font-extrabold leading-[1.18] tracking-[-0.8px] md:text-[40px] md:tracking-[-1.1px]">
              Secure your TeamFrame account
            </h1>
            <p className="mt-4 max-w-[400px] text-[15.5px] leading-normal text-[#B0B8C2] md:text-[17px]">
              Choose a new password, then sign in normally.
            </p>
          </div>
        </section>

        <section className="tf-auth-card">
          <h2 className="tf-auth-title">Set a new password</h2>

          {status === "checking" ? (
            <p className="mt-6 text-[14px] text-ink-500">Checking your password reset link…</p>
          ) : null}

          {invalid ? (
            <div className="mt-6 space-y-4">
              <p role="alert" className="text-[14px] text-signal-red">
                This password reset link is invalid or has expired.
              </p>
              <Link href="/admin/login" className="tf-primary-action inline-flex px-5 py-3 text-[14px]">
                Return to admin sign in
              </Link>
            </div>
          ) : null}

          {status === "cleanup_failed" ? (
            <div className="mt-6">
              <p role="alert" className="text-[14px] text-signal-red">
                {message}
              </p>
            </div>
          ) : null}

          {success ? (
            <div className="mt-6 space-y-3">
              <p role="status" className="text-[14px] text-signal-green">
                Your password has been updated. Returning you to sign in…
              </p>
              <Link href="/admin/login?password_updated=1" className="text-[14px] text-ink-700 underline">
                Continue to sign in
              </Link>
            </div>
          ) : null}

          {status === "ready" || status === "submitting" ? (
            <form action={submitPassword} className="mt-[34px] space-y-[22px]">
              <FloatingField
                label="New password"
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
              />
              <FloatingField
                label="Confirm new password"
                id="password_confirmation"
                name="password_confirmation"
                type="password"
                autoComplete="new-password"
                required
              />
              <PendingSubmitButton
                idleLabel="Update password"
                pendingLabel="Updating…"
                disabled={pending}
                disabledLabel={status === "submitting" ? "Updating…" : undefined}
                className="tf-brand-action tf-auth-submit h-12 w-full px-5 text-[15px]"
              />
              {message ? (
                <p role="alert" className="text-[13px] text-signal-red">
                  {message}
                </p>
              ) : null}
            </form>
          ) : null}
        </section>
      </div>
    </main>
  );
}
