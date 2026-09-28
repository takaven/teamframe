# Final role red-team reconciliation

Date: 2026-09-25  
Authority: Founder, Manager and Employee browser audits supplied for the final UI-remediation cycle.  
Scope boundary: Groups A-D remain frozen except for verified regressions; Org Chart and customer readiness are excluded.

This ledger records the disposition of every numbered finding and the concrete narrative findings that materially affect launch trust. `Closed` means the current implementation contains the correction. `Not reproduced` means the claimed runtime failure was tested on the deployed Preview and did not occur. `Deferred` is used only where the audit requested a new capability or a preference rather than a defect in the agreed product.

## Founder / Full Access

| Finding | Classification | Evidence / disposition |
| --- | --- | --- |
| M1 full-page loader on navigation | Closed with measured qualification | Actual in-app link transitions retain the shell and show the canonical loading treatment; no full-layout remount was reproduced. Measured Preview transitions remain 2.3-7.9s and are recorded as a data/runtime latency issue, not hidden with a new frontend architecture. |
| M2 Settings tabs fail to switch content | Closed | Settings is URL-driven and each control opens the corresponding server-rendered section. Active state follows the URL. |
| M3 onboarding editor fields truncate | Closed | Editor grid and field sizing now preserve readable task, owner, need and document-type values at intermediate widths. |
| M4 Reports are only flat tables | Closed, bounded | Two decision-useful native visuals were added: the 12-month headcount trend and monthly joiner/leaver movement. Authoritative tables remain available. No chart library or dashboard expansion was introduced. |
| M5 raw `MEDICAL_INSURANCE` | Closed | Shared document-label mapping is used by Home, employee records and document surfaces. |
| M6 Home filters lack selected state / truthful count | Closed | Filters expose selected state and display the active scoped result count rather than the unfiltered total. |
| M7 History lacks timestamps | Closed where source data exists | Document acceptance and onboarding completion events display their recorded timestamps. Events without a trustworthy timestamp do not fabricate one. |
| m1 Reports tab truncation | Closed | Responsive report navigation preserves the full label. |
| m2 Reports date inputs truncate | Closed | Responsive filters provide adequate field width and stack below the desktop grid. |
| m3 calendar leave labels truncate | Closed | Calendar entries wrap instead of clipping names. |
| m4 country shown as `AE` | Closed | Country display uses the shared reference mapping in records, reports and headcount CSV. |
| m5 employment-type casing differs | Closed | User-facing employment types use the existing human-label formatter. |
| m6 published policies look editable | Closed | Existing published policies are display-first; the create/version form is collapsed until intentionally opened. |
| m7 Settings navigation hides Users & Access | Closed | Settings navigation uses a responsive grid rather than a concealed horizontal overflow strip. |
| m8 workspace name truncates | Accepted responsive behaviour | The fixed shell intentionally ellipsizes exceptionally long workspace names; full identity remains available in the workspace context. No functional ambiguity exists for the single Northstar workspace. |
| m9 `Not set` casing differs | Closed in touched record surfaces | Missing-value presentation is normalised to a neutral em dash where corrected; no broad string rewrite was added. |
| Add Person defaults UTC / free-text country | Closed | Company country and timezone now drive Add Person, HirePass and CSV defaults; invalid/missing configuration blocks the path with a Settings link. |
| CSV header-only validation | Existing behaviour retained | The import continues to require at least one data row and exposes a downloadable template. |
| Time-off report disagrees with Balances | Closed | Reports reuse the same entitlement/opening/request calculation as Time off. |
| Sidebar/task hover feedback is too weak | Closed within canonical system | Existing shared tactile hover/focus/pressed states remain the single implementation; no override layer was added. |
| Mobile/tablet not tested by audit | Closed by final gate | Explicit runtime checks cover 1440, 1366, 894, 768, 430 and 390 pixels. |

## Manager

| Finding | Classification | Evidence / disposition |
| --- | --- | --- |
| Blocker: Home is a profile page | Closed | `/home` is a manager action hub; `/me` is profile-only. |
| Navigation buries My team | Closed | Manager navigation is Home, My team, Time off, Me. |
| Directory is inappropriate manager navigation | Closed | Directory is absent from the manager primary navigation. |
| Documents & policies is a false top-level destination | Closed | It is absent from manager primary navigation; self-service content remains under Me and actionable Home items. |
| View buttons fail | Not reproduced | Deployed direct-report links open the focused `/manager?employee=...` view. No speculative click-handler rewrite was made. |
| Restriction language dominates | Closed | Salary/payment/private-document sections are omitted rather than repeatedly labelled as forbidden. |
| 390px sidebar remains visible | Not reproduced | The desktop sidebar is hidden and the mobile header/menu is available at 390px. |
| Back to my profile | Closed | The irrelevant footer action was removed. |
| ISO date fragments | Closed | Manager calendar dates use the shared human date presentation. |
| Direct-report count absent | Closed | My team shows the scoped report count. |
| Role titles truncate | Closed | Role text can wrap instead of being forcibly clipped. |
| Leave entitlement override leaks | Closed | Internal override fields are removed from self-service records. |
| `Probation input` undermines ownership | Closed | The surface uses `Probation recommendation` and plain responsibility copy. |
| Test employee visible | Closed by data cleanup | The exact synthetic checklist-verification record was archived, not deleted; it no longer appears in active/employee-facing lists. |
| Home does not itemise manager work | Closed | Manager Home exposes authorised individual action items rather than only aggregate chips. |
| Direct-report view repeats My team | Closed | Selecting a person renders a focused record rather than the full dashboard beneath it. |
| Direct-report view lacks lifecycle context | Closed, permission-bounded | Existing authorised onboarding progress, probation/recommendation, submitted check-in, approved time off and employment status are composed into the focused record. No new permission was added. |
| Calendar is a list, not a month grid | Deferred — enhancement | The existing next-60-days team context is functional. A new manager calendar visualisation is outside this correction cycle. |
| Leave overlap/coverage and confirmation absent | Deferred — new capability | These are workflow enhancements, not regressions in the existing approval path. |
| Status badges absent from team cards | Deferred — preference | The focused person view carries lifecycle context without adding decorative status density to every card. |
| Me has no section rail | Deferred — broader self-service restructuring | Profile-only routing resolves the primary role confusion; a second employee-record architecture is not introduced. |

## Employee

| Finding | Classification | Evidence / disposition |
| --- | --- | --- |
| B1 triple active navigation | Closed | Home, Me and Documents & policies use separate canonical routes with one active destination. |
| M1 overdue document has no urgency | Closed | Past-due requirements render `Overdue — was due ...` using the existing overdue treatment. |
| M2 country shows `AE` | Closed | The shared country reference renders `United Arab Emirates`. |
| M3 admin/override terminology leaks | Closed | Working-days override, leave-entitlement override and internal employment-status machinery are not rendered in employee self-service. |
| M4 QA record in Directory | Closed by data cleanup | The exact synthetic record was archived and excluded from active directory results. |
| M5 Directory has no search/filter | Closed | Employee-facing directory supports name/role search and department filtering with a result count. |
| M6 onboarding document action is dead | Closed | Document-required tasks link to the real Documents & policies upload context. |
| m1 policy versions visible | Accepted | Version and effective date identify the legal text being acknowledged; hiding the version would weaken acknowledgement clarity. |
| m2 generic requested-document Home copy | Closed | User-facing document types use human names rather than generic or raw identifiers. |
| m3 onboarding lacks primary navigation item | Accepted | Onboarding is a contextual action destination reached from Home; it is not promoted to a new top-level employee module. |
| m4 unlabeled date beside upload | Closed | The control is labelled `Expiry date (optional)`. |
| m5 policy acknowledgement lacks urgency/context | Closed within available facts | Home supplies the actionable count and exact destination; no invented urgency is shown without a due date. |
| m6 missing-details banner is only a count | Accepted | A compact count avoids duplicating the editable profile; the missing fields are visibly marked in their sections. |
| m7 circular onboarding instruction | Closed | Completion copy is specific to the task's configured completion mode. |
| m8 no bottom tab bar | Deferred — design preference | A responsive mobile menu already supplies complete navigation. Adding a second mobile information architecture is outside the agreed correction. |
| Employee check-in absent | Existing contextual behaviour | Check-in tasks appear on role-aware Home when assigned; no permanent empty destination is fabricated. |
| Phone inputs have no visible format enforcement | Deferred — new validation behaviour | No cross-country phone validation architecture was added in a UI-remediation pass. |
| Policy acknowledgement confirmation not observed | Existing mutation feedback retained | No state was changed during the external audit; this is not evidence of a defect. |
| Upload/leave success states not observed | Existing mutation feedback retained | The audit deliberately did not execute these mutations; no failure was reproduced. |
| Sign-out has no confirmation | Accepted | Sign-out is a reversible session action and does not warrant a blocking confirmation. |

## Final boundary

- Org Chart: unchanged and reserved for the founder-approved isolated finale.
- New product capability: none.
- Schema/RLS/security boundary: unchanged.
- Production: untouched.
- Customer readiness: not started.
