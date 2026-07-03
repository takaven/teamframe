# Signal Resolution Matrix — all 10 SignalKinds

Date: 2026-07-03
Scope: Wave 1 (minimal policy loop) verification artifact.
Source of truth: `services/signalEngine/contracts.ts` (`SignalKind` union) and the per-kind
reconcile functions in `services/signalEngine/*.ts`.

Contract being verified (blueprint-locked.md Hard Rule 1 + §4): every signal that can fire
must have a UI path that resolves it. "Resolved" means the engine's next reconcile run
(triggered on every `/dashboard` load and after every dashboard action) sets
`risk_signals.resolved_at`, closes the linked action item, and writes an audit log entry.

## Matrix

| # | SignalKind | Fires when | Admin resolution path (UI) | Verified |
|---|---|---|---|---|
| 1 | `missing_contract` | Non-deleted employee in `preboarding`/`active` has no contract-type document with `signed_at` set within 60 days before `start_date`. Red when active or start < 7 days; yellow otherwise. | `/employees` → employee card → **Documents** → upload type `contract` with a signed date. Signal resolves on next engine run. | Yes — `tests/missing-contract-signal.test.ts` (severity + tenant isolation) |
| 2 | `expired_document` | Any non-deleted document with `expires_at` in the past (subject not `exited`; latest doc per person+type evaluated). Red. | `/employees` → employee card → **Documents** → upload a replacement document of the same type with a later expiry (or delete the superseded record). | Yes — `tests/expiring-document-signal.test.ts` |
| 3 | `expiring_document` | Document `expires_at` within its type-specific yellow window (30–90 days, `docs/business/signal-rules.md` Rule 2). Yellow. | Same as #2 — upload the renewed document before expiry. | Yes — `tests/expiring-document-signal.test.ts` |
| 4 | `unacknowledged_policy` | A published, non-archived policy version has no acknowledgement from an eligible (non-deleted, non-exited) employee. Yellow for 1 missing, red for >1. | Employee: `/me` → **Policies to acknowledge** → "I acknowledge" (one click). Admin: `/policies` shows per-policy acknowledgement progress and can archive a policy to withdraw it; dashboard card CTA "Resolve" lands on `/policies`. Dashboard **Mark done** on the action item is the manual fallback. | Yes — `tests/policy-acknowledgement-signal.test.ts` (publish → fires; acknowledge → resolves; draft/archived/stale rejected) — **loop completed in this wave** |
| 5 | `incomplete_onboarding` | Employee in `preboarding`/`active` has pending `onboarding_tasks`. Red when active, yellow when preboarding. | `/onboarding` → mark the remaining tasks complete (admin or the employee). Dashboard CTA lands on `/onboarding`. | Yes — engine reconcile follows the shared pattern; task completion path covered by app actions (`app/onboarding/actions.ts`) |
| 6 | `incomplete_offboarding` | Employee in `offboarding`/`exited` has open action items (any category other than its own). Red when exited. | `/dashboard` → **Mark done** each open offboarding checklist item (items are created by **Start offboarding** on `/employees`). | Yes — `tests/signal-engine-golden-flow.test.ts` (emit + action + visibility) |
| 7 | `active_access_after_exit` | Employee in `exited` state still has `status = active` or `setup_status = active`. Red. | `/employees` → employee card → set status to `inactive` and **Save** (or **Archive employee**). Dashboard **Mark done** is the audited manual fallback (completed-action suppression built in). | Yes — code-inspected; both paths (status change and mark-done suppression) present in `activeAccessAfterExit.ts` |
| 8 | `unreturned_asset` | Employee in `offboarding`/`exited` has open action items whose text mentions asset/return. Red when exited. | `/dashboard` → **Mark done** the asset-return action items once the asset is recovered. | Yes — code-inspected; resolution loop closes signal + items in `unreturnedAsset.ts` |
| 9 | `missing_jurisdiction_requirement` | Employee with a `country` set lacks the jurisdiction's required document type (UAE → `emirates_id`, UK → `right_to_work`, SG/HK → `work_permit`, MU → `residence_visa`, else `passport`). Red when active/offboarding. | **Gap found and fixed in this wave.** The V1 upload UI cannot create jurisdiction document types (the `documents.type` Postgres enum is locked to CV/CONTRACT/JD/PHOTO), so the signal previously could never be resolved from the UI — even dashboard **Mark done** did not suppress it. Fixed: completed-action suppression added (mirrors `unacknowledgedPolicy`/`activeAccessAfterExit`), so `/dashboard` → **Mark done** now resolves it with an audit trail. | Yes — `tests/manual-resolution-suppression.test.ts` |
| 10 | `leave_conflict` | An employee has overlapping `pending`/`approved` leave date ranges. Yellow. | Pending overlaps: `/leaves` → reject one of the requests. Approved-approved overlaps: **gap found and fixed in this wave** — no V1 surface can edit an approved leave, so completed-action suppression was added; `/dashboard` → **Mark done** resolves the reviewed conflict. Dashboard CTAs land on `/leaves`. | Yes — `tests/manual-resolution-suppression.test.ts` |

## Verdict

**10 / 10 signals now have a working UI resolution path.**

- Gaps fixed in this wave:
  - #4 `unacknowledged_policy` — had no way to fire (no policy create/publish UI) and no way
    to resolve (no acknowledge UI). Completed end-to-end: `services/policyService`,
    `/policies` (admin), `/me` acknowledge block (employee).
  - #9 `missing_jurisdiction_requirement` — no resolution path at all; manual mark-done
    suppression added.
  - #10 `leave_conflict` — unresolvable for approved-approved overlaps; manual mark-done
    suppression added.
- Dashboard CTA corrections (`signalCtas()` in `app/dashboard/page.tsx`): `unacknowledged_policy`
  now lands on `/policies`; onboarding/leave/document CTAs land on `/onboarding`, `/leaves`,
  `/employees` respectively instead of self-referencing `/dashboard`.

## Follow-up proposal (out of Wave 1 scope)

The honest long-term fix for #9 is uploading real jurisdiction documents. That requires:

1. `ALTER TYPE document_type ADD VALUE` migration (or dropping the legacy enum in favour of
   the free-text `document_type` column) — a production schema change;
2. extending `services/documentService` `DocumentType` and the upload `<select>` on
   `/employees` with `passport`, `emirates_id`, `work_permit`, `residence_visa`,
   `right_to_work`.

Until then the mark-done path is auditable and consistent with how `active_access_after_exit`
handles externally-verified fixes.

## Runtime caveat

All "Verified" entries above are verified at the unit/reconcile level against the in-memory
Supabase mock used by the vitest suite. No live tenant database exists in this environment
(.env files are examples only), so end-to-end browser verification against a real Supabase
project remains for staging validation per `docs/launch/operational-readiness-checklist.md`.
