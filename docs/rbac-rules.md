# RBAC Rules

**STATUS: CURRENT / PRODUCTION ACCESS GUARD**

This document summarises the implemented authorization guardrails. The canonical product model is [TEAMFRAME_ACCESS_MODEL.md](../TEAMFRAME_ACCESS_MODEL.md).

## Core Rule

All authorization is enforced server-side. Client-side checks are UX hints only and never grant access.

The implemented access model is:

```text
auth identity -> company membership -> profile -> capability/scope rules -> effective access
```

Legacy JWT role/tenant claims exist only for compatibility and migration fallback. New ordinary customer permission changes must resolve from database-backed membership and access data.

## Access Profiles

Customer-facing profiles:

- `Admin`: company-wide People Operations.
- `Finance`: compensation view and finance handoff.
- `Full Access`: all company authority, including access settings.
- `Employee`: self-service baseline.

Platform operator:

- `Platform Owner`: unrestricted internal operator identity across TeamFrame customer companies, protected by MFA/AAL2 for privileged surfaces.

Derived:

- `Manager`: current direct reports only. This is not a manually assigned broad role.

Flexible:

- `Custom Access`: profile plus explicit allow/restrict rules.

## Capability Matrix

| Capability | Admin | Finance | Full Access | Manager | Employee | Platform Owner |
| --- | :-: | :-: | :-: | :-: | :-: | :-: |
| People Operations | company-wide | no | yes | direct reports | own self-service | platform-wide |
| Compensation view | no by default | yes | yes | direct reports | no | platform-wide |
| Compensation manage | no | no | yes | no | no | platform-wide |
| Private documents | metadata only | no | yes | no | own permitted documents | platform-wide |
| Finance exports | no | yes | yes | no | no | platform-wide |
| Company/access settings | no by default | no | yes | no | no | platform-wide |

Custom Access can explicitly allow or restrict capabilities by Whole Company, Own Team, Department or Selected People where the scope is meaningful.

## Precedence

1. tenant suspension or closure denies ordinary tenant operation;
2. Platform Owner is unrestricted after MFA/AAL2;
3. employee self-service baseline applies to own permitted records;
4. explicit restriction wins;
5. explicit allow applies;
6. standard profile applies;
7. derived direct-report manager access applies;
8. otherwise deny.

## Sensitive Boundaries

Admin may operate document workflow metadata but does not automatically open, download or export private employee files.

Salary visibility is separate from salary-change authority.

Finance export access does not grant People Operations or private HR documents.

Manager access is direct-report-only, not recursive.

## Enforcement Pattern

```text
Request
  -> resolve Supabase session
  -> resolve identity server-side
  -> resolve current company membership/profile/rules
  -> enforce capability/scope
  -> service/RPC executes scoped operation
```

Every service must reject role, tenant, profile, capability and scope values supplied by a browser as authority.

## Forbidden

- Frontend-only role checks as security.
- Supabase service-role key in browser-reachable code.
- Customer Manager as a third broad RBAC role.
- Platform Owner represented as a customer employee.
- Private document access inferred from document workflow metadata.
- Recursive Own Team access.
- Permission changes that only take effect after long JWT expiry.
