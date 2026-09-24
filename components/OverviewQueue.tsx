"use client";

import { useState } from "react";
import Link from "next/link";

export type OverviewQueueItem = {
  id: string;
  class: "decision" | "overdue" | "due" | "exception";
  source: string;
  title: string;
  subjectName: string;
  owner: string;
  nextAction: string;
  dueAt: string | null;
  href: string;
  detail: string;
};

type Filter = "all" | "decision" | "overdue" | "due" | "exception";

const FILTERS: { key: Filter; label: string }[] = [
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
  if (!iso) return "Not set";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function Row({ item }: { item: OverviewQueueItem }) {
  const actionLabel = item.nextAction || "Open";
  return (
    <Link
      href={item.href}
      className="group grid gap-2 px-4 py-3 transition hover:bg-ink-50/70 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,.7fr)_90px_150px] lg:items-center lg:gap-4"
    >
      <span className="min-w-0">
        <span className="flex items-start gap-2 text-[13.5px] font-medium text-ink-800"><span className={`tf-dot ${dotClass(item.class)} mt-1 shrink-0`} aria-hidden />{item.title}</span>
        <span className="mt-0.5 block pl-5 text-[12px] text-ink-500">{item.subjectName} · {sourceLabel(item.source)}</span>
        <span className="mt-1 block pl-5 text-[11.5px] leading-snug text-ink-400">{item.detail}</span>
      </span>
      <span className="text-[12.5px] text-ink-700"><span className="font-semibold lg:hidden">Owner: </span>{item.owner}</span>
      <span className="text-[12.5px] tabular-nums text-ink-600"><span className="font-semibold lg:hidden">Due: </span>{formatDue(item.dueAt)}</span>
      <span className="inline-flex h-9 max-w-full items-center justify-center justify-self-start whitespace-nowrap rounded-lg border border-ink-300 bg-white px-3 text-[12px] font-semibold text-ink-700 shadow-[0_5px_12px_-10px_rgba(15,17,21,.45)] transition group-hover:border-ink-700 group-hover:bg-ink-900 group-hover:text-white group-active:translate-y-px group-active:shadow-inner">{actionLabel}</span>
    </Link>
  );
}

export function OverviewQueue({
  items,
  counts,
}: {
  items: OverviewQueueItem[];
  counts: { all: number; decision: number; overdue: number; due: number; exception: number };
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const scoped = filter === "all" ? items : items.filter((i) => i.class === filter);

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-1.5" role="tablist" aria-label="Filter work that needs attention">
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
              className={[
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium transition",
                active ? "bg-ink-900 text-white" : "text-ink-600 hover:bg-ink-100",
              ].join(" ")}
            >
              {f.label}
              <span className={`tabular-nums text-[11px] ${active ? "text-white/60" : "text-ink-400"}`}>{count}</span>
            </button>
          );
        })}
      </div>

      {scoped.length === 0 ? (
        <div className="tf-surface-flat px-4 py-8 text-center text-[13.5px] text-ink-500">
          {filter === "all" ? "Nothing needs attention right now." : "No items in this view."}
        </div>
      ) : filter === "all" ? (
        <div className="tf-surface overflow-hidden">
          <div className="hidden grid-cols-[minmax(0,1.7fr)_minmax(0,.7fr)_90px_150px] gap-4 border-b border-ink-100 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-500 lg:grid">
            <span>What</span><span>Owner</span><span>Due</span><span>Action</span>
          </div>
          <div className="tf-divide">{items.map((item) => <Row key={item.id} item={item} />)}</div>
        </div>
      ) : (
        <div className="tf-surface overflow-hidden">
          <div className="hidden grid-cols-[minmax(0,1.7fr)_minmax(0,.7fr)_90px_150px] gap-4 border-b border-ink-100 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-500 lg:grid">
            <span>What</span><span>Owner</span><span>Due</span><span>Action</span>
          </div>
          <div className="tf-divide">{scoped.map((item) => <Row key={item.id} item={item} />)}</div>
        </div>
      )}
    </div>
  );
}
