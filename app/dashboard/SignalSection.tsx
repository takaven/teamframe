import { RiskCard, type DashboardSignal } from "@/app/dashboard/RiskCard";

type SignalSectionProps = {
  title: string;
  subtitle: string;
  lane: "red" | "yellow" | "resolved";
  signals: DashboardSignal[];
};

function sectionTone(lane: SignalSectionProps["lane"]): string {
  if (lane === "red") return "border-red-300/80 bg-red-50/40";
  if (lane === "yellow") return "border-amber-300/80 bg-amber-50/40";
  return "border-emerald-300/80 bg-emerald-50/30";
}

function emptyCopy(lane: SignalSectionProps["lane"]): string {
  if (lane === "red") return "No urgent issues right now. Keep this lane empty.";
  if (lane === "yellow") return "No medium-priority risks right now.";
  return "No resolved items yet. Fixing a risk will appear here.";
}

export function SignalSection({ title, subtitle, lane, signals }: SignalSectionProps) {
  return (
    <section className={`rounded-2xl border p-5 ${sectionTone(lane)}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[22px] tracking-tight">{title}</h2>
          <p className="text-[13px] text-ink-500">{subtitle}</p>
        </div>
        <div className="rounded-full border border-ink-300 bg-white/70 px-3 py-1 text-[12px] text-ink-700">
          {signals.length} item{signals.length === 1 ? "" : "s"}
        </div>
      </div>

      {signals.length === 0 ? (
        <div className="rounded-xl border border-dashed border-ink-300 bg-white/60 p-5 text-[14px] text-ink-700">
          {emptyCopy(lane)}
        </div>
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
