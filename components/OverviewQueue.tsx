"use client";

import { useState } from "react";
import Link from "next/link";

export type OverviewQueueItem = {
  id: string;
  class: "decision" | "overdue" | "due" | "exception";
  source: string;
  title: string;
  subjectName: string;
  dueAt: string | null;
  href: string;
  detail: string;
};

type Filter = "all" | "decision" | "overdue" | "due" | "exception";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "overdue", label: "Overdue" },
  { key: "decision", label: "Decisions" },
  { key: "due", label: "Due" },
  { key: "exception", label: "Exceptions" },
];

// Group render order — most urgent first.
const GROUPS: { key: Exclude<Filter, "all">; label: string }[] = [
  { key: "overdue", label: "Overdue" },
  { key: "decision", label: "Decisions" },
  { key: "due", label: "Due" },
  { key: "exception", label: "Exceptions" },
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
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function Row({ item }: { item: OverviewQueueItem }) {
  return (
    <Link
      href={item.href}
      className="group flex h-12 items-center gap-3 px-4 transition hover:bg-ink-50/70"
    >
      <span className={`tf-dot ${dotClass(item.class)} shrink-0`} aria-hidden />
      <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-ink-800">{item.title}</span>
      <span className="hidden max-w-[260px] shrink-0 truncate text-[12.5px] text-ink-500 md:block">
        {item.subjectName} · {sourceLabel(item.source)}
      </span>
      <span className="w-[62px] shrink-0 text-right text-[12.5px] tabular-nums text-ink-500">{formatDue(item.dueAt)}</span>
      <span className="w-4 shrink-0 text-right text-[13px] text-ink-300 transition group-hover:text-ink-700" aria-hidden>›</span>
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
        <div className="tf-surface tf-divide overflow-hidden">
          {scoped.map((item) => <Row key={item.id} item={item} />)}
        </div>
      )}
    </div>
  );
}
