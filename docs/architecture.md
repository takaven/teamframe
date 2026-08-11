# Architecture

## Purpose

Define the current architecture contract for TeamFrame and the guardrails for the market-ready programme.

Current product definition is governed by [`../TEAMFRAME_MARKET_READY_SCOPE.md`](../TEAMFRAME_MARKET_READY_SCOPE.md):

> TeamFrame is the essential HR system for startups without a dedicated HR team.

Older V1 statements about a 48-72 hour install promise or all workflow automation being V2 are superseded where they conflict with the canonical market-ready documents.

## Tech Stack

- Frontend: Next.js App Router, TypeScript, TailwindCSS.
- Backend: Supabase Postgres, Supabase Storage, Supabase Auth.
- Deployment target: Vercel.

## Request Flow

```text
Frontend
  -> API Routes / Server Actions
    -> RBAC Middleware
      -> Service Layer
        -> Database / Storage
```

No layer may be skipped. No client may bypass middleware. No service-role key may ever reach the browser.

## Layer Responsibilities

| Layer | Allowed | Forbidden |
| --- | --- | --- |
| Frontend (`/app`, `/components`) | Rendering, forms, navigation, UX-only role hints | Authoritative permission checks, service-role access |
| API Routes / Server Actions | Parse and validate input, invoke middleware, call services, shape response | Trusting client-supplied tenant/role, bypassing services for sensitive writes |
| RBAC Middleware (`/middleware`) | Resolve session, actor, role and tenant | Domain mutations, broad data fetching |
| Service Layer (`/services`) | Enforce domain invariants, call DB/Storage, write audit logs | Reading session itself, bypassing actor checks |
| Database (`/schemas`) | Persist state, enforce same-tenant integrity, RLS and transactional mutation invariants | Browser-facing secrets or unscoped tenant access |
| Storage | Private tenant-scoped objects, signed URLs after authorization | Public HR document/JD URLs |

## Security Baseline

- Server-side RBAC is mandatory for every protected operation.
- Frontend role checks are UX-only and never grant access.
- Supabase service-role key is server-only.
- Tenant identity must be server/JWT-derived, not client-supplied.
- Same-tenant composite relationships are preferred for tenant-owned records.
- Compensation and sensitive HR data must not leak through org chart, employee self-service or manager-delegated views.
- Private Storage must use tenant-scoped paths and short-lived signed URLs.

## Current Implemented Domains

At baseline `489c9606441618e898f21eafb0443a9ca33474ad`, the current implemented foundation includes:

- admin/employee authentication;
- employee records;
- position-based Org Chart;
- onboarding templates/tasks;
- policy publication and acknowledgement;
- basic leave requests and decisions;
- admin document upload/download/delete;
- exports;
- risk signals and action items;
- audit logs;
- file lifecycle records;
- health checks.

## Market-Ready Architecture Direction

The market-ready programme requires controlled extension, not a rewrite.

Architecture must add or extend support for:

- canonical lifecycle projection;
- event/rule/action/reminder/escalation/completion operating layer;
- evidence-based completion;
- document requests and employee upload;
- policy file attachments and acknowledgement reminders;
- leave types, simple balances and durable history;
- bounded manager delegation;
- employment-change history;
- complete offboarding workflow;
- reliability/product-truth closure.

These are approved market-ready requirements when implemented according to `TEAMFRAME_MARKET_READY_EXECUTION_REGISTER.md`. They are not permission to build an enterprise workflow builder or broad HRIS platform.

## Scaling Posture

Optimise for the current target: founder-led teams with approximately 5-25 employees and no dedicated HR team.

Do not prematurely optimise for enterprise scale, multi-region infrastructure, plugin ecosystems, complex approval hierarchy, timeclock/shift scheduling or broad custom workflow configuration.
