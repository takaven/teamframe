# TeamFrame Account Ownership

No credentials, keys, passwords, recovery codes, or database connection strings belong in this document.

Last verified: 2026-10-17. Resource ownership, access permission and billing responsibility are separate facts; do not infer one from another.

## Ownership matrix

| Provider | Account / organisation | Verified owner/admin | Billing owner | Required login for TeamFrame work | Security state |
| --- | --- | --- | --- | --- | --- |
| GitHub | Organisation `takaven` | `isudally` has verified admin permission on `takaven/teamframe`, `takaven/takaven-web` and `takaven/product-portfolio` | `UNKNOWN — VERIFICATION REQUIRED` | `isudally` or another explicitly authorised `takaven` organisation admin | Protected `main` and repository rules remain the change boundary |
| Vercel | Team `Takaven`, slug `takaven`, ID `team_cXj0JaXqYVDGppqmiqNXIxVg` | `admin@takaven.com` is the sole Team owner after the completed project transfer | TAKAVEN team plan is Pro; exact billing payer/renewal owner is `UNKNOWN — VERIFICATION REQUIRED` | `admin@takaven.com` | Both TeamFrame application projects and `takaven-web` are verified in this team; former personal account is not a team member |
| Supabase | Organisation `Takaven`, ID `jdlcphgoqpnztlbklkpc`; Production project ref `ttwsczpzjdjzuhchbyjx` | `admin@takaven.com` has verified access. Underlying account/resource owner and billing owner are `UNKNOWN — VERIFICATION REQUIRED`; do not infer ownership from access. | `UNKNOWN — VERIFICATION REQUIRED`; Production and Founder Review display Free at the latest provider check | `admin@takaven.com` currently accesses the `Takaven` organisation | Existing ownership is intentionally retained; MA-001 MFA remains open before real customer data |
| Resend | Account/team `UNKNOWN — VERIFICATION REQUIRED` | Production sending domain and sender were previously accepted; current account owner must be verified before key/domain changes | `UNKNOWN — VERIFICATION REQUIRED` | Current authorised Resend owner, to be recorded privately | Never infer provider ownership from the configured sender address |
| DNS | Registrar/provider: GoDaddy for `takaven.com` | Account owner and recovery identity `UNKNOWN — VERIFICATION REQUIRED` | `UNKNOWN — VERIFICATION REQUIRED` | Current authorised GoDaddy owner | `app.takaven.com`, `www`, Microsoft 365 and Resend records share the namespace; scope every change narrowly |
| Sentry | Organisation/project `UNKNOWN — VERIFICATION REQUIRED` | No DSN variables are present in the verified Vercel application environments | `UNKNOWN — VERIFICATION REQUIRED` | Current authorised Sentry owner if telemetry is activated | External event receipt remains unverified; DSN-gated application behaviour is documented in source |

## Task-to-account map

| Task | Provider account required | Checks before action |
| --- | --- | --- |
| Source/PR/branch management | GitHub `takaven` | Repository is `takaven/teamframe`; base is `main`; branch is intentional |
| Founder Review hosting | Vercel `Takaven` / `admin@takaven.com` | Project ID is `prj_7aEgmyR1qQP8VfaFbFN7CexbWVNW`; Git source, target deployment, domain and non-secret variable inventory verified |
| Production hosting | Vercel `Takaven` / `admin@takaven.com` | Project ID is `prj_09tvdrEWbL1Ov9SFMtrhgYnJ0bNj`; Git source, `main`, `app.takaven.com`, deployment SHA and non-secret variable inventory verified; explicit release approval required before change |
| Marketing hosting | Vercel `Takaven` / `admin@takaven.com` | Project ID is `prj_d0VTmOdVmnB6Di3S99fjPea7V5mz`; source is `takaven/takaven-web`, not this application repository |
| Founder Review database | Supabase `Takaven` | Project ref is exactly `dcfxyjrfsrkibhpbmjnw`; synthetic-only scope |
| Production database | Supabase `Takaven` | Exact project is `teamframe-production-uae` / `ttwsczpzjdjzuhchbyjx`; verify signed-in account and ref; never use a historical ref |
| Transactional email/Auth SMTP | Resend owner `UNKNOWN — VERIFICATION REQUIRED` + Supabase `Takaven` | Verify Resend account/team, sending domain, API-key scope, sender and exact Supabase project before change |
| DNS records | GoDaddy account owner `UNKNOWN — VERIFICATION REQUIRED` | Verify account authority, exact record, affected subdomains, rollback and owner approval |
| Runtime telemetry | Sentry owner `UNKNOWN — VERIFICATION REQUIRED` | Verify organisation/project and paired DSN configuration before enabling or sending a synthetic event |

## Domain and sender map

| Name | Current purpose/state | Authority required for change |
| --- | --- | --- |
| `app.takaven.com` | Verified Vercel domain for `teamframe-production`; valid HTTPS at last check | TAKAVEN Vercel owner plus authorised GoDaddy operator if DNS changes |
| `www.takaven.com` | Verified Vercel domain for `takaven-web`; CNAME checkpoint `10074f97bb5aebf8.vercel-dns-017.com` | TAKAVEN Vercel owner plus authorised GoDaddy operator |
| apex `takaven.com` | Shared company namespace; intentionally not transferred with TeamFrame projects | Authorised GoDaddy/company-domain owner; assess every affected service first |
| `mail.takaven.com` | Verified Resend sending domain; Production sender `TeamFrame <no-reply@mail.takaven.com>` | Current authorised Resend owner plus GoDaddy owner for DNS |
| Microsoft 365 mail records | Existing company mail routing/protection in the same DNS zone | Do not change during TeamFrame DNS work without separate company-mail approval |

## Required ownership corrections before real customer data

1. Enable MFA for the authorised Supabase organisation owner account used for TeamFrame operations and retain recovery access safely in the final manual-action window before go-live. Underlying account/resource ownership must be verified rather than inferred.
2. Identify the Resend account/team owner and billing owner.
3. Identify the GoDaddy account owner/recovery path and who can approve DNS changes.
4. Identify the Sentry organisation/project owner if telemetry will be activated.
5. Record a second authorised recovery path or succession owner for critical provider accounts where commercially appropriate.
6. Confirm the Vercel billing payer/renewal owner rather than inferring it from the sole team owner.

These are account-governance tasks, not product features. Do not change permissions or create credentials without the relevant approval.

The authoritative status, prerequisites and verification for founder-interactive work are maintained in [MANUAL-ACTIONS.md](MANUAL-ACTIONS.md).
