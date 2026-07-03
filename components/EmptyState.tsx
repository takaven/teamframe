import Link from "next/link";
import type { ReactNode } from "react";

/**
 * EmptyState — the one empty-state component (Wave 3, Task 4b).
 *
 * Icon-optional, one sentence, one optional CTA. The optional `hint` line
 * preserves the guided two-line copy introduced in Wave 2 (e.g. "New requests
 * from employees will appear here…") so adopting the component does not
 * regress that work.
 */
export function EmptyState({
  icon,
  message,
  hint,
  cta,
  className = "",
}: {
  icon?: ReactNode;
  message: string;
  hint?: string;
  cta?: { label: string; href: string };
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-dashed border-ink-300/80 bg-white/60 px-5 py-8 text-center ${className}`}
    >
      {icon ? (
        <div className="mx-auto mb-3 flex h-8 w-8 items-center justify-center text-ink-500" aria-hidden="true">
          {icon}
        </div>
      ) : null}
      <p className="text-[15px] text-ink-700">{message}</p>
      {hint ? <p className="mt-2 text-[14px] text-ink-500">{hint}</p> : null}
      {cta ? (
        <Link
          href={cta.href}
          className="mt-3 inline-flex items-center gap-1 text-[14px] text-ink-700 underline decoration-ink-300 underline-offset-4 transition hover:decoration-ink-900"
        >
          {cta.label}
        </Link>
      ) : null}
    </div>
  );
}
