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

  const selectTab = (id: string) => {
    setActive(id);
    window.history.replaceState(null, "", `#${id}`);
  };

  return (
    <div className="grid items-start gap-5 md:grid-cols-[190px_minmax(0,1fr)]">
      <div role="tablist" aria-label={ariaLabel} className="tf-section-tabs grid grid-cols-2 sm:grid-cols-4 md:sticky md:top-6 md:grid-cols-1">
        {tabs.map((t) => {
          const isActive = t.id === active;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`record-tab-${t.id}`}
              aria-controls={`record-panel-${t.id}`}
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              onClick={() => selectTab(t.id)}
              onKeyDown={(event) => {
                const current = tabs.findIndex((tab) => tab.id === t.id);
                const next = event.key === "ArrowDown" || event.key === "ArrowRight"
                  ? (current + 1) % tabs.length
                  : event.key === "ArrowUp" || event.key === "ArrowLeft"
                    ? (current - 1 + tabs.length) % tabs.length
                    : event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : -1;
                if (next < 0) return;
                event.preventDefault();
                const nextId = tabs[next]!.id;
                selectTab(nextId);
                document.getElementById(`record-tab-${nextId}`)?.focus();
              }}
              className={[
                "tf-section-tab inline-flex min-h-10 items-center gap-1.5 px-3 py-2 text-left text-[13px] font-medium transition",
                isActive ? "font-semibold text-ink-900" : "text-ink-500 hover:bg-white/30 hover:text-ink-800",
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
      <div id={`record-panel-${active}`} role="tabpanel" aria-labelledby={`record-tab-${active}`} tabIndex={0} className="min-w-0 space-y-4 scroll-mt-6">
        {panels}
      </div>
    </div>
  );
}
