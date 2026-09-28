# TeamFrame Account Ownership

No credentials, keys, passwords, recovery codes, or database connection strings belong in this document.

Last verified: 2026-09-28.

## Ownership matrix

| Provider | Account / organisation | Verified owner/admin | Billing owner | Required login for TeamFrame work | Security state |
| --- | --- | --- | --- | --- | --- |
| GitHub | Organisation `takaven` | Authenticated user `isudally` has ADMIN on `takaven/teamframe` | Organisation billing email is recorded as `isudally@outlook.com` | `isudally` or another explicitly authorised `takaven` admin | Personal fallback tokens for `ismaelloveexcel` and `ariefinance` were invalid during inventory; do not rely on them |
| Vercel | Team slug `ismaelloveexcels-projects` (display name `ismael's projects`), team ID `team_LUgbx4qzGleJbDFrfMKYLjDm`, Hobby | Sole member `ismaelloveexcel` / `isudally@gmail.com`, Owner | Same sole owner is the only verified billing-capable identity; formal billing responsibility otherwise undocumented | The `ismaelloveexcel` owner in this exact team | Vercel UI reports 2FA enabled |
| Supabase | `Takaven`, organisation ID `jdlcphgoqpnztlbklkpc`, Free | Sole member `admin@takaven.com`, Owner | UNKNOWN beyond the sole owner | `admin@takaven.com` in the `Takaven` organisation | **MFA disabled — close before Production provisioning** |
| Resend | UNKNOWN | UNKNOWN | UNKNOWN | Must be recorded before domain/API-key work | Not inventoried; no account or sending domain should be assumed |
| DNS | UNKNOWN | UNKNOWN | UNKNOWN | Must be recorded before SPF/DKIM/DMARC changes | Not inventoried |

## Task-to-account map

| Task | Provider account required | Checks before action |
| --- | --- | --- |
| Source/PR/branch management | GitHub `takaven` | Repository is `takaven/teamframe`; base is `main`; branch is intentional |
| Founder Review Preview | Vercel `ismaelloveexcels-projects` | Project is `teamframe-founder-review`; deployment is Preview; branch is the launch branch |
| Production hosting | Vercel `ismaelloveexcels-projects` | Project is `teamframe-production`; Git/ref/domain/env target all verified; explicit Production approval present |
| Founder Review database | Supabase `Takaven` | Project ref is exactly `dcfxyjrfsrkibhpbmjnw`; synthetic-only scope |
| Production database | Supabase `Takaven` | Replacement project name/ref recorded in ENVIRONMENTS; Production approval present; never use historical ref |
| Transactional email/Auth SMTP | Resend account TBD + Supabase `Takaven` | Sending domain ownership, API-key scope, sender, and target Supabase project verified |
| DNS records | DNS provider/account TBD | Exact domain, record names/values, rollback, and owner approval recorded |

## Required ownership corrections before Production

1. Enable MFA for the sole Supabase organisation owner and retain recovery access safely.
2. Identify the Resend account/team owner and billing owner.
3. Identify the DNS provider/account owner and who can approve records.
4. Record a second authorised recovery path or succession owner for critical provider accounts where commercially appropriate.
5. Confirm the Vercel billing owner rather than inferring it from sole membership.

These are account-governance tasks, not product features. Do not change permissions or create credentials without the relevant approval.
