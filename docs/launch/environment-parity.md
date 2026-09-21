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

The `admin@takaven.com` account's organization list initially showed **Takaven only**, with **one project**, on 2026-09-21; a second synthetic-only project was subsequently created below. Recheck the signed-in email, organization, project name and ref before any write; a page URL alone does not prove access or account identity. Supabase's `main` or `Production` branch label on this *disposable project* does not make it a customer production deployment.

## Other identities and the wrong target

| Item | Current disposition |
| --- | --- |
| `qrsxoumymbcehtltbtgn` | Earlier disposable-named project created under an ARIE-associated Supabase account. **Never use for TeamFrame testing.** Its current content and deletion safety have not been freshly verified. |
| `ismael@ariefinance.com` | Keep separate from TAKAVEN launch testing. No ARIE organization or project may be changed as part of this environment. |
| `isudally@outlook.com` | Ownership/access inventory not completed. Do not infer it owns or can access either project. |

The stale project ref in the execution mandate is **not** authority to connect to `qrsxoumymbcehtltbtgn`. Do not delete that project or any account until its exact organization, contents, dependencies and disposal authorization are verified. Account sign-out is not account deletion.

## Fresh-install / restore disposable target

The second TAKAVEN Free project `teamframe-fresh-install-restore-disposable-20260921` has ref `xjdobcfzwluozumhnjng` in Mumbai (`ap-south-1`). It is separate from the original launch-test project and has no GitHub connection. On creation, read-only SQL verified **zero public tables, zero auth users, zero stored objects, and no TeamFrame `companies` table**. The canonical 31-file sequence then ran from zero without manual SQL repair. Follow-up read-only SQL found **39 public tables, RLS enabled on all 39**, required tenancy/leave RPC and index markers, and no auth users or stored files. A `documents` bucket was separately created and catalog-verified as **private**, 10 MB maximum, with the seven MIME types in `scripts/setup-storage.mjs`. This passes the clean schema-and-storage installation check, not live auth, document access, integration, or restore. Its database password was entered only through the secure local prompt; it is not kept in repository files.

On 2026-09-21, after a read-only check showed **0 companies, 0 auth users and 0 stored objects**, the user expressly approved temporarily pausing `xjdobcfzwluozumhnjng` to free a Free-plan slot. Supabase subsequently showed it as **PAUSED** in the Takaven project switcher; it was not deleted. Its prior install evidence above remains valid, but the paused project is unavailable until resumed.

The third TAKAVEN Free project `teamframe-fresh-command-proof-disposable-20260921` has ref `nvuijkgiqqhqeqduqqgm` in Mumbai (`ap-south-1`), under `admin@takaven.com` as owner, with no GitHub repository connected. It exists solely to prove the current exact `db:install:fresh` and `storage:setup:fresh` commands. Before installation, the dashboard's read-only SQL returned **0 public tables, 0 auth users, 0 stored objects and no `public.companies` table**. The user ran both exact current commands through a masked, process-only local prompt: the schema command applied all 31 canonical files and reported 39 public tables/all RLS plus required objects; the storage command created the private `documents` bucket. A separate read-only dashboard query confirmed **39 public tables, 39 with RLS, 0 auth users, 0 stored objects, one private 10 MB `documents` bucket, and the tenant helper/view/index present**. This is fresh installation proof, not live role/document access, email, backup or restore proof. The database password and service-role key were not placed in chat or repository files.

## Current proof state (2026-09-21)

- The TAKAVEN project was verified in its organization list. The bounded schema continuation succeeded after fixing the fresh-install ordering bug (`80dfa51`). Read-only SQL in the named project showed **39 public tables, all 39 with RLS enabled**, `leave_definitions`, `file_operations`, `tenant_memberships`, `position_assignments` and the leave-decision RPC present; the live tenant helper is membership-backed without the email fallback, and its unique index exists. Companies, auth users and stored objects remained zero. This is **schema installation proof only**; role/tenant access, document security, email, backup and restore are not yet passed.
- The first schema attempt stopped at TLS certificate validation (`self-signed certificate in certificate chain`) before connecting. The runner now trusts the public Supabase CA supplied by this project's Database Settings while retaining certificate and hostname verification (`8a43208`). The CA file's SHA-256 matched the dashboard download. A dummy-password live probe completed TLS and received an expected authentication rejection.
- The next attempt stopped at `password authentication failed for user "postgres"`. The runner's project ref, pooler host, port and username matched the project's official **Session pooler** connection panel. This does **not** prove which password was entered or whether it belongs to this project. Do not claim a migration passed or repeatedly reset passwords without rechecking account/project identity.
- A subsequent secure-prompt attempt connected but stopped after `early_employment.sql`: `transactional_mutations.sql` declared a `leave_definitions` row before that table existed. Remote inspection showed 25 public tables, zero companies/auth users/files, the early-employment object present, and the failed function and next file absent. The canonical order was corrected; a one-time resume guarded to this exact empty disposable footprint applied the remaining 11 files successfully. Do not rerun that resume command now that the schema is complete.
- The Free plan does **not** include scheduled project backups. A logical export and clean-target restore, including storage-file verification where applicable, must be executed before backup/restore is marked PASS. Do not purchase or enable a paid plan without the spend approval gate.

## Before any database write

1. Sign in as `admin@takaven.com`. In Supabase, verify the `Takaven` organization, exact disposable project name/ref, intended purpose and current availability against the approved-project records above and `scripts/approved-launch-projects.mjs`. Do not substitute one disposable project for another.
2. Confirm the project still contains no real ARIE, Baynunah or customer data. Use synthetic fixtures only.
3. Compare the DB connection details with **Connect → Direct → Session pooler** on that exact project. Do not copy connection details from another browser account or project.
4. Use a secure interactive password prompt. Never paste passwords, service-role keys or full credential-bearing URLs into chat, docs, screenshots, logs or repository files. Keep `.env.local` and `.env.staging` out of version control.
5. The earlier disposable installation used process-scoped staging variables. The current canonical `npm run db:install:fresh` instead requires `TEAMFRAME_INSTALL_PROJECT_REF`, `TEAMFRAME_INSTALL_SUPABASE_URL`, `TEAMFRAME_INSTALL_DB_URL`, and `TEAMFRAME_INSTALL_APPROVAL=fresh:<ref>` in process memory. It checks exact public/DB identity, rejects URL query overrides of TLS, requires an empty target, and verifies the Supabase CA. `--check-target` checks identity but does not connect or prove migration success.
6. Inspect current schema before applying. The runner has **no migration journal** and refuses a full replay against an initialized database. The one-time partial-recovery option and its local helper have been removed following the clean-install proof. Do not rerun the installer on either populated schema. Verify actual tables/policies and record the evidence in the ledger. A terminal command alone is not proof.

The historical reset/setup/replay scripts now exit before connecting and their normal package aliases are retired. `verify:rls:disposable` is available only with the exact approved TAKAVEN project ref and audit-only credentials; it seeds/cleans synthetic fixtures, so do not use it as a read-only shortcut.
