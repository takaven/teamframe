# TeamFrame Deployment Runbook

**CURRENT STATUS (2026-10-10): Production rebuild COMPLETE.** Read [CURRENT-STATE.md](CURRENT-STATE.md) and [MANUAL-ACTIONS.md](MANUAL-ACTIONS.md) before any deployment operation.

Current accepted Production:
- repository: `takaven/teamframe`
- branch: protected `main`
- verified deployed SHA: `f7e9a42b0bfe7c21abe48722b2c01f82d2a0c8f9`
- Vercel project: `teamframe-production`
- verified deployment: `4XhWi9koWLXSVm9PseFQUQCCMz9`
- domain: `https://app.takaven.com`
- Supabase: `teamframe-production-uae` / `ttwsczpzjdjzuhchbyjx`
- public health: healthy
- customer data: not yet authorised; MA-001, MA-003, MA-009 and MA-010 remain

The previous rebuild-only-shell instructions are historical and must not be replayed.

## Branch strategy

1. Work on one bounded branch.
2. Run focused tests during work.
3. Before integration, run `npm run verify:release` and `git diff --check`.
4. Review and merge through a protected pull request into `main`.
5. Tag the verified `main` commit for Production.
6. Deploy the exact tag/SHA and record it in [ENVIRONMENTS.md](ENVIRONMENTS.md).

`main` passed post-merge acceptance and is protected by the active `Protect main` ruleset. Pull requests are required; `Gate Chain (Strict)` and `Static Guard Suite (Phase 1D)` are required checks; force pushes and branch deletion are blocked.

## Founder Review / Prospect Demo

Founder Review is synthetic-only and separate from Production. Current work is limited to stabilising a durable current-main login. Until that passes fresh-context repeat-login acceptance, retain the known historical Preview fallback. Do not weaken authentication, use customer data, or copy Founder Review configuration into Production.

## Future Production change preflight

Stop unless every item is explicit:

- [ ] Production approval granted for this exact release and target
- [ ] GitHub `main` protection is enabled and required checks are enforced
- [ ] GitHub release SHA/tag recorded
- [x] `teamframe-production` connected to `takaven/teamframe`
- [x] Production branch is `main`
- [x] Production Supabase project name/ref recorded: `teamframe-production-uae` / `ttwsczpzjdjzuhchbyjx`
- [ ] Vercel and Supabase account/team verified against [ACCOUNT-OWNERSHIP.md](ACCOUNT-OWNERSHIP.md)
- [ ] local `.vercel/project.json`, if present, points to Production; no such file existed in the inventory worktree
- [ ] Production environment variable names and targets validated without exposing values
- [x] Production runtime secrets/configuration completed and accepted
- [x] private `documents` bucket verified
- [x] Supabase Auth URL/redirect/SMTP configuration verified
- [ ] provider-managed database backup posture approved
- [ ] off-platform database and Storage recovery plan approved
- [x] cron configured at the approved Production cadence
- [x] public health is healthy; protected deep health denies unauthorised access
- [ ] rollback deployment identified
- [ ] `npm run verify:release` passes
- [ ] `git diff --check` passes

## Production deployment / change procedure

Production is already deployed. Use this procedure only for a separately approved future Production change.

1. Verify the Vercel team/project and the target Supabase ref again.
2. Configure Production variables from their authoritative providers. Do not copy Founder Review values.
3. Install the canonical schema only into a new, empty, approved Production project using the guarded fresh-install path.
4. Configure private Storage and Auth/SMTP.
5. Deploy the exact approved release SHA/tag to `teamframe-production`.
6. Confirm the deployment UI reports that exact SHA and `main`/tag source.
7. Run the post-deploy checks below.
8. Record URL, deployment ID, SHA, Supabase ref, backup state, and smoke result in the environment registry.

Do not manually repair a partial fresh installation. If the empty pre-live target fails, quarantine it and seek a fresh decision.

## Environment validation

Validate names and target identity, not merely presence:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_DB_URL` for controlled release operations
- `SITE_URL`
- `DEEP_HEALTH_SECRET`
- `TEAMFRAME_AUTOMATION_SECRET`
- `CRON_SECRET` matching the automation secret where Vercel Cron is used
- `RESEND_API_KEY`
- `TEAMFRAME_EMAIL_FROM`
- Sentry variables or a documented log-only decision

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
- One safe authorised automation run succeeds and remains idempotent.
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