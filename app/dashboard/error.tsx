"use client";

export default function DashboardError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <section className="rounded-xl border border-ink-300/70 bg-white/80 p-6">
        <p className="text-[12px] tracking-[0.14em] text-ink-500">Home</p>
        <h1 className="mt-2 text-[28px] leading-tight tracking-tight">We could not load your current HR work.</h1>
        <p className="mt-3 text-[14px] text-ink-700">
          Try again to refresh work that needs attention, upcoming dates and recently completed tasks.
        </p>
        <button
          type="button"
          onClick={() => reset()}
          className="tf-primary-action mt-5 px-5 py-2 text-[14px]"
        >
          Try again
        </button>
      </section>
    </main>
  );
}
