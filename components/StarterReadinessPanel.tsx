import { StatusPill } from "@/components/StatusPill";
import type { ReadinessBlocker } from "@/services/starterReadiness";

export function StarterReadinessPanel({
  ready, checked, startDate, accountState, blockers,
}: {
  ready: boolean;
  checked: number;
  startDate: string | null;
  accountState: string;
  blockers: ReadinessBlocker[];
}) {
  const startLabel = startDate
    ? new Date(`${startDate}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
    : null;
  return (
    <section data-tab="employment" className="tf-product-section">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="tf-h3">Ready to start?</h4>
          <p className="mt-1 text-[13px] text-ink-500">{ready ? "Everything due before the start date is complete." : `${blockers.length} ${blockers.length === 1 ? "thing" : "things"} to do${startLabel ? ` before ${startLabel}` : " before this person starts"}.`}</p>
        </div>
        <StatusPill tone={ready ? "green" : "amber"}>{ready ? "Ready" : `${blockers.length} ${blockers.length === 1 ? "thing" : "things"} to do`}</StatusPill>
      </div>
      {blockers.length > 0 ? (
        <ul className="mt-4 divide-y divide-ink-100 border-y border-ink-100">
          {blockers.map((blocker, index) => (
            <li key={`${blocker.label}-${index}`} className="px-3 py-2 text-[12px]">
              <p className="font-medium text-ink-900">{blocker.label}</p>
              <p className="text-ink-600">{blocker.owner} · {blocker.nextAction}</p>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="mt-4 text-[11.5px] text-ink-500">Account: {accountState} · {checked} checks reviewed</p>
    </section>
  );
}
