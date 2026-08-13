# Repository Cleanup and Audit Readiness Report

Date: 2026-05-31
Branch: pivot/fpors-cleanup
Scope: Full repository cleanup and structural audit readiness pass

## Phase 1 - Full Repository Audit

### 1) Core production code
- app, lib, middleware, services, schemas remain the production execution paths.
- Signal engine orchestration and reconcilers are wired through services/signalEngine/index.ts.
- Dashboard components are actively used by app/dashboard/page.tsx.

### 2) Test and support infrastructure
- tests/missing-contract-signal.test.ts
- tests/expiring-document-signal.test.ts
- tests/signal-engine-golden-flow.test.ts
- tests/cross-tenant-isolation.test.ts
- tests/tenancy-isolation.test.ts
- scripts/verify-parity.mjs and scripts/seed-demo.mjs are support/operational scripts.

### 3) Legacy, deprecated, or orphaned code
- Automated orphan heuristic previously flagged many files as orphaned, but this was a false positive caused by import-path detection mismatch.
- Manual reference checks confirm dashboard and signal-engine files are in use.

### 4) Debug, temporary, experimental
- No active scratch artifacts detected in working tree from temp/platform patterns.
- Runtime and verification docs in docs/launch/verification are evidence artifacts, not temp code.

### 5) Duplicate or overlapping implementations
- Auth callback currently has a major implementation replacement in app/auth/callback/route.ts; old hardened behavior was removed and replaced by a short version. This is a behavior-risk hotspot, not duplicate code.
- Signal emission now has layered contracts (repository/domain/actions) in services/signalEngine, which is structurally correct.

### 6) Unused or unreferenced files
- No confirmed unused files were proven by deterministic import tracing in this pass.
- Candidate removals should only proceed after explicit usage checks per file.

### 7) Misplaced files
- No definitive misplaced production files found.
- Verification artifacts are intentionally under docs/launch/verification.

### 8) Noise
- node_modules and .next are generated/runtime folders and should remain untracked noise only.
- No tracked binary/platform noise detected in this pass.

## Phase 2 - Cleanup Execution (Applied Rules)

Rules applied:
- No destructive deletion performed in this pass.
- No speculative refactor performed beyond already-existing changes in working tree.
- Build and tests were kept green during verification.

Candidate cleanup set (requires execution pass):
- Normalize auth callback reliability behavior in app/auth/callback/route.ts to match launch reliability requirements.
- Complete staging of active signal engine and dashboard additions or revert partial drift in one atomic pass.
- Consolidate documentation status artifacts if any are superseded by newer reports.

## Phase 3 - Architectural Normalization Status

Current state:
- Signal engine emit path follows domain/actions/repository split.
- Dashboard composition now uses dedicated components and action handlers.

Gaps:
- Cross-layer leakage risk remains where route/actions directly assemble business semantics that could live in domain services.
- Auth callback regression risk is the highest architecture/behavior inconsistency in current diff.

## Phase 4 - Git and Local Alignment

Current alignment state:
- Commit alignment with upstream: aligned (ahead 0, behind 0).
- Local working tree: not clean.
- Counts: modified 15, untracked 13.

Audit readiness requirement not yet met:
- Working tree must be clean before external review.

## Verification Results

- Lint: PASS
- Tests: PASS (5 files, 13 tests)
- Build: PASS

## Risk Register (Current)

1. High
- app/auth/callback/route.ts replaced a hardened callback flow with a minimal flow, increasing callback failure-path risk.

2. Medium
- Large uncommitted diff spans production paths and launch docs simultaneously; this complicates reviewer confidence.

3. Medium
- Schema/service/dashboard expansions are bundled together in local state; cleanup should be split into atomic commits.

## Final Audit Readiness Verdict

Status: NOT YET AUDIT READY

Reasons:
- Local working tree not clean.
- High-risk auth callback change requires explicit acceptance or correction.
- Commit set is not yet normalized into clear atomic units for external review.

## Required Next Execution Pass

1. Finalize or correct auth callback behavior with explicit acceptance tests.
2. Partition current diff into atomic commit groups (signal engine, dashboard, schema, docs).
3. Remove any now-obsolete files only after deterministic proof of non-use.
4. Re-run lint, tests, and build.
5. Ensure git status is fully clean.
