"use client";

import { useRef, useState } from "react";

/**
 * Deliberate TeamFrame file-upload control. A dependency-free wrapper over a native
 * <input type="file"> (the real input still submits inside plain server-action forms); this styles
 * the trigger as a dashed dropzone-style affordance and shows the chosen filename. The user never
 * sees the browser-default "Choose file / No file selected" control.
 */
export function FileInput({
  name,
  accept,
  required = false,
  label = "Choose a file",
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
    <div className={className}>
      <button
        type="button"
        onClick={() => ref.current?.click()}
        className="flex w-full items-center gap-2.5 rounded-lg border border-dashed border-ink-300 bg-ink-50/60 px-3 py-2 text-left transition hover:border-ink-500 hover:bg-ink-50"
      >
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white text-[13px] text-ink-500 ring-1 ring-ink-200" aria-hidden>
          ↑
        </span>
        {filename ? (
          <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-ink-800">{filename}</span>
        ) : (
          <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink-500">{label}</span>
        )}
        <span className="shrink-0 text-[11.5px] font-medium text-ink-500">{filename ? "Change" : "Browse"}</span>
      </button>
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
