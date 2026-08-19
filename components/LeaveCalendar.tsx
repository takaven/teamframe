import type { AdminCalendarLeave } from "@/services/leaveService";
import { downloadLeaveEvidenceAction } from "@/app/leaves/actions";

const SYSTEM_LABEL: Record<string, string> = {
  annual: "Annual Leave",
  sick: "Sick Leave",
  unpaid: "Unpaid Leave",
  other: "Other",
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function typeLabel(leave: AdminCalendarLeave): string {
  // Configured definition display name is authoritative; legacy rows fall back to the system type.
  return leave.leave_definition_name ?? SYSTEM_LABEL[leave.leave_type] ?? leave.leave_type;
}

function firstName(full: string): string {
  return full.split(" ")[0] ?? full;
}

function fmtLong(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

function monthHref(basePath: string, year: number, month: number): string {
  return `${basePath}?view=calendar&month=${year}-${pad2(month)}`;
}

function leaveHref(basePath: string, year: number, month: number, id: string): string {
  return `${monthHref(basePath, year, month)}&leave=${id}`;
}

export function LeaveCalendar({
  leaves,
  year,
  month,
  selectedLeaveId,
  basePath,
}: {
  leaves: AdminCalendarLeave[];
  year: number;
  month: number; // 1-12
  selectedLeaveId?: string;
  basePath: string;
}) {
  const monthLabel = new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  // Monday-first offset for the 1st of the month.
  const startOffset = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
  const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;

  const prevMonth = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };
  const nextMonth = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };

  // Absences active on a given YYYY-MM-DD (uses the actual request date span, NOT requested_days).
  const onDay = (iso: string) => leaves.filter((l) => l.start_date <= iso && iso <= l.end_date);

  const selected = selectedLeaveId ? leaves.find((l) => l.id === selectedLeaveId) : undefined;

  return (
    <section className="mt-8 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[17px] font-medium tracking-tight">{monthLabel}</h2>
        <div className="flex items-center gap-2 text-[13px]">
          <a href={monthHref(basePath, prevMonth.y, prevMonth.m)} className="rounded-full border border-ink-300 px-3 py-1 text-ink-700 transition hover:border-ink-900 hover:text-ink-900">← Prev</a>
          <a href={monthHref(basePath, nextMonth.y, nextMonth.m)} className="rounded-full border border-ink-300 px-3 py-1 text-ink-700 transition hover:border-ink-900 hover:text-ink-900">Next →</a>
        </div>
      </div>

      {leaves.length === 0 ? (
        <div className="rounded-xl border border-ink-300/70 bg-white/80 px-5 py-8 text-center text-[13px] text-ink-500">
          No approved leave in {monthLabel}.
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-ink-300/70 bg-white/80">
        <div className="grid min-w-[720px] grid-cols-7 border-b border-ink-200 text-[11px] uppercase tracking-[0.08em] text-ink-500">
          {WEEKDAYS.map((d) => (
            <div key={d} className="px-2 py-2 text-center">{d}</div>
          ))}
        </div>
        <div className="grid min-w-[720px] grid-cols-7">
          {Array.from({ length: totalCells }, (_, i) => {
            const dayNum = i - startOffset + 1;
            const inMonth = dayNum >= 1 && dayNum <= daysInMonth;
            if (!inMonth) {
              return <div key={i} className="min-h-[92px] border-b border-r border-ink-100 bg-ink-50/40" />;
            }
            const iso = `${year}-${pad2(month)}-${pad2(dayNum)}`;
            const isWeekend = i % 7 >= 5;
            const absences = onDay(iso);
            const shown = absences.slice(0, 3);
            const overflow = absences.length - shown.length;
            return (
              <div key={i} className={`min-h-[92px] border-b border-r border-ink-100 p-1.5 ${isWeekend ? "bg-ink-50/30" : ""}`}>
                <div className="mb-1 text-right text-[11px] tabular-nums text-ink-400">{dayNum}</div>
                <div className="space-y-1">
                  {shown.map((l) => {
                    const isSel = l.id === selectedLeaveId;
                    return (
                      <a
                        key={`${l.id}-${iso}`}
                        href={leaveHref(basePath, year, month, l.id)}
                        title={`${l.employee_full_name} — ${typeLabel(l)} (${fmtLong(l.start_date)} to ${fmtLong(l.end_date)})`}
                        className={`block truncate rounded px-1.5 py-0.5 text-[11px] ${isSel ? "bg-ink-800 text-white" : "bg-ink-100 text-ink-700 hover:bg-ink-200"}`}
                      >
                        {firstName(l.employee_full_name)} · {typeLabel(l)}
                      </a>
                    );
                  })}
                  {overflow > 0 ? (
                    <a href={monthHref(basePath, year, month)} className="block px-1.5 text-[11px] text-ink-500 hover:text-ink-900">+{overflow} more</a>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {selected ? (
        <div className="rounded-xl border border-ink-300/70 bg-white/85 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[15px] font-medium text-ink-900">{selected.employee_full_name} <span className="text-[12px] font-normal text-ink-500">({selected.employee_role_title})</span></p>
              <p className="mt-1 text-[13px] text-ink-700">{typeLabel(selected)}</p>
            </div>
            <a href={monthHref(basePath, year, month)} className="text-[12px] text-ink-500 underline underline-offset-2 hover:text-ink-900">Close</a>
          </div>
          <dl className="mt-4 grid gap-x-8 gap-y-2 text-[13px] sm:grid-cols-2">
            <div className="flex justify-between border-b border-ink-100 py-1"><dt className="text-ink-500">From</dt><dd className="font-mono tabular-nums">{fmtLong(selected.start_date)}</dd></div>
            <div className="flex justify-between border-b border-ink-100 py-1"><dt className="text-ink-500">To</dt><dd className="font-mono tabular-nums">{fmtLong(selected.end_date)}</dd></div>
            <div className="flex justify-between border-b border-ink-100 py-1"><dt className="text-ink-500">Counted days</dt><dd className="font-mono tabular-nums">{selected.requested_days}</dd></div>
            <div className="flex justify-between border-b border-ink-100 py-1"><dt className="text-ink-500">Status</dt><dd className="capitalize">{selected.status}</dd></div>
            {selected.reason ? (
              <div className="flex justify-between border-b border-ink-100 py-1 sm:col-span-2"><dt className="text-ink-500">Reason</dt><dd className="text-right text-ink-800">{selected.reason}</dd></div>
            ) : null}
          </dl>
          {selected.attachment_document_id ? (
            <form action={downloadLeaveEvidenceAction} className="mt-3">
              <input type="hidden" name="document_id" value={selected.attachment_document_id} />
              <input type="hidden" name="return_to" value={monthHref(basePath, year, month)} />
              <button type="submit" className="text-[12px] text-accent underline underline-offset-2">Evidence attached — view</button>
            </form>
          ) : (
            <p className="mt-3 text-[12px] text-ink-400">No supporting evidence attached.</p>
          )}
        </div>
      ) : null}
    </section>
  );
}
