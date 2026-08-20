import Link from "next/link";
import { requireTenantRole } from "@/middleware/rbac";
import { AppShell } from "@/components/AppShell";
import { OverviewQueue, type OverviewQueueItem } from "@/components/OverviewQueue";
import { getCompanyIdentity, getActorFirstName } from "@/lib/company/identity";
import { loadControlCentreData } from "@/app/dashboard/data";

export const dynamic = "force-dynamic";

function greeting(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function formatResolvedAt(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default async function DashboardPage() {
  const actor = await requireTenantRole("admin");
  const [{ savedDataStatus, summary, allItems, resolvedItems, activeEmployeeCount }, identity, firstName] =
    await Promise.all([
      loadControlCentreData({ tenantId: actor.tenantId }),
      getCompanyIdentity(actor.tenantId),
      getActorFirstName(actor),
    ]);

  const now = new Date();
  const dateLabel = now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  const hello = firstName ? `${greeting(now.getHours())}, ${firstName}` : greeting(now.getHours());

  const queueItems: OverviewQueueItem[] = allItems.map((item) => ({
    id: item.id,
    class: item.class,
    source: item.source,
    title: item.title,
    subjectName: item.subjectName,
    dueAt: item.dueAt,
    href: item.href,
    detail: item.detail,
  }));
  const counts = {
    all: summary.total,
    decision: summary.decisions,
    overdue: summary.overdue,
    due: summary.due,
    exception: summary.exceptions,
  };

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <AppShell actor={actor} activePath="/dashboard" />

      <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 pb-5">
        <div>
          <h1 className="tf-h1">{hello}</h1>
          <p className="tf-meta mt-1">{identity.name} · {dateLabel}</p>
        </div>
        <p className="tf-meta">
          {summary.total === 0 ? "All clear" : (
            <><span className="font-semibold text-ink-900 tf-num">{summary.total}</span> {summary.total === 1 ? "item needs" : "items need"} attention</>
          )}
          <span className="mx-2 text-ink-300">·</span>
          <span className="tf-num">{activeEmployeeCount}</span> active
        </p>
      </header>

      {savedDataStatus.state !== "success" ? (
        <section
          role="alert"
          className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-signal-red/30 bg-signal-red/10 px-4 py-3 text-[13px] text-ink-700"
        >
          <div>
            <p className="font-medium text-ink-900">Your attention list could not load just now.</p>
            <p className="mt-0.5 text-ink-500">Nothing is being hidden — please retry.</p>
          </div>
          <Link href="/dashboard" className="tf-secondary-action px-3 py-1.5 text-[12px]">
            Retry
          </Link>
        </section>
      ) : null}

      <section className="mt-7">
        <OverviewQueue items={queueItems} counts={counts} />
      </section>

      {resolvedItems.length > 0 ? (
        <section className="mt-8">
          <details className="group tf-surface-flat px-5 py-4">
            <summary className="flex cursor-pointer list-none items-center justify-between text-[13.5px] font-semibold text-ink-700 marker:hidden">
              <span>Recently resolved</span>
              <span className="text-[12px] font-normal text-ink-500 group-open:hidden">{resolvedItems.length} · show</span>
              <span className="hidden text-[12px] font-normal text-ink-500 group-open:inline">hide</span>
            </summary>
            <ul className="mt-3 border-t border-ink-100 pt-1">
              {resolvedItems.map((item) => (
                <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 py-2.5 last:border-b-0">
                  <div className="min-w-0">
                    <p className="text-[14px] font-medium text-ink-800">{item.title}</p>
                    <p className="mt-0.5 text-[12px] text-ink-500">{item.subjectName} · {item.detail}</p>
                  </div>
                  <span className="text-[12px] tabular-nums text-ink-500">{formatResolvedAt(item.resolvedAt)}</span>
                </li>
              ))}
            </ul>
          </details>
        </section>
      ) : null}
    </main>
  );
}
