import Link from "next/link";
import { requireTenantRole } from "@/middleware/rbac";
import { SignalSection } from "@/app/dashboard/SignalSection";
import type { DashboardSignal } from "@/app/dashboard/RiskCard";
import { AppShell } from "@/components/AppShell";
import {
  loadDashboardData,
  type ActionItemRow,
  type RiskSignalRow,
} from "@/app/dashboard/data";

export const dynamic = "force-dynamic";

function signalTitle(kind: string): string {
  if (kind === "missing_contract") return "Missing signed contract";
  if (kind === "expired_document") return "Expired document";
  if (kind === "expiring_document") return "Document expiring soon";
  if (kind === "unacknowledged_policy") return "Unacknowledged policy";
  if (kind === "incomplete_onboarding") return "Incomplete onboarding";
  if (kind === "incomplete_offboarding") return "Incomplete offboarding";
  if (kind === "active_access_after_exit") return "Active access after exit";
  if (kind === "unreturned_asset") return "Unreturned asset";
  if (kind === "missing_jurisdiction_requirement") return "Missing jurisdiction document";
  if (kind === "leave_conflict") return "Leave conflict";
  return "Team risk signal";
}

function signalCategory(kind: string): string {
  if (kind === "missing_contract" || kind === "expired_document" || kind === "expiring_document" || kind === "missing_jurisdiction_requirement") {
    return "Documents";
  }
  if (kind === "unacknowledged_policy") return "Policies";
  if (kind === "incomplete_onboarding") return "Onboarding";
  if (kind === "incomplete_offboarding" || kind === "active_access_after_exit" || kind === "unreturned_asset") {
    return "Offboarding";
  }
  if (kind === "leave_conflict") return "Leave";
  return "Operations";
}

function signalCount(evidence: RiskSignalRow["evidence"]): number {
  if (!evidence) return 1;
  const candidates = [
    evidence.missing_policy_count,
    evidence.pending_task_count,
    evidence.open_action_count,
    evidence.open_asset_return_count,
    evidence.overlap_count,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "number" && Number.isFinite(candidate) && candidate > 0) {
      return candidate;
    }
  }
  return 1;
}

function signalCtas(kind: string): {
  primaryLabel: "View details" | "Resolve" | "Open record";
  primaryHref: string;
  secondaryLabel: "View details" | "Resolve" | "Open record";
  secondaryHref: string;
} {
  if (kind === "incomplete_onboarding") {
    return { primaryLabel: "View details", primaryHref: "/onboarding", secondaryLabel: "Resolve", secondaryHref: "/onboarding" };
  }
  if (kind === "leave_conflict") {
    return { primaryLabel: "View details", primaryHref: "/leaves", secondaryLabel: "Resolve", secondaryHref: "/leaves" };
  }
  if (kind === "missing_contract" || kind === "expired_document" || kind === "expiring_document" || kind === "missing_jurisdiction_requirement") {
    return { primaryLabel: "Open record", primaryHref: "/employees", secondaryLabel: "Resolve", secondaryHref: "/employees" };
  }
  if (kind === "unacknowledged_policy") {
    return { primaryLabel: "Resolve", primaryHref: "/policies", secondaryLabel: "View details", secondaryHref: "/policies" };
  }
  return { primaryLabel: "Resolve", primaryHref: "/employees", secondaryLabel: "View details", secondaryHref: "/employees" };
}

function fallbackWrong(kind: string): string {
  if (kind === "missing_contract") return "A teammate has no signed contract on file.";
  if (kind === "expired_document") return "A key document is already expired.";
  if (kind === "expiring_document") return "A key document is close to expiry.";
  if (kind === "unacknowledged_policy") return "A published policy has not been acknowledged.";
  if (kind === "incomplete_onboarding") return "Onboarding work is still incomplete.";
  if (kind === "incomplete_offboarding") return "Offboarding actions are still open.";
  if (kind === "active_access_after_exit") return "An exited teammate still appears active.";
  if (kind === "unreturned_asset") return "A company asset has not been returned.";
  if (kind === "missing_jurisdiction_requirement") return "A jurisdiction-specific document is missing.";
  if (kind === "leave_conflict") return "Overlapping leave records were found.";
  return "A people-ops risk needs attention.";
}

function fallbackWhy(kind: string): string {
  if (kind === "missing_contract") {
    return "This creates legal and compliance exposure as work starts or continues.";
  }
  if (kind === "expired_document" || kind === "expiring_document") {
    return "This can block operations, travel, onboarding, or compliance readiness.";
  }
  if (kind === "unacknowledged_policy") {
    return "This weakens compliance evidence and creates policy ambiguity.";
  }
  if (kind === "incomplete_onboarding") {
    return "Unfinished setup can block work and create operational gaps.";
  }
  if (kind === "incomplete_offboarding" || kind === "active_access_after_exit" || kind === "unreturned_asset") {
    return "Loose offboarding creates security, asset, and handover risk.";
  }
  if (kind === "missing_jurisdiction_requirement") {
    return "Missing required documents can create work authorization and compliance risk.";
  }
  if (kind === "leave_conflict") {
    return "Conflicting leave data can disrupt approvals and coverage planning.";
  }
  return "Unresolved risks can slow operations and reduce trust.";
}

function fallbackNext(kind: string): string {
  if (kind === "missing_contract") return "Upload the signed contract.";
  if (kind === "expired_document") return "Upload the renewed document now.";
  if (kind === "expiring_document") return "Request renewal before expiry.";
  if (kind === "unacknowledged_policy") return "Collect the missing acknowledgement.";
  if (kind === "incomplete_onboarding") return "Finish the remaining onboarding tasks.";
  if (kind === "incomplete_offboarding") return "Close the remaining offboarding items.";
  if (kind === "active_access_after_exit") return "Remove access and mark the record inactive.";
  if (kind === "unreturned_asset") return "Recover the outstanding company asset.";
  if (kind === "missing_jurisdiction_requirement") return "Upload the required jurisdiction document.";
  if (kind === "leave_conflict") return "Review and correct the overlapping leave entries.";
  return "Review the risk and take the next action.";
}

function toDashboardSignal(params: {
  row: RiskSignalRow;
  employeeName: string;
  action: ActionItemRow | null;
}): DashboardSignal {
  const lane = params.row.resolved_at ? "resolved" : params.row.severity;
  const ctas = signalCtas(params.row.kind);
  return {
    id: params.row.id,
    kind: params.row.kind,
    severity: params.row.severity,
    lane,
    subjectName: params.employeeName,
    title: signalTitle(params.row.kind),
    category: signalCategory(params.row.kind),
    count: signalCount(params.row.evidence),
    whatIsWrong: params.row.evidence?.what_is_wrong ?? fallbackWrong(params.row.kind),
    whyItMatters: params.row.evidence?.why_it_matters ?? fallbackWhy(params.row.kind),
    whatToDoNext: params.row.evidence?.what_to_do_next ?? fallbackNext(params.row.kind),
    actionStatus: params.action?.status ?? "none",
    actionItemId: params.action?.id ?? null,
    actionTitle: params.action?.title ?? null,
    updatedAt: params.row.last_seen_at,
    primaryCtaLabel: ctas.primaryLabel,
    primaryCtaHref: ctas.primaryHref,
    secondaryCtaLabel: ctas.secondaryLabel,
    secondaryCtaHref: ctas.secondaryHref,
  };
}

export default async function DashboardPage() {
  const actor = await requireTenantRole("admin");
  const { refreshStatus, savedDataStatus, signals, actions, employees } = await loadDashboardData({
    tenantId: actor.tenantId,
    actorUserId: actor.authUserId,
  });

  const employeeNames = new Map(employees.map((row) => [row.id, row.full_name]));
  const firstActionBySignalId = new Map<string, ActionItemRow>();
  for (const action of actions) {
    if (!firstActionBySignalId.has(action.risk_signal_id)) {
      firstActionBySignalId.set(action.risk_signal_id, action);
    }
  }

  const dashboardSignals = signals.map((row) =>
    toDashboardSignal({
      row,
      employeeName: row.subject_employee_id ? (employeeNames.get(row.subject_employee_id) ?? "Team member") : "Team member",
      action: firstActionBySignalId.get(row.id) ?? null,
    }),
  );

  const redSignals = dashboardSignals.filter((s) => s.lane === "red");
  const yellowSignals = dashboardSignals.filter((s) => s.lane === "yellow");
  const resolvedSignals = dashboardSignals.filter((s) => s.lane === "resolved");
  const openActions = actions.filter((a) => a.status === "open" || a.status === "in_progress").length;
  const topPriority = redSignals[0] ?? yellowSignals[0] ?? null;
  const latestResolution = resolvedSignals[0] ?? null;
  const shouldShowRefreshWarning = refreshStatus.state !== "success" && dashboardSignals.length === 0;

  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <AppShell actor={actor} activePath="/dashboard" />

      <header className="grid gap-4 border-b border-ink-300/60 pb-5 lg:grid-cols-[1fr_auto] lg:items-end">
        <div className="space-y-2">
          <p className="text-[12px] tracking-[0.14em] text-ink-500">Founder view</p>
          <h1 className="font-display text-[34px] font-medium leading-tight tracking-tight">
            Readiness overview
          </h1>
          <p className="max-w-3xl text-[14px] text-ink-500">
            See what needs attention. Know what comes next.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <article className="rounded-xl border border-ink-300/70 bg-white/80 px-3 py-2">
            <p className="flex items-center gap-1.5 text-[11px] text-ink-500">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-signal ring-2 ring-brand-signal/20" aria-hidden="true" />
              Urgent
            </p>
            <p className="font-mono text-[22px] tracking-tight tabular-nums text-ink-900">{redSignals.length}</p>
          </article>
          <article className="rounded-xl border border-ink-300/70 bg-white/80 px-3 py-2">
            <p className="flex items-center gap-1.5 text-[11px] text-ink-500">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-signal-amber" aria-hidden="true" />
              Important
            </p>
            <p className="font-mono text-[22px] tracking-tight tabular-nums text-ink-900">{yellowSignals.length}</p>
          </article>
          <article className="rounded-xl border border-ink-300/70 bg-white/80 px-3 py-2">
            <p className="flex items-center gap-1.5 text-[11px] text-ink-500">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-signal-green" aria-hidden="true" />
              Resolved
            </p>
            <p className="font-mono text-[22px] tracking-tight tabular-nums text-ink-900">{resolvedSignals.length}</p>
          </article>
          <article className="rounded-xl border border-ink-300/70 bg-white/80 px-3 py-2">
            <p className="text-[11px] text-ink-500">Open actions</p>
            <p className="font-mono text-[22px] tracking-tight tabular-nums text-ink-900">{openActions}</p>
          </article>
        </div>
      </header>

      {shouldShowRefreshWarning ? (
        <section
          role="status"
          className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-signal-amber/35 bg-signal-amber/10 px-4 py-3 text-[13px] text-ink-700"
        >
          <div>
            <p className="font-medium text-ink-900">
              Showing the latest saved signals.
            </p>
            <p className="mt-0.5 text-ink-500">
              {refreshStatus.state === "timeout"
                ? "The live signal refresh is taking longer than expected."
                : "The live signal refresh could not complete safely."}
            </p>
          </div>
          <Link
            href="/dashboard"
            className="rounded-full border border-ink-300 bg-white px-3 py-1.5 text-[12px] text-ink-800 transition hover:border-ink-900"
          >
            Retry refresh
          </Link>
        </section>
      ) : null}

      {savedDataStatus.state !== "success" ? (
        <section
          role="alert"
          className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-signal-red/30 bg-signal-red/10 px-4 py-3 text-[13px] text-ink-700"
        >
          <div>
            <p className="font-medium text-ink-900">Dashboard data could not load yet.</p>
            <p className="mt-0.5 text-ink-500">
              {savedDataStatus.state === "timeout"
                ? "The saved signal read took too long, so this page is showing an intentional empty state."
                : "The saved signal read failed safely. Retry without exposing provider details."}
            </p>
          </div>
          <Link
            href="/dashboard"
            className="rounded-full border border-ink-300 bg-white px-3 py-1.5 text-[12px] text-ink-800 transition hover:border-ink-900"
          >
            Retry dashboard
          </Link>
        </section>
      ) : null}

      <section className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_0.8fr]">
        <article className="rounded-xl border border-brand-signal/70 bg-surface-elevated p-5 shadow-sm shadow-brand-signal/10">
          <p className="flex items-center gap-2 text-[12px] uppercase tracking-[0.14em] text-ink-500">
            <span className="h-2 w-2 rounded-full bg-brand-signal" aria-hidden="true" />
            Priority signal
          </p>
          {topPriority ? (
            <div className="mt-3 grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
              <div>
                <h2 className="text-[22px] leading-tight tracking-tight">{topPriority.title}</h2>
                <p className="mt-2 max-w-3xl text-[14px] text-ink-700">{topPriority.whatIsWrong}</p>
                <p className="mt-2 text-[13px] text-ink-500">
                  Owner: <span className="text-ink-800">{topPriority.subjectName}</span> · Action:{" "}
                  <span className="text-ink-800">{topPriority.actionTitle ?? topPriority.whatToDoNext}</span>
                </p>
              </div>
              <Link
                href={topPriority.primaryCtaHref}
                className="rounded-full bg-ink-900 px-4 py-2 text-center text-[13px] font-medium text-paper transition hover:bg-ink-700"
              >
                Open priority
              </Link>
            </div>
          ) : (
            <p className="mt-3 text-[14px] text-ink-700">
              No open risk signals right now. New issues will appear here with the owner and required action.
            </p>
          )}
        </article>

        <article className="rounded-xl border border-ink-300/70 bg-surface-elevated p-5">
          <p className="text-[12px] uppercase tracking-[0.14em] text-ink-500">Recent progress</p>
          {latestResolution ? (
            <>
              <h2 className="mt-3 text-[20px] leading-tight tracking-tight">{latestResolution.title}</h2>
              <p className="mt-2 text-[13px] text-ink-500">
                Resolved for <span className="text-ink-800">{latestResolution.subjectName}</span>.
              </p>
            </>
          ) : (
            <p className="mt-3 text-[14px] text-ink-700">
              Completed actions will appear here so the founder can see readiness improving.
            </p>
          )}
        </article>
      </section>

      <div className="mt-6 space-y-5">
        <SignalSection
          title="Urgent now"
          subtitle="Red issues that need immediate action."
          lane="red"
          signals={redSignals}
        />
        <SignalSection
          title="Important next"
          subtitle="Yellow issues to resolve before they become urgent."
          lane="yellow"
          signals={yellowSignals}
        />
        <SignalSection
          title="Resolved"
          subtitle="Completed items that build confidence and trust."
          lane="resolved"
          signals={resolvedSignals}
        />
      </div>

      <section className="mt-7 grid gap-3 sm:grid-cols-3">
        <Link href="/employees" className="rounded-xl border border-ink-300/70 bg-white/75 p-4 transition hover:border-ink-900">
          <p className="text-[12px] tracking-[0.12em] text-ink-500">Act</p>
          <p className="mt-2 text-[18px] tracking-tight">Team roster</p>
          <p className="mt-1 text-[13px] text-ink-500">Update employee records and documents.</p>
        </Link>
        <Link href="/onboarding" className="rounded-xl border border-ink-300/70 bg-white/75 p-4 transition hover:border-ink-900">
          <p className="text-[12px] tracking-[0.12em] text-ink-500">Track</p>
          <p className="mt-2 text-[18px] tracking-tight">Onboarding</p>
          <p className="mt-1 text-[13px] text-ink-500">Move pending tasks to done.</p>
        </Link>
        <Link href="/leaves" className="rounded-xl border border-ink-300/70 bg-white/75 p-4 transition hover:border-ink-900">
          <p className="text-[12px] tracking-[0.12em] text-ink-500">Operate</p>
          <p className="mt-2 text-[18px] tracking-tight">Leave</p>
          <p className="mt-1 text-[13px] text-ink-500">Keep coverage and approvals on track.</p>
        </Link>
      </section>
    </main>
  );
}
