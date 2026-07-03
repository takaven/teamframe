import Link from "next/link";

import { executeActionItemAction } from "@/app/dashboard/actions";
import { StatusPill, type StatusPillTone } from "@/components/StatusPill";

export type DashboardSignal = {
  id: string;
  kind: string;
  severity: "red" | "yellow";
  lane: "red" | "yellow" | "resolved";
  subjectName: string;
  title: string;
  category: string;
  count: number;
  whatIsWrong: string;
  whyItMatters: string;
  whatToDoNext: string;
  actionStatus: "open" | "in_progress" | "done" | "dismissed" | "none";
  actionItemId: string | null;
  actionTitle: string | null;
  updatedAt: string;
  primaryCtaLabel: "View details" | "Resolve" | "Open record";
  primaryCtaHref: string;
  secondaryCtaLabel: "View details" | "Resolve" | "Open record";
  secondaryCtaHref: string;
};

type RiskCardProps = {
  signal: DashboardSignal;
};

function formatUpdated(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Status spine: white card, 3px left border in the severity token.
function getSpineTone(lane: DashboardSignal["lane"]): string {
  if (lane === "red") return "border-l-signal-red";
  if (lane === "yellow") return "border-l-signal-amber";
  return "border-l-signal-green";
}

function getSeverityPill(lane: DashboardSignal["lane"]): { tone: StatusPillTone; label: string } {
  if (lane === "red") return { tone: "red", label: "Urgent" };
  if (lane === "yellow") return { tone: "amber", label: "Attention" };
  return { tone: "green", label: "Resolved" };
}

function getStatusPillTone(status: DashboardSignal["actionStatus"]): StatusPillTone {
  if (status === "open") return "red";
  if (status === "in_progress") return "amber";
  if (status === "done") return "green";
  return "neutral";
}

function getStatusLabel(status: DashboardSignal["actionStatus"]): string {
  if (status === "open") return "Action open";
  if (status === "in_progress") return "Action in progress";
  if (status === "done") return "Resolved";
  if (status === "dismissed") return "Dismissed";
  return "No action item";
}

export function RiskCard({ signal }: RiskCardProps) {
  const severityPill = getSeverityPill(signal.lane);

  return (
    <article
      className={`rounded-xl border border-ink-300/70 border-l-[3px] bg-white p-4 transition ${getSpineTone(signal.lane)}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-[12px] tracking-[0.08em] text-ink-500">
            <StatusPill tone={severityPill.tone}>{severityPill.label}</StatusPill>
            <span>{signal.subjectName}</span>
            <StatusPill tone="neutral">{signal.category}</StatusPill>
            <span>
              <span className="font-mono tabular-nums">{signal.count}</span> item{signal.count === 1 ? "" : "s"}
            </span>
          </div>
          <h3 className="mt-1 text-[18px] leading-tight tracking-tight">{signal.title}</h3>
        </div>
        <StatusPill tone={getStatusPillTone(signal.actionStatus)}>
          {getStatusLabel(signal.actionStatus)}
        </StatusPill>
      </div>

      <div className="mt-3 space-y-2 text-[14px] text-ink-700">
        <p><span className="font-medium text-ink-900">What is wrong:</span> {signal.whatIsWrong}</p>
        <p><span className="font-medium text-ink-900">Why it matters:</span> {signal.whyItMatters}</p>
        <p><span className="font-medium text-ink-900">What to do next:</span> {signal.whatToDoNext}</p>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-ink-300/60 pt-3">
        <p className="text-[12px] text-ink-500">
          Updated <span className="font-mono tabular-nums">{formatUpdated(signal.updatedAt)}</span>
        </p>
        <div className="flex flex-wrap gap-2">
          {signal.actionItemId && signal.actionStatus === "open" ? (
            <form action={executeActionItemAction}>
              <input type="hidden" name="actionItemId" value={signal.actionItemId} />
              <input type="hidden" name="nextStatus" value="in_progress" />
              <button
                type="submit"
                className="rounded-full border border-signal-amber/40 bg-white px-3 py-1.5 text-[12px] text-signal-amber transition hover:border-signal-amber"
              >
                Execute action
              </button>
            </form>
          ) : null}

          {signal.actionItemId && (signal.actionStatus === "open" || signal.actionStatus === "in_progress") ? (
            <form action={executeActionItemAction}>
              <input type="hidden" name="actionItemId" value={signal.actionItemId} />
              <input type="hidden" name="nextStatus" value="done" />
              <button
                type="submit"
                className="rounded-full border border-signal-green/40 bg-white px-3 py-1.5 text-[12px] text-signal-green transition hover:border-signal-green"
              >
                Mark done
              </button>
            </form>
          ) : null}

          <Link
            href={signal.primaryCtaHref}
            className="rounded-full border border-ink-300 px-3 py-1.5 text-[12px] text-ink-700 transition hover:border-ink-900 hover:text-ink-900"
          >
            {signal.primaryCtaLabel}
          </Link>
          <Link
            href={signal.secondaryCtaHref}
            className="rounded-full bg-ink-900 px-3 py-1.5 text-[12px] text-paper transition hover:bg-ink-700"
          >
            {signal.actionTitle ?? signal.secondaryCtaLabel}
          </Link>
        </div>
      </div>
    </article>
  );
}
