"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

export type SelectOption = { value: string; label: string };

/**
 * TeamFrame select primitive — a deliberate custom listbox, not a styled native <select>. Presents a
 * TeamFrame-styled trigger, chevron and popover (with optional search for long lists). The chosen
 * value is submitted via a hidden input using the exact same option values as before, so no workflow
 * or data changes. Native <select> chrome is never rendered.
 */
export function SelectField({
  name,
  options,
  defaultValue = "",
  required = false,
  placeholder = "Select…",
  searchable = false,
  id,
  className = "",
}: {
  name: string;
  options: SelectOption[];
  defaultValue?: string | null;
  required?: boolean;
  placeholder?: string;
  searchable?: boolean;
  id?: string;
  className?: string;
}) {
  const [value, setValue] = useState(defaultValue ?? "");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const autoId = useId();
  const fieldId = id ?? `select-${autoId}`;

  const selected = options.find((o) => o.value === value) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    if (searchable) setTimeout(() => searchRef.current?.focus(), 0);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open, searchable]);

  const choose = (v: string) => { setValue(v); setOpen(false); setQuery(""); };

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      {/* Submitted value (unchanged option values). sr-only required mirror preserves validation. */}
      <input type="hidden" name={name} value={value} />
      {required ? (
        <input
          tabIndex={-1}
          aria-hidden="true"
          required
          value={value}
          onChange={() => {}}
          className="sr-only"
        />
      ) : null}
      <button
        type="button"
        id={fieldId}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="tf-input flex w-full items-center justify-between gap-2 text-left"
      >
        <span className={selected ? "truncate text-ink-900" : "truncate text-ink-400"}>{selected ? selected.label : placeholder}</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-ink-500" aria-hidden>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open ? (
        <div className="absolute left-0 z-50 mt-1 w-full min-w-[200px] rounded-xl border border-ink-200 bg-white p-1 shadow-[0_12px_36px_-18px_rgba(15,17,21,0.4)]">
          {searchable ? (
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              className="mb-1 w-full rounded-lg border border-ink-200 px-2.5 py-1.5 text-[13px] outline-none focus:border-ink-500"
            />
          ) : null}
          <ul role="listbox" aria-labelledby={fieldId} className="max-h-[248px] overflow-y-auto">
            {filtered.length === 0 ? (
              <li className="px-2.5 py-2 text-[12.5px] text-ink-400">No matches</li>
            ) : (
              filtered.map((o) => {
                const isSel = o.value === value;
                return (
                  <li key={o.value || "empty"} role="option" aria-selected={isSel}>
                    <button
                      type="button"
                      onClick={() => choose(o.value)}
                      className={[
                        "flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-[13px] transition",
                        isSel ? "bg-ink-100 font-medium text-ink-900" : "text-ink-700 hover:bg-ink-50",
                      ].join(" ")}
                    >
                      <span className="truncate">{o.label || placeholder}</span>
                      {isSel ? <span aria-hidden className="ml-2 text-ink-500">✓</span> : null}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
