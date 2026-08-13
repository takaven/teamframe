# Auth Rules

## Auth Model

- **Authentication method**: two-tier Supabase Auth
  - Admin/Finance/Full Access operators: email + password at `/admin/login`
  - Employees: Magic Link at `/auth`
- **No password reset flows** exist
- **No OAuth providers** allowed
- **No ordinary-user MFA requirement** in V1

User identity is always:

- a Supabase Auth user, keyed by email;
- resolved server-side from the Supabase SSR cookie;
- authorized through local company membership and effective access.

## Employee Login Flow

```text
1. Employee enters email on /auth
2. Server action calls supabase.auth.signInWithOtp({ email })
3. Employee receives a magic-link email
4. User clicks link -> /auth/callback?token_hash=...&type=magiclink
5. Session cookie is set
6. Server resolves actor -> employee/membership -> role default
```

## Operator Login Flow

```text
1. Operator enters email + password on /admin/login
2. Server action calls supabase.auth.signInWithPassword({ email, password })
3. Server resolves identity and verifies authorized customer-local access
4. Unauthorized sessions are signed out and denied
5. Authorized operators redirect to /dashboard
```

## Role Assignment

Roles and access are server-controlled and never derived from client input.

Guided company setup does not itself authorize public/open self-registration. A paid-customer administrator may be provisioned through a controlled onboarding path, after which ordinary company setup must not require developer or direct database intervention.

- Customer access is database-backed through local company memberships and effective access fields.
- Legacy `admin` role claims migrate to Full Access.
- The legacy `admin` role is set only through legitimate infrastructure-side bootstrap/recovery tooling.
- Employees are created by an authorized operator via the in-product flow. The first magic-link sign-in links the auth user to the employee record by email.

**Never** allow:

- self-role escalation;
- role passed in a request body, cookie, header or query string;
- role inferred from email domain or any heuristic;
- open signup.

## Currently Forbidden Without Separate Product/Security Approval

- Sign-up form / open registration
- Password reset or email-change flows
- OAuth providers
- TOTP, WebAuthn, SMS or MFA for ordinary tenant users
- Account-deletion self-service

## Supabase Project Configuration

In Supabase Dashboard or via Management API:

| Setting | Value |
|---|---|
| Email provider | enabled |
| Magic Link | enabled |
| Password login | enabled for controlled operators |
| Allow new users to sign up | disabled |
| Confirm email | disabled for password signups |
| OAuth providers | all disabled |

## Magic-Link Email Template

For local development, the Supabase Magic Link email template must use the `token_hash` callback shape:

```text
http://localhost:3030/auth/callback?token_hash={{ .TokenHash }}&type=magiclink
```

For production:

```text
{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=magiclink
```

Do not use password reset, invite-acceptance, OAuth or MFA templates as product entry points unless the auth model is separately approved and updated.

## Auth Regression Checklist

Run this after any change to `app/auth/**`, `middleware.ts`, Supabase email templates or redirect configuration.

- [ ] Newest magic link works
- [ ] Reused link fails gracefully
- [ ] Stale/expired link fails gracefully
- [ ] Webmail click works
- [ ] Cross-browser click works
- [ ] No infinite redirect loop after successful login
- [ ] Logout -> login again works in the same browser session
- [ ] Operator lands on `/dashboard`; employee lands on the employee self-service default route
