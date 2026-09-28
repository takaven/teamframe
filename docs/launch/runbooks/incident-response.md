# Incident Response Runbook

This runbook defines severity levels, first-response steps, and communication templates for production incidents.

## Severity Definitions

- **S1 Critical:** suspected tenant/private-file exposure, credential compromise,
  destructive data loss, or authentication unavailable for all customers. Stop
  writes/deployments, preserve evidence, notify the product owner immediately.
- **S2 Major:** a core workflow fails for one or more customers with no safe
  workaround, sustained 5xx/errors, or automation/email failure affecting due work.
- **S3 Limited:** isolated user/record failure, degraded performance or a safe
  workaround exists without changing access boundaries.

## First-30-Minutes Checklist

1. Record detection time, reporter, affected tenant/user, route/action and request ID.
2. Classify severity; for S1, stop risky writes and page the product owner.
3. Check public/deep health, current Vercel deployment/logs, Supabase status/logs,
   Sentry (if configured), notification ledger and Cron history.
4. Identify the first failing boundary and blast radius without cross-tenant queries.
5. Choose the safest mitigation: feature/workflow pause, application rollback,
   credential rotation, or provider recovery. Never restore over Production or
   manually patch customer rows without specific approval.
6. Send the first customer update for S1/S2, then update at the stated interval.

## Communication Templates

Customer: `We are investigating an issue affecting [workflow] since [time]. We
have [contained/not yet contained] the impact. Please avoid [specific action]
while we verify recovery. Next update: [time]. No data-impact statement will be
made until confirmed.`

Internal: `Severity [S1/S2/S3]; detected [time]; tenant(s) [IDs only]; symptom;
last known good deployment; first failing boundary; containment; owner; next
decision/update time.`

## Post-Incident Review Template

- Incident summary
- Timeline of events
- Root cause
- Impact (users affected, data affected)
- Resolution steps taken
- Prevention measures for next time
- Owner and due date for each prevention item
