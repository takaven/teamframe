> **HISTORICAL / SUPERSEDED - NOT GOVERNING CURRENT MARKET-READY SCOPE**
>
> Date marked superseded: 2026-08-11.
>
> This document is retained as product provenance. It does not control the current market-ready programme where it conflicts with:
>
> - `TEAMFRAME_MARKET_READY_SCOPE.md`
> - `TEAMFRAME_MARKET_READY_EXECUTION_REGISTER.md`
> - `TEAMFRAME_DEFERRED_SCOPE.md`
> - `TEAMFRAME_RELEASE_READINESS.md`
>
> In particular, older FPORS/V1 statements that TeamFrame is not an HR system, that reminders/workflows are permanently forbidden, or that leave balances/manager delegation/policy file upload/document requests are V2-only are superseded for the bounded market-ready programme.

---
# TeamFrame — Final Readiness Summary (v1.0 local finalisation)

> **Current review status — 4 August 2026:** this July summary is historical.
> The current reconciliation branch is `codex/reconcile-local-main@6eddb21`
> for PR #84. It includes post-review blocker fixes for dashboard
> authorization, tenant-bound identity resolution, recurring manually resolved
> signals, transactional policy/audit writes, and same-tenant acknowledgement
> integrity. Local gates on `6eddb21` are green: typecheck, 63/63 tests, guards,
> and build. Vercel is green. GitHub `Gate Chain (Strict)` still fails before
> runner startup (`runner_id=0`, no steps/logs), so protected `main` is not yet
> reconciled.

**Date:** 3 July 2026
**Working copy:** `C:\Users\isuda\Dev\TeamFrame-canonical` (local main, checkpointed per wave)
**Baseline:** `main@0644029` (= remote main; rollback tag `pre-finalisation-2026-07-03` on origin)
**Mode:** local-only finalisation per founder directive — no pushes, PRs, merges, or remote changes after Wave 0. GitHub PRs #82/#83 remain open and are superseded by local commits `ff7578b`.

---

## 1. What was completed

| Wave | Checkpoint | Delivered |
|---|---|---|
| 0 — Parity & baseline | `ff7578b` (docs) | ZIP verified byte-identical to remote main; rollback tag pushed (pre local-only mode); baseline green; secrets sweep clean; `docs/drift-guard.md` recreated (was a dangling README link); 14 open issues triaged (read-only) |
| 1 — Policy loop | `e0c50ee` | `services/policyService` (create/publish/archive/acknowledge, Actor-scoped, audit-logged); `/policies` admin page; `/me` acknowledge block; **10/10 SignalKinds now resolvable** (was 7/10 — `missing_jurisdiction_requirement` and approved-approved `leave_conflict` gained mark-done resolution); dashboard CTAs land where the fix happens; signal-resolution matrix in `docs/launch/verification/` |
| 2 — Demo-killer fixes | `930ec6d` | `/employees` de-engineered (schema checks server-log-only) + expandable row detail with prominent DD-pack export; onboarding template packs (Every hire / Engineering / Operations) with computed due dates + overdue amber; `/auth/check-email` resend with 60s cooldown; guided empty states; V2 scope parked; gap-audit REDs re-graded GREEN for demo |
| 3 — UI elevation | `6505830` | Design tokens (severity colours, IBM Plex Mono metrics, Fraunces display); shared `AppShell` with admin Risk Pulse (All clear / N need attention / N urgent); `StatusPill` + `EmptyState` everywhere; RiskCard status spine; landing page rebuilt on blueprint §1/§2 copy (factual claims only; `PILOT_MAILTO` placeholder awaits the real pilot address in `app/page.tsx`) |
| 4 — Ops closeout (code) | `23b4a35` | `withSentryConfig` wrapper fully gated on `SENTRY_AUTH_TOKEN` (credential-less build proven green); BUG-1 fixed (compensating storage delete checked, regression-tested); BUG-2 verified already fixed; `seed:demo` produces a full demo tenant; M20 + Sentry evidence docs prepared with founder-fill blanks |

Full per-wave evidence: `docs/launch/readiness-log.md` (five "Finalisation Wave n — 2026-07-03" entries).

## 2. Checks passed (final gate chain on merged main)

Run on the final tree (`main@c576ac9` + this summary):

- `npm run typecheck` — PASS (tsc --noEmit, zero errors)
- `npm test` — PASS (10 files, **55/55 tests**; baseline was 13)
- `npm run guards` — PASS (4/4: instrumentation, health-contract, telemetry — 16 enforced mutations, tenancy-filter — 20 service files all tenant-scoped)
- `npm run build` — PASS without any Sentry credentials (13 routes, 8/8 static pages)

Every wave also passed this same chain on its own branch before merge (see readiness log).

**Verification boundary (stated honestly):** all verification is static/test-level. There are no live Supabase credentials in this environment, so browser-level end-to-end (real RLS, magic-link flows, seed scripts against a live DB, Sentry events) is deliberately reserved for the staging pass below.

## 3. Demo login / setup instructions

One-time setup against a fresh Supabase project (full detail: README "Getting started" §1–7):

1. `npm ci`
2. Copy `.env.example` → `.env.local`; fill `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SITE_URL=http://localhost:3030`. Then `npm run env:check`.
3. `npm run db:apply` (idempotent; includes the new `onboarding_tasks.due_date` column) and `npm run storage:setup`.
4. Apply the Supabase auth contract: `npx supabase link --project-ref <ref>` then `npx supabase config push` (or the dashboard route per README §5 / START_HERE.md step 6). Magic-link template requires custom SMTP or paid tier — honest manual step; admin password login needs no email.
5. `SEED_ADMIN_PASSWORD='<password>' npm run seed:admin -- you@yourcompany.com "Your Name" "Founder" "Leadership" "UTC"` — one command: password login, admin role, and tenant claim all set; then `npm run verify:install`.
6. **Demo data:** `npm run seed:demo` — idempotent; creates a demo tenant with 1 red signal (expired Emirates ID), 2 yellow (expiring passport +25d, missing contract), 1 resolved signal, a mid-onboarding employee with an overdue task, a published-but-unacknowledged policy ("Demo Code of Conduct"), and a pending leave. All identities are `.example`-domain fakes.
7. `npm run dev` → http://localhost:3030

Sign-in: **admins** email+password at `/admin/login`; **employees** magic link at `/auth`. The dashboard Risk Pulse and every signal category are demonstrable from the seeded data.

## 4. Remaining production-only actions (founder / dashboard access required)

1. **GitHub Actions billing / runner lock** — unblock at github.com → Settings → Billing / Actions; then re-run `Gate Chain (Strict)` on PR #84. Release approval stays blocked until it passes on the final head.
2. **Reconcile GitHub main** — PR #84 (`codex/reconcile-local-main`) is open and mergeable at `6eddb21`; merge it after the required check can run green. GitHub `main` still points at `0644029`.
3. **M20 backup/PITR** — follow `docs/launch/verification/m20-backup-pitr-recovery-evidence.md` Section 0 (Path A: enable PITR / Path B: daily-backup decision); fill the `[FOUNDER]` fields; run the tested-restore procedure in `docs/launch/runbooks/rollback-procedure.md`.
4. **Sentry** — provision DSN per `docs/launch/verification/sentry-completion.md`; set `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN` in Vercel; `npm run sentry:test-event`; record the event ID.
5. **Landing page pilot address** — set `NEXT_PUBLIC_PILOT_CONTACT_EMAIL` in the deploy environment (app/page.tsx reads it; when unset, the "Request a pilot" CTA is not rendered).
6. **Staging verification pass** — `npm run verify:parity`, `npm run verify:rls`, `npm run smoke:core-loop` against staging; browser QA at 360px/1280px (checklist: `docs/launch/ui-elevation-report.md`); run `seed:demo` live; acknowledge a policy end-to-end and watch the signal resolve.

## 5. Exact deployment steps (production)

From `docs/launch/deployment-runbook.md` (Option A — Vercel):

1. Pre-deploy on the release tree: `npm ci && npm run env:check && npm run lint && npm run typecheck && npm run guards && npm run build` — all must pass.
2. Apply schema to production Supabase: `npm run db:apply` (idempotent; required this release for `onboarding_tasks.due_date`), `npm run storage:setup`, then the auth contract via `npx supabase config push` (see START_HERE.md step 6).
3. `vercel link` (one-time), then `vercel env add` for: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SITE_URL`, `HEALTHCHECK_SECRET` (`openssl rand -hex 32`), `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`.
4. `vercel --prod`
5. Post-deploy verification: `curl -sf https://DOMAIN/api/health` → `{"status":"ok"}`; authenticated health check with `X-Healthcheck-Key`; `/dashboard` redirects to `/auth` unauthenticated; admin password login round-trip; employee magic-link round-trip; one full core loop (create employee → upload document → signal fires → resolve); security headers per `docs/launch/verification/security-smoke-test.md`.
6. Rollback if needed: `vercel ls` → `vercel promote <previous-deployment-url>`; DB per `docs/launch/runbooks/rollback-procedure.md`. Code rollback point: tag `pre-finalisation-2026-07-03`.

## 6. Paid-pilot readiness verdict

**Verdict: READY FOR A PAID PILOT, conditional on the staging pass (§4.6) and the two ops items (M20, Sentry DSN) completing without surprises.**

- The product loop is complete and closed: every one of the 10 risk signals can fire and be resolved from the UI; policies — the last dead-end — now round-trip (create → publish → acknowledge → signal resolves).
- The demo path is real: seeded data exercises every signal category, the DD-pack export is one click from the employee row, and the customer-facing surfaces carry no engineering artifacts.
- Quality bar: 55/55 tests, 4 static guards, clean typecheck and build, two audited silent-failure bugs closed, secrets sweep clean.
- What keeps this conditional rather than unconditional: no live-tenant verification has happened in this environment (stated throughout), GitHub CI is billing-locked (strict gate must pass on final main before release sign-off), and backup/PITR evidence (M20) is not yet filled. None of these are code risks; all are operator actions.
- Scope discipline held: no notifications, no workflows, no new subsystems; V2 asks live in `docs/launch/parking-lot.md`.

First-pilot playbook: `docs/business/customer-zero.md`, using §3 above for setup.
