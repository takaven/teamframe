// Renders position occupancy history from position_assignments. Never fabricates a
// date: a migration snapshot (is_snapshot, no effective_start) shows an explicit
// "start date not recorded" instead of a guessed date.

export type OccupancyRow = {
  id: string;
  employee_name: string | null;
  effective_start: string | null;
  effective_end: string | null;
  is_snapshot: boolean;
};

function fmt(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function periodLabel(row: OccupancyRow): string {
  const start = fmt(row.effective_start);
  const end = fmt(row.effective_end);
  if (row.effective_end === null) {
    // Current / open assignment.
    if (!start) return "Current assignment — start date not recorded";
    return `Since ${start}`;
  }
  if (!start) return `Until ${end}`;
  return `${start} – ${end}`;
}

export function OccupancyHistory({ assignments }: { assignments: OccupancyRow[] }) {
  if (assignments.length === 0) {
    return <p className="text-[13px] text-ink-500">No occupancy history yet — this position has never been filled.</p>;
  }
  // Current first (open), then previous by most recent end.
  const current = assignments.filter((a) => a.effective_end === null);
  const previous = assignments
    .filter((a) => a.effective_end !== null)
    .sort((a, b) => (b.effective_end ?? "").localeCompare(a.effective_end ?? ""));

  return (
    <ul className="space-y-3">
      {current.map((row) => (
        <li key={row.id} className="rounded-lg border border-ink-200 bg-white px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[13px] font-medium text-ink-900">{row.employee_name ?? "Unknown employee"}</span>
            <span className="rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-semibold text-green-700">Current</span>
          </div>
          <p className="mt-1 text-[12px] text-ink-500">{periodLabel(row)}</p>
        </li>
      ))}
      {previous.map((row) => (
        <li key={row.id} className="rounded-lg border border-ink-100 bg-ink-50/40 px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[13px] text-ink-800">{row.employee_name ?? "Unknown employee"}</span>
            <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[11px] font-medium text-ink-500">Previous</span>
          </div>
          <p className="mt-1 text-[12px] text-ink-500">{periodLabel(row)}</p>
        </li>
      ))}
    </ul>
  );
}
