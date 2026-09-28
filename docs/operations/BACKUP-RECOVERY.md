# TeamFrame Backup and Recovery

This document separates existing proof from the required Production posture.

## Current evidence

| Area | Current state |
| --- | --- |
| Synthetic database restore | PASS in the 2026-08-05 disposable rehearsal; 16 application tables count-matched |
| Synthetic Storage restore | PASS; private `documents` bucket recreated, seven objects copied, zero missing active references after fixture repair |
| Auth | Supabase Auth users were not restored by the public-schema path; fresh synthetic users were created and rebound |
| Application start | PASS against the restored synthetic project, including health and signed download |
| Measured restore execution | 47.141 seconds for that small synthetic database/Storage exercise |
| Current Production backup | NONE — replacement Production project does not yet exist |

The historical rehearsal is evidence of a method, not a Production backup guarantee. Its source/restore project refs and external evidence locations remain historical provenance in `backup-and-restore-rehearsal-2026-08-05.md`.

## Required Production posture

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

## Current vs planned

| Control | Current | Planned for Production |
| --- | --- | --- |
| Database backups | Disposable logical rehearsal only | Provider-managed daily backups plus an off-platform logical export |
| Storage recovery | Disposable object-copy rehearsal only | Independent private-object backup/copy with inventory verification |
| Auth recovery | Fresh synthetic identities recreated | Document whether provider restore retains Auth for selected plan; prepare forced re-login and controlled identity recovery |
| Restore target | Disposable project | New isolated recovery project in the same approved region/account |
| RPO | UNDECIDED | Founder/customer approval required |
| RTO | UNDECIDED; small synthetic execution was 47.141s | Founder/customer approval after Production-equivalent rehearsal |
| Recovery owner | UNDECIDED | Named infrastructure owner plus recovery delegate |

## Backup procedure

1. Verify the signed-in Supabase organisation and exact Production ref against [ENVIRONMENTS.md](ENVIRONMENTS.md).
2. Record timestamp, schema/application version, source ref, operator, and intended secure destination.
3. Create a logical database export using the supported Supabase/Postgres path without logging credentials.
4. Inventory and copy private Storage objects separately unless the selected provider backup explicitly guarantees them.
5. Verify export completion and object counts/checksums where supported.
6. Store backups outside the application repository and outside the sole failure domain.
7. Record retention and expiry without recording credentials.

## Restore-to-new-project procedure

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
