# TeamFrame Deployment Runbook

This is the current deployment control document. Historical deployment evidence remains in `TEAMFRAME_PRODUCTION_RUNBOOK.md` and `docs/launch/`, but it does not authorise a current deployment.

## Source of truth

- Repository: `takaven/teamframe`
- Default/Production branch: `main`
- Accepted main SHA: `30a0a85ea4ce8d71ff1435179cd740f4e824c165`
- Retained launch/evidence branch: `launch/managed-people-ops-45-day`
- Integration vehicle: PR #6, `TeamFrame launch consolidation`, merged
- Founder Review project: `teamframe-founder-review`
- Production project: `teamframe-production` (reserved shell; rebuild required)

The Production project is a **REBUILD-ONLY HISTORICAL SHELL**. Its current Git history, deployment, variable values, cron, framework and Function region must not be treated as launch configuration. Follow [PRODUCTION-REBUILD-PLAN.md](PRODUCTION-REBUILD-PLAN.md).

Never deploy from `ismaelloveexcel/TeamFrame`, `ismaelloveexcel/teamframe.v2`, a stale local checkout, or a Vercel project selected only by name.

## Branch strategy

1. Work on one bounded branch.
2. Run focused tests during work.
3. Before integration, run `npm run verify:release` and `git diff --check`.
4. Review and merge through a protected pull request into `main`.
5. Tag the verified `main` commit for Production.
6. Deploy the exact tag/SHA and record it in [ENVIRONMENTS.md](ENVIRONMENTS.md).

`main` passed post-merge acceptance and is protected by the active `Protect main` ruleset. Pull requests are required; `Gate Chain (Strict)` and `Static Guard Suite (Phase 1D)` are required checks; force pushes and branch deletion are blocked.

## Founder Review Preview

1. Confirm the Vercel team is `ismaelloveexcels-projects`.
2. Confirm project `teamframe-founder-review` is connected to `takaven/teamframe`.
3. Confirm the deployment source is `launch/managed-people-ops-45-day`.
4. Confirm Preview variables target `dcfxyjrfsrkibhpbmjnw` and are Preview-only.
5. Push only with the applicable Preview/deployment authority.
6. Verify the deployed SHA and use the stable branch Preview URL from [ENVIRONMENTS.md](ENVIRONMENTS.md).
7. Run role-safe smoke checks; never send real external email from Review.

The default domain `teamframe-founder-review.vercel.app` currently represents an older Production deployment in the review project. Do not use it for acceptance.

## Production preflight

Stop unless every item is explicit:

- [ ] Production approval granted for this exact release and target
- [ ] GitHub `main` protection is enabled and required checks are enforced
- [ ] GitHub release SHA/tag recorded
- [ ] `teamframe-production` connected to `takaven/teamframe`
- [ ] Production branch is `main`
- [x] Production Supabase project name/ref recorded: `teamframe-production-uae` / `ttwsczpzjdjzuhchbyjx`
- [ ] Vercel and Supabase account/team verified against [ACCOUNT-OWNERSHIP.md](ACCOUNT-OWNERSHIP.md)
- [ ] local `.vercel/project.json`, if present, points to Production; no such file existed in the inventory worktree
- [ ] Production environment variable names and targets validated without exposing values
- [ ] fresh secrets generated; no Preview/rehearsal secret reused
- [x] private `documents` bucket verified
- [ ] Supabase Auth URL/redirect/SMTP configuration verified
- [ ] provider-managed database backup posture approved
- [ ] off-platform database and Storage recovery plan approved
- [ ] cron is `0 4 * * *`
- [ ] public and protected health checks prepared
- [ ] rollback deployment identified
- [ ] `npm run verify:release` passes
- [ ] `git diff --check` passes

## Production deployment

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
