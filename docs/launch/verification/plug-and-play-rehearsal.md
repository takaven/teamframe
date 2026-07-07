# Plug-and-Play Clean-Install Rehearsal — Phase 5D

**Date:** 6 July 2026
**Purpose:** prove that a new operator, given only a ZIP of the repo and
`START_HERE.md`, reaches a working, logged-in TeamFrame with **only the commands
written in the doc** — no tribal knowledge, no dashboard improvisation.
**Method:** `git archive` of the acceptance tree → fresh directory
`C:\Users\isuda\Dev\teamframe-rehearsal` (simulates the operator's ZIP), against
the acceptance Supabase project `zydhgtmgrbdyghmvuldc` reset to blank before
each attempt (all `public` tables dropped + reapplied, **all auth users
deleted**, so the project matches a factory-fresh one; the only pre-existing
row is `default-company`, which `schemas/companies.sql` itself seeds).
All identities are fake `.example` addresses. No secrets appear in this
document; passwords were generated per-run and passed only via
`SEED_ADMIN_PASSWORD`.

## Verdict

**PASS on attempt 2.** Attempt 1 executed every written command successfully
but exposed one hidden assumption, which was fixed in `START_HERE.md`; the
rehearsal was then restarted from a fresh export and a freshly reset database
and passed with zero deviations from the doc.

## Attempt 1 — FAILED the gate (doc gap, not a command failure)

Every written step succeeded (`npm ci` → env checks 3/3 → `db:apply` →
`storage:setup` → `supabase link`/`config push` → `seed:admin` with
`rehearsal-admin@teamframe-test.example` incl. built-in login verification →
`verify:install` 5/5 PASS → `seed:demo` → `npm run dev`).

**Gap found:** `seed:demo` creates its own tenant (`demo-fpors`), and data is
tenant-scoped — so the step-7 admin cannot see the demo data, and START_HERE.md
did not say how anyone could. Viewing the seeded dashboard required a command
that was not written in the doc.

**Fix:** START_HERE.md step 9 now states the tenant boundary explicitly and
gives the exact command to seed an admin *into* the demo tenant
(`seed:admin -- demo-admin@demo-fpors.example`, tenant inferred from the email
domain). Per the rehearsal protocol, the whole run was restarted from scratch.

## Attempt 2 — CLEAN PASS (transcript)

Fresh export (`git archive` tree `5b887b00`), staging reset to blank
(9→0 auth users across both attempts' resets; 14 tables dropped + reapplied).
Then, literally following START_HERE.md:

| # | Doc step | Command (as written) | Outcome |
|---|---|---|---|
| 1 | Step 2 | `npm ci` | `added 608 packages` |
| 2 | Step 3 | `cp .env.example .env.local` + fill 6 vars (project URL, anon key, service key, session-pooler DB URL, `SITE_URL=http://localhost:3030`, healthcheck secret) | file written |
| 3 | Step 3 | `npm run env:check` / `env:check:smoke` / `env:check:db` | 3/3 `✓ Environment validation passed` |
| 4 | Step 4 | `npm run db:apply` | `✓ All schemas applied.` (16 files, locked order) |
| 5 | Step 5 | `npm run storage:setup` | `✓ Storage ready.` (private `documents` bucket) |
| 6 | Step 6a | `npx supabase link --project-ref zydhgtmgrbdyghmvuldc` | linked (CLI already authenticated) |
| 7 | Step 6a | `npx supabase config push` | auth contract confirmed: `Remote Auth config is up to date.` |
| 8 | Step 7 | `SEED_ADMIN_PASSWORD='…' npm run seed:admin -- rehearsal-admin@teamframe-test.example "Rehearsal Admin" "Founder" "Leadership" "UTC"` | `✓ Login verified: session issued, app_metadata.role=admin, app_metadata.tenant_id stamped.` Tenant `3313ef6f…` (slug `teamframe-test`) |
| 9 | Step 8 | `npm run verify:install` | **5/5 PASS** (schema-apply, tenancy-rls-v2, required-objects, seed-admin-login, seed-demo-idempotent) |
| 10 | Step 9 | `npm run seed:demo` | demo tenant `e96d81f8…` seeded (1 red, 2 yellow, 1 resolved, overdue task, pending leave, published policy) |
| 11 | Step 9 | `SEED_ADMIN_PASSWORD='…' npm run seed:admin -- demo-admin@demo-fpors.example "Demo Admin"` | joined the existing demo tenant `e96d81f8…` (slug match), login verified |
| 12 | Step 10 | `npm run dev` | serving on :3030 — curl: `/` 200, `/admin/login` 200, `/dashboard` unauthenticated → 307 to `/auth?next=%2Fdashboard` |
| 13 | Step 11 | Browser (Playwright Chromium) at `/admin/login` | see below — ALL PASS |

Browser proof (scratchpad script `rehearsal-login-proof.mjs`, not committed):

```text
LOGIN_OK rehearsal-admin@teamframe-test.example → http://localhost:3030/dashboard
PASS: rehearsal-admin lands on /dashboard
PASS: rehearsal-admin dashboard renders (TeamFrame shell)
LOGIN_OK demo-admin@demo-fpors.example → http://localhost:3030/dashboard
PASS: demo-admin lands on /dashboard
PASS: seeded red signal visible (expired Emirates ID)
PASS: risk pulse shows attention state
REHEARSAL_BROWSER_PROOF: ALL PASS
```

The demo-admin dashboard rendered the full seeded state: Risk Pulse "5 urgent",
urgent cards ("Missing jurisdiction document", "Expired document — Emirates ID
is expired", "Missing signed contract"), Important/Resolved/Open-actions
counters populated. (One earlier proof-script run reported a false FAIL because
it snapshotted the page during React Suspense streaming — the script now waits
for content; no product or doc change was involved.)

## Honest boundaries confirmed during this phase

- **Free-tier email templates cannot be modified** while the project uses
  Supabase's built-in mailer — `supabase config push` returns
  `"Email template modification is not available for free tier projects using
  the default email provider."` The built-in mailer also only delivers to
  project team-member addresses. Documented as explicit MANUAL step 6c in
  START_HERE.md; the `[auth.email.template.magic_link]` block in
  `supabase/config.toml` is commented out on purpose and becomes pushable once
  custom SMTP (or a paid plan) exists. **Admin password login requires no email
  at all**, so the install itself stays one-command-per-step.
- Everything else in the auth contract (signups disabled, redirect allowlist,
  password minimum, email provider on) pushes cleanly on the free tier via
  `npx supabase config push` — verified applied and idempotent ("up to date"
  on re-run).
