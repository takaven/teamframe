# TeamFrame Manual Action Register

This register is the canonical list of founder or account-owner actions that cannot be completed safely through unattended automation. It contains no passwords, API keys, MFA material, one-time codes, recovery secrets, or secret values.

Last reviewed: 2026-10-02 after the founder approved the pre-revenue, Free-plan Production posture. Detailed decision options and execution order are in [PRODUCTION-REBUILD-PLAN.md](PRODUCTION-REBUILD-PLAN.md).

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
| MA-001 | Supabase; `admin@takaven.com`; organisation `Takaven` | Enable TOTP MFA and preferably register a second backup TOTP factor. Store all enrolment material privately. | The sole organisation owner controls the Production data platform. | **YES**, before any real customer data | First paying customer is ready; authenticator and secure recovery ownership are available | Pre-customer go-live window, before creating customer memberships, invitations or data | Account Security reports MFA enabled; organisation and Production remain accessible; project API credentials are unchanged | **DEFERRED** |
| MA-002 | Vercel; team `ismaelloveexcels-projects`; project `teamframe-founder-review` | Deliberately consolidate or rotate the two `TEAMFRAME_AUTOMATION_SECRET` Preview entries; do not delete either blindly. | A branch-specific Preview entry and a general Preview entry overlap, while plaintext equality cannot be verified. | **NO** for Production provisioning; operational hygiene item **YES** | Controlled rotation plan, authoritative replacement value, rollback, and focused Preview health check prepared | Final manual-action window or a dedicated Founder Review maintenance window | Exactly one intended authority per scope; canonical Preview loads; protected automation/health path passes; no variable-resolution errors | **DEFERRED** |
| MA-003 | Supabase; organisation `Takaven` | When the first paying customer is ready for onboarding, inspect active projects, pause Founder Review only if separately approved and materially useful, reopen Pro checkout, record the exact billing breakdown, and approve the Production upgrade. | Pro supplies the accepted daily-backup and non-pausing posture; Free Production is approved only for synthetic pre-revenue use. | **YES**, before any real customer data | First paying customer is ready; Production acceptance remains healthy; Founder Review retention decision recorded | First paid-customer onboarding window, before creating customer memberships, invitations or data | Checkout cost/credits are recorded; Production is Pro; actual daily backups and seven-day retention are verified | **DEFERRED** |
| MA-004 | Supabase; organisation `Takaven` | Approve creation of `teamframe-production-uae`, ref `ttwsczpzjdjzuhchbyjx`, in Mumbai and its empty-target guarded installation. | Creating the authoritative data target is an external infrastructure change. | **YES** | Exact name, region, Free build phase, canonical schema and stop conditions recorded | Production foundation window | Empty target verified; 45/45 tables and RLS, zero anon table access, service-role checks and private Storage pass without manual repair | **COMPLETE** |
| MA-005 | Resend; verified owner identity recorded privately; Free plan | Establish `mail.takaven.com` as the verified sending domain and approve `TeamFrame <no-reply@mail.takaven.com>` as the Production sender. | Transactional mail and Supabase Auth SMTP need an owned, auditable sender. | **YES**, before Production email acceptance | Production email specification complete; GoDaddy access confirmed | Email/DNS action window | Resend reports DKIM, SPF and return path verified; sender identity and ownership are recorded | **COMPLETE** |
| MA-006 | GoDaddy; zone `takaven.com` | Approve and publish the exact Resend DKIM, sending-authentication and return-path records without changing Microsoft 365 routing, root SPF or root DMARC. | Domain authentication requires owner-controlled DNS changes. | **YES**, before Production email acceptance | MA-005 complete; provider-generated records captured | Email/DNS action window | Resend domain is verified; Microsoft 365 and root protections remain unchanged, including DMARC `p=quarantine` | **COMPLETE** |
| MA-007 | Supabase, Resend and Vercel account owners | Create and enter fresh Production-only secrets and SMTP credentials in their intended scopes. | Production must not reuse Preview, rehearsal or historical credentials. | **YES**, before Production deployment | Production targets exist; variable manifest approved; MA-004 and MA-005 complete | Production configuration window | Names/scopes/targets passed validation; Supabase SMTP and Production email passed; values were not recorded in Git or documentation | **COMPLETE** |
| MA-008 | Vercel; team `ismaelloveexcels-projects`; project `teamframe-production` | Rebuild the reserved shell against `takaven/teamframe` protected `main`; Next.js; repository root; Mumbai `bom1`; cron `0 4 * * *`; canonical Production variables. | The historical shell required replacement with the canonical Production configuration. | **YES**, before Production deployment | Production Supabase, hostname, email, fresh variables and an approved release SHA ready | Production deployment window | Git source, branch, framework, region, hostname, Production target, variables and cron passed Production acceptance | **COMPLETE** |
| MA-009 | TeamFrame founder / infrastructure owner | Establish the approved off-platform database backup and Storage-object recovery procedures, name the operators, and complete one bounded restore proof against the 24-hour RPO and 8-business-hour RTO. | Customer data requires independently proven recovery beyond the Free technical-acceptance posture. | **YES**, before any real customer data | First paying customer is ready; Production is Pro; provider backups are verified; any additional destination or spend is separately approved | Pre-customer data-load window | Encrypted database export and Storage copy are verified; retention and ownership are recorded; isolated restore proof meets the approved targets | **DEFERRED** |
| MA-010 | TeamFrame founder | After Pro, MFA, provider backup, off-platform backup, Storage recovery and restore proof pass, approve final go-live; then give a separate explicit approval for the first customer-data load. | Operational go-live and loading real customer data are distinct controlled boundaries. | **YES**, before any real customer data | MA-001, MA-003 and MA-009 complete; final Production health smoke passes | End of the pre-customer go-live window | Final approval is recorded separately from customer-data-load approval; no data is loaded before both approvals | **DEFERRED** |
| MA-011 | GoDaddy/Vercel; domain `app.takaven.com` | Approve and attach the exact customer-facing Production hostname and align `SITE_URL` and Supabase Auth URLs. | Authentication callbacks and customer trust depend on one authoritative origin. | **YES**, before Production acceptance | GoDaddy ownership and access confirmed | DNS/hosting action window | `app.takaven.com`, `SITE_URL` and Supabase Auth URLs are identical and HTTPS-valid | **COMPLETE** |
| MA-012 | Vercel; project `teamframe-production` | Approve the bounded log-only monitoring posture for the pre-revenue phase. | Production requires an intentional, reviewable monitoring posture. | **YES**, before Production acceptance | Vercel, cron, notification and Resend diagnostics available | Production acceptance window | Health, deep health and provider logs are available; no additional monitoring platform was introduced | **COMPLETE** |

## Current housekeeping classification

**PARTIAL — AUTOMATABLE PORTION COMPLETE**

- Supabase MFA: **DEFERRED MANUAL ACTION**.
- Founder Review duplicate automation secret: **DEFERRED MANUAL CONSOLIDATION**.
- Neither item is forgotten or waived.

## Pre-revenue Production posture

Founder decision recorded on 2026-10-02:

- Production remains on Supabase **Free** until a first paying customer is ready for onboarding.
- Synthetic acceptance, operational smoke testing, authentication/email verification and sales demonstrations without real customer data are permitted.
- Real customer data is **HARD BLOCKED** while Production remains on Free. This includes customer users and invitations, employee data, documents, policies, leave records, payroll data and exports.
- Before the first customer-data load, Production must be upgraded to Pro; actual daily backups and seven-day retention must be verified; MFA, off-platform database backup, Storage-object recovery, restore proof and final health smoke must pass.
- Final go-live approval and customer-data-load approval remain separate founder decisions.
- A Free-plan inactivity pause is an operational plan limitation, not a product defect; Production must be resumed before a demonstration or acceptance check if it pauses.

## Grouped founder-action windows

1. **Production foundation:** MA-004 is complete; the project remains Free and contains no customer data.
2. **Production email, DNS and hostname:** MA-005, MA-006 and MA-011 are complete.
3. **Production monitoring, credentials and hosting:** MA-007, MA-008 and MA-012 are complete.
4. **First paid customer / before customer data:** MA-001, MA-003, MA-009 and MA-010. Customer-data load remains hard blocked until every gate passes and separate approval is recorded.
5. **Founder Review hygiene:** MA-002, in a separate maintenance window if it would add risk to go-live.
