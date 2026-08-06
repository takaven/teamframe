# Backup and Restore Rehearsal - 2026-08-05

Verdict: **PASS** for disposable synthetic verification.

This rehearsal used disposable Supabase projects only. It is not production
backup approval.

## Projects

| Role | Project ref | Notes |
|---|---|---|
| Source disposable project | `razbmeuixshlptmgzgea` | Existing synthetic runtime-verification project |
| Restore disposable project | `lrssimflgvhfdgrdkbnz` | Fresh project created for restore rehearsal |

## Method

The Supabase CLI logical dump path was attempted, but this Windows environment
could not execute it because Docker Desktop was unavailable. The CLI produced a
Docker prerequisite error, so that output was not counted as backup proof.

The executed rehearsal used:

- TeamFrame schema application into the fresh restore project
- Private `documents` bucket recreation
- Logical table export/import over the PostgreSQL connection
- Separate private Storage object copy
- Post-restore row-count comparison
- Post-restore active file-reference validation
- Fresh synthetic Auth users bound to restored employee records
- Restored app build and production start check

## Database Restore Evidence

Tables restored and count-matched:

- `companies`
- `employees`
- `employee_profiles`
- `compensation`
- `documents`
- `leaves`
- `audit_logs`
- `risk_signals`
- `action_items`
- `analytics_events`
- `onboarding_tasks`
- `policies`
- `procedures`
- `acknowledgements`
- `file_operations`
- `export_files`

Source and restore row counts matched for all 16 tables. Total non-empty
application counts included 6 companies, 12 employees, 7 documents, 4 leaves,
4 risk signals, 4 action items, 5 onboarding tasks, 6 file operations, and
4 export metadata records.

## Storage Restore Evidence

Private bucket recreated: `documents`

Storage objects copied: 7

Active restored database file references were verified against restored Storage
objects. Missing active references after copy: 0.

During rehearsal, three active synthetic document metadata rows in the source
project referenced objects that were not present in Storage. Synthetic
placeholder PDF objects were uploaded to repair the disposable test data before
the final restore run. Deleted/expired historical metadata was not required to
point to live objects.

## Auth Expectations

Supabase Auth users are not restored by public schema/table backup. The
functional restore check therefore created fresh synthetic auth users after the
database restore and bound them to restored employee records.

Validated:

- Fresh synthetic admin auth user created
- Admin password sign-in passed
- Admin JWT contained restored tenant claim
- Fresh synthetic employee auth user created
- Employee magic-link generation passed

## Application Start Evidence

The restored environment was built from the clean execution copy and started in
production mode.

Validated:

- Production build passed
- Public health returned 200
- Protected deep health without secret returned 401
- Protected deep health with header secret returned 200
- Deep health subsystems reported `db=ok`, `storage=ok`, `auth=ok`
- Signed download from a restored private document succeeded

## Timing

Database and Storage restore execution: 47.141 seconds.

App build/start verification was recorded separately in the external evidence
bundle.

## Evidence Location

External evidence directory:

`C:\Users\isuda\Dev\TeamFrame-hardening-evidence\operational-closure-2026-08-05`

Key evidence files:

- `backup-restore-result.json`
- `source-storage-reference-repair.json`
- `restore-functional-check-result.json`
- `restore-clean-copy-build-output.txt`
- `restore-app-start-result.json`

Secret files in the same external directory must not be committed or shared.

## Remaining Notes

This rehearsal proves the disposable recovery procedure for synthetic data. A
production recovery plan must still account for production plan capabilities,
retention policy, Storage object backup cadence, auth identity handling, and
operator access controls.
