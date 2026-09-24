"use client";

import { Children, isValidElement, useEffect, useState, type ReactNode } from "react";

export type SectionTabDef = { id: string; label: string; badge?: number | string };

/**
 * Tab strip that selects among its own children by their `data-tab` prop, instead of taking panels
 * as an array. This lets the server page keep each record section as inline JSX (with its wired
 * server-action forms) in place — every child whose `data-tab` matches the active tab is shown, so
 * several non-contiguous blocks can belong to the same tab. Only the active tab's children render
 * interactively; the rest are simply not mounted.
 */
export function SectionTabs({
  tabs,
  initialId,
  ariaLabel,
  children,
}: {
  tabs: SectionTabDef[];
  initialId?: string;
  ariaLabel?: string;
  children: ReactNode;
}) {
  const first = initialId && tabs.some((t) => t.id === initialId) ? initialId : tabs[0]?.id;
  const [active, setActive] = useState<string | undefined>(first);

  useEffect(() => {
    const selectHash = () => {
      const id = window.location.hash.slice(1);
      if (tabs.some((tab) => tab.id === id)) setActive(id);
    };
    selectHash();
    window.addEventListener("hashchange", selectHash);
    return () => window.removeEventListener("hashchange", selectHash);
  }, [tabs]);

  const panels = Children.toArray(children).filter((child) => {
    if (!isValidElement(child)) return false;
    const props = child.props as { "data-tab"?: string };
    return props["data-tab"] === active;
  });

  return (
    <div className="grid items-start gap-5 md:grid-cols-[190px_minmax(0,1fr)]">
      <div role="tablist" aria-label={ariaLabel} className="grid grid-cols-2 gap-1 rounded-xl bg-ink-100/55 p-2 sm:grid-cols-4 md:sticky md:top-6 md:grid-cols-1">
        {tabs.map((t) => {
          const isActive = t.id === active;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => {
                setActive(t.id);
                window.history.replaceState(null, "", `#${t.id}`);
              }}
              className={[
                "inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 py-2 text-left text-[13px] font-medium transition",
                isActive ? "bg-white font-semibold text-ink-900 shadow-sm" : "text-ink-500 hover:bg-white/60 hover:text-ink-800",
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
      <div id={active} role="tabpanel" className="min-w-0 space-y-4 scroll-mt-6">
        {panels}
      </div>
    </div>
  );
}
