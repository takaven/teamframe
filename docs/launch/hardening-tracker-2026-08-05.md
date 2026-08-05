# TeamFrame Hardening Tracker — 2026-08-05

Scope: source-level remediation for Critical and High engineering findings from
`TeamFrame_Independent_Audit_2026-08-05`, starting at
`codex/reconcile-local-main@8019b32c31354476f441e70756869838104d0fd3`.

This is not a production-readiness verdict. Secret rotation and live
disposable-environment proof are intentionally deferred until the source
hardening pass is complete.

| Finding | Required correction | Files changed | Tests added | Verification result | Remaining infrastructure dependency |
|---|---|---|---|---|---|
| F03 Next.js patch level | Upgrade Next.js 15.5.18 to patched 15.5.x and add one local release gate | `package.json`; `package-lock.json` | No new product tests; release gate command added | PASS — `npm ci`; `npm run verify:release` (typecheck, lint, 63/63 tests, 4/4 guards, build) | None |
| F06 broken release workflow | Replace obsolete release workflow references with real local/integration gates | Pending | Pending | Pending | GitHub runner/account issue remains external |
| F04 same-tenant integrity | Add dirty-data preflight plus composite same-tenant constraints for tenant-owned relations | Pending | Pending | Pending | Live dirty-data preflight must run on disposable DB |
| F08 non-atomic DB audit writes | Move database-only sensitive mutations and audit writes into transactions/RPCs | Pending | Pending | Pending | Live DB apply/RPC execution on disposable DB |
| F07 document upload trust boundary | Add pre-buffer size/type validation, file signature checks, and storage config verification | Pending | Pending | Pending | Live storage config verification on disposable project |
| F09 export retention | Add durable export metadata, TTL, cleanup command, dry-run, retry evidence | Pending | Pending | Pending | Live storage cleanup proof on disposable project |
| F10 privileged health probes | Keep public health shallow; add protected deep health with low-impact probes | Pending | Pending | Pending | Deep health validation with disposable env |

Definition of done for this tracker:

- `npm run verify:release` passes locally from a clean install.
- Source-level tests cover the new negative/security cases.
- All new scripts and workflow references exist and fail honestly.
- Deferred items are limited to disposable Supabase/Vercel-style runtime proof
  and final pre-release secret rotation/packaging.
