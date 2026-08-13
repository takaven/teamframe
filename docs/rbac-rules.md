# RBAC Rules

## Core Rule

All authorization is enforced server-side. Client-side checks are UX hints only and never grant access.

Authentication is currently two-tier:

- admins use email + password at `/admin/login`;
- employees use magic links at `/auth`.

See [`auth-rules.md`](auth-rules.md).

## Current Implemented Roles

TeamFrame has two implemented auth roles:

1. `admin`
2. `employee`

Manager delegation is implemented as bounded direct-report authority derived from the reporting relationship. It is not a third broad RBAC role. Do not add ad hoc roles or client-side role shortcuts.

## Market-Ready Manager Delegation Boundary

Managers may, for authorised direct reports only:

- approve/decline leave;
- contribute to onboarding;
- provide probation input;
- complete manager-owned tasks;
- receive routine escalations.

Managers do not automatically gain:

- private HR document access;
- company-wide employee access;
- policy administration;
- tenant administration;
- confidential employee-relations information;
- unrestricted employment-change authority.

Prefer deriving manager/reporting relationships from existing employee/org structure where technically safe. No enterprise RBAC.

## Current Capability Matrix

| Capability | admin | employee |
| --- | :-: | :-: |
| List all employees | yes | limited org/public fields only where exposed |
| View own profile | yes | yes |
| View any profile in full | yes | no |
| Create/update/archive employee | yes | no |
| View/edit compensation | yes, where implemented | no |
| Upload document for any employee | yes | own requested documents only |
| Submit own leave request | yes, if linked employee | yes |
| Approve/reject leave | yes | direct-report manager only where authorised |
| Manage policies | yes | no |
| Acknowledge assigned policies | no normal admin need | yes |
| Manage Org Chart positions/JDs | yes | no |
| Generate exports | yes | no |

## Org Chart And Employee-Scope Field Whitelist

When non-admin employee/org views are exposed, return only non-sensitive organisation fields unless an explicit employee self-service flow authorises more:

- `id`
- `full_name`
- `role_title`
- `department`
- `manager_id`
- `status` / lifecycle-safe public equivalent

Compensation, private contact details, HR documents, policy administration data and confidential records must not be selected in employee-scope or future manager-scope queries unless specifically authorised and tested.

## Enforcement Pattern

```text
Request
  -> resolve Supabase session
  -> resolve actor server-side
  -> derive tenant and role from trusted metadata/database state
  -> call role/tenant guard
  -> service layer executes scoped query or mutation
```

Service-layer functions accept an explicit `Actor` argument and re-validate authorization. They never trust role, tenant or employee identifiers supplied by a browser as authority.

## Audit

Sensitive admin, future manager-delegated and storage-affecting actions must write audit evidence from the service layer or transactional database mutation path.

## Forbidden

- Frontend-only `role === admin` or `role === manager` as a security boundary.
- Supabase service-role key in browser-reachable code.
- Role, tenant or manager scope accepted from request body, cookie, header or query string as authority.
- Broad custom roles to satisfy one-off features.
- Manager delegation implemented without tenant, direct-report and negative authorization tests.
