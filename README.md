# TeamFrame

> **TeamFrame is the essential HR system for startups without a dedicated HR team.**

**Product status:** `Market-ready production release`

TeamFrame gives founder-led teams the practical HR administration layer they need without turning into an enterprise HRIS. The current product is functionally, technically, securely and visually ready for production release; production deployment still requires an explicitly identified production Vercel target and production Supabase project.

## Canonical Documents

- [TEAMFRAME_MARKET_READY_SCOPE.md](TEAMFRAME_MARKET_READY_SCOPE.md) - controlling product definition and scope.
- [TEAMFRAME_MARKET_READY_EXECUTION_REGISTER.md](TEAMFRAME_MARKET_READY_EXECUTION_REGISTER.md) - locked implementation register.
- [TEAMFRAME_AUTOMATION_REGISTER.md](TEAMFRAME_AUTOMATION_REGISTER.md) - product-level automation behaviour.
- [TEAMFRAME_DEFERRED_SCOPE.md](TEAMFRAME_DEFERRED_SCOPE.md) - deferred and out-of-scope work.
- [TEAMFRAME_RELEASE_READINESS.md](TEAMFRAME_RELEASE_READINESS.md) - release-readiness record.
- [TEAMFRAME_PRODUCTION_RUNBOOK.md](TEAMFRAME_PRODUCTION_RUNBOOK.md) - production release and operations runbook.
- [TEAMFRAME_ACCESS_MODEL.md](TEAMFRAME_ACCESS_MODEL.md) - production Platform Owner, customer access and provisioning model.

Older V1/readiness/finalisation documents are retained as provenance. Where they conflict with the files above, the canonical documents control.

## Implemented Capability

- People and employee lifecycle.
- Organisation, positions, reporting lines and Org Chart.
- Guided company setup.
- Onboarding and early-employment check-in.
- Probation.
- Documents, employee uploads and evidence-backed completion.
- Policies, file-backed versions and version-specific acknowledgements.
- Leave, balances, approvals, conflict detection and Who's Away projection.
- Effective-dated employment changes.
- Bounded manager delegation for direct reports.
- Offboarding and former-employee closure.
- HR Control Centre, durable resolution history and operational exceptions.
- Finance handoff exports.
- Deployment-level Platform Owner, flexible customer access and setup-pack provisioning.

## Product Operating Model

1. Basic HR administration is the product.
2. Signal -> Action -> Resolution is the operating mechanism.
3. Readiness, evidence and auditability are supporting outcomes.

TeamFrame is intentionally not payroll, ATS, employee ratings/review software, enterprise RBAC, statutory leave calculation or a workflow-builder platform.

## Architecture

- Next.js App Router.
- React and TypeScript.
- Supabase Postgres, Auth, Storage, RLS and RPCs.
- Database-backed company memberships, access profiles and scoped capability exceptions.
- Vercel-compatible application hosting.
- Protected server-side automation runner.
- Sentry instrumentation where configured.

## Local Development

### Prerequisites

- Node.js 20.19+.
- A Supabase project for local or disposable development.

### Install

```bash
npm ci
```

### Configure Environment

Copy `.env.example` to `.env.local` for local development and fill in the required values. Do not commit real credentials.

Required names include:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SITE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_DB_URL`
- `DEEP_HEALTH_SECRET`
- `TEAMFRAME_AUTOMATION_SECRET`

Optional names include:

- `SENTRY_DSN`
- `NEXT_PUBLIC_SENTRY_DSN`
- `SENTRY_AUTH_TOKEN`
- `SENTRY_ORG`
- `SENTRY_PROJECT`
- `NEXT_PUBLIC_PILOT_CONTACT_EMAIL`

### Apply Database And Storage

```bash
npm run db:apply
npm run storage:setup
```

### Configure Supabase Auth

Admins sign in with email and password at `/admin/login`. Employees use magic-link authentication through `/auth`. Open public self-registration is not part of the current auth model.

The auth contract is documented in [docs/auth-rules.md](docs/auth-rules.md). The production access model is documented in [TEAMFRAME_ACCESS_MODEL.md](TEAMFRAME_ACCESS_MODEL.md).

### Bootstrap Admin

```bash
SEED_ADMIN_PASSWORD='<choose-a-password>' npm run seed:admin -- you@yourcompany.com "Your Name" "Founder" "Leadership" "UTC"
```

The password is read from `SEED_ADMIN_PASSWORD` and must not be printed or committed.

### Run Locally

```bash
npm run dev
```

The default local server is `http://localhost:3030`.

## Verification

```bash
npm run verify:release
```

The release gate runs typecheck, lint, tests, guards and production build.

Additional environment-specific checks include:

```bash
npm run verify:install
npm run verify:integration
npm run verify:rls
```

Run environment-specific checks only against an authorised disposable, staging or production target. Do not point them at founder-review or unrelated projects.

## Deployment

Use [TEAMFRAME_PRODUCTION_RUNBOOK.md](TEAMFRAME_PRODUCTION_RUNBOOK.md). It records the required production services, environment variables, Supabase setup, Vercel deployment, automation scheduling, health checks, backup/recovery, secret rotation and post-deployment smoke test.

The local `.vercel` link must not be treated as production unless it is explicitly confirmed to point at the intended production project.

## Development Discipline

- Do not reopen locked MR-0 through MR-8 semantics without hard production evidence.
- Do not implement deferred or out-of-scope features merely because they are useful.
- Preserve server-side authorization, RLS, tenant isolation and private storage.
- Future source changes should now be driven by production defects, customer feedback or separately approved product development.
