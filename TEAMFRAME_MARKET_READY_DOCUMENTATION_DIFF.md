# TeamFrame Market-Ready Documentation Diff

Generated from the uncommitted documentation-only market-ready pass for product-owner review.

Included existing-file diffs:

- README.md
- docs/drift-guard.md
- docs/architecture.md
- docs/rbac-rules.md
- docs/auth-rules.md
- FINAL_PRODUCT_ACCEPTANCE.md
- FINAL_READINESS_SUMMARY.md
- docs/business/blueprint-locked.md
- docs/launch/README.md
- docs/launch/parking-lot.md
- docs/launch/accepted-risks.md
- docs/launch/readiness-log.md
- docs/product/gap-audit-2026-05-30.md

Included new canonical documentation files:

- TEAMFRAME_MARKET_READY_SCOPE.md
- TEAMFRAME_MARKET_READY_EXECUTION_REGISTER.md
- TEAMFRAME_AUTOMATION_REGISTER.md
- TEAMFRAME_DEFERRED_SCOPE.md
- TEAMFRAME_RELEASE_READINESS.md

```diff
diff --git a/FINAL_PRODUCT_ACCEPTANCE.md b/FINAL_PRODUCT_ACCEPTANCE.md
index 15dffc4..444572d 100644
--- a/FINAL_PRODUCT_ACCEPTANCE.md
+++ b/FINAL_PRODUCT_ACCEPTANCE.md
@@ -1,3 +1,17 @@
+> **HISTORICAL / SUPERSEDED - NOT GOVERNING CURRENT MARKET-READY SCOPE**
+>
+> Date marked superseded: 2026-08-11.
+>
+> This document is retained as product provenance. It does not control the current market-ready programme where it conflicts with:
+>
+> - `TEAMFRAME_MARKET_READY_SCOPE.md`
+> - `TEAMFRAME_MARKET_READY_EXECUTION_REGISTER.md`
+> - `TEAMFRAME_DEFERRED_SCOPE.md`
+> - `TEAMFRAME_RELEASE_READINESS.md`
+>
+> In particular, older FPORS/V1 statements that TeamFrame is not an HR system, that reminders/workflows are permanently forbidden, or that leave balances/manager delegation/policy file upload/document requests are V2-only are superseded for the bounded market-ready programme.
+
+---
 # TeamFrame — Final Product Acceptance

 > **Current review status — 4 August 2026:** this document records the July
diff --git a/FINAL_READINESS_SUMMARY.md b/FINAL_READINESS_SUMMARY.md
index d1e0792..5e48ca1 100644
--- a/FINAL_READINESS_SUMMARY.md
+++ b/FINAL_READINESS_SUMMARY.md
@@ -1,3 +1,17 @@
+> **HISTORICAL / SUPERSEDED - NOT GOVERNING CURRENT MARKET-READY SCOPE**
+>
+> Date marked superseded: 2026-08-11.
+>
+> This document is retained as product provenance. It does not control the current market-ready programme where it conflicts with:
+>
+> - `TEAMFRAME_MARKET_READY_SCOPE.md`
+> - `TEAMFRAME_MARKET_READY_EXECUTION_REGISTER.md`
+> - `TEAMFRAME_DEFERRED_SCOPE.md`
+> - `TEAMFRAME_RELEASE_READINESS.md`
+>
+> In particular, older FPORS/V1 statements that TeamFrame is not an HR system, that reminders/workflows are permanently forbidden, or that leave balances/manager delegation/policy file upload/document requests are V2-only are superseded for the bounded market-ready programme.
+
+---
 # TeamFrame — Final Readiness Summary (v1.0 local finalisation)

 > **Current review status — 4 August 2026:** this July summary is historical.
diff --git a/README.md b/README.md
index 3886d81..d90464b 100644
--- a/README.md
+++ b/README.md
@@ -1,384 +1,157 @@
 # TeamFrame

-> **Managed People-Ops Readiness for Founder-Led Teams.**
->
-> Core promise: **people operations, made ready through a managed, evidence-led readiness system.**
+> **TeamFrame is the essential HR system for startups without a dedicated HR team.**

-This README is **the enforcement contract for TeamFrame V1**. If a feature, dependency, or decision conflicts with this document, the README wins until the README is changed.
+TeamFrame's current market-ready programme is governed by the canonical documents listed below. Older V1/readiness/finalisation documents remain useful as historical provenance, but they do not control current market-ready scope where they conflict with the files in this section.

----
+## Current Market-Ready Programme

-## Currently shipped (truth)
+Read these first:

-As of the latest commit on `main`, the running app provides:
+- [`TEAMFRAME_MARKET_READY_SCOPE.md`](TEAMFRAME_MARKET_READY_SCOPE.md) — controlling product definition and scope.
+- [`TEAMFRAME_MARKET_READY_EXECUTION_REGISTER.md`](TEAMFRAME_MARKET_READY_EXECUTION_REGISTER.md) — implementation control register using canonical `TF-MR-*` IDs.
+- [`TEAMFRAME_AUTOMATION_REGISTER.md`](TEAMFRAME_AUTOMATION_REGISTER.md) — product-level automation behaviours required for market readiness.
+- [`TEAMFRAME_DEFERRED_SCOPE.md`](TEAMFRAME_DEFERRED_SCOPE.md) — deferred and out-of-scope work.
+- [`TEAMFRAME_RELEASE_READINESS.md`](TEAMFRAME_RELEASE_READINESS.md) — release gate and current readiness verdict.

-- **Auth** — two-tier Supabase sign-in: admins use email + password at `/admin/login`; employees use magic links at `/auth`, `/auth/callback`, `/auth/check-email`, and `/auth/logout`.
-- **Readiness overview** (`/dashboard`) — priority signals, open actions, recent resolutions, and honest empty/failure states when data is unavailable.
-- **Org Chart** (`/org-chart`) — admins define position-based reporting structure, see filled/vacant roles, assign employees to positions, and attach private JD files.
-- **Employees** (`/employees`) — admins manage the team roster.
-- **Onboarding** (`/onboarding`) — employees complete their onboarding checklist; admins assign and monitor tasks.
-- **Leave requests** (`/leaves`) — employees submit leave requests; admins approve or reject from the queue.
-- **Self-service** (`/me`) — employee profile landing and hub for self-service actions.
-- **Tenant safety** — server-side role resolution via `requireTenantActor`, every service call takes an explicit `Actor`, RLS on every table.
+Current hierarchy:

-Everything in the next section ("What TeamFrame is") describes the V1 *target surface*. Items not in the list above are **not yet in the UI**.
+1. Basic HR administration = the product.
+2. Signal -> Action -> Resolution = operating mechanism.
+3. Readiness, evidence and auditability = supporting outcomes.

----
+Current status: **MARKET-READY IMPLEMENTATION NOT YET COMPLETE**.

-## What TeamFrame is (V1 target)
+## Current Foundation

-The product targets exactly these things:
+At baseline `489c9606441618e898f21eafb0443a9ca33474ad`, technical verification confirmed these reusable foundations:

-- **Org Chart / position structure** — roles, reporting lines, filled/vacant positions and private JD attachments _(shipped as founder-approved bounded exception)_
-- **Employee directory** — who's on the team _(shipped)_
-- **Onboarding task tracking** — employee checklist; admin assignment _(shipped)_
-- **Document expiry tracking** — passports, visas, work permits _(shipped for uploaded records)_
-- **Leave request tracking** — request, approve, reject _(shipped)_
+- employee records;
+- position-based Org Chart with filled/vacant roles and JD attachments;
+- admin and employee authentication paths;
+- onboarding task templates and manual assignment/completion;
+- policy creation, publication, archive and version-specific acknowledgement;
+- basic leave request, approval and rejection;
+- private document storage and file validation;
+- due-diligence and finance export machinery;
+- risk signals, action items and dashboard signal reconciliation;
+- audit logging;
+- transactional RPC pattern;
+- private file lifecycle records;
+- RLS and same-tenant integrity patterns;
+- local verification gates.

-Nothing more.
+The same verification confirmed that market-ready TeamFrame still requires controlled implementation of lifecycle, automation, reminders/escalations, document requests, policy file upload, evidence-based completion, leave balances/types/history, manager delegation, employment-change history, offboarding and reliability closure.

-Company announcements remain removed in the FPORS pivot (see `docs/business/blueprint-locked.md`). Org Chart was restored only as a bounded position-structure module by explicit founder approval; it is not workforce planning, recruiting, budgeting, employee reviews, or productivity tracking. TeamFrame is not an HR system; it is a managed readiness tool for founder people-ops risk. Pivot deletion log: `docs/business/pivot-deletion-list.md`.
+## Product Definition

----
+TeamFrame gives founders and small teams the essential tools to manage everyday HR responsibilities simply, correctly and consistently without the complexity of traditional HR software.

-## What TeamFrame is NOT (explicit non-goals)
+Target customer:

-TeamFrame is **not** any of the following. Do not add them.
+- founder-led startups and small businesses;
+- approximately 5-25 employees;
+- no dedicated HR team;
+- primarily salaried / knowledge-worker businesses.

-- payroll
-- benefits
-- accounting / tax / compliance engines
-- analytics dashboards / HR metrics / engagement scoring
-- AI HR advisor / chatbot / copilot
-- employee scoring, ranking, personality inference
-- hiring pipelines / ATS
-- onboarding **workflows** (tasks, reminders, checklists, automation states)
-- reminders / notifications engine
-- approvals engine, e-signatures, document versioning, retention engines
-- performance reviews, compensation benchmarking
-- integrations marketplace, Zapier/webhooks ecosystem
-- workflow orchestration, automation platform
-- plugin / extension systems
-- enterprise admin systems, custom RBAC beyond `admin` / `employee`
+TeamFrame should not initially optimise for shift-heavy hospitality, manufacturing, complex hourly workforces, multi-location time-and-attendance operations or enterprise HR departments.

-If a feature resembles **enterprise HRIS**, **workflow automation**, or **AI assistant platform** behavior — it is **V2** and must be rejected.
+## Product Operating Principle

----
+> Capture once -> trigger automatically -> propagate automatically -> remind automatically -> close automatically where evidence permits -> escalate only when human judgement is required.

-## Anti-drift rules
+The founder should primarily spend time on decisions, approvals, exceptions and sensitive employee matters, not routine chasing or duplicate administration.

-1. **No new module unless it's already in the allow list above.**
-2. **No AI surface in V1.** The previous `/lib/ai` scaffold was removed; reintroducing AI requires an explicit V2 decision.
-3. **No new role** beyond `admin` and `employee`.
-4. **No new background subsystem** (queue, scheduler, worker, event bus) in V1.
-5. **No premature scalability work** (multi-region, sharding, microservices).
-6. **No client-side authorization** as a security boundary.
-7. **No service-role key** in any code path reachable from the browser.
+## Current Application Surface

-Detailed bans live in [`docs/drift-guard.md`](docs/drift-guard.md).
+As of the current baseline, the running app includes:

----
+- `/admin/login` — admin sign-in;
+- `/auth`, `/auth/callback`, `/auth/check-email` — employee authentication;
+- `/dashboard` — HR control, decisions, exceptions and signal overview;
+- `/org-chart` — position structure, filled/vacant roles and JD attachments;
+- `/employees` — employee roster and employee-level admin actions;
+- `/onboarding` — onboarding task assignment and completion;
+- `/leaves` — basic leave queue and decisions;
+- `/policies` — policy publication and acknowledgement evidence;
+- `/me` — employee self-service hub;
+- `/api/health`, `/api/health/deep` — health checks.

-## Architecture flow
+There are no standalone company setup, document request, exports, manager-delegation, probation, 30-day check-in, employment-change history or offboarding case-management routes yet.

-```
-Frontend
-  → API Routes / Server Actions
-    → RBAC Middleware
-      → Service Layer
-        → Database
-```
-
-- The frontend never talks to Supabase with elevated privileges.
-- API Routes / Server Actions parse + validate input, then call the service layer.
-- RBAC middleware resolves the session and role, server-side, every time.
-- The service layer accepts an explicit `Actor` and re-validates authorization.
-- The database is reached only by the service layer.
-
-Full detail: [`docs/architecture.md`](docs/architecture.md).
-
----
-
-## Repository structure
-
-```
-/app
-  /dashboard          # risk dashboard (FPORS) — rebuild in flight (Wave 3)
-  /org-chart          # position-based reporting structure + JD attachment
-  /employees          # team roster + admin CRUD + actions
-  /onboarding         # onboarding readiness (preboarding signals)
-  /leaves             # leave tracking (slimmed)
-  /auth               # magic-link sign-in + callback + logout
-
-/lib
-  /db                 # Supabase server + browser clients, env access
-  /rbac               # role types + resolver
-
-/components
-  # shared UI primitives
-
-/services
-  /employeeService    # shipped; explicit Actor on every call
-  /positionService    # bounded Org Chart positions, reporting, JD attachment
-  /documentService    # scaffolded; signal engine wired; upload UI in progress
-  /leaveService       # shipped; submit/approve/reject wired end-to-end
-
-/middleware
-  auth.ts             # session resolution
-  rbac.ts             # role guards (requireRole, requireTenantActor)
-
-/schemas
-  employees.sql, employee_profiles.sql, compensation.sql, positions.sql, documents.sql,
-  leaves.sql, audit_logs.sql, risk_signals.sql, action_items.sql
-
-/docs
-  architecture.md, drift-guard.md, rbac-rules.md, auth-rules.md,
-  ai-boundaries.md, bootstrap-prompt.md,
-  business/blueprint-locked.md, business/signal-rules.md,
-  business/pivot-deletion-list.md, business/weekend-execution-plan.md
-```
+## Setup Instructions

----
-
-## Tech stack (locked for V1)
-
-- **Frontend**: Next.js App Router + TypeScript + TailwindCSS
-- **Backend**: Supabase Postgres + Supabase Storage + Supabase Auth
-- **Deployment**: Vercel
-
-No AI provider in V1. No alternate auth provider. No alternate DB. Switching any of these is V2.
+### 1. Prerequisites

----
+- Node.js 20.19+.
+- A Supabase project with Postgres, Storage and Auth.

-## Setup instructions
+### 2. Install

-### 1. Prerequisites
-- Node.js 20.19+ (required by Vitest/Vite toolchain)
-- A Supabase project (Postgres + Storage + Auth)
-
-### 2. Clone and install
 ```bash
-git clone <repo-url>
-cd TeamFrame
-npm install
+npm ci
 ```

 ### 3. Configure environment
-Copy `.env.example` to `.env.local` and fill in:

-```bash
-cp .env.example .env.local
-```
+Copy `.env.example` to `.env.local` for local development and fill in required values. Do not commit real credentials.
+
+Required values include:

-Required:
 - `NEXT_PUBLIC_SUPABASE_URL`
 - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
-- `SITE_URL` *(local dev default: `http://localhost:3030`)*
-- `SUPABASE_SERVICE_ROLE_KEY` *(server-only — never expose)*
-- `SUPABASE_DB_URL` *(server-only — used by database setup scripts)*
+- `SITE_URL`
+- `SUPABASE_SERVICE_ROLE_KEY`
+- `SUPABASE_DB_URL`

 ### 4. Apply database and storage setup
+
 ```bash
 npm run db:apply
 npm run storage:setup
 ```

-`db:apply` applies the SQL files in `/schemas` in the correct order. It is
-idempotent and safe to re-run. `storage:setup` creates the private `documents`
-bucket with the V1 file-type and size limits.
-
-### 5. Configure Supabase auth
+`db:apply` applies SQL files in the repository schema order. `storage:setup` creates the private `documents` bucket.

-Admins sign in with email + password at `/admin/login`; employees sign in with magic links at `/auth`.
+### 5. Configure Supabase Auth

-Required project settings (the auth contract, see `docs/auth-rules.md`):
-- Email provider enabled (password + magic-link sign-ins).
-- New user signups **disabled** so random emails cannot self-register.
-- Site URL = your `SITE_URL` (local: `http://localhost:3030`), with `http://localhost:3030/**` in the redirect allowlist.
-- Do not add password reset, email change, OAuth, MFA, or other auth flows in V1.
+Admins sign in with email and password at `/admin/login`. Employees use magic-link authentication through `/auth`.

-**Automated route (recommended):** the contract is committed as `supabase/config.toml`. Push it with:
-
-```bash
-npx supabase link --project-ref <your-project-ref>
-npx supabase config push
-```
-
-**Dashboard route:** Authentication → *Sign In / Providers* (User Signups: disable signups; Auth Providers: Email on) and Authentication → *URL Configuration* (Site URL + redirect URLs).
-
-**Magic-link email template (manual, honest limitation):** employee magic-link emails need the template
-`{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=magiclink` — but on the free tier with
-Supabase's built-in mailer, template modification is rejected and delivery only reaches project
-team-member addresses. Configure custom SMTP (Authentication → *Emails* → SMTP settings) or a paid plan
-first, then either set the template in Authentication → *Emails* → Templates or uncomment the
-`[auth.email.template.magic_link]` block in `supabase/config.toml` and re-run `npx supabase config push`.
-Admin password login works without any email configuration. Full step-by-step: `START_HERE.md` step 6.
+The auth contract is documented in [`docs/auth-rules.md`](docs/auth-rules.md). The committed Supabase config can be applied with the Supabase CLI when working against an authorised environment.

 ### 6. Seed the bootstrap admin
-```bash
-SEED_ADMIN_PASSWORD='<choose-a-password>' npm run seed:admin -- you@yourcompany.com "Your Name" "Founder" "Leadership" "UTC"
-```
-One command, no dashboard steps: creates the tenant, creates the auth user with a password (no
-invite email is sent, so any domain works), stamps `app_metadata.role = "admin"` **and**
-`app_metadata.tenant_id`, creates the matching `employees` row, then verifies the login by signing
-in with the anon key and signing out. The password is read from `SEED_ADMIN_PASSWORD` and never
-printed. Re-running is safe (it re-stamps claims and resets the password).
-
-### 7. Verify the installation
-```bash
-npm run verify:install
-```
-Asserts (PASS/FAIL each, non-zero exit on failure): schemas apply in order, the live tenant-resolution
-function is the JWT-only V2 (no email fallback), required tables/views/functions exist with RLS enabled,
-`seed:admin` produces a password-login-capable admin, and `seed:demo` is idempotent (two runs, identical
-row counts).

-### 8. Run
 ```bash
-npm run dev
+SEED_ADMIN_PASSWORD='<choose-a-password>' npm run seed:admin -- you@yourcompany.com "Your Name" "Founder" "Leadership" "UTC"
 ```
-Open `http://localhost:3030/admin/login`, sign in with your admin email and the `SEED_ADMIN_PASSWORD`
-value, and you'll land on `/dashboard`.

-## Deployment confidence
+The password is read from `SEED_ADMIN_PASSWORD` and should not be printed or committed.

-Run this sequence before shipping:
+### 7. Verify locally

 ```bash
-npm ci
-npm run env:check
-npm run lint
-npm run typecheck
-npm run build
+npm run verify:release
 ```

-If your deployment or CI environment also has the CI service-role secret configured, run the smoke loop after the build:
-
-```bash
-npm run env:check:smoke
-npm run smoke:core-loop
-```
-
-Migration order is locked in [scripts/schema-order.mjs](scripts/schema-order.mjs). Apply schema changes with `npm run db:apply` before the first deploy and after every schema change. The script is idempotent and safe to re-run.
-
-The CI workflow runs install, environment validation, lint, typecheck, and build on every `main` and `develop` push or pull request. The optional smoke job runs only on `main` or manual dispatch when the required CI secrets are present.
-
----
-
-## Branch protection rules
-
-- `main` — release-candidate only. No direct pushes. PR + at least one review.
-- `develop` — integration branch.
-- `feature/*` — isolated feature work (`feature/auth`, `feature/rbac`, etc.).
-
-Required GitHub protections for `main`:
-- pull request review required
-- direct pushes blocked
-- required status checks: `Gate Chain (Strict)`
-- linear history preferred
-
-Detailed branch protection setup: [`.github/branch-protection.md`](.github/branch-protection.md).
-
----
-
-## Coding principles
-
-- **Simplicity is a product feature.** Optimize for controlled founder readiness, not extensibility.
-- **Explicit over abstract.** Prefer hand-written guards to clever frameworks.
-- **One feature, one justification.** Every new feature must defend itself against the managed-readiness scope.
-- **No premature scalability.** Build for 10 customers. The 11th customer is a happy problem.
-- **Reuse existing entities.** New tables are an escalation, not a default.
-
-Sanity check before any feature (also in [`docs/drift-guard.md`](docs/drift-guard.md)):
-
-1. Does this move setup closer to or further from managed readiness?
-2. Does this reuse existing entities/tables?
-3. Does this introduce workflow automation, HR-ops logic, analytics, or AI scope creep?
-4. Can it ship without a new subsystem?
-
-If any answer trends toward complexity, the feature is **V2**.
-
----
-
-## Security principles
-
-- **Two-tier authentication.** Admins use email + password at `/admin/login`; employees use magic links at `/auth`. No password reset, email change, OAuth providers, or MFA in V1. See [`docs/auth-rules.md`](docs/auth-rules.md).
-- **Server-side RBAC is mandatory.** Client checks are UX hints only.
-- **Two roles only**: `admin`, `employee`. See [`docs/rbac-rules.md`](docs/rbac-rules.md).
-- **Service-role key is server-only.** Importing `/lib/db/supabaseServer` from a client component is a review block.
-- **Compensation is admin-only.** It must never appear in org-chart or employee-scope queries.
-- **Audit on every sensitive admin action**: employee delete, compensation change, document delete, leave decision, bulk export.
-- **HTTPS only.** Storage encrypted at rest via Supabase defaults.
-- **Manual employee delete** is supported (soft-delete via `deleted_at`).
-
-Deferred to V2 (intentionally): compliance dashboards, consent management UI, audit-log dashboards, automated data-export UI.
-
----
-
-## AI limitations
-
-AI is **not part of V1**. The previous `/lib/ai` scaffold (`generateBio`, `generateContract`) was removed during Phase 1 surface cleanup because it was never wired to any UI. Re-introducing AI requires:
-
-- an explicit V2 product decision,
-- a server-only module in `/lib/ai`,
-- and updates to [`docs/ai-boundaries.md`](docs/ai-boundaries.md).
-
-Any AI helper, if reintroduced, must still:
-
-- live server-side only,
-- never query the database directly,
-- never receive an unscoped employee record,
-- never access compensation,
-- never act as an HR advisor / chatbot,
-- never score, rank, or compare employees,
-- never be invoked from client-side code.
-
-Full historical boundary spec: [`docs/ai-boundaries.md`](docs/ai-boundaries.md).
-
----
-
-## Implementation priorities
-
-Build in this order. Do not parallelize past these steps.
-
-1. **Supabase setup** — apply schemas, create storage bucket, seed admin role _(shipped)_
-2. **Auth + RBAC** — Supabase Auth sign-in, server-side role resolution, middleware guards _(shipped)_
-3. **Employee CRUD** — create/read/update/soft-delete _(shipped)_
-4. **Org chart** — whitelist-only employee-scope view _(shipped)_
-5. **Document upload system** — upload, download, grouped export (ZIP/PDF) _(not yet)_
-6. **Leave requests** — submit, approve, reject _(not yet)_
-7. **Instrumentation** — internal `analytics_events` table + server-only `track()` helper for the 8 activation events _(in progress — see `docs/14-day-sprint-tracker.md`)_
-8. **Hardening + permissions** — audit-log coverage, RBAC end-to-end review, soft-delete sweeps _(in progress — see `docs/14-day-sprint-tracker.md`)_
-
-Do **not** add V2 features before step 8 is complete. Company announcements and AI helpers are parked until post-V1.
-
----
-
-## Compliance baseline (V1)
-
-Required at launch:
-- Privacy Policy
-- Terms of Service
-- Data Processing Agreement (DPA)
-- HTTPS only
-- Encrypted storage via Supabase defaults
-- Server-side RBAC enforcement
-- Manual employee delete
+The canonical release gate runs typecheck, lint, tests, guards and build.

-Deferred to V2: compliance dashboards, consent management UI, audit-log dashboards, automated data export UI, compliance automation.
+## Development Discipline

----
+- Follow the market-ready execution register.
+- Do not implement deferred or out-of-scope features merely because they are useful or common in another HRIS.
+- Preserve the current security model: server-side RBAC, service-layer authorization, RLS, tenant-scoped relationships and private storage.
+- New market-ready work should be implemented by bounded workstream, then tested, reviewed and locked.
+- Do not treat older V1 bans as controlling where the market-ready canonical documents explicitly supersede them.

-## Final rule
+## Historical Documents

-TeamFrame V1 is intentionally constrained. The goal is:
+The repository contains older V1, finalisation and readiness documents. They are retained as provenance. Where they conflict with the current market-ready programme, the following files control:

-- fast launch
-- real customer usage
-- operational simplicity
-- founder-managed support
-- low-maintenance infrastructure
+1. [`TEAMFRAME_MARKET_READY_SCOPE.md`](TEAMFRAME_MARKET_READY_SCOPE.md)
+2. [`TEAMFRAME_MARKET_READY_EXECUTION_REGISTER.md`](TEAMFRAME_MARKET_READY_EXECUTION_REGISTER.md)
+3. [`TEAMFRAME_DEFERRED_SCOPE.md`](TEAMFRAME_DEFERRED_SCOPE.md)
+4. [`TEAMFRAME_RELEASE_READINESS.md`](TEAMFRAME_RELEASE_READINESS.md)

-This repository is an **enforcement contract against scope creep**.
+## Final Rule

-**Protect simplicity at all costs.**
+TeamFrame should stay simple, but not incomplete. The market-ready product is a focused essential HR system for founder-led teams, not an enterprise HRIS, payroll platform, ATS, performance system or workflow builder.
diff --git a/docs/architecture.md b/docs/architecture.md
index 56ab4a2..4cd3f53 100644
--- a/docs/architecture.md
+++ b/docs/architecture.md
@@ -1,57 +1,92 @@
 # Architecture

 ## Purpose
-Define the minimum architecture contract for TeamFrame V1 and prevent platform drift.

-TeamFrame is a **lightweight HR structure system** for startups with **6–25 employees**. The core promise is: *we install a working HR structure system in 48–72 hours*. Every architectural decision must serve that promise. Anything that does not is V2.
+Define the current architecture contract for TeamFrame and the guardrails for the market-ready programme.
+
+Current product definition is governed by [`../TEAMFRAME_MARKET_READY_SCOPE.md`](../TEAMFRAME_MARKET_READY_SCOPE.md):
+
+> TeamFrame is the essential HR system for startups without a dedicated HR team.
+
+Older V1 statements about a 48-72 hour install promise or all workflow automation being V2 are superseded where they conflict with the canonical market-ready documents.

 ## Tech Stack
-- **Frontend**: Next.js App Router, TypeScript, TailwindCSS
-- **Backend**: Supabase Postgres, Supabase Storage, Supabase Auth
-- **Deployment**: Vercel

-## Request Flow (mandatory)
+- Frontend: Next.js App Router, TypeScript, TailwindCSS.
+- Backend: Supabase Postgres, Supabase Storage, Supabase Auth.
+- Deployment target: Vercel.

-```
+## Request Flow
+
+```text
 Frontend
-  → API Routes / Server Actions
-    → RBAC Middleware
-      → Service Layer
-        → Database
+  -> API Routes / Server Actions
+    -> RBAC Middleware
+      -> Service Layer
+        -> Database / Storage
 ```

-No layer may be skipped. No client may bypass the middleware. No service-role key may ever reach the browser.
+No layer may be skipped. No client may bypass middleware. No service-role key may ever reach the browser.

 ## Layer Responsibilities

 | Layer | Allowed | Forbidden |
-|---|---|---|
-| Frontend (`/app`, `/components`) | rendering, form state, UX-only role hints | authoritative permission checks, direct Supabase calls with the service role |
-| API Routes / Server Actions | parse + validate input, invoke middleware, call services, shape response | embedding business rules inline, talking to the DB directly |
-| RBAC Middleware (`/middleware`) | resolve session, attach role, gate by role | data fetching, business logic |
-| Service Layer (`/services`) | enforce domain invariants, call DB, write audit logs | reading session/role itself (must be passed in), bypassing RBAC |
-| Database (`/schemas`) | persist state | application logic |
+| --- | --- | --- |
+| Frontend (`/app`, `/components`) | Rendering, forms, navigation, UX-only role hints | Authoritative permission checks, service-role access |
+| API Routes / Server Actions | Parse and validate input, invoke middleware, call services, shape response | Trusting client-supplied tenant/role, bypassing services for sensitive writes |
+| RBAC Middleware (`/middleware`) | Resolve session, actor, role and tenant | Domain mutations, broad data fetching |
+| Service Layer (`/services`) | Enforce domain invariants, call DB/Storage, write audit logs | Reading session itself, bypassing actor checks |
+| Database (`/schemas`) | Persist state, enforce same-tenant integrity, RLS and transactional mutation invariants | Browser-facing secrets or unscoped tenant access |
+| Storage | Private tenant-scoped objects, signed URLs after authorization | Public HR document/JD URLs |

 ## Security Baseline
-- Server-side RBAC is **mandatory** for every protected operation.
-- Frontend role checks are **UX-only** and never grant access.
-- The Supabase **service role key** is server-only and must never appear in any code path reachable from the browser.
-- Compensation data is admin-only and must never be selected in code paths that feed the org chart, employee directory, or AI prompts.
-- HTTPS only. Storage encrypted at rest via Supabase defaults.
-
-## V1 Domain Boundaries
-- employee directory
-- org visibility
-- onboarding document hub
-- minimal leave tracking
-- company updates
-
-Anything outside this list is V2.
-
-## V1 Scaling Posture
-Optimized for:
-- 10 paying customers
-- 6–25 employees per customer
-- founder-led onboarding and support
-
-Explicitly **not** optimized for: enterprise scale, multi-region, heavy concurrency, plugin ecosystems, workflow engines. Premature scalability is treated as scope drift.
+
+- Server-side RBAC is mandatory for every protected operation.
+- Frontend role checks are UX-only and never grant access.
+- Supabase service-role key is server-only.
+- Tenant identity must be server/JWT-derived, not client-supplied.
+- Same-tenant composite relationships are preferred for tenant-owned records.
+- Compensation and sensitive HR data must not leak through org chart, employee self-service or manager-delegated views.
+- Private Storage must use tenant-scoped paths and short-lived signed URLs.
+
+## Current Implemented Domains
+
+At baseline `489c9606441618e898f21eafb0443a9ca33474ad`, the current implemented foundation includes:
+
+- admin/employee authentication;
+- employee records;
+- position-based Org Chart;
+- onboarding templates/tasks;
+- policy publication and acknowledgement;
+- basic leave requests and decisions;
+- admin document upload/download/delete;
+- exports;
+- risk signals and action items;
+- audit logs;
+- file lifecycle records;
+- health checks.
+
+## Market-Ready Architecture Direction
+
+The market-ready programme requires controlled extension, not a rewrite.
+
+Architecture must add or extend support for:
+
+- canonical lifecycle projection;
+- event/rule/action/reminder/escalation/completion operating layer;
+- evidence-based completion;
+- document requests and employee upload;
+- policy file attachments and acknowledgement reminders;
+- leave types, simple balances and durable history;
+- bounded manager delegation;
+- employment-change history;
+- complete offboarding workflow;
+- reliability/product-truth closure.
+
+These are approved market-ready requirements when implemented according to `TEAMFRAME_MARKET_READY_EXECUTION_REGISTER.md`. They are not permission to build an enterprise workflow builder or broad HRIS platform.
+
+## Scaling Posture
+
+Optimise for the current target: founder-led teams with approximately 5-25 employees and no dedicated HR team.
+
+Do not prematurely optimise for enterprise scale, multi-region infrastructure, plugin ecosystems, complex approval hierarchy, timeclock/shift scheduling or broad custom workflow configuration.
diff --git a/docs/auth-rules.md b/docs/auth-rules.md
index ec957d3..e02744e 100644
--- a/docs/auth-rules.md
+++ b/docs/auth-rules.md
@@ -1,13 +1,13 @@
 # Auth Rules

-## Auth model (V1 — locked)
+## Auth Model

 - **Authentication method**: two-tier Supabase Auth
   - Admins: email + password at `/admin/login`
   - Employees: Magic Link at `/auth`
 - **No password reset flows** exist
 - **No OAuth providers** allowed (Google / GitHub / Microsoft / etc.)
-- **No MFA** in V1
+- **No MFA** in the current implemented auth model

 User identity is always:
 - a Supabase Auth user, keyed by email
@@ -40,6 +40,8 @@ User identity is always:

 Roles are **server-controlled** and never derived from client input.

+Guided company setup does not itself authorize public/open self-registration. A paid-customer administrator may be provisioned through a controlled onboarding path, after which ordinary company setup must not require developer or direct database intervention.
+
 - The `admin` role is set **only** via:
   - The Supabase Dashboard, or
   - The bootstrap script (`npm run seed:admin -- email@company.com`)
@@ -53,7 +55,7 @@ Roles are **server-controlled** and never derived from client input.
 - role passed in a request body, cookie, header, or query string
 - role inferred from email domain or any heuristic

-## Forbidden in V1
+## Currently Forbidden Without Separate Product/Security Approval

 - Sign-up form / open registration
 - Password reset or email-change flows
@@ -111,7 +113,7 @@ For production, replace the host with the production `SITE_URL`:
 ```

 Do not use password reset, invite-acceptance, OAuth, or MFA templates as product
-entry points in V1.
+entry points unless the auth model is separately approved and updated.

 ## Auth regression checklist

@@ -128,7 +130,7 @@ Manual round-trip — all must pass:
 - [ ] Cross-browser click works (link issued in browser A, opened in browser B)
 - [ ] No infinite redirect loop after successful login
 - [ ] Logout → login again works in the same browser session
-- [ ] Admin lands on `/dashboard` (employee accounts share the same dashboard in V1 — single workspace for the founder)
+- [ ] Admin lands on `/dashboard`; employee lands on the current employee self-service default route

 Diagnostic signature in dev logs after the `token_hash` switch — a successful
 login must look like:
diff --git a/docs/business/blueprint-locked.md b/docs/business/blueprint-locked.md
index 5771c40..158fcb4 100644
--- a/docs/business/blueprint-locked.md
+++ b/docs/business/blueprint-locked.md
@@ -1,3 +1,17 @@
+> **HISTORICAL / SUPERSEDED - NOT GOVERNING CURRENT MARKET-READY SCOPE**
+>
+> Date marked superseded: 2026-08-11.
+>
+> This document is retained as product provenance. It does not control the current market-ready programme where it conflicts with:
+>
+> - `TEAMFRAME_MARKET_READY_SCOPE.md`
+> - `TEAMFRAME_MARKET_READY_EXECUTION_REGISTER.md`
+> - `TEAMFRAME_DEFERRED_SCOPE.md`
+> - `TEAMFRAME_RELEASE_READINESS.md`
+>
+> In particular, older FPORS/V1 statements that TeamFrame is not an HR system, that reminders/workflows are permanently forbidden, or that leave balances/manager delegation/policy file upload/document requests are V2-only are superseded for the bounded market-ready programme.
+
+---
 # TeamFrame Blueprint — Locked

 **Status:** Locked. Do not re-debate without explicit founder approval.
diff --git a/docs/drift-guard.md b/docs/drift-guard.md
index f4bed17..afa7822 100644
--- a/docs/drift-guard.md
+++ b/docs/drift-guard.md
@@ -1,75 +1,40 @@
-# Drift Guard — Detailed Bans
+# Drift Guard - Market-Ready Programme

-Restates the scope bans already locked in [`README.md`](../README.md) and
-[`docs/business/blueprint-locked.md`](business/blueprint-locked.md). This file adds
-no new rules. If it ever disagrees with those sources, they win.
+**STATUS: CURRENT / MARKET-READY SCOPE GUARD**

----
+The previous V1 rules in this document are superseded. The rules below govern the current market-ready programme.

-## Banned features (README "What TeamFrame is NOT")
+Canonical replacements:

-Do not add any of the following (README, "What TeamFrame is NOT"):
+- [`../TEAMFRAME_MARKET_READY_SCOPE.md`](../TEAMFRAME_MARKET_READY_SCOPE.md)
+- [`../TEAMFRAME_MARKET_READY_EXECUTION_REGISTER.md`](../TEAMFRAME_MARKET_READY_EXECUTION_REGISTER.md)
+- [`../TEAMFRAME_DEFERRED_SCOPE.md`](../TEAMFRAME_DEFERRED_SCOPE.md)
+- [`../TEAMFRAME_RELEASE_READINESS.md`](../TEAMFRAME_RELEASE_READINESS.md)

-- payroll
-- benefits
-- accounting / tax / compliance engines
-- analytics dashboards / HR metrics / engagement scoring
-- AI HR advisor / chatbot / copilot
-- employee scoring, ranking, personality inference
-- hiring pipelines / ATS
-- onboarding **workflows** (tasks, reminders, checklists, automation states)
-- reminders / notifications engine
-- approvals engine, e-signatures, document versioning, retention engines
-- performance reviews, compensation benchmarking
-- integrations marketplace, Zapier/webhooks ecosystem
-- workflow orchestration, automation platform
-- plugin / extension systems
-- enterprise admin systems, custom RBAC beyond `admin` / `employee`
+## Current Rule

-If a feature resembles **enterprise HRIS**, **workflow automation**, or **AI assistant
-platform** behavior — it is **V2** and must be rejected.
+Use `TEAMFRAME_DEFERRED_SCOPE.md` for scope boundaries and `TEAMFRAME_MARKET_READY_EXECUTION_REGISTER.md` for implementation authority.

-## Deletion-on-sight categories (blueprint §12 "Hard Boundaries")
+Older statements that permanently banned reminders, escalations, leave balances, manager delegation, policy file upload, employee document upload, onboarding workflows or offboarding workflow are superseded for the market-ready programme.

-TeamFrame must NEVER become (blueprint-locked.md §12; also Hard Rule 4 in §"Hard rules"):
+These capabilities are allowed only in the bounded form defined by the canonical market-ready documents. They are not permission to build an enterprise HRIS, workflow builder, payroll engine, ATS, performance system, broad Settings maze or AI legal/compliance product.

-- payroll engine
-- ATS / recruitment tool
-- performance management system
-- compensation system
-- EOR platform
-- legal automation system
+## Still Hard-Banned

-Any feature proposal that drifts into these is rejected at intake.
+The following remain out of scope for the market-ready release unless a later product-owner decision explicitly changes the canonical scope:

-## Anti-drift rules (README "Anti-drift rules")
+- payroll calculation, tax filing, payslips and global payroll;
+- ATS/recruiting pipeline and offer management;
+- benefits administration;
+- performance ratings, goals, 360 reviews and engagement surveys;
+- LMS;
+- succession planning and workforce forecasting;
+- timeclock, shift scheduling and complex hourly workforce operations;
+- complex leave accrual/carry-over;
+- standalone asset management;
+- global compliance/legal engine and AI legal conclusions;
+- enterprise workflow builder, complex approval hierarchy and broad Settings maze.

-1. No new module unless it's already in the README allow list.
-2. No AI surface in V1 (see README "AI limitations" and `docs/ai-boundaries.md`).
-3. No new role beyond `admin` and `employee` (see `docs/rbac-rules.md`).
-4. No new background subsystem (queue, scheduler, worker, event bus) in V1.
-5. No premature scalability work (multi-region, sharding, microservices).
-6. No client-side authorization as a security boundary.
-7. No service-role key in any code path reachable from the browser.
+## Historical Note

-## Object model is closed (blueprint §5)
-
-Only the blueprint §5 objects exist (Person, Employment, Document, Asset, Policy,
-PolicyAcknowledgement, LeaveRequest, Event, RiskSignal, ActionItem). New objects
-require explicit blueprint amendment. Every feature must map to a Signal or an
-Action — no standalone modules (blueprint §5, Hard Rule 3).
-
-## Sanity check before any feature (README "Coding principles")
-
-1. Does this move setup closer to or further from 72-hour readiness?
-2. Does this reuse existing entities/tables?
-3. Does this introduce workflow automation, HR-ops logic, analytics, or AI scope creep?
-4. Can it ship without a new subsystem?
-
-If any answer trends toward complexity, the feature is **V2**.
-
-## Changing these rules
-
-This file is derivative. Change the source, not this file: README changes per the
-README's own contract ("the README wins until the README is changed"); blueprint
-changes require explicit founder approval per blueprint-locked.md §18.
+The original V1 drift guard was useful when TeamFrame was intentionally constrained to a smaller readiness product. The product owner has since approved a market-ready scope that restores bounded HR administration capabilities. Do not use old V1 wording to block canonical market-ready requirements.
diff --git a/docs/launch/README.md b/docs/launch/README.md
index 2a3d034..7503999 100644
--- a/docs/launch/README.md
+++ b/docs/launch/README.md
@@ -1,3 +1,17 @@
+> **HISTORICAL / SUPERSEDED - NOT GOVERNING CURRENT MARKET-READY SCOPE**
+>
+> Date marked superseded: 2026-08-11.
+>
+> This document is retained as product provenance. It does not control the current market-ready programme where it conflicts with:
+>
+> - `TEAMFRAME_MARKET_READY_SCOPE.md`
+> - `TEAMFRAME_MARKET_READY_EXECUTION_REGISTER.md`
+> - `TEAMFRAME_DEFERRED_SCOPE.md`
+> - `TEAMFRAME_RELEASE_READINESS.md`
+>
+> In particular, older FPORS/V1 statements that TeamFrame is not an HR system, that reminders/workflows are permanently forbidden, or that leave balances/manager delegation/policy file upload/document requests are V2-only are superseded for the bounded market-ready programme.
+
+---
 # Launch Hardening — TeamFrame Pre-Launch Reference

 This folder contains all artifacts related to the pre-launch hardening sprint. It covers the consolidated audit findings from five separate reviews, the batched execution plan, accepted risks register, operational runbooks, verification checklists, and the operational readiness checklist that must be completed before public launch.
diff --git a/docs/launch/accepted-risks.md b/docs/launch/accepted-risks.md
index 1b7a2dd..950f5df 100644
--- a/docs/launch/accepted-risks.md
+++ b/docs/launch/accepted-risks.md
@@ -1,3 +1,15 @@
+> **HISTORICAL / SUPERSEDED - NOT GOVERNING CURRENT MARKET-READY SCOPE**
+>
+> Date marked superseded: 2026-08-11.
+>
+> This audit is retained as historical evidence. Current scope and implementation authority live in:
+>
+> - `TEAMFRAME_MARKET_READY_SCOPE.md`
+> - `TEAMFRAME_MARKET_READY_EXECUTION_REGISTER.md`
+> - `TEAMFRAME_DEFERRED_SCOPE.md`
+> - `TEAMFRAME_RELEASE_READINESS.md`
+
+---
 # Accepted Risks and Deferred Work

 This document tracks architectural debt and consciously deferred items that are NOT considered launch blockers. Items listed here have been evaluated and intentionally scheduled for post-launch. This prevents deferred decisions from becoming forgotten decisions. When a revisit trigger is hit, move the item to the hardening backlog and open a tracking issue.
diff --git a/docs/launch/parking-lot.md b/docs/launch/parking-lot.md
index b231484..6c737c0 100644
--- a/docs/launch/parking-lot.md
+++ b/docs/launch/parking-lot.md
@@ -1,3 +1,17 @@
+> **HISTORICAL / SUPERSEDED - NOT GOVERNING CURRENT MARKET-READY SCOPE**
+>
+> Date marked superseded: 2026-08-11.
+>
+> This document is retained as product provenance. It does not control the current market-ready programme where it conflicts with:
+>
+> - `TEAMFRAME_MARKET_READY_SCOPE.md`
+> - `TEAMFRAME_MARKET_READY_EXECUTION_REGISTER.md`
+> - `TEAMFRAME_DEFERRED_SCOPE.md`
+> - `TEAMFRAME_RELEASE_READINESS.md`
+>
+> In particular, older FPORS/V1 statements that TeamFrame is not an HR system, that reminders/workflows are permanently forbidden, or that leave balances/manager delegation/policy file upload/document requests are V2-only are superseded for the bounded market-ready programme.
+
+---
 # Parking Lot — TeamFrame Phase 1A

 Items noticed during Weekend 1 execution but not acted on (out of scope per scope lock).
diff --git a/docs/launch/readiness-log.md b/docs/launch/readiness-log.md
index 9d74be4..c4bc45b 100644
--- a/docs/launch/readiness-log.md
+++ b/docs/launch/readiness-log.md
@@ -1,3 +1,15 @@
+> **HISTORICAL / SUPERSEDED - NOT GOVERNING CURRENT MARKET-READY SCOPE**
+>
+> Date marked superseded: 2026-08-11.
+>
+> This audit is retained as historical evidence. Current scope and implementation authority live in:
+>
+> - `TEAMFRAME_MARKET_READY_SCOPE.md`
+> - `TEAMFRAME_MARKET_READY_EXECUTION_REGISTER.md`
+> - `TEAMFRAME_DEFERRED_SCOPE.md`
+> - `TEAMFRAME_RELEASE_READINESS.md`
+
+---
 # Readiness Log — TeamFrame

 Tracks the status of each weekend execution block as it completes.
diff --git a/docs/product/gap-audit-2026-05-30.md b/docs/product/gap-audit-2026-05-30.md
index 9f740d4..930ddae 100644
--- a/docs/product/gap-audit-2026-05-30.md
+++ b/docs/product/gap-audit-2026-05-30.md
@@ -1,3 +1,15 @@
+> **HISTORICAL / SUPERSEDED - NOT GOVERNING CURRENT MARKET-READY SCOPE**
+>
+> Date marked superseded: 2026-08-11.
+>
+> This audit is retained as historical evidence. Current scope and implementation authority live in:
+>
+> - `TEAMFRAME_MARKET_READY_SCOPE.md`
+> - `TEAMFRAME_MARKET_READY_EXECUTION_REGISTER.md`
+> - `TEAMFRAME_DEFERRED_SCOPE.md`
+> - `TEAMFRAME_RELEASE_READINESS.md`
+
+---
 # TeamFrame — Product Gap Audit

 **Date:** 2026-05-30
diff --git a/docs/rbac-rules.md b/docs/rbac-rules.md
index c3bbf07..e63729a 100644
--- a/docs/rbac-rules.md
+++ b/docs/rbac-rules.md
@@ -1,69 +1,97 @@
 # RBAC Rules

 ## Core Rule
-**All authorization is enforced server-side.** Client-side checks are UX hints only and never grant access.

-Authentication is two-tier (see [`auth-rules.md`](auth-rules.md)): admins use email + password at `/admin/login`; employees use magic links at `/auth`. No password reset, email change, OAuth, or MFA in V1.
+All authorization is enforced server-side. Client-side checks are UX hints only and never grant access.

-## Roles
-TeamFrame V1 has exactly two roles:
+Authentication is currently two-tier:
+
+- admins use email + password at `/admin/login`;
+- employees use magic links at `/auth`.
+
+See [`auth-rules.md`](auth-rules.md).
+
+## Current Implemented Roles
+
+At baseline `489c9606441618e898f21eafb0443a9ca33474ad`, TeamFrame has two implemented roles:

 1. `admin`
 2. `employee`

-No other roles exist in V1. Do not introduce manager, hr, finance, viewer, owner, or custom roles — that is V2.
+The market-ready programme approves **bounded manager delegation**, but it has not yet been implemented. Do not add ad hoc roles or client-side role shortcuts. Manager delegation must be designed and tested under `TEAMFRAME_MARKET_READY_EXECUTION_REGISTER.md`, especially `TF-MR-008`.
+
+## Market-Ready Manager Delegation Boundary
+
+When TF-MR-008 is implemented, managers may, for authorised direct reports only:
+
+- approve/decline leave;
+- contribute to onboarding;
+- provide probation input;
+- complete manager-owned tasks;
+- receive routine escalations.
+
+Managers do not automatically gain:

-## Capability Matrix
+- private HR document access;
+- company-wide employee access;
+- policy administration;
+- tenant administration;
+- confidential employee-relations information;
+- unrestricted employment-change authority.
+
+Prefer deriving manager/reporting relationships from existing employee/org structure where technically safe. No enterprise RBAC.
+
+## Current Capability Matrix

 | Capability | admin | employee |
-|---|:-:|:-:|
-| List all employees | ✅ | ✅ (org chart fields only) |
-| View own profile | ✅ | ✅ |
-| View any profile (full) | ✅ | ❌ |
-| Create / update / delete employee | ✅ | ❌ |
-| View / edit compensation | ✅ | ❌ |
-| Upload document for any employee | ✅ | ❌ |
-| Upload own document | ✅ | ✅ (where allowed by flow) |
-| Submit own leave request | ✅ | ✅ |
-| Approve / reject leave | ✅ | ❌ |
-| Post company update | ✅ | ❌ |
-| View company updates | ✅ | ✅ |
-| Generate bio from CV (AI) | ✅ | ❌ |
-| Generate contract template (AI) | ✅ | ❌ |
-
-## Org Chart — Non-Sensitive Field Whitelist
-When an employee views the org chart, only these fields may be returned:
+| --- | :-: | :-: |
+| List all employees | yes | limited org/public fields only where exposed |
+| View own profile | yes | yes |
+| View any profile in full | yes | no |
+| Create/update/archive employee | yes | no |
+| View/edit compensation | yes, where implemented | no |
+| Upload document for any employee | yes | no current general self-upload workflow |
+| Submit own leave request | yes, if linked employee | yes |
+| Approve/reject leave | yes | no |
+| Manage policies | yes | no |
+| Acknowledge assigned policies | no normal admin need | yes |
+| Manage Org Chart positions/JDs | yes | no |
+| Generate exports | yes | no |
+
+## Org Chart And Employee-Scope Field Whitelist
+
+When non-admin employee/org views are exposed, return only non-sensitive organisation fields unless an explicit employee self-service flow authorises more:
+
 - `id`
 - `full_name`
 - `role_title`
 - `department`
 - `manager_id`
-- `photo_url` (from `employee_profiles`)
-- `status` (limited to `active` / `on_leave` / `inactive`)
+- `status` / lifecycle-safe public equivalent

-Compensation, personal details, email (optional), and document references must **never** be selected in employee-scope queries.
+Compensation, private contact details, HR documents, policy administration data and confidential records must not be selected in employee-scope or future manager-scope queries unless specifically authorised and tested.

 ## Enforcement Pattern

-```
+```text
 Request
-  → resolve Supabase session (middleware/auth.ts)
-  → resolve actor (middleware/rbac.ts):
-        auth.users.id  →  employees.email  →  employees.id
-        app_metadata.role  →  'admin' | 'employee'
-  → call requireRole('admin') or requireSelfOrAdmin(targetEmployeeId)
-  → service layer executes scoped query
+  -> resolve Supabase session
+  -> resolve actor server-side
+  -> derive tenant and role from trusted metadata/database state
+  -> call role/tenant guard
+  -> service layer executes scoped query or mutation
 ```

-Service-layer functions accept an explicit `Actor` argument
-(`{ authUserId, email, employeeId, role }`) and re-validate authorization.
-They never read the session themselves.
+Service-layer functions accept an explicit `Actor` argument and re-validate authorization. They never trust role, tenant or employee identifiers supplied by a browser as authority.

 ## Audit
-Sensitive admin actions (employee delete, compensation change, document delete, leave approval/rejection, bulk export) must write a row to `audit_logs` from the service layer.
+
+Sensitive admin, future manager-delegated and storage-affecting actions must write audit evidence from the service layer or transactional database mutation path.

 ## Forbidden
-- frontend-only "if role === admin" as a security boundary
-- exposing the Supabase service role key to the browser
-- accepting a role from a request body, cookie, or query string
-- adding new roles to satisfy a one-off feature
+
+- Frontend-only `role === admin` or `role === manager` as a security boundary.
+- Supabase service-role key in browser-reachable code.
+- Role, tenant or manager scope accepted from request body, cookie, header or query string as authority.
+- Broad custom roles to satisfy one-off features.
+- Manager delegation implemented without tenant, direct-report and negative authorization tests.

# New file: TEAMFRAME_MARKET_READY_SCOPE.md

diff --git a/TEAMFRAME_MARKET_READY_SCOPE.md b/TEAMFRAME_MARKET_READY_SCOPE.md
new file mode 100644
index 0000000..cd5b0e3
--- /dev/null
+++ b/TEAMFRAME_MARKET_READY_SCOPE.md
@@ -0,0 +1,832 @@
+# TEAMFRAME — MARKET-READY CANONICAL SCOPE
+## Governing Product Definition for Market-Ready Implementation
+
+**STATUS: CANONICAL / CONTROLLING**
+**Purpose:** Freeze the market-ready TeamFrame product scope for bounded implementation.
+**Audience:** Product owner, Codex, engineering reviewers, QA/release reviewers.
+**Important:** Where older repository documents conflict with this file, this file controls unless explicitly superseded by a later product-owner decision.
+
+---
+
+# 1. CANONICAL PRODUCT DEFINITION
+
+> **TeamFrame is the essential HR system for startups without a dedicated HR team.**
+
+It gives founders and small teams the essential tools to manage everyday HR responsibilities simply, correctly and consistently — without the complexity of traditional HR software.
+
+The product hierarchy is:
+
+1. **Basic HR administration = the product**
+2. **Signal → Action → Resolution = an operating mechanism**
+3. **Readiness, evidence and auditability = supporting outcomes**
+
+TeamFrame is not primarily:
+
+- a compliance platform;
+- a readiness platform;
+- an evidence platform;
+- a policy-acknowledgement product;
+- a workflow engine;
+- an enterprise HRIS.
+
+Technical verification: **COMPLETE**.
+Baseline: `489c9606441618e898f21eafb0443a9ca33474ad`.
+Final technical verdict: controlled extension, no rewrite required.
+Product-scope reconciliation: **COMPLETE**.
+Next phase: bounded implementation against `TEAMFRAME_MARKET_READY_EXECUTION_REGISTER.md`.
+
+---
+
+# 2. TARGET CUSTOMER
+
+Initial target:
+
+- founder-led startups and small businesses;
+- approximately **5–25 employees**;
+- no dedicated HR team;
+- primarily salaried / knowledge-worker businesses.
+
+Typical examples:
+
+- SaaS;
+- fintech;
+- professional services;
+- consultancy;
+- agencies;
+- similar office-based startups and small businesses.
+
+TeamFrame should not initially optimise for:
+
+- shift-heavy hospitality;
+- manufacturing;
+- complex hourly workforces;
+- multi-location time-and-attendance operations.
+
+Those use cases require scheduling, timeclock and overtime complexity that is outside the initial product scope.
+
+---
+
+# 3. PRODUCT OPERATING PRINCIPLE
+
+TeamFrame should follow:
+
+> **Capture once → trigger automatically → propagate automatically → remind automatically → close automatically where evidence permits → escalate only when human judgement is required.**
+
+The founder should primarily spend time on:
+
+- decisions;
+- approvals;
+- exceptions;
+- sensitive employee matters;
+- professional judgement.
+
+The founder should not repeatedly spend time on:
+
+- remembering routine HR actions;
+- chasing employees;
+- recreating data;
+- manually propagating information between modules;
+- manually calculating obvious dates;
+- manually closing tasks where TeamFrame already has proof of completion;
+- checking several modules to understand one employee's state.
+
+---
+
+# 4. PROFESSIONAL SIMPLICITY
+
+TeamFrame must feel like a professional executive HR work queue, not a tutorial or consumer productivity app.
+
+Language should be:
+
+- concise;
+- adult;
+- specific;
+- factual;
+- operational.
+
+Avoid:
+
+- cheerleading;
+- childish progress language;
+- patronising explanations;
+- unnecessary conversational copy;
+- vague success/failure states.
+
+Preferred pattern:
+
+> **Probation review due in 7 days**
+> Daniel Reyes · Software Engineer
+> Owner: Sara Founder
+> **Review**
+
+---
+
+# 5. CANONICAL EMPLOYEE LIFECYCLE
+
+Market-ready implementation must express one authoritative lifecycle projection.
+
+The intended conceptual model is:
+
+> **PRE-START → ONBOARDING → ACTIVE → OFFBOARDING → FORMER**
+
+The implementation does not have to use these exact enum names if the current architecture already supports the same truth safely.
+
+However, market-ready TeamFrame must avoid competing independent status models that allow contradictory states.
+
+Lifecycle state must correctly influence:
+
+- active employee counts;
+- onboarding;
+- policy assignment and denominators;
+- reminders;
+- leave;
+- employee self-service;
+- Org Chart;
+- offboarding;
+- exports;
+- dashboard work;
+- archive/former-employee behaviour.
+
+A future-dated employee should not be treated identically to a fully active employee.
+
+A former employee must not continue generating normal active-HR obligations.
+
+---
+
+# 6. MARKET-READY CORE CAPABILITIES
+
+## 6.1 COMPANY SETUP
+
+A new paying customer must be able to initialize TeamFrame without developer intervention.
+
+Keep this minimal and guided, not a large Settings system.
+
+Minimum direction:
+
+- company identity;
+- country/location;
+- administrator;
+- basic workweek or relevant defaults where required;
+- simple leave defaults;
+- initial organisational structure;
+- first employees.
+
+The preferred experience is a guided setup flow.
+
+---
+
+## 6.2 PEOPLE
+
+TeamFrame must maintain an authoritative employee/contractor record.
+
+Core information includes, where relevant:
+
+- legal/preferred name;
+- contact details;
+- emergency contact;
+- employment type;
+- lifecycle/status;
+- start date;
+- end date;
+- probation information;
+- manager/reporting relationship;
+- position;
+- department;
+- location;
+- work arrangement;
+- contract type;
+- relevant compensation basics if required by payroll handoff;
+- employment history / effective-dated changes.
+
+Employment changes must not silently overwrite history.
+
+---
+
+## 6.3 ORGANISATION
+
+Core Org capability:
+
+- positions;
+- reporting structure;
+- filled/vacant state;
+- employee assignment;
+- job-description attachment;
+- unassigned employees;
+- position vacancy on departure/archive.
+
+Do not expand into:
+
+- ATS;
+- recruiting pipeline;
+- succession planning;
+- advanced workforce planning.
+
+Employee, position and reporting data should remain synchronized without duplicate maintenance.
+
+---
+
+## 6.4 ONBOARDING / JOIN
+
+TeamFrame must support repeatable onboarding.
+
+Core:
+
+- onboarding packs/templates;
+- automatic or strongly inferred pack assignment from known employee data;
+- task ownership;
+- due dates;
+- employee/admin/manager tasks where appropriate;
+- policy assignment;
+- document requirements;
+- first-day readiness;
+- reminders;
+- overdue escalation;
+- evidence-backed completion.
+
+Preferred behavior:
+
+> employee created
+> → appropriate onboarding generated automatically
+> → due dates calculated
+> → tasks assigned
+> → employee invited
+> → required documents requested
+> → policies assigned
+> → founder sees only decisions/exceptions.
+
+Do not blindly create organisation positions from free-text job titles without confirmation.
+
+---
+
+## 6.5 30-DAY ONBOARDING CHECK-IN
+
+This is **approved market-ready core scope**.
+
+Purpose:
+
+> **Did onboarding actually work for the employee?**
+
+Not:
+
+> **How good is this employee?**
+
+Expected lightweight flow:
+
+> employee starts
+> → approximately 30 days elapse
+> → short employee onboarding evaluation/check-in issued automatically
+> → employee completes it
+> → only material issues create manager/founder follow-up.
+
+The employee check-in should remain short and practical.
+
+Example topics:
+
+- role clarity;
+- manager/team clarity;
+- tools/access;
+- training;
+- policy understanding;
+- support/help;
+- blockers;
+- what could improve.
+
+Do not turn this into performance management.
+
+---
+
+## 6.6 PROBATION
+
+This is **approved market-ready core scope**.
+
+Expected basic flow:
+
+> probation end date known
+> → review opens automatically at the appropriate time
+> → reminders are generated
+> → human outcome is recorded
+> → employment history/lifecycle updates.
+
+Human judgement must remain human.
+
+Do not build:
+
+- ratings matrices;
+- competencies;
+- 360 reviews;
+- performance cycles.
+
+---
+
+## 6.7 DOCUMENTS
+
+Documents are a first-class core capability.
+
+Market-ready loop:
+
+> document required
+> → employee sees request
+> → employee uploads permitted document
+> → TeamFrame stores and categorises it securely
+> → requirement closes automatically when evidence is valid
+> → reminders stop
+> → expiry is monitored
+> → replacement can satisfy renewal requirement
+> → history remains.
+
+Core:
+
+- secure private storage;
+- categories;
+- employee/admin permissions;
+- employee upload where appropriate;
+- admin upload;
+- document request/requirement object;
+- expiry dates;
+- reminders;
+- replacement/history;
+- evidence-linked task completion.
+
+A task such as “Upload signed NDA” must not be completable merely through “Mark done” when no NDA exists.
+
+---
+
+## 6.8 POLICIES
+
+Policies remain one component of TeamFrame, not the product identity.
+
+Canonical operating model:
+
+> **HYBRID — file upload is the normal path; simple in-app authoring may remain.**
+
+Normal path:
+
+> policy prepared externally
+> → PDF/DOCX uploaded
+> → title/version/effective date recorded
+> → published
+> → relevant employees assigned
+> → acknowledgement requested
+> → reminders/escalation
+> → historical version retained.
+
+Core:
+
+- upload/create;
+- versioning;
+- publish;
+- distribution;
+- version-specific acknowledgement;
+- reminders;
+- archived-history retention;
+- active obligations filtered correctly.
+
+Archived versions may preserve historical acknowledgement evidence but must not generate active obligations.
+
+Former employees must not contaminate current acknowledgement counts.
+
+---
+
+## 6.9 LEAVE
+
+Basic leave administration is **market-ready core**.
+
+Core:
+
+- leave type;
+- simple entitlement/allocation;
+- current balance;
+- employee request;
+- date validation;
+- overlap/conflict detection;
+- approval/decline;
+- durable leave/absence history;
+- employee visibility.
+
+Preferred behavior:
+
+> request submitted
+> → deterministic validation runs
+> → correct approver receives it
+> → human decides
+> → leave history/balance updates automatically
+> → relevant downstream information updates.
+
+Core balance can remain simple.
+
+Do not build for launch:
+
+- advanced accrual engines;
+- complex carry-forward;
+- jurisdiction-specific statutory leave logic;
+- time and attendance;
+- shift scheduling.
+
+A lightweight “Who’s Away” view is useful but may remain secondary if the core absence record is correct.
+
+---
+
+## 6.10 EMPLOYMENT CHANGES
+
+Common changes should be structured HR events rather than silent field overwrites.
+
+Examples:
+
+- manager;
+- position;
+- employment type;
+- location;
+- department;
+- work arrangement;
+- compensation where relevant;
+- contract;
+- promotion.
+
+Requirements:
+
+- effective date;
+- previous value/history;
+- downstream propagation;
+- appropriate audit history.
+
+Human approval remains human.
+
+---
+
+## 6.11 LIGHTWEIGHT MANAGER DELEGATION
+
+TeamFrame must be viable up to approximately 25 employees without every routine action terminating at the founder.
+
+Market-ready scope includes bounded direct-report operational delegation.
+
+Preferred direction where feasible:
+
+> employee → occupied position → reporting position → manager
+
+Potential manager responsibilities:
+
+- leave approval;
+- onboarding contribution;
+- probation input;
+- routine team follow-up.
+
+Do not build:
+
+- complex enterprise RBAC;
+- multi-level workflow builders;
+- elaborate approval hierarchies.
+
+---
+
+## 6.12 OFFBOARDING
+
+Offboarding is **market-ready core**.
+
+Expected trigger:
+
+> resignation / termination / departure recorded
+
+Then TeamFrame should support the minimum essential exit workflow:
+
+- end date;
+- notice/final HR information;
+- final leave/payroll inputs where relevant;
+- handover;
+- access-removal checklist;
+- asset return as a checklist item, not an asset-management module;
+- final documents;
+- Org Chart vacancy;
+- suppression of inappropriate future reminders;
+- archive/former transition;
+- historical record retention.
+
+Human departure/termination decisions remain manual.
+
+Routine follow-up should be generated automatically.
+
+---
+
+## 6.13 HR CONTROL CENTRE
+
+The founder needs one trustworthy operational view of HR work.
+
+It should surface:
+
+- due/overdue work;
+- approvals;
+- probation;
+- onboarding;
+- document expiry;
+- policy exceptions;
+- offboarding;
+- meaningful employee lifecycle exceptions.
+
+Signal → Action → Resolution remains useful as the operating mechanism, but not every routine item needs to become a Signal.
+
+Distinguish:
+
+- normal task;
+- due soon;
+- overdue;
+- decision;
+- exception.
+
+Avoid noise.
+
+Resolution/history must remain durable and truthful.
+
+---
+
+# 7. AUTOMATION AND REMINDER MODEL
+
+Technical architecture is not frozen yet.
+
+Codex must inspect current primitives before recommending architecture.
+
+Product behavior must nevertheless support:
+
+> Event → Rule → Action → Owner → Due date → Reminder → Escalation → Completion condition
+
+Where appropriate.
+
+The system should favor:
+
+### SILENT BACKGROUND
+For normal propagation, recalculation and automatic closure.
+
+### ROUTINE REMINDER
+Employee/manager reminder without founder involvement.
+
+### ESCALATION
+Founder/manager sees persistent non-response or meaningful risk.
+
+### DECISION
+Human judgement is required.
+
+Do not replace manual work with notification noise.
+
+---
+
+# 8. COMPLETION TRUTH
+
+TeamFrame must distinguish:
+
+## EVIDENCE-VERIFIABLE COMPLETION
+
+Examples:
+
+- document uploaded;
+- policy acknowledged;
+- required form submitted;
+- required data completed.
+
+The system should close these automatically when the evidence exists.
+
+## HUMAN-CONFIRMABLE COMPLETION
+
+Examples:
+
+- welcome meeting held;
+- handover meeting completed;
+- verbal discussion conducted.
+
+Human confirmation is acceptable.
+
+Manual completion must not be used as a substitute for evidence TeamFrame can verify itself.
+
+---
+
+# 9. RELIABILITY AND PRODUCT TRUTH
+
+Market-ready TeamFrame must never make the founder guess whether an action succeeded.
+
+Known behaviors requiring technical verification/repair include:
+
+- actions returning 503 while mutations may have persisted;
+- export failures;
+- ambiguous success/failure;
+- stale counters;
+- archived employee contamination;
+- disappearing Resolution history;
+- false-success vacant-position deletion.
+
+Specific known reliability item:
+
+> **TF-BUG-001 — Vacant position deletion reports success while the position remains.**
+
+This is a browser-observed reliability finding requiring runtime-regression verification against the current implementation. If reproduced on the current implementation, it becomes a release-blocking correctness defect.
+
+---
+
+# 10. PAYROLL / FINANCE HANDOFF
+
+TeamFrame must not become a payroll engine.
+
+A finance handoff export already exists and must be technically verified before expanding scope.
+
+The product may automatically compile payroll-relevant HR changes where useful, such as:
+
+- starters;
+- leavers;
+- employment changes;
+- salary changes if salary data exists within approved scope;
+- unpaid leave where identifiable.
+
+The founder/accountant reviews or exports the handoff.
+
+Do not build:
+
+- payroll calculation;
+- tax calculation;
+- statutory filing;
+- full compensation management;
+- bonuses/reimbursements/overtime workflows unless separately approved.
+
+---
+
+# 11. EXPLICITLY DEFERRED / OUT OF SCOPE
+
+Do not build for the market-ready release:
+
+- ATS/recruiting pipeline;
+- offer management;
+- payroll calculation/tax filing;
+- global payroll engine;
+- benefits administration/brokerage;
+- advanced performance management;
+- ratings;
+- goals;
+- 360 reviews;
+- engagement surveys;
+- LMS;
+- succession planning;
+- workforce forecasting;
+- shift scheduling;
+- timeclock/time-and-attendance;
+- advanced leave accrual/carry-forward engines;
+- complex compensation management;
+- reimbursements;
+- overtime management;
+- standalone asset-management module;
+- global legal/compliance rule engine;
+- AI legal conclusions;
+- enterprise workflow builder;
+- complex approval hierarchy;
+- advanced analytics/report builder;
+- broad configuration/settings maze.
+
+---
+
+# 12. DESIGN / BRAND STATUS
+
+The current approved visual direction remains frozen.
+
+Do not reopen:
+
+- Direction B / Signature Signal;
+- current brand palette;
+- green-scarcity principle;
+- Org Chart visual direction;
+- general typography/component system.
+
+Only make UI changes required to support approved functionality, truthful state, accessibility or operational clarity.
+
+This market-ready programme is not a redesign exercise.
+
+---
+
+# 13. MARKET-READY ROOT WORKSTREAMS
+
+The current product scope is organized into these root workstreams.
+
+These are product workstreams, not assumed technical architecture.
+
+## MR-0 — GUIDED COMPANY SETUP
+- company identity;
+- country/location;
+- administrator;
+- basic defaults;
+- initial organisation structure;
+- first employees through the canonical lifecycle.
+
+## MR-1 — COMPANY & EMPLOYEE LIFECYCLE
+- lifecycle truth;
+- pre-start/onboarding/active/offboarding/former;
+- end-date/archive semantics;
+- active-work filtering.
+
+## MR-2 — HR EVENT & AUTOMATION
+- propagation;
+- scheduled actions;
+- reminders;
+- escalation;
+- completion conditions.
+
+## MR-3 — PEOPLE / ORGANISATION / DELEGATION
+- authoritative people record;
+- positions;
+- reporting;
+- manager linkage;
+- employment-change history;
+- lightweight manager routing.
+
+## MR-4 — JOIN / EARLY EMPLOYMENT
+- automatic onboarding;
+- document requirements;
+- 30-day evaluation;
+- probation.
+
+## MR-5 — DOCUMENTS & POLICIES
+- document request/upload/expiry/completion;
+- policy upload/editor hybrid;
+- versioning;
+- acknowledgement/reminders.
+
+## MR-6 — LEAVE
+- type;
+- simple allocation/balance;
+- conflict detection;
+- approval;
+- durable absence/history.
+
+## MR-7 — OFFBOARDING
+- end date;
+- generated exit work;
+- relevant handover/access/asset checklist;
+- final HR actions;
+- archive transition.
+
+## MR-8 — RELIABILITY & PRODUCT TRUTH
+- 503 ambiguity;
+- exports;
+- counters;
+- durable Resolution/history;
+- archived contamination;
+- false-success deletion;
+- deterministic error handling.
+
+---
+
+# 14. MARKET-READY FINISH LINE
+
+TeamFrame is market-ready when a new target startup can:
+
+1. create/setup its company without developer intervention;
+2. add employees;
+3. maintain the authoritative employee and organisation record;
+4. onboard employees;
+5. collect required documents;
+6. distribute and track policies;
+7. manage basic leave;
+8. handle 30-day and probation milestones;
+9. record normal employment changes;
+10. offboard employees;
+11. delegate appropriate routine manager actions;
+12. rely on TeamFrame to automatically handle predictable follow-up;
+13. trust that displayed states, history, exports and completion are correct.
+
+The founder should mainly perform:
+
+> **decisions and exceptions**
+
+rather than:
+
+> **routine HR administration.**
+
+The system should be usable without the TeamFrame team manually configuring, explaining or repairing ordinary customer workflows.
+
+---
+
+# 15. GOVERNANCE FOR NEXT PHASE
+
+## Technical verification
+
+Technical verification is complete at baseline `489c9606441618e898f21eafb0443a9ca33474ad`.
+
+## Scope reconciliation
+
+Product-scope reconciliation is complete. The current governing set is:
+
+- `TEAMFRAME_MARKET_READY_SCOPE.md`;
+- `TEAMFRAME_MARKET_READY_EXECUTION_REGISTER.md`;
+- `TEAMFRAME_AUTOMATION_REGISTER.md`;
+- `TEAMFRAME_DEFERRED_SCOPE.md`;
+- `TEAMFRAME_RELEASE_READINESS.md`.
+
+## Implementation
+
+Codex then executes bounded workstreams.
+
+Each workstream must be:
+
+> implemented → tested → independently reviewed → locked
+
+before unnecessary new scope is introduced.
+
+---
+
+# 16. CONTROLLING PRINCIPLE
+
+> **A founder enters the HR fact once. TeamFrame handles the predictable administration around it automatically and professionally, keeps the record truthful, and interrupts the founder only when a real decision or exception requires human judgement.**
+
+That is the market-ready TeamFrame product.

# New file: TEAMFRAME_MARKET_READY_EXECUTION_REGISTER.md

diff --git a/TEAMFRAME_MARKET_READY_EXECUTION_REGISTER.md b/TEAMFRAME_MARKET_READY_EXECUTION_REGISTER.md
new file mode 100644
index 0000000..23e7a4a
--- /dev/null
+++ b/TEAMFRAME_MARKET_READY_EXECUTION_REGISTER.md
@@ -0,0 +1,116 @@
+# TeamFrame Market-Ready Execution Register
+
+**STATUS: CANONICAL / CONTROLLING IMPLEMENTATION REGISTER**
+
+This register consolidates the approved market-ready scope, Claude browser findings as behavioural evidence, and Codex technical verification into root implementation requirements. It does not use Claude AG numbering as canonical repository numbering.
+
+Where older repository documents conflict with this register, this register and `TEAMFRAME_MARKET_READY_SCOPE.md` control unless explicitly superseded by a later product-owner decision.
+
+## Provenance
+
+| Item | Value |
+| --- | --- |
+| Controlling scope | `TEAMFRAME_MARKET_READY_SCOPE.md` |
+| Technical verification report | `C:\Users\isuda\Dev\TeamFrame-technical-verification-2026-08-11\TEAMFRAME_TECHNICAL_VERIFICATION.md` |
+| Technical verification SHA-256 | `20153BD3871EE5D5BED2B545E2C72507C3B9DCECCFC1F9A5D33F5082DED7E1D8` |
+| Verification baseline | `489c9606441618e898f21eafb0443a9ca33474ad` |
+| Typecheck | PASS |
+| Lint | PASS |
+| Tests | PASS, 20 files / 104 tests |
+| Guards | PASS, 4/4 |
+| Build | PASS |
+
+Technical verification confirms the starting foundation only. It does not mean market-ready implementation is complete.
+
+## Decision Values
+
+Allowed `Decision` values:
+
+- IMPLEMENT
+- DEFER
+- OUT OF SCOPE
+- VERIFY DURING IMPLEMENTATION
+
+Allowed `Implementation status` values:
+
+- NOT STARTED
+- IN PROGRESS
+- IMPLEMENTED
+- BLOCKED
+
+Allowed `Verification status` values:
+
+- NOT VERIFIED
+- SOURCE VERIFIED
+- RUNTIME VERIFIED
+- LOCKED
+
+Priority meanings:
+
+- **P0** = foundational / market-ready blocker.
+- **P1** = required market-ready integration following foundation.
+- **P2** = release hardening / closure.
+
+## Existing Foundation
+
+Use these primitives where possible:
+
+- employee records;
+- positions/org hierarchy;
+- manager_id;
+- policy/version acknowledgement;
+- signal/action persistence;
+- audit logging;
+- transactional RPC pattern;
+- private file lifecycle;
+- same-tenant constraints;
+- RLS;
+- file validation;
+- basic leave records;
+- onboarding templates;
+- export machinery.
+
+Do not mark a market-ready requirement implemented merely because a partial primitive exists.
+
+## Root Requirements
+
+| ID | Workstream | Requirement | Current technical state | Decision | Priority | Dependencies | Implementation status | Verification status | Notes |
+| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
+| TF-MR-001 | MR-0 - Guided Company Setup | Add minimal guided setup for company identity, country/location, administrator, basic leave defaults, initial organisation structure and first employees. | No normal customer setup route; setup relies on scripts/admin provisioning. | IMPLEMENT | P0 | None | NOT STARTED | SOURCE VERIFIED | Company/tenant metadata setup can begin independently; first-employee creation must use the canonical lifecycle from TF-MR-002. |
+| TF-MR-002 | MR-1 - Company & Employee Lifecycle | Define one authoritative lifecycle projection for PRE_START -> ONBOARDING -> ACTIVE -> OFFBOARDING -> FORMER. | Current fields include `status`, `setup_status`, `lifecycle_state`, `deleted_at`, start/end dates. | IMPLEMENT | P0 | None | NOT STARTED | SOURCE VERIFIED | Exact enum names are not frozen. Legacy compatibility may remain behind one projection. |
+| TF-MR-003 | MR-1 - Company & Employee Lifecycle | Ensure lifecycle controls active counts, policies, onboarding, reminders, leave, self-service, Org Chart, dashboard work and former/archive behaviour. | Filtering exists per module but is not governed by one lifecycle model. | IMPLEMENT | P0 | TF-MR-002 | NOT STARTED | NOT VERIFIED | Prevent future-dated/former employees from behaving like active employees. |
+| TF-MR-004 | MR-2 - HR Event & Automation Layer | Build reusable Event -> Rule -> Action -> Owner -> Due -> Reminder -> Escalation -> Completion mechanism. | Signal reconcilers and audit/events exist; no scheduler, queue, reminder or escalation engine. | IMPLEMENT | P0 | TF-MR-002 | NOT STARTED | SOURCE VERIFIED | Keep opinionated defaults; do not build a workflow builder. |
+| TF-MR-005 | MR-2 - HR Event & Automation Layer | Implement reminder/escalation levels: BACKGROUND, ROUTINE REMINDER, ESCALATION, DECISION. | No generic reminder/escalation model. | IMPLEMENT | P0 | TF-MR-004 | NOT STARTED | NOT VERIFIED | Exact day/hour defaults are not frozen. |
+| TF-MR-006 | MR-2 - HR Event & Automation Layer | Make completion suppress future reminders without suppressing legitimate recurrence. | Signal/action suppression exists in places; no general completion condition model. | IMPLEMENT | P0 | TF-MR-004, TF-MR-009 | NOT STARTED | NOT VERIFIED | Must be idempotent and tenant-scoped. |
+| TF-MR-007 | MR-3 - People / Organisation / Delegation | Preserve and integrate position-first Org Chart with lifecycle and employee records. | Org Chart implemented with positions, reporting, filled/vacant state and JD attachments. | VERIFY DURING IMPLEMENTATION | P1 | TF-MR-002 | NOT STARTED | SOURCE VERIFIED | Existing module is foundation; verify position vacancy on departure/archive. |
+| TF-MR-008 | MR-3 - People / Organisation / Delegation | Add bounded manager delegation for direct reports where authorised. | `manager_id` and reporting structure exist, but no manager role/scope workflow. | IMPLEMENT | P1 | TF-MR-002, TF-MR-004 | NOT STARTED | SOURCE VERIFIED | No enterprise RBAC. Managers do not gain broad HR access. |
+| TF-MR-009 | MR-3 - People / Organisation / Delegation | Add structured employment changes with effective dates, previous values, history and downstream propagation. | Employee update patches current row and writes audit; no change-history table. | IMPLEMENT | P0 | TF-MR-002 | NOT STARTED | SOURCE VERIFIED | Covers manager, position, department, location, employment type and related changes. |
+| TF-MR-010 | MR-4 - Join / Early Employment | Auto-initialise onboarding from employee/lifecycle facts where deterministic; keep founder confirmation where needed. | Static onboarding packs and manual assignment exist. | IMPLEMENT | P0 | TF-MR-002, TF-MR-004 | NOT STARTED | SOURCE VERIFIED | Do not blindly create positions from free-text job titles. |
+| TF-MR-011 | MR-4 - Join / Early Employment | Add approved 30-day onboarding check-in. | No check-in model or route found. | IMPLEMENT | P1 | TF-MR-004, TF-MR-010 | NOT STARTED | SOURCE VERIFIED | Practical onboarding experience check, not performance management. |
+| TF-MR-012 | MR-4 - Join / Early Employment | Add probation workflow with due review, reminders, human outcome and employment-history update. | No probation model or route found. | IMPLEMENT | P1 | TF-MR-004, TF-MR-009 | NOT STARTED | SOURCE VERIFIED | No ratings matrices, competencies, 360s or performance cycles. |
+| TF-MR-013 | MR-5 - Documents & Policies | Add document requirement/request model and employee upload loop. | Admin upload and private storage exist; no employee document request/upload workflow. | IMPLEMENT | P0 | TF-MR-002, TF-MR-004 | NOT STARTED | SOURCE VERIFIED | Requirement -> employee upload -> evidence-linked closure -> expiry monitoring. |
+| TF-MR-014 | MR-5 - Documents & Policies | Add evidence-based completion modes and block generic mark-done for evidence-required tasks. | Onboarding/action completion can be manual without typed evidence conditions. | IMPLEMENT | P0 | TF-MR-004, TF-MR-013 | NOT STARTED | SOURCE VERIFIED | Modes: MANUAL_CONFIRMATION, DOCUMENT_REQUIRED, POLICY_ACKNOWLEDGEMENT, FORM_OR_DATA_REQUIRED. |
+| TF-MR-015 | MR-5 - Documents & Policies | Implement hybrid policy model with PDF/DOCX upload as normal path plus optional simple in-app authoring. | Policy body/version/acknowledgement exists; no policy file attachment path. | IMPLEMENT | P1 | TF-MR-004 | NOT STARTED | SOURCE VERIFIED | Keep version-specific acknowledgement. |
+| TF-MR-016 | MR-5 - Documents & Policies | Add policy assignment reminders/escalation and ensure archived versions/former employees do not contaminate current obligations. | Acknowledgement evidence filters active eligible employees; no reminders. | IMPLEMENT | P0 | TF-MR-004, TF-MR-015 | NOT STARTED | SOURCE VERIFIED | Archive keeps history, not current obligations. |
+| TF-MR-017 | MR-6 - Leave | Add leave types: Annual Leave, Sick Leave, Unpaid Leave, Other. | Leave currently has dates and pending/approved/rejected status only. | IMPLEMENT | P0 | TF-MR-002 | NOT STARTED | SOURCE VERIFIED | No advanced statutory engine. |
+| TF-MR-018 | MR-6 - Leave | Add simple entitlement/allocation, available balance and durable history. | No balance/allocation model exists. | IMPLEMENT | P0 | TF-MR-017 | NOT STARTED | SOURCE VERIFIED | Company defaults should be minimally configurable. |
+| TF-MR-019 | MR-6 - Leave | Add overlap/conflict detection into request/approval flow and balance warning/block with authorised override for insufficient annual leave. | Signal engine can detect leave conflicts after the fact; approval flow does not enforce type/balance/conflict. | IMPLEMENT | P0 | TF-MR-017, TF-MR-018 | NOT STARTED | SOURCE VERIFIED | Default: warn/block with explicit authorised override. Manager routing integrates when TF-MR-008 is implemented. |
+| TF-MR-020 | MR-7 - Offboarding | Add complete offboarding workflow with end date, checklist, owners, due dates, handover, access removal, asset return where applicable, final HR/payroll inputs and final documents. | Current offboarding starts by lifecycle state + signal; no case/checklist workflow. | IMPLEMENT | P0 | TF-MR-002, TF-MR-004, TF-MR-009, TF-MR-013 | NOT STARTED | SOURCE VERIFIED | Former employee should leave active obligations and current counts. |
+| TF-MR-021 | MR-7 - Offboarding | Ensure departure/archive vacates positions, suppresses active reminders, preserves history and handles employee access appropriately. | Org Chart assignment exists; archive sets deleted/former-like state, but no full workflow. | IMPLEMENT | P0 | TF-MR-020 | NOT STARTED | NOT VERIFIED | Do not delete HR history merely because employment ended. |
+| TF-MR-022 | MR-8 - Reliability & Product Truth | Remove ambiguous success/failure in mutations and exports. | Some reliability risks remain; export failures observed behaviourally but exact root cause not source-proven. | IMPLEMENT | P0 | Relevant workflows | NOT STARTED | SOURCE VERIFIED | Founder must never guess whether an action succeeded. |
+| TF-MR-023 | MR-8 - Reliability & Product Truth | Make the HR Control Centre/dashboard operationally truthful: integrate due, overdue, decision and exception states across market-ready workflows while preserving durable Resolution/history and avoiding unnecessary Signal inflation. | Signal/action rows persist resolution, but dashboard/progress semantics are not a durable business ledger. | IMPLEMENT | P1 | TF-MR-004, TF-MR-014 | NOT STARTED | SOURCE VERIFIED | Avoid disappearing progress evidence and do not force every routine task into a Signal. |
+| TF-MR-024 | MR-8 - Reliability & Product Truth | Verify/fix false-success vacant-position deletion and preserve regression coverage. | Current source appears to throw `POSITION_DELETE_UNSAFE`; Claude observed browser false success in deployed review. | VERIFY DURING IMPLEMENTATION | P1 | Runtime verification | NOT STARTED | SOURCE VERIFIED | Treat as likely fixed or stale deploy until reproduced. |
+| TF-MR-025 | MR-8 - Reliability & Product Truth | Close Sentry/App Router observability warnings before production readiness. | Build passes but emits Sentry global/onRequestError/client instrumentation warnings. | IMPLEMENT | P2 | Production observability closure | NOT STARTED | SOURCE VERIFIED | Not a product-scope blocker for MR-1, but part of release readiness. |
+
+## Execution Order
+
+1. MR-0 / MR-1 foundation: guided setup and canonical lifecycle.
+2. MR-2 operating layer: events, jobs, reminders, escalation and completion conditions.
+3. MR-4/MR-5 evidence flows: onboarding, document requests, policy attachments and evidence closure.
+4. MR-6/MR-3 delegation: leave types/balances/conflicts and bounded manager delegation.
+5. MR-7 offboarding workflow.
+6. MR-8 reliability/product-truth closure and full release verification.
+
+## Scope-Control Rule
+
+A feature must not enter implementation merely because it is useful or exists in another HRIS. Every implementation item must map to this register or be explicitly approved by the product owner and added here first.

# New file: TEAMFRAME_AUTOMATION_REGISTER.md

diff --git a/TEAMFRAME_AUTOMATION_REGISTER.md b/TEAMFRAME_AUTOMATION_REGISTER.md
new file mode 100644
index 0000000..1af3189
--- /dev/null
+++ b/TEAMFRAME_AUTOMATION_REGISTER.md
@@ -0,0 +1,34 @@
+# TeamFrame Automation Register
+
+**STATUS: CANONICAL / PRODUCT-BEHAVIOUR REGISTER**
+
+This register describes required market-ready product behaviour. It is not a technical architecture document and does not freeze table names, job-runner implementation or exact reminder day/hour defaults.
+
+Notification levels:
+
+- BACKGROUND: silent system action.
+- ROUTINE REMINDER: employee/manager reminder.
+- ESCALATION: persistent non-response or material issue.
+- DECISION: human judgement required.
+
+| Automation ID | Trigger | Known fact | Automatic action | Owner | Due logic | Reminder/escalation | Completion condition | Scope status |
+| --- | --- | --- | --- | --- | --- | --- | --- | --- |
+| TF-AUTO-001 | Company setup started | Company identity and admin are known | Create initial tenant setup checklist and defaults | Admin/founder | During setup | Escalate only if setup remains incomplete before intended launch | Required setup facts completed | MARKET-READY REQUIRED |
+| TF-AUTO-002 | Employee created | Start date, role/function and lifecycle facts are known | Initialise appropriate onboarding work where deterministic | Admin/founder; manager where authorised | Derived from start date and task template | Routine reminder then escalation for overdue items | Required onboarding items completed or evidence received | MARKET-READY REQUIRED |
+| TF-AUTO-003 | Employee invite delivery fails | Invite attempt failed or remains incomplete | Record failure, perform bounded safe automatic retry, then create recovery action only if retries fail | System, then admin/founder if retries fail | Immediate or next safe retry window | Escalate only after bounded retries fail | Invite sent/linked or founder resolves recovery action | MARKET-READY REQUIRED |
+| TF-AUTO-004 | Published policy | Policy version and eligible population are known | Create acknowledgement obligations | Employee | Based on effective date / assignment date | Routine reminder then escalation for outstanding acknowledgement | Version-specific acknowledgement recorded | MARKET-READY REQUIRED |
+| TF-AUTO-005 | Outstanding policy acknowledgement | Acknowledgement is overdue or repeatedly ignored | Remind employee; escalate persistent non-response | Employee, then manager/founder where authorised | No exact day defaults frozen | Completion suppresses reminders | Acknowledgement record exists or obligation no longer current | MARKET-READY REQUIRED |
+| TF-AUTO-006 | Document requirement created | Required document type, employee and due date are known | Request employee upload and show requirement in self-service | Employee | Due date from requirement/template | Routine reminder then escalation | Configured matching evidence received; admin review accepted where review is configured | MARKET-READY REQUIRED |
+| TF-AUTO-007 | Document uploaded | Employee/admin uploaded a permitted document | Store receipt, link evidence, close matching configured requirement where permitted | System | Immediate background action | No reminder after configured matching evidence closes requirement | Matching permitted evidence exists; admin review accepted where configured | MARKET-READY REQUIRED |
+| TF-AUTO-008 | Document approaching expiry | Existing document has expiry date | Create renewal requirement/work item | Employee/admin as configured | Based on expiry window | Routine reminder then escalation near/after expiry | Replacement document accepted | MARKET-READY REQUIRED |
+| TF-AUTO-009 | Approximately 30 days after start | Employee is in early employment lifecycle | Issue short onboarding check-in | Employee | Derived from start date | Reminder if not completed; escalate only from configured response conditions | Check-in submitted; follow-up created only when configured response conditions are met | MARKET-READY REQUIRED |
+| TF-AUTO-010 | Probation approaching | Probation end date is known | Open probation review work item | Manager/founder | Derived from probation end date | Routine reminder then escalation if overdue | Human outcome recorded | MARKET-READY REQUIRED |
+| TF-AUTO-011 | Leave request submitted | Employee, dates and leave type are known | Validate dates/balance/conflicts and route decision | Manager/founder according to delegation | Immediate decision queue | Reminder to approver if pending too long | Approved/declined/cancelled with history | MARKET-READY REQUIRED |
+| TF-AUTO-012 | Leave approved/declined | Decision is recorded | Update leave history and balance where applicable | System | Immediate background action | None unless propagation fails | History/balance projection updated | MARKET-READY REQUIRED |
+| TF-AUTO-013 | Employment change recorded | Change type, effective date and previous/current values are known | Store history and propagate current projection when effective | System with admin/founder decision | Effective date | Reminder/escalation for pending required inputs | Change applied or cancelled with audit trail | MARKET-READY REQUIRED |
+| TF-AUTO-014 | Departure/offboarding started | End date and departure context are known | Generate exit workflow and relevant checklist | Founder/manager/employee by task | Based on end date | Routine reminder then escalation for overdue exit work | Required exit work complete | MARKET-READY REQUIRED |
+| TF-AUTO-015 | Employee becomes former | End date passed and required exit work complete | Suppress active obligations, vacate position, retain history | System | Immediate background action | Escalate only if suppression/transition fails | Former projection applied and historical record retained | MARKET-READY REQUIRED |
+| TF-AUTO-016 | Signal/action resolved | Required evidence or manual confirmation exists | Mark signal/action resolved and preserve durable history | System/admin/founder | Immediate background action | Completion suppresses future reminders for same obligation | Resolution recorded without suppressing legitimate recurrence | MARKET-READY REQUIRED |
+| TF-AUTO-017 | Export requested | Export type and authorised actor are known | Generate export and provide truthful status/download | Admin/founder | Immediate or queued job | Escalate only on persistent export failure | Export generated or clear failure recorded | MARKET-READY REQUIRED |
+
+Exact reminder timing must be defined during implementation, not invented here.

# New file: TEAMFRAME_DEFERRED_SCOPE.md

diff --git a/TEAMFRAME_DEFERRED_SCOPE.md b/TEAMFRAME_DEFERRED_SCOPE.md
new file mode 100644
index 0000000..eb5fb41
--- /dev/null
+++ b/TEAMFRAME_DEFERRED_SCOPE.md
@@ -0,0 +1,70 @@
+# TeamFrame Deferred Scope
+
+**STATUS: CANONICAL / CONTROLLING SCOPE-CREEP BOUNDARY**
+
+This file prevents market-ready implementation from expanding merely because a feature is useful or common in another HRIS.
+
+A feature must not enter implementation merely because it is useful or exists in another HRIS.
+
+## Deferred - Potentially Useful Later
+
+These ideas may be useful after the market-ready release, but they are not required for the current implementation unless the product owner explicitly promotes them into `TEAMFRAME_MARKET_READY_EXECUTION_REGISTER.md`.
+
+- Lightweight Who's Away enhancement beyond core absence history.
+- Deeper payroll handoff exports after the basic finance handoff is proven.
+- Richer manager delegation beyond direct-report operational tasks.
+- Broader operational analytics after core records and workflows are truthful.
+- Additional automation defaults after the first reminder/escalation model is proven.
+- Additional configuration for leave policies after the simple core balance model is working.
+- Bulk employee import after guided setup and first-employee workflows are stable.
+- Additional country-specific document packs after the first market-ready customer path is proven.
+- More detailed policy audience rules after the hybrid policy flow works.
+- Advanced export formats after the core due-diligence and finance handoff exports are reliable.
+
+## Out Of Scope - Market-Ready Release
+
+Do not build these for the market-ready release:
+
+- ATS/recruiting pipeline.
+- Offer management.
+- Payroll calculation.
+- Tax filing.
+- Payslips.
+- Global payroll.
+- Benefits administration.
+- Advanced compensation management.
+- Bonus systems.
+- Reimbursement systems.
+- Overtime systems.
+- Performance ratings.
+- Goals.
+- 360 reviews.
+- Engagement surveys.
+- LMS.
+- Succession planning.
+- Workforce forecasting.
+- Timeclock.
+- Shift scheduling.
+- Complex leave accrual/carry-over.
+- Standalone asset management.
+- Global compliance/legal engine.
+- AI legal conclusions.
+- Enterprise workflow builder.
+- Complex approval hierarchy.
+- Advanced report builder.
+- Broad Settings maze.
+
+## Still Allowed In Bounded Market-Ready Form
+
+Older V1 documents banned some capabilities that are now approved in a bounded form. These are allowed only as defined in `TEAMFRAME_MARKET_READY_SCOPE.md` and `TEAMFRAME_MARKET_READY_EXECUTION_REGISTER.md`:
+
+- reminders and escalations;
+- simple leave types, allocations and balances;
+- lightweight manager delegation;
+- policy file upload and version-specific acknowledgement;
+- employee document request/upload;
+- evidence-based completion;
+- 30-day onboarding check-in;
+- probation workflow;
+- offboarding workflow;
+- guided company setup.

# New file: TEAMFRAME_RELEASE_READINESS.md

diff --git a/TEAMFRAME_RELEASE_READINESS.md b/TEAMFRAME_RELEASE_READINESS.md
new file mode 100644
index 0000000..0fc910b
--- /dev/null
+++ b/TEAMFRAME_RELEASE_READINESS.md
@@ -0,0 +1,123 @@
+# TeamFrame Release Readiness
+
+**STATUS: CANONICAL / CONTROLLING RELEASE GATE**
+
+Current verdict:
+
+> **NOT READY - IMPLEMENTATION PENDING**
+
+The current source foundation has passed technical verification, but the market-ready implementation is not complete. This document is the release gate for future market-ready approval.
+
+## Verdict Options
+
+- NOT READY
+- CONDITIONAL READY
+- MARKET READY
+
+## Product Scope Gate
+
+- All `IMPLEMENT` items in `TEAMFRAME_MARKET_READY_EXECUTION_REGISTER.md` completed.
+- All `VERIFY DURING IMPLEMENTATION` items verified or promoted to fixes.
+- `DEFER` and `OUT OF SCOPE` boundaries preserved.
+- No unapproved feature expansion.
+
+## Company Setup Gate
+
+- New target customer can establish the company, administrator and basic defaults.
+- Guided setup can begin ordinary use without developer or direct database intervention.
+
+## Lifecycle Gate
+
+- Canonical lifecycle works end-to-end.
+- PRE_START, ONBOARDING, ACTIVE, OFFBOARDING and FORMER behaviour is truthful.
+- Active counts and obligations use the lifecycle projection.
+- Former employees do not create normal active-HR obligations.
+
+## People & Early Employment Gate
+
+- Employee, position and reporting truth remains synchronized.
+- Employment changes preserve effective-dated history.
+- 30-day check-in works from deterministic configured conditions.
+- Probation workflow works without becoming performance management.
+
+## Automation Gate
+
+- Reminder/escalation mechanism operational.
+- No duplicate or noisy reminders.
+- Completion suppresses future reminders correctly.
+- Founder primarily sees decisions and exceptions.
+- Background jobs are idempotent and tenant-scoped.
+
+## Documents Gate
+
+- Employee request/upload loop works.
+- Admin upload remains secure.
+- Evidence-required task closure is truthful.
+- Expiry and replacement logic works.
+- Upload validation and private storage protections remain intact.
+
+## Policies Gate
+
+- File upload/version/acknowledgement/reminder works.
+- Simple in-app authoring remains truthful if retained.
+- Archived versions retain history but create no current obligations.
+- Former users do not contaminate current acknowledgement counts.
+
+## Leave Gate
+
+- Leave type, allocation, balance, request, conflict, approval/decline and history work.
+- Insufficient Annual Leave is warned/blocked by default with explicit authorised override.
+- Manager/founder routing follows the approved delegation model.
+
+## Offboarding Gate
+
+- Exit workflow works end-to-end.
+- End date, checklist, owners, handover, access-removal, asset-return and final HR/payroll inputs are represented where relevant.
+- Former/archive transition suppresses inappropriate future reminders.
+- Org Chart vacancy behaviour is correct.
+
+## Delegation Gate
+
+- Approved manager scope works securely.
+- Managers can act only for authorised direct-report responsibilities.
+- Managers do not gain private HR document access, policy administration, tenant administration or unrestricted employment-change authority.
+
+## Reliability Gate
+
+- No ambiguous success/failure.
+- Exports are reliable and provide truthful status.
+- Stale counters resolved.
+- Resolution/history remains durable.
+- False-success vacant-position deletion regression covered.
+- Sentry/App Router production observability warnings resolved or formally accepted.
+
+## Security Gate
+
+- RLS tests pass.
+- Tenant isolation tests pass.
+- Manager delegation tests pass.
+- Employee upload tests pass.
+- Service-role paths remain server-only and tenant-scoped.
+- Storage paths remain private and tenant-scoped.
+
+## Verification Gate
+
+Before a readiness verdict can advance, run and record:
+
+- typecheck;
+- lint;
+- unit/integration tests;
+- guards;
+- production build;
+- database/schema apply and reapply;
+- RLS/adversarial tenant tests;
+- disposable runtime verification;
+- browser/E2E review;
+- production-readiness checks;
+- package and secret scans where relevant.
+
+## Initial Verdict
+
+> **NOT READY - IMPLEMENTATION PENDING**
+
+Reason: the verified foundation is strong, but market-ready lifecycle, automation, documents, policies, leave, delegation, offboarding and reliability requirements have not yet been implemented.
```
