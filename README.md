# TeamFrame

> **TeamFrame delivers technology-enabled managed People Operations for growing knowledge-work companies.**

**Product status:** `45-day managed People Operations launch execution; production trust and commercial gates remain open`

TeamFrame combines Hire, People, operational controls, automation and defined TAKAVEN operator work for 25–80 employee knowledge-work firms. The historical HR-system capability is real, but production trust, managed-service repeatability and buyer-visible differentiation still require live proof. See the commercial scope and execution ledger below; historical technical records remain provenance.

## Canonical Documents

- [TEAMFRAME_MANAGED_PEOPLE_OPS_SCOPE.md](TEAMFRAME_MANAGED_PEOPLE_OPS_SCOPE.md) - controlling commercial strategy.
- [docs/launch/TEAMFRAME_45_DAY_EXECUTION_PLAN.md](docs/launch/TEAMFRAME_45_DAY_EXECUTION_PLAN.md) - locked launch execution.
- [AGENTS.md](AGENTS.md) - agent authority, WIP and approval gates.
- [docs/launch/EXECUTION_LEDGER.md](docs/launch/EXECUTION_LEDGER.md) - single current execution tracker.
- [docs/launch/DECISIONS.md](docs/launch/DECISIONS.md) - material decisions.
- [docs/launch/environment-parity.md](docs/launch/environment-parity.md) - canonical synthetic Supabase identity and safety checks.
- [TEAMFRAME_MARKET_READY_SCOPE.md](TEAMFRAME_MARKET_READY_SCOPE.md) - historical TeamFrame People product scope; superseded for commercial positioning.
- [TEAMFRAME_MARKET_READY_EXECUTION_REGISTER.md](TEAMFRAME_MARKET_READY_EXECUTION_REGISTER.md) - historical implementation record; not the 45-day tracker.
- [TEAMFRAME_AUTOMATION_REGISTER.md](TEAMFRAME_AUTOMATION_REGISTER.md) - product-level automation behaviour.
- [TEAMFRAME_DEFERRED_SCOPE.md](TEAMFRAME_DEFERRED_SCOPE.md) - deferred and out-of-scope work.
- [TEAMFRAME_RELEASE_READINESS.md](TEAMFRAME_RELEASE_READINESS.md) - release-readiness record.
- [TEAMFRAME_PRODUCTION_RUNBOOK.md](TEAMFRAME_PRODUCTION_RUNBOOK.md) - production release and operations runbook.
- [TEAMFRAME_ACCESS_MODEL.md](TEAMFRAME_ACCESS_MODEL.md) - independent customer deployment, access and setup model.

Older V1/readiness/finalisation documents are retained as technical provenance. The new commercial scope and locked 45-day plan supersede prior market positioning; technical details remain authoritative where not specifically superseded.

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
- Independent customer deployment, flexible customer-local access and setup-pack provisioning.

## Product Operating Model

1. SEE → OWN → ACT → PROVE is the managed-service operating model.
2. Existing HR administration is the product substrate, not the whole commercial promise.
3. Starter Rescue, Document Recovery and Hiring Decision Rescue are the only launch controls.

TeamFrame People does not implement an ATS/recruiting pipeline. TeamFrame Hire is provided by the separate HirePass application and must not be rebuilt in this repository. TeamFrame is also intentionally not payroll, employee ratings/review software, enterprise RBAC, statutory leave calculation or a workflow-builder platform.

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

### Fresh Database Installation

For this launch branch, the installer accepts only the two named TAKAVEN disposable projects. Supply the exact project ref, matching public URL, database connection URI and `TEAMFRAME_INSTALL_APPROVAL=fresh:<project-ref>` in process memory. The command does not load `.env.local`; it refuses populated targets. A future first customer project requires founder approval and a reviewed allowlist addition. Existing deployments require a separately reviewed migration and must not replay the full schema pack. See the [runbook](TEAMFRAME_PRODUCTION_RUNBOOK.md).

```bash
npm run db:install:fresh -- --check-target
npm run db:install:fresh
```

Then provide `TEAMFRAME_INSTALL_SERVICE_ROLE_KEY` in process memory and run `npm run storage:setup:fresh -- --check-target` followed by `npm run storage:setup:fresh` on that same project. This refuses to overwrite a mismatched existing bucket. Storage access still requires separate live tests.

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
npm run verify:integration
npm run verify:rls:disposable
```

The historical `verify:install` replay/seed helper is retired. The integration and RLS checks require one of the explicitly approved TAKAVEN disposable project refs; they are not customer-production acceptance by themselves. Do not point them at founder-review or unrelated projects.

## Deployment

Use [TEAMFRAME_PRODUCTION_RUNBOOK.md](TEAMFRAME_PRODUCTION_RUNBOOK.md). It records the required production services, environment variables, Supabase setup, Vercel deployment, automation scheduling, health checks, backup/recovery, secret rotation and post-deployment smoke test.

The local `.vercel` link must not be treated as production unless it is explicitly confirmed to point at the intended production project.

## Development Discipline

- Do not reopen locked MR-0 through MR-8 semantics without hard production evidence.
- Do not implement deferred or out-of-scope features merely because they are useful.
- Preserve server-side authorization, RLS, tenant isolation and private storage.
- Future source changes should now be driven by production defects, customer feedback or separately approved product development.
