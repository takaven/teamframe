# TeamFrame Blocker Definition of Done Matrix

Purpose: No blocker can move to Closed without the required closure evidence listed here.

## Release blocker closure contract

| Blocker | Definition of Done | Required evidence artifact |
|---|---|---|
| A1 Auth callback reliability | All Gate A scenarios pass in runtime without callback 500 | Scenario evidence pack: screenshots, final URL for each scenario, and server log extract showing no callback 500 during run |
| B1 Start offboarding transition | UI action sets employee lifecycle_state to offboarding | DB query output showing employees.lifecycle_state = offboarding for target employee after action |
| B2 Archive to exited transition | Archive action sets lifecycle_state to exited and deleted_at not null | DB query output showing employees.lifecycle_state = exited and deleted_at is not null for target employee |
| B3 Offboarding signal generation | After offboarding + dashboard reconcile, incomplete_offboarding signal exists open in DB | DB query output from risk_signals for target employee showing open incomplete_offboarding row |
| P1 SITE_URL verification | Production SITE_URL configured to final production domain | Deployment config capture showing SITE_URL value |
| P2 SMTP delivery proof | Real delivery succeeds to external inbox | Message ID + provider log + recipient inbox proof |
| P3 Storage setup proof | Production storage setup script executed successfully | Command output and storage object/bucket verification output |
| P4 Seed-admin tenant metadata proof | Seed-admin run stamps admin app_metadata with tenant_id | Pre and post query output confirming app_metadata.tenant_id exists |
| P5 Production Gate A verification | Gate A scenarios pass in production environment | Production auth evidence pack (screenshots, URL outcomes, logs) |
| P6 Production Gate B verification | Gate B lifecycle and signal behavior pass in production environment | Production DB query outputs for employees and risk_signals with target IDs |
| P9 Tenant context verification | Admin tenant context is valid for authenticated actions | Verified admin metadata plus successful authenticated action proof in production |

## Closure policy
- Status can only be Open or Closed.
- Partial, mostly done, and nearly done are not valid statuses.
- Each blocker closure PR must include a direct link to its evidence artifact.
- If evidence is missing, blocker remains Open.
