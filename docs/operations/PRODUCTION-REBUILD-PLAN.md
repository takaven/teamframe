# TeamFrame Production Rebuild Plan

This is the exact non-secret plan for rebuilding the existing Vercel Production shell around the canonical TeamFrame stack. It authorises no provider mutation, spend, secret creation, DNS change, deployment, or customer-data use.

Last reviewed: 2026-09-30 against `main` SHA `ee6507b9b7e0f500e77a1ac05a7ca27ac34e821d`.

## Governing decision

Vercel project `teamframe-production` (`prj_09tvdrEWbL1Ov9SFMtrhgYnJ0bNj`) is a:

> **REBUILD-ONLY HISTORICAL SHELL**

It must not be redeployed from its current configuration. Its disconnected historical Git source, August deployment, environment values, cron, framework setting and function region are not authoritative.

## Intended architecture

| Layer | Final state |
| --- | --- |
| GitHub | `takaven/teamframe`, protected `main`, exact founder-approved release SHA/tag |
| Vercel | Existing `teamframe-production` shell rebuilt in place; Next.js; repository root; canonical repository build configuration |
| Runtime region | One Vercel Function region: Mumbai, India (`bom1` / `ap-south-1`) |
| Supabase | New `teamframe-production-uae` project in organisation `Takaven`, Mumbai (`ap-south-1`), Pro plan |
| Database | Canonical 45-table fresh installation with RLS, grant, policy, function and trigger verification |
| Storage | Private `documents` bucket created by the canonical guarded setup path |
| Email | Resend transactional sender plus Supabase Auth custom SMTP |
| Cron | `/api/automation/run` at `0 4 * * *`, authenticated with the approved shared automation secret |
| Monitoring | Sentry recommended; documented log-only posture is the bounded fallback |
| Customer data | Prohibited until Production acceptance and separate customer-import approval |

## Vercel function region decision

Read-only dashboard inspection showed the shell currently uses `iad1` (Washington, D.C.) and offers `bom1` among its selectable regions. Vercel documents `bom1` as Mumbai / `ap-south-1` and recommends running Functions in the same region as, or close to, their database.

| Item | Decision |
| --- | --- |
| Current region | `iad1` — Washington, D.C., USA |
| Supported candidates relevant to TeamFrame | `bom1` — Mumbai; `dxb1` — Dubai; `sin1` — Singapore |
| Recommended | `bom1` — Mumbai |
| Reason | Exact regional alignment with the proposed Supabase `ap-south-1` project minimises database round-trip latency without adding multi-region complexity |
| Plan caveat | Hobby supports one Function region; Pro supports multiple. TeamFrame needs one primary region for launch. Node failover regions are an Enterprise capability and are not required now. |

Do not add a second Function region merely for appearance. The database is regional, so distant active compute can increase latency without improving the first-customer recovery posture.

Official references:

- [Vercel global regions](https://vercel.com/docs/regions)
- [Configuring Vercel Function regions](https://vercel.com/docs/functions/configuring-functions/region)

## Production environment-variable manifest

No values belong in this document. All eight values currently stored on the Vercel shell are `HISTORICAL — REPLACE` unless the table explicitly says to retire the variable.

| Variable | Required | Scope / location | Source | Manual | Fresh value required | Existing shell action | Verification |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `SITE_URL` | Yes | Vercel Production; mirrored in Supabase Auth Site URL | Approved Production hostname | Yes | Yes | Replace in place | HTTPS origin equals deployed primary hostname; Auth links return to it |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Vercel Production | New Production Supabase project | Yes | Yes | Replace in place | Project ref equals the registry and is not a synthetic ref |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Vercel Production | New Production Supabase project | Yes | Yes | Replace in place | Public client works while RLS remains enforced |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Vercel Production, server-only | New Production Supabase project | Yes | Yes | Replace in place | Server preflight succeeds; value is absent from browser bundles/output |
| `SUPABASE_DB_URL` | Yes for controlled installation; no runtime need identified | Secure operator process only | New Production Supabase pooler/database settings | Yes | Yes | Remove from Vercel after confirming no runtime consumer; do not recreate there | Guard verifies exact ref before installation; value never enters build/runtime logs |
| `TEAMFRAME_AUTOMATION_SECRET` | Yes | Vercel Production, server-only | Fresh cryptographic secret | Yes | Yes | Replace in place | Unauthorised calls return 401; one authorised run succeeds and is idempotent |
| `CRON_SECRET` | Yes | Vercel Production, server-only | Same fresh value as `TEAMFRAME_AUTOMATION_SECRET` | Yes | Yes | Replace in place | Equality check passes; Vercel Cron Bearer authentication succeeds |
| `DEEP_HEALTH_SECRET` | Yes | Vercel Production, server-only | Separate fresh cryptographic secret | Yes | Yes | Replace in place | Unauthorised request denied; authorised deep health succeeds |
| `RESEND_API_KEY` | Yes | Vercel Production, server-only | Restricted Resend Production key | Yes | Yes | Add | Controlled application email succeeds from approved domain |
| `TEAMFRAME_EMAIL_FROM` | Yes | Vercel Production | Verified Resend sender | Yes | Yes | Add | Address is verified, DMARC-aligned and not a reserved test domain |
| `SENTRY_DSN` | Optional pair | Vercel Production, server-only | Approved Sentry project | Yes | Yes if Sentry selected | Add | Server test event arrives without sensitive context |
| `NEXT_PUBLIC_SENTRY_DSN` | Optional pair | Vercel Production, client-visible by design | Same approved Sentry project | Yes | Yes if Sentry selected | Add | Browser test event arrives; paired-variable validation passes |

### Secret creation sequence

1. Create one strong Production-only automation secret privately.
2. Enter that same value as both `TEAMFRAME_AUTOMATION_SECRET` and `CRON_SECRET` because `scripts/validate-env.mjs` requires equality and Vercel Cron authenticates with its Bearer secret.
3. Create a separate strong `DEEP_HEALTH_SECRET` so health access is not coupled to automation execution.
4. Obtain fresh Supabase keys and the process-only database URL from the newly created Production project.
5. Create a restricted Resend Production sending key after its domain is verified.
6. If Sentry is approved, obtain the paired server/browser DSNs from the approved Sentry project.
7. Enter values only in their intended provider scopes. Never send them through chat, Git, documentation, screenshots or command logs.
8. Run `npm run env:check:production` in a controlled environment and report names/status only.

Do not reuse Founder Review, rehearsal or historical Production values.

## Supabase Production creation plan

| Setting | Planned value |
| --- | --- |
| Organisation | `Takaven` (TAKAVEN) |
| Project name | `teamframe-production-uae` |
| Region | Mumbai / `ap-south-1` |
| Plan | Pro |
| Estimated minimum | **$25 USD/month** for the Pro organisation with one Micro project covered by the included $10 compute credit, plus taxes/usage overages |
| Automatic backups | Daily, seven-day retention included with Pro |
| PITR | Not required initially; seven-day PITR is approximately $100/month extra if later approved |
| Customer data | None until final Production acceptance |

The current price must be reconfirmed at the purchase screen before approval. Supabase pricing reference: [Pricing & Fees](https://supabase.com/pricing).

### Password and connection handling

- Use a unique generated database password and store it only in the approved private password-management path.
- Do not copy the password, service key, API keys or credential-bearing connection URLs into chat, Git, documentation or screenshots.
- Use the supported session-pooler/database URL only in the guarded installer process.
- Remove process environment values after the operation; do not make `SUPABASE_DB_URL` a Vercel runtime variable.

### Installation and verification

1. Confirm the exact project ref, organisation, region, plan and empty state.
2. Run the guarded `npm run db:install:fresh` path once.
3. Require exact canonical 45-table inventory.
4. Verify RLS on all 45 application tables.
5. Verify service-role access to all 45 tables and anonymous table access equals zero.
6. Verify required functions, policies, grants, triggers, views and indexes.
7. Run the guarded private Storage setup.
8. Confirm `documents` is private and signed-object access is tenant-scoped.
9. If any install/security gate fails, stop and quarantine the empty target; do not repair it manually.

### Auth and SMTP configuration

- Site URL: `https://<approved-production-hostname>`.
- Permitted callback: `https://<approved-production-hostname>/auth/callback`.
- Invite redirect: the same `/auth/callback` endpoint.
- Magic-link redirect: the same `/auth/callback` endpoint.
- Password recovery must return through the approved application origin and canonical callback flow.
- Permit only the Production origin/callback plus deliberate local-development URLs where operationally required; do not add broad wildcards.
- Configure Resend custom SMTP:
  - host `smtp.resend.com`;
  - port `465` with SSL;
  - username `resend`;
  - password: restricted Resend key, entered privately;
  - sender name `TeamFrame`;
  - sender address: approved verified sender.
- Test invite, magic link, resend and password recovery before acceptance.

References: [Supabase custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp) and [Resend SMTP](https://resend.com/changelog/smtp-service).

## Backup and recovery decision pack

### Recommended first-customer posture

| Control | Recommendation |
| --- | --- |
| Database provider backup | Supabase Pro automatic daily backup, seven-day retention |
| Off-platform database copy | Weekly encrypted logical export plus an export before material schema/configuration changes; retain eight weekly copies |
| Storage-object copy | Daily encrypted incremental copy with inventory/checksum verification; retain 30 daily copies |
| Restore target | Separate approved recovery project in Mumbai; never restore over live Production during rehearsal |
| Restore proof | Production-equivalent synthetic restore before first customer data, then quarterly |
| RPO | 24 hours |
| RTO | 8 business hours for first-customer operations |
| Backup checks | Primary infrastructure operator checks provider backup visibility and off-platform job evidence |
| Restore execution | Primary infrastructure operator executes; recovery delegate independently verifies |
| Restore/cutover approval | Founder approves any Production restore or Vercel cutover |

This deliberately excludes PITR, multi-region databases and enterprise DR tooling. Revisit them when customer volume or contractual commitments require a lower RPO/RTO.

## Resend and DNS manual pack

The founder must first confirm the root domain, DNS account owner, Resend team owner and billing owner. Until then, placeholders below are intentional.

Recommended pattern once ownership is confirmed:

- sending subdomain: `mail.<confirmed-company-domain>`;
- sender: `TeamFrame <no-reply@mail.<confirmed-company-domain>>`;
- API key: restricted to Production sending where Resend supports that scope.

Ordered sequence:

1. Sign into the confirmed Resend team/account.
2. Add `mail.<confirmed-company-domain>` as the sending domain.
3. Copy the exact provider-generated verification, SPF and DKIM records privately to the confirmed DNS account.
4. Add those records without creating a second conflicting SPF record at the same hostname.
5. Add a DMARC monitoring policy (`p=none`) with an approved reporting mailbox; tighten later after verified delivery evidence.
6. Wait for Resend to report the domain verified.
7. Create the restricted Production API/SMTP key and store it privately.
8. Add `RESEND_API_KEY` and `TEAMFRAME_EMAIL_FROM` to Vercel Production.
9. Configure Supabase custom SMTP using the settings above.
10. Send controlled application, invite and password-recovery messages; confirm delivery, links, sender alignment, bounce/complaint visibility and no test-domain use.

Do not hard-code DNS record values before Resend generates them.

## Monitoring decision

### Option A — Sentry (recommended)

- Add paired `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN` values.
- Existing `@sentry/nextjs` initialization, scrubber, error boundaries and `captureActionError` calls already support this path.
- Provides centralised exceptions, affected routes, release context and faster diagnosis than log review alone.
- Requires an approved Sentry account/project and private DSN entry, but no application redesign.

### Option B — documented log-only launch posture

- Use Vercel runtime/build logs, TeamFrame telemetry logs, the notification ledger, `/api/health`, protected `/api/health/deep`, cron execution logs and provider delivery logs.
- Requires an explicit operational decision and named person responsible for daily review during initial launch.
- Limitation: weaker aggregation, alerting, release correlation and client-error visibility than Sentry.

Recommendation: configure Sentry before customer go-live. Log-only may support internal Production acceptance temporarily, but must not be treated as equivalent monitoring.

## Production hostname decision

### Option A — Vercel domain

- Host: `teamframe-production.vercel.app`.
- No DNS change.
- Set `SITE_URL` and Supabase Auth URLs to this origin.
- Suitable for technical Production acceptance and a bounded fallback.
- Customer-facing limitation: provider-branded hostname and a later hostname change would require coordinated Auth/SITE_URL updates and another acceptance pass.

### Option B — approved custom hostname (recommended for customer go-live)

- Exact hostname to be approved after confirming the company domain and DNS owner.
- Requires Vercel domain assignment and DNS verification.
- Set `SITE_URL`, Supabase Site URL and every callback/invite/reset redirect to the exact HTTPS origin.
- Provides the clearest customer trust and avoids changing authentication links after launch.

Recommendation: use the Vercel domain for technical acceptance only; approve and configure a custom hostname before first-customer go-live if DNS ownership can be completed in the final action window.

## Clean rebuild sequence

1. Founder approves Supabase Pro spend, project name, Mumbai region and backup/RPO/RTO decisions.
2. Create `teamframe-production-uae` in organisation `Takaven` only under a separate explicit execution authority.
3. Verify exact target and empty state; run the guarded canonical fresh installer once.
4. Verify 45/45 schema, 45/45 RLS, service-role access and zero anonymous table access.
5. Create and verify the private `documents` bucket and signed-object boundaries.
6. Confirm Resend/DNS ownership; verify the sending domain and configure custom SMTP.
7. Approve the Production hostname; configure exact Supabase Auth Site URL and redirects.
8. Create the shared automation/cron secret, separate deep-health secret and remaining fresh Production credentials privately.
9. Replace the seven runtime-relevant historical Vercel values, add email variables and remove `SUPABASE_DB_URL` from Vercel after confirming it has no runtime consumer.
10. Select Next.js, repository root, canonical build and `bom1`; configure cron `/api/automation/run` at `0 4 * * *`.
11. Connect `teamframe-production` to `takaven/teamframe`; set Production branch to protected `main`.
12. Run configuration parity and `npm run env:check:production` before deployment.
13. Run the complete release gate on the exact `main` SHA; record a rollback candidate.
14. Founder approves the exact release SHA/tag and deployment window.
15. Deploy once and verify the deployed SHA, domain, region and Supabase ref.
16. Run public/deep health, Admin/Manager/Employee/Finance, tenancy, private-file, email, cron, monitoring and backup acceptance checks.
17. Enable and verify Supabase owner MFA before go-live acceptance.
18. Approve customer-data loading only after Production acceptance passes.

## Historical variable transition

Do not delete or inspect current values before the approved maintenance window.

| Existing variable | Transition |
| --- | --- |
| `SITE_URL` | Replace in place after hostname approval |
| `NEXT_PUBLIC_SUPABASE_URL` | Replace in place with new Production project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Replace in place with new Production key |
| `SUPABASE_SERVICE_ROLE_KEY` | Replace in place with new Production key |
| `TEAMFRAME_AUTOMATION_SECRET` | Replace in place with new shared secret |
| `CRON_SECRET` | Replace in place with the same new shared secret |
| `DEEP_HEALTH_SECRET` | Replace in place with separate new secret |
| `SUPABASE_DB_URL` | Remove from Vercel after controlled installation and a final no-runtime-consumer check |

Replacement in place is safer for the seven runtime entries because the Production scope and names are already correct, avoids duplicate precedence, and no deployment will occur until the full manifest passes. `SUPABASE_DB_URL` is the exception: repository inspection found it in controlled scripts, not application runtime, so retaining it in Vercel adds unnecessary credential exposure.

## Final founder action window

### Required before Production creation

1. Approve Supabase Pro at an expected minimum of $25/month plus usage/tax.
2. Approve `teamframe-production-uae`, organisation `Takaven`, Mumbai `ap-south-1`.
3. Approve 24-hour RPO, 8-business-hour RTO, retention and recovery ownership.
4. Approve creation and guarded installation of the exact empty project.

### Required before deployment

1. Confirm Resend team/billing owner, root domain, DNS owner, sending subdomain and sender.
2. Publish and verify provider-generated SPF/DKIM plus approved DMARC monitoring policy.
3. Decide the exact Production application hostname.
4. Approve Sentry or the temporary documented log-only posture.
5. Create and enter fresh Production-only Supabase, automation, health, Resend/SMTP and optional Sentry values privately.
6. Approve rebuilding the Vercel shell: Git connection, Next.js, `bom1`, cron and historical-variable replacement.

### Required before go-live

1. Enable Supabase TOTP MFA and preferably a second factor; verify organisation access remains intact.
2. Review the complete pre-deploy parity result.
3. Approve the exact protected `main` SHA/tag and deployment window.
4. Review Production acceptance evidence and approve go-live.
5. Separately approve first-customer data loading.

Founder Review secret consolidation remains deferred to its own maintenance window and does not belong in the Production rebuild sequence.
