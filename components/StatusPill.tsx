import type { ReactNode } from "react";

/**
 * StatusPill — the one pill component (Wave 3, Task 4a).
 *
 * Replaces the ad-hoc `rounded-full border … text-[11px]` class strings that
 * were repeated across dashboard, leaves, employees, onboarding, and policies.
 * Severity tones map to the signal tokens in app/globals.css so every pill in
 * the product draws from the same three accents.
 */
export type StatusPillTone = "red" | "amber" | "green" | "neutral" | "info";

const TONE_CLASSES: Record<StatusPillTone, string> = {
  red: "border-signal-red/30 bg-signal-red/10 text-signal-red",
  amber: "border-signal-amber/30 bg-signal-amber/10 text-signal-amber",
  green: "border-signal-green/30 bg-signal-green/10 text-signal-green",
  neutral: "border-ink-300 bg-ink-100 text-ink-700",
  info: "border-accent/30 bg-accent/10 text-accent",
};

export function StatusPill({
  tone,
  children,
  className = "",
}: {
  tone: StatusPillTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium transition ${TONE_CLASSES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
