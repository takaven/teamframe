import Link from "next/link";
import { requireTenantRole } from "@/middleware/rbac";
import { AppShell } from "@/components/AppShell";
import { StatusPill, type StatusPillTone } from "@/components/StatusPill";
import {
  loadControlCentreData,
  type ControlCentreClass,
  type ControlCentreItem,
  type ResolvedControlCentreItem,
} from "@/app/dashboard/data";

export const dynamic = "force-dynamic";

function formatDateTime(iso: string | null): string {
  if (!iso) return "No due date";
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function classLabel(value: ControlCentreClass): string {
  if (value === "decision") return "Decision";
  if (value === "overdue") return "Overdue";
  if (value === "exception") return "Exception";
  return "Due";
}

function classTone(value: ControlCentreClass): StatusPillTone {
  if (value === "exception") return "red";
  if (value === "decision") return "amber";
  if (value === "overdue") return "amber";
  return "neutral";
}

function classSpine(value: ControlCentreClass): string {
  if (value === "exception") return "border-l-signal-red";
  if (value === "decision" || value === "overdue") return "border-l-signal-amber";
  return "border-l-ink-300";
}

function sourceLabel(source: string): string {
  if (source.startsWith("policy")) return "Policies";
  if (source.startsWith("document")) return "Documents";
  if (source.startsWith("onboarding")) return "Onboarding";
  if (source.startsWith("probation")) return "Probation";
  if (source.startsWith("leave")) return "Leave";
  if (source.startsWith("offboarding")) return "Offboarding";
  if (source.startsWith("automation")) return "Automation";
  if (source.startsWith("signal")) return "Signal";
  return "People ops";
}

function ItemCard({ item }: { item: ControlCentreItem }) {
  return (
    <article className={`rounded-lg border border-ink-300/70 border-l-[3px] bg-white p-4 ${classSpine(item.class)}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-[12px] text-ink-500">
            <StatusPill tone={classTone(item.class)}>{classLabel(item.class)}</StatusPill>
            <span>{sourceLabel(item.source)}</span>
            <span>{item.subjectName}</span>
          </div>
          <h3 className="mt-2 text-[18px] leading-tight tracking-tight text-ink-800">{item.title}</h3>
        </div>
        <p className="font-mono text-[12px] tabular-nums text-ink-500">{formatDateTime(item.dueAt)}</p>
      </div>
      <p className="mt-3 text-[14px] text-ink-700">{item.detail}</p>
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-ink-300/60 pt-3">
        <p className="text-[12px] text-ink-500">
          Updated <span className="font-mono tabular-nums">{formatDateTime(item.updatedAt)}</span>
        </p>
        <Link
          href={item.href}
          className="rounded-lg border border-ink-300 px-3 py-1.5 text-[12px] text-ink-700 transition hover:border-ink-900 hover:text-ink-900"
        >
          Open
        </Link>
      </div>
    </article>
  );
}

function ResolutionRow({ item }: { item: ResolvedControlCentreItem }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 py-3 last:border-b-0">
      <div>
        <p className="text-[14px] font-medium text-ink-800">{item.title}</p>
        <p className="mt-0.5 text-[12px] text-ink-500">
          {item.subjectName} · {item.detail}
        </p>
      </div>
      <p className="font-mono text-[12px] tabular-nums text-ink-500">{formatDateTime(item.resolvedAt)}</p>
    </li>
  );
}

export default async function DashboardPage() {
  const actor = await requireTenantRole("admin");
  const { savedDataStatus, summary, previewItems, allItems, resolvedItems, activeEmployeeCount } =
    await loadControlCentreData({
      tenantId: actor.tenantId,
    });

  const hasMoreItems = allItems.length > previewItems.length;
  const exceptionItems = allItems.filter((item) => item.class === "exception").slice(0, 3);

  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <AppShell actor={actor} activePath="/dashboard" />

      <header className="border-b border-ink-300/60 pb-5">
        <div className="space-y-2">
          <p className="text-[12px] tracking-[0.14em] text-ink-500">HR Control Centre</p>
          <h1 className="font-display text-[36px] font-extrabold leading-tight text-ink-800">
            {summary.total === 0
              ? "No HR actions need your attention right now."
              : `${summary.total} HR action${summary.total === 1 ? "" : "s"} need attention.`}
          </h1>
          <p className="max-w-3xl text-[14px] text-ink-500">
            Decisions, due work, overdue work and exceptions are separated from durable resolution history.
          </p>
        </div>
      </header>

      {savedDataStatus.state !== "success" ? (
        <section
          role="alert"
          className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-signal-red/30 bg-signal-red/10 px-4 py-3 text-[13px] text-ink-700"
        >
          <div>
            <p className="font-medium text-ink-900">Control Centre data could not load yet.</p>
            <p className="mt-0.5 text-ink-500">
              {savedDataStatus.state === "timeout"
                ? "The current-state read took too long, so no all-clear is being shown."
                : "The current-state read failed safely. Retry without exposing provider details."}
            </p>
          </div>
          <Link
            href="/dashboard"
            className="rounded-full border border-ink-300 bg-white px-3 py-1.5 text-[12px] text-ink-800 transition hover:border-ink-900"
          >
            Retry
          </Link>
        </section>
      ) : null}

      <section className="mt-7 grid gap-3 border-y border-ink-100 bg-white/70 py-4 md:grid-cols-5" aria-label="Control Centre totals">
        {[
          { label: "Decisions", value: summary.decisions, help: "Human judgement needed." },
          { label: "Overdue", value: summary.overdue, help: "Unresolved after due date." },
          { label: "Due", value: summary.due, help: "Routine work due now." },
          { label: "Exceptions", value: summary.exceptions, help: "Meaningful unresolved issues." },
          { label: "Active", value: activeEmployeeCount, help: "Current active employees." },
        ].map((stage, index) => (
          <article key={stage.label} className="grid grid-cols-[2px_1fr_auto] gap-3 px-2 py-2">
            <span className={`h-9 w-[2px] rounded-full ${index === 3 && stage.value > 0 ? "bg-signal-red" : "bg-ink-100"}`} aria-hidden="true" />
            <div>
              <h2 className="text-[15px] font-extrabold text-ink-800">{stage.label}</h2>
              <p className="mt-1 text-[13px] text-ink-500">{stage.help}</p>
            </div>
            <p className="font-mono text-[22px] tabular-nums text-ink-800">{stage.value}</p>
          </article>
        ))}
      </section>

      <section className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.85fr)]">
        <div className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-[22px] tracking-tight text-ink-800">Needs attention</h2>
              <p className="text-[13px] text-ink-500">
                Showing {previewItems.length} of {summary.total} current item{summary.total === 1 ? "" : "s"} in deterministic priority order.
              </p>
            </div>
            {hasMoreItems ? (
              <a href="#all-current-items" className="rounded-lg border border-ink-300 px-3 py-1.5 text-[12px] text-ink-700 transition hover:border-ink-900">
                View all
              </a>
            ) : null}
          </div>

          {previewItems.length === 0 ? (
            <article className="rounded-lg border border-ink-300/70 bg-white p-5 text-[14px] text-ink-700">
              No current decisions, due work, overdue work or exceptions were found.
            </article>
          ) : (
            <div className="space-y-3">
              {previewItems.map((item) => (
                <ItemCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <article className="rounded-lg border border-ink-300/70 bg-surface-elevated p-5">
            <p className="text-[12px] uppercase tracking-[0.14em] text-ink-500">Exceptions</p>
            {exceptionItems.length === 0 ? (
              <p className="mt-3 text-[14px] text-ink-700">No active exceptions right now.</p>
            ) : (
              <div className="mt-3 space-y-3">
                {exceptionItems.map((item) => (
                  <ItemCard key={item.id} item={item} />
                ))}
              </div>
            )}
          </article>

          <article className="rounded-lg border border-ink-300/70 bg-white p-5">
            <p className="text-[12px] uppercase tracking-[0.14em] text-ink-500">Recent resolutions</p>
            {resolvedItems.length === 0 ? (
              <p className="mt-3 text-[14px] text-ink-700">Resolved exceptions will remain visible here as durable history.</p>
            ) : (
              <ul className="mt-2">
                {resolvedItems.map((item) => (
                  <ResolutionRow key={item.id} item={item} />
                ))}
              </ul>
            )}
          </article>
        </aside>
      </section>

      <section id="all-current-items" className="mt-7 rounded-lg border border-ink-300/70 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[20px] tracking-tight text-ink-800">All current items</h2>
            <p className="text-[13px] text-ink-500">The headline count and this list use the same current-state query.</p>
          </div>
          <StatusPill tone="neutral">{allItems.length} total</StatusPill>
        </div>
        {allItems.length === 0 ? (
          <p className="mt-4 text-[14px] text-ink-700">No HR actions need your attention right now.</p>
        ) : (
          <div className="mt-4 divide-y divide-ink-100">
            {allItems.map((item) => (
              <div key={item.id} className="grid gap-2 py-3 md:grid-cols-[110px_1fr_160px_80px] md:items-center">
                <StatusPill tone={classTone(item.class)}>{classLabel(item.class)}</StatusPill>
                <div>
                  <p className="text-[14px] font-medium text-ink-800">{item.title}</p>
                  <p className="text-[12px] text-ink-500">{item.subjectName} · {sourceLabel(item.source)}</p>
                </div>
                <p className="font-mono text-[12px] tabular-nums text-ink-500">{formatDateTime(item.dueAt)}</p>
                <Link href={item.href} className="text-[12px] text-ink-700 underline-offset-4 hover:underline">
                  Open
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
