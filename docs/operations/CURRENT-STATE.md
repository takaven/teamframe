# TeamFrame Current State

**STATUS: CANONICAL CURRENT-STATE RECORD**

Last reconciled: 2026-10-17

This file is the concise first-read summary of TeamFrame's current operational status. It does not override domain-specific authorities. If current authority documents conflict, stop and reconcile them against live state before making an operational change.

## Domain authorities

- `SYSTEM-HANDOVER.md` — replacement-operator navigation and architecture map.
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

- Product functionality: **commercially launchable; product work is controlled**.
- Fix every confirmed defect and investigate credible suspected defects. Commercially valuable improvements require evidence and bounded scope; material investment, architecture, security-boundary or product-boundary changes require founder approval. Do not use the earlier feature-freeze wording to knowingly leave a defect unresolved.
- Customer-facing brand: **TeamFrame**.
- Owner: **TAKAVEN**.
- TAKAVEN is not the customer implementation/support/HR-service proposition.
- Commercial implementation can state that TeamFrame is designed to be configured and ready for handover within 48 hours once complete usable setup information and required access are available.
- Customer-facing UAE marketing wording and its limits are governed by `docs/launch/DECISIONS.md`; this operational file does not restate marketing claims.

## Public marketing website — not application Production

Publication verified 2026-10-13 and provider state rechecked 2026-10-17: `takaven/takaven-web` (`teamframe/`) is the **live authoritative commercial website source**, separate from this application repository. Vercel project `takaven-web` belongs to the `Takaven` team under `admin@takaven.com`. Current Production deployment `dpl_CTjMMHf32BSC3epnHCYJXLuLxQEf` is `READY` from website `main` `2835dafe1abe97578dd7b2733cba47d1c061ad83`. `www.takaven.com` remains verified and assigned to that project. The online enquiry `FORM_ENDPOINT` remains intentionally unset; `admin@takaven.com` is the accepted contact fallback. Website branding PR #6 (`2668ede17b6684bda451265965c9e1406fec36b9`) remains open and unmerged.

The website, application and portfolio source references were reconciled, after which the founder deleted the superseded `takaven/teamframe-site` repository. **The marketing website remains separate from** `takaven/teamframe`, Vercel `teamframe-production`, `https://app.takaven.com`, Supabase and the real-customer-data activation gates. Publishing the website does not change application readiness or customer-data authority. Canonical marketing-source and status details live in the website repository's `README.md` and `docs/WEBSITE-OPERATIONS.md`.

## Canonical source

- Repository: `takaven/teamframe`
- Protected production branch: `main`
- Source policy: protected `main` is authoritative.
- Current protected `main`: `e53d9ecee1fd53ccbcfa0e24ea8a6871c2a761cc` (**VERIFIED REPOSITORY 2026-10-17**).
- Accepted local five-PR release candidate: `b9eccb63889a3f0e561fe91b51ad4bd7f53d6d37`, tree `21ec311ed6c44f984c8f4d571a01b12b6326e556`. It is not on `main`, not deployed and not database-applied.
- Historical merged branches are not current source authority.

## Production

Production is **deployed and healthy for pre-revenue/synthetic operation**.

- Vercel project: `teamframe-production`
- Vercel project ID: `prj_09tvdrEWbL1Ov9SFMtrhgYnJ0bNj`
- Vercel owner: TAKAVEN Pro team `team_cXj0JaXqYVDGppqmiqNXIxVg`, controlled by `admin@takaven.com`. The former personal team no longer owns the project.
- Source: protected `main`
- Current Production deployment: `dpl_9qzKwWtmCYrBrUPKcbLeiHTo7yBR`, source `e53d9ecee1fd53ccbcfa0e24ea8a6871c2a761cc`, state `READY` (**VERIFIED LIVE 2026-10-17**).
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

## Accepted but unintegrated correction release — 2026-10-17

PRs #34–#38 passed independent source acceptance but remain open and unmerged. They cover administrator/policy integrity, truthful operational outcomes, dependency security, Sentry/telemetry privacy and TAKAVEN attribution. The combined local candidate reported 587 passing tests and two skipped, zero Production dependency vulnerabilities and no lost test identities. Protected-branch exact-head checks and controlled Production release remain future gates. Do not describe these corrections as deployed.

The remaining development-only advisory is `GHSA-vfj7-8cjw-p6xm` through the trusted Next.js ESLint chain (`braces@3.0.3`). It is absent from the proposed Production dependency audit. Temporary founder risk acceptance is recommended but **not recorded**. External Sentry provider receipt also remains unverified.

## Production data platform

- Supabase project: `teamframe-production-uae`
- Ref: `ttwsczpzjdjzuhchbyjx`
- Organisation: `Takaven`
- Region: Mumbai / `ap-south-1`
- Current plan: Free pre-revenue posture
- PostgreSQL: `17.6.1.171` at the last provider-settings verification
- Schema: 50/50 current public tables installed
- RLS: enabled on all 50
- Anonymous table privileges: zero
- Read-only counts (2026-10-17): one company, one employee, one membership, zero documents, zero leave rows, zero policies, two Auth users, one Storage bucket, zero Storage objects
- Data classification: synthetic/bootstrap-only application data; one unlinked non-reserved Auth identity prevents a claim of literally zero personal data
- Storage: private canonical `documents` bucket; zero objects at the checkpoint
- Pending migration: `migrations/20261016_application_integrity.sql`; its functions/triggers are absent in Production and the migration has not been applied
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

The following manual-action gates remain blocking for real customer data:

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
- Vercel owner: TAKAVEN team `team_cXj0JaXqYVDGppqmiqNXIxVg`.
- Current deployment: `dpl_GKUwv4TuJhuTdoHZS8TKsideU4Tj`, source `e53d9ecee1fd53ccbcfa0e24ea8a6871c2a761cc`, state `READY`.
- Database: 50 tables, RLS 50/50, zero anonymous table privileges; Northstar counts are recorded in `ENVIRONMENTS.md`.
- Current-main authenticated walkthrough and clean-browser login: completed in the preceding acceptance work.
- MA-002: **OPEN**. The obsolete branch-scoped override is gone, but freshness of the remaining authoritative automation secret has not been documented to the gate's standard. Authorised automation execution was intentionally not used as a harmless check because the endpoint performs business actions.

## Security hygiene

No secret values belong in Git, documentation, chat transcripts or screenshots.

Founder Review automation-secret plaintext was previously written into tracked environment documentation. The obsolete branch-scoped authority was removed; the remaining authoritative secret must still satisfy MA-002 freshness evidence. The current documentation must never repeat any value.

The Supabase CLI token named `cli_root@Ismael_1792239426` was still active at the last account-token inspection and is pending explicit revocation. A legacy Vercel token found in a historical local setup script has unverified status and is pending safe metadata-only revocation verification. Do not copy, test or publish either value.

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

1. Independently review this documentation handover PR.
2. Complete the bounded Production pre-migration backup, then separately authorise the integrity migration and one combined application release.
3. Resolve MA-002 credential-freshness evidence and the two named token-revocation follow-ups without exposing values.
4. Obtain explicit founder disposition for the development-only `braces` advisory before the combined release.
5. Proceed with sales and demos; the live website remains governed separately in `takaven/takaven-web`.
6. Before the first paying-customer data load, complete MA-001, MA-003, MA-009 and MA-010 and record the separate customer-data approval.
