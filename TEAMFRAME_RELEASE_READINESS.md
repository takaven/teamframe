# TeamFrame Release Readiness

**STATUS: CANONICAL / CONTROLLING RELEASE GATE**

Current product verdict:

> **PRODUCTION RELEASED**

Current visual verdict:

> **VISUAL GO - READY FOR PRODUCTION**

Production application source:

`3e3daaf517054a561b031057383b2b6f5a9bf143`

This file records product readiness and production release provenance.

Production operation additionally requires the independent-deployment Platform Owner, flexible access and setup/handover model documented in `TEAMFRAME_ACCESS_MODEL.md`.

## Verdict Options

- NOT READY
- CONDITIONAL READY
- MARKET READY

## Final Verification Summary

| Gate | Result |
| --- | --- |
| MR-0 Guided Company Setup | LOCKED / COMPLETE |
| MR-1 Canonical Lifecycle | LOCKED / COMPLETE |
| MR-2 Automation Layer | LOCKED / COMPLETE |
| MR-3A Effective-Dated Employment Changes | LOCKED / COMPLETE |
| MR-3B Manager Delegation | LOCKED / COMPLETE |
| MR-4 Join / Early Employment | LOCKED / COMPLETE |
| MR-5 Documents / Evidence / Policies | LOCKED / COMPLETE |
| MR-6 Leave | LOCKED / COMPLETE |
| MR-7 Offboarding | LOCKED / COMPLETE |
| MR-8 Control Centre / Reliability | LOCKED / COMPLETE |
| Independent deployment access and setup/handover | IN PROGRESS |
| Final full-system disposable E2E | PASS |
| Final visual correction pass | PASS |
| Final mobile containment verification | PASS |
| Security / tenant isolation | PASS |
| Data integrity | PASS |
| Reliability / failure recovery | PASS |
| Source release gates | PASS |
| Remaining P0 blockers | None |
| Remaining P1 blockers | None |

## Final Source Gate Record

| Item | Result |
| --- | --- |
| Typecheck | PASS |
| Lint | PASS |
| Tests | PASS, 32 files / 186 tests |
| Guards | PASS, 4/4 |
| Production build | PASS |
| `npm run verify:release` | PASS |
| `git diff --check` | PASS |

## Final E2E Record

Final fresh-disposable full-system E2E verification completed on 2026-08-12 against `codex/market-ready-implementation`.

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
| Release-blocker correction | `fix: close final market-ready release blockers` |

Runtime verification found one release-blocking defect in the Who's Away projection. The fix fetches approved leave rows and same-tenant employee display data explicitly, avoiding Supabase relationship-cache ambiguity while preserving the MR-6 leave contract.

## Final Visual Record

The final visual production-readiness programme is closed.

| Item | Result |
| --- | --- |
| Direction B / brand system | LOCKED |
| Six-item visual correction pass | PASS |
| `/setup` layout clipping | PASS |
| Desktop Org Chart fit at 1440 and 1366 | PASS |
| Evidence-backed onboarding action | PASS |
| Accepted document replacement state | PASS |
| Employee Profile containment/action hierarchy | PASS |
| Policy upload/version hierarchy | PASS |
| Mobile `/me` Documents containment at 390px | PASS |
| Mobile Org Chart containment at 390px | PASS |
| Final visual source | `0f72d633dcb9ef436e146e87c1f6b9366c761bda` |

## Production Release Record

| Item | Value |
| --- | --- |
| Release date | 2026-08-13 |
| Production application source SHA | `3e3daaf517054a561b031057383b2b6f5a9bf143` |
| Release tag | `teamframe-production-v1.0.0` |
| Vercel project | `teamframe-production` |
| Production URL | `https://teamframe-production.vercel.app` |
| Vercel deployment ID | `dpl_9dLb1FCgaC95sb5LofxTkkZRaqjy` |
| Supabase project | `teamframe-production` |
| Supabase project ref | `zylllrvcmockvfcfubkp` |
| Region | `eu-central-1` |
| Schema apply / reapply | PASS |
| Storage setup | PASS |
| Auth config | PASS |
| Public health | PASS |
| Protected deep health | PASS |
| Automation runner protection | PASS |
| Automation safe invocation | PASS |
| Production business data | Clean empty production state after setup |
| GitHub PR | `https://github.com/ismaelloveexcel/TeamFrame/pull/85` |
| Production branch merge | PAUSED - GitHub Actions billing lock prevents required check from running |

## Release Gates

### Product Scope

- All `IMPLEMENT` items in `TEAMFRAME_MARKET_READY_EXECUTION_REGISTER.md` completed and locked.
- All `VERIFY DURING IMPLEMENTATION` items verified or promoted to fixes.
- `DEFER` and `OUT OF SCOPE` boundaries preserved.
- No unapproved feature expansion.

### Company Setup

- New target customer can establish the company, administrator and basic defaults.
- Guided setup can begin ordinary use without developer or direct database intervention after controlled admin provisioning.

### Lifecycle

- Canonical lifecycle works end-to-end.
- PRE_START, ONBOARDING, ACTIVE, OFFBOARDING and FORMER behaviour is truthful.
- Active counts and obligations use the lifecycle projection.
- Former employees do not create normal active-HR obligations.

### People & Early Employment

- Employee, position and reporting truth remains synchronized.
- Employment changes preserve effective-dated history.
- 30-day check-in works from deterministic configured conditions.
- Probation workflow works without becoming performance management.

### Automation

- Reminder/escalation mechanism operational.
- No duplicate or noisy reminders.
- Completion suppresses future reminders correctly.
- Founder primarily sees decisions and exceptions.
- Background jobs are idempotent and tenant-scoped.

### Documents

- Employee request/upload loop works.
- Admin upload remains secure.
- Evidence-required task closure is truthful.
- Expiry and replacement logic works.
- Upload validation and private storage protections remain intact.

### Policies

- File upload/version/acknowledgement/reminder works.
- Simple in-app authoring remains truthful if retained.
- Archived versions retain history but create no current obligations.
- Former users do not contaminate current acknowledgement counts.

### Leave

- Leave type, allocation, balance, request, conflict, approval/decline and history work.
- Insufficient Annual Leave is warned/blocked by default with explicit authorised override.
- Manager/founder routing follows the approved delegation model.
- Annual Leave uses Monday-Friday working days and Jan 1-Dec 31 calendar-year periods.

### Offboarding

- Exit workflow works end-to-end.
- End date, checklist, owners, handover, access-removal, asset-return and final HR/payroll inputs are represented where relevant.
- Former/archive transition suppresses inappropriate future reminders.
- Org Chart vacancy behaviour is correct.

### Delegation

- Approved manager scope works securely.
- Managers can act only for authorised direct-report responsibilities.
- Managers do not gain private HR document access, policy administration, tenant administration or unrestricted employment-change authority.

### Reliability

- No ambiguous success/failure.
- Exports are reliable and provide truthful status.
- Stale counters resolved.
- Resolution/history remains durable.
- False-success vacant-position deletion regression covered.
- Sentry/App Router production observability warnings resolved.
- Control Centre counts and work queues are derived from authoritative current workflow state.
- Routine HR work does not become a Signal merely because it is due.

### Security

- RLS tests pass.
- Tenant isolation tests pass.
- Manager delegation tests pass.
- Employee upload tests pass.
- Service-role paths remain server-only and tenant-scoped.
- Storage paths remain private and tenant-scoped.

## Accepted Limitations

These are intentional release boundaries, not defects:

- no statutory leave engine;
- no leave accrual, carry-forward or pro-rating;
- no public-holiday engine;
- no payroll calculation, tax filing or payslips;
- no ATS/recruiting pipeline;
- no benefits administration;
- no enterprise RBAC;
- no workflow builder;
- no performance-management suite;
- no AI legal/compliance conclusions;
- no standalone asset-management module.

## Production Release Status

TeamFrame is deployed to the dedicated production Vercel and Supabase targets above. The production app is live on the Vercel production URL.

Repository merge to `main` is paused because GitHub Actions reports: "The job was not started because your account is locked due to a billing issue." Branch protection requires `Gate Chain (Strict)`, so the production PR cannot be merged until the GitHub account billing lock is cleared and CI can run.

## Final Product Verdict

> **PRODUCTION RELEASED**
