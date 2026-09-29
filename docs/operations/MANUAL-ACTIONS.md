# TeamFrame Manual Action Register

This register is the canonical list of founder or account-owner actions that cannot be completed safely through unattended automation. It contains no passwords, API keys, MFA material, one-time codes, recovery secrets, or secret values.

Last reviewed: 2026-09-29.

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
| MA-003 | Supabase; organisation `Takaven` | Approve the final Production project plan and any resulting paid spend. | Backup retention and recovery capability depend on the selected plan. | **YES**, before Production project creation if spend is required | Production project specification and backup decision complete | Immediately before approved Production project creation | Plan, region, project name, billing owner, and expected cost match the approved specification | **PENDING** |
| MA-004 | Supabase; organisation `Takaven` | Approve creation of the exact authoritative Production project and its empty-target installation. | Creating the live data target is an external infrastructure change. | **YES** | MA-003 complete; exact name, region, plan, canonical schema and stop conditions recorded | Production provisioning window | Project identity/ref recorded; empty target verified; installation and security gates pass without manual repair | **PENDING** |
| MA-005 | Resend; account/team **UNKNOWN** | Identify the owning account, billing owner, sending subdomain and authorised sender; approve provider setup. | Transactional mail and Supabase Auth SMTP need an owned, auditable sender. | **YES**, before Production email acceptance | Account/DNS ownership confirmed and email specification reviewed | Email configuration window | Owner and billing responsibility recorded; sending domain and sender match approval | **PENDING** |
| MA-006 | DNS; provider/account **UNKNOWN** | Approve and publish the exact Resend verification, SPF, DKIM and DMARC records. | Domain authentication requires owner-controlled DNS changes. | **YES**, before Production email go-live | MA-005 complete; provider-generated records captured privately; rollback and TTL understood | Single DNS/email manual-action window | Provider reports domain verified; SPF/DKIM pass; DMARC record resolves; no unrelated records changed | **PENDING** |
| MA-007 | Supabase, Resend and Vercel account owners | Create and enter fresh Production-only secrets and SMTP credentials in their intended scopes. | Production must not reuse Preview, rehearsal, or historical credentials. | **YES** | Production targets exist; variable manifest approved; MA-004 and MA-005 complete | Production configuration window | Names/scopes/targets pass validation; values are never recorded in Git or chat; old Review values remain unchanged | **PENDING** |
| MA-008 | Vercel; team `ismaelloveexcels-projects`; project `teamframe-production` | Approve reconnecting the reserved Production shell to `takaven/teamframe`, branch `main`, and replacing all historical configuration. | The shell is historical and disconnected; configuring it changes the future live target. | **YES** | Production Supabase ready; approved release SHA/tag; environment manifest and rollback deployment prepared | Immediately before Production deployment | Git owner/repo/branch, Production target, env scopes and cron match the approved plan | **PENDING** |
| MA-009 | TeamFrame founder / infrastructure owner | Approve Production RPO, RTO, retention, backup owner and recovery delegate. | Recovery commitments and backup spend require an accountable business decision. | **YES**, before customer data | Production-equivalent recovery design and selected Supabase plan documented | Before Production acceptance and before customer data import | Decisions recorded in `BACKUP-RECOVERY.md`; restore rehearsal scheduled or complete | **PENDING** |
| MA-010 | TeamFrame founder | Approve the exact Production deployment SHA/tag and go-live window. | External Production deployment is a controlled release boundary. | **YES** | All Production preflight checks green; MA-001 and MA-003 through MA-009 complete as applicable | Final go-live window | Deployed SHA, domain, Supabase ref, smoke results and rollback target recorded | **PENDING** |

## Current housekeeping classification

**PARTIAL — AUTOMATABLE PORTION COMPLETE**

- Supabase MFA: **DEFERRED MANUAL ACTION**.
- Founder Review duplicate automation secret: **DEFERRED MANUAL CONSOLIDATION**.
- Neither item is forgotten or waived.

## Grouped founder-action windows

1. **Infrastructure approval:** MA-003, MA-004 and MA-009.
2. **Email and DNS:** MA-005 and MA-006.
3. **Production credentials and hosting:** MA-007 and MA-008.
4. **Final security and go-live:** MA-001 and MA-010.
5. **Founder Review hygiene:** MA-002, in a separate maintenance window if it would add risk to go-live.

