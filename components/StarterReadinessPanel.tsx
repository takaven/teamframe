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
  return (
    <section data-tab="employment" className="rounded-xl border border-ink-200 bg-white/70 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="tf-h3">Configured pre-start checks</h4>
          <p className="mt-1 text-[12px] text-ink-500">Only tasks and evidence requests due by the start date. This does not prove legal compliance or invite delivery.</p>
        </div>
        <StatusPill tone={ready ? "green" : "amber"}>{ready ? "READY" : "ACTION REQUIRED"}</StatusPill>
      </div>
      <p className="mt-2 text-[12px] text-ink-600">{checked} configured pre-start checks · Start date: {startDate ?? "Missing"}</p>
      <p className="mt-1 text-[12px] text-ink-600">Account: {accountState}. This is separate from pre-start checks.</p>
      {blockers.length > 0 ? (
        <ul className="mt-3 divide-y divide-ink-100 rounded-lg border border-ink-200">
          {blockers.map((blocker, index) => (
            <li key={`${blocker.label}-${index}`} className="px-3 py-2 text-[12px]">
              <p className="font-medium text-ink-900">{blocker.label}</p>
              <p className="text-ink-600">Owner: {blocker.owner} · Next: {blocker.nextAction}</p>
            </li>
          ))}
        </ul>
      ) : <p className="mt-3 text-[12px] text-ink-600">All configured due-by-start checks are complete.</p>}
    </section>
  );
}
