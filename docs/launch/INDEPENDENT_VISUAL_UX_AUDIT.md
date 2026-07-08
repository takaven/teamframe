# Independent Visual & Commercial UX Audit — TeamFrame

**Auditor:** independent product-design review (no prior involvement in the build; earlier audits not trusted).
**Standard:** polished enough to support a USD 2,000/month managed people-ops service, shown to a paying client without apology.
**Date:** 8 July 2026 · **Base commit reviewed:** `00e784d` · **Server:** local dev, canonical tree (verified via computed token `--color-signal-amber: #92400e`).
**Method:** full customer walkthrough in Chromium first (no code reading before visual judgement), at 1440×900, 1024×768, 390×844, and 200 % zoom (720 px logical). Admin (seeded demo tenant), admin (empty tenant), and employee (magic-link session) roles. All evidence in `docs/launch/independent-visual-review/` — every issue has a fresh BEFORE capture and every fix a fresh AFTER capture.

---

## Findings and status

Severities: **CRITICAL** task impossible / trust destroyed · **HIGH** clearly unfinished / major commercial problem · **MEDIUM** noticeable inconsistency / reduced perceived quality · **LOW** refinement.

| # | Screen | Viewport | Issue | Severity | Commercial impact | Required fix | Status | Evidence (before → after) |
|---|--------|----------|-------|----------|-------------------|--------------|--------|---------------------------|
| 1 | Landing `/` | all | No product visual anywhere; hero text column leaves the right half of the page empty at 1440/1024; page reads as an unfinished text template. Fails the 5-second test on "why care". | HIGH | A prospect evaluating a $2k/mo service sees no evidence the product exists. First impression is "not finished". | Embed a real product visual: fresh capture of the seeded risk dashboard (2× DPR), framed in the design language (rounded panel, subtle border, paper background), honest caption, real alt text. | **FIXED** — `public/marketing/dashboard-risk-signals.png` + framed `next/image` section under the hero. | `before-landing-1440.png` → `after-landing-1440.png` (also `-1024`, `-390`, `-720zoom`) |
| 2 | Landing `/` | all | CTA hierarchy broken: with `NEXT_PUBLIC_PILOT_CONTACT_EMAIL` unset the only CTA is a small low-contrast outline "Sign in" pill; no primary action exists. | HIGH | The page never asks the visitor to do anything. Zero conversion path. | Primary (dark) CTA in both states: pilot email set → "Request a pilot" primary + "Sign in" secondary; unset → "Sign in" styled primary. No fake email baked into shipped code. | **FIXED** — conditional class on the Sign-in CTA; pilot state verified with a local-only env var (never committed). | `before-landing-1440.png` → `after-landing-1440.png`, `after-landing-pilot-1440.png`, `after-landing-pilot-390.png` |
| 3 | Employees — expanded row | 1440 | Raw machine error code exposed to the customer: "Last invite error: EMPLOYEE_INVITE_FAILED. …" on any invite-delivery failure. | HIGH | Screams "engineering prototype" in the exact moment (failed invite) when the admin is already frustrated. | Map every invite-failure code to plain English (map added; unknown codes get a generic sentence). Never show the enum. | **FIXED** — `INVITE_FAILURE_COPY` map in `app/employees/page.tsx`; row now reads "The last invite email could not be delivered. Use Re-send invite or generate a new activation link." | `before-employees-edit-save-1440.png` (shows raw code) → `after-employees-vera-expanded-1440.png` |
| 4 | Employees — expanded row | 1440 | Invite telemetry block reads like a debug dump: "Invite attempts: 1 / Last attempt: … / Last sent: - / Activation: -" — unlabeled colon-list with hyphen placeholders. | MEDIUM | Debug-log tone undercuts the otherwise labeled, structured detail grid directly above it. | Present as a labeled definition grid matching the record grid (small-caps labels: Invite attempts / Last attempted / Last delivered / Activated), em-dash for empty values. | **FIXED** | `before-employees-expanded-1440.png` → `after-employees-vera-expanded-1440.png` |
| 5 | Employees `/employees` | 1440, 390 | Information architecture: a large always-open "Add employee" form and the finance-export strip sit above the roster, pushing the actual roster (the page's namesake content) below the fold on a populated tenant. | MEDIUM | The admin's daily task is scanning people/invite status; the occasional task (adding someone) dominates instead. Feels assembled, not designed. | Roster first, then Add-employee form, then Finance export. Empty tenant keeps a clear path: empty state links "↓ Use the Add employee form below" (anchor unchanged). | **FIXED** | `before-employees-1440.png` → `after-employees-1440.png`; empty state: `before-empty-employees-1440.png` → `after-empty-employees-1440.png` |
| 6 | `/auth?error=callback_failed` | 1440 | The same error sentence rendered twice — once in the "Sign-in issue" panel, again in red under the submit button. | MEDIUM | Duplicated error text looks like a bug and doubles the alarm. | Render the message once (panel only) when the panel is shown. | **FIXED** | `before-auth-callback-failed-1440.png` → `after-auth-callback-failed-1440.png` |
| 7 | `/auth` + `/auth/check-email` vs `/admin/login` | 1440, 390 | Sign-in family inconsistent: admin login is a carded panel, employee sign-in and check-email float bare on the background. | MEDIUM | Two sign-in doors with different design languages read as two different products. | Same card treatment (rounded-2xl, border, shadow) across all three auth surfaces. | **FIXED** | `before-auth-1440.png` → `after-auth-1440.png`, `after-auth-check-email-1440.png`, `after-auth-390.png` |
| 8 | Dashboard signal cards | 390 | "Action open" status pill wraps to two lines at mobile widths, collapsing into a squashed oval. | MEDIUM | The most repeated component on the flagship screen looks broken on a phone. | `whitespace-nowrap` on the shared `StatusPill`. | **FIXED** — fixes every pill product-wide. | `before-dashboard-390.png` → `after-dashboard-390.png` |
| 9 | Admin login — failed attempt | 1440 | Failed sign-in clears the typed email; admin must re-type both fields. | LOW (fixed) | Minor friction at the front door. | Carry the email (never the password) through the error redirect and prefill it. | **FIXED** | `before-admin-login-failed-1440.png` → `after-admin-login-failed-1440.png` |
| 10 | Employees — expanded row actions | 1440 | "Copy invite email" is a bare underlined link sitting in a row of pill buttons (Re-send invite / Generate activation link / Start offboarding / Archive employee). | LOW (fixed) | One odd control in an otherwise uniform action row. | Same outline-pill treatment as its siblings. | **FIXED** | `before-employees-expanded-1440.png` → `after-employees-vera-expanded-1440.png` |
| 11 | Onboarding + Policies headers | all | Eyebrow label inconsistency across admin pages: "Admin queue" (employees, leaves) vs "Admin" (onboarding, policies). | LOW (fixed) | Small, but a client clicking through all five tabs notices the wobble. | Standardise on "Admin queue". | **FIXED** | `before-onboarding-1440.png` → `after-onboarding-1440.png`, `after-policies-1440.png` |
| 12 | All action buttons | all | Pending labels mixed "Creating..." (three dots) and "Sending…" (ellipsis). | LOW (fixed) | Typographic consistency. | Single ellipsis character everywhere. | **FIXED** across employees/leaves/me/onboarding/policies. | visible in any AFTER pending capture |
| 13 | `/me` info cards | 1440 | Three info cards in a two-column grid leave one empty slot. | LOW | Negligible; grid reads fine. | None required. | ACCEPTED (no change) | `after-me-1440.png` |
| 14 | Confirm dialogs (acknowledge, archive, offboard, delete) | all | Native `window.confirm` used for confirmation. | LOW | Functional, honest, accessible; a custom modal would be scope creep. | None required. | ACCEPTED (no change) | — |
| 15 | Forms (add employee, auth email, leave request) | all | Client validation is the browser-native bubble ("Please fill out this field."). | LOW | Consistent with the platform, accessible, zero custom-validation bugs. | None required. | ACCEPTED (no change) | `before-employees-addform-validation-1440.png`, `before-auth-invalid-email-1440.png` |

**Open CRITICAL/HIGH/MEDIUM: 0.** All fixed and re-verified in the browser with AFTER captures.

---

## Coverage — reviewed and passed with no issue found

| Screen / state | Viewports | Verdict |
|---|---|---|
| Dashboard (seeded) — hierarchy, lanes, stat strip, signal cards, what/why/next copy, button hierarchy (amber Start action / green Mark done / neutral Open record / dark contextual primary) | 1440, 1024, 390, 720-zoom | Strong. Clear urgent-risk visibility; founder knows what to do next; serif/mono/sans system consistent. |
| Dashboard (empty tenant) — "All clear" pill, three dashed empty lanes with next-step copy, Act/Track/Operate nav cards | 1440, 390 | Excellent empty state; genuinely reassuring rather than blank. |
| Dashboard loading skeleton (`loading.tsx`) | 1440, 1024 | Structured skeleton mirrors the loaded layout; no layout shift. Captured: `before-dashboard-1440.png` (pre-fix run caught it live), `before-employees-loading-1440.png`. |
| Employees roster cards, stat strip, detail grid, due-diligence pack block, documents block incl. upload form, DD-pack + finance export buttons (finance export verified: downloads `finance-handoff-20260708.zip`) | 1440, 1024, 390, 720-zoom | Pass (after fixes #3–5, #10). Expanded row stacks cleanly at 390/720. |
| Add-employee validation, create success ("Employee created." banner), edit/save success ("Employee updated." banner), pending states ("Creating…", "Saving…") | 1440 | Pass. Full flow exercised live. |
| Onboarding — packs form, single-task form, pending list with overdue badge ("Overdue — was due 3 Jul 2026"), completed strike-through, disabled Assign-pack until selection | 1440, 1024, 390 | Pass. |
| Leaves admin — queue stats (incl. "Oldest request age", "Action needed"), pending card, Approve primary / Reject secondary, pending states ("Approving…", "Rejecting…"), post-decision states | 1440, 1024, 390 | Pass. Approve and reject both exercised live (demo data restored afterwards). |
| Policies — create draft, draft card ("Not visible to employees until published"), publish, ack progress ("0 of N team members acknowledged v1."), archive control, empty state | 1440, 1024, 390 | Pass. Create→publish exercised live (test policy removed afterwards). |
| Employee `/me` — profile, policies-to-acknowledge, acknowledge flow with confirm + "Recording…" + success banner "Policy acknowledged. Thank you." | 1440, 390 | Pass. |
| Employee `/onboarding` (empty for this employee) and `/leaves` — submit flow, native required-date validation, "Submitting…", success banner "Leave request submitted.", history row copy ("Approved and ready to plan around." / "Waiting for manager approval.") | 1440, 390 | Pass. |
| Auth family — `/auth` invalid email, `?error=callback_failed`, `/auth/check-email` + resend cooldown ("Resend available in 59s"), `/admin/login` + failed login | 1440, 390 | Pass (after fixes #6, #7, #9). |
| Empty tenant — employees / onboarding / leaves / policies empty states | 1440 | Pass. Every empty state has a message plus a concrete next step. |
| Customer-facing language sweep (all visible copy on all screens) | — | Pass after fix #3/#4 — no remaining error codes, env-var names, or developer jargon in any customer-visible surface. (`SITE_URL`/Supabase wording exists only in admin *error-banner* copy for provider misconfiguration, which is operator-facing guidance; acceptable.) |
| 200 % zoom (720 px logical) — landing, dashboard, employees expanded | 720 | Pass. Single-column reflow, no clipped or overlapping content. |

## Notes for the record

- Dev-server first-compile makes some routes take >10 s on the very first hit; the loading skeleton covers this and production build times are normal. Not a visual defect.
- All flow mutations performed on the seeded demo tenant during this audit were reverted (test employee, test policy, acknowledgement, extra leave rows removed; original pending leave restored). Final state verified: 4 demo employees, 1 pending leave, 0 acknowledgements, 1 published policy.
- Axe (WCAG 2.0/2.1 A+AA) run on all 13 changed/affected routes after the fixes: **0 violations** (initial landing hits for `document-title`/`html-has-lang` were a dev cold-compile artifact; re-scan clean — layout sets both).

## Gates (run after all fixes)

| Gate | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm test` | PASS — 55/55 |
| `npm run guards` | PASS — all four guards |
| `npm run build` | PASS |
