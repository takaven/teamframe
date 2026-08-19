"use client";

import { useRef, useState } from "react";

/**
 * Shared styled file-upload control (Phase-8 consolidated pass). Replaces the raw browser
 * "Choose File" control with a coherent button + selected-filename treatment. It is a thin,
 * dependency-free wrapper over a native <input type="file"> so it works inside plain server-action
 * forms (the real input still submits; this only styles the trigger and shows the chosen name).
 */
export function FileInput({
  name,
  accept,
  required = false,
  label = "Choose file",
  className = "",
}: {
  name: string;
  accept?: string;
  required?: boolean;
  label?: string;
  className?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [filename, setFilename] = useState<string | null>(null);

  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      <button
        type="button"
        onClick={() => ref.current?.click()}
        className="tf-secondary-action shrink-0 px-3 py-1.5 text-[12px] font-medium"
      >
        {label}
      </button>
      <span className="min-w-0 flex-1 truncate text-[12px] text-ink-500">{filename ?? "No file selected"}</span>
      <input
        ref={ref}
        type="file"
        name={name}
        accept={accept}
        required={required}
        className="sr-only"
        onChange={(e) => setFilename(e.target.files?.[0]?.name ?? null)}
      />
    </div>
  );
}
