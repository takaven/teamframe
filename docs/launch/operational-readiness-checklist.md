# Operational Readiness Checklist

All items must be checked before public launch. Each item links to the relevant runbook or verification artifact where one exists.

Current checkpoint (2026-09-26): **NOT YET READY**. The live Production project
is historical and disconnected from the canonical repository; the recorded
Supabase target is not visible in the signed-in TAKAVEN organization; email,
current Cron, observability and current backup evidence are incomplete. Do not
interpret unchecked boxes as optional.

Primary M20 evidence artifact: `docs/launch/verification/m20-backup-pitr-recovery-evidence.md`

## Infrastructure

- [ ] Supabase project on Pro tier (or equivalent plan with daily backups)
- [ ] Recovery posture recorded (daily backups minimum; PITR optional for initial launch)
- [ ] Daily backup confirmed active in Supabase dashboard
- [ ] Supabase project region confirmed to match data residency commitment
- [ ] Vercel production environment configured with all required env vars

## Email / Auth

- [ ] Application transactional sender and Supabase Auth email provider configured
- [ ] Sending domain SPF record verified
- [ ] Sending domain DKIM record verified
- [ ] Sending domain DMARC record configured
- [ ] Magic link deliverability tested to Gmail
- [ ] Magic link deliverability tested to Outlook / Hotmail
- [ ] Magic link deliverability tested to at least one corporate mail domain
- [ ] Supabase magic link email template updated to token_hash format

## Monitoring

- [ ] Sentry/equivalent wired and receiving test events, or an explicit tested log-only decision recorded
- [ ] `/api/health` route live and returning 200
- [ ] BetterStack or Pingdom uptime monitor configured on `/api/health`
- [ ] Uptime alert routed to email or phone

## Operational Readiness

- [ ] Vercel rollback rehearsed at least once (actually performed, not just read)
- [ ] `runbooks/support-debugging.md` completed with real query examples
- [ ] `runbooks/secret-rotation.md` completed with real steps
- [ ] `runbooks/rollback-procedure.md` completed with real steps
- [ ] `runbooks/incident-response.md` completed with real communication templates

## Security Hardening

- [ ] All M1–M8 (Critical) items in audit-findings-consolidated.md marked Complete
- [ ] All M9–M16 (High) items marked Complete or explicitly deferred to accepted-risks.md
- [ ] `verification/rls-verification-checklist.md` fully completed and all rows Pass
- [ ] `verification/security-smoke-test.md` fully completed and all tests Pass
- [ ] `verification/post-deploy-validation.md` template ready

## Launch Gate

- [ ] Cold-signup smoke test completed by a person who is not me
- [ ] That person reached a working dashboard without assistance
- [ ] Privacy Policy live at a public URL
- [ ] Terms of Service live at a public URL
- [ ] Current canonical SHA deployed and verified (not the historical `37bf104...` deployment)
- [ ] Production Cron is `0 4 * * *` and one authenticated execution is observed
- [ ] Customer implementation input pack is `IMPLEMENTATION READY`
- [ ] Admin, Manager and Employee handovers pass with the customer configuration
