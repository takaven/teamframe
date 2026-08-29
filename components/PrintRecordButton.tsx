"use client";

/**
 * Opens the browser's own print dialog for the employee record on screen.
 * "Save as PDF" is the destination the browser offers there — TeamFrame ships
 * no PDF engine, template system or report builder; the printed page is the
 * record itself, styled by the @media print rules in app/globals.css.
 */
export function PrintRecordButton({ className }: { className: string }) {
  return (
    <button type="button" className={className} onClick={() => window.print()}>
      Print / Save as PDF
    </button>
  );
}
