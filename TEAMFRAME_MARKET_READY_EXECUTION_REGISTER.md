# TeamFrame Market-Ready Execution Register

**STATUS: CANONICAL / CONTROLLING IMPLEMENTATION REGISTER**

This register consolidates the approved market-ready scope, Claude browser findings as behavioural evidence, and Codex technical verification into root implementation requirements. It does not use Claude AG numbering as canonical repository numbering.

Where older repository documents conflict with this register, this register and `TEAMFRAME_MARKET_READY_SCOPE.md` control unless explicitly superseded by a later product-owner decision.

## Provenance

| Item | Value |
| --- | --- |
| Controlling scope | `TEAMFRAME_MARKET_READY_SCOPE.md` |
| Technical verification report | `C:\Users\isuda\Dev\TeamFrame-technical-verification-2026-08-11\TEAMFRAME_TECHNICAL_VERIFICATION.md` |
| Technical verification SHA-256 | `20153BD3871EE5D5BED2B545E2C72507C3B9DCECCFC1F9A5D33F5082DED7E1D8` |
| Verification baseline | `489c9606441618e898f21eafb0443a9ca33474ad` |
| Typecheck | PASS |
| Lint | PASS |
| Tests | PASS, 20 files / 104 tests |
| Guards | PASS, 4/4 |
| Build | PASS |

Technical verification confirms the starting foundation only. It does not mean market-ready implementation is complete.

## Decision Values

Allowed `Decision` values:

- IMPLEMENT
- DEFER
- OUT OF SCOPE
- VERIFY DURING IMPLEMENTATION

Allowed `Implementation status` values:

- NOT STARTED
- IN PROGRESS
- IMPLEMENTED
- BLOCKED

Allowed `Verification status` values:

- NOT VERIFIED
- SOURCE VERIFIED
- RUNTIME VERIFIED
- LOCKED

Priority meanings:

- **P0** = foundational / market-ready blocker.
- **P1** = required market-ready integration following foundation.
- **P2** = release hardening / closure.

## Existing Foundation

Use these primitives where possible:

- employee records;
- positions/org hierarchy;
- manager_id;
- policy/version acknowledgement;
- signal/action persistence;
- audit logging;
- transactional RPC pattern;
- private file lifecycle;
- same-tenant constraints;
- RLS;
- file validation;
- basic leave records;
- onboarding templates;
- export machinery.

Do not mark a market-ready requirement implemented merely because a partial primitive exists.

## Root Requirements

| ID | Workstream | Requirement | Current technical state | Decision | Priority | Dependencies | Implementation status | Verification status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| TF-MR-001 | MR-0 - Guided Company Setup | Add minimal guided setup for company identity, country/location, administrator, basic leave defaults, initial organisation structure and first employees. | No normal customer setup route; setup relies on scripts/admin provisioning. | IMPLEMENT | P0 | None | NOT STARTED | SOURCE VERIFIED | Company/tenant metadata setup can begin independently; first-employee creation must use the canonical lifecycle from TF-MR-002. |
| TF-MR-002 | MR-1 - Company & Employee Lifecycle | Define one authoritative lifecycle projection for PRE_START -> ONBOARDING -> ACTIVE -> OFFBOARDING -> FORMER. | Current fields include `status`, `setup_status`, `lifecycle_state`, `deleted_at`, start/end dates. | IMPLEMENT | P0 | None | NOT STARTED | SOURCE VERIFIED | Exact enum names are not frozen. Legacy compatibility may remain behind one projection. |
| TF-MR-003 | MR-1 - Company & Employee Lifecycle | Ensure lifecycle controls active counts, policies, onboarding, reminders, leave, self-service, Org Chart, dashboard work and former/archive behaviour. | Filtering exists per module but is not governed by one lifecycle model. | IMPLEMENT | P0 | TF-MR-002 | NOT STARTED | NOT VERIFIED | Prevent future-dated/former employees from behaving like active employees. |
| TF-MR-004 | MR-2 - HR Event & Automation Layer | Build reusable Event -> Rule -> Action -> Owner -> Due -> Reminder -> Escalation -> Completion mechanism. | Signal reconcilers and audit/events exist; no scheduler, queue, reminder or escalation engine. | IMPLEMENT | P0 | TF-MR-002 | NOT STARTED | SOURCE VERIFIED | Keep opinionated defaults; do not build a workflow builder. |
| TF-MR-005 | MR-2 - HR Event & Automation Layer | Implement reminder/escalation levels: BACKGROUND, ROUTINE REMINDER, ESCALATION, DECISION. | No generic reminder/escalation model. | IMPLEMENT | P0 | TF-MR-004 | NOT STARTED | NOT VERIFIED | Exact day/hour defaults are not frozen. |
| TF-MR-006 | MR-2 - HR Event & Automation Layer | Make completion suppress future reminders without suppressing legitimate recurrence. | Signal/action suppression exists in places; no general completion condition model. | IMPLEMENT | P0 | TF-MR-004, TF-MR-009 | NOT STARTED | NOT VERIFIED | Must be idempotent and tenant-scoped. |
| TF-MR-007 | MR-3 - People / Organisation / Delegation | Preserve and integrate position-first Org Chart with lifecycle and employee records. | Org Chart implemented with positions, reporting, filled/vacant state and JD attachments. | VERIFY DURING IMPLEMENTATION | P1 | TF-MR-002 | NOT STARTED | SOURCE VERIFIED | Existing module is foundation; verify position vacancy on departure/archive. |
| TF-MR-008 | MR-3 - People / Organisation / Delegation | Add bounded manager delegation for direct reports where authorised. | `manager_id` and reporting structure exist, but no manager role/scope workflow. | IMPLEMENT | P1 | TF-MR-002, TF-MR-004 | NOT STARTED | SOURCE VERIFIED | No enterprise RBAC. Managers do not gain broad HR access. |
| TF-MR-009 | MR-3 - People / Organisation / Delegation | Add structured employment changes with effective dates, previous values, history and downstream propagation. | Employee update patches current row and writes audit; no change-history table. | IMPLEMENT | P0 | TF-MR-002 | NOT STARTED | SOURCE VERIFIED | Covers manager, position, department, location, employment type and related changes. |
| TF-MR-010 | MR-4 - Join / Early Employment | Auto-initialise onboarding from employee/lifecycle facts where deterministic; keep founder confirmation where needed. | Static onboarding packs and manual assignment exist. | IMPLEMENT | P0 | TF-MR-002, TF-MR-004 | NOT STARTED | SOURCE VERIFIED | Do not blindly create positions from free-text job titles. |
| TF-MR-011 | MR-4 - Join / Early Employment | Add approved 30-day onboarding check-in. | No check-in model or route found. | IMPLEMENT | P1 | TF-MR-004, TF-MR-010 | NOT STARTED | SOURCE VERIFIED | Practical onboarding experience check, not performance management. |
| TF-MR-012 | MR-4 - Join / Early Employment | Add probation workflow with due review, reminders, human outcome and employment-history update. | No probation model or route found. | IMPLEMENT | P1 | TF-MR-004, TF-MR-009 | NOT STARTED | SOURCE VERIFIED | No ratings matrices, competencies, 360s or performance cycles. |
| TF-MR-013 | MR-5 - Documents & Policies | Add document requirement/request model and employee upload loop. | Admin upload and private storage exist; no employee document request/upload workflow. | IMPLEMENT | P0 | TF-MR-002, TF-MR-004 | NOT STARTED | SOURCE VERIFIED | Requirement -> employee upload -> evidence-linked closure -> expiry monitoring. |
| TF-MR-014 | MR-5 - Documents & Policies | Add evidence-based completion modes and block generic mark-done for evidence-required tasks. | Onboarding/action completion can be manual without typed evidence conditions. | IMPLEMENT | P0 | TF-MR-004, TF-MR-013 | NOT STARTED | SOURCE VERIFIED | Modes: MANUAL_CONFIRMATION, DOCUMENT_REQUIRED, POLICY_ACKNOWLEDGEMENT, FORM_OR_DATA_REQUIRED. |
| TF-MR-015 | MR-5 - Documents & Policies | Implement hybrid policy model with PDF/DOCX upload as normal path plus optional simple in-app authoring. | Policy body/version/acknowledgement exists; no policy file attachment path. | IMPLEMENT | P1 | TF-MR-004 | NOT STARTED | SOURCE VERIFIED | Keep version-specific acknowledgement. |
| TF-MR-016 | MR-5 - Documents & Policies | Add policy assignment reminders/escalation and ensure archived versions/former employees do not contaminate current obligations. | Acknowledgement evidence filters active eligible employees; no reminders. | IMPLEMENT | P0 | TF-MR-004, TF-MR-015 | NOT STARTED | SOURCE VERIFIED | Archive keeps history, not current obligations. |
| TF-MR-017 | MR-6 - Leave | Add leave types: Annual Leave, Sick Leave, Unpaid Leave, Other. | Leave currently has dates and pending/approved/rejected status only. | IMPLEMENT | P0 | TF-MR-002 | NOT STARTED | SOURCE VERIFIED | No advanced statutory engine. |
| TF-MR-018 | MR-6 - Leave | Add simple entitlement/allocation, available balance and durable history. | No balance/allocation model exists. | IMPLEMENT | P0 | TF-MR-017 | NOT STARTED | SOURCE VERIFIED | Company defaults should be minimally configurable. |
| TF-MR-019 | MR-6 - Leave | Add overlap/conflict detection into request/approval flow and balance warning/block with authorised override for insufficient annual leave. | Signal engine can detect leave conflicts after the fact; approval flow does not enforce type/balance/conflict. | IMPLEMENT | P0 | TF-MR-017, TF-MR-018 | NOT STARTED | SOURCE VERIFIED | Default: warn/block with explicit authorised override. Manager routing integrates when TF-MR-008 is implemented. |
| TF-MR-020 | MR-7 - Offboarding | Add complete offboarding workflow with end date, checklist, owners, due dates, handover, access removal, asset return where applicable, final HR/payroll inputs and final documents. | Current offboarding starts by lifecycle state + signal; no case/checklist workflow. | IMPLEMENT | P0 | TF-MR-002, TF-MR-004, TF-MR-009, TF-MR-013 | NOT STARTED | SOURCE VERIFIED | Former employee should leave active obligations and current counts. |
| TF-MR-021 | MR-7 - Offboarding | Ensure departure/archive vacates positions, suppresses active reminders, preserves history and handles employee access appropriately. | Org Chart assignment exists; archive sets deleted/former-like state, but no full workflow. | IMPLEMENT | P0 | TF-MR-020 | NOT STARTED | NOT VERIFIED | Do not delete HR history merely because employment ended. |
| TF-MR-022 | MR-8 - Reliability & Product Truth | Remove ambiguous success/failure in mutations and exports. | Some reliability risks remain; export failures observed behaviourally but exact root cause not source-proven. | IMPLEMENT | P0 | Relevant workflows | NOT STARTED | SOURCE VERIFIED | Founder must never guess whether an action succeeded. |
| TF-MR-023 | MR-8 - Reliability & Product Truth | Make the HR Control Centre/dashboard operationally truthful: integrate due, overdue, decision and exception states across market-ready workflows while preserving durable Resolution/history and avoiding unnecessary Signal inflation. | Signal/action rows persist resolution, but dashboard/progress semantics are not a durable business ledger. | IMPLEMENT | P1 | TF-MR-004, TF-MR-014 | NOT STARTED | SOURCE VERIFIED | Avoid disappearing progress evidence and do not force every routine task into a Signal. |
| TF-MR-024 | MR-8 - Reliability & Product Truth | Verify/fix false-success vacant-position deletion and preserve regression coverage. | Current source appears to throw `POSITION_DELETE_UNSAFE`; Claude observed browser false success in deployed review. | VERIFY DURING IMPLEMENTATION | P1 | Runtime verification | NOT STARTED | SOURCE VERIFIED | Treat as likely fixed or stale deploy until reproduced. |
| TF-MR-025 | MR-8 - Reliability & Product Truth | Close Sentry/App Router observability warnings before production readiness. | Build passes but emits Sentry global/onRequestError/client instrumentation warnings. | IMPLEMENT | P2 | Production observability closure | NOT STARTED | SOURCE VERIFIED | Not a product-scope blocker for MR-1, but part of release readiness. |

## Execution Order

1. MR-0 / MR-1 foundation: guided setup and canonical lifecycle.
2. MR-2 operating layer: events, jobs, reminders, escalation and completion conditions.
3. MR-4/MR-5 evidence flows: onboarding, document requests, policy attachments and evidence closure.
4. MR-6/MR-3 delegation: leave types/balances/conflicts and bounded manager delegation.
5. MR-7 offboarding workflow.
6. MR-8 reliability/product-truth closure and full release verification.

## Scope-Control Rule

A feature must not enter implementation merely because it is useful or exists in another HRIS. Every implementation item must map to this register or be explicitly approved by the product owner and added here first.
