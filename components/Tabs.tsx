"use client";

import { useState, type ReactNode } from "react";

export type TabDef = {
  id: string;
  label: string;
  /** Optional small count/badge shown after the label. */
  badge?: number | string;
  content: ReactNode;
};

/**
 * Lightweight client tab strip. Panels are pre-rendered on the server and passed in as `content`
 * nodes (server-action forms inside them keep working); only the active panel is shown. Used for
 * the employee record so the header stays persistent while sections are switched.
 */
export function Tabs({ tabs, initialId, ariaLabel }: { tabs: TabDef[]; initialId?: string; ariaLabel?: string }) {
  const first = initialId && tabs.some((t) => t.id === initialId) ? initialId : tabs[0]?.id;
  const [active, setActive] = useState<string | undefined>(first);
  const activeTab = tabs.find((t) => t.id === active) ?? tabs[0];

  return (
    <div>
      <div role="tablist" aria-label={ariaLabel} className="flex flex-wrap gap-1 border-b border-ink-300/60">
        {tabs.map((t) => {
          const isActive = t.id === activeTab?.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActive(t.id)}
              className={[
                "relative -mb-px inline-flex items-center gap-1.5 rounded-t-lg px-3.5 py-2.5 text-[13.5px] font-medium transition",
                isActive
                  ? "border-b-2 border-ink-900 text-ink-900"
                  : "border-b-2 border-transparent text-ink-500 hover:text-ink-800",
              ].join(" ")}
            >
              {t.label}
              {t.badge !== undefined && t.badge !== 0 && t.badge !== "" ? (
                <span className={`rounded-full px-1.5 py-0.5 text-[11px] tabular-nums ${isActive ? "bg-ink-900 text-white" : "bg-ink-100 text-ink-600"}`}>
                  {t.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" className="pt-5">
        {activeTab?.content}
      </div>
    </div>
  );
}
