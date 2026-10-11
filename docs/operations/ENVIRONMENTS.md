# TeamFrame Environment Registry

**STATUS: CURRENT INFRASTRUCTURE IDENTITY REGISTRY**

Last reconciled: 2026-10-11. Exact SHAs and deployment IDs below are dated checkpoints, not permanent current state. Reverify live provider state before any operational write.

Historical evidence may retain older names and refs, but it does not override this registry.

## Authoritative environments

| Purpose | Source | Vercel | Supabase | Region | Data | Current status |
| --- | --- | --- | --- | --- | --- | --- |
| Local development | `takaven/teamframe`; short-lived working branch | None required | Explicitly selected non-Production target only | Target-specific | Synthetic unless separately authorised | Active development only; no external deployment implied |
| Founder Review | `takaven/teamframe`; current-main stable path remains to be accepted | `teamframe-founder-review` (`prj_7aEgmyR1qQP8VfaFbFN7CexbWVNW`), team `ismaelloveexcels-projects` | `teamframe-founder-review-20260924`, ref `dcfxyjrfsrkibhpbmjnw` | `eu-west-1` | Synthetic Northstar fixture only | Separate synthetic environment; stable durable login not yet accepted |
| Production | `takaven/teamframe`; protected `main` | `teamframe-production` (`prj_09tvdrEWbL1Ov9SFMtrhgYnJ0bNj`), team `ismaelloveexcels-projects`; `https://app.takaven.com` | `teamframe-production-uae`, ref `ttwsczpzjdjzuhchbyjx` | Mumbai / `ap-south-1` | **NO REAL CUSTOMER DATA** until the recorded gates pass | Rebuilt, deployed and healthy for pre-revenue/synthetic operation |
| Temporary repeat-rehearsal proof | Historical launch source | No permanent Vercel environment | `teamframe-operator-repeat-rehearsal-2-20260928`, ref `drohdttbgekrmwubhala` | `ap-south-1` | Synthetic Crescent Ridge fixture | Paused, preserved and locked against replay |

## Canonical source

- Repository: `https://github.com/takaven/teamframe`
- Owner: GitHub organisation `takaven`
- Visibility: public
- Default and Production source branch: protected `main`
- Source policy: protected `main` is authoritative; historical launch branches are not.
- Last verified source checkpoint before this documentation PR (2026-10-10): `f7e9a42b0bfe7c21abe48722b2c01f82d2a0c8f9`
- Branch protection: active `Protect main` ruleset requires a pull request plus `Gate Chain (Strict)` and `Static Guard Suite (Phase 1D)`; force pushes and deletion are blocked.

## Production

- Production application: `https://app.takaven.com`
- Git connection: `takaven/teamframe`, protected `main`
- Last verified deployment checkpoint before this documentation PR (2026-10-10): `4XhWi9koWLXSVm9nPseFQUQCCMz9`
- Production Supabase: `teamframe-production-uae`, ref `ttwsczpzjdjzuhchbyjx`, organisation `Takaven`, Mumbai / `ap-south-1`
- Current plan: Free pre-revenue posture; no real customer data is authorised.
- Database: 45/45 canonical public tables installed; RLS enabled on all 45; zero anonymous table access.
- Storage: private canonical `documents` bucket verified.
- Email/DNS/SMTP: complete and accepted.
- Runtime configuration and cron: complete and accepted.
- Auth hostname and redirect alignment: complete and accepted.
- Monitoring: approved log-only pre-revenue posture complete.

The former description of `teamframe-production` as a disconnected rebuild-only historical shell is obsolete. The rebuild completed. The first-real-customer gates in [MANUAL-ACTIONS.md](MANUAL-ACTIONS.md) still apply before any customer data is loaded.

## Founder Review

- Founder Review is separate from Production and contains synthetic Northstar data only.
- The historical launch-branch Preview remains a temporary fallback while a durable current-main login is stabilised.
- Stable Founder Review / prospect-demo acceptance is blocked on MA-002 in [MANUAL-ACTIONS.md](MANUAL-ACTIONS.md).
- Founder Review automation credential values previously appeared in public Git history and must be treated as compromised.
- Current documentation records variable names and scope only. It must not contain, quote or reuse those values.
- MA-002 requires rotation and consolidation under one intended authority, followed by focused health, automation and fresh-browser repeat-login verification.
- Deployment Retention is enabled. Do not delete retained Preview deployments merely for cosmetic cleanup.
- Never promote Founder Review configuration to Production or use customer data in `dcfxyjrfsrkibhpbmjnw`.

## Environment-variable inventory

Names and scopes do not prove target correctness. Values belong only in their approved provider stores.

| Vercel project | Scope | Expected names |
| --- | --- | --- |
| `teamframe-founder-review` | Preview | `TEAMFRAME_AUTOMATION_SECRET`, `SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `VERCEL_PREVIEW_FEEDBACK_ENABLED`, `DEEP_HEALTH_SECRET`, `TEAMFRAME_REVIEW_PASSWORD_AUTH` |
| `teamframe-production` | Production | `CRON_SECRET`, `TEAMFRAME_AUTOMATION_SECRET`, `DEEP_HEALTH_SECRET`, `SUPABASE_DB_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SITE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `RESEND_API_KEY`, `TEAMFRAME_EMAIL_FROM` |

Do not print or record secret values during inventory. Verify provider account, project, scope and target identity before any change.

## Temporary environment policy

Only one active rehearsal/proof project should exist at a time. A new proof project requires an explicit purpose, approved project identity, synthetic-only confirmation, a stop condition and a recorded retention/deletion decision.

Do not infer mutation authority from `scripts/approved-launch-projects.mjs`. Current resource status and task-specific approval are both required.

## Do not use

| Resource | Why |
| --- | --- |
| Supabase `zylllrvcmockvfcfubkp` | Historical Production; abandoned for launch |
| Supabase `xqiamhwkuogcgucwmlxy` | Deleted empty rehearsal project; never rediscover as active |
| Supabase retired refs in [RETIRED-RESOURCES.md](RETIRED-RESOURCES.md) | Deleted disposable proofs; retained as historical evidence only |
| Vercel `teamframe` | Deleted historical duplicate; do not recreate as canonical TeamFrame |
| Vercel `teamframe-visual-review-20260814061335` | Deleted superseded visual-review project |
| Vercel `mockup-sandbox` | Historical TeamFrame V2 project connected to `ismaelloveexcel/teamframe.v2` |
| GitHub `ismaelloveexcel/TeamFrame` | Historical source; not canonical TeamFrame |
| GitHub `ismaelloveexcel/teamframe.v2` | Separate historical simulation project; not canonical TeamFrame |

See [RETIRED-RESOURCES.md](RETIRED-RESOURCES.md) for the full retention/deletion inventory. The completed preparation and rebuild plans are historical evidence only. Current founder actions are in [MANUAL-ACTIONS.md](MANUAL-ACTIONS.md), and the current deployment/change procedure is in [DEPLOYMENT.md](DEPLOYMENT.md).

## Provider login map

Use [ACCOUNT-OWNERSHIP.md](ACCOUNT-OWNERSHIP.md). Never select a project by remembered name alone; verify provider account/team, project name/ref, branch and target URL before any write.
