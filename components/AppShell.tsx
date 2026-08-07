import Link from "next/link";
import type { Actor } from "@/middleware/rbac";
import { SignOutButton } from "@/components/SignOutButton";
import { BrandLogo } from "@/components/BrandLogo";
import {
  countOpenSignals,
  type OpenSignalCounts,
} from "@/services/signalEngine/signalRepository";

/**
 * AppShell — the shared top navigation for every authenticated surface
 * (Wave 3, Task 2). Server component; keeps the existing top-nav pattern.
 *
 * - Wordmark in the display face (Fraunces).
 * - Role-appropriate links with active state.
 * - Risk Pulse (admins only, Task 3): one dot + label derived from open
 *   risk_signals via a single read-only count query. Links to /dashboard.
 */

const ADMIN_LINKS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/employees", label: "Employees" },
  { href: "/onboarding", label: "Onboarding" },
  { href: "/leaves", label: "Leave" },
  { href: "/policies", label: "Policies" },
] as const;

const EMPLOYEE_LINKS = [
  { href: "/me", label: "Me" },
  { href: "/onboarding", label: "Onboarding" },
  { href: "/leaves", label: "Leave" },
] as const;

type RiskPulseState = {
  tone: "red" | "amber" | "green";
  count: number | null;
  label: string;
};

function derivePulse(counts: OpenSignalCounts): RiskPulseState {
  if (counts.red > 0) {
    return { tone: "red", count: counts.red, label: "urgent" };
  }
  if (counts.yellow > 0) {
    return {
      tone: "amber",
      count: counts.yellow,
      label: counts.yellow === 1 ? "needs attention" : "need attention",
    };
  }
  return { tone: "green", count: null, label: "All clear" };
}

const PULSE_DOT: Record<RiskPulseState["tone"], string> = {
  red: "bg-signal-red",
  amber: "bg-signal-amber",
  green: "bg-signal-green",
};

function RiskPulse({ pulse }: { pulse: RiskPulseState }) {
  return (
    <Link
      href="/dashboard"
      aria-label={`Risk pulse: ${pulse.count === null ? "" : `${pulse.count} `}${pulse.label}. Open dashboard.`}
      className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[12px] text-ink-100 transition hover:border-brand-signal hover:text-white"
    >
      <span className={`h-2 w-2 shrink-0 rounded-full ${PULSE_DOT[pulse.tone]}`} aria-hidden="true" />
      {pulse.count === null ? (
        <span>{pulse.label}</span>
      ) : (
        <span>
          <span className="font-mono tabular-nums">{pulse.count}</span> {pulse.label}
        </span>
      )}
    </Link>
  );
}

export async function AppShell({
  actor,
  activePath,
}: {
  actor: Actor;
  activePath: string;
}) {
  const links = actor.role === "admin" ? ADMIN_LINKS : EMPLOYEE_LINKS;

  let pulse: RiskPulseState | null = null;
  if (actor.role === "admin") {
    try {
      pulse = derivePulse(await countOpenSignals(actor));
    } catch (error) {
      // The pulse is a nav ornament — a count failure must not take down the
      // page. Log loudly and render the nav without it.
      console.error("[RISK_PULSE_COUNT_FAILED]", error);
    }
  }

  return (
    <nav
      aria-label="Primary"
      className="mb-7 flex flex-wrap items-center gap-3 rounded-2xl bg-brand-charcoal px-3 py-3 text-[14px] text-ink-100 shadow-sm sm:px-4"
    >
      <Link
        href={actor.role === "admin" ? "/dashboard" : "/me"}
        className="mr-1 flex items-center gap-2 text-white"
      >
        <BrandLogo variant="mark" reversed className="h-8 w-8" priority />
        <span className="font-semibold tracking-tight">TeamFrame</span>
      </Link>

      {links.map((link) =>
        link.href === activePath ? (
          <Link
            key={link.href}
            href={link.href}
            aria-current="page"
            className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 font-medium text-white"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-brand-signal" aria-hidden="true" />
            {link.label}
          </Link>
        ) : (
          <Link key={link.href} href={link.href} className="rounded-full px-3 py-1.5 text-ink-100/80 transition hover:bg-white/5 hover:text-white">
            {link.label}
          </Link>
        ),
      )}

      <span className="ml-auto flex items-center gap-3">
        {pulse ? <RiskPulse pulse={pulse} /> : null}
        <SignOutButton />
      </span>
    </nav>
  );
}
