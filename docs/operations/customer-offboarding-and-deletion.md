# Customer Offboarding and Tenant Deletion Runbook

Purpose: remove one TeamFrame customer tenant from a disposable or production
environment while retaining only the minimum operational evidence needed to
prove deletion.

This runbook is for controlled operational execution. It is not a product
feature and it must not be used against production without explicit founder
approval.

## Scope

Delete tenant-owned application data, generated files, and associated synthetic
or customer auth identities for one named tenant. Keep unrelated tenants
untouched.

Covered data:

- Tenant record
- Admin and employee auth identities
- Employee records and employee profiles
- Documents and private Storage objects
- Policies and acknowledgements
- Leave records
- Onboarding tasks
- Compensation records
- Risk signals and action items
- Generated exports
- File-operation records
- Audit records

## Preconditions

- Target tenant ID and tenant slug/name are confirmed.
- The execution environment is confirmed and recorded.
- A backup or disposable restore point exists before deletion.
- A service-role credential is available only to the operator executing the
  runbook.
- No real customer data is used during rehearsal.
- Evidence output is written outside the repository.

## Procedure

1. Record the target tenant ID, project ref, operator, timestamp, and reason.
2. Capture pre-delete counts for every covered table filtered by tenant ID.
3. Capture a cross-tenant control count for at least one unrelated tenant.
4. List every Storage object under tenant-scoped prefixes:
   - `<tenant_id>/documents/`
   - `<tenant_id>/exports/`
5. Generate a short-lived signed URL for one target Storage object and record
   that it works before deletion.
6. List auth identities mapped to the target tenant.
7. Delete target tenant Storage objects.
8. Delete generated export metadata and finalise related file operations.
9. Delete tenant-owned application records in dependency-safe order.
10. Delete or unlink target tenant auth identities.
11. Verify all target tenant application counts are zero.
12. Verify target tenant Storage prefixes are empty.
13. Verify the pre-delete signed URL is no longer useful.
14. Verify cross-tenant control counts are unchanged.
15. Re-run the deletion procedure for the same tenant and verify it exits
    cleanly with no additional changes required.
16. Record elapsed time, command outcomes, and evidence file paths.

## Evidence Requirements

The evidence bundle must include:

- Environment and project ref
- Target tenant ID and synthetic tenant label
- Pre-delete counts
- Post-delete counts
- Cross-tenant control counts before and after
- Storage object list before deletion
- Storage object list after deletion
- Signed URL invalidation result
- Auth identity deletion or unlinking result
- File-operation finalisation result
- Idempotent re-run result
- Elapsed time

## Pass Criteria

- Target tenant-owned application records are removed.
- Target employee records are removed.
- Target auth identities are removed or explicitly unlinked.
- Target private Storage objects are removed.
- Target generated exports are removed.
- File-operation records are either removed with the tenant data or finalised
  before deletion according to the evidence log.
- No signed URL for deleted tenant files remains useful.
- Cross-tenant data is unchanged.
- Required deletion evidence is retained outside the repository without
  retaining unnecessary employee data.
- Re-running the runbook is safe and idempotent.

## Fail Criteria

- Any target tenant record remains without an explicit reason.
- Any target Storage object remains.
- Any target signed URL can still retrieve deleted content.
- Any unrelated tenant record changes.
- Auth identities remain linked to the deleted tenant without an explicit
  operational decision.
- Evidence contains secrets or unnecessary employee data.

## Disposable Rehearsal - 2026-08-05

Verdict: **PASS** for disposable synthetic verification.

Project ref: `lrssimflgvhfdgrdkbnz`

Target tenant deleted: `c2ac5fe2-b46d-4c06-a323-82b20bc02df5`

Cross-tenant control tenant:
`9bbe7f6f-0061-405d-a740-b5cda4ca7439`

Seeded target tenant contents:

- 1 tenant record
- 2 auth identities: one admin, one employee
- 2 employee records
- 1 employee profile
- 1 compensation row
- 1 document metadata row
- 1 private document Storage object
- 1 policy
- 1 acknowledgement
- 1 leave row
- 1 onboarding task
- 1 risk signal
- 1 action item
- 1 generated export metadata row
- 1 private export Storage object
- 2 file-operation rows
- 1 audit row
- 1 analytics event

Execution result:

- First deletion removed all target tenant application rows.
- First deletion removed 2 tenant-scoped Storage objects.
- First deletion removed both synthetic auth identities.
- Pre-delete signed URL returned 200.
- Post-delete signed URL creation failed with `Object not found`.
- Cross-tenant control counts were unchanged.
- Second deletion run was idempotent: 0 rows removed, 0 Storage objects
  removed, auth identities already absent.

Elapsed time:

- First deletion run: 6.801 seconds.
- Idempotency re-run: 5.470 seconds.

External evidence:

`C:\Users\isuda\Dev\TeamFrame-hardening-evidence\operational-closure-2026-08-05\tenant-deletion-rehearsal-result.json`

The evidence file contains synthetic `.example` identities only and no real
employee data.
