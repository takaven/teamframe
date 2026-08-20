"use client";

import { useEffect, useId, useRef, useState } from "react";

/**
 * TeamFrame date primitive. Fully replaces the browser's native `input[type=date]` presentation:
 * the user sees a humane value ("20 Aug 2026") and a custom month calendar — never Chrome's
 * `dd/mm/yyyy` field or native calendar chrome. The actual form value is carried by an sr-only
 * native date input, so submission format (YYYY-MM-DD), required/min/max and validation stay native
 * and unchanged. No date logic or workflow is altered.
 */

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

function humane(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return "";
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
  });
}
function pad(n: number): string { return String(n).padStart(2, "0"); }
function isoOf(y: number, m0: number, d: number): string { return `${y}-${pad(m0 + 1)}-${pad(d)}`; }

export function DateField({
  name,
  defaultValue = "",
  required = false,
  min,
  max,
  id,
  placeholder = "Select a date",
  className = "",
  dense = false,
  "aria-label": ariaLabel,
}: {
  name: string;
  defaultValue?: string | null;
  required?: boolean;
  min?: string;
  max?: string;
  id?: string;
  placeholder?: string;
  className?: string;
  dense?: boolean;
  "aria-label"?: string;
}) {
  const [iso, setIso] = useState(defaultValue ?? "");
  const [open, setOpen] = useState(false);
  const initial = (defaultValue ?? "").length === 10 ? (defaultValue as string) : "";
  const [view, setView] = useState<{ y: number; m: number }>(() => {
    const base = initial || min || max || "";
    if (base.length === 10) return { y: +base.slice(0, 4), m: +base.slice(5, 7) - 1 };
    const now = new Date();
    return { y: now.getFullYear(), m: now.getMonth() };
  });
  const rootRef = useRef<HTMLDivElement>(null);
  const nativeRef = useRef<HTMLInputElement>(null);
  const autoId = useId();
  const fieldId = id ?? `date-${autoId}`;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const commit = (next: string) => {
    setIso(next);
    // Keep the native input (source of truth for submission/validation) in sync.
    if (nativeRef.current) {
      nativeRef.current.value = next;
      nativeRef.current.dispatchEvent(new Event("input", { bubbles: true }));
    }
  };
  const selectDay = (d: number) => { commit(isoOf(view.y, view.m, d)); setOpen(false); };
  const shiftMonth = (delta: number) => {
    setView((v) => {
      const total = v.y * 12 + v.m + delta;
      return { y: Math.floor(total / 12), m: ((total % 12) + 12) % 12 };
    });
  };

  // Build the month grid (Monday-first).
  const firstDow = (new Date(Date.UTC(view.y, view.m, 1)).getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(view.y, view.m + 1, 0)).getUTCDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const disabled = (d: number) => {
    const s = isoOf(view.y, view.m, d);
    if (min && s < min) return true;
    if (max && s > max) return true;
    return false;
  };

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      {/* Real form control — carries the value, native validation/required/min/max, keyboard-focusable
          for validation, but visually removed so its dd/mm/yyyy chrome never shows. */}
      <input
        ref={nativeRef}
        type="date"
        name={name}
        defaultValue={iso}
        required={required}
        min={min}
        max={max}
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
        onInput={(e) => setIso((e.target as HTMLInputElement).value)}
      />
      <button
        type="button"
        id={fieldId}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
        className={`${dense ? "tf-input-sm" : "tf-input"} flex w-full items-center justify-between gap-2 text-left`}
      >
        <span className={iso ? "truncate text-ink-900" : "truncate text-ink-400"}>{iso ? humane(iso) : placeholder}</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="shrink-0 text-ink-500" aria-hidden>
          <rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M8 2v4M16 2v4" />
        </svg>
      </button>

      {open ? (
        <div role="dialog" aria-label="Choose date" className="absolute left-0 z-50 mt-1 w-[248px] rounded-xl border border-ink-200 bg-white p-3 shadow-[0_12px_36px_-18px_rgba(15,17,21,0.4)]">
          <div className="mb-2 flex items-center justify-between">
            <button type="button" onClick={() => shiftMonth(-1)} aria-label="Previous month" className="flex h-7 w-7 items-center justify-center rounded-md text-ink-600 hover:bg-ink-100">‹</button>
            <span className="text-[13px] font-semibold text-ink-800 tabular-nums">{MONTH_NAMES[view.m]} {view.y}</span>
            <button type="button" onClick={() => shiftMonth(1)} aria-label="Next month" className="flex h-7 w-7 items-center justify-center rounded-md text-ink-600 hover:bg-ink-100">›</button>
          </div>
          <div className="grid grid-cols-7 gap-0.5 text-center text-[10.5px] font-medium text-ink-400">
            {WEEKDAYS.map((w) => <span key={w} className="py-1">{w}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((d, i) => {
              if (d === null) return <span key={i} />;
              const s = isoOf(view.y, view.m, d);
              const isSel = s === iso;
              const isDisabled = disabled(d);
              return (
                <button
                  key={i}
                  type="button"
                  disabled={isDisabled}
                  aria-pressed={isSel}
                  onClick={() => selectDay(d)}
                  className={[
                    "flex h-8 items-center justify-center rounded-md text-[12.5px] tabular-nums transition",
                    isSel ? "bg-ink-900 font-semibold text-white" : "text-ink-700 hover:bg-ink-100",
                    isDisabled ? "cursor-not-allowed text-ink-300 hover:bg-transparent" : "",
                  ].join(" ")}
                >
                  {d}
                </button>
              );
            })}
          </div>
          {!required ? (
            <button type="button" onClick={() => { commit(""); setOpen(false); }} className="mt-2 w-full rounded-md py-1 text-[12px] text-ink-500 hover:bg-ink-50">Clear</button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
