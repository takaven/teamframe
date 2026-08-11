> **HISTORICAL / SUPERSEDED - NOT GOVERNING CURRENT MARKET-READY SCOPE**
>
> Date marked superseded: 2026-08-11.
>
> This audit is retained as historical evidence. Current scope and implementation authority live in:
>
> - `TEAMFRAME_MARKET_READY_SCOPE.md`
> - `TEAMFRAME_MARKET_READY_EXECUTION_REGISTER.md`
> - `TEAMFRAME_DEFERRED_SCOPE.md`
> - `TEAMFRAME_RELEASE_READINESS.md`

---
# Readiness Log — TeamFrame

Tracks the status of each weekend execution block as it completes.

---

## PR #84 Reconciliation Blocker Fixes — 2026-08-04

**Block:** Independent review blocker fixes for GitHub reconciliation
**Branch:** `codex/reconcile-local-main`
**Checkpoint:** `6eddb21`
**Status:** CODE FIXES COMPLETE; GitHub protected-branch check still blocked before runner startup

**Context:** PR #84 aligns GitHub with the canonical local product history. A
post-reconciliation independent review requested changes before merge. The
review was checked against the local code, and the confirmed issues were fixed
instead of blindly accepting the handover.

**Fixed:**
- Dashboard page and dashboard action endpoint now require admin tenant role before service-role reads/mutations.
- Identity resolution now scopes email fallback to the JWT tenant and hard-fails an existing `auth_user_id` link that belongs to another tenant before any link/activation write.
- Manual dashboard resolution for `leave_conflict`, `missing_jurisdiction_requirement`, and `unacknowledged_policy` now stores evidence fingerprints; new policy/jurisdiction/leave evidence recurs as a fresh signal.
- Policy create/publish/archive/acknowledge writes now go through transactional database RPCs that write the audit record in the same database transaction.
- Acknowledgements now have same-tenant policy/employee constraints plus stricter acknowledgement RLS checks.

**Gate chain on `6eddb21`:**
- `npm run typecheck`: PASS
- `npm test`: PASS (12 files, 63/63 tests)
- `npm run guards`: PASS
- `npm run build`: PASS
- Vercel preview on PR #84: PASS

**Still blocked outside code:** GitHub `Gate Chain (Strict)` fails before a
runner starts (`runner_id=0`, no steps/logs). Protected `main` cannot be updated
until GitHub Actions/runner availability is fixed and the check is rerun green.

**Not validated locally:** `npm run db:apply` could not reach the configured
database host (`ENOTFOUND` for the local `SUPABASE_DB_URL` host), so SQL apply
must be validated once the connection string is corrected.

---

## Finalisation Phase 5 — 2026-07-06

**Block:** Product completion and plug-and-play acceptance (real environment)
**Branch:** `phase-5-acceptance` (merged to local main as checkpoint `2ff1424`)
**Status:** COMPLETE

**Environment:** fresh Supabase project `teamframe-staging-acceptance` (ref `zydhgtmgrbdyghmvuldc`, eu-central-1), created for acceptance only; production project untouched.

**Evidence documents (all in-tree):**
- `docs/launch/FINAL_VISUAL_UX_AUDIT.md` — real Chromium QA at 1440/1024/390; 67+ captures in `docs/launch/screenshots/`; 14 issues (8+6), all Critical/High/Medium fixed with re-capture proof.
- `docs/launch/FINAL_STAGING_ACCEPTANCE.md` — 11/11 E2E flows PASS incl. cross-tenant denial (UI + PostgREST probes + rejected cross-tenant INSERTs); `verify:rls` 7/7; core-loop smoke pass.
- `docs/launch/verification/plug-and-play-rehearsal.md` — clean-install rehearsal from fresh export, attempt 2 zero-deviation after START_HERE fix.
- `docs/launch/verification/accessibility-basics.md` — axe (WCAG A/AA) clean after one AA-contrast token fix; 4 manual checks (keyboard-only, visible focus, labels/errors, 200% zoom) all PASS.

**Fresh-install defects found & fixed this phase:** `tenancy_rls_v2.sql` missing from SCHEMA_ORDER (insecure fallback would have shipped on fresh installs); `employees_public` view forward-dependency; `seed:admin` produced unusable admins (no password, no tenant claim, invite crash) — rewritten with self-verified login; nonexistent `auth:lock` references (6) replaced with verified `supabase config push` contract; PILOT_MAILTO placeholder → `NEXT_PUBLIC_PILOT_CONTACT_EMAIL` (CTA honestly omitted when unset). New `npm run verify:install` (5 assertions) added to the documented install.

**Platform limits (honest):** magic-link email template + delivery to arbitrary addresses require custom SMTP or paid tier — explicit manual step 6c in START_HERE.md; admin password login unaffected.

---

## Finalisation Wave 4 — 2026-07-03

**Block:** v1.0 Finalisation Wave 4 — ops closeout (local code portions)
**Branch:** `wave-4-ops-closeout` (merged to local main as checkpoint `23b4a35`)
**Status:** COMPLETE (local-only; dashboard evidence awaits founder)

**Shipped:**
- Sentry: `next.config.ts` wrapped with `withSentryConfig`; source-map upload, log verbosity, and build telemetry all gated on `SENTRY_AUTH_TOKEN` — credential-less build proven green. `.env.example` updated (SENTRY_AUTH_TOKEN/ORG/PROJECT). `scripts/sentry-test-event.mjs` + `npm run sentry:test-event` for one-off DSN verification; founder steps in `docs/launch/verification/sentry-completion.md`.
- BUG-1 (no-silent-failures audit) FIXED: `services/documentService/index.ts:424` — compensating storage delete result now checked; failures logged (`DOCUMENT_COMPENSATING_DELETE_FAILED`) + `captureActionError`; regression test added.
- BUG-2 verified ALREADY FIXED (Phase 1C): `services/onboardingService/index.ts:86-110` destructures and handles the Supabase error. Audit rows updated with file:line.
- seed:demo: full demo tenant — 1 red (expired Emirates ID), 2 yellow (expiring passport, missing contract), 1 resolved signal, mid-onboarding employee with overdue due-date task, published-but-unacknowledged policy, pending leave; idempotent, `.example`-domain fakes; plan logic factored into `scripts/lib/demo-plan.mjs` and test-locked.
- M20: founder step-by-step for PITR (Path A) vs daily-backup decision (Path B), evidence template with `[FOUNDER]` blanks, tested-restore procedure added to `docs/launch/runbooks/rollback-procedure.md`.

**Gate chain (local):**
- `npm run typecheck`: PASS
- `npm test`: PASS (10 files, 55/55 tests)
- `npm run guards`: PASS (4/4)
- `npm run build` (without SENTRY_AUTH_TOKEN): PASS (13 routes)

**Awaiting founder (dashboard-only):** M20 evidence fields (path decision, retention, screenshots, restore-test), Sentry DSN provisioning + test-event ID.

**Runtime-unverified (no live credentials):** seed:demo against a live DB; sentry test event; source-map upload with a real token.

---

## Finalisation Wave 3 — 2026-07-03

**Block:** v1.0 Finalisation Wave 3 — UI elevation ("calm instrument panel")
**Branch:** `wave-3-ui-elevation` (merged to local main as checkpoint `6505830`)
**Status:** COMPLETE (local-only)

**Shipped (presentation only; routes/actions/data flow frozen):**
- Design tokens: `--color-signal-red/amber/green` (mapped to existing RiskCard tones), `--font-mono` (IBM Plex Mono), `--font-display` (Fraunces 500/600), all via next/font.
- `components/AppShell.tsx`: shared top nav across all authed pages (admin: Dashboard/Employees/Onboarding/Leaves/Policies; employee: Me/Onboarding/Leaves), Fraunces wordmark, active-link state, SignOutButton.
- Risk Pulse (admin-only, server-rendered): dot + label from `countOpenSignals` — the single service-layer addition (Actor-scoped, read-only, one query); links to /dashboard; failures caught + logged, never crash the page.
- `StatusPill` + `EmptyState` components adopted on every list surface; RiskCard status spine (white card, 3px severity left border, severity pill); counts/dates in mono with tabular-nums; 150ms ease transitions.
- Landing page rebuilt per blueprint §1/§2: signal-loop explanation, three feature blocks (risk dashboard / one-click DD pack / 48-72h setup), founder-authority line, "Request a pilot" mailto (PLACEHOLDER address marked for founder) + Sign in. Factual claims only; marked screenshot slot.
- Bug found & fixed in passing: undefined ink shades (ink-50/200/400/600/800) generated no CSS under Tailwind v4 — loading skeletons were invisible; usages normalised.

**Gate chain (local):**
- `npm run typecheck`: PASS
- `npm test`: PASS (8 files, 38/38 tests)
- `npm run guards`: PASS (4/4; tenancy-filter 20 service files)
- `npm run build`: PASS (compiled 32.8s, 13 routes, `/` static 106 kB first-load; Google Fonts fetched successfully at build time)

**Static QA:** all 10 surfaces pass static review (AppShell/role links, tokens, mono metrics, EmptyState, status spine, 360px width safety) — table in `docs/launch/ui-elevation-report.md`.

**Unverified (no live credentials):** browser-level QA at 360px/1280px with real data; Risk Pulse against a live signals table. Reserved for the founder's staging pass.

---

## Finalisation Wave 2 — 2026-07-03

**Block:** v1.0 Finalisation Wave 2 — demo-killer fixes (gap audit RED items)
**Branch:** `wave-2-demo-fixes` (merged to local main as checkpoint `930ec6d`)
**Status:** COMPLETE (local-only)

**Shipped:**
- `/employees` de-engineered: schema-capability checks routed to server log (`logSchemaCapability`, PII-scrubbed), panel plumbing removed; rows expand via server-rendered `<details>` into a detail area (profile fields, relocated documents block, prominent Due Diligence Pack export).
- Onboarding: nullable `due_date` column (idempotent migration), 3 static template packs (Every hire / Engineering / Operations) expanded server-side with due dates from start date, pack selector with removable pre-filled tasks; due dates + overdue amber on task rows. No reminders/notifications.
- `/auth/check-email`: "Resend link" reusing the same rate-limited `sendMagicLink` (60s client cooldown, honest rate-limit copy, enumeration guard intact).
- Empty states: "No employees yet." anchors to the Add form; documents block given the same sentence+CTA pattern.
- V2 scope parked in `docs/launch/parking-lot.md` (leave balances/types, calendar, CSV import, notifications); gap-audit addendum re-grades `/employees` 🔴→🟢, `/onboarding` 🔴→🟢 (demo), `/auth/check-email` 🟡→🟢.

**Gate chain (local):**
- `npm run typecheck`: PASS
- `npm test`: PASS (8 files, 38/38 tests)
- `npm run guards`: PASS (4/4; telemetry enforces 15 mutations; tenancy-filter 20 service files)
- `npm run build`: PASS (13 routes, 8/8 static pages; pre-existing OpenTelemetry warning only)

**Unverified (no live credentials):**
- Live pack assignment (due_date insert, audit row, activation event), `db:apply` of the new column on a real database, live magic-link resend + rate limiter across real requests, browser click-through of expand/collapse and resend cooldown.

---

## Finalisation Wave 1 — 2026-07-03

**Block:** v1.0 Finalisation Wave 1 — minimal policy loop + signal resolution audit
**Branch:** `wave-1-policy-loop` (merged to local main as checkpoint `e0c50ee`)
**Status:** COMPLETE (local-only)

**Shipped:**
- `services/policyService/index.ts` — create/publish/archive/list (admin), listUnacknowledgedForEmployee/acknowledge (employee); Zod-validated, Actor-scoped, publish/archive/acknowledge audit-logged.
- `/policies` admin page (create draft, publish, archive, ack progress) + nav links; middleware protection.
- `/me` "Policies to acknowledge" block with one-click acknowledge.
- Signal gap fixes: `missing_jurisdiction_requirement` and `leave_conflict` gained the mark-done suppression path (previously unresolvable); dashboard `signalCtas()` now land on the surface where each fix happens.
- `docs/launch/verification/signal-resolution-matrix.md` — **10/10 SignalKinds resolvable** (was 7/10).

**Gate chain (local):**
- `npm run typecheck`: PASS (zero errors)
- `npm test`: PASS (7 files, 20/20 tests; was 5 files/13 on baseline)
- `npm run guards`: PASS (4/4; telemetry now enforces 14 mutations incl. 4 new policy actions; tenancy-filter 19 service files)
- `npm run build`: PASS (compiled 39.9s, 8/8 static pages, `/policies` route present)
- `npm run lint`: PASS (no warnings)

**Unverified (no live credentials in local environment):**
- Browser-level end-to-end against a real Supabase tenant (RLS in anger, magic-link acknowledge flow); `policies_set_updated_at` trigger interaction. Verification is unit/reconcile-level against the vitest Supabase mock.

**Follow-up recorded (not in scope):**
- Real fix for jurisdiction documents needs a `documents.type` enum migration (proposal documented in the signal-resolution matrix). `docs/business/signal-rules.md` and README module list lag the code (docs pass candidate).

---

## Finalisation Wave 0 — 2026-07-03

**Block:** v1.0 Finalisation Wave 0 — parity check, rollback tag, baseline capture
**Branch:** local finalisation (recreated from unmerged PR #82; GitHub CI unavailable — account billing lock)
**Status:** COMPLETE

**Parity verdict:**
- Offline ZIP working tree verified byte-identical to `main@0644029` (recursive diff excluding `.git`/`node_modules`: zero differences).

**Rollback point:**
- Annotated tag `pre-finalisation-2026-07-03` created on `main@0644029` and pushed to origin (before local-only mode began).

**Baseline evidence summary (main@0644029):**
- `npm ci`: PASS (clean install from committed lockfile)
- `npm run typecheck`: PASS (`tsc --noEmit`, no errors)
- `npm test`: PASS (5 files, 13 tests)
- `npm run guards`: PASS (all 4 guards — instrumentation, health-contract, telemetry: 10 mutations covered, tenancy-filter: 18 service files scanned)
- `npm run build`: PASS with known Sentry/OpenTelemetry require-expression and webpack PackFileCacheStrategy warnings (unchanged from 31 May baseline); 8/8 static pages, 12 routes

**Secrets sweep:**
- CLEAN. Only tracked env files are `.env.example` and `.env.staging.example`, both blank templates. No hits for service-role keys, JWTs, assigned tokens, private keys, or credentialed connection strings anywhere in the tree.

**Governance note:**
- Blueprint §18 written approvals recorded: Finalisation Plan v1.1 (founder-approved 2026-07-03) D2 approves completing the policy acknowledgement loop (extends blueprint §7 phasing — completes already-built `unacknowledged_policy` signal, not new scope) and D6 approves static onboarding template packs + due dates (no reminders/automation, consistent with README non-goal on workflow automation).

**Process note:**
- Finalisation proceeds LOCAL-ONLY per founder directive (2026-07-03): no pushes, PRs, merges, remote tags, or repo-settings changes. Gate chain enforced locally per wave. `docs/drift-guard.md` (dangling README link) recreated locally in this commit.

---

## Launch Sprint Wave 0 — 31 May 2026

**Block:** Wave 0 Baseline Capture + Execution Freeze
**Branch:** `pivot/fpors-cleanup`
**Status:** COMPLETE

**Artifacts created:**
- `docs/launch/verification/wave0-baseline-report-2026-05-31.md`
- `docs/launch/verification/blocker-definition-of-done-matrix.md`

**Baseline evidence summary:**
- `npm test`: PASS (4 files, 12 tests)
- `npm run build`: PASS with OpenTelemetry warning
- Runtime log shows `GET /auth/callback 500` (A1 open)
- Archive path currently leaves `lifecycle_state=active` while `deleted_at` is set (B2 open)
- Lifecycle population for `offboarding/exited`: 0 / 0 (B1/B3 open)

**Release blocker board initialized:**
- A1, B1, B2, B3, P1, P2, P3, P4, P5, P6, P9 all OPEN at baseline

**Execution controls active:**
- Merge freeze rule: only Gate A lane, Gate B lane, and production readiness lane may merge
- Blocker closure policy: binary Open/Closed, evidence artifact required for closure

---

## Weekend 1 — 30–31 May 2026

**Block:** Phase 1A Foundation
**Branch:** `phase-1a/foundation`
**Status:** COMPLETE

**Deliverables:**
- D1: Environment parity setup — scripts written, staging project provisioning required (manual step)
- D2: Tenant isolation fix (tenancy_rls_v2.sql) — applied to staging
- D3: RLS verification harness — `verify-rls.mjs` written, run against staging

**Gate results:**
- Phase 1A items all shipped; full Phase 1 closure confirmed in `docs/audits/phase-2-readiness-2026-05-29.md` (GREEN, closed 2026-05-30 at SHA `754b1ed`).
- Staging environment gate results were manually validated as part of that audit closure.

**Outstanding:**
- None. Phase 1A foundation complete.

---
