/**
 * Sentry client-side initialisation.
 *
 * DSN-gated and dormant when NEXT_PUBLIC_SENTRY_DSN is absent. Kept in the
 * Next.js 15 instrumentation-client convention so production builds do not
 * rely on the deprecated sentry.client.config.ts discovery path.
 */

import * as Sentry from "@sentry/nextjs";
import { scrubSentryEvent } from "@/lib/telemetry/scrub";

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    sendDefaultPii: false,
    beforeSend(event) {
      return scrubSentryEvent(event as unknown as Record<string, unknown>) as unknown as typeof event;
    },
  });
}
