import Link from "next/link";

import { executeActionItemAction } from "@/app/dashboard/actions";

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

function getCardTone(lane: DashboardSignal["lane"]): string {
  if (lane === "red") return "border-red-300 bg-red-50/70";
  if (lane === "yellow") return "border-amber-300 bg-amber-50/70";
  return "border-emerald-300 bg-emerald-50/60";
}

function getStatusPillTone(status: DashboardSignal["actionStatus"]): string {
  if (status === "open") return "border-red-200 bg-red-50 text-red-700";
  if (status === "in_progress") return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "done") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "dismissed") return "border-ink-300 bg-ink-100 text-ink-700";
  return "border-ink-300 bg-white text-ink-700";
}

function getStatusLabel(status: DashboardSignal["actionStatus"]): string {
  if (status === "open") return "Action open";
  if (status === "in_progress") return "Action in progress";
  if (status === "done") return "Resolved";
  if (status === "dismissed") return "Dismissed";
  return "No action item";
}

export function RiskCard({ signal }: RiskCardProps) {
  return (
    <article className={`rounded-xl border p-4 ${getCardTone(signal.lane)}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-[12px] tracking-[0.08em] text-ink-500">
            <span>{signal.subjectName}</span>
            <span className="rounded-full border border-ink-300 bg-white/70 px-2 py-0.5 text-[11px] tracking-normal text-ink-700">
              {signal.category}
            </span>
            <span>{signal.count} item{signal.count === 1 ? "" : "s"}</span>
          </div>
          <h3 className="mt-1 text-[18px] leading-tight tracking-tight">{signal.title}</h3>
        </div>
        <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${getStatusPillTone(signal.actionStatus)}`}>
          {getStatusLabel(signal.actionStatus)}
        </span>
      </div>

      <div className="mt-3 space-y-2 text-[14px] text-ink-700">
        <p><span className="font-medium text-ink-900">What is wrong:</span> {signal.whatIsWrong}</p>
        <p><span className="font-medium text-ink-900">Why it matters:</span> {signal.whyItMatters}</p>
        <p><span className="font-medium text-ink-900">What to do next:</span> {signal.whatToDoNext}</p>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-ink-300/60 pt-3">
        <p className="text-[12px] text-ink-500">Updated {formatUpdated(signal.updatedAt)}</p>
        <div className="flex flex-wrap gap-2">
          {signal.actionItemId && signal.actionStatus === "open" ? (
            <form action={executeActionItemAction}>
              <input type="hidden" name="actionItemId" value={signal.actionItemId} />
              <input type="hidden" name="nextStatus" value="in_progress" />
              <button
                type="submit"
                className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-[12px] text-amber-800 transition hover:border-amber-500"
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
                className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-[12px] text-emerald-800 transition hover:border-emerald-500"
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
