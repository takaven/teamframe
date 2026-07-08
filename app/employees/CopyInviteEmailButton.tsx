"use client";

import { useState } from "react";

export function CopyInviteEmailButton({
  email,
  copyValue,
  idleLabel,
  copiedLabel,
}: {
  email: string;
  copyValue?: string;
  idleLabel?: string;
  copiedLabel?: string;
}) {
  const [copied, setCopied] = useState(false);
  const valueToCopy = copyValue ?? email;
  const idleText = idleLabel ?? "Copy invite email";
  const copiedText = copiedLabel ?? "Email copied";

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(valueToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={copyEmail}
      className="w-full rounded-full border border-ink-300 px-3 py-1 text-[12px] text-ink-700 transition hover:border-ink-900 hover:text-ink-900 sm:w-auto"
      aria-label={`Copy value ${email}`}
    >
      {copied ? copiedText : idleText}
    </button>
  );
}
