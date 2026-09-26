# TeamFrame Production Runbook

> **HISTORICAL TECHNICAL RELEASE PROVENANCE — NOT CURRENT MANAGED-SERVICE LAUNCH APPROVAL.** Historical GO statements and release SHA below describe an earlier technical release. Current commercial scope and launch approval are controlled by [managed scope](TEAMFRAME_MANAGED_PEOPLE_OPS_SCOPE.md), [45-day plan](docs/launch/TEAMFRAME_45_DAY_EXECUTION_PLAN.md), and [execution ledger](docs/launch/EXECUTION_LEDGER.md). M1 production trust remains open until live security, email and restore gates pass; historical PASS rows are not current evidence.

**STATUS: CURRENT OPERATIONS REFERENCE — FIRST-CUSTOMER RELEASE BLOCKED PENDING THE LIVE GATES BELOW**

This runbook governs TeamFrame production release, production operations and bounded smoke verification.

Do not include secret values in this file.

## 1. Production Status

Frozen product/UI source: `takaven/teamframe`, branch
`launch/managed-people-ops-45-day`, SHA
`e9790370ba1a4526cfd29553c33dc288a46e27bc` at the 2026-09-26 checkpoint.

First-customer backend verdict at that checkpoint:

> **NOT YET READY**

The production Vercel project exists but serves historical SHA `37bf104...`
from a different repository/branch and has no current Git connection. Its Cron
is `0 6 * * *`, email-provider and Sentry variables are absent, and the recorded
Supabase ref `zylllrvcmockvfcfubkp` is not visible in the signed-in TAKAVEN
organization. Do not promote, reconnect, rotate, or replace these resources
without the production approval gate.

Production deployment must use an explicitly identified production Vercel project and production Supabase project. Founder-review, staging, CI and disposable projects must not be treated as production.

## 2. Production Architecture

| Layer | Production responsibility |
| --- | --- |
| Application hosting | Vercel production project for TeamFrame |
| Database | Supabase Postgres production project |
| Authentication | Supabase Auth in the production project |
| File storage | Supabase Storage private `documents` bucket |
| Authorization | Server-side RBAC, service-layer authorization, Supabase RLS |
| Deployment ownership | Customer installation owner / Full Access operator with infrastructure authority |
| Background automation | Protected `/api/automation/run` runner invoked by approved scheduler |
| Observability | Public health, protected deep health, Sentry where configured, deployment logs |
| Source control | GitHub repository and release tag |

## 3. Production Targets

Before deployment, record:

| Target | Required record |
| --- | --- |
| Vercel project | Production project name, project ID and production domain |
| Supabase project | Production project name and project ref |
| GitHub repository | Remote URL and release branch |
| Scheduler | Vercel Cron or equivalent trusted scheduler |
| Observability | Sentry org/project or documented decision to run without Sentry |

The local `.vercel/project.json` must be inspected before deployment. If it points to founder-review or another non-production project, do not deploy from that link.

### 2026-09-26 read-only inventory

| Target | Observed state | Gate |
| --- | --- | --- |
| Vercel | `teamframe-production`; `https://teamframe-production.vercel.app`; Hobby | Exists |
| Deployed source | SHA `37bf104...`; `ismaelloveexcel/TeamFrame`; `codex/market-ready-implementation` | **FAIL — not current source** |
| Git connection | No connected repository | **FAIL** |
| Supabase | Recorded ref `zylllrvcmockvfcfubkp`; not visible in signed-in TAKAVEN organization | **FAIL — identity/access unverified** |
| Scheduler | Enabled, `/api/automation/run`, `0 6 * * *` | **FAIL — launch schedule is `0 4 * * *`** |
| Domain | Default Vercel domain only | Condition for founder decision |
| Email | Provider variables absent from Production | **FAIL** |
| Error tracking | Sentry variables absent from Production | **FAIL unless an explicit log-only decision is accepted and tested** |

## 4. Environment Variable Register

| Variable | Purpose | Required in Production | Client/Server | Source |
| --- | --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Yes | Client + server | Production Supabase API settings |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase public anon key | Yes | Client + server | Production Supabase API settings |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side privileged Supabase operations | Yes | Server only | Production Supabase API settings |
| `SUPABASE_DB_URL` | Migration and verification database connection | Yes for release operations | Server/script only | Production Supabase database settings |
| `SITE_URL` | Auth redirects and absolute application URL | Yes | Server | Production application URL |
| `DEEP_HEALTH_SECRET` | Protected `/api/health/deep` authorization | Yes | Server only | Generated fresh for production |
| `TEAMFRAME_AUTOMATION_SECRET` | Protected automation runner authorization | Yes | Server only | Generated fresh for production |
| `CRON_SECRET` | Vercel Cron bearer authorization; same value as automation secret | Yes when using Vercel Cron | Server only | Generated fresh for production |
| `RESEND_API_KEY` | Transactional email delivery | Yes for customer notifications | Server only | Email provider |
| `TEAMFRAME_EMAIL_FROM` | Verified production sender | Yes for customer notifications | Server only | Verified sending domain |
| `SENTRY_DSN` | Server-side Sentry reporting | Production recommended | Server | Sentry project |
| `NEXT_PUBLIC_SENTRY_DSN` | Client-side Sentry reporting | Production recommended | Client | Sentry project |
| `SENTRY_AUTH_TOKEN` | Optional source-map upload during build | Optional | Build secret | Sentry |
| `SENTRY_ORG` | Optional Sentry source-map config | Optional | Build config | Sentry |
| `SENTRY_PROJECT` | Optional Sentry source-map config | Optional | Build config | Sentry |
| `NEXT_PUBLIC_PILOT_CONTACT_EMAIL` | Landing-page contact CTA | Optional | Client | Product owner |
| `SUPABASE_ACCESS_TOKEN` | Supabase management/CLI operations | Operator only, not runtime | Local/CI secret | Supabase account token |
| `SEED_ADMIN_PASSWORD` | One-time bootstrap admin password | Bootstrap only | Local shell/env only | Generated for intended admin |
Never commit `.env`, `.env.local`, production credential files, screenshots containing tokens or provider dashboards containing secrets.

## 5. Supabase Setup

1. Identify or create the intended TeamFrame production Supabase project.
2. Confirm it is not TeamFrame-CI, founder-review, staging or a disposable verification project.
3. Configure production environment variables outside the repository.
4. For a **new, empty, isolated project only**, use the guarded one-time fresh installer after exact project identity and the relevant founder/customer-deployment approval are confirmed. The current allowlist contains only named TAKAVEN disposable projects; a first customer ref requires founder approval and a separately reviewed allowlist change. Provide `TEAMFRAME_INSTALL_PROJECT_REF`, `TEAMFRAME_INSTALL_SUPABASE_URL`, `TEAMFRAME_INSTALL_DB_URL` and `TEAMFRAME_INSTALL_APPROVAL=fresh:<project-ref>` in process memory; do not commit secrets. Preflight with `--check-target` before connecting:

```bash
npm run db:install:fresh -- --check-target
npm run db:install:fresh
```

5. **Do not replay the schema pack.** The installer requires zero public tables, auth users and stored objects, applies the canonical order once, then verifies public-table RLS and required objects. If a fresh installation fails midway **before any live/customer data exists**, treat that project as failed: confirm it contains no real data, discard/recreate the isolated project, correct the defect, and run the installer from zero on the replacement. Do not manually resume partial SQL. For an **existing customer project**, stop and use a separately reviewed, versioned migration path; none is approved by this runbook today.

6. Configure and verify the private storage bucket only against the same approved project using a process-only `TEAMFRAME_INSTALL_SERVICE_ROLE_KEY`. The helper refuses to overwrite an existing bucket with different settings:

```bash
npm run storage:setup:fresh -- --check-target
npm run storage:setup:fresh
```

7. Apply the committed Supabase auth configuration with the Supabase CLI against the approved project.
8. Run live access/restore checks separately. The authorised-disposable integration/RLS scripts are not production verification commands.

Do not seed synthetic tenants, employees or visual-audit fixtures into production.

## 6. Full Access Provisioning / Recovery

Production does not use ordinary open signup, Platform Owner, `/platform` or a central TeamFrame operator runtime.

Inside an independent customer installation, `Full Access` is the highest in-product authority. Customer Full Access/Admin users are provisioned through the access/provisioning model or controlled setup flow.

A narrow infrastructure-side bootstrap remains available for controlled recovery only when the operator already has legitimate access to the customer's Supabase/Vercel infrastructure:

```bash
SEED_ADMIN_PASSWORD='<production-admin-password>' npm run seed:admin -- admin@example.com "Admin Name" "Founder" "Leadership" "UTC"
```

Use the real intended administrator details. Do not record the password in documentation, Git history or chat.

## 7. Vercel Deployment

1. Confirm the production Vercel project and domain.
2. Ensure `.vercel/project.json` points to the production project before deploying, or deploy with an explicit production project target.
3. Configure production environment variables in Vercel.
4. Deploy the exact verified release source or release tag.
5. Confirm the deployed SHA matches the release source.

Do not deploy from or to the founder-review Vercel project unless it has explicitly been retired and recreated as production, with that decision recorded.

## 8. Automation Runner / Cron

The production automation runner is:

`/api/automation/run`

Authorization:

- `x-teamframe-automation-secret: <TEAMFRAME_AUTOMATION_SECRET>`; or
- `Authorization: Bearer <TEAMFRAME_AUTOMATION_SECRET>`.

Vercel Cron invokes the endpoint with `Authorization: Bearer $CRON_SECRET`. Set `CRON_SECRET` to the same generated production value as `TEAMFRAME_AUTOMATION_SECRET`.

Production scheduler requirements:

- invoke the production URL only;
- use the server-only automation secret;
- record the configured cadence during release;
- deny unauthorised invocation;
- rely on the locked idempotency and retry model.

Do not create a founder-facing workflow-rule editor.

Initial production cadence:

- `0 4 * * *` daily at 04:00 UTC (approximately 08:00 UAE).

Per-customer local scheduling remains a post-revenue enhancement. The daily
cadence is compatible with the current Vercel Hobby schedule limits.

## 9. Health Checks

Public shallow health:

`GET /api/health`

Protected deep health:

`GET /api/health/deep`

Protected deep health requires:

`x-teamframe-health-secret: <DEEP_HEALTH_SECRET>`

The deep health endpoint checks database, storage and auth connectivity. Do not send health secrets in query strings.

## 10. Observability

Before production use, confirm:

- deployment logs show a clean boot;
- public health returns expected status;
- protected deep health returns expected subsystem status;
- Sentry DSNs are configured or a deliberate no-Sentry decision is recorded;
- no secrets or unnecessary PII are emitted in logs.

## 11. Backup / Recovery

Before production migrations, create a fresh logical production database backup/export using the supported Supabase CLI/`pg_dump` path and record:

- timestamp;
- source project ref;
- secure backup location;
- successful completion;
- restore procedure.

Do not print database credentials. Do not commit the backup.

Before first real customer HR data, confirm:

- provider-managed daily backups are enabled on the production Supabase project;
- retention period where known;
- recovery owner;
- recovery procedure;
- whether PITR or provider-managed backup is enabled;
- whether any non-destructive recovery verification has been performed.

If the production project is on a tier without provider-managed daily backups at first-customer activation, upgrade production before loading real customer HR data.

PITR is not required for initial launch.

Do not run destructive restore tests against production.

## 12. Secret Rotation

Use fresh production credentials for:

- Supabase service role;
- Supabase database connection;
- `TEAMFRAME_AUTOMATION_SECRET`;
- `DEEP_HEALTH_SECRET`;
- Sentry/source-map token where used;
- email/provider credentials where used.

Rotate any credential that was previously exposed, reused in verification, copied into historical material or cannot be confidently treated as clean.

## 13. Pre-Deployment Gate

Run before release tag or deployment:

```bash
npm run verify:release
git diff --check
```

Everything must pass before deployment.

## 14. Post-Deployment Smoke Test

Use production-safe bootstrap/admin paths. Do not contaminate production with synthetic customers or test employees unless an explicitly supported removable test tenant exists.

Minimum smoke checks:

| Area | Check |
| --- | --- |
| Public/auth | App loads; login works; unauthenticated protected route denied |
| Admin | Dashboard, employees, Org Chart, onboarding, policies, leave and setup state render |
| Employee self-service | `/me` renders where safe and permissions remain scoped |
| Files | Storage integration responds correctly |
| Automation | Unauthorised runner call denied; one safe authorised no-op/current-cycle invocation succeeds |
| Export | Export service initializes without false-success metadata |
| Health | Public and protected health behave as expected |
| Security | Anonymous admin access denied; employee/admin/manager boundaries remain intact where safe to test |

## 15. Rollback

Application rollback:

- promote the previous known-good Vercel deployment; or
- redeploy the previous release tag.

Database rollback:

- use Supabase provider backup/recovery mechanisms;
- do not manually patch production data unless a specific incident procedure is approved;
- do not perform destructive restore without product-owner approval.

## 16. Operational Failure Checks

After deployment inspect:

- deployment logs;
- health;
- Sentry;
- automation runner result;
- storage access;
- auth configuration;
- export generation/retrieval.

Stop rollout if there is an immediate server exception loop, migration error, auth configuration error, provider credential failure, automation authentication failure or obvious 5xx on core routes.

## 17. Historical Release Provenance

Record after successful release:

| Field | Value |
| --- | --- |
| Release date | 2026-08-13 |
| Latest release date | 2026-08-14 |
| Release tag | Pending after local/GitHub finalisation |
| Deployed application SHA | `37bf104b5d72f81f9936a99ac3134c14bd2de7a5` |
| Documentation commit SHA | Current documentation/provenance commit |
| Vercel project/domain | `teamframe-production` / `https://teamframe-production.vercel.app` |
| Vercel deployment identifier | `dpl_HBEQtqWHwpNe6Dy7xJouEL4DaSTY` |
| Supabase project ref | `zylllrvcmockvfcfubkp` |
| Production backup | PASS — `C:\Users\isuda\Dev\teamframe-production-backups\20260814-052715-zylllrvcmockvfcfubkp-pgdump` |
| Schema/migration result | PASS — 32 public tables, RLS enabled on all public tables |
| Storage result | PASS — private `documents` bucket present |
| Automation schedule status | Active via Vercel Cron, daily `0 6 * * *` on current Hobby plan |
| Health status | Public health PASS; protected deep health returns 401 without secret |
| Smoke-test result | PASS for production-safe smoke checks; `/platform` returns 404; `/dashboard` redirects unauthenticated users |
| Synthetic data status | PASS — release-created `Default Company` seed removed; production company/employee counts are zero |

Do not include secret values.

## 18. Current Repository State

Historical deployment details above are retained as provenance. Current Takaven commercial delivery treats TeamFrame as source-ready and customer-deployment controlled.

Current frozen product source at the 2026-09-26 checkpoint:

`takaven/teamframe` on `launch/managed-people-ops-45-day` at
`e9790370ba1a4526cfd29553c33dc288a46e27bc`.

A real customer deployment requires an explicitly selected customer Vercel/Supabase target, current environment configuration, backup responsibility, post-deployment smoke verification and founder/customer-delivery approval.

## 19. First-Customer Implementation Input Gate

The two-business-day implementation clock starts only when the operator records
`IMPLEMENTATION READY`. Otherwise return `CUSTOMER ACTION REQUIRED` with the
specific row/field corrections.

Required validated inputs:

- Company: legal/display name, UAE country code, `Asia/Dubai`, logo, nominated administrator.
- Organisation: departments, work locations, reporting relationships and positions where used.
- People: TeamFrame CSV with unique emails/employee numbers, real ISO dates, supported employment types, known managers/departments/locations, and explicit starter classification.
- Time off: leave definitions, entitlements, counting basis, attachment rules and holidays.
- Onboarding/documents: checklist, owners, due offsets, required document categories and expiry rules.
- Policies: final files/text, versions and acknowledgement requirement.
- Access: Full Access, Manager, Finance and Employee users with intended scopes.
- Delivery: verified sender/domain, auth redirect/domain and nominated handover participants.

Standard activation excludes corrupt-spreadsheet cleanup, unlimited historical
migration, scanning, policy/legal/UAE-labour advice, payroll/WPS/attendance/visa
work, bespoke workflows, integrations and custom software.

## 20. First-Customer Go-Live Checklist

- [ ] Exact production Vercel project, Supabase project, owner and region recorded.
- [ ] Current frozen SHA deployed; local and deployed SHAs match.
- [ ] Production-only variables present; Preview/test sinks and credentials absent.
- [ ] Domain, auth callback/reset/invite URLs and verified sender configured.
- [ ] Private storage, tenant paths, signed download and denied direct access tested.
- [ ] Tenant and Admin/Manager/Employee/Finance runtime isolation passed on an approved synthetic target.
- [ ] Cron authenticated, `0 4 * * *`, idempotent and observed once successfully.
- [ ] Transactional email success, safe failure visibility and same-ledger retry passed.
- [ ] Error visibility, deployment logs, health and alert owner confirmed.
- [ ] Provider daily backups active; retention, RPO/RTO and restore owner recorded.
- [ ] Database plus Storage restore rehearsal completed against an isolated target.
- [ ] Customer input gate says `IMPLEMENTATION READY`; QA and role handovers passed.
- [ ] Export smoke, notification smoke, release gate and rollback check passed.
- [ ] Product owner approves first real customer deployment and data load.
