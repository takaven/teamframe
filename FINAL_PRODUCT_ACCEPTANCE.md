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
# TeamFrame — Final Product Acceptance

> **Current review status — 4 August 2026:** this document records the July
> acceptance evidence for `main@f2a259f`. A later independent review of PR #84
> found five security/integrity blockers. They are fixed in PR head
> `6eddb21` (`codex/reconcile-local-main`): admin-only dashboard access,
> tenant-safe identity binding, recurring signal fingerprints after manual
> resolution, transactional policy/audit RPCs, and same-tenant acknowledgement
> integrity. Fresh local gates on `6eddb21` passed: `npm run typecheck`,
> `npm test` (12 files / 63 tests), `npm run guards`, and `npm run build`.
> Vercel passed. GitHub `Gate Chain (Strict)` is still blocked outside the code:
> it fails before runner startup (`runner_id=0`, no steps/logs). Do not treat
> GitHub `main` as reconciled until PR #84 merges after that check can run.

**Date:** 6 July 2026
**Tree:** local `main` (Phase 5 checkpoint `2ff1424` + readiness entry; final gate chain run on this exact tree — results in §3)
**Acceptance environment:** live Supabase project `teamframe-staging-acceptance` (`zydhgtmgrbdyghmvuldc`), real Chromium via Playwright, clean-install rehearsal from a fresh export.

---

```text
PRODUCT ACCEPTANCE VERDICT:
FINISHED — PLUG AND PLAY

PRODUCTION LAUNCH STATUS:
PENDING OPERATOR ACTIVATION

Required operator actions:
1. Production deployment
2. Sentry DSN configuration and test event
3. Backup/PITR confirmation
```

---

## 1. The 11 dimensions

| # | Dimension | Verdict | Evidence |
|---|---|---|---|
| 1 | Functionality | **PASS** | 11/11 end-to-end flows against the live staging project — both auth tiers, employee creation, document upload/download/soft-delete (byte-verified), signal fire→resolve, policy publish→acknowledge→signal resolution, pack onboarding with due dates, leave request→approval, DD-pack and finance-handoff downloads verified as real archives ([FINAL_STAGING_ACCEPTANCE.md](docs/launch/FINAL_STAGING_ACCEPTANCE.md)). 55/55 unit/integration tests. |
| 2 | Visual quality | **PASS** | Real-browser QA at 1440/1024/390; 67+ captures; 14 issues found, every Critical/High/Medium fixed with re-capture proof; per-surface commercial verdict recorded ([FINAL_VISUAL_UX_AUDIT.md](docs/launch/FINAL_VISUAL_UX_AUDIT.md), [screenshots/](docs/launch/screenshots/)). |
| 3 | Mobile responsiveness | **PASS** | Full capture matrix at 390px incl. the hardest case (expanded employee row): no horizontal scroll, no clipping; 200% zoom check also clean (a11y evidence). |
| 4 | Accessibility basics | **PASS** | axe-core WCAG A/AA: 0 violations on all 9 page-states after one AA-contrast token fix; manual checks all PASS — keyboard-only reachability (incl. 64-control dashboard), visible focus everywhere, programmatic labels + `role="alert"` text errors, 200% zoom usable ([accessibility-basics.md](docs/launch/verification/accessibility-basics.md)). Not a full WCAG certification, by design. |
| 5 | Staging | **PASS** | Full acceptance executed on a real, freshly-provisioned Supabase project; signal engine reconciles idempotently; core-loop smoke pass; environment + residue documented ([FINAL_STAGING_ACCEPTANCE.md](docs/launch/FINAL_STAGING_ACCEPTANCE.md)). |
| 6 | Tenant security | **PASS** | Cross-tenant denial proven at three layers: app UI (zero foreign rows), direct PostgREST with a foreign user's JWT (10 probes, 0 rows), cross-tenant INSERTs rejected (403/42501); anon reads empty; `verify:rls` 7/7; `verify:install` asserts the JWT-only tenant function (no email fallback) is live on every install. |
| 7 | Setup (plug-and-play) | **PASS** | One-command `seed:admin` (password login + admin role + tenant claim, self-verified by real sign-in); `verify:install` 5/5 on a blank database, twice; clean-install rehearsal from a fresh export passed with **zero deviations** from [START_HERE.md](START_HERE.md) ([plug-and-play-rehearsal.md](docs/launch/verification/plug-and-play-rehearsal.md)). Platform-forced manual steps (magic-link SMTP on free tier) are explicit, numbered, and never called automatic. |
| 8 | Deployment | **OPERATOR ACTION REQUIRED** | Production deploy needs the operator's Vercel account. Everything Claude-side is ready: build green without credentials, exact steps in START_HERE.md + [deployment-runbook.md](docs/launch/deployment-runbook.md), env-var checklist, post-deploy validation list, rollback procedure. |
| 9 | Monitoring | **OPERATOR ACTION REQUIRED** | Sentry code path complete and gate-proven (`withSentryConfig` token-gated; `npm run sentry:test-event` ready). Needs the operator to provision the DSN and record the test-event ID ([sentry-completion.md](docs/launch/verification/sentry-completion.md)). |
| 10 | Backup / recovery | **OPERATOR ACTION REQUIRED** | Tested-restore procedure written into [rollback-procedure.md](docs/launch/runbooks/rollback-procedure.md); M20 evidence template ready with `[FOUNDER]` fields ([m20-backup-pitr-recovery-evidence.md](docs/launch/verification/m20-backup-pitr-recovery-evidence.md)). PITR/daily-backup choice is a dashboard/paid-tier decision on the production project. |
| 11 | Demo readiness | **PASS** | `seed:demo` (idempotent, proven twice live) produces every demonstrable signal category — red/yellow/resolved signals, overdue onboarding, expiring document, unacknowledged policy, pending leave; demo login path documented; seeded dashboard verified in-browser and captured. |

**Score: 8 PASS, 0 FAIL, 3 OPERATOR ACTION REQUIRED** — and all three operator items are environment activation, not product work.

## 2. What "FINISHED — PLUG AND PLAY" is based on

- **Clean install works:** rehearsed from a fresh export of this exact tree against a wiped database, following only the written commands; attempt 1's single undocumented step was fixed into START_HERE.md and the rehearsal restarted from scratch to a zero-deviation pass.
- **Setup instructions work without deviation:** [START_HERE.md](START_HERE.md) is the operator contract; `npm run verify:install` proves each fresh install (schema order, JWT-only tenancy live, views/functions, admin login, demo idempotency).
- **Functionality, UX, mobile, accessibility basics, staging, tenant isolation:** dimensions 1–6 above, all evidence in-tree.
- **Final release package complete:** release folder + ZIP (with SHA-256 checksum) regenerated from this tree; ZIP verified from a clean extraction (see release folder README/checksum file).

## 3. Final gate chain (this tree)

- `npm run typecheck` — PASS
- `npm test` — PASS (10 files, 55/55)
- `npm run guards` — PASS (4/4)
- `npm run build` — PASS (credential-less)

## 3A. Current PR #84 reconciliation gate (4 August 2026)

Run on `codex/reconcile-local-main@6eddb21` after the independent blocker review:

- `npm run typecheck` — PASS
- `npm test` — PASS (12 files, 63/63)
- `npm run guards` — PASS
- `npm run build` — PASS
- Vercel preview — PASS
- GitHub `Gate Chain (Strict)` — BLOCKED before runner startup (`runner_id=0`, no steps/logs)

`npm run db:apply` was not able to validate the new SQL locally because the
configured `SUPABASE_DB_URL` host did not resolve (`ENOTFOUND`). Validate schema
apply once the database connection string is corrected.

## 4. INDEPENDENT VISUAL AND COMMERCIAL ACCEPTANCE

**Reviewed 8 July 2026** by an independent pass that did not rely on any prior audit: real Chromium against the live seeded staging project, every public/admin/employee route and state, at 1440×900 / 1024×768 / 390×844 / 200% zoom. Evidence: [INDEPENDENT_VISUAL_UX_AUDIT.md](docs/launch/INDEPENDENT_VISUAL_UX_AUDIT.md) + before/after captures in [independent-visual-review/](docs/launch/independent-visual-review/). Bar applied: strong enough to show a paying client of a USD 2,000/month managed people-ops service without apology.

Findings: 15 issues (3 HIGH — no landing product visual, broken CTA hierarchy, raw invite error code on a customer surface; 5 MEDIUM; 7 LOW). All CRITICAL/HIGH/MEDIUM fixed and re-captured (commit `4d02e7c`); 3 LOWs accepted with rationale. Axe re-run on all 13 changed routes: 0 violations. Gate chain green after fixes.

| Area | Grade |
|---|---|
| Landing-page clarity (5-second test) | PASS |
| Brand consistency | PASS |
| Dashboard hierarchy | PASS |
| Risk visibility | PASS |
| Navigation | PASS |
| Form usability | PASS |
| Employee-page usability | PASS |
| Mobile quality | PASS |
| Empty/loading/error states | PASS |
| Customer-facing language | PASS |
| Commercial credibility | PASS |
| Premium presentation | PASS |

```text
VISUAL AND UX ACCEPTANCE:
PASS
```

The overall verdict **FINISHED — PLUG AND PLAY** is hereby confirmed, no longer provisional.

## 5. Production activation runbook (the only remaining work)

1. **Deploy:** follow START_HERE.md §Deploy / deployment-runbook Option A against the production Supabase project (db:apply → storage:setup → config push → Vercel env vars → `vercel --prod` → post-deploy validation incl. health checks, both auth tiers, one full core loop, security headers). Production also needs custom SMTP for employee magic-link email delivery (free-tier mailer cannot serve customers).
2. **Sentry:** provision DSN, set the three env vars in Vercel, `npm run sentry:test-event`, record the event ID in sentry-completion.md.
3. **Backup/PITR:** choose Path A (PITR) or Path B (daily-backup tier) on the production project, fill the M20 evidence template, run the tested-restore drill once.

Product development is stopped as of this document. Anything beyond activation belongs to the V2 parking lot (`docs/launch/parking-lot.md`).
