"use client";

/**
 * Resend magic link (Wave 2 — gap audit 2026-05-30, /auth/check-email).
 *
 * Reuses the existing rate-limited sendMagicLink server action. The 60s
 * cooldown here is UX only (persisted in sessionStorage so it survives the
 * post-submit redirect back to this page); the server-side email and IP rate
 * limits remain the real control.
 */

import { useEffect, useState } from "react";
import { sendMagicLink } from "../actions";

const COOLDOWN_SECONDS = 60;

export function ResendLinkForm({ email }: { email: string }) {
  const storageKey = `tf_resend_${email}`;
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    const compute = () => {
      const raw = window.sessionStorage.getItem(storageKey);
      const lastMs = raw ? Number(raw) : 0;
      if (!Number.isFinite(lastMs) || lastMs <= 0) {
        setRemaining(0);
        return;
      }
      const elapsedSeconds = Math.floor((Date.now() - lastMs) / 1000);
      setRemaining(Math.max(0, COOLDOWN_SECONDS - elapsedSeconds));
    };
    compute();
    const timer = window.setInterval(compute, 1000);
    return () => window.clearInterval(timer);
  }, [storageKey]);

  const coolingDown = remaining > 0;

  return (
    <form
      action={sendMagicLink}
      onSubmit={() => window.sessionStorage.setItem(storageKey, String(Date.now()))}
    >
      <input type="hidden" name="email" value={email} />
      <input type="hidden" name="context" value="check_email" />
      <button
        type="submit"
        disabled={coolingDown}
        className="inline-flex items-center rounded-full border border-ink-300 px-4 py-1.5 text-[14px] text-ink-700 transition hover:border-ink-900 hover:text-ink-900 disabled:cursor-not-allowed disabled:border-ink-300/50 disabled:text-ink-300"
      >
        {coolingDown ? `Resend available in ${remaining}s` : "Resend link"}
      </button>
    </form>
  );
}
