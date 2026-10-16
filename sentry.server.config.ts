/**
 * Sentry server-side initialisation.
 *
 * Loaded by Next.js for all server-side rendering (RSC, Route Handlers,
 * Server Actions).
 *
 * Rules for this weekend:
 *  - DSN-gated: dormant when SENTRY_DSN is absent
 *  - zero performance tracing
 *  - PII stripped via beforeSend
 *  - next.config.ts wrapped with withSentryConfig (Wave 4); source-map upload
 *    gated on SENTRY_AUTH_TOKEN
 *
 * @see https://docs.sentry.io/platforms/javascript/guides/nextjs/
 */

import * as Sentry from "@sentry/nextjs";
import { scrubSentryEvent } from "@/lib/telemetry/scrub";

const dsn = process.env.SENTRY_DSN;

// HMR-safe once-per-module-evaluation log guard.
let sentryInitLogged = false;

if (dsn) {
  Sentry.init({
    dsn,

    tracesSampleRate: 0,
    sendDefaultPii: false,

    beforeSend(event) {
      return scrubSentryEvent(event as unknown as Record<string, unknown>) as unknown as typeof event;
    },
  });

  if (process.env.SENTRY_DEBUG === "true" && !sentryInitLogged) {
    sentryInitLogged = true;
    console.log("[SENTRY] init() called runtime=nodejs");
  }
}
