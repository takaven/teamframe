# TeamFrame Current State

**STATUS: CANONICAL CURRENT-STATE RECORD**

Last reconciled: 2026-10-14

This file is the concise first-read summary of TeamFrame's current operational status. It does not override domain-specific authorities. If current authority documents conflict, stop and reconcile them against live state before making an operational change.

## Domain authorities

- `CURRENT-STATE.md` — concise current operational status and remaining launch boundary.
- `ENVIRONMENTS.md` — authoritative infrastructure identities.
- `MANUAL-ACTIONS.md` — authoritative outstanding founder/account-owner actions.
- `DEPLOYMENT.md` — authoritative current deployment/change procedure.
- `TEAMFRAME_ACCESS_MODEL.md` — customer deployment and access model.
- `TEAMFRAME_MANAGED_PEOPLE_OPS_SCOPE.md` and `docs/launch/DECISIONS.md` — current product/commercial positioning and founder-approved decisions.
- completed plans, launch ledgers and historical release records — provenance only.

If these current authority documents disagree, do not choose one mechanically. Verify the live state and reconcile the documents before proceeding.

Do not infer current production status from an old launch branch, old SHA, historical Vercel deployment, retired Supabase project, or superseded launch plan.

## Product

- Product functionality: **COMPLETE / FROZEN**.
- Product changes require a genuine production defect, a demonstrated first-customer blocker, repeated customer evidence, or a separately founder-approved bounded improvement.
- Customer-facing brand: **TeamFrame**.
- Owner: **TAKAVEN**.
- TAKAVEN is not the customer implementation/support/HR-service proposition.
- Commercial implementation can state that TeamFrame is designed to be configured and ready for handover within 48 hours once complete usable setup information and required access are available.
- Customer-facing UAE marketing wording and its limits are governed by `docs/launch/DECISIONS.md`; this operational file does not restate marketing claims.

## Public marketing website — not application Production

Publication verified 2026-10-13 and documentation rechecked 2026-10-14: `takaven/takaven-web` (`teamframe/`) is the **live authoritative commercial website source**, separate from this application repository. Vercel project `takaven-web` belongs to the `Takaven` team under `admin@takaven.com`. The last behaviour-changing website baseline is `56f9184b04caf5a816718a8f1318b8fbfbf99d62`; subsequent documentation-only reconciliation is deployed from current website `main` (verified Production deployment source `46651a099bb18d497cac88983f1ddb4bbeed241a`, state `READY`). `https://www.takaven.com/` redirects to `/teamframe/`; the website, privacy page, navigation and HR Setup Check passed browser verification over valid HTTPS. Authoritative and public DNS return `www.takaven.com CNAME 10074f97bb5aebf8.vercel-dns-017.com`, and the Vercel ownership TXT record is present. The online enquiry `FORM_ENDPOINT` remains intentionally unset; `admin@takaven.com` is the accepted contact fallback.

The website, application and portfolio source references were reconciled, after which the founder deleted the superseded `takaven/teamframe-site` repository. **The marketing website remains separate from** `takaven/teamframe`, Vercel `teamframe-production`, `https://app.takaven.com`, Supabase and the real-customer-data activation gates. Publishing the website does not change application readiness or customer-data authority. Canonical marketing-source and status details live in the website repository's `README.md` and `docs/WEBSITE-OPERATIONS.md`.

## Canonical source

- Repository: `takaven/teamframe`
- Protected production branch: `main`
- Source policy: protected `main` is authoritative.
- Last verified behaviour-changing application baseline: `3865ec2ea9ee37bfdefbb95d45214e48038ce784` (PR #31 merge, containing the preceding PR #30 correction). Later `main` commits may be documentation-only; protected `main` remains authoritative and must be re-read before operational changes.
- Historical merged branches are not current source authority.

## Production

Production is **deployed and healthy for pre-revenue/synthetic operation**.

- Vercel project: `teamframe-production`
- Vercel project ID: `prj_09tvdrEWbL1Ov9SFMtrhgYnJ0bNj`
- Source: protected `main`
- Last verified functional deployment checkpoint: Vercel `dpl_HvXQpY2dXUoFRAU3smBfLdacN9Xq`, source `3865ec2ea9ee37bfdefbb95d45214e48038ce784`; deployment completed successfully and the public root plus `/api/health` returned HTTP 200 at correction-workstream closure.
- Subsequent documentation-only Production checkpoint (2026-10-14): Vercel `dpl_FeYRCZhuDbEHFubc8QywZ2WDnj56`, source `bf51addc33231e8d1abb21d61c56834a72c20679`, state `READY`. This did not change application behaviour.
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

These exact identifiers are dated evidence, not permanent current state. Reverify the live GitHub, Vercel and Supabase targets before any operational write.

## Recent bounded correction closure — 2026-10-13

The independent six-finding correction workstream is **CLOSED**. PR #30 corrected offboarding date propagation, leave approval override propagation and unchecked employee-upload permission mapping. PR #31 corrected confirmed fragment-aware feedback redirects, restored `.test.tsx` discovery and neutralised unconfirmed magic-link delivery wording while preserving anti-enumeration behaviour.

- PR #30 merge: `b0e4be709f6e8e4d474b88768b00efb0f0e2e67f`.
- PR #31 / final functional baseline: `3865ec2ea9ee37bfdefbb95d45214e48038ce784`.
- Required Gate Chain, Static Guard, typecheck, lint, tests and production build passed.
- Final reported suite after TSX discovery: 568 passed, 2 skipped.
- Vercel Production and Founder Review checks passed.
- No Supabase schema, Production data, customer data or product-scope expansion was part of these fixes.
- Detailed runtime-log inspection was unavailable at closure; exact-SHA deployment success plus public root and health smoke checks were verified. Do not reinterpret that limitation as evidence of a runtime failure.

This correction did **not** reopen product development. The normal feature-freeze rules remain in force.

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
2. Complete MA-002 credential rotation and consolidation before stable Founder Review / prospect-demo acceptance.
3. Retire merged remote branches after Founder Review no longer depends on the historical launch Preview.
4. Proceed with sales and demos; the TeamFrame marketing website is live. Website changes remain governed separately in `takaven/takaven-web`.
5. When the first paying customer is ready, complete MA-001, MA-003, MA-009 and MA-010, then load that customer's data only after separate approval.
