# TeamFrame Deployment Runbook

**CURRENT STATUS (2026-10-17): Production is healthy on the existing `main`; a six-PR combined release and one integrity migration are prepared but not released.** Read [SYSTEM-HANDOVER.md](SYSTEM-HANDOVER.md), [CURRENT-STATE.md](CURRENT-STATE.md) and [MANUAL-ACTIONS.md](MANUAL-ACTIONS.md) before any deployment operation.

Current accepted Production:
- repository: `takaven/teamframe`
- branch: protected `main`
- source policy: protected `main`
- Vercel team: `Takaven` / `team_cXj0JaXqYVDGppqmiqNXIxVg`, controlled by `admin@takaven.com`
- last verified source checkpoint (2026-10-17): `e53d9ecee1fd53ccbcfa0e24ea8a6871c2a761cc`
- Vercel project: `teamframe-production`
- last verified deployment checkpoint (2026-10-17): `dpl_9qzKwWtmCYrBrUPKcbLeiHTo7yBR`, `READY`
- domain: `https://app.takaven.com`
- Supabase: `teamframe-production-uae` / `ttwsczpzjdjzuhchbyjx`
- public health: healthy
- customer data: not yet authorised; MA-001, MA-003, MA-009 and MA-010 remain

The previous rebuild-only-shell instructions are historical and must not be replayed. Before any operational write, re-verify the live provider state rather than assuming the dated checkpoint above is still current.

Prepared release state:

- accepted source PRs #34–#39 remain open and unmerged;
- the accepted five-PR checkpoint (`b9eccb63889a3f0e561fe91b51ad4bd7f53d6d37`, tree `21ec311ed6c44f984c8f4d571a01b12b6326e556`) is the assembly base for draft branch `release/six-pr-candidate`, which adds accepted PR #39; the draft release PR is authoritative for the exact combined head/tree;
- pending existing-install migration `migrations/20261016_application_integrity.sql` is not applied;
- do not merge the six source PRs independently into Git-connected `main`, because each merge could publish a partial Production version.

## Branch strategy

1. Work on one bounded branch.
2. Run focused tests during work.
3. Before integration, run `npm run verify:release` and `git diff --check`.
4. Review and merge through a protected pull request into `main`.
5. For the prepared correction programme, use one combined protected release PR containing the exact accepted tree; do not publish the six source PRs sequentially.
6. Merge only after the database backup/migration sequence and release approval are explicit. Git-connected `main` will normally deploy automatically.
7. Record the resulting deployment ID/SHA and health in [ENVIRONMENTS.md](ENVIRONMENTS.md).

`main` passed post-merge acceptance and is protected by the active `Protect main` ruleset. Pull requests are required; `Gate Chain (Strict)` and `Static Guard Suite (Phase 1D)` are required checks; force pushes and branch deletion are blocked.

`teamframe-production` is Git-connected to protected `main`. Merging an approved pull request may therefore trigger the normal Vercel Production deployment automatically. A documentation-only change performs no manual deployment or provider-configuration operation, but its merge must not be described as having zero deployment effect; verify the resulting deployment SHA and health after merge.

## Founder Review / prospect demo

Founder Review is synthetic-only and separate from Production. Current-main deployment, clean-browser login and the authenticated walkthrough have passed; MA-002 credential-freshness evidence remains open. Do not invoke authorised automation as a harmless auth check because the route runs automation/digest/reminder logic. Do not weaken authentication, use customer data, or copy Founder Review configuration into Production.

## Future Production change preflight

Stop unless every item is explicit:

- [ ] Production approval granted for this exact release and target
- [ ] GitHub `main` protection is enabled and required checks are enforced
- [ ] GitHub release SHA/tag recorded
- [x] `teamframe-production` connected to `takaven/teamframe`
- [x] Production branch is `main`
- [x] Production Supabase project name/ref recorded: `teamframe-production-uae` / `ttwsczpzjdjzuhchbyjx`
- [ ] Vercel and Supabase account/team/access verified against [ACCOUNT-OWNERSHIP.md](ACCOUNT-OWNERSHIP.md)
- [ ] local `.vercel/project.json`, if present, points to Production; no such file existed in the inventory worktree
- [ ] Production environment variable names and targets validated without exposing values
- [x] Production runtime secrets/configuration completed and accepted
- [x] private `documents` bucket verified
- [x] Supabase Auth URL/redirect/SMTP configuration verified
- [ ] bounded pre-migration logical backup completed and verified for this release
- [ ] provider-managed database backup posture approved before real customer data
- [ ] off-platform database and Storage recovery plan approved
- [x] cron configured at the approved Production cadence
- [x] public health is healthy; protected deep health denies unauthorised access
- [ ] rollback deployment identified
- [ ] `npm run verify:release` passes
- [ ] `git diff --check` passes

## Prepared integrity release procedure

Production is already deployed. The next authorised release must follow this sequence; each write remains a separate founder gate:

1. Reverify GitHub heads, Vercel team/project/domain, Production SHA and Supabase ref.
2. Complete the approved encrypted pre-migration backup in [BACKUP-RECOVERY.md](BACKUP-RECOVERY.md).
3. Review and authorise `migrations/20261016_application_integrity.sql`; apply it once as the existing-install migration, never the fresh installer.
4. Verify the two protective functions/triggers and confirm the currently deployed application remains healthy.
5. Publish one combined release branch/PR matching the accepted candidate tree plus any separately accepted documentation status update.
6. Require protected exact-head GitHub checks and Preview checks.
7. Record the founder disposition for the development-only `braces` advisory.
8. Merge the one combined PR into protected `main`; do not manually deploy unless the normal Git-connected deployment fails and separate approval is given.
9. Confirm Vercel Production is `READY` at the exact merged SHA and `app.takaven.com` remains assigned.
10. Run the bounded post-deploy checks and record the result.

Application rollback may promote the prior known-good deployment. The protective database migration is not automatically removed during an application rollback; any database rollback needs independent review and separate approval.

### Required post-release documentation reconciliation

After—and only after—the combined release is merged and the exact Production deployment is `READY` and healthy:

1. Update [ENVIRONMENTS.md](ENVIRONMENTS.md) with the merged `main` SHA, Vercel deployment IDs, state, health result and verification date for Production and Founder Review.
2. Update [CURRENT-STATE.md](CURRENT-STATE.md) and [SYSTEM-HANDOVER.md](SYSTEM-HANDOVER.md) to move PRs #34–#39 and the combined candidate from “accepted/unintegrated” to the evidence-backed deployed state. Preserve the former SHA/deployment as a dated historical rollback checkpoint.
3. Record whether `migrations/20261016_application_integrity.sql` was applied and its verified trigger/function result; never infer migration success from the application deployment.
4. Update the release decision/ledger with the combined PR, merge SHA, deployment IDs, smoke evidence, unresolved gates and rollback target.
5. Close or supersede the six source PRs only after their changes are confirmed in protected `main`; retain their review history.

Do not pre-fill future SHAs, deployment IDs, migration results or health outcomes.

## Configuration and secret-location register

Validate names and target identity, not merely presence. Never retrieve values for routine inventory.

| Variable(s) | Purpose | Required where | Authoritative location | Safe validation/rotation |
| --- | --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser Supabase project identity/public client | Application Production; Founder Review; local development | Vercel project env or local `.env.local`; source is exact Supabase project | Compare URL ref/project and public-key metadata without printing value; rotate project key only under Supabase/Vercel coordinated approval |
| `SITE_URL` | Canonical application origin and auth links | Application Production; Founder Review; local | Vercel project env; Supabase Auth URL settings must align | Compare HTTPS origin and Auth redirects; update both providers in one approved window |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only privileged operations | Application Production; Founder Review; authorised scripts | Vercel sensitive env or process memory; generated by exact Supabase project | Confirm server-only scope and exact ref; rotate in Supabase, update affected Vercel project, redeploy and smoke |
| `SUPABASE_DB_URL` and command-specific DB URL names | Migration/inspection scripts; not application runtime | Operator process only | Supabase connection settings → masked process memory/secure operator store | Validate host/ref and TLS; never store in Vercel/Git; rotate database password under separate approval |
| `DEEP_HEALTH_SECRET` | Protect `/api/health/deep` | Application Production; Founder Review | Vercel sensitive env | Confirm unauthorised denial; use authorised check only in a bounded acceptance; replace/redeploy if exposed |
| `TEAMFRAME_AUTOMATION_SECRET` | Protect `/api/automation/run` | Application Production; Founder Review | Vercel sensitive env | Confirm unauthorised denial. Authorised invocation has business side effects; do not use merely as an auth probe |
| `CRON_SECRET` | Vercel Cron bearer secret; must match automation secret in Production | Application Production only | Vercel sensitive env | `npm run env:check:production` can test equality without printing; rotate with automation secret and verify scheduled path |
| `RESEND_API_KEY`, `TEAMFRAME_EMAIL_FROM` | Transactional application email | Application Production; optional by environment | Vercel env; source authority is Resend account/sending domain | Inspect key scope/sender without revealing key; rotate in Resend/Vercel and run an approved delivery test |
| `TEAMFRAME_REVIEW_PASSWORD_AUTH` | Enables Founder Review password route | Founder Review only | Vercel sensitive env | Confirm boolean/config presence and clean-browser login; do not store founder password in Vercel docs/Git |
| `VERCEL_PREVIEW_FEEDBACK_ENABLED` | Preview feedback UI setting | Founder Review Preview only | Vercel project env | Confirm target is Preview; no secret value is needed in docs |
| `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN` | Server/client error capture | Optional, paired | Vercel env or local; source authority is Sentry project | Keep both absent or both configured; validate a synthetic event only under authorised provider access |
| `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` | Build-time source-map upload | Optional build configuration | Vercel env/secure CI; source authority is Sentry | Token is server/build-only; rotate in Sentry and verify one approved build |
| `SENTRY_DEBUG` | Temporary instrumentation diagnostics | Optional, non-Production by default | Vercel/local | Enable only for a bounded diagnostic and remove afterward |
| `NEXT_PUBLIC_PILOT_CONTACT_EMAIL` | Optional landing-page contact CTA | Optional | Vercel env | Public by design; verify displayed address |
| `TEAMFRAME_HIRE_BRIDGE_ENABLED`, `TEAMFRAME_HIREPASS_SOURCE_NAMESPACE` | Optional bounded Hire→People handoff | Only where explicitly configured | Vercel env or local operator configuration | Confirm feature flag and namespace against the approved integration; no cross-database sync is implied |

Fresh-install, bootstrap, audit, cleanup and customer-implementation commands use additional command-specific values documented in `.env.example` and the relevant scripts. They must remain in process memory/approved secure operator storage and retain their exact-target approval guards.

| Operator/CI variables | Purpose and safe location |
| --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY_CI`, `SUPABASE_DB_URL_CI` | Separate CI-only Supabase target; GitHub Actions/approved CI secrets only |
| `SUPABASE_ACCESS_TOKEN` | Supabase CLI/Management API login; short-lived operator secret store/process memory; revoke after bounded use |
| `TEAMFRAME_INSTALL_PROJECT_REF`, `TEAMFRAME_INSTALL_SUPABASE_URL`, `TEAMFRAME_INSTALL_DB_URL`, `TEAMFRAME_INSTALL_SERVICE_ROLE_KEY`, `TEAMFRAME_INSTALL_APPROVAL` | Guarded fresh-install/storage command; exact approved empty target and process memory only |
| `FULL_ACCESS_EMAIL`, `FULL_ACCESS_PASSWORD`, `FULL_ACCESS_NAME`, `TEAMFRAME_TENANT_ID`, `TEAMFRAME_TENANT_SLUG`, `TEAMFRAME_TENANT_NAME`, `TEAMFRAME_CREATE_ONLY_BOOTSTRAP`, `TEAMFRAME_ENV_FILE` | Full Access bootstrap/recovery; authorised operator process only; never Vercel runtime defaults |
| `TEAMFRAME_IMPLEMENTATION_PROJECT_REF`, `TEAMFRAME_IMPLEMENTATION_DB_URL`, `TEAMFRAME_IMPLEMENTATION_APPROVAL`, `TEAMFRAME_IMPLEMENTATION_CONTEXT` | Guarded customer-implementation/rehearsal command; approved target and process memory only |
| `TEAMFRAME_FACTORY_PROJECT_REF`, `TEAMFRAME_FACTORY_DB_URL`, `TEAMFRAME_FACTORY_APPROVAL`, `TEAMFRAME_FACTORY_BOOTSTRAP_APPROVAL` | Disposable factory measurement/bootstrap; authorised synthetic target only |
| `AUDIT_SUPABASE_PROJECT_REF`, `AUDIT_SUPABASE_URL`, `AUDIT_SUPABASE_ANON_KEY`, `AUDIT_SUPABASE_SERVICE_ROLE_KEY`, `AUDIT_SUPABASE_DB_URL`, `TEAMFRAME_AUDIT_INTEGRATION` | Disposable integration/RLS proof; CI/operator secret store and approved synthetic target only |
| `TEAMFRAME_MUTATION_PROJECT_REF`, `TEAMFRAME_MUTATION_APPROVAL` | Exact-target guard shared by mutation-capable verification commands |
| `EXPORT_CLEANUP_SUPABASE_URL`, `EXPORT_CLEANUP_SERVICE_ROLE_KEY`, `EXPORT_CLEANUP_TENANT_ID`, `EXPORT_CLEANUP_ACTOR_USER_ID` | Bounded expired-export cleanup; authorised operator process only |
| `SUPABASE_URL_STAGING`, `SUPABASE_DB_URL_STAGING`, `ALLOW_DESTRUCTIVE_RESET`, `ALLOW_DESTRUCTIVE_RESET_IN_CI`, `PROTECTED_DB_HOST_TOKENS` | Historical/staging reset guards. Never use against Production; destructive approval remains command- and target-specific |

The table records names and authority, not values. The relevant script is authoritative for exact required/optional combinations at execution time.

Never reveal values during routine inventory. A variable name is not proof that its value points to the correct environment.

## Post-deploy smoke tests

- Public application and login load.
- Unauthenticated protected routes are denied.
- Full Access core routes render.
- Manager sees direct-report scope only.
- Employee sees own data only.
- Finance sees payroll export only.
- Private file access is authorised and tenant-scoped.
- Public health is safe; protected deep health succeeds only with the secret.
- Unauthorised automation invocation is denied.
- Authorised automation execution is optional, not an unconditional smoke requirement: run it only with separate explicit approval and a bounded synthetic or otherwise approved test case because it performs business operations. When intentionally withheld, record `NOT VERIFIED` rather than treating the release as failed or claiming execution evidence.
- Email uses the approved Production provider/domain only.
- Deployed SHA, Production domain, and Supabase ref match the registry.

## Rollback

Application rollback:

1. stop rollout;
2. promote the prior known-good Vercel deployment or redeploy the prior release tag;
3. re-run health, auth, role, file, and automation smoke checks;
4. record the incident and resulting SHA.

Database recovery:

- do not run destructive restore against Production;
- restore to a separate approved project;
- verify row counts, RLS, Auth, Storage, and application behaviour;
- cut over Vercel only after explicit approval;
- retain the old project until the incident closes.

See [BACKUP-RECOVERY.md](BACKUP-RECOVERY.md).

## Approval boundaries

Explicit approval is required for:

- any Production deploy or promotion;
- Production Git connection/configuration changes;
- Production project creation or paid plan;
- DNS, email-domain, or SMTP changes;
- secrets/keys creation or rotation;
- destructive database/project/repository cleanup;
- database restore/cutover;
- loading real customer data.

Founder-interactive steps should be grouped rather than interrupting independent preparation. Their exact prerequisites and status are maintained in [MANUAL-ACTIONS.md](MANUAL-ACTIONS.md). The non-secret Production specification and environment-variable manifest are in [PRODUCTION-PREPARATION.md](PRODUCTION-PREPARATION.md).
