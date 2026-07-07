import { RiskCard, type DashboardSignal } from "@/app/dashboard/RiskCard";
import { EmptyState } from "@/components/EmptyState";

type SignalSectionProps = {
  title: string;
  subtitle: string;
  lane: "red" | "yellow" | "resolved";
  signals: DashboardSignal[];
};

// Calm instrument panel: sections stay ink-on-paper; severity is carried by
// a small dot and the cards' status spines, not by tinted section washes.
function laneDotTone(lane: SignalSectionProps["lane"]): string {
  if (lane === "red") return "bg-signal-red";
  if (lane === "yellow") return "bg-signal-amber";
  return "bg-signal-green";
}

function emptyCopy(lane: SignalSectionProps["lane"]): string {
  if (lane === "red") return "No urgent issues right now. Keep this lane empty.";
  if (lane === "yellow") return "No medium-priority risks right now.";
  return "No resolved items yet. Fixing a risk will appear here.";
}

export function SignalSection({ title, subtitle, lane, signals }: SignalSectionProps) {
  return (
    <section className="rounded-2xl border border-ink-300/70 bg-white/60 p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2.5 text-[22px] tracking-tight">
            <span className={`h-2 w-2 shrink-0 rounded-full ${laneDotTone(lane)}`} aria-hidden="true" />
            {title}
          </h2>
          <p className="text-[13px] text-ink-500">{subtitle}</p>
        </div>
        <div className="shrink-0 whitespace-nowrap rounded-full border border-ink-300 bg-white/70 px-3 py-1 text-[12px] text-ink-700">
          <span className="font-mono tabular-nums">{signals.length}</span> item{signals.length === 1 ? "" : "s"}
        </div>
      </div>

      {signals.length === 0 ? (
        <EmptyState message={emptyCopy(lane)} className="py-5" />
      ) : (
        <div className="space-y-3">
          {signals.map((signal) => (
            <RiskCard key={signal.id} signal={signal} />
          ))}
        </div>
      )}
    </section>
  );
}
