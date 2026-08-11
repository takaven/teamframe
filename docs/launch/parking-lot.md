> **HISTORICAL / SUPERSEDED - NOT GOVERNING CURRENT MARKET-READY SCOPE**
>
> Date marked superseded: 2026-08-11.
>
> This document is retained as product provenance. It does not control the current market-ready programme where it conflicts with:
>
> - `TEAMFRAME_MARKET_READY_SCOPE.md`
> - `TEAMFRAME_MARKET_READY_EXECUTION_REGISTER.md`
> - `TEAMFRAME_DEFERRED_SCOPE.md`
> - `TEAMFRAME_RELEASE_READINESS.md`
>
> In particular, older FPORS/V1 statements that TeamFrame is not an HR system, that reminders/workflows are permanently forbidden, or that leave balances/manager delegation/policy file upload/document requests are V2-only are superseded for the bounded market-ready programme.

---
# Parking Lot — TeamFrame Phase 1A

Items noticed during Weekend 1 execution but not acted on (out of scope per scope lock).

---

| # | Item | Source | Priority estimate |
|---|------|--------|------------------|
| 1 | Leave balances (annual entitlement, days-taken-YTD, carry-over) — approving requests without an entitlement model is not a real leave workflow | Wave 2 (2026-07-03); gap audit 2026-05-30 Gap 4; `/leaves` | High — blocks onboarding a real finance company; explicitly parked to V2 this wave |
| 2 | Leave types (annual, sick, unpaid, parental) — leave requests are currently untyped | Wave 2 (2026-07-03); gap audit 2026-05-30 Gap 4; `/leaves` | High — pairs with leave balances; parked to V2 |
| 3 | Team calendar ("who's out this week") for admins | Wave 2 (2026-07-03); gap audit 2026-05-30 Gap 10; `/leaves` | Medium — admins can survive on the queue view; parked to V2 |
| 4 | CSV bulk import of employees — finance ops teams arrive with spreadsheets | Wave 2 (2026-07-03); gap audit 2026-05-30 `/employees` finding 4 | Medium — manual add works for 6-25 seats; parked to V2 |
| 5 | Notifications layer (leave request landed, task assigned, decision made) | Wave 2 (2026-07-03); gap audit 2026-05-30 Gap 6 | High for stickiness — but drift-guard bans a reminders/notifications engine in V1; needs explicit V2 decision |

---

## How to add items

Add a row per item with:
- Brief description of what was noticed
- Where it was noticed (file/function)
- Why it was deferred (out of scope, needs orchestrator review, etc.)

Do not act on items in this list without orchestrator authorisation.
