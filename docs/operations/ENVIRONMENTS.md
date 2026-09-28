# TeamFrame Environment Registry

This is the canonical registry for current TeamFrame infrastructure. Historical evidence may retain older names and refs, but it does not override this file.

Last verified: 2026-09-28 after the founder-approved cleanup. Two historical Vercel projects, eight disposable Supabase projects, and two stale Git branches were deleted. No retained environment was paused, resumed, disconnected, or promoted.

## Authoritative architecture

| Purpose | GitHub | Branch | Vercel | Supabase | Region | Data | Status | Deployment authority |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Local development | `takaven/teamframe` | short-lived working branch | None required | Explicitly selected non-Production target only | Target-specific | Synthetic unless customer approval says otherwise | ACTIVE | Developer/operator; no external deployment implied |
| Founder Review | `takaven/teamframe` | `launch/managed-people-ops-45-day` | `teamframe-founder-review` (`prj_7aEgmyR1qQP8VfaFbFN7CexbWVNW`), team `ismaelloveexcels-projects`; canonical review URL `https://teamframe-founder-review-git-l-9951de-ismaelloveexcels-projects.vercel.app/` | `teamframe-founder-review-20260924`, ref `dcfxyjrfsrkibhpbmjnw`, organisation `Takaven` | `eu-west-1` | Synthetic Northstar fixture only | ACTIVE | Founder-approved Preview changes only; never Production |
| Production | `takaven/teamframe` | `main` after approved merge/release | Existing shell `teamframe-production` (`prj_09tvdrEWbL1Ov9SFMtrhgYnJ0bNj`), team `ismaelloveexcels-projects`; currently disconnected and historical | New authoritative Production project not yet created; proposed name `teamframe-production-uae`, ref TBD | Mumbai / `ap-south-1` proposed, final approval pending | Customer data after launch approval | BLOCKED / PENDING REBUILD | Explicit Production approval only |
| Temporary repeat-rehearsal proof | `takaven/teamframe` | launch branch at proof time | Local maintained operator path; no permanent Vercel environment | `teamframe-operator-repeat-rehearsal-2-20260928`, ref `drohdttbgekrmwubhala`, organisation `Takaven` | `ap-south-1` | Synthetic Crescent Ridge fixture | ACTIVE, LOCKED AGAINST REPLAY | Retain only until Production acceptance; no further mutation without fresh approval |

## Current source state

| Item | Verified state |
| --- | --- |
| Canonical repository | `https://github.com/takaven/teamframe` |
| Owner | GitHub organisation `takaven` |
| Visibility | Public |
| Default branch | `main` |
| Default-branch head at inventory | `45e63bfd85c05d65b4fd935dd4ba61081b6799af` |
| Launch branch | `launch/managed-people-ops-45-day` |
| Security release head verified before this registry refresh | `878cf8d91c490c7bc4ca46e78d63d49c2afb1cab` |
| Launch divergence before this registry refresh | 125 commits ahead of `main`, 0 behind |
| Integration path | Draft PR #6 into `main`; do not deploy Production directly from an unmerged working branch |
| Branch protection | The two surviving branches are `main` and the launch branch; `main` was unprotected at inventory time and the repository policy file was not enforced |

The documentation worktree may contain local documentation commits ahead of the remote launch branch. A local commit is not a deployed environment and must not be recorded as a deployed SHA until pushed and verified.

## Founder Review rules

- The branch Preview URL above is the review destination.
- Latest verified Preview deployment: SHA `878cf8d91c490c7bc4ca46e78d63d49c2afb1cab`, deployment `12nHBDaGQ7pgn7KHLFjeMhT3Sw8p`, Ready.
- `teamframe-founder-review.vercel.app` currently resolves to an older Production deployment inside the same Vercel project and is **not** the approved review URL.
- That older project Production deployment is from branch `codex/direction-b-full-system-implementation` at SHA `489c9606441618e898f21eafb0443a9ca33474ad`; it is historical, not the accepted review source.
- Founder Review Vercel variables are Preview-scoped and point to the synthetic review database.
- Vercel currently contains both a launch-branch-specific and a general Preview entry named `TEAMFRAME_AUTOMATION_SECRET`. Resolve that precedence deliberately before freeze; do not delete either until their scopes/consumers are compared.
- Deployment Retention is enabled for the project. Do not manually delete old Preview deployments merely for cosmetic cleanup.
- Never promote Founder Review configuration to Production.
- Do not casually reseed, reset, or use customer data in `dcfxyjrfsrkibhpbmjnw`.

## Production rules

- `teamframe-production` is a reserved historical Vercel shell, not a launch-ready Production environment.
- Its default domain is `https://teamframe-production.vercel.app`; its ready Aug 14 deployment is from `ismaelloveexcel/TeamFrame`, branch `codex/market-ready-implementation`, SHA `37bf104b5d72f81f9936a99ac3134c14bd2de7a5`, not the canonical repository state.
- It has no Git connection and retains eight Production variable names whose values were not revealed during this inventory. Treat all target values as untrusted until replaced and verified.
- Historical Supabase ref `zylllrvcmockvfcfubkp` is abandoned for launch and is not visible in the signed-in `Takaven` organisation.
- The replacement Production Supabase project does not exist yet.
- The Vercel team has no TeamFrame shared environment variables; the two team-shared variables observed belong to another project stack.
- Production remains blocked until the database, private Storage, Auth/SMTP, backups, Vercel variables, Git connection, cron, health checks, and live security proof are approved and verified.

## Environment-variable inventory

Values were not revealed. Names and scopes alone do not prove target correctness.

| Vercel project | Scope | Names observed |
| --- | --- | --- |
| `teamframe-founder-review` | Preview | `TEAMFRAME_AUTOMATION_SECRET` (two entries with different Preview scope), `SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `VERCEL_PREVIEW_FEEDBACK_ENABLED`, `DEEP_HEALTH_SECRET`, `TEAMFRAME_REVIEW_PASSWORD_AUTH` |
| `teamframe-production` | Production | `CRON_SECRET`, `TEAMFRAME_AUTOMATION_SECRET`, `DEEP_HEALTH_SECRET`, `SUPABASE_DB_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SITE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_URL` |

Production is missing the required Resend sender/provider variables and has no recorded Sentry variables. Replace and validate all Production values; do not assume the eight existing entries are usable.

GitHub repository Actions had no repository secret names, repository variable names, Preview-environment secret names, or Preview-environment variable names at inventory time. The `Preview` GitHub environment exists without protection rules.

## Temporary environment policy

Only one active rehearsal/proof project should exist at a time. A new proof project requires:

1. an explicit purpose;
2. exact project name/ref approval;
3. synthetic-only confirmation;
4. a stop condition;
5. deletion or pause decision after evidence is recorded.

Do not infer mutation authority from `scripts/approved-launch-projects.mjs`. Retired refs have been removed, but current resource status and a task-specific approval are still both required.

## DO NOT USE

| Resource | Why |
| --- | --- |
| Supabase `zylllrvcmockvfcfubkp` | Historical Production; inaccessible/owner unknown; abandoned for launch |
| Supabase `xqiamhwkuogcgucwmlxy` | Deleted empty rehearsal project; must never be rediscovered as active |
| Supabase retired refs listed in `RETIRED-RESOURCES.md` | Deleted disposable proofs; identifiers remain historical evidence only and must never be re-added without a new project and approval |
| Vercel `teamframe` | Deleted historical duplicate; do not recreate as canonical TeamFrame |
| Vercel `teamframe-visual-review-20260814061335` | Deleted superseded visual-review project |
| Vercel `mockup-sandbox` | Historical TeamFrame V2 project connected to `ismaelloveexcel/teamframe.v2` |
| GitHub `ismaelloveexcel/TeamFrame` | Historical source whose old Vercel project is now deleted; not canonical; archive only after separate approval |
| GitHub `ismaelloveexcel/teamframe.v2` | Separate historical simulation project; not canonical TeamFrame |

See [RETIRED-RESOURCES.md](RETIRED-RESOURCES.md) for the full retention/deletion inventory.

## Provider login map

Use [ACCOUNT-OWNERSHIP.md](ACCOUNT-OWNERSHIP.md). Never select a project by a remembered name alone; verify provider account/team, project name/ref, branch, and target URL before any write.
