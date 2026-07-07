# START HERE — TeamFrame from zero to running

This is the complete path from a fresh copy of this code to a working local
install and a production deploy. Every command is copy-pasteable. Steps that
cannot be automated are explicitly marked **MANUAL** with the exact click path —
nothing here pretends to be automatic when it is not.

Commands are written for a POSIX shell (Git Bash on Windows, or any macOS/Linux
shell). PowerShell variants are given where the syntax differs.

---

## 1. Prerequisites

- **Node.js 20.19 or newer** (`node --version` to check) — <https://nodejs.org>
- **A Supabase account** and one project for TeamFrame (the free tier works for
  a local install; see the honest limitations in step 6) — <https://supabase.com/dashboard>
- The TeamFrame source tree (the directory containing this file)

## 2. Install dependencies

```bash
npm ci
```

## 3. Configure the environment

```bash
cp .env.example .env.local
```

(PowerShell: `Copy-Item .env.example .env.local`)

Open `.env.local` and fill in these variables. All values for the first four
come from your Supabase project dashboard.

| Variable | Required | Where to get it / what to put |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase dashboard → Project Settings → API. Looks like `https://<project-ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Same page — the `anon` `public` key |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Same page — the `service_role` key. Server-only; never expose it |
| `SUPABASE_DB_URL` | yes | Supabase dashboard → Project Settings → Database → Connection string → URI. Use the **Session pooler** (port 5432) form and replace `[YOUR-PASSWORD]` with your database password |
| `SITE_URL` | yes | `http://localhost:3030` for a local install |
| `HEALTHCHECK_SECRET` | recommended | Any random secret (`openssl rand -hex 32`); gates the detailed `/api/health` output |
| `NEXT_PUBLIC_PILOT_CONTACT_EMAIL` | optional | Address behind the landing page "Request a pilot" button. Leave unset and the button simply isn't rendered |
| `SUPABASE_ACCESS_TOKEN` | optional | Personal access token (<https://supabase.com/dashboard/account/tokens>) — only needed if the `npx supabase` CLI in step 6 is not already logged in |
| `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_DEBUG` | optional | Leave blank; Sentry stays dormant |
| `SUPABASE_SERVICE_ROLE_KEY_CI`, `SUPABASE_DB_URL_CI` | optional | CI only; leave blank locally |

Validate what you filled in:

```bash
npm run env:check
npm run env:check:smoke
npm run env:check:db
```

All three must print `✓ Environment validation passed`.

## 4. Apply the database schema

```bash
npm run db:apply
```

Applies every file in `/schemas` in locked order. Idempotent — safe to re-run.
(To wipe and start over on a disposable database: `ALLOW_DESTRUCTIVE_RESET=true npm run db:reset`.)

## 5. Create the storage bucket

```bash
npm run storage:setup
```

Creates the private `documents` bucket (idempotent).

## 6. Configure Supabase auth

TeamFrame's auth contract (see `docs/auth-rules.md`): email provider enabled
(admins: password at `/admin/login`; employees: magic link at `/auth`), new-user
signups **disabled**, Site URL = your `SITE_URL`. Two working ways to apply it:

### 6a. Automated route (recommended) — `supabase config push`

The contract is committed as `supabase/config.toml`. Push it to your project
(`<project-ref>` is the id in your project URL, e.g. `abcdefghijklmnopqrst`):

```bash
npx supabase link --project-ref <project-ref>
npx supabase config push
```

- The first `link` may ask you to log in (`npx supabase login`) or you can set
  `SUPABASE_ACCESS_TOKEN`; if it prompts for the database password you can
  paste it or press Enter to skip — linking works either way.
- `config push` prints a diff of exactly what will change and asks to confirm.
- Verified on the free tier. Re-running when nothing changed prints
  `Remote Auth config is up to date.`

### 6b. MANUAL alternative — dashboard click path

If you prefer clicking (same result as 6a):

1. Supabase dashboard → **Authentication** → **Sign In / Providers**:
   under *User Signups*, disable new user signups; under *Auth Providers*,
   ensure **Email** is enabled.
2. **Authentication** → **URL Configuration**: set *Site URL* to your
   `SITE_URL` value (`http://localhost:3030` locally) and add
   `http://localhost:3030/**` to the redirect URLs.

### 6c. MANUAL — magic-link email template (employee sign-in only)

Honest limitation, verified 2026-07-06: on the **free tier with Supabase's
built-in mailer**, email templates **cannot be modified** (the API rejects it:
*"Email template modification is not available for free tier projects using the
default email provider"*), and the built-in mailer only delivers to your
project's team-member addresses with tight rate limits.

**Admin password login (steps 8–11) needs no email at all — you can finish this
install and use the whole product as the admin without this step.** You only
need it when real employees should sign in by magic link:

1. Supabase dashboard → **Authentication** → **Emails** → SMTP settings:
   configure a custom SMTP provider (or upgrade to a paid plan).
2. Set the Magic Link template body to the contents of
   `supabase/templates/magic-link.html` — its link must be
   `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=magiclink` —
   either in **Authentication** → **Emails** → Templates, or by uncommenting the
   `[auth.email.template.magic_link]` block in `supabase/config.toml` and
   re-running `npx supabase config push`.

## 7. Seed your admin (one command)

Pick an email and a password (min 8 characters). The password is read from the
environment and never printed or stored by the script.

```bash
SEED_ADMIN_PASSWORD='<your-password>' npm run seed:admin -- you@yourcompany.com "Your Name" "Founder" "Leadership" "UTC"
```

PowerShell:

```powershell
$env:SEED_ADMIN_PASSWORD='<your-password>'; npm run seed:admin -- you@yourcompany.com "Your Name" "Founder" "Leadership" "UTC"
```

This creates the tenant, creates the auth user with your password (no invite
email — any domain works), stamps the `admin` role **and** the tenant claim on
the JWT, creates the matching employee row, and then proves the login works by
signing in with the anon key and signing out. It ends with a success summary.
Re-running is safe: it re-stamps the claims and resets the password.

## 8. Verify the installation

```bash
npm run verify:install
```

Prints PASS/FAIL for five assertions (schema order, live JWT-only tenant
resolution, required objects + RLS, a login-capable seeded admin, idempotent
demo seed) and exits non-zero if anything fails. If everything passes, the
install is good.

## 9. (Optional) Seed demo data

```bash
npm run seed:demo
```

Creates a **separate demo tenant** (slug `demo-fpors`; all identities are fake
`.example` addresses) exercising every signal category. Idempotent. Skip for a
clean production tenant.

Data is tenant-scoped, so the admin from step 7 will NOT see the demo data —
their tenant is their own. To browse the demo tenant, seed a second admin into
it (the tenant is inferred from the email domain, so use `@demo-fpors.example`):

```bash
SEED_ADMIN_PASSWORD='<your-password>' npm run seed:admin -- demo-admin@demo-fpors.example "Demo Admin"
```

Sign in with that identity at `/admin/login` to see the fully seeded dashboard.

## 10. Run it

```bash
npm run dev
```

## 11. Sign in

Open <http://localhost:3030/admin/login> and sign in with the email from step 7
and your `SEED_ADMIN_PASSWORD` value. You land on `/dashboard`.

Employees sign in at <http://localhost:3030/auth> by magic link — that flow
requires step 6c.

---

## Deploying to production (Vercel)

Full detail: `docs/launch/deployment-runbook.md` (Option A). Summary:

1. Gate chain on the release tree — all must pass:
   ```bash
   npm ci && npm run env:check && npm run lint && npm run typecheck && npm run guards && npm run build
   ```
2. Point `.env.local` at the **production** Supabase project, then repeat steps
   4–8 above against it (`db:apply`, `storage:setup`, auth contract with the
   production `SITE_URL`/domain, `seed:admin`, `verify:install`).
3. Link and configure Vercel (one-time):
   ```bash
   npm i -g vercel
   vercel link
   ```
   Then `vercel env add` for each of: `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SITE_URL`
   (your production domain), `HEALTHCHECK_SECRET`,
   `NEXT_PUBLIC_PILOT_CONTACT_EMAIL`, and the Sentry variables if used.
4. Deploy:
   ```bash
   vercel --prod
   ```
5. Post-deploy verification (`docs/launch/deployment-runbook.md` §3):
   `curl -sf https://YOUR-DOMAIN/api/health` returns `{"status":"ok"}`;
   `/dashboard` redirects to `/auth` when signed out; admin password login
   round-trips at `/admin/login`.
6. Rollback: `vercel ls` then `vercel promote <previous-deployment-url>`;
   database per `docs/launch/runbooks/rollback-procedure.md`.
