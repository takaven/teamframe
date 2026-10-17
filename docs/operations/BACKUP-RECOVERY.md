# TeamFrame Backup and Recovery

This document separates historical proof, the immediate pre-migration safety requirement and the stronger posture required before real customer data. Last reconciled: 2026-10-17.

## Current evidence

| Area | Current state |
| --- | --- |
| Synthetic database restore | PASS in the 2026-08-05 disposable rehearsal; 16 application tables count-matched |
| Synthetic Storage restore | PASS; private `documents` bucket recreated, seven objects copied, zero missing active references after fixture repair |
| Auth | Supabase Auth users were not restored by the public-schema path; fresh synthetic users were created and rebound |
| Application start | PASS against the restored synthetic project, including health and signed download |
| Measured restore execution | 47.141 seconds for that small synthetic database/Storage exercise |
| Current Production project | EXISTS — `teamframe-production-uae`, ref `ttwsczpzjdjzuhchbyjx`, Mumbai / `ap-south-1`, PostgreSQL `17.6.1.171` at last verification |
| Current Production backup | **HOLD** — no Production database export, Storage export or isolated restore proof has been completed |
| Current Production Storage | Private `documents` bucket exists; zero objects at the 2026-10-17 read-only checkpoint |

The historical rehearsal is evidence of a method, not a Production backup guarantee. Its source/restore project refs and external evidence locations remain historical provenance in `backup-and-restore-rehearsal-2026-08-05.md`.

## Immediate pre-migration requirement

Before applying `migrations/20261016_application_integrity.sql`, obtain explicit authority and create a bounded encrypted logical snapshot of the exact Production project. At minimum preserve:

- application/public schema and data;
- functions, triggers, RLS policies, grants and relevant roles;
- Auth/Storage metadata needed to understand dependencies;
- bucket configuration and a separate object inventory/copy (currently expected zero objects, but recheck at execution time);
- source ref, PostgreSQL/tool versions, timestamp, row counts, exclusions and integrity hashes;
- a documented restore command and an operator review showing the export is readable and internally consistent.

This proportionate snapshot reduces migration risk for the current synthetic/bootstrap-only environment. It is **not** full Supabase project recovery and does not close MA-003 or MA-009. A successful `pg_dump` alone does not prove recovery of Auth configuration, SMTP, URL settings, secrets, Edge Functions or Storage object bytes.

Docker is not inherently required. Use a PostgreSQL 17-compatible supported client or Supabase-supported export tooling. The last workstation check did not establish a suitable PostgreSQL 17 client, Docker runtime and encryption toolchain; installing or acquiring tools is a separate approved action if still necessary.

## Required posture before real customer data

Before real customer HR data:

- provider-managed daily database backups enabled;
- retention recorded;
- restore owner and backup-access owner recorded;
- off-platform logical database backup process selected and tested;
- private Storage-object backup/copy process selected and tested;
- Auth identity/session implications documented;
- recovery target created separately from Production;
- RPO and RTO approved;
- one restore-to-new-project rehearsal completed using Production-equivalent configuration and synthetic data.

If the selected Supabase plan does not provide the approved database backup posture, upgrade before loading customer data. PITR is not currently required for initial launch unless the founder/customer decision changes.

Plan selection, spend approval, RPO, RTO, retention and named recovery ownership are manual decisions tracked as MA-003 and MA-009 in [MANUAL-ACTIONS.md](MANUAL-ACTIONS.md). Documentation, export/restore tooling, inventory checks and synthetic restore verification may continue independently before those decisions.

## Current vs planned

| Control | Current | Planned for Production |
| --- | --- | --- |
| Database backups | No Production export; disposable logical rehearsal only | Provider-managed daily backups plus an off-platform logical export |
| Storage recovery | Disposable object-copy rehearsal only | Independent private-object backup/copy with inventory verification |
| Auth recovery | Fresh synthetic identities recreated | Document whether provider restore retains Auth for selected plan; prepare forced re-login and controlled identity recovery |
| Restore target | Disposable project | New isolated recovery project in the same approved region/account |
| RPO | Awaiting founder approval | Recommended: 24 hours |
| RTO | Awaiting founder approval; small synthetic execution was 47.141s | Recommended: 8 business hours after Production-equivalent rehearsal |
| Recovery owner | Awaiting founder approval | Primary infrastructure operator executes; recovery delegate verifies; founder approves restore/cutover |

## Founder-ready recommendation

- Supabase Pro automatic daily database backups with seven-day retention.
- Weekly encrypted off-platform logical export retained for eight weeks and an export before material schema/configuration changes.
- Daily encrypted private Storage-object copy with inventory/checksum verification, retained for 30 days.
- Restore only to a separate approved Mumbai recovery project.
- Complete one Production-equivalent synthetic restore before customer data and repeat quarterly.
- Initial RPO: 24 hours.
- Initial RTO: 8 business hours.

PITR is not recommended for the first-customer baseline. At current published pricing, seven-day PITR is approximately $100/month in addition to the Pro plan; add it only if contractual or operational requirements demand a lower RPO.

## Authorised backup procedure

1. Verify the signed-in Supabase organisation and exact Production ref against [ENVIRONMENTS.md](ENVIRONMENTS.md).
2. Record timestamp, schema/application version, source ref, operator, and intended secure destination.
3. Confirm the selected PostgreSQL/Supabase client is compatible with PostgreSQL 17 and create a logical export without logging credentials.
4. Inventory and copy private Storage objects separately unless the selected provider backup explicitly guarantees them.
5. Verify export completion and object counts/checksums where supported.
6. Store backups outside the application repository and outside the sole failure domain.
7. Record retention and expiry without recording credentials.

## Restore-to-new-project procedure for MA-009

1. Obtain explicit restore/recovery approval.
2. Create a separate project; never overwrite Production during rehearsal.
3. Restore the database/schema/data using the approved provider/logical method.
4. Restore private Storage objects and bucket restrictions.
5. Reapply project-level Auth URL, SMTP, templates, and redirect settings as required.
6. Verify canonical tables, RLS, privileges, row counts, Auth behaviour, Storage references, signed downloads, and application health.
7. Run role-boundary smoke checks.
8. Only for a real incident, approve the Vercel variable cutover and redeploy.
9. Keep the old Production project until incident review closes.

## Recovery cautions

- Database dumps do not automatically prove Storage or Auth recovery.
- Existing user sessions may become invalid after a project/JWT cutover.
- Never put backups, API keys, database passwords, or credential-bearing URLs in Git.
- Never use Founder Review or a rehearsal project as a Production recovery target.
- Do not delete a failed/old Production project until recovery acceptance and retention decisions are complete.

## Missing prerequisites and approvals

The immediate backup remains blocked on:

1. explicit authority to extract the current Production logical data/configuration;
2. a verified PostgreSQL 17-compatible export client and encryption mechanism;
3. an approved encrypted off-platform destination and separate key custodian;
4. re-verification that Storage still has zero objects, or a supported private-object copy if it does not;
5. a bounded review/restore-validation method appropriate to the current synthetic-only risk.

Do not create a new Supabase project, install Docker, upgrade billing or extract Production data as part of documentation work. Supabase ownership is intentionally retained in the existing `Takaven` organisation.
