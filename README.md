# TeamFrame

> **UAE-focused HR software for startups, designed to help businesses establish and maintain the core HR controls relevant to UAE employment requirements.**

**Product status:** `product complete/frozen; Production deployed and healthy; real-customer data remains gated by MA-001, MA-003, MA-009 and MA-010`

TeamFrame is the customer-facing product and service brand. **TeamFrame is owned by TAKAVEN.** That ownership does not make TAKAVEN part of the customer implementation, support workflow or HR-service proposition, and TeamFrame does not depend on parent-company involvement.

TeamFrame is available in two forms: **TeamFrame / Tool Only**, including agreed implementation, configuration, data import, training and handover for a customer to operate with its own HR, Admin or Operations owner; and **TeamFrame + HR Support**, the same software with separately agreed HR foundation, setup or operational support delivered under the TeamFrame brand. The optional support does not require a central operator platform.

TeamFrame is designed to be configured and ready for handover within 48 hours once complete setup information and required access are available. This is a conditional implementation differentiator, not an unconditional SLA and not a promise that bespoke HR-policy or foundation work will always be completed within 48 hours.

TeamFrame is UAE-aware, company-flexible, operational and evidence-oriented: **built to help UAE businesses stay on top of key employment requirements** and shaped around the realities of employing people in the UAE. It does not guarantee legal compliance, provide legal advice, certify statutory status or claim to cover every UAE employment obligation.

## Canonical Documents

- [docs/operations/CURRENT-STATE.md](docs/operations/CURRENT-STATE.md) - **first-read canonical operational truth** for source, Production, Founder Review, launch status and remaining customer-data gates.
- [docs/operations/MANUAL-ACTIONS.md](docs/operations/MANUAL-ACTIONS.md) - canonical founder/account-owner actions and remaining activation gates.
- [TEAMFRAME_MANAGED_PEOPLE_OPS_SCOPE.md](TEAMFRAME_MANAGED_PEOPLE_OPS_SCOPE.md) - controlling product and optional-service commercial scope.
- [docs/launch/TEAMFRAME_45_DAY_EXECUTION_PLAN.md](docs/launch/TEAMFRAME_45_DAY_EXECUTION_PLAN.md) - historical launch-execution provenance only; it does not define current operational status.
- [AGENTS.md](AGENTS.md) - agent authority, WIP and approval gates.
- [docs/launch/EXECUTION_LEDGER.md](docs/launch/EXECUTION_LEDGER.md) - execution history and workstream evidence; current operational truth is in `CURRENT-STATE.md`.
- [docs/launch/DECISIONS.md](docs/launch/DECISIONS.md) - material decisions.
- [docs/launch/environment-parity.md](docs/launch/environment-parity.md) - canonical synthetic Supabase identity and safety checks.
- [TEAMFRAME_MARKET_READY_SCOPE.md](TEAMFRAME_MARKET_READY_SCOPE.md) - historical TeamFrame People product scope; superseded for commercial positioning.
- [TEAMFRAME_MARKET_READY_EXECUTION_REGISTER.md](TEAMFRAME_MARKET_READY_EXECUTION_REGISTER.md) - historical implementation record; not the 45-day tracker.
- [TEAMFRAME_AUTOMATION_REGISTER.md](TEAMFRAME_AUTOMATION_REGISTER.md) - product-level automation behaviour.
- [TEAMFRAME_DEFERRED_SCOPE.md](TEAMFRAME_DEFERRED_SCOPE.md) - deferred and out-of-scope work.
- [TEAMFRAME_RELEASE_READINESS.md](TEAMFRAME_RELEASE_READINESS.md) - release-readiness record.
- [TEAMFRAME_PRODUCTION_RUNBOOK.md](TEAMFRAME_PRODUCTION_RUNBOOK.md) - production release and operations runbook.
- [TEAMFRAME_ACCESS_MODEL.md](TEAMFRAME_ACCESS_MODEL.md) - independent customer deployment, access and setup model.

Older V1/readiness/finalisation and launch-execution documents are retained as technical provenance only. **Do not infer current deployment or launch status from them.** `CURRENT-STATE.md` controls current operational truth; the current commercial scope and material decisions control market positioning.

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

1. **SEE → OWN → ACT → PROVE** is the product and operating principle: show what needs attention, identify ownership, support the next action and retain evidence of resolution.
2. Tool Only customers operate the same independent product with their own HR, Admin or Operations owner after implementation and training.
3. TeamFrame + HR Support adds agreed HR foundation, setup or operational support under the TeamFrame brand; it is not a separate platform and does not justify features without customer/product value.
4. UAE references inform company policy; they do not silently become company settings or employee applicability.

TeamFrame People does not implement an ATS/recruiting pipeline. TeamFrame Hire is provided by the separate HirePass application and must not be rebuilt in this repository. TeamFrame is also intentionally not payroll, a full talent-management, OKR, 360-feedback, succession or compensation-performance platform, enterprise RBAC, statutory leave calculation or a workflow-builder platform.

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

Use [docs/operations/DEPLOYMENT.md](docs/operations/DEPLOYMENT.md) with [docs/operations/ENVIRONMENTS.md](docs/operations/ENVIRONMENTS.md). `TEAMFRAME_PRODUCTION_RUNBOOK.md` retains detailed technical and historical release provenance, but the operations registry controls current target identity.

The local `.vercel` link must not be treated as production unless it is explicitly confirmed to point at the intended production project.

## Development Discipline

- Do not reopen locked MR-0 through MR-8 semantics without hard production evidence.
- Do not implement deferred or out-of-scope features merely because they are useful.
- Preserve server-side authorization, RLS, tenant isolation and private storage.
- Presume the product feature-complete for first-customer sale. Future source changes require a production defect, a real first-customer blocker, repeated buyer feedback or a separately founder-approved small improvement.