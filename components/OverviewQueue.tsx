"use client";

import { useState } from "react";
import Link from "next/link";
import { getOverviewQueueCounts, getOverviewQueueView, type OverviewQueueFilter, type OverviewQueueItem } from "@/lib/ui/overviewQueue";

export type { OverviewQueueItem } from "@/lib/ui/overviewQueue";

const FILTERS: { key: OverviewQueueFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "exception", label: "Problems" },
  { key: "overdue", label: "Overdue" },
  { key: "decision", label: "Needs a decision" },
  { key: "due", label: "Due this week" },
];

function dotClass(v: OverviewQueueItem["class"]): string {
  return v === "exception" || v === "overdue" ? "tf-dot-red" : v === "decision" ? "tf-dot-amber" : "tf-dot-neutral";
}
function sourceLabel(source: string): string {
  if (source.startsWith("policy")) return "Policies";
  if (source.startsWith("document")) return "Documents";
  if (source.startsWith("onboarding")) return "Onboarding";
  if (source.startsWith("probation")) return "Probation";
  if (source.startsWith("leave")) return "Time off";
  if (source.startsWith("offboarding")) return "Offboarding";
  return "People";
}
function formatDue(iso: string | null): string {
  if (!iso) return "No due date";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function Row({ item }: { item: OverviewQueueItem }) {
  const actionLabel = item.nextAction || "Open";
  return (
    <Link
      href={item.href}
      className="group grid gap-2 px-4 py-3 transition hover:bg-white/28 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,.7fr)_90px_130px] lg:items-center lg:gap-4"
    >
      <span className="min-w-0">
        <span className="flex items-start gap-2 text-[13.5px] font-medium text-ink-800"><span className={`tf-dot ${dotClass(item.class)} mt-1 shrink-0`} aria-hidden />{item.title}</span>
        <span className="mt-0.5 block pl-5 text-[12px] text-ink-600">{item.subjectName} · {sourceLabel(item.source)}</span>
        <span className="mt-1 block pl-5 text-[11.5px] leading-snug text-ink-600">{item.detail}</span>
      </span>
      <span className="text-[12.5px] text-ink-700"><span className="font-semibold lg:hidden">Owner: </span>{item.owner}</span>
      <span className="text-[12.5px] tabular-nums text-ink-600"><span className="font-semibold lg:hidden">Due: </span>{formatDue(item.dueAt)}</span>
      <span className="tf-quiet-action justify-self-start">{actionLabel}</span>
    </Link>
  );
}

export function OverviewQueue({ items }: { items: OverviewQueueItem[] }) {
  const [filter, setFilter] = useState<OverviewQueueFilter>("all");
  const counts = getOverviewQueueCounts(items);
  const { matching, visible } = getOverviewQueueView(items, filter);

  return (
    <div>
      <div className="tf-secondary-nav tf-attention-filters mb-4" role="tablist" aria-label="Filter work that needs attention">
        {FILTERS.map((f) => {
          const active = filter === f.key;
          const count = counts[f.key];
          return (
            <button
              key={f.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(f.key)}
              className="inline-flex items-center gap-1.5 transition"
            >
              {f.label}
              <span className="tf-count-accent tabular-nums text-[11px]">{count}</span>
            </button>
          );
        })}
      </div>
      <p className="mb-3 text-[12px] text-ink-500" aria-live="polite">
        Showing {visible.length} of {counts[filter]} {filter === "all" ? "items needing attention" : FILTERS.find((item) => item.key === filter)?.label.toLocaleLowerCase()}
      </p>

      {matching.length === 0 ? (
        <div className="tf-surface-flat px-4 py-8 text-center text-[13.5px] text-ink-500">
          {filter === "all" ? "Nothing needs attention right now." : "No items in this view."}
        </div>
      ) : filter === "all" ? (
        <div className="tf-surface overflow-hidden">
          <div className="hidden grid-cols-[minmax(0,1.7fr)_minmax(0,.7fr)_90px_130px] gap-4 border-b border-ink-100 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-500 lg:grid">
            <span>What</span><span>Owner</span><span>Due</span><span>Action</span>
          </div>
          <div className="tf-divide">{visible.map((item) => <Row key={item.id} item={item} />)}</div>
        </div>
      ) : (
        <div className="tf-surface overflow-hidden">
          <div className="hidden grid-cols-[minmax(0,1.7fr)_minmax(0,.7fr)_90px_130px] gap-4 border-b border-ink-100 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-500 lg:grid">
            <span>What</span><span>Owner</span><span>Due</span><span>Action</span>
          </div>
          <div className="tf-divide">{visible.map((item) => <Row key={item.id} item={item} />)}</div>
        </div>
      )}
    </div>
  );
}
