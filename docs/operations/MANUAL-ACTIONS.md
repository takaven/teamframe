# TeamFrame Manual Action Register

This register is the canonical list of founder or account-owner actions that cannot be completed safely through unattended automation. It contains no passwords, API keys, MFA material, one-time codes, recovery secrets, or secret values.

Last reviewed: 2026-10-17 after Vercel ownership transfer and live infrastructure reconciliation. Current operational status is in [CURRENT-STATE.md](CURRENT-STATE.md); completed Production rebuild/transfer planning is historical.

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
| MA-002 | Vercel TAKAVEN team; project `teamframe-founder-review` | Prove that the remaining authoritative `TEAMFRAME_AUTOMATION_SECRET` was freshly rotated after exposure and retain only one intended authority. Do not reuse or disclose any historical value. | A historical Founder Review automation value appeared in public Git history. The obsolete launch-branch override is removed, but the remaining entry's freshness is not documented to the gate standard. | **NO** for Production/customer data; **YES** before declaring the credential consolidation complete | One remaining Production+Preview entry; current-main Review, fresh login and unauthorised denial already verified; safe verification design acknowledges that an authorised run has business side effects | Dedicated Founder Review credential window | Rotation timestamp/freshness evidence; exactly one intended entry; current-main Review remains healthy; unauthorised automation denied; any authorised business-action test is separately bounded or intentionally not run with rationale | **READY FOR FOUNDER** |
| MA-003 | Supabase; organisation `Takaven` | When the first paying customer is ready for onboarding, inspect active projects, pause Founder Review only if separately approved and materially useful, reopen Pro checkout, record the exact billing breakdown, and approve the Production upgrade. | Pro supplies the accepted daily-backup and non-pausing posture; Free Production is approved only for synthetic pre-revenue use. | **YES**, before any real customer data | First paying customer is ready; Production acceptance remains healthy; Founder Review retention decision recorded | First paid-customer onboarding window, before creating customer memberships, invitations or data | Checkout cost/credits are recorded; Production is Pro; actual daily backups and seven-day retention are verified | **DEFERRED** |
| MA-004 | Supabase; organisation `Takaven` | Approve creation of `teamframe-production-uae`, ref `ttwsczpzjdjzuhchbyjx`, in Mumbai and its empty-target guarded installation. | Creating the authoritative data target is an external infrastructure change. | **YES** | Exact name, region, Free build phase, canonical schema and stop conditions recorded | Production foundation window | Initial guarded install completed; current live checkpoint is 50/50 tables and RLS, zero anonymous table privileges, required service-role access and private Storage | **COMPLETE** |
| MA-005 | Resend; verified owner identity recorded privately; Free plan | Establish `mail.takaven.com` as the verified sending domain and approve `TeamFrame <no-reply@mail.takaven.com>` as the Production sender. | Transactional mail and Supabase Auth SMTP need an owned, auditable sender. | **YES**, before Production email acceptance | Production email specification complete; GoDaddy access confirmed | Email/DNS action window | Resend reports DKIM, SPF and return path verified; sender identity and ownership are recorded | **COMPLETE** |
| MA-006 | GoDaddy; zone `takaven.com` | Approve and publish the exact Resend DKIM, sending-authentication and return-path records without changing Microsoft 365 routing, root SPF or root DMARC. | Domain authentication requires owner-controlled DNS changes. | **YES**, before Production email acceptance | MA-005 complete; provider-generated records captured | Email/DNS action window | Resend domain is verified; Microsoft 365 and root protections remain unchanged, including DMARC `p=quarantine` | **COMPLETE** |
| MA-007 | Supabase, Resend and Vercel account owners | Create and enter fresh Production-only secrets and SMTP credentials in their intended scopes. | Production must not reuse Preview, rehearsal or historical credentials. | **YES**, before Production deployment | Production targets exist; variable manifest approved; MA-004 and MA-005 complete | Production configuration window | Names/scopes/targets passed validation; Supabase SMTP and Production email passed; values were not recorded in Git or documentation | **COMPLETE** |
| MA-008 | Vercel; current owner TAKAVEN team `team_cXj0JaXqYVDGppqmiqNXIxVg`; project `teamframe-production` | Historical action: rebuild the reserved shell against `takaven/teamframe` protected `main`; Next.js; repository root; Mumbai `bom1`; cron `0 4 * * *`; canonical Production variables. | The historical shell required replacement with the canonical Production configuration. Ownership was subsequently transferred to TAKAVEN. | **YES**, before initial Production deployment | Production Supabase, hostname, email, fresh variables and an approved release SHA ready | Completed Production window | Git source, branch, framework, region, hostname, Production target, variables and cron passed; current TAKAVEN ownership verified | **COMPLETE** |
| MA-009 | TeamFrame founder / infrastructure owner | Establish the approved off-platform database backup and Storage-object recovery procedures, name the operators, and complete one bounded restore proof against the 24-hour RPO and 8-business-hour RTO. | Customer data requires independently proven recovery beyond the Free technical-acceptance posture. | **YES**, before any real customer data | First paying customer is ready; Production is Pro; provider backups are verified; any additional destination or spend is separately approved | Pre-customer data-load window | Encrypted database export and Storage copy are verified; retention and ownership are recorded; isolated restore proof meets the approved targets | **DEFERRED** |
| MA-010 | TeamFrame founder | After Pro, MFA, provider backup, off-platform backup, Storage recovery and restore proof pass, approve final go-live; then give a separate explicit approval for the first customer-data load. | Operational go-live and loading real customer data are distinct controlled boundaries. | **YES**, before any real customer data | MA-001, MA-003 and MA-009 complete; final Production health smoke passes | End of the pre-customer go-live window | Final approval is recorded separately from customer-data-load approval; no data is loaded before both approvals | **DEFERRED** |
| MA-011 | GoDaddy/Vercel; domain `app.takaven.com` | Approve and attach the exact customer-facing Production hostname and align `SITE_URL` and Supabase Auth URLs. | Authentication callbacks and customer trust depend on one authoritative origin. | **YES**, before Production acceptance | GoDaddy ownership and access confirmed | DNS/hosting action window | `app.takaven.com`, `SITE_URL` and Supabase Auth URLs are identical and HTTPS-valid | **COMPLETE** |
| MA-012 | Vercel; project `teamframe-production` | Approve the bounded log-only monitoring posture for the pre-revenue phase. | Production requires an intentional, reviewable monitoring posture. | **YES**, before Production acceptance | Vercel, cron, notification and Resend diagnostics available | Production acceptance window | Health, deep health and provider logs are available; no additional monitoring platform was introduced | **COMPLETE** |
| MA-013 | Supabase account tokens and historical Vercel credential inventory | Revoke the active Supabase CLI token named `cli_root@Ismael_1792239426` if no longer required, and verify/revoke the legacy Vercel token referenced by a historical local setup script using provider metadata only. | Temporary/legacy tokens outlive their bounded use and create avoidable operator-account risk. | **NO** for code preparation; **YES** for credential hygiene before operational handover is called complete | Confirm replacement access path and that no current automation depends on either token; exact provider authority available | Small credential-revocation window | Provider shows Supabase token revoked; Vercel token status resolved and revoked if active; current project access remains functional; values never copied or displayed | **READY FOR FOUNDER** |

## Current housekeeping classification

**PARTIAL — AUTOMATABLE PORTION COMPLETE**

- Supabase MFA: **DEFERRED MANUAL ACTION**.
- Founder Review automation credential freshness: **READY FOR FOUNDER — REQUIRED BEFORE MA-002 CLOSURE**.
- Supabase CLI and legacy Vercel token hygiene: **READY FOR FOUNDER — MA-013**.
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
5. **Founder Review credential closure:** the current-main demo/login walkthrough is complete, but MA-002 credential freshness evidence must close before the security consolidation is called complete. It is not a Production customer-data gate.
6. **Operator credential hygiene:** complete MA-013 without rotating unrelated credentials or exposing values.
