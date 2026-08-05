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
| F06 broken release workflow | Replace obsolete release workflow references with real local/integration gates | `.github/workflows/release.yml`; `package.json`; `scripts/verify-integration.mjs` | Integration verifier fail-fast path and known-ref refusal checked by command | PASS — obsolete script references removed; `node scripts/schema-state.mjs` passes locally; source gate delegates to passing `npm run verify:release`; `npm run verify:integration` fails without disposable audit env and refuses known existing refs | GitHub runner/account issue remains external; live integration remains Not Executed until disposable env is supplied |
| F04 same-tenant integrity | Add dirty-data preflight plus composite same-tenant constraints for tenant-owned relations | `schemas/tenant_integrity.sql`; `scripts/schema-order.mjs`; `scripts/verify-install.mjs` | `tests/tenant-integrity-migration.test.ts` | PASS — focused test covers preflight failure messages, no silent repair, schema order, and composite FK coverage | Live dirty-data preflight and negative inserts must run on disposable DB |
| F08 non-atomic DB audit writes | Move database-only sensitive mutations and audit writes into transactions/RPCs | `schemas/transactional_mutations.sql`; `services/employeeService/index.ts`; `services/leaveService/index.ts`; `scripts/schema-order.mjs`; `scripts/verify-install.mjs` | `tests/transactional-mutations.test.ts` | PASS — focused test covers RPC schema order, audit inserts inside RPC bodies, service routing; `npm run typecheck` passes | Live DB apply/RPC execution and transaction-failure proof on disposable DB |
| F07 document upload trust boundary | Add pre-buffer size/type validation, file signature checks, and storage config verification | `services/documentService/index.ts`; `schemas/file_lifecycle.sql`; `schemas/tenancy_rls.sql`; `scripts/schema-order.mjs` | `tests/document-upload-compensation.test.ts`; `tests/file-lifecycle-retention.test.ts` | PASS — oversized upload rejected before buffering; spoofed PDF signature rejected before storage upload; lifecycle operation states covered; `npm run typecheck` passes | Live storage bucket config and upload/download/delete proof on disposable project |
| F09 export retention | Add durable export metadata, TTL, cleanup command, dry-run, retry evidence | `schemas/file_lifecycle.sql`; `services/documentService/index.ts`; `scripts/cleanup-expired-exports.mjs`; `package.json`; `schemas/tenancy_rls.sql` | `tests/file-lifecycle-retention.test.ts` | PASS — export metadata stores explicit 24-hour TTL; cleanup defaults to dry-run, checks tenant path prefix, writes cleanup audit evidence; `npm run typecheck` passes | Live export generation and expired-file cleanup proof on disposable project |
| F10 privileged health probes | Keep public health shallow; add protected deep health with low-impact probes | `app/api/health/route.ts`; `app/api/health/deep/route.ts` | `tests/health-protection.test.ts` | PASS — public health contract guard passes; public route has no service-role/storage/Auth Admin probes; deep route requires header secret, rejects query-string secrets, throttles, and redacts output; `npm run typecheck` passes | Deep health validation with disposable env and non-real secret |

Definition of done for this tracker:

- `npm run verify:release` passes locally from a clean install.
- Source-level tests cover the new negative/security cases.
- All new scripts and workflow references exist and fail honestly.
- Deferred items are limited to disposable Supabase/Vercel-style runtime proof
  and final pre-release secret rotation/packaging.

Final clean-copy verification on 2026-08-05 after source-closure review:

- PASS — `npm ci`
- PASS — `npm run verify:release`
  - typecheck clean
  - lint clean
  - 16 test files passed; 81/81 tests passed
  - 4/4 guards passed
  - Next.js build passed on 15.5.21
- Source-closure review added one correction commit for DOCX validation,
  cleanup tenant filters, and transactional RPC execution grants.
