# RBAC Rules

**STATUS: CURRENT / PRODUCTION ACCESS GUARD**

This document summarises the implemented authorization guardrails. The canonical product model is [TEAMFRAME_ACCESS_MODEL.md](../TEAMFRAME_ACCESS_MODEL.md).

## Core Rule

All authorization is enforced server-side. Client-side checks are UX hints only and never grant access.

The implemented access model is:

```text
auth identity -> local company membership -> profile -> effective matrix -> operation
```

Legacy JWT role/tenant claims exist only for compatibility and migration fallback. New permission changes resolve from database-backed membership and effective access data.

## Access Profiles

Customer-facing profiles:

- `Admin`: People Operations, without salary/private-file/user-access authority by default.
- `Finance`: compensation view, payment data and finance handoff.
- `Full Access`: all company authority, including access settings.
- `Employee`: self-service baseline.

Derived:

- `Manager`: current direct reports only. This is not a manually assigned broad role.

Flexible:

- `Custom`: the effective matrix differs from a standard preset/derived default.

## Capability Matrix

| Capability | Admin | Finance | Full Access | Manager | Employee |
| --- | :-: | :-: | :-: | :-: | :-: |
| People Operations | all | no | all | direct reports | own self-service |
| Compensation view | no | all | all | direct reports | no |
| Compensation manage | no | no | all | no | no |
| Private documents | metadata only | no | all | no | own permitted documents |
| Payment data | no | all | all | no | own |
| Finance exports | no | yes | yes | no | no |
| Company/access settings | no | no | yes | no | no |

Custom Access may use People Operations, Salary and Private Document scopes from the canonical effective matrix.

## Enforcement Pattern

```text
Request
  -> resolve Supabase session
  -> resolve identity server-side
  -> resolve current company membership/profile/matrix
  -> enforce capability/scope
  -> service/RPC executes scoped operation
```

Every service must reject role, tenant, profile, capability and scope values supplied by a browser as authority.

## Forbidden

- Frontend-only role checks as security.
- Supabase service-role key in browser-reachable code.
- Customer Manager as a third broad RBAC role.
- Any product role above Full Access.
- Private document access inferred from document workflow metadata.
- Recursive Own Team access.
- Department permission scope.
- Generic grant/deny/inheritance rules.
- Permission changes that only take effect after long JWT expiry.
