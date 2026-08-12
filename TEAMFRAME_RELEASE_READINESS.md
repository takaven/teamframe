# TeamFrame Release Readiness

**STATUS: CANONICAL / CONTROLLING RELEASE GATE**

Current verdict:

> **MARKET READY - CONTROLLED ACTUAL USE VERIFIED**

The market-ready implementation checkpoints MR-0 through MR-8 are locked. Final fresh-disposable full-system E2E verification completed on 2026-08-12 against `codex/market-ready-implementation` at final commit `268d9682d15e6c4afb4c83dbfde76b8b531f541d`.

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
- Control Centre counts and work queues are derived from authoritative current workflow state.
- Routine HR work does not become a Signal merely because it is due.

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

## Final Verification Record

| Item | Result |
| --- | --- |
| Final disposable project | `teamframe-final-e2e-20260812194017` / `idtttbnijnjhwctthorf` |
| Disposable project cleanup | Deleted and confirmed absent |
| Clean schema apply / reapply | PASS |
| Storage setup | PASS |
| Verify install | PASS |
| Verify integration | PASS |
| Verify RLS | PASS |
| Full synthetic E2E | PASS |
| Typecheck | PASS |
| Lint | PASS |
| Tests | PASS, 32 files / 186 tests |
| Guards | PASS |
| Production build | PASS |
| `git diff --check` | PASS |
| Release-blocker correction | `fix: close final market-ready release blockers` |

Runtime verification found one release-blocking defect in the Who's Away projection: the original Supabase embedded relationship query was ambiguous after the market-ready schema gained multiple employee relationships. The fix fetches approved leave rows and same-tenant employee display data explicitly, avoiding relationship-cache ambiguity while preserving the MR-6 leave contract.

## Final Verdict

> **MARKET READY - CONTROLLED ACTUAL USE VERIFIED**

No P0 or P1 market-ready blocker remains based on the final disposable full-system verification. Deployment, production secret rotation and production go-live remain separate authorisations.
