"use client";

import { useState, useTransition } from "react";
import { createBrowserClient } from "@supabase/ssr";

type EnrollState = {
  factorId: string;
  challengeId: string;
  secret: string;
  qrCode: string | null;
};

function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export function PlatformMfaClient() {
  const [enroll, setEnroll] = useState<EnrollState | null>(null);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function beginEnrollment() {
    startTransition(async () => {
      setMessage(null);
      const supabase = createClient();
      const { data: factor, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: "totp" });
      if (enrollError || !factor?.id || !factor.totp?.secret) {
        setMessage(enrollError?.message ?? "MFA enrollment could not start.");
        return;
      }
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: factor.id });
      if (challengeError || !challenge?.id) {
        setMessage(challengeError?.message ?? "MFA challenge could not start.");
        return;
      }
      setEnroll({
        factorId: factor.id,
        challengeId: challenge.id,
        secret: factor.totp.secret,
        qrCode: factor.totp.qr_code ?? null,
      });
    });
  }

  function verifyCode() {
    if (!enroll) return;
    startTransition(async () => {
      setMessage(null);
      const supabase = createClient();
      const { error } = await supabase.auth.mfa.verify({
        factorId: enroll.factorId,
        challengeId: enroll.challengeId,
        code,
      });
      if (error) {
        setMessage(error.message);
        return;
      }
      window.location.assign("/platform");
    });
  }

  return (
    <div className="mt-6 grid gap-4">
      {!enroll ? (
        <button type="button" onClick={beginEnrollment} disabled={isPending} className="tf-primary-action px-4 py-3 text-[14px]">
          {isPending ? "Starting..." : "Start authenticator setup"}
        </button>
      ) : (
        <div className="grid gap-4">
          {enroll.qrCode ? (
            <img src={enroll.qrCode} alt="Authenticator QR code" className="h-44 w-44 rounded-lg border border-ink-200 bg-white p-2" />
          ) : null}
          <div className="rounded-lg border border-ink-200 bg-ink-50 p-3">
            <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-ink-500">Manual key</p>
            <p className="mt-2 break-all font-mono text-[13px] text-ink-800">{enroll.secret}</p>
          </div>
          <label className="block text-[13px] font-bold text-ink-800">
            Six-digit code
            <input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              className="mt-2 w-full rounded-lg border border-ink-200 px-3 py-2 text-[15px]"
            />
          </label>
          <button type="button" onClick={verifyCode} disabled={isPending || code.trim().length < 6} className="tf-primary-action px-4 py-3 text-[14px]">
            {isPending ? "Verifying..." : "Verify and continue"}
          </button>
        </div>
      )}
      {message ? <p className="text-[13px] text-signal-red">{message}</p> : null}
    </div>
  );
}
