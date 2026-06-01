# Merge Freeze Compliance Report

Date: 2026-05-31
Branch observed: pivot/fpors-cleanup
Scope gate: Wave 1 governance validation (post-implementation, pre-merge)
Policy basis: merge freeze + allowlist-only gate execution

## 1) Allowed files changed

| File | Status | Reason |
|---|---|---|
| app/auth/callback/route.ts | KEEP | Gate A allowlist |
| services/employeeService/index.ts | KEEP | Gate B allowlist |
| app/employees/actions.ts | KEEP | Gate B allowlist |
| app/employees/page.tsx | KEEP | Gate B allowlist |
| docs/launch/verification/blocker-definition-of-done-matrix.md | KEEP | Wave 0 evidence/governance artifact |
| docs/launch/verification/wave0-baseline-report-2026-05-31.md | KEEP | Wave 0 baseline evidence artifact |
| docs/launch/readiness-log.md | KEEP | Governance/readiness log artifact |

## 2) Out-of-scope files detected

| File | Status | Reason |
|---|---|---|
| app/dashboard/page.tsx | REVIEW | Outside allowlist |
| app/dashboard/loading.tsx | REVIEW | Outside allowlist |
| app/dashboard/error.tsx | REVIEW | Outside allowlist |
| app/dashboard/actions.ts | REVIEW | Outside allowlist |
| app/dashboard/RiskCard.tsx | REVIEW | Outside allowlist |
| app/dashboard/SignalSection.tsx | REVIEW | Outside allowlist |
| services/signalEngine/index.ts | REVIEW | Outside allowlist; keep only if required for B3 closure and allowlist amendment |
| services/signalEngine/missingContract.ts | REVIEW | Outside allowlist; keep only if required for B3 closure and allowlist amendment |
| services/signalEngine/expiringDocument.ts | REVIEW | Outside allowlist |
| services/signalEngine/unacknowledgedPolicy.ts | REVIEW | Outside allowlist |
| services/signalEngine/incompleteOnboarding.ts | REVIEW | Outside allowlist |
| services/signalEngine/incompleteOffboarding.ts | REVIEW | Outside allowlist; candidate B3 dependency, requires formal allowlist amendment |
| services/signalEngine/activeAccessAfterExit.ts | REVIEW | Outside allowlist |
| services/signalEngine/unreturnedAsset.ts | REVIEW | Outside allowlist |
| services/signalEngine/missingJurisdictionRequirement.ts | REVIEW | Outside allowlist |
| services/signalEngine/leaveConflict.ts | REVIEW | Outside allowlist |
| services/signalEngine/scheduledRunner.ts | REVIEW | Outside allowlist |
| schemas/action_items.sql | REVIEW | Outside allowlist |
| schemas/risk_signals.sql | REVIEW | Outside allowlist |
| schemas/documents.sql | REVIEW | Outside allowlist |
| schemas/employees.sql | REVIEW | Outside allowlist |
| schemas/tenancy_rls.sql | REVIEW | Outside allowlist |
| package.json | REVIEW | Outside allowlist |
| scripts/verify-parity.mjs | REVIEW | Outside allowlist |
| scripts/seed-demo.mjs | REVIEW | Outside allowlist |
| tests/missing-contract-signal.test.ts | REVIEW | Outside allowlist |
| tests/expiring-document-signal.test.ts | REVIEW | Outside allowlist |
| tmp_requested_diff.txt | DROP | Temporary scratch artifact |
| tmp-audit.pdf | DROP | Temporary scratch artifact |

## 3) Keep/Drop recommendation

Decision rule applied:
- KEEP automatically: Gate A files, Gate B files, launch governance docs, Wave 0 evidence artifacts.
- DROP automatically: temp/scratch artifacts.
- REVIEW manually: all remaining out-of-allowlist files.

Manual review question for each REVIEW file:

Is this file required for A1, B1, B2, B3, or P1-P6 closure?

- If NO: remove file from diff.
- If YES: document dependency and formally amend allowlist before keeping file.

## 4) Final approved diff set

Current approved set under merge freeze (no manual REVIEW approvals yet):
- app/auth/callback/route.ts
- services/employeeService/index.ts
- app/employees/actions.ts
- app/employees/page.tsx
- docs/launch/verification/blocker-definition-of-done-matrix.md
- docs/launch/verification/wave0-baseline-report-2026-05-31.md
- docs/launch/readiness-log.md

Current auto-drop set:
- tmp_requested_diff.txt
- tmp-audit.pdf

Not approved yet:
- All files marked REVIEW above.

## Compliance checkpoint

Merge freeze compliance is NOT yet satisfied until all REVIEW files are either:
- removed from the working diff, or
- explicitly justified as gate-critical and allowlist-amended.
