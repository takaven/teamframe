"use client";

import { useState } from "react";
import Link from "next/link";
import { StatusPill, type StatusPillTone } from "@/components/StatusPill";

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
  { key: "decision", label: "Decisions" },
  { key: "overdue", label: "Overdue" },
  { key: "due", label: "Due" },
  { key: "exception", label: "Exceptions" },
];

function classLabel(v: OverviewQueueItem["class"]): string {
  return v === "decision" ? "Decision" : v === "overdue" ? "Overdue" : v === "exception" ? "Exception" : "Due";
}
function classTone(v: OverviewQueueItem["class"]): StatusPillTone {
  return v === "exception" ? "red" : v === "decision" || v === "overdue" ? "amber" : "neutral";
}
function classSpine(v: OverviewQueueItem["class"]): string {
  return v === "exception" ? "border-l-signal-red" : v === "decision" || v === "overdue" ? "border-l-signal-amber" : "border-l-ink-300";
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
  if (!iso) return "No due date";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function OverviewQueue({
  items,
  counts,
}: {
  items: OverviewQueueItem[];
  counts: { all: number; decision: number; overdue: number; due: number; exception: number };
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const shown = filter === "all" ? items : items.filter((i) => i.class === filter);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter attention items">
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
                "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition",
                active
                  ? "border-ink-900 bg-ink-900 text-white"
                  : "border-ink-300 bg-white text-ink-600 hover:border-ink-900 hover:text-ink-900",
              ].join(" ")}
            >
              {f.label}
              <span className={`text-[11px] tabular-nums ${active ? "text-white/70" : "text-ink-400"}`}>{count}</span>
            </button>
          );
        })}
      </div>

      {shown.length === 0 ? (
        <article className="rounded-xl border border-ink-300/70 bg-white p-6 text-[14px] text-ink-600">
          {filter === "all" ? "Nothing needs attention right now." : `No ${classLabel(filter as OverviewQueueItem["class"]).toLowerCase()} items right now.`}
        </article>
      ) : (
        <ul className="space-y-2.5">
          {shown.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                className={`group flex items-start justify-between gap-4 rounded-xl border border-ink-300/70 border-l-[3px] bg-white p-4 transition hover:border-ink-400 hover:shadow-[0_10px_30px_-24px_rgba(15,17,21,.5)] ${classSpine(item.class)}`}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-[12px] text-ink-500">
                    <StatusPill tone={classTone(item.class)}>{classLabel(item.class)}</StatusPill>
                    <span>{sourceLabel(item.source)}</span>
                    <span aria-hidden>·</span>
                    <span className="truncate">{item.subjectName}</span>
                  </div>
                  <h3 className="mt-1.5 text-[15.5px] font-semibold leading-snug text-ink-800">{item.title}</h3>
                  <p className="mt-1 text-[13px] text-ink-600">{item.detail}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-[12px] tabular-nums text-ink-500">{formatDue(item.dueAt)}</span>
                  <span className="text-[13px] font-medium text-ink-400 transition group-hover:text-ink-900">Open →</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
