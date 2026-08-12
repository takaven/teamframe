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

## Current Programme Checkpoints

The following implementation checkpoints have been locally completed and product-owner locked on `codex/market-ready-implementation`:

- MR-0 Guided Company Setup
- MR-1 Company & Employee Lifecycle
- MR-2 HR Event & Automation Layer
- MR-3A Employment Changes / People Truth
- MR-4 Join / Early Employment
- MR-5 Documents & Policies
- MR-6 Leave
- MR-3B Bounded Manager Delegation
- MR-7 Offboarding
- MR-8 Control Centre / Reliability / Release Closure

Final full-system disposable E2E release verification completed on 2026-08-12 at `268d9682d15e6c4afb4c83dbfde76b8b531f541d`. The final verification found and fixed one bounded release blocker in the Who's Away projection. No P0 or P1 market-ready blocker remained after the final gate.

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
| TF-MR-001 | MR-0 - Guided Company Setup | Add minimal guided setup for company identity, country/location, administrator, basic leave defaults, initial organisation structure and first employees. | Guided setup route/service/RPC implemented and runtime-proven. | IMPLEMENT | P0 | None | IMPLEMENTED | LOCKED | Company/tenant metadata setup can begin independently; first-employee creation uses the canonical lifecycle from TF-MR-002. |
| TF-MR-002 | MR-1 - Company & Employee Lifecycle | Define one authoritative lifecycle projection for PRE_START -> ONBOARDING -> ACTIVE -> OFFBOARDING -> FORMER. | Canonical projection implemented with legacy compatibility. | IMPLEMENT | P0 | None | IMPLEMENTED | LOCKED | `on_leave` remains availability, not lifecycle. Past end date alone does not mean FORMER. |
| TF-MR-003 | MR-1 - Company & Employee Lifecycle | Ensure lifecycle controls active counts, policies, onboarding, reminders, leave, self-service, Org Chart, dashboard work and former/archive behaviour. | Cross-module lifecycle eligibility implemented and runtime-proven. | IMPLEMENT | P0 | TF-MR-002 | IMPLEMENTED | LOCKED | Former employees are excluded from normal active-HR obligations while history remains. |
| TF-MR-004 | MR-2 - HR Event & Automation Layer | Build reusable Event -> Rule -> Action -> Owner -> Due -> Reminder -> Escalation -> Completion mechanism. | Durable automation item model, protected runner, idempotency and retries implemented. | IMPLEMENT | P0 | TF-MR-002 | IMPLEMENTED | LOCKED | Keep opinionated defaults; do not build a workflow builder. |
| TF-MR-005 | MR-2 - HR Event & Automation Layer | Implement reminder/escalation levels: BACKGROUND, ROUTINE REMINDER, ESCALATION, DECISION. | Automation levels implemented with human/system audit attribution. | IMPLEMENT | P0 | TF-MR-004 | IMPLEMENTED | LOCKED | Exact day/hour defaults remain internal implementation defaults. |
| TF-MR-006 | MR-2 - HR Event & Automation Layer | Make completion suppress future reminders without suppressing legitimate recurrence. | Completion, recurrence and retry semantics implemented and runtime-proven. | IMPLEMENT | P0 | TF-MR-004, TF-MR-009 | IMPLEMENTED | LOCKED | Idempotent and tenant-scoped. |
| TF-MR-007 | MR-3 - People / Organisation / Delegation | Preserve and integrate position-first Org Chart with lifecycle and employee records. | Org Chart vacancy and lifecycle integration runtime-proven through MR-1/MR-7. | VERIFY DURING IMPLEMENTATION | P1 | TF-MR-002 | IMPLEMENTED | LOCKED | Position vacancy on departure/archive is verified. |
| TF-MR-008 | MR-3 - People / Organisation / Delegation | Add bounded manager delegation for direct reports where authorised. | Direct-report-derived manager authority implemented and runtime-proven. | IMPLEMENT | P1 | TF-MR-002, TF-MR-004 | IMPLEMENTED | LOCKED | No enterprise RBAC; managers do not gain broad HR access. |
| TF-MR-009 | MR-3 - People / Organisation / Delegation | Add structured employment changes with effective dates, previous values, history and downstream propagation. | Effective-dated employment change history implemented with one pending change per material fact. | IMPLEMENT | P0 | TF-MR-002 | IMPLEMENTED | LOCKED | Covers manager, position, department, location and employment type without inventing absent fields. |
| TF-MR-010 | MR-4 - Join / Early Employment | Auto-initialise onboarding from employee/lifecycle facts where deterministic; keep founder confirmation where needed. | Automatic onboarding initialisation and activation path implemented. | IMPLEMENT | P0 | TF-MR-002, TF-MR-004 | IMPLEMENTED | LOCKED | Final required onboarding completion advances setup/lifecycle to ACTIVE. |
| TF-MR-011 | MR-4 - Join / Early Employment | Add approved 30-day onboarding check-in. | 30-day check-in model, submission and deterministic follow-up implemented. | IMPLEMENT | P1 | TF-MR-004, TF-MR-010 | IMPLEMENTED | LOCKED | Practical onboarding experience check, not performance management. |
| TF-MR-012 | MR-4 - Join / Early Employment | Add probation workflow with due review, reminders, human outcome and employment-history update. | Probation workflow and extension/review automation implemented. | IMPLEMENT | P1 | TF-MR-004, TF-MR-009 | IMPLEMENTED | LOCKED | No ratings matrices, competencies, 360s or performance cycles. |
| TF-MR-013 | MR-5 - Documents & Policies | Add document requirement/request model and employee upload loop. | Document requirements, employee uploads, evidence linking and expiry/replacement implemented. | IMPLEMENT | P0 | TF-MR-002, TF-MR-004 | IMPLEMENTED | LOCKED | Requirement -> employee upload -> evidence-linked closure -> expiry monitoring. |
| TF-MR-014 | MR-5 - Documents & Policies | Add evidence-based completion modes and block generic mark-done for evidence-required tasks. | Completion modes implemented and runtime-proven. | IMPLEMENT | P0 | TF-MR-004, TF-MR-013 | IMPLEMENTED | LOCKED | Modes: MANUAL_CONFIRMATION, DOCUMENT_REQUIRED, POLICY_ACKNOWLEDGEMENT, FORM_OR_DATA_REQUIRED. |
| TF-MR-015 | MR-5 - Documents & Policies | Implement hybrid policy model with PDF/DOCX upload as normal path plus optional simple in-app authoring. | Policy file/version workflow implemented. | IMPLEMENT | P1 | TF-MR-004 | IMPLEMENTED | LOCKED | Version-specific acknowledgement retained. |
| TF-MR-016 | MR-5 - Documents & Policies | Add policy assignment reminders/escalation and ensure archived versions/former employees do not contaminate current obligations. | Policy obligation automation and archived-version isolation implemented. | IMPLEMENT | P0 | TF-MR-004, TF-MR-015 | IMPLEMENTED | LOCKED | Archive keeps history, not current obligations. |
| TF-MR-017 | MR-6 - Leave | Add leave types: Annual Leave, Sick Leave, Unpaid Leave, Other. | Bounded leave types implemented. | IMPLEMENT | P0 | TF-MR-002 | IMPLEMENTED | LOCKED | No advanced statutory engine. |
| TF-MR-018 | MR-6 - Leave | Add simple entitlement/allocation, available balance and durable history. | Calendar-year Annual Leave entitlement and balance history implemented. | IMPLEMENT | P0 | TF-MR-017 | IMPLEMENTED | LOCKED | Monday-Friday working-day rule; no carry-forward/accrual/pro-rating. |
| TF-MR-019 | MR-6 - Leave | Add overlap/conflict detection into request/approval flow and balance warning/block with authorised override for insufficient annual leave. | Conflict detection, pending reservation, approval/decline and authorised override implemented. | IMPLEMENT | P0 | TF-MR-017, TF-MR-018 | IMPLEMENTED | LOCKED | Manager routing integrates through TF-MR-008; cross-year Annual Leave requests are rejected. |
| TF-MR-020 | MR-7 - Offboarding | Add complete offboarding workflow with end date, checklist, owners, due dates, handover, access removal, asset return where applicable, final HR/payroll inputs and final documents. | Bounded offboarding case/checklist workflow implemented. | IMPLEMENT | P0 | TF-MR-002, TF-MR-004, TF-MR-009, TF-MR-013 | IMPLEMENTED | LOCKED | FORMER requires end date reached plus required exit work complete. |
| TF-MR-021 | MR-7 - Offboarding | Ensure departure/archive vacates positions, suppresses active reminders, preserves history and handles employee access appropriately. | Position vacancy, former suppression and historical retention runtime-proven. | IMPLEMENT | P0 | TF-MR-020 | IMPLEMENTED | LOCKED | Do not delete HR history merely because employment ended. |
| TF-MR-022 | MR-8 - Reliability & Product Truth | Remove ambiguous success/failure in mutations and exports. | Export signed-url failures now retire unusable metadata and preserve failed file-operation truth. | IMPLEMENT | P0 | Relevant workflows | IMPLEMENTED | SOURCE VERIFIED | Founder must never guess whether an action succeeded. Runtime verification remains part of MR-8 lock. |
| TF-MR-023 | MR-8 - Reliability & Product Truth | Make the HR Control Centre/dashboard operationally truthful: integrate due, overdue, decision and exception states across market-ready workflows while preserving durable Resolution/history and avoiding unnecessary Signal inflation. | Dashboard now derives current state from authoritative domain rows instead of request-time signal reconciliation. | IMPLEMENT | P1 | TF-MR-004, TF-MR-014 | IMPLEMENTED | SOURCE VERIFIED | Avoid disappearing progress evidence and do not force every routine task into a Signal. |
| TF-MR-024 | MR-8 - Reliability & Product Truth | Verify/fix false-success vacant-position deletion and preserve regression coverage. | Existing position service rejects unsafe deletion with `POSITION_DELETE_UNSAFE`; MR-8 runtime must prove current behaviour. | VERIFY DURING IMPLEMENTATION | P1 | Runtime verification | IMPLEMENTED | SOURCE VERIFIED | Treat previous browser finding as stale unless reproduced against current source. |
| TF-MR-025 | MR-8 - Reliability & Product Truth | Close Sentry/App Router observability warnings before production readiness. | Build-time observability warnings are tracked as a production-readiness gate rather than product functionality. | IMPLEMENT | P2 | Production observability closure | IN PROGRESS | SOURCE VERIFIED | Must be resolved or formally accepted before final market-ready release. |

## MR-8 Reliability Register

| Finding | MR-8 disposition |
| --- | --- |
| HR dashboard depended on request-time Signal reconciliation and risk-card lanes. | Replaced by a derived HR Control Centre read model for due, overdue, decision, exception and resolved work. |
| Routine document/policy/onboarding work could be inflated into Signals or hidden by generic dashboard completion. | Dashboard generic Mark done mutation removed; evidence-backed policy/document obligations close only from their underlying evidence. |
| Current counts could be contaminated by FORMER employees, archived policy versions, replaced document requests or cancelled leave. | Control Centre excludes non-current lifecycle and obsolete/cancelled records from current work. |
| Export signed-url failure could leave ambiguous current metadata. | Failed export URL finalisation now marks the file operation failed and retires unusable metadata. |
| Vacant-position deletion had a historical browser false-success report. | Current source contains unsafe-delete rejection; runtime verification remains required for MR-8 lock. |
| Automation failure/retry state could be invisible to founders. | Failed/escalated automation items are surfaced as overdue exceptions in the Control Centre. |

## Execution Order

1. MR-0 / MR-1 foundation: guided setup and canonical lifecycle.
2. MR-2 operating layer: events, jobs, reminders, escalation and completion conditions.
3. MR-4/MR-5 evidence flows: onboarding, document requests, policy attachments and evidence closure.
4. MR-6/MR-3 delegation: leave types/balances/conflicts and bounded manager delegation.
5. MR-7 offboarding workflow.
6. MR-8 reliability/product-truth closure and full release verification.

## Scope-Control Rule

A feature must not enter implementation merely because it is useful or exists in another HRIS. Every implementation item must map to this register or be explicitly approved by the product owner and added here first.
