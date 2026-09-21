# TeamFrame launch-test environment identity

This is the operational source of truth for the **synthetic-data-only** launch-test Supabase target. The [execution ledger](EXECUTION_LEDGER.md) owns task state; this page owns environment identity and safety rules. It supersedes this file's earlier generic staging-setup and reset instructions.

## Approved target

| Field | Verified value |
| --- | --- |
| Supabase sign-in for launch testing | `admin@takaven.com` |
| Organization | `Takaven` (`jdlcphgoqpnztlbklkpc`), Free plan |
| Project | `teamframe-launch-test-disposable-20260920` |
| Project ref | `syytforaidoorrvrbqwz` |
| Region | Mumbai / `ap-south-1` |
| Purpose | TeamFrame synthetic security, restore, email and provisioning proof only |

The `admin@takaven.com` account's organization list showed **Takaven only**, with **one project**, on 2026-09-21. Recheck the signed-in email, organization, project name and ref before any write; a page URL alone does not prove access or account identity. Supabase's `main` or `Production` branch label on this *disposable project* does not make it a customer production deployment.

## Other identities and the wrong target

| Item | Current disposition |
| --- | --- |
| `qrsxoumymbcehtltbtgn` | Earlier disposable-named project created under an ARIE-associated Supabase account. **Never use for TeamFrame testing.** Its current content and deletion safety have not been freshly verified. |
| `ismael@ariefinance.com` | Keep separate from TAKAVEN launch testing. No ARIE organization or project may be changed as part of this environment. |
| `isudally@outlook.com` | Ownership/access inventory not completed. Do not infer it owns or can access either project. |

The stale project ref in the execution mandate is **not** authority to connect to `qrsxoumymbcehtltbtgn`. Do not delete that project or any account until its exact organization, contents, dependencies and disposal authorization are verified. Account sign-out is not account deletion.

## Current proof state (2026-09-21)

- The TAKAVEN project was verified in its organization list and showed **zero public TeamFrame tables** after the attempts below. Schema, auth, RLS, storage, email, backup and restore are **not yet passed**.
- The first schema attempt stopped at TLS certificate validation (`self-signed certificate in certificate chain`) before connecting. The runner now trusts the public Supabase CA supplied by this project's Database Settings while retaining certificate and hostname verification (`8a43208`). The CA file's SHA-256 matched the dashboard download. A dummy-password live probe completed TLS and received an expected authentication rejection.
- The next attempt stopped at `password authentication failed for user "postgres"`. The runner's project ref, pooler host, port and username matched the project's official **Session pooler** connection panel. This does **not** prove which password was entered or whether it belongs to this project. Do not claim a migration passed or repeatedly reset passwords without rechecking account/project identity.
- The Free plan does **not** include scheduled project backups. A logical export and clean-target restore, including storage-file verification where applicable, must be executed before backup/restore is marked PASS. Do not purchase or enable a paid plan without the spend approval gate.

## Before any database write

1. Sign in as `admin@takaven.com`. In Supabase, verify the `Takaven` organization contains the named disposable project with ref `syytforaidoorrvrbqwz`.
2. Confirm the project still contains no real ARIE, Baynunah or customer data. Use synthetic fixtures only.
3. Compare the DB connection details with **Connect → Direct → Session pooler** on that exact project. Do not copy connection details from another browser account or project.
4. Use a secure interactive password prompt. Never paste passwords, service-role keys or full credential-bearing URLs into chat, docs, screenshots, logs or repository files. Keep `.env.local` and `.env.staging` out of version control.
5. Set `SUPABASE_PROJECT_REF_STAGING=syytforaidoorrvrbqwz`, `SUPABASE_URL_STAGING=https://syytforaidoorrvrbqwz.supabase.co` and the matching `SUPABASE_DB_URL_STAGING` only for that process. `scripts/apply-schemas-staging.mjs` rejects a mismatched public/DB ref, URL query overrides of TLS, and unverified certificates. `--check-target` checks identity but does not connect or prove migration success.
6. Inspect current schema before applying. The runner has **no migration journal**; do not blindly rerun after a partial failure. Afterward, verify actual tables/policies and record the evidence in the ledger. A terminal command alone is not proof.

Do **not** run `db:reset:staging`, `scripts/setup-staging-project.mjs`, or `scripts/verify-rls.mjs` as a shortcut. Their historical assumptions have not been verified for this isolated-customer launch-test model; the reset is destructive.
