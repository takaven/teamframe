"use client";

import { Children, isValidElement, useState, type ReactNode } from "react";

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

  const panels = Children.toArray(children).filter((child) => {
    if (!isValidElement(child)) return false;
    const props = child.props as { "data-tab"?: string };
    return props["data-tab"] === active;
  });

  return (
    <div>
      <div role="tablist" aria-label={ariaLabel} className="flex flex-nowrap gap-1 overflow-x-auto border-b border-ink-200 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tabs.map((t) => {
          const isActive = t.id === active;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActive(t.id)}
              className={[
                "relative -mb-px inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3.5 py-2.5 text-[13.5px] font-medium transition",
                isActive ? "border-b-2 border-ink-900 text-ink-900" : "border-b-2 border-transparent text-ink-500 hover:text-ink-800",
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
      <div role="tabpanel" className="space-y-4 pt-5">
        {panels}
      </div>
    </div>
  );
}
