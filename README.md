# TeamFrame

> **TeamFrame is the essential HR system for startups without a dedicated HR team.**

TeamFrame's current market-ready programme is governed by the canonical documents listed below. Older V1/readiness/finalisation documents remain useful as historical provenance, but they do not control current market-ready scope where they conflict with the files in this section.

## Current Market-Ready Programme

Read these first:

- [`TEAMFRAME_MARKET_READY_SCOPE.md`](TEAMFRAME_MARKET_READY_SCOPE.md) — controlling product definition and scope.
- [`TEAMFRAME_MARKET_READY_EXECUTION_REGISTER.md`](TEAMFRAME_MARKET_READY_EXECUTION_REGISTER.md) — implementation control register using canonical `TF-MR-*` IDs.
- [`TEAMFRAME_AUTOMATION_REGISTER.md`](TEAMFRAME_AUTOMATION_REGISTER.md) — product-level automation behaviours required for market readiness.
- [`TEAMFRAME_DEFERRED_SCOPE.md`](TEAMFRAME_DEFERRED_SCOPE.md) — deferred and out-of-scope work.
- [`TEAMFRAME_RELEASE_READINESS.md`](TEAMFRAME_RELEASE_READINESS.md) — release gate and current readiness verdict.

Current hierarchy:

1. Basic HR administration = the product.
2. Signal -> Action -> Resolution = operating mechanism.
3. Readiness, evidence and auditability = supporting outcomes.

Current status: **MARKET-READY IMPLEMENTATION NOT YET COMPLETE**.

## Current Foundation

At baseline `489c9606441618e898f21eafb0443a9ca33474ad`, technical verification confirmed these reusable foundations:

- employee records;
- position-based Org Chart with filled/vacant roles and JD attachments;
- admin and employee authentication paths;
- onboarding task templates and manual assignment/completion;
- policy creation, publication, archive and version-specific acknowledgement;
- basic leave request, approval and rejection;
- private document storage and file validation;
- due-diligence and finance export machinery;
- risk signals, action items and dashboard signal reconciliation;
- audit logging;
- transactional RPC pattern;
- private file lifecycle records;
- RLS and same-tenant integrity patterns;
- local verification gates.

The same verification confirmed that market-ready TeamFrame still requires controlled implementation of lifecycle, automation, reminders/escalations, document requests, policy file upload, evidence-based completion, leave balances/types/history, manager delegation, employment-change history, offboarding and reliability closure.

## Product Definition

TeamFrame gives founders and small teams the essential tools to manage everyday HR responsibilities simply, correctly and consistently without the complexity of traditional HR software.

Target customer:

- founder-led startups and small businesses;
- approximately 5-25 employees;
- no dedicated HR team;
- primarily salaried / knowledge-worker businesses.

TeamFrame should not initially optimise for shift-heavy hospitality, manufacturing, complex hourly workforces, multi-location time-and-attendance operations or enterprise HR departments.

## Product Operating Principle

> Capture once -> trigger automatically -> propagate automatically -> remind automatically -> close automatically where evidence permits -> escalate only when human judgement is required.

The founder should primarily spend time on decisions, approvals, exceptions and sensitive employee matters, not routine chasing or duplicate administration.

## Current Application Surface

As of the current baseline, the running app includes:

- `/admin/login` — admin sign-in;
- `/auth`, `/auth/callback`, `/auth/check-email` — employee authentication;
- `/dashboard` — HR control, decisions, exceptions and signal overview;
- `/org-chart` — position structure, filled/vacant roles and JD attachments;
- `/employees` — employee roster and employee-level admin actions;
- `/onboarding` — onboarding task assignment and completion;
- `/leaves` — basic leave queue and decisions;
- `/policies` — policy publication and acknowledgement evidence;
- `/me` — employee self-service hub;
- `/api/health`, `/api/health/deep` — health checks.

There are no standalone company setup, document request, exports, manager-delegation, probation, 30-day check-in, employment-change history or offboarding case-management routes yet.

## Setup Instructions

### 1. Prerequisites

- Node.js 20.19+.
- A Supabase project with Postgres, Storage and Auth.

### 2. Install

```bash
npm ci
```

### 3. Configure environment

Copy `.env.example` to `.env.local` for local development and fill in required values. Do not commit real credentials.

Required values include:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SITE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_DB_URL`

### 4. Apply database and storage setup

```bash
npm run db:apply
npm run storage:setup
```

`db:apply` applies SQL files in the repository schema order. `storage:setup` creates the private `documents` bucket.

### 5. Configure Supabase Auth

Admins sign in with email and password at `/admin/login`. Employees use magic-link authentication through `/auth`.

The auth contract is documented in [`docs/auth-rules.md`](docs/auth-rules.md). The committed Supabase config can be applied with the Supabase CLI when working against an authorised environment.

### 6. Seed the bootstrap admin

```bash
SEED_ADMIN_PASSWORD='<choose-a-password>' npm run seed:admin -- you@yourcompany.com "Your Name" "Founder" "Leadership" "UTC"
```

The password is read from `SEED_ADMIN_PASSWORD` and should not be printed or committed.

### 7. Verify locally

```bash
npm run verify:release
```

The canonical release gate runs typecheck, lint, tests, guards and build.

## Development Discipline

- Follow the market-ready execution register.
- Do not implement deferred or out-of-scope features merely because they are useful or common in another HRIS.
- Preserve the current security model: server-side RBAC, service-layer authorization, RLS, tenant-scoped relationships and private storage.
- New market-ready work should be implemented by bounded workstream, then tested, reviewed and locked.
- Do not treat older V1 bans as controlling where the market-ready canonical documents explicitly supersede them.

## Historical Documents

The repository contains older V1, finalisation and readiness documents. They are retained as provenance. Where they conflict with the current market-ready programme, the following files control:

1. [`TEAMFRAME_MARKET_READY_SCOPE.md`](TEAMFRAME_MARKET_READY_SCOPE.md)
2. [`TEAMFRAME_MARKET_READY_EXECUTION_REGISTER.md`](TEAMFRAME_MARKET_READY_EXECUTION_REGISTER.md)
3. [`TEAMFRAME_DEFERRED_SCOPE.md`](TEAMFRAME_DEFERRED_SCOPE.md)
4. [`TEAMFRAME_RELEASE_READINESS.md`](TEAMFRAME_RELEASE_READINESS.md)

## Final Rule

TeamFrame should stay simple, but not incomplete. The market-ready product is a focused essential HR system for founder-led teams, not an enterprise HRIS, payroll platform, ATS, performance system or workflow builder.
