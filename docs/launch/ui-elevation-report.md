# Wave 3 — UI Elevation Report ("the calm instrument panel")

**Branch:** `wave-3-ui-elevation` (off local `main` @ `cd8076f`)
**Scope discipline:** presentation only. Routes, data flow, server actions, and
information architecture untouched. The single allowed service-layer addition is
the read-only `countOpenSignals` helper in
`services/signalEngine/signalRepository.ts` (Actor-scoped, tenant-filtered).

---

## Before → after

| Area | Before | After |
|---|---|---|
| Design tokens | ink/paper/accent only; severity colours were ad-hoc Tailwind `red-*` / `amber-*` / `emerald-*` / `sky-*` strings scattered across pages | `--color-signal-red/amber/green` tokens in `app/globals.css` @theme (mapped to the tones RiskCard already used), plus `--font-mono` (IBM Plex Mono) and `--font-display` (Fraunces). Zero raw palette colours remain in `app/` or `components/` |
| Fonts | CSS font-stack only | Fraunces 500/600 + IBM Plex Mono 400/500 loaded via `next/font/google` in `app/layout.tsx` (build-time download succeeded; no CSS imports). Display face used on the wordmark and dashboard H1 only |
| Navigation | Six hand-rolled `<nav>` blocks with drifting labels ("Team roster" vs "Employees") and per-page link lists | One `components/AppShell.tsx` server component: Fraunces wordmark, role-appropriate links (admin: Dashboard/Employees/Onboarding/Leaves/Policies; employee: Me/Onboarding/Leaves), active-link state via `aria-current`, Risk Pulse, SignOutButton. Top-nav pattern kept; no sidebar |
| Risk Pulse | Did not exist | Server-rendered dot + label in the AppShell, admins only: "All clear" (green) / "N need attention" (amber) / "N urgent" (red). Derived from one read-only query via `countOpenSignals`; links to /dashboard; no polling, no client fetching, no new tables |
| Pills | ~10 ad-hoc pill class strings across five pages | `components/StatusPill.tsx` with five tones (red/amber/green/neutral/info) driven by the severity tokens |
| Empty states | Repeated dashed-border markup with inconsistent structure | `components/EmptyState.tsx` (icon-optional, one sentence, optional hint line preserving Wave 2 guided copy, optional CTA). Adopted on every list surface |
| RiskCard | Full tinted card backgrounds per lane (`bg-red-50/70` etc.) | Status-spine pattern: white card, 3px left border in the severity token, small severity pill. What's-wrong / why-it-matters / what-to-do-next structure unchanged |
| SignalSection | Tinted section washes per lane | Ink-on-paper sections; severity carried by a small dot in the heading and the cards' spines |
| Metrics | Proportional sans figures | All counts, dates, and metrics set in `font-mono tabular-nums` (stat cards, section counts, pill counts, submitted/updated/uploaded dates, invite telemetry, progress %) |
| Motion | Mixed | `transition` (150ms ease) on interactive cards, buttons, and pills only. No animation library |
| Landing page | "A calm directory for startup teams" (pre-pivot copy) | Rebuilt server-rendered page: blueprint §1 one-liner as the display-font H1, signal-loop paragraph for 5–20 person founder-led teams, three feature blocks (Risk signals dashboard / One-click investor Due-Diligence Pack / 48–72h operator-led setup), blueprint §2 founder-authority line, "Request a pilot" mailto CTA (PLACEHOLDER address marked in a code comment) + secondary Sign in. No pricing, no testimonials, no screenshots (clearly-marked slot left). No competitive superlatives |
| Shade hygiene | Utilities referencing undefined theme shades (`ink-50/200/400/600/800`) silently produced no CSS (invisible skeleton bars in every `loading.tsx`) | Normalised to defined tokens (`ink-100`, `ink-300/50`, `ink-500`, `ink-700`); loading skeletons render again |

---

## Surfaces touched — static review checklist

No live DB credentials exist locally, so this was a static route-by-route review
of the rendered JSX (not a browser pass):

| Surface | AppShell + correct role links | Tokens (no ad-hoc colours) | Mono metrics | EmptyState adopted | Status spine | No overflow-prone fixed widths @360px |
|---|---|---|---|---|---|---|
| `/` (landing) | n/a (public) | PASS | PASS (year) | n/a | n/a | PASS (max-w + wrap only) |
| `/auth` | n/a (public) | PASS | n/a | n/a | n/a | PASS |
| `/auth/check-email` | n/a (public) | PASS (signal tokens on resend/rate-limit notices) | n/a | n/a | n/a | PASS |
| `/admin/login` | n/a (public) | PASS (ink/accent only; unchanged) | n/a | n/a | n/a | PASS |
| `/dashboard` | PASS (admin links, pulse, active state) | PASS | PASS | PASS (three lanes) | PASS (RiskCard) | PASS (flex-wrap CTAs, responsive grids) |
| `/employees` (admin + restricted employee view) | PASS (both branches) | PASS (invite pills via StatusPill; activation notices via tokens) | PASS (stats, invite telemetry, document dates) | PASS (roster + per-employee documents) | n/a | PASS (`w-full sm:w-auto` action buttons wrap) |
| `/onboarding` (admin + employee) | PASS (both branches) | PASS | PASS (stats, dates, counts, %) | PASS (no-tasks, not-linked, nothing-waiting) | n/a | PASS (single `min-w-[200px]` sits inside `flex-wrap`; fits 360px) |
| `/leaves` (admin + employee) | PASS (both branches) | PASS | PASS (dates, counts, age) | PASS (queue, history, not-linked) | n/a | PASS |
| `/policies` | PASS (admin; employees redirect to /me) | PASS | PASS (stats, versions, dates) | PASS (no-policies) | n/a | PASS |
| `/me` | PASS (employee links) | PASS | PASS (start date, policy versions, count) | PASS (not-linked) | n/a | PASS |

Also touched (consistency, not full surfaces): `loading.tsx` for
dashboard/employees/leaves/onboarding/policies (skeleton shade fix),
`SignOutButton` (defined-token text colour), `ResendLinkForm` /
`AssignPackForm` (disabled/panel shade normalisation).

---

## Gate chain (local, this branch)

- `npm run typecheck` — PASS (clean)
- `npm test` — PASS (8 files, 38 tests)
- `npm run guards` — PASS (instrumentation, health-contract, telemetry, tenancy-filter ×4)
- `npm run build` — PASS (compiled + linted; 13 routes; `/` static, app routes dynamic)
- Fonts: `next/font/google` download succeeded at build time — no local fallback needed.

---

## Remaining for the founder's staging pass

Browser-level QA at **360px and 1280px** (real data, real signals) remains
outstanding — this wave's responsive verification was static JSX review only.
Also set `NEXT_PUBLIC_PILOT_CONTACT_EMAIL` (the pilot CTA in `app/page.tsx` is
env-driven; unset hides the CTA) and drop real screenshots into the marked slot
on the landing page.
