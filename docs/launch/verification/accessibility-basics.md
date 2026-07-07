# Accessibility Basics — Verification Evidence

Phase 5 acceptance, 2026-07-07. Branch `phase-5-acceptance`, baseline HEAD `38b8301`.

## Methodology

- **Tooling:** `@axe-core/playwright` 4.12.1 (axe-core engine 4.12.1) driven by Playwright 1.61.1 (Chromium, 1440x900), plus scripted manual checks (keyboard, focus, labels/errors, 200% zoom) via Playwright.
- **Rule scope:** WCAG 2.x A/AA tags only — `wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22a, wcag22aa` (axe best-practice rules excluded).
- **Servers:** initial scan against the rehearsal copy at `C:\Users\isuda\Dev\teamframe-rehearsal` (same sha `38b8301`, seeded demo tenant) on `http://localhost:3030`; the post-fix re-scan was run against **this repo's** code served with `next dev -p 3031`, so the re-scan proves the committed fix.
- **Pages and states:**
  - Public: `/`, `/auth`, `/admin/login`
  - Admin session (`demo-admin@demo-fpors.example`, sees seeded data): `/dashboard`, `/employees` (first row expanded via its `<details>/<summary>` toggle), `/onboarding`, `/leaves`, `/policies`
  - Employee session (`/me`): seeded demo employees ship without auth users, so one was created for `lina.ops@demo-fpors.example` via the service-role API with `app_metadata { role: employee, tenant_id }` (tenant claims are JWT-only per the Phase 1A trust boundary), then signed in through `generateLink(magiclink)` → `/auth/callback?token_hash=…&type=magiclink` → landed on `/me`.
- The Next.js **dev overlay** (`<nextjs-portal>`) is dev-only chrome that captures a Tab stop; it was excluded from keyboard/focus results.

## Axe results — before (rehearsal @ 38b8301)

Counts are affected **element nodes** by impact (critical / serious / moderate / minor).

| Page | Violations (rules) | critical | serious | moderate | minor | Detail |
|---|---|---|---|---|---|---|
| `/` | 0 | 0 | 0 | 0 | 0 | — |
| `/auth` | 0 | 0 | 0 | 0 | 0 | — |
| `/admin/login` | 0 | 0 | 0 | 0 | 0 | — |
| `/dashboard` | 1 | 0 | **8** | 0 | 0 | `color-contrast` — amber signal pills (`text-signal-amber` on `bg-signal-amber/10`), ~4.37:1 < 4.5:1 |
| `/employees` (row expanded) | 0 | 0 | 0 | 0 | 0 | — |
| `/onboarding` | 0 | 0 | 0 | 0 | 0 | — |
| `/leaves` | 0 | 0 | 0 | 0 | 0 | — |
| `/policies` | 0 | 0 | 0 | 0 | 0 | — |
| `/me` (employee session) | 0 | 0 | 0 | 0 | 0 | — |

## Fix applied

| Item | Change | Commit |
|---|---|---|
| `color-contrast` (serious, 8 nodes, `/dashboard`) | `app/globals.css`: `--color-signal-amber` `#b45309` (amber-700) → `#92400e` (amber-800). Amber-700 text on the `bg-signal-amber/10` pill tint over the paper background computes ~4.37:1; amber-800 clears 4.5:1 on every amber tint in use (≈5.5:1 on the pill tint, ≈7:1 on white). Token-only change — no component restructuring. | see commit on `phase-5-acceptance` (recorded below in repo history) |

## Axe results — after fix (this repo served on :3031)

| Page | Violations (rules) | critical | serious | moderate | minor |
|---|---|---|---|---|---|
| `/` | 0 | 0 | 0 | 0 | 0 |
| `/auth` | 0 | 0 | 0 | 0 | 0 |
| `/admin/login` | 0 | 0 | 0 | 0 | 0 |
| `/dashboard` | **0** | 0 | **0** | 0 | 0 |
| `/employees` (row expanded) | 0 | 0 | 0 | 0 | 0 |
| `/onboarding` | 0 | 0 | 0 | 0 | 0 |
| `/leaves` | 0 | 0 | 0 | 0 | 0 |
| `/policies` | 0 | 0 | 0 | 0 | 0 |
| `/me` (employee session) | 0 | 0 | 0 | 0 | 0 |

## Manual basics

Scripted with Playwright against the same seeded states. The dev overlay element was removed before auditing (dev-only, traps Tab in its shadow DOM — not shipped in production builds).

### 1. Keyboard-only navigation — PASS

Tab reachability on `/admin/login`, `/dashboard`, `/employees` (row expanded), `/policies`, `/me`. "Unique stops" dedupes controls that share an accessible name (e.g. repeated "Resolve" buttons).

| Page | Tabbable controls found | Unique stops reached | Focus cycles back (no trap) | Unreachable |
|---|---|---|---|---|
| `/admin/login` | 3 | 3 | yes | none |
| `/dashboard` | 64 | 22 unique (all 64 map to reached names) | yes | none |
| `/employees` (expanded) | 40 | 37 unique | yes | none |
| `/policies` | 14 | 14 | yes | none |
| `/me` | 9 | 9 | yes | none |

- Representative tab sequence (`/dashboard`): `TeamFrame` wordmark link → nav `Dashboard` → `Employees` → `Onboarding` → `Leaves` → `Policies` → `Risk pulse` link → `Sign out` button → then in-content signal actions in document order. Sensible order, matches visual layout.
- Operability spot-check: a collapsed employee row `<summary>` focused via keyboard and activated with **Enter** toggled `details.open` false → true. Native `<a>`/`<button type=submit>` elements are inherently Enter/Space-operable.
- Buttons inside **collapsed** rows (Download/Delete/Copy) are correctly hidden from tab order and become reachable when the row is expanded.
- No keyboard trap observed on any page (focus cycles through the full page and wraps).

### 2. Visible focus states — PASS

- Every unique tab stop on all five pages shows a visible focus indicator: default focus outline on buttons/links/summaries, or (for the rounded text inputs on `/admin/login` and `/auth`, which set `outline-none`) a strong border-colour change `#c9c9c9` → `#0a0a0a` (`focus:border-ink-900`).
- Zero controls with no indicator (computed outline, box-shadow, and focus border/background change all checked).
- Evidence: `docs/launch/screenshots/a11y--focus--1440.png` (top: `/admin/login` with the primary **Sign in** button focused; bottom: `/dashboard` with the wordmark nav link focused).

### 3. Form labels and error messages — PASS

| Form | Fields checked | Programmatic label | Error mechanism |
|---|---|---|---|
| `/admin/login` | email, password | `label[for]` (`sr-only`) on both | `role="alert"` text: "Email or password is incorrect." (rendered, verified) — text, not colour-only |
| Add employee (`/employees`) | all 53 visible inputs/selects on the page (incl. add form, status editor, document upload) | wrapping `<label>` on all — 0 unlabelled | server-action errors render as `role="alert"` text banner (`ERROR_COPY` map); native `required` on mandatory fields |
| Policy create (`/policies`) | 3 visible fields | wrapping `<label>` — 0 unlabelled | `role="alert"` text banner via `?error=` param; native `required` |
| Leave request (`/leaves`, employee session) | `start_date`, `end_date` | `label[for]` on both, `required` | `role="alert"` text banner ("From"/"To" dates validated server-side) |

All validation errors are worded text messages rendered in an alert region — none rely on colour alone.

### 4. 200% zoom — PASS

Emulated as 720 px logical viewport width (≙ 200% zoom at 1440 px), per WCAG 1.4.10 reflow method.

| Page | scrollWidth | clientWidth | Horizontal scroll | Notes |
|---|---|---|---|---|
| `/dashboard` | 720 | 720 | none | content reflows to single column; all actions visible and clickable |
| `/employees` (row expanded) | 720 | 720 | none | expanded detail grid collapses to stacked layout; forms usable |

Evidence: `docs/launch/screenshots/a11y--zoom200--dashboard.png` (full page at 720 px logical width).

## Remaining findings

None open at critical or serious. No moderate/minor axe violations remain on the scanned pages either. Not treated as defects:

- The `<nextjs-portal>` dev overlay takes a Tab stop in `next dev` only; it is not part of the production bundle.
- Login/auth text inputs rely on a border-colour change rather than an outline for focus; the change (ink-300 → ink-900) is clearly visible and satisfies WCAG 2.4.7, so it was recorded, not "fixed".

## Verdict

**Accessibility basics: PASS (no critical/serious open)** — axe WCAG 2.x A/AA clean on all 9 scanned pages/states after the amber-token fix, and all four manual checks (keyboard-only navigation, visible focus, form labels/errors, 200% zoom) pass.
