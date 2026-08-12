"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <main className="mx-auto max-w-4xl px-6 py-12">
          <section className="rounded-xl border border-ink-300/70 bg-white/80 p-6">
            <p className="text-[12px] tracking-[0.14em] text-ink-500">TeamFrame</p>
            <h1 className="mt-2 text-[28px] leading-tight tracking-tight">Something went wrong.</h1>
            <p className="mt-3 text-[14px] text-ink-700">Refresh the page and try again.</p>
          </section>
        </main>
      </body>
    </html>
  );
}
