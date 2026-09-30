# TeamFrame Production Preparation

This is the non-secret, non-destructive Production specification. It prepares the work but does not authorise infrastructure creation, spend, secret changes, DNS changes, customer data, or deployment.

Last reviewed: 2026-09-30 against `main` SHA `ee6507b9b7e0f500e77a1ac05a7ca27ac34e821d`.

The parity audit is complete. The exact configuration, transition order and founder decision pack now live in [PRODUCTION-REBUILD-PLAN.md](PRODUCTION-REBUILD-PLAN.md).

## Production target specification

| Layer | Intended target | Current state | Approval boundary |
| --- | --- | --- | --- |
| Source | `takaven/teamframe`, protected branch `main` | Active and accepted | Exact release SHA/tag still requires deployment approval |
| Hosting | Vercel project `teamframe-production` (`prj_09tvdrEWbL1Ov9SFMtrhgYnJ0bNj`), team `ismaelloveexcels-projects` | **REBUILD-ONLY HISTORICAL SHELL**; all retained values are untrusted | Git connection, configuration replacement and deployment require approval |
| Database | New project proposed as `teamframe-production-uae`, Supabase organisation `Takaven` | Not created | Final name, Mumbai region, plan and spend require approval |
| Region | Mumbai / `ap-south-1` | Proposed | Confirm with project plan before creation |
| Schema | Current canonical 45-table fresh install with RLS/security gates | Installer proof complete on disposable infrastructure | Run once on an approved empty Production target; no manual repair |
| Storage | Private `documents` bucket and canonical policies | Specification ready | Create only with the approved Production project |
| Email | Resend transactional sender plus Supabase Auth custom SMTP | Provider/account/domain not yet owned in the registry | Account, domain, DNS and credentials require founder/owner action |
| Backups | Provider-managed database backups plus off-platform logical DB and private-object recovery | Design recorded; plan, retention, RPO/RTO and owners pending | Founder/billing approval required before customer data |
| Customer data | Real customer HR data | None | Separate implementation and data-loading approval after Production acceptance |

## Environment-variable manifest

Values must be created privately and must never be copied from Founder Review or rehearsal environments.

| Name | Intended scope | Authoritative source | Prepared automatically | Manual action | Acceptance check |
| --- | --- | --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel Production | New Production Supabase project | Name/scope validation | Enter approved target value | Host/ref matches registry |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel Production | New Production Supabase project | Name/scope validation | Enter fresh Production value | Public client connects; RLS remains enforced |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel Production, server-only | New Production Supabase project | Server-only/scope validation | Enter fresh Production value | Read-only preflight passes; value is not browser-exposed |
| `SUPABASE_DB_URL` | Controlled release operations only | New Production Supabase project | Format/target validation without logging | Enter through approved secure channel | Guard confirms exact Production ref before installation |
| `SITE_URL` | Vercel Production and Supabase Auth | Approved Production domain | URL validation | Confirm final domain | Auth redirects and links use the approved HTTPS origin |
| `DEEP_HEALTH_SECRET` | Vercel Production, server-only | Fresh generated secret | Presence/scope validation | Generate and enter privately | Unauthorised request denied; authorised check succeeds |
| `TEAMFRAME_AUTOMATION_SECRET` | Vercel Production, server-only | Fresh generated secret | Presence/scope validation | Generate and enter privately | Unauthorised automation denied; one safe authorised run succeeds |
| `CRON_SECRET` | Vercel Production, server-only | Same approved automation secret where required by Vercel Cron | Equality requirement can be validated without revealing value | Configure privately | Scheduled endpoint authenticates and remains idempotent |
| `RESEND_API_KEY` | Vercel Production, server-only | Restricted Resend Production key | Presence/scope validation | Create and enter privately | Test transaction uses approved domain only |
| `TEAMFRAME_EMAIL_FROM` | Vercel Production | Verified Resend sender | Address-format validation | Approve sender identity | Sender domain is verified and DMARC-aligned |
| Sentry variables or documented log-only decision | Vercel Production | Approved monitoring account/decision | Manifest validation | Account-owner choice if enabled | No secret exposed; test event/log route verified |

The existing eight variables on the historical Vercel shell are not evidence of correctness. Replace and validate them rather than trusting their names.

## Backup and recovery design

- Select a Supabase plan that supports the approved database backup posture.
- Record provider retention and access ownership.
- Produce off-platform logical database exports without credential-bearing logs.
- Copy and inventory private Storage objects independently unless the chosen provider backup explicitly covers them.
- Restore only to a separate approved recovery project.
- Verify schema, RLS, row counts, Auth implications, Storage references, signed downloads and role boundaries.
- Approve RPO, RTO, retention, recovery owner and delegate before customer data.

The detailed procedure is in [BACKUP-RECOVERY.md](BACKUP-RECOVERY.md). The human decisions are MA-003 and MA-009 in [MANUAL-ACTIONS.md](MANUAL-ACTIONS.md).

## Resend and DNS action list

1. Identify the authorised Resend account/team and billing owner.
2. Select a controlled transactional sending subdomain and sender address.
3. Create a least-privilege Production sending key privately.
4. Publish only the exact provider-issued domain-verification, SPF and DKIM records.
5. Publish an approved DMARC policy and verify alignment.
6. Configure Supabase custom SMTP with the approved sender and private credentials.
7. Send controlled Auth and application transactions; verify delivery, branding and failure handling.

Steps involving accounts, DNS or secrets remain in MA-005 through MA-007. No record values are stored here.

## Vercel Production connection plan

1. Reconfirm team `ismaelloveexcels-projects` and project ID `prj_09tvdrEWbL1Ov9SFMtrhgYnJ0bNj`.
2. Record and remove or replace historical configuration only within the approved Production window.
3. Connect `takaven/teamframe`; set Production branch to protected `main`.
4. Bind only freshly verified Production variables from the manifest above.
5. Configure the intended `0 4 * * *` cron and its private authentication.
6. Deploy the exact approved release SHA/tag, never an unreviewed branch head.
7. Verify deployment identity, public health, protected deep health and rollback target.

No connection or deployment is authorised by this plan.

## Launch acceptance checklist

### Automated or operator-executable after targets exist

- [ ] Environment target and variable-name validation
- [ ] Canonical fresh install and 45-table inventory
- [ ] RLS, policy, privilege, trigger and function gates
- [ ] Private Storage setup and signed-download verification
- [ ] Release suite and Production build
- [ ] Public and protected health checks
- [ ] Admin, Manager, Employee and Finance role-boundary smoke checks
- [ ] Tenant-isolation and private-file checks
- [ ] Import/operator-path reconciliation using synthetic proof data only
- [ ] Automation authentication and idempotency check
- [ ] Backup export plus restore-to-new-project rehearsal
- [ ] Deployment SHA/domain/Supabase-ref reconciliation

### Founder or account-owner controlled

- [ ] Complete applicable items in [MANUAL-ACTIONS.md](MANUAL-ACTIONS.md)
- [ ] Approve plan/spend, RPO/RTO and recovery ownership
- [ ] Complete Resend/DNS/domain ownership actions
- [ ] Enter fresh secrets privately
- [ ] Enable Supabase MFA before go-live
- [ ] Approve exact deployment SHA/tag and go-live window

## Automation boundary

| Work | Classification |
| --- | --- |
| Documentation, manifests, target checks, schema/security verification, release tests, smoke scripts, reconciliation | Automatable |
| MFA, billing, DNS, provider ownership, secret creation/entry, destructive approval, Production deployment approval | Founder/account-owner action |
| Creating paid infrastructure, connecting Production hosting, deploying, or loading customer data | Explicit approval required; not performed during preparation |

## Next step

Execute the grouped founder decisions in [MANUAL-ACTIONS.md](MANUAL-ACTIONS.md) only under a separate, explicit Production authority. Do not mutate the rebuild-only shell before its dependencies are ready.
