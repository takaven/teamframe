# TeamFrame Current State

**STATUS: CANONICAL CURRENT-STATE RECORD**

Last reconciled: 2026-10-10

This file is the first document any human or agent must read before changing TeamFrame operations, deployment, access, launch status or repository state.

If another repository document conflicts with this file, this file controls unless a newer founder-approved decision explicitly supersedes it.

## Source of truth order

1. `docs/operations/CURRENT-STATE.md` — current operational truth.
2. `docs/operations/MANUAL-ACTIONS.md` — remaining founder/account-owner gates.
3. `docs/operations/ENVIRONMENTS.md` — current environment identities.
4. `docs/operations/DEPLOYMENT.md` and `TEAMFRAME_PRODUCTION_RUNBOOK.md` — current deployment/operations procedure.
5. `TEAMFRAME_ACCESS_MODEL.md` and `TEAMFRAME_MANAGED_PEOPLE_OPS_SCOPE.md` — current product/commercial model.
6. `docs/launch/*`, completed plans and historical release records — provenance only; they do not override current state.

Do not infer current production status from an old launch branch, old SHA, historical Vercel deployment, retired Supabase project, or superseded launch plan.

## Product

- Product functionality: **COMPLETE / FROZEN**.
- Product changes require a genuine production defect, a demonstrated first-customer blocker, repeated customer evidence, or a separately founder-approved bounded improvement.
- Customer-facing brand: **TeamFrame**.
- Owner: **TAKAVEN**.
- TAKAVEN is not the customer implementation/support/HR-service proposition.
- Commercial implementation can state that TeamFrame is designed to be configured and ready for handover within 48 hours once complete usable setup information and required access are available.
- UAE positioning may state that TeamFrame helps businesses stay compliant with UAE Labour Law; this is operational support, not legal advice or a guarantee of statutory compliance.

## Canonical source

- Repository: `takaven/teamframe`
- Protected production branch: `main`
- Current verified main SHA at reconciliation: `f7e9a42b0bfe7c21abe48722b2c01f82d2a0c8f9`
- Open PRs at reconciliation: 0 before this documentation-cleanup branch.
- Historical merged branches are not current source authority.

## Production

Production is **deployed and healthy for pre-revenue/synthetic operation**.

- Vercel project: `teamframe-production`
- Vercel project ID: `prj_09tvdrEWbL1Ov9SFMtrhgYnJ0bNj`
- Source: protected `main`
- Verified deployment at reconciliation: `4XhWi9koWLXSVm9nPseFQUQCCMz9`
- Verified source SHA: `f7e9a42b0bfe7c21abe48722b2c01f82d2a0c8f9`
- Customer-facing domain: `https://app.takaven.com`
- Public root: healthy
- `/api/health`: healthy
- Protected deep health: unauthorised access correctly denied
- Region: Mumbai / `ap-south-1`
- Monitoring: approved log-only pre-revenue posture
- Cron: configured at the approved production cadence
- Production email/DNS/SMTP: completed and accepted
- Production secrets/configuration: completed and accepted
- Auth hostname/redirect alignment: completed and accepted

The old statement that `teamframe-production` is a disconnected rebuild-only historical shell is **obsolete** and must not be used.

## Production data platform

- Supabase project: `teamframe-production-uae`
- Ref: `ttwsczpzjdjzuhchbyjx`
- Organisation: `Takaven`
- Region: Mumbai / `ap-south-1`
- Current plan: Free pre-revenue posture
- Schema: 45/45 canonical public tables installed
- RLS: enabled on all 45
- Anonymous table access: zero
- Storage: private canonical `documents` bucket verified
- Real customer data: **NOT AUTHORISED YET**

Free Production is intentional until the first paying customer is ready. It is not the approved real-customer-data posture.

## First-customer implementation proof

A broad first-customer rehearsal does **not** need to be repeated.

Verified synthetic evidence includes:

- realistic customer implementation;
- clean canonical installation;
- private storage;
- Full Access bootstrap;
- 50-person synthetic customer setup;
- Admin/Manager/Finance/Employee handover checks;
- repeat implementation proof;
- repeat execution time: **238.4 seconds**;
- maintained customer implementation command/runbook.

The next real implementation proof should be the bounded first paying-customer activation after the remaining data gates pass.

## Remaining real-customer-data gates

Only the following manual-action gates remain blocking for real customer data:

- **MA-001** — enable Supabase organisation MFA.
- **MA-003** — upgrade Production to Pro and verify actual daily backups with seven-day retention.
- **MA-009** — establish off-platform database backup and private Storage-object recovery, then complete one isolated restore proof.
- **MA-010** — run the final bounded Production health smoke, approve go-live, then separately approve the specific customer-data load.

No real customer memberships, invitations, employee records, documents or other customer HR data are to be loaded before all four gates pass.

## Founder Review / prospect demo

Founder Review is separate from Production.

- Vercel project: `teamframe-founder-review`
- Project ID: `prj_7aEgmyR1qQP8VfaFbFN7CexbWVNW`
- Synthetic Supabase: `teamframe-founder-review-20260924`
- Ref: `dcfxyjrfsrkibhpbmjnw`
- Data: synthetic Northstar fixture only
- Stable durable login: **NOT YET ACCEPTED**
- Current priority: stabilise a bookmarkable current-main demo login without weakening auth or using customer data.
- Keep the known historical launch-branch Preview fallback until the stable Founder Review path passes repeat-login acceptance.

## Security hygiene

No secret values belong in Git, documentation, chat transcripts or screenshots.

Founder Review automation-secret plaintext was previously written into tracked environment documentation. Those values must be treated as exposed and rotated/consolidated during the Founder Review maintenance window. The current documentation must never repeat them.

Removing a secret from the latest file does not remove it from Git history; rotation is therefore required.

## Documentation policy

Current-state documents must be updated in the same change that materially changes environment/deployment/launch status.

Historical documents may retain old facts only when they are explicitly labelled **HISTORICAL / PROVENANCE ONLY** and point back to this file.

Agents must not:

- revive a superseded branch because an old document names it;
- treat a completed plan as an active to-do list;
- infer current Production status from historical release evidence;
- use old environment identifiers without checking this file and `ENVIRONMENTS.md`;
- reopen product scope because an old execution ledger lists unfinished historical milestones.

## Current priorities

1. Stabilise durable Founder Review access for prospect demos and screenshots.
2. Reconcile/remove stale operational documentation and secret-bearing current text.
3. Retire merged remote branches after Founder Review no longer depends on the historical launch Preview.
4. Proceed with sales, demos and website launch.
5. When the first paying customer is ready, complete MA-001, MA-003, MA-009 and MA-010, then load that customer's data only after separate approval.
