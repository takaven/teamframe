#!/usr/bin/env node
/**
 * sentry-test-event.mjs — one-off Sentry verification event.
 *
 * Fires a single deliberate test exception at the configured Sentry project so
 * the founder can confirm the DSN is live end-to-end. This is a script, not a
 * route: nothing is exposed in the running app, and it only does anything when
 * run explicitly with SENTRY_DSN set.
 *
 * Usage:
 *   SENTRY_DSN=<dsn> node scripts/sentry-test-event.mjs
 *   (or set SENTRY_DSN in .env.local and run: npm run sentry:test-event)
 *
 * Expected output: the event ID, which the founder records in
 * docs/launch/verification/sentry-completion.md.
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import * as Sentry from "@sentry/nextjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env.local") });

const dsn = process.env.SENTRY_DSN;
if (!dsn) {
  console.error("SENTRY_DSN is not set. Set it in .env.local or inline, then re-run.");
  process.exit(1);
}

Sentry.init({ dsn, tracesSampleRate: 0 });

const eventId = Sentry.captureException(
  new Error(`SENTRY_VERIFICATION_TEST_EVENT ${new Date().toISOString()}`),
);

const flushed = await Sentry.flush(5000);
if (!flushed) {
  console.error("Sentry flush timed out — event may not have been delivered.");
  process.exit(1);
}

console.log("Test event sent.");
console.log(`Event ID: ${eventId}`);
console.log("Record this ID in docs/launch/verification/sentry-completion.md");
