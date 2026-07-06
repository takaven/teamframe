# Final Visual / UX Audit — Phase 5B (Real Visual QA)

Date: 2026-07-06
Branch: `phase-5-acceptance`
Reviewer bar: commercial, not merely technical — "would this embarrass a paid demo?"

## Methodology

- **Real browser, real data.** Every screenshot was captured with headless Chromium driven by
  Playwright against the live dev server (`next dev`, http://localhost:3030) connected to the
  seeded staging Supabase project `zydhgtmgrbdyghmvuldc`. Nothing is mocked; pages render the
  same server components, signal-engine output, and RLS-scoped queries a customer would see.
- **Real sessions.** Admin surfaces use a storage-state session created by submitting the actual
  `/admin/login` form (`acceptance-admin@teamframe-test.example`). The employee surface (`/me`)
  uses a session created by following a real magic-link `/auth/callback` hit for
  `omar.newhire@demo-fpors.example`. Empty states use a second, intentionally empty tenant
  (`acceptance-empty-tenant`) with its own admin. All identities are `.example`-domain fakes.
- **Three widths.** 1440 (desktop), 1024 (small laptop / tablet landscape), 390 (mobile).
  Full-page captures, Next.js dev-tools badge hidden (dev-mode artifact, not product UI).
- **Review pass.** Every 1440 capture reviewed in full; every 390 capture checked for overflow,
  cramping, and truncation; 1024 spot-checked (dashboard seeded, employees expanded, onboarding
  pack-open, landing). Seeded surfaces additionally judged for believable, non-embarrassing
  demo data (signal cards must read sensibly).

## Capture inventory — 67 PNGs in `docs/launch/screenshots/`

Named `<route>--<state>--<width>.png`. 22 route-states x 3 widths, plus the dashboard loading
skeleton at 1440.

| Surface | States captured |
|---|---|
| Landing `/` | public |
| Auth `/auth` | default, validation-error |
| Check email `/auth/check-email` | default, resend-cooldown |
| Admin login `/admin/login` | default, failed-login |
| Dashboard `/dashboard` | seeded, empty, loading (1440 only) |
| Employees `/employees` | collapsed, expanded, empty, validation-error |
| Onboarding `/onboarding` | seeded, pack-selector-open, empty |
| Leaves `/leaves` | seeded, empty |
| Policies `/policies` | seeded, empty, validation-error |
| Me `/me` | employee |

No capture-matrix gaps. The one single-width item is deliberate:

- **`dashboard--loading--1440` (1440 only).** The skeleton is a transient Suspense state that
  only renders while the dashboard's server component suspends on the signal-engine run during
  client-side navigation. It was caught by clicking the nav link and racing `waitForSelector`
  on the `animate-pulse` nodes; the window is a few hundred milliseconds and not reliably
  reproducible three times over. The skeleton is a single-column stack whose layout does not
  change materially at narrower widths, so 1440 is representative.

## Issues

Severity: Critical / High / Medium / Low. "Inherited" = found and fixed by the first Phase 5B
pass; "New" = found in this review pass. All Critical/High/Medium issues are FIXED and proven
by re-capture; Low issues are noted.

### Inherited fixes (reconstructed from the working-tree diff, verified in current captures)

| # | Screen | Problem | Commercial / user impact | Fix | Severity | Status |
|---|---|---|---|---|---|---|
| I1 | `/auth`, `/admin/login` | Form error messages rendered in the brand accent colour, not red | Errors did not read as errors; a failed sign-in in front of a prospect looks broken rather than handled | Error text switched to `text-signal-red` (`app/auth/AuthForm.tsx`, `app/admin/login/page.tsx`) | Medium | FIXED (`auth--validation-error--*`, `admin-login--failed-login--*`) |
| I2 | `/admin/login` | Copy leaked internals: "Use the admin password set in Supabase" | Vendor jargon on the front door of the product; instantly reads as a prototype | Reworded to "Sign in with your admin email and password. Employees sign in with a magic link instead." | High | FIXED (`admin-login--default--*`) |
| I3 | Dashboard risk cards | Button labelled "Execute action" | Robotic, systems-speak label on the hero screen | Relabelled "Start action" (`app/dashboard/RiskCard.tsx`) | Medium | FIXED (`dashboard--seeded--*`) |
| I4 | Dashboard lane headers | Item-count pill could squash/wrap next to long subtitles at narrow widths | Broken-looking chrome on mobile | `shrink-0 whitespace-nowrap` on the pill (`app/dashboard/SignalSection.tsx`) | Medium | FIXED (`dashboard--seeded--390`) |
| I5 | `/employees` | `INVALID_INPUT` error surfaced as "Input validation failed." | Machine string shown to a founder mid-demo | Reworded to "Could not save — check the email address and the other fields, then try again." | Medium | FIXED (`employees--validation-error--*`) |
| I6 | `/employees`, `/leaves`, `/me`, `/onboarding`, `/policies` | Error banners styled as neutral grey/white cards | Failures were visually indistinguishable from info panels — users miss them, demos stall | Red alert styling (`border-signal-red/30 bg-signal-red/10 text-signal-red`) across all five pages | High | FIXED (`employees--validation-error--*`, `policies--validation-error--*`) |
| I7 | `/employees` (add + edit + document forms), `/policies` (create form) | Inputs had no visible labels (placeholder-only), selects showed raw enum values (`full_time`, `cv`, `on_leave`), version field unlabelled | Placeholder-only forms look unfinished and are hostile to fill in; raw enums are developer residue | Every field wrapped in a visible label; options humanised (Full time, CV, Job description, On leave…); submit buttons aligned to the grid | High | FIXED (`employees--collapsed--*`, `employees--expanded--*`, `policies--seeded--*`) |
| I8 | `/employees` roster rows | Invite-resend guidance shown even for already-activated or inactive employees | Contradictory instructions ("resend the invite" under an ACTIVATED badge) undermine trust in the data | Guidance rendered only when setup is not active and the employee is not inactive | Low | FIXED (`employees--collapsed--*`) |

### New findings (this review pass)

| # | Screen | Problem | Commercial / user impact | Fix | Severity | Status |
|---|---|---|---|---|---|---|
| N1 | Dashboard — Resolved lane | Resolved cards still rendered the dark primary CTA with the stale action title (e.g. "Request renewal for passport" on a card whose next-step reads "Renewed passport uploaded.") | Directly contradicts the product's core story ("resolve it and the dashboard clears"); in a demo the founder says "this one's done" while the card shouts an action | `RiskCard.tsx`: dark action CTA suppressed when `lane === "resolved"`; resolved cards now show only "Open record" | Medium | FIXED (`dashboard--seeded--1440/1024/390`) |
| N2 | Dashboard — Missing jurisdiction document cards | Signal copy generated with a raw underscore-strip label: "The required emirates id for UAE is missing." / button "Upload emirates id" — while the sibling card correctly says "Emirates ID" | Inconsistent casing of a legal document name on the flagship screen; reads as template output, not product copy | `services/signalEngine/missingJurisdictionRequirement.ts`: proper label map ("Emirates ID", "right-to-work document"); evidence self-heals on the next reconcile (engine runs on every dashboard load); the two stale staging `action_items` titles were retitled via service-role | Medium | FIXED (`dashboard--seeded--1440/1024/390`) |
| N3 | `/employees` expanded detail grid + roster rows | Read-only values rendered as raw lowercase enums: "preboarding", "full time", status "active" — while `/me` shows "Full Time" | Half-humanised data next to otherwise polished labels looks careless in an admin walkthrough | `app/employees/page.tsx`: `capitalize` on lifecycle state, employment, and roster status values ("Preboarding", "Full Time", "Active") | Medium | FIXED (`employees--expanded--1440/1024/390`, `employees--collapsed--1440/1024/390`) |
| N4 | Onboarding / Policies seeded data | Seed names carry a literal "Demo" prefix ("Sign demo employment contract", "Demo Code of Conduct") | None in practice — the tenant is explicitly a demo tenant and the names read naturally; arguably a feature (nobody mistakes it for real PII) | Note only — seed plan is intentional and test-locked (`scripts/lib/demo-plan.mjs`) | Low | NOTED |
| N5 | Dashboard — Resolved card copy | "What is wrong: Passport had been expiring soon." — awkward past-perfect tense | Mildly odd phrasing on one seeded card; meaning is clear | Note only — seeded evidence text in `scripts/lib/demo-plan.mjs`, not presentation code | Low | NOTED |
| N6 | Date inputs (add/edit employee, documents) | Native date inputs show locale placeholder `dd/mm/yyyy` and a bare calendar glyph | Standard browser behaviour; consistent across the app | Note only | Low | NOTED |

## Uncapturable items

- **Dashboard loading skeleton below 1440** — transient Suspense window (sub-second, timing-raced);
  see Capture inventory note. Layout is width-invariant single-column, 1440 capture is representative.
- Nothing else in the agreed matrix was uncapturable.

## Per-surface commercial verdict

| Surface | Verdict | Notes |
|---|---|---|
| Landing | **Commercial-grade** | Confident positioning copy, clean type hierarchy, three crisp value cards; scales cleanly to 390 |
| Auth (magic link) + check-email | **Commercial-grade** | Clear split of employee vs admin path; resend cooldown state is genuinely polished (fresh-link notice + countdown) |
| Admin login | **Commercial-grade** | Jargon-free copy, proper red failure state |
| Dashboard (seeded) | **Commercial-grade** | The hero screen holds up: every card explains wrong/matters/next in plain English; resolved lane now visually "clears"; casing consistent after N1/N2 |
| Dashboard (empty + loading) | **Commercial-grade** | Empty lanes coach instead of apologising ("Keep this lane empty"); skeleton mirrors the real layout |
| Employees | **Commercial-grade** | Labelled forms, humanised values, believable roster; expanded record with due-diligence export reads like a paid product |
| Onboarding | **Commercial-grade** | Pack preview with per-task due dates and the no-start-date caveat is a strong demo moment |
| Leaves | **Commercial-grade** | Queue stats + single clear decision row; empty state explains what will appear |
| Policies | **Commercial-grade** | Draft/published lifecycle and acknowledgement counts read clearly at all widths |
| Me (employee) | **Commercial-grade** | Focused, calm profile with a single obvious acknowledgement action |

**Overall: ship-ready for paid demos.** No Critical or High issues remain open; all Medium issues
found in this pass are fixed and proven by re-capture; the three Low notes are data/browser
cosmetics that would not embarrass a demo.
