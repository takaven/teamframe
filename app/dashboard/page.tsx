import Link from "next/link";
import { requireTenantRole } from "@/middleware/rbac";
import { AppShell } from "@/components/AppShell";
import { OverviewQueue, type OverviewQueueItem } from "@/components/OverviewQueue";
import { getCompanyIdentity, getActorFirstName } from "@/lib/company/identity";
import { loadControlCentreData } from "@/app/dashboard/data";
import { listFailedDeliveries } from "@/services/notificationService";
import { retryNotificationAction } from "@/app/notifications/actions";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";

export const dynamic = "force-dynamic";

function greeting(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function formatResolvedAt(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export default async function DashboardPage() {
  const actor = await requireTenantRole("admin");
  const [{ savedDataStatus, allItems, resolvedItems, activeEmployeeCount, teamSummary: loadedTeamSummary }, identity, firstName, failedNotifications] =
    await Promise.all([
      loadControlCentreData({ tenantId: actor.tenantId }),
      getCompanyIdentity(actor.tenantId),
      getActorFirstName(actor),
      listFailedDeliveries(actor.tenantId),
    ]);

  const now = new Date();
  const teamSummary = loadedTeamSummary ?? { startingThisMonth: 0, leavingThisMonth: 0, awayToday: 0 };
  const dateLabel = now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  const hello = firstName ? `${greeting(now.getHours())}, ${firstName}` : greeting(now.getHours());

  const attentionCutoff = addDays(now, 7).toISOString();
  const comingUpCutoff = addDays(now, 30).toISOString();
  const attentionItems = allItems.filter((item) => !item.dueAt || item.dueAt <= attentionCutoff || item.class !== "due");
  const needsAttention = attentionItems.slice(0, 10);
  const attentionIds = new Set(attentionItems.map((item) => item.id));
  const comingUp = allItems
    .filter((item) => !attentionIds.has(item.id) && item.dueAt && item.dueAt > attentionCutoff && item.dueAt <= comingUpCutoff)
    .slice(0, 8);
  const queueItems: OverviewQueueItem[] = needsAttention.map((item) => ({
    id: item.id,
    class: item.class,
    source: item.source,
    title: item.title,
    subjectName: item.subjectName,
    owner: item.owner,
    nextAction: item.nextAction,
    dueAt: item.dueAt,
    href: item.href,
    detail: item.detail,
  }));
  const counts = {
    all: needsAttention.length,
    decision: needsAttention.filter((item) => item.class === "decision").length,
    overdue: needsAttention.filter((item) => item.class === "overdue").length,
    due: needsAttention.filter((item) => item.class === "due").length,
    exception: needsAttention.filter((item) => item.class === "exception").length,
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
          {needsAttention.length === 0 ? "Nothing needs your attention" : (
            <><span className="font-semibold text-ink-900 tf-num">{needsAttention.length}</span> need your attention</>
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

      {failedNotifications.length > 0 ? <section className="mt-5 rounded-xl border border-signal-red/30 bg-signal-red/10 px-4 py-3"><h2 className="text-[14px] font-bold text-ink-900">Email delivery needs review</h2><ul className="mt-2 divide-y divide-signal-red/15">{failedNotifications.map((item) => <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-2 text-[13px]"><span><strong>{item.notification_type.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase())}</strong> could not be sent to {item.recipient_email ?? "the intended recipient"}. <span className="text-ink-500">{item.last_error_summary}</span></span>{item.attempt_count < 3 ? <form action={retryNotificationAction}><input type="hidden" name="delivery_id" value={item.id}/><PendingSubmitButton idleLabel="Retry" pendingLabel="Retrying…" className="tf-secondary-action px-3 py-1.5 text-[12px]"/></form> : null}</li>)}</ul></section> : null}

      <section className="mt-7" aria-labelledby="needs-attention-heading">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="tf-kicker">Today</p>
            <h2 id="needs-attention-heading" className="tf-h2 mt-1">Needs your attention</h2>
          </div>
          {attentionItems.length > needsAttention.length ? <p className="text-[12px] text-ink-500">Showing the first {needsAttention.length} of {attentionItems.length}</p> : null}
        </div>
        <OverviewQueue items={queueItems} counts={counts} />
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.35fr_.9fr]">
        <section className="tf-surface-flat p-5" aria-labelledby="coming-up-heading">
          <div className="flex items-baseline justify-between gap-4">
            <h2 id="coming-up-heading" className="tf-h2">Coming up</h2>
            <span className="text-[12px] text-ink-500">Next 30 days</span>
          </div>
          {comingUp.length === 0 ? (
            <p className="mt-4 text-[13.5px] text-ink-500">No scheduled people events in the next 30 days.</p>
          ) : (
            <ul className="mt-3 divide-y divide-ink-100">
              {comingUp.map((item) => (
                <li key={item.id}>
                  <Link href={item.href} className="flex items-center justify-between gap-4 py-3 text-[13px] hover:text-ink-900">
                    <span><span className="font-medium text-ink-800">{item.title}</span><span className="mt-0.5 block text-[12px] text-ink-500">{item.subjectName}</span></span>
                    <span className="shrink-0 tabular-nums text-ink-500">{item.dueAt ? formatResolvedAt(item.dueAt) : ""}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="tf-surface-flat p-5" aria-labelledby="your-team-heading">
          <h2 id="your-team-heading" className="tf-h2">Your team</h2>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {[
              ["Active", activeEmployeeCount, "/people?filter=active"],
              ["Starting this month", teamSummary.startingThisMonth, "/people?filter=pre_start"],
              ["Leaving this month", teamSummary.leavingThisMonth, "/people?filter=offboarding"],
              ["Away today", teamSummary.awayToday, "/leaves?view=calendar"],
            ].map(([label, value, href]) => (
              <Link key={String(label)} href={String(href)} className="rounded-xl border border-ink-200 bg-white/60 p-3 transition hover:border-ink-400">
                <span className="block text-[22px] font-semibold tabular-nums text-ink-900">{value}</span>
                <span className="mt-0.5 block text-[11.5px] text-ink-500">{label}</span>
              </Link>
            ))}
          </div>
        </section>
      </div>

      <section className="mt-8" aria-labelledby="quick-actions-heading">
        <h2 id="quick-actions-heading" className="tf-h2">Quick actions</h2>
        <div className="mt-3 flex flex-wrap gap-3">
          <Link href="/people/add" className="tf-primary-action px-4 py-2 text-[13px]">Add person</Link>
          <Link href="/policies#upload" className="tf-secondary-action px-4 py-2 text-[13px]">New policy</Link>
        </div>
      </section>

      {resolvedItems.length > 0 ? (
        <section className="mt-8">
          <details className="group tf-surface-flat px-5 py-4">
            <summary className="flex cursor-pointer list-none items-center justify-between text-[13.5px] font-semibold text-ink-700 marker:hidden">
              <span>Recently done</span>
              <span className="text-[12px] font-normal text-ink-500 group-open:hidden">{resolvedItems.length} · show</span>
              <span className="hidden text-[12px] font-normal text-ink-500 group-open:inline">hide</span>
            </summary>
            <ul className="mt-3 border-t border-ink-100 pt-1">
              {resolvedItems.map((item) => (
                <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 py-2.5 last:border-b-0">
                  <div className="min-w-0">
                    <p className="text-[14px] font-medium text-ink-800">{item.title}</p>
                    <p className="mt-0.5 text-[12px] text-ink-500">{item.subjectName} · Done</p>
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
