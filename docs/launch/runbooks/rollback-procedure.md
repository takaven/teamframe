# Rollback Procedure

This runbook covers the decision criteria and execution steps for rolling back a production deployment. Follow sections in order. Do not skip post-rollback verification.

## When to Roll Back

_Define threshold — e.g. auth broken, tenant data leak suspected, >10% 500 error rate._

Decision criteria to be documented here.

## Vercel Deploy Rollback Steps

Steps to complete with real Vercel dashboard or CLI instructions.

## Supabase Migration Rollback Steps

_Alembic downgrade command, verify data integrity after._

Steps to complete with real migration commands and integrity checks.

## Database Restore Procedure (Tested-Restore / Restore-to-New-Project)

Added Wave 4. This is the procedure referenced by
`docs/launch/verification/m20-backup-pitr-recovery-evidence.md` Sections 3 and 4.
Supabase restores to a NEW project (it does not overwrite in place), so the safe
pattern — for both the rehearsal and a real incident — is restore-to-new-project
followed by verification and (only in a real incident) env-var cutover.

**Who executes:** founder (only person with Supabase dashboard owner access).
**When rehearsing:** use a throwaway target project and skip the Cutover section.

### Restore steps

1. Open https://supabase.com/dashboard → project `eucnsrtdjxcylknbuglw` → **Database → Backups**.
2. Pick the restore source:
   - PITR (Path A): **Point in Time** tab → choose the timestamp to restore to
     (immediately before the incident; for a rehearsal, any recent point).
   - Daily backup (Path B): **Scheduled backups** tab → choose the most recent
     backup preceding the incident.
3. Choose **Restore to a new project**, name it clearly (e.g.
   `teamframe-restore-YYYYMMDD`), same region as production, and start the restore.
   Record the initiation timestamp.
4. Wait for the new project to report ready (minutes to ~1h depending on DB size).
   Record the ready timestamp — this drives the measured RTO.
5. From the new project's **Project Settings → API**, collect the new URL,
   anon key, and service-role key. Do NOT put these anywhere near the
   production Vercel env yet.
6. Run the verification checklist below against the restored project (point a
   local `.env.local` at it: `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
   `SUPABASE_DB_URL`).

### Post-Restore Verification Checklist

- [ ] `npm run db:inspect` against the restored project completes without errors
- [ ] Row counts sane for the core tables (`companies`, `employees`, `documents`,
      `leaves`, `onboarding_tasks`, `policies`, `risk_signals`, `action_items`)
      versus last-known production counts
- [ ] `npm run verify:rls` passes against the restored project (RLS survived the restore)
- [ ] App boots locally against the restored project (`npm run dev`), admin login works
- [ ] Employee list, leave queue, and dashboard signals render with real restored data
- [ ] Storage note: verify the `documents` bucket contents; storage objects are
      restored per current Supabase backup behaviour for the chosen tier — if
      objects are missing, document the gap in the M20 evidence pack

### Cutover notes (real incident only — never during a rehearsal)

- Cutover = repointing production at the restored project by updating the Vercel
  production env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`) and redeploying.
- Auth: users live in the restored project's `auth` schema; magic links and admin
  passwords carry over, but active sessions signed against the old project's JWT
  secret die at cutover — all users must sign in again. Announce this.
- Re-run `npm run auth:lock` (Supabase auth contract) and re-verify the Supabase
  email (SMTP/Resend) settings on the new project — provider settings are
  project-level and may not carry over.
- The old project should be paused, not deleted, until the incident post-mortem
  closes.
- Rehearsal teardown: delete the throwaway project after recording evidence in
  the M20 pack (Section 4).

## Post-Rollback Verification

Steps to confirm the system is stable after rollback.
