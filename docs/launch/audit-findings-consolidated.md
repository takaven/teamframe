# Consolidated Audit Findings

These findings are synthesized from five separate audit reports (archived in `audit-reports-archive/`). Source audit numbers correspond to the archive filenames. Status values below are reconciled to the current repository state as of 2026-06-01.

## Critical (Launch Blockers)

| ID | Finding | Affected Files | Source Audit | Status | Verification Artifact |
|----|---------|----------------|-------------|--------|-----------------------|
| M1 | Enable RLS + tenant policy on `companies` table | `schemas/tenancy_rls.sql`, `schemas/companies.sql` | Audits 2, 3 | Closed | Verified in tenancy policies |
| M2 | Add RLS policies to `onboarding_tasks` (RLS enabled, zero policies) | `schemas/tenancy_rls.sql` | Audits 1, 2, 3 | Closed | Verified in tenancy policies |
| M3 | HTTP security headers in next.config.ts (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy) | `next.config.ts` | Audits 1, 2 | Closed | Commit accbd51 |
| M5 | Guard `inviteEmployeeAuthUser` against cross-tenant `app_metadata` overwrite | `services/employeeService/index.ts` | Audits 2, 3 | Closed | Conflict guard in metadata update path |
| M7 | Restrict employees + employee_profiles SELECT — self+admin full, safe view (employees_public) for tenant-wide directory | `schemas/tenancy_rls.sql`, `schemas/employees.sql`, `schemas/employee_profiles.sql` | Audit 3 | Closed | Current policy restricts employee reads to self |
| M8 | Fix callback failure path — never wipe active session cookies on stale/scanner-hit links, only PKCE verifier cookies | `app/auth/callback/route.ts` | Audit 3 | Closed | Recovery-first callback flow present |

## High (Reliability Risks)

| ID | Finding | Affected Files | Source Audit | Status | Verification Artifact |
|----|---------|----------------|-------------|--------|-----------------------|
| M4 | Fix softDeleteEmployee silent NOT_FOUND — exits with no error when employee never existed or was already deleted | `services/employeeService/index.ts` | Audit 1 | Closed | Commit 1c63474 |
| M6 | Add status='pending' guard to decideLeaveRequest | `services/leaveService/index.ts` | Audit 1 | Closed | Guard enforced in update query |
| M9 | Make employee provisioning atomic OR add visible link-status + admin re-invite action | `services/employeeService/index.ts`, `lib/rbac/roles.ts` | Audit 4 | Closed | Re-invite flow + status telemetry implemented |
| M10 | Add `app/error.tsx` with graceful "sign out and retry" recovery for server component crashes | `app/error.tsx` (new) | Audit 4 | Closed | Error page present |
| M12 | Fail loud on audit-log insert failure for sensitive admin mutations (employee creation, leave decisions, role changes) | `services/employeeService/index.ts`, `services/leaveService/index.ts` | Audit 4 | Closed | leave.submitted now required (plus existing required mutations) |
| M13 | Tighten policies and procedures SELECT to published-only for non-admins (verify is_published column exists first) | `schemas/tenancy_rls.sql`, `schemas/policies.sql`, `schemas/procedures.sql` | Audit 2 | Closed | Published-only check in RLS |
| M14 | Deterministic email fallback — add ORDER BY created_at LIMIT 1 to current_actor_tenant_id() | `schemas/tenancy_rls.sql` | Audit 2 | Closed | ORDER BY/LIMIT present; v2 removes fallback entirely |
| M15 | Convert /auth/logout from route handler to server action (CSRF protection) | `app/auth/logout/route.ts`, `app/auth/actions.ts` | Audit 2 | Closed | Server action-based logout path |
| M16 | Add basic rate limiting on sendMagicLink — 5 req/15min/IP, 3 req/10min/email | `app/auth/actions.ts` | Audits 2, meta-review | Closed | Commit 2dc5909 + f31c4b3 |

## Medium (UX / Polish)

| ID | Finding | Affected Files | Source Audit | Status | Verification Artifact |
|----|---------|----------------|-------------|--------|-----------------------|
| M11 | Replace UUIDs with employee names in admin leave queue | `app/leaves/page.tsx` | Audit 4 | Closed | Queue renders full name + role title |
| M17 | Add Zod validation to submitLeaveRequest | `services/leaveService/index.ts` | Audit 1 | Closed | SubmitLeaveSchema enforced |

## Low (Cleanup)

| ID | Finding | Affected Files | Source Audit | Status | Verification Artifact |
|----|---------|----------------|-------------|--------|-----------------------|
| M18 | Remove dead openaiApiKey getter | `lib/db/env.ts` | Audits 1, 4 | Closed | Commit cc13faf |
| M19 | Clean up /lib/ai references in docs and .env.example | `docs/architecture.md`, `docs/ai-boundaries.md`, `.env.example` | Audits 1, 4 | Closed | Commit cc13faf + .env cleanup |
| M20 | Confirm Supabase backup tier (PITR enabled) and document recovery procedure | Operational — no code change | Meta-review | Open | TBD |
