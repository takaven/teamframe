export default function DashboardLoading() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <div className="space-y-2 border-b border-ink-300/60 pb-5">
        <div className="h-4 w-20 animate-pulse rounded bg-ink-200" />
        <div className="h-10 w-80 animate-pulse rounded bg-ink-200" />
      </div>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <article key={i} className="rounded-xl border border-ink-300/70 bg-white/75 p-4">
            <div className="h-3 w-24 animate-pulse rounded bg-ink-100" />
            <div className="mt-3 h-8 w-12 animate-pulse rounded bg-ink-200" />
          </article>
        ))}
      </section>

      <section className="mt-6 space-y-4">
        {Array.from({ length: 3 }).map((_, lane) => (
          <div key={lane} className="rounded-2xl border border-ink-300/70 bg-white/80 p-5">
            <div className="h-6 w-40 animate-pulse rounded bg-ink-200" />
            <div className="mt-4 space-y-3">
              {Array.from({ length: 2 }).map((__, i) => (
                <div key={i} className="rounded-xl border border-ink-200 bg-white p-4">
                  <div className="h-3 w-28 animate-pulse rounded bg-ink-100" />
                  <div className="mt-2 h-6 w-56 animate-pulse rounded bg-ink-200" />
                  <div className="mt-3 h-4 w-full animate-pulse rounded bg-ink-100" />
                  <div className="mt-2 h-4 w-full animate-pulse rounded bg-ink-100" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}
