# TeamFrame Environment Registry

**STATUS: CURRENT INFRASTRUCTURE IDENTITY REGISTRY**

Last reconciled: 2026-10-17. Exact SHAs and deployment IDs below are dated checkpoints, not permanent current state. Reverify live provider state before any operational write.

Historical evidence may retain older names and refs, but it does not override this registry.

## Authoritative environments

| Purpose | Source | Vercel | Supabase | Region | Data | Current status |
| --- | --- | --- | --- | --- | --- | --- |
| Local development | `takaven/teamframe`; short-lived working branch | None required | Explicitly selected non-Production target only | Target-specific | Synthetic unless separately authorised | Active development only; no external deployment implied |
| Founder Review | `takaven/teamframe`; protected `main` | `teamframe-founder-review` (`prj_7aEgmyR1qQP8VfaFbFN7CexbWVNW`), TAKAVEN team `team_cXj0JaXqYVDGppqmiqNXIxVg`; `https://teamframe-founder-review.vercel.app` | `teamframe-founder-review-20260924`, ref `dcfxyjrfsrkibhpbmjnw` | `eu-west-1` | Synthetic Northstar fixture only | Active and healthy; schema 50/50, RLS 50/50, zero anonymous table privileges; MA-002 remains open |
| Production | `takaven/teamframe`; protected `main` | `teamframe-production` (`prj_09tvdrEWbL1Ov9SFMtrhgYnJ0bNj`), TAKAVEN team `team_cXj0JaXqYVDGppqmiqNXIxVg`; `https://app.takaven.com` | `teamframe-production-uae`, ref `ttwsczpzjdjzuhchbyjx` | Mumbai / `ap-south-1` | Synthetic/bootstrap-only application data; one unlinked non-reserved Auth identity; **NO REAL CUSTOMER HR DATA** | Active and healthy; schema 50/50, RLS 50/50, zero anonymous table privileges; customer-data gates remain open |
| Marketing website | `takaven/takaven-web`; protected `main` | `takaven-web` (`prj_d0VTmOdVmnB6Di3S99fjPea7V5mz`), TAKAVEN team; `https://www.takaven.com/teamframe/` | None | Vercel-managed | Public marketing content only | Active and healthy; separate from application Production |
| Temporary repeat-rehearsal proof | Historical launch source | No permanent Vercel environment | `teamframe-operator-repeat-rehearsal-2-20260928`, ref `drohdttbgekrmwubhala` | `ap-south-1` | Synthetic Crescent Ridge fixture | Paused, preserved and locked against replay |

## Canonical source

- Repository: `https://github.com/takaven/teamframe`
- Owner: GitHub organisation `takaven`
- Visibility: public
- Default and Production source branch: protected `main`
- Source policy: protected `main` is authoritative; historical launch branches are not.
- Last verified protected `main` before this documentation PR (2026-10-17): `e53d9ecee1fd53ccbcfa0e24ea8a6871c2a761cc`.
- Accepted combined release candidate remains local and unmerged: commit `b9eccb63889a3f0e561fe91b51ad4bd7f53d6d37`, tree `21ec311ed6c44f984c8f4d571a01b12b6326e556`.
- Branch protection: active `Protect main` ruleset requires a pull request plus `Gate Chain (Strict)` and `Static Guard Suite (Phase 1D)`; force pushes and deletion are blocked.

## Production

- Production application: `https://app.takaven.com`
- Vercel owner/plan: TAKAVEN team `team_cXj0JaXqYVDGppqmiqNXIxVg`, Pro (founder/provider verified); billing payer/renewal owner remains unverified in [ACCOUNT-OWNERSHIP.md](ACCOUNT-OWNERSHIP.md).
- Git connection: `takaven/teamframe`, protected `main`
- Last verified Production deployment (2026-10-17): `dpl_9qzKwWtmCYrBrUPKcbLeiHTo7yBR`, source `e53d9ecee1fd53ccbcfa0e24ea8a6871c2a761cc`, state `READY`.
- Production Supabase: `teamframe-production-uae`, ref `ttwsczpzjdjzuhchbyjx`, organisation `Takaven`, Mumbai / `ap-south-1`
- Current plan: Free pre-revenue posture; no real customer data is authorised.
- Database: 50/50 current public tables installed; RLS enabled on all 50; zero anonymous table privileges.
- Read-only data checkpoint (2026-10-17): one company, one employee, one membership, zero documents, zero leave rows, zero policies, two Auth users, one bucket and zero Storage objects. One Auth identity is non-reserved but unlinked to a customer membership; do not claim literal zero personal data.
- PostgreSQL: `17.6.1.171` at the last provider-settings verification.
- Storage: private canonical `documents` bucket; zero objects at the current checkpoint.
- Email/DNS/SMTP: complete and accepted.
- Runtime configuration and cron: complete and accepted.
- Auth hostname and redirect alignment: complete and accepted.
- Monitoring: approved log-only pre-revenue posture complete.
- Backup/recovery: no Production export or restore proof; immediate migration snapshot and MA-003/MA-009 remain as described in [BACKUP-RECOVERY.md](BACKUP-RECOVERY.md).

The former description of `teamframe-production` as a disconnected rebuild-only historical shell is obsolete. The rebuild completed. The first-real-customer gates in [MANUAL-ACTIONS.md](MANUAL-ACTIONS.md) still apply before any customer data is loaded.

## Founder Review

- Founder Review is separate from Production and contains synthetic Northstar data only.
- Vercel owner/plan: TAKAVEN Pro team. Supabase project plan: Free at the 2026-10-17 provider check.
- Last verified deployment (2026-10-17): `dpl_GKUwv4TuJhuTdoHZS8TKsideU4Tj`, source `e53d9ecee1fd53ccbcfa0e24ea8a6871c2a761cc`, state `READY`.
- Read-only database checkpoint: 50 public tables, RLS on all 50, zero anonymous table privileges, one company, 18 employees, three memberships, 10 document rows, five leave rows, four policies, three Auth users, one bucket and zero Storage objects.
- `/api/health` returned `{"status":"ok"}` on 2026-10-17.
- An authenticated current-main walkthrough and clean-browser login were completed in the preceding acceptance work, but MA-002 remains open until its credential freshness/authority evidence satisfies [MANUAL-ACTIONS.md](MANUAL-ACTIONS.md). Do not call that gate complete by inference.
- The obsolete launch-branch-scoped Vercel secret override was removed. The remaining authoritative secret value is not recorded here. An authorised automation execution was intentionally not used as a harmless auth check because the endpoint performs business actions.
- Deployment Retention is enabled. Do not delete retained deployments merely for cosmetic cleanup.
- Backup/recovery: synthetic fixture is reproducible, but no current Founder Review backup/restore proof is claimed.
- Never promote Founder Review configuration to Production or use customer data in `dcfxyjrfsrkibhpbmjnw`.

## Environment-variable inventory

Names and scopes do not prove target correctness. Values belong only in their approved provider stores.

| Vercel project | Scope | Expected names |
| --- | --- | --- |
| `teamframe-founder-review` | Production + Preview unless noted | Eight entries: `TEAMFRAME_AUTOMATION_SECRET`, `SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DEEP_HEALTH_SECRET`, `TEAMFRAME_REVIEW_PASSWORD_AUTH`; `VERCEL_PREVIEW_FEEDBACK_ENABLED` is Preview-only |
| `teamframe-production` | Production | Nine entries: `CRON_SECRET`, `TEAMFRAME_AUTOMATION_SECRET`, `DEEP_HEALTH_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `SITE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `RESEND_API_KEY`, `TEAMFRAME_EMAIL_FROM` |

Do not print or record secret values during inventory. Verify provider account, project, scope and target identity before any change.

`SUPABASE_DB_URL` is an operator-process input for controlled database work and is not stored in the verified Vercel Production environment. Sentry variables are optional and are not present in the verified Vercel inventories. See `.env.example` and [DEPLOYMENT.md](DEPLOYMENT.md) for the wider local/operator variable set.

## Marketing website

- Vercel project: `takaven-web` / `prj_d0VTmOdVmnB6Di3S99fjPea7V5mz`; TAKAVEN Pro team.
- Source: `takaven/takaven-web`, branch `main`.
- Current Production deployment: `dpl_CTjMMHf32BSC3epnHCYJXLuLxQEf`, source `2835dafe1abe97578dd7b2733cba47d1c061ad83`, `READY` on 2026-10-17.
- Public URL/health check: `https://www.takaven.com/teamframe/`; privacy at `/teamframe/privacy.html`; root redirects to `/teamframe/`.
- Data/configuration: static marketing content; no employee database. `FORM_ENDPOINT` remains intentionally unset; `admin@takaven.com` is the accepted contact fallback.
- Recovery: Git/Vercel deployment history is the application-content recovery path; domain/DNS recovery remains provider-account dependent.

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
