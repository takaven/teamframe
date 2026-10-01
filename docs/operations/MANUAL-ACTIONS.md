# TeamFrame Manual Action Register

This register is the canonical list of founder or account-owner actions that cannot be completed safely through unattended automation. It contains no passwords, API keys, MFA material, one-time codes, recovery secrets, or secret values.

Last reviewed: 2026-10-01 after the approved Free-plan Production foundation installation. Detailed decision options and execution order are in [PRODUCTION-REBUILD-PLAN.md](PRODUCTION-REBUILD-PLAN.md).

## Operating policy

When a step requires MFA enrolment, billing approval, DNS changes, secret creation or entry, domain verification, destructive Production approval, or interactive account verification:

1. record the action here;
2. identify the exact dependency and prerequisite;
3. continue all independent, non-destructive work;
4. group ready actions into the smallest practical founder-action window;
5. verify each action before marking it complete.

Do not stop the wider workstream unless a pending action is required for the next technical step. `DEFERRED` does not mean waived.

## Status definitions

- `PENDING` — required, but prerequisites are incomplete.
- `READY FOR FOUNDER` — prerequisites are complete and the action can be performed.
- `COMPLETE` — performed and independently verified.
- `DEFERRED` — deliberately postponed to a later manual-action window.

## Register

| ID | Provider / account or organisation | Exact action required | Why required | Launch blocker | Prerequisite | Perform when | Verification afterward | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| MA-001 | Supabase; `admin@takaven.com`; organisation `Takaven` | Enable TOTP MFA and preferably register a second backup TOTP factor. Store all enrolment material privately. | The sole organisation owner controls the Production data platform. | **YES**, before Production go-live | Authenticator and secure recovery ownership available; final manual-action window opened | Final manual-action window, before Production credentials and go-live acceptance | Account Security reports MFA enabled; organisation and Founder Review remain accessible; project API credentials are unchanged | **DEFERRED** |
| MA-002 | Vercel; team `ismaelloveexcels-projects`; project `teamframe-founder-review` | Deliberately consolidate or rotate the two `TEAMFRAME_AUTOMATION_SECRET` Preview entries; do not delete either blindly. | A branch-specific Preview entry and a general Preview entry overlap, while plaintext equality cannot be verified. | **NO** for Production provisioning; operational hygiene item **YES** | Controlled rotation plan, authoritative replacement value, rollback, and focused Preview health check prepared | Final manual-action window or a dedicated Founder Review maintenance window | Exactly one intended authority per scope; canonical Preview loads; protected automation/health path passes; no variable-resolution errors | **DEFERRED** |
| MA-003 | Supabase; organisation `Takaven` | Immediately before customer go-live, pause Founder Review if operationally acceptable, reopen Pro checkout, verify the exact billing breakdown, and approve the Production upgrade. | Pro supplies seven-day automatic daily backups and avoids Free-plan pausing; the current Free build phase is not acceptable for customer data. | **YES**, before customer data/go-live | Production technical acceptance complete; Founder Review retention decision recorded | Final go-live manual-action window | Production is the intended active project; checkout cost/credits are recorded; Pro and daily backups are active | **DEFERRED** |
| MA-004 | Supabase; organisation `Takaven` | Approve creation of `teamframe-production-uae`, ref `ttwsczpzjdjzuhchbyjx`, in Mumbai and its empty-target guarded installation. | Creating the authoritative data target is an external infrastructure change. | **YES** | Exact name, region, Free build phase, canonical schema and stop conditions recorded | Production foundation window | Empty target verified; 45/45 tables and RLS, zero anon table access, service-role checks and private Storage pass without manual repair | **COMPLETE** |
| MA-005 | Resend; account/team **UNKNOWN** | Identify the owning account, billing owner, confirmed root domain, `mail.<confirmed-domain>` sending subdomain and authorised sender; approve provider setup. | Transactional mail and Supabase Auth SMTP need an owned, auditable sender. | **YES**, before Production email acceptance | Production email specification is complete | Final email/DNS action window | Owner and billing responsibility recorded; sending domain and sender match approval | **READY FOR FOUNDER** |
| MA-006 | DNS; provider/account **UNKNOWN** | Approve and publish the exact Resend verification, SPF, DKIM and DMARC records. | Domain authentication requires owner-controlled DNS changes. | **YES**, before Production email go-live | MA-005 complete; provider-generated records captured privately; rollback and TTL understood | Single DNS/email manual-action window | Provider reports domain verified; SPF/DKIM pass; DMARC record resolves; no unrelated records changed | **PENDING** |
| MA-007 | Supabase, Resend and Vercel account owners | Create and enter fresh Production-only secrets and SMTP credentials in their intended scopes. | Production must not reuse Preview, rehearsal, or historical credentials. | **YES** | Production targets exist; variable manifest approved; MA-004 and MA-005 complete | Production configuration window | Names/scopes/targets pass validation; values are never recorded in Git or chat; old Review values remain unchanged | **PENDING** |
| MA-008 | Vercel; team `ismaelloveexcels-projects`; project `teamframe-production` | Approve rebuilding the reserved shell: connect `takaven/teamframe`, protected `main`; Next.js; repository root; Mumbai `bom1`; cron `0 4 * * *`; replace historical runtime values; remove runtime-unneeded `SUPABASE_DB_URL`. | The shell is historical and disconnected; configuring it changes the future live target. | **YES** | Production Supabase, hostname, email, fresh variables, approved release SHA/tag and rollback plan ready | Immediately before Production deployment | Git owner/repo/branch, framework, region, Production target, env scopes and cron match the rebuild plan | **PENDING** |
| MA-009 | TeamFrame founder / infrastructure owner | Approve 24-hour RPO, 8-business-hour RTO, seven-day provider DB retention, off-platform retention, backup operator, recovery delegate and founder restore/cutover authority. | Recovery commitments and backup spend require an accountable business decision. | **YES**, before customer data | Production rebuild plan complete | Final manual-action window before project creation | Decisions recorded in `BACKUP-RECOVERY.md`; Production-equivalent restore rehearsal scheduled | **READY FOR FOUNDER** |
| MA-010 | TeamFrame founder | Approve the exact Production deployment SHA/tag and go-live window. | External Production deployment is a controlled release boundary. | **YES** | All Production preflight checks green; MA-001 and MA-003 through MA-009 complete as applicable | Final go-live window | Deployed SHA, domain, Supabase ref, smoke results and rollback target recorded | **PENDING** |
| MA-011 | DNS/Vercel; owners **UNKNOWN** | Approve the exact customer-facing Production hostname and its DNS owner; allow the Vercel domain for technical acceptance only if required. | `SITE_URL`, Auth callbacks and customer trust depend on one authoritative origin. | **YES**, before customer go-live; **NO** for internal acceptance on the Vercel domain | Domain and DNS ownership confirmed | Final DNS/hosting action window | Primary Vercel domain, `SITE_URL` and Supabase Auth URLs are identical and HTTPS-valid | **READY FOR FOUNDER** |
| MA-012 | Sentry/Vercel; account owner **UNKNOWN** | Approve paired Sentry DSNs or explicitly approve the bounded log-only launch posture. | Production needs a deliberate monitoring posture; silence must not be mistaken for configuration. | **YES**, before customer go-live | Monitoring options documented | Final monitoring/hosting action window | Paired Sentry test event succeeds, or named log-review owner and procedure are recorded | **READY FOR FOUNDER** |

## Current housekeeping classification

**PARTIAL — AUTOMATABLE PORTION COMPLETE**

- Supabase MFA: **DEFERRED MANUAL ACTION**.
- Founder Review duplicate automation secret: **DEFERRED MANUAL CONSOLIDATION**.
- Neither item is forgotten or waived.

## Grouped founder-action windows

1. **Production foundation:** MA-004 is complete; the project remains Free and contains no customer data.
2. **Before deployment — email, DNS and hostname:** MA-005, MA-006 and MA-011.
3. **Before deployment — monitoring, credentials and hosting:** MA-007, MA-008 and MA-012.
4. **Before customer data/go-live:** MA-001, MA-003, MA-009 and MA-010, followed by separate customer-data approval.
5. **Founder Review hygiene:** MA-002, in a separate maintenance window if it would add risk to go-live.
