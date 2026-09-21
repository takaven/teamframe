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
  { key: "exception", label: "Exceptions" },
  { key: "overdue", label: "Overdue" },
  { key: "decision", label: "Decisions" },
  { key: "due", label: "Due" },
];

// Group render order — most urgent first.
const GROUPS: { key: Exclude<Filter, "all">; label: string }[] = [
  { key: "exception", label: "Exceptions" },
  { key: "overdue", label: "Overdue" },
  { key: "decision", label: "Decisions" },
  { key: "due", label: "Due" },
];

function dotClass(v: OverviewQueueItem["class"]): string {
  return v === "exception" || v === "overdue" ? "tf-dot-red" : v === "decision" ? "tf-dot-amber" : "tf-dot-neutral";
}
function sourceLabel(source: string): string {
  if (source.startsWith("policy")) return "Policies";
  if (source.startsWith("document")) return "Documents";
  if (source.startsWith("onboarding")) return "Onboarding";
  if (source.startsWith("probation")) return "Probation";
  if (source.startsWith("leave")) return "Leave";
  if (source.startsWith("offboarding")) return "Offboarding";
  return "People";
}
function formatDue(iso: string | null): string {
  if (!iso) return "Not set";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function Row({ item }: { item: OverviewQueueItem }) {
  return (
    <Link
      href={item.href}
      className="group grid gap-2 px-4 py-3 transition hover:bg-ink-50/70 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.75fr)_110px_minmax(0,1.15fr)_minmax(0,1.2fr)] lg:items-start lg:gap-4"
    >
      <span className="min-w-0">
        <span className="flex items-start gap-2 text-[13.5px] font-medium text-ink-800"><span className={`tf-dot ${dotClass(item.class)} mt-1 shrink-0`} aria-hidden />{item.title}</span>
        <span className="mt-0.5 block pl-5 text-[12px] text-ink-500">{item.subjectName} · {sourceLabel(item.source)}</span>
      </span>
      <span className="text-[12.5px] text-ink-700"><span className="font-semibold lg:hidden">Owner: </span>{item.owner}</span>
      <span className="text-[12.5px] tabular-nums text-ink-600"><span className="font-semibold lg:hidden">Required by: </span>{formatDue(item.dueAt)}</span>
      <span className="text-[12.5px] text-ink-700"><span className="font-semibold lg:hidden">Next action: </span>{item.nextAction}</span>
      <span className="text-[12.5px] text-ink-500"><span className="font-semibold lg:hidden">Reason: </span>{item.detail}</span>
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
      <div className="mb-4 flex flex-wrap gap-1.5" role="tablist" aria-label="Filter attention items">
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
          <div className="hidden grid-cols-[minmax(0,1.4fr)_minmax(0,0.75fr)_110px_minmax(0,1.15fr)_minmax(0,1.2fr)] gap-4 border-b border-ink-100 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-500 lg:grid">
            <span>Attention</span><span>Owner</span><span>Required by</span><span>Next action</span><span>Reason</span>
          </div>
          {GROUPS.map((g) => {
            const rows = items.filter((i) => i.class === g.key);
            if (rows.length === 0) return null;
            return (
              <section key={g.key} className="border-t border-ink-100 first:border-t-0">
                <div className="flex items-center justify-between bg-ink-50/50 px-4 py-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-500">{g.label}</span>
                  <span className="text-[11px] tabular-nums text-ink-400">{rows.length}</span>
                </div>
                <div className="tf-divide">
                  {rows.map((item) => <Row key={item.id} item={item} />)}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="tf-surface overflow-hidden">
          <div className="hidden grid-cols-[minmax(0,1.4fr)_minmax(0,0.75fr)_110px_minmax(0,1.15fr)_minmax(0,1.2fr)] gap-4 border-b border-ink-100 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-500 lg:grid">
            <span>Attention</span><span>Owner</span><span>Required by</span><span>Next action</span><span>Reason</span>
          </div>
          <div className="tf-divide">{scoped.map((item) => <Row key={item.id} item={item} />)}</div>
        </div>
      )}
    </div>
  );
}
