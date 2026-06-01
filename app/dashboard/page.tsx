import Link from "next/link";
import { requireTenantActor } from "@/middleware/rbac";
import { createServiceRoleClient } from "@/lib/db/supabaseServer";
import { SignalSection } from "@/app/dashboard/SignalSection";
import type { DashboardSignal } from "@/app/dashboard/RiskCard";
import { runSignalEngineForTenant } from "@/services/signalEngine";
import { SignOutButton } from "@/components/SignOutButton";

export const dynamic = "force-dynamic";

type RiskSignalRow = {
  id: string;
  kind: string;
  severity: "red" | "yellow";
  subject_employee_id: string | null;
  evidence: {
    what_is_wrong?: string;
    why_it_matters?: string;
    what_to_do_next?: string;
    missing_policy_count?: number;
    pending_task_count?: number;
    open_action_count?: number;
    open_asset_return_count?: number;
    overlap_count?: number;
  } | null;
  last_seen_at: string;
  resolved_at: string | null;
};

type ActionItemRow = {
  id: string;
  risk_signal_id: string;
  title: string;
  status: "open" | "in_progress" | "done" | "dismissed";
};

type EmployeeRow = {
  id: string;
  full_name: string;
};

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
  if (kind === "leave_conflict") return "Leaves";
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
    return { primaryLabel: "Resolve", primaryHref: "/onboarding", secondaryLabel: "View details", secondaryHref: "/dashboard" };
  }
  if (kind === "leave_conflict") {
    return { primaryLabel: "View details", primaryHref: "/leaves", secondaryLabel: "Resolve", secondaryHref: "/dashboard" };
  }
  if (kind === "missing_contract" || kind === "expired_document" || kind === "expiring_document" || kind === "missing_jurisdiction_requirement") {
    return { primaryLabel: "Open record", primaryHref: "/employees", secondaryLabel: "Resolve", secondaryHref: "/dashboard" };
  }
  return { primaryLabel: "Resolve", primaryHref: "/employees", secondaryLabel: "View details", secondaryHref: "/dashboard" };
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
  const actor = await requireTenantActor();
  const supabase = createServiceRoleClient();

  await runSignalEngineForTenant({
    tenantId: actor.tenantId,
    actorUserId: actor.authUserId,
  });

  const [{ data: signalData, error: signalError }, { data: actionData, error: actionError }, { data: employeeData, error: employeeError }] = await Promise.all([
    supabase
      .from("risk_signals")
      .select("id, kind, severity, subject_employee_id, evidence, last_seen_at, resolved_at")
      .eq("tenant_id", actor.tenantId)
      .order("resolved_at", { ascending: true, nullsFirst: true })
      .order("last_seen_at", { ascending: false })
      .limit(60),
    supabase
      .from("action_items")
      .select("id, risk_signal_id, title, status")
      .eq("tenant_id", actor.tenantId)
      .order("created_at", { ascending: false })
      .limit(120),
    supabase
      .from("employees")
      .select("id, full_name")
      .eq("tenant_id", actor.tenantId)
      .is("deleted_at", null),
  ]);

  if (signalError) {
    throw new Error(`DASHBOARD_SIGNALS_FAILED: ${signalError.message}`);
  }
  if (actionError) {
    throw new Error(`DASHBOARD_ACTIONS_FAILED: ${actionError.message}`);
  }
  if (employeeError) {
    throw new Error(`DASHBOARD_EMPLOYEES_FAILED: ${employeeError.message}`);
  }

  const signals = (signalData ?? []) as RiskSignalRow[];
  const employees = (employeeData ?? []) as EmployeeRow[];
  const actions = (actionData ?? []) as ActionItemRow[];

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

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <nav className="mb-6 flex items-center gap-4 text-[14px] text-ink-500">
        <span className="text-ink-900 font-medium">Dashboard</span>
        <Link href="/employees" className="hover:text-ink-900 transition">Team roster</Link>
        <Link href="/onboarding" className="hover:text-ink-900 transition">Onboarding</Link>
        <Link href="/leaves" className="hover:text-ink-900 transition">Leaves</Link>
        <SignOutButton className="ml-auto" />
      </nav>

      <header className="grid gap-4 border-b border-ink-300/60 pb-5 lg:grid-cols-[1fr_auto] lg:items-end">
        <div className="space-y-2">
          <p className="text-[12px] tracking-[0.14em] text-ink-500">Founder view</p>
          <h1 className="text-[34px] leading-tight tracking-tight">People-ops risk dashboard</h1>
          <p className="max-w-3xl text-[14px] text-ink-500">
            In under two minutes: what needs attention now, why it matters, and what has already been resolved.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <article className="rounded-xl border border-red-300/80 bg-red-50/70 px-3 py-2">
            <p className="text-[11px] text-red-700">Urgent</p>
            <p className="text-[22px] tracking-tight text-red-900">{redSignals.length}</p>
          </article>
          <article className="rounded-xl border border-amber-300/80 bg-amber-50/70 px-3 py-2">
            <p className="text-[11px] text-amber-700">Important</p>
            <p className="text-[22px] tracking-tight text-amber-900">{yellowSignals.length}</p>
          </article>
          <article className="rounded-xl border border-emerald-300/80 bg-emerald-50/70 px-3 py-2">
            <p className="text-[11px] text-emerald-700">Resolved</p>
            <p className="text-[22px] tracking-tight text-emerald-900">{resolvedSignals.length}</p>
          </article>
          <article className="rounded-xl border border-ink-300/80 bg-white/80 px-3 py-2">
            <p className="text-[11px] text-ink-500">Open actions</p>
            <p className="text-[22px] tracking-tight text-ink-900">{openActions}</p>
          </article>
        </div>
      </header>

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
          <p className="mt-2 text-[18px] tracking-tight">Leaves</p>
          <p className="mt-1 text-[13px] text-ink-500">Keep coverage and approvals on track.</p>
        </Link>
      </section>
    </main>
  );
}
