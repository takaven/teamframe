# Sentry Completion — DSN Provisioning and Test-Event Evidence

Wave 4 closes the code side of Sentry: `next.config.ts` is wrapped with
`withSentryConfig`, and source-map upload is gated on `SENTRY_AUTH_TOKEN`
(credential-less builds stay green and never call Sentry). What remains is
founder-only: provisioning the DSN and firing one verification event.

Status: AWAITING FOUNDER INPUT (test-event ID blank below)

---

## 1. Founder steps — provision the DSN

1. Sign in at https://sentry.io (create the org if it does not exist yet).
2. Create a project: **Projects → Create Project → Next.js**. Suggested name: `teamframe`.
3. Copy the DSN shown on the project's "Configure SDK" screen
   (format: `https://<key>@<org-id>.ingest.sentry.io/<project-id>`).
4. Set both env vars to the SAME DSN value in every runtime environment
   (Vercel: Project → Settings → Environment Variables; local: `.env.local`):
   - `SENTRY_DSN` (server + edge)
   - `NEXT_PUBLIC_SENTRY_DSN` (browser)
5. Optional, only for release source maps: create an auth token at
   **Settings → Auth Tokens** with the `project:releases` scope and set
   `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` in the production build
   environment only. Never commit it. Local/CI builds intentionally run
   without it.
6. Redeploy (or restart the dev server) so the new env vars are picked up.

## 2. Founder steps — fire the one-off test event

There is deliberately no test endpoint in the app. Use the script:

```bash
# with SENTRY_DSN present in .env.local (or exported inline):
npm run sentry:test-event
```

The script initialises the SDK, sends a single tagged exception
(`SENTRY_VERIFICATION_TEST_EVENT <timestamp>`), flushes, and prints the event
ID. Then confirm in the Sentry UI: **Issues → search
`SENTRY_VERIFICATION_TEST_EVENT`** — the event should appear within ~30s.
Resolve/delete the issue after recording the evidence.

## 3. Evidence (founder fills in)

| Field | Value |
|---|---|
| DSN provisioned (yes/no) | _founder input_ |
| Env vars set in production (yes/no) | _founder input_ |
| Test-event ID (from script output) | _founder input_ |
| Event visible in Sentry Issues (yes/no) | _founder input_ |
| Date verified | _founder input_ |
| Verified by | _founder input_ |

When all rows are filled, tick the "Sentry wired and receiving test events" box
in `docs/launch/operational-readiness-checklist.md` (Monitoring section).
