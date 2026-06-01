# TeamFrame Wave 0 Baseline Report

Date: 2026-05-31
Owner: Release Orchestrator
Branch observed: pivot/fpors-cleanup

## Scope Lock
Only release-critical tracks are in scope:
- Gate A: Auth callback reliability
- Gate B: Lifecycle workflow completion
- Production readiness: P1 to P6 plus P9 tenant context verification

## Merge Freeze Rule
After this baseline, only these lanes may merge into the release branch:
- Gate A lane
- Gate B lane
- Production readiness lane

Any other merge is out of scope and blocked.

## Evidence Snapshot

### Build and test baseline
- npm test: PASS
- Result: 4 test files passed, 12 tests passed
- npm run build: PASS with warnings
- Warning observed: OpenTelemetry critical dependency expression warning in instrumentation bundle

### Runtime/auth baseline
- Auth callback failure evidence present in server logs:
  - GET /auth/callback 500
  - callback_failed redirect events
- Callback reliability is not closed.

### Lifecycle/signal baseline
- Employee row sampled after archive action:
  - id: d205322b-fac1-4d68-8e5b-4c6fce46c559
  - status: active
  - lifecycle_state: active
  - deleted_at: set
- This confirms archive is currently not transitioning lifecycle_state to exited.

- Risk signals grouped summary (baseline query):
  - expired_document open: 1
  - expiring_document open: 1
  - missing_contract open: 2
  - expiring_document resolved: 1
  - missing_contract resolved: 1
  - missing_jurisdiction_requirement open: 1

- Action items grouped summary (baseline query):
  - expired_document open: 1
  - expiring_document open: 1
  - missing_contract open: 2
  - expiring_document done: 1
  - missing_contract done: 1
  - missing_jurisdiction_requirement open: 1

- Employee lifecycle count summary (baseline query):
  - offboarding: 0
  - exited: 0

### Audit trail baseline
Observed audit evidence confirms:
- employee.created events exist
- employee.archived events exist
- employee.activation_link_generated events exist
- document.exported_due_diligence_pack events exist
- document.exported_finance_handoff events exist

## Baseline Blocker Status

| ID | Blocker | Baseline Status |
|---|---|---|
| A1 | Auth callback reliability | OPEN |
| B1 | Start offboarding transition | OPEN |
| B2 | Archive to exited transition | OPEN |
| B3 | Offboarding signal generation | OPEN |
| P1 | SITE_URL verification | OPEN |
| P2 | SMTP delivery proof | OPEN |
| P3 | Storage setup proof | OPEN |
| P4 | Seed-admin tenant metadata proof | OPEN |
| P5 | Production Gate A verification | OPEN |
| P6 | Production Gate B verification | OPEN |
| P9 | Tenant context verification | OPEN |

## Notes on deterministic acceptance behavior
- Gate A replay acceptance must use TeamFrame callback URL form:
  - /auth/callback?token_hash=...&type=magiclink
- Supabase verify URL replay is not used as the acceptance test.

- Gate B failure domains are separated:
  - B1 and B2 validate lifecycle transitions
  - B3 validates signal generation behavior

## Go/No-go at baseline
No-go. Baseline confirms unresolved blockers A1, B1, B2, B3 and production readiness items.
