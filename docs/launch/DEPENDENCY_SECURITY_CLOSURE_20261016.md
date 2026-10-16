# Dependency security closure evidence — 2026-10-16

**Status:** Prepared for independent acceptance. No merge, deployment, live provider call, infrastructure change or customer-data operation was performed.

## Baseline and decision

- Protected `main`: `e53d9ecee1fd53ccbcfa0e24ea8a6871c2a761cc`.
- Compatible dependency correction base (PR #36): `ea4a51d800add658a3723f952cfc1c45149fce82`.
- Security branch: `fix/sentry-security-closure`.
- Selected Sentry version: `@sentry/nextjs` `10.76.2`, pinned exactly.

Sentry 9 has no release newer than `9.47.2` and its resolved OpenTelemetry tree remains affected. Sentry `10.76.2` is the smallest maintained major that removes all confirmed Sentry/OpenTelemetry/UUID/bundler advisories from the resolved tree while retaining support for Next.js 15 and Node.js 18+. Sentry 11 is therefore unnecessary for this correction and would introduce broader runtime, instrumentation and data-collection changes. Official migration guidance describes v10 as primarily the OpenTelemetry v2 upgrade with minimal breaking changes: <https://github.com/getsentry/sentry-javascript/blob/develop/docs/migration/v9-to-v10.md>.

## Audit counts

Counts below are vulnerable dependency nodes reported by npm, not distinct advisory IDs.

| Tree | Before PR #36 | PR #36 | Final proposed tree |
| --- | ---: | ---: | ---: |
| Full install | 35 total: 12 high, 23 moderate | 31 total: 9 high, 22 moderate | 5 total: 5 high, 0 moderate |
| `npm audit --omit=dev` | 31 total: 8 high, 23 moderate | 27 total: 5 high, 22 moderate | **0** |

## Complete advisory register

| Advisory | Package/path | Scope and prerequisite | Disposition |
| --- | --- | --- | --- |
| `GHSA-4jqv-mc3x-m676` | direct `next` | Runtime SSG/ISR cache poisoning; affected `<15.5.27` | Fixed by PR #36 at `15.5.28`. |
| `GHSA-mcj8-r9mp-w47p` | direct `next` | Runtime SSG/ISR content substitution/denial of service; affected `<15.5.27` | Fixed by PR #36 at `15.5.28`. |
| `GHSA-wq5f-xc86-pv6w` | direct `sharp` / image-processing dependency | Requires affected librsvg processing path | Fixed by PR #36 at `0.35.5`. |
| `GHSA-68fv-2mgg-jv7q` | transitive `source-map-js` | Crafted indexed source-map offsets can block the event loop | Fixed by PR #36 override at `1.2.2`. |
| `GHSA-q2hr-2g5m-vwhr` | transitive `brace-expansion` 1.x/2.x | Crafted brace patterns cause quadratic CPU use | Fixed by PR #36 at `1.1.21` and `2.1.7`. |
| `GHSA-qhr7-859c-m2p7` | transitive `brace-expansion` 2.x | Crafted nested brace groups cause recursion/stack exhaustion | Fixed by PR #36 at `2.1.7`. |
| `GHSA-6j4f-fj2g-mc7p` | transitive `brace-expansion` 2.x | Crafted comma/brace input causes recursion/stack exhaustion | Fixed by PR #36 at `2.1.7`. |
| `GHSA-qqmp-wf37-98f9` | Sentry 9 → OpenTelemetry `pg`, `mysql`, `mysql2`, `knex`, `mongoose`, `tedious` instrumentations | Database username could be emitted as `db.user` when an affected integration instruments a connection | Fixed: Sentry `10.76.2` resolves current instrumentations; affected packages/versions are absent. |
| `GHSA-8988-4f7v-96qf` | Sentry 9 → `@opentelemetry/core` `<2.8.0` | Malicious W3C baggage input can cause unbounded memory allocation | Fixed: final tree resolves `@opentelemetry/core` `2.12.0`. |
| `GHSA-w5hq-g745-h8pq` | Sentry 9 webpack plugin → `uuid` `<11.1.1` | Affected UUID calls require a supplied output buffer; build-plugin path | Fixed: the vulnerable `uuid` package is absent from the final tree. |
| `GHSA-vfj7-8cjw-p6xm` | `eslint-config-next` → `@next/eslint-plugin-next` → `fast-glob` → `micromatch` → `braces@3.0.3` | **Development-only in the final tree.** Exploitation requires deeply nested attacker-controlled glob patterns. TeamFrame lint receives fixed repository/configuration patterns, not HTTP, employee or customer input. | **Unresolved upstream; no patched release exists.** Mitigated by dev-only reachability, fixed trusted lint inputs, and exclusion from the deployed production tree. Do not use npm's suggested Next.js lint downgrade. Founder should accept this bounded residual risk until a compatible upstream patch or parent release exists. |

GitHub's repository alerts still reflect the default branch until these stacked PRs merge; final disposition is based on the proposed resolved lockfile and both full and production-only npm audits.

## Telemetry compatibility and privacy

- Updated the deprecated Sentry 9 configuration import and debug-logger option to their Sentry 10 forms.
- Preserved DSN-gated initialization, zero trace sampling, zero client replay sampling and existing server/client/edge wiring.
- Explicitly set `sendDefaultPii: false` in all three runtimes.
- Extended the existing scrubber to redact embedded email addresses, bearer tokens, JWT-shaped tokens and additional secret-bearing keys.
- Sentry events now remove user data and retain only request method plus URL without query/fragment. Request bodies, headers and cookies are not forwarded.
- Exception text, breadcrumbs, structured context and action extras pass through the same scrubber.
- No monitoring provider, dashboard, route, infrastructure or environment-variable contract was added.

## Verification

- Clean `npm ci`: PASS.
- Focused Sentry compatibility/privacy tests: 5/5 PASS.
- Complete deterministic suite: 574 PASS / 2 skipped, 81 files PASS / 2 skipped.
- Typecheck: PASS.
- Lint: PASS with no warnings or errors.
- Four static/security guards: PASS.
- Production build: PASS on Next.js `15.5.28` and Sentry `10.76.2`.
- `npm audit --omit=dev`: zero vulnerabilities.
- Full `npm audit`: only the five dependency-node reports induced by the single dev-only `braces` advisory.
- Actual provider delivery was intentionally not invoked because no disposable Sentry credentials were supplied. The synthetic tests prove server, edge and client initialization/capture contracts, not external event receipt.

## Acceptance and merge order

Independent acceptance should review this PR separately against PR #36. If accepted, merge PR #36 first, then retarget/revalidate this PR against protected `main`, then merge the Sentry correction. PRs #34 and #35 remain separate application-correction workstreams and must retain their existing review order.
