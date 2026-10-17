# TeamFrame System and Operational Handover

**STATUS: CURRENT NAVIGATION AND SYSTEM MAP**

Last verified: 2026-10-17. This file helps a replacement operator find the controlling record; it does not duplicate or override the domain authorities linked below.

## Evidence labels

- **VERIFIED LIVE** — checked against the provider or running service on the stated date.
- **VERIFIED REPOSITORY** — checked against protected source or an open pull request.
- **HISTORICAL** — retained evidence, not current authority.
- **PENDING / UNVERIFIED** — requires an authorised operator to verify before relying on it.

## Start here

| Question | Authoritative answer |
| --- | --- |
| What exists now? | [CURRENT-STATE.md](CURRENT-STATE.md) |
| Which provider project is which? | [ENVIRONMENTS.md](ENVIRONMENTS.md) |
| Which account/role performs an action? | [ACCOUNT-OWNERSHIP.md](ACCOUNT-OWNERSHIP.md) |
| What still needs founder/provider action? | [MANUAL-ACTIONS.md](MANUAL-ACTIONS.md) |
| How are releases and rollbacks handled? | [DEPLOYMENT.md](DEPLOYMENT.md) |
| What backup or recovery evidence exists? | [BACKUP-RECOVERY.md](BACKUP-RECOVERY.md) |
| What is retired or historical? | [RETIRED-RESOURCES.md](RETIRED-RESOURCES.md) |
| What access model is supported? | [TEAMFRAME_ACCESS_MODEL.md](../../TEAMFRAME_ACCESS_MODEL.md) |
| What is the product/commercial boundary? | [TEAMFRAME_MANAGED_PEOPLE_OPS_SCOPE.md](../../TEAMFRAME_MANAGED_PEOPLE_OPS_SCOPE.md) and [DECISIONS.md](../launch/DECISIONS.md) |
| Where is synthetic-environment provenance? | [environment-parity.md](../launch/environment-parity.md) |
| Where is execution history? | [EXECUTION_LEDGER.md](../launch/EXECUTION_LEDGER.md) — historical/provenance only |

## Current source and service map

| Component | Current location | Authority / purpose |
| --- | --- | --- |
| Product application source | [`takaven/teamframe`](https://github.com/takaven/teamframe), protected `main` | Canonical Next.js application and database source |
| Marketing source | [`takaven/takaven-web`](https://github.com/takaven/takaven-web), `main`, `teamframe/` | Canonical public TeamFrame website; separate release path |
| Portfolio registry | [`takaven/product-portfolio`](https://github.com/takaven/product-portfolio), `PORTFOLIO.yaml` | Company portfolio reference, not application operations |
| Application Production | Vercel `teamframe-production`; `https://app.takaven.com` | Pre-customer Production runtime |
| Founder Review | Vercel `teamframe-founder-review`; `https://teamframe-founder-review.vercel.app` | Synthetic Northstar prospect-demo runtime |
| Production data platform | Supabase `teamframe-production-uae`, ref `ttwsczpzjdjzuhchbyjx` | Production Postgres/Auth/Storage; real customer data remains prohibited |
| Founder Review data platform | Supabase `teamframe-founder-review-20260924`, ref `dcfxyjrfsrkibhpbmjnw` | Synthetic Northstar Postgres/Auth/Storage only |
| Marketing Production | Vercel `takaven-web`; `https://www.takaven.com/teamframe/` | Public static marketing website |
| Private employee files | Private Supabase Storage bucket `documents` in each customer installation | File bytes; database rows contain metadata and access context |
| Secrets | Vercel project environment variables and provider dashboards | Values never belong in Git, documentation, chat, screenshots or logs |

## Architecture

```mermaid
flowchart LR
  B[Browser] -->|HTTPS| V[Next.js on Vercel]
  V --> SA[Server Actions and API routes]
  B -->|Supabase client + RLS| DB[(Supabase Postgres)]
  B -->|sessions| AU[Supabase Auth]
  SA -->|server-only service role| DB
  SA --> ST[Private Supabase Storage]
  SA --> EM[Resend transactional email]
  VC[Vercel Cron] -->|protected request| SA
  V --> SE[Sentry when DSNs are configured]
  GH[GitHub protected main] -->|Git-connected build| V
  MW[Marketing website on separate Vercel project] --> CT[admin@takaven.com fallback]
```

- The browser uses Supabase Auth sessions. Company membership, effective access and database RLS decide what an authenticated identity may do.
- Server Actions and API routes perform privileged operations only after application authorisation. The service-role key is server-only.
- Employee documents are private Storage objects. A database backup alone does not recover their file bytes.
- Vercel Cron calls `/api/automation/run`; authentication uses the automation/cron secret contract documented in [DEPLOYMENT.md](DEPLOYMENT.md). An authorised call has business side effects and is not a harmless health test.
- Sentry is DSN-gated. The currently deployed application uses the `main` dependency baseline; the accepted Sentry 10 upgrade remains in the unmerged release candidate.
- Each paying customer receives an independent customer-controlled Vercel/Supabase installation. TeamFrame has no central cross-customer HR database or operator plane.

## Operating routes

| Need | First action | Stop / approval boundary |
| --- | --- | --- |
| Check public health | GET `/api/health` on the exact application domain | Public and read-only |
| Identify deployed source | Vercel project → Production deployment → Git SHA | Reverify project/team before relying on a dated SHA |
| Review runtime errors | Vercel deployment/function logs; Sentry only if configured | Do not copy personal data or secret-bearing logs into tickets/chat |
| Investigate authentication | Follow [support-debugging.md](../launch/runbooks/support-debugging.md); check Supabase Auth and safe diagnostics | No password reset, account creation or auth-policy change without authority |
| Check email | Resend delivery logs plus notification records; Supabase Auth SMTP separately | Do not send live test mail without an approved recipient/test case |
| Check scheduled automation | Vercel Cron history and `/api/automation/run` logs | Do not invoke an authorised run merely to test authentication; it mutates synthetic/real workflow state |
| Confirm private-document access | Review access model/RLS and use an authorised synthetic identity | Never make private files public or use real employee files for a smoke test |
| Prepare a release | [DEPLOYMENT.md](DEPLOYMENT.md) and protected PR checks | Merge, migration and Production release each require their recorded approval |
| Roll back application | Promote the recorded prior known-good Vercel deployment, then smoke | Database rollback is separate and never automatic |
| Respond to credential exposure | [secret-rotation.md](../launch/runbooks/secret-rotation.md) plus provider ownership map | Rotate/revoke only the affected credential under explicit authority |
| Recover database/Storage | [BACKUP-RECOVERY.md](BACKUP-RECOVERY.md) | No destructive Production restore; restore to an approved isolated target first |
| Create customer installation | [TEAMFRAME_ACCESS_MODEL.md](../../TEAMFRAME_ACCESS_MODEL.md), `npm run customer:implement`, guarded installers | Requires approved empty customer target and exact command-specific approvals |
| Hand over/revoke operator access | Verify replacement owner first, then remove obsolete provider access | Permission removal is a controlled provider action |

## Current release boundary

- **Deployed:** application `main` `e53d9ecee1fd53ccbcfa0e24ea8a6871c2a761cc` in both Vercel application projects (**VERIFIED LIVE 2026-10-17**).
- **Prepared, not deployed:** local combined application candidate `b9eccb63889a3f0e561fe91b51ad4bd7f53d6d37`, tree `21ec311ed6c44f984c8f4d571a01b12b6326e556`, composed from open PRs #34–#38 (**VERIFIED REPOSITORY/LOCAL 2026-10-17**).
- **Database:** `migrations/20261016_application_integrity.sql` is not applied to Production (**VERIFIED LIVE 2026-10-17**).
- **Website:** Production deploys website `main` `2835dafe1abe97578dd7b2733cba47d1c061ad83`; branding PR #6 remains open and unmerged (**VERIFIED LIVE/REPOSITORY 2026-10-17**).

## Before first real customer data

Real customer memberships, invitations, employee records, documents, policies, leave or finance data remain prohibited until [MANUAL-ACTIONS.md](MANUAL-ACTIONS.md) records completion of MA-001, MA-003, MA-009 and MA-010, including the separate customer-data-load approval. The current Production rows are synthetic/bootstrap-only, but one unlinked non-reserved Auth identity means the environment must not be described as containing literally no personal data.

## Handover rule

Every operational change must update the appropriate domain authority in the same pull request or controlled follow-up. Preserve dated evidence as historical; never make a historical plan current by copying it into this map.
