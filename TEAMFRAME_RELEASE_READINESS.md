# TeamFrame Release Readiness

**STATUS: CANONICAL / CONTROLLING RELEASE GATE**

Current verdict:

> **NOT READY - IMPLEMENTATION PENDING**

The current source foundation has passed technical verification, but the market-ready implementation is not complete. This document is the release gate for future market-ready approval.

## Verdict Options

- NOT READY
- CONDITIONAL READY
- MARKET READY

## Product Scope Gate

- All `IMPLEMENT` items in `TEAMFRAME_MARKET_READY_EXECUTION_REGISTER.md` completed.
- All `VERIFY DURING IMPLEMENTATION` items verified or promoted to fixes.
- `DEFER` and `OUT OF SCOPE` boundaries preserved.
- No unapproved feature expansion.

## Company Setup Gate

- New target customer can establish the company, administrator and basic defaults.
- Guided setup can begin ordinary use without developer or direct database intervention.

## Lifecycle Gate

- Canonical lifecycle works end-to-end.
- PRE_START, ONBOARDING, ACTIVE, OFFBOARDING and FORMER behaviour is truthful.
- Active counts and obligations use the lifecycle projection.
- Former employees do not create normal active-HR obligations.

## People & Early Employment Gate

- Employee, position and reporting truth remains synchronized.
- Employment changes preserve effective-dated history.
- 30-day check-in works from deterministic configured conditions.
- Probation workflow works without becoming performance management.

## Automation Gate

- Reminder/escalation mechanism operational.
- No duplicate or noisy reminders.
- Completion suppresses future reminders correctly.
- Founder primarily sees decisions and exceptions.
- Background jobs are idempotent and tenant-scoped.

## Documents Gate

- Employee request/upload loop works.
- Admin upload remains secure.
- Evidence-required task closure is truthful.
- Expiry and replacement logic works.
- Upload validation and private storage protections remain intact.

## Policies Gate

- File upload/version/acknowledgement/reminder works.
- Simple in-app authoring remains truthful if retained.
- Archived versions retain history but create no current obligations.
- Former users do not contaminate current acknowledgement counts.

## Leave Gate

- Leave type, allocation, balance, request, conflict, approval/decline and history work.
- Insufficient Annual Leave is warned/blocked by default with explicit authorised override.
- Manager/founder routing follows the approved delegation model.

## Offboarding Gate

- Exit workflow works end-to-end.
- End date, checklist, owners, handover, access-removal, asset-return and final HR/payroll inputs are represented where relevant.
- Former/archive transition suppresses inappropriate future reminders.
- Org Chart vacancy behaviour is correct.

## Delegation Gate

- Approved manager scope works securely.
- Managers can act only for authorised direct-report responsibilities.
- Managers do not gain private HR document access, policy administration, tenant administration or unrestricted employment-change authority.

## Reliability Gate

- No ambiguous success/failure.
- Exports are reliable and provide truthful status.
- Stale counters resolved.
- Resolution/history remains durable.
- False-success vacant-position deletion regression covered.
- Sentry/App Router production observability warnings resolved or formally accepted.

## Security Gate

- RLS tests pass.
- Tenant isolation tests pass.
- Manager delegation tests pass.
- Employee upload tests pass.
- Service-role paths remain server-only and tenant-scoped.
- Storage paths remain private and tenant-scoped.

## Verification Gate

Before a readiness verdict can advance, run and record:

- typecheck;
- lint;
- unit/integration tests;
- guards;
- production build;
- database/schema apply and reapply;
- RLS/adversarial tenant tests;
- disposable runtime verification;
- browser/E2E review;
- production-readiness checks;
- package and secret scans where relevant.

## Initial Verdict

> **NOT READY - IMPLEMENTATION PENDING**

Reason: the verified foundation is strong, but market-ready lifecycle, automation, documents, policies, leave, delegation, offboarding and reliability requirements have not yet been implemented.
