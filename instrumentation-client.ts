/**
 * Sentry client-side initialisation.
 *
 * DSN-gated and dormant when NEXT_PUBLIC_SENTRY_DSN is absent. Kept in the
 * Next.js 15 instrumentation-client convention so production builds do not
 * rely on the deprecated sentry.client.config.ts discovery path.
 */

import * as Sentry from "@sentry/nextjs";
import { scrubPII } from "@/lib/telemetry/scrub";

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    beforeSend(event) {
      delete event.user;

      if (event.extra && typeof event.extra === "object") {
        event.extra = scrubPII(event.extra as Record<string, unknown>);
      }

      return event;
    },
  });
}
