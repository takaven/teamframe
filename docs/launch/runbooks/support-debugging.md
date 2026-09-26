# Support Debugging Runbook

This runbook provides first-line support steps for the first paying customers.
All database checks require an exact approved `tenant_id`; never search across
tenants by name or email alone. Record time, user, route/action and request ID.
Do not copy private document contents into tickets or logs.

## Customer says they can't log in

1. Confirm the user's exact email, tenant and time of failure.
2. Check Supabase Auth logs for the request and whether the user is active/revoked.
3. Check the active tenant membership and employee link:
   `select email, profile, active, removed_at, employee_id from tenant_memberships where tenant_id = $1 and lower(email) = lower($2);`
4. Check `employees.auth_user_id`, lifecycle state and deletion state within the same tenant.
5. Confirm the Production site/callback URL and email delivery status. Never reset
   or relink a user until tenant identity is proven.

## Customer says they can't see an employee

1. Confirm viewer membership/profile and the expected employee ID.
2. Query only the named tenant:
   `select id, full_name, manager_id, lifecycle_state, deleted_at from employees where tenant_id = $1 and id = $2;`
3. For a Manager, confirm the live `manager_id` relationship. For a scoped access
   profile, inspect the relevant membership scope. Do not broaden permissions as
   a diagnostic shortcut.

## Customer reports incorrect leave status

1. Query the exact leave row by tenant and ID, including `status`, decision and
   cancellation timestamps.
2. Compare it with the tenant-scoped `audit_logs` entries and approval automation
   item. A stale UI write must be retried from a refreshed page, not patched by hand.
3. If balance is disputed, inspect the leave definition, opening adjustments,
   approved requests and working-day/holiday configuration for the same year.

## Looking up audit log for a customer

Use an admin-authorised, tenant-scoped query:
`select action_type, target_id, actor_user_id, created_at from audit_logs where tenant_id = $1 order by created_at desc limit 100;`
Use `target_id`, action and time to narrow further. The audit table is evidence;
do not edit it to make state appear correct.

## Checking magic link send history

1. For application notifications, inspect `notification_deliveries` by exact tenant,
   recipient and time. Record status, attempt count, safe error and provider ID.
2. Retry only the existing failed ledger row through the supported admin action.
3. For sign-in/reset/invite email, inspect Supabase Auth logs and the configured
   Auth SMTP provider. Confirm redirects and suppression/bounce state.

## Other first-line cases

| Report | First check | Safe recovery |
| --- | --- | --- |
| Document missing | Tenant-scoped document row, file operation, private object path | Re-upload/request through supported UI; never make bucket public |
| Import failed | Import preview errors and created count | Correct exact rows; exclude already-created rows before retry |
| Page slow | Vercel request logs, cold/warm timing, Supabase errors | Retry once warm; escalate repeatable >5s route with request ID |
| Data appears wrong | Exact row plus audit history | Refresh/stale-write retry; no manual patch without incident approval |

Escalate immediately as S1 if any user can see another tenant's data, a private
file is publicly accessible, or a service-role/credential may be exposed.
