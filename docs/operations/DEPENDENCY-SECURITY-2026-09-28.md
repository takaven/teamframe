# TeamFrame dependency security review — 2026-09-28

## Release decision

**CLEAN WITH DOCUMENTED EXCEPTIONS.** The launch branch has no unresolved Critical or High production-runtime advisory. The complete local audit is `0 Critical / 0 High / 22 Moderate`; the production-only audit is also `0 Critical / 0 High / 22 Moderate`.

GitHub's open `4 Critical / 18 High / 9 Moderate` view was last evaluated against the older default-branch manifests on 9 September 2026. The launch branch already carried the runtime patches. This review completed the remaining bounded development-tool patches without a framework major upgrade or `npm audit fix --force`.

## Baseline

- Branch: `launch/managed-people-ops-45-day`
- Starting commit: `9efc986a3c93bba8886d08a48a00d32a9aa8a7c1`
- Package manager: npm `11.11.0`
- Node: `v24.14.1` (project floor: `>=20.19.0`)
- Direct runtime dependencies: 7, plus one direct optional runtime dependency (`sharp`)
- Direct development dependencies: 14
- Installed dependency graph: 727 packages as reported by npm audit metadata

## Critical GitHub alerts

GitHub counts each Next.js advisory once for `package.json` and once for `package-lock.json`.

| Alert | Advisory | Default-branch installed | Affected | Fixed | Path/scope | Reachability | Resolution |
| --- | --- | ---: | --- | ---: | --- | --- | --- |
| #34 | `GHSA-p293-qw3h-jr36` / `CVE-2026-75604` — Windows-hosted RCE | `next@15.5.22` | `>=13.4.0 <15.5.24` | `15.5.24` | Direct runtime | Requires a Windows-hosted Next server; Vercel Production is not Windows | Patched to `15.5.25` |
| #30 | Same advisory, lockfile finding | `next@15.5.22` | `>=13.4.0 <15.5.24` | `15.5.24` | Direct runtime | Same as #34 | Patched to `15.5.25` |
| #35 | `GHSA-2xp9-vwfh-vxw4` — AVIF image optimisation RCE | `next@15.5.22` | `>=10.0.0 <15.5.24` | `15.5.24` | Direct runtime through Next image optimisation | TeamFrame uses `next/image`, but no untrusted remote image source or AVIF upload-to-optimiser path was found | Patched to `15.5.25` |
| #31 | Same advisory, lockfile finding | `next@15.5.22` | `>=10.0.0 <15.5.24` | `15.5.24` | Direct runtime | Same as #35 | Patched to `15.5.25` |

## High GitHub alerts

| Alert | Package/advisory | Default-branch installed | Patched/selected | Dependency path and scope | Reachability | Resolution |
| --- | --- | ---: | ---: | --- | --- | --- |
| #33 | `sharp` / `GHSA-rgj7-g3m4-5g8c` (libheif) | `0.34.5` | `0.35.4` | Next image optimiser; optional production dependency | Only source-controlled images were found; no untrusted image-transform route | Patched to `0.35.4` |
| #20 | `nanoid` / `GHSA-2v37-7h3g-55p8` zero-size generator loop | `3.3.12` | `3.3.18` | Transitive through PostCSS | TeamFrame never calls the affected custom generator | Patched to `3.3.19` |
| #3 | `vite` / `GHSA-fx2h-pf6j-xcff` Windows deny bypass | `8.0.14` | `8.0.16` | `vitest -> vite`; development/test only | Requires an exposed Windows Vite development server; none is deployed | Patched to `8.0.16` |
| #19 | `nanoid` negative-size generator loop | `3.3.12` | `3.3.19` | Transitive through PostCSS | TeamFrame never calls the affected non-secure generator | Patched to `3.3.19` |
| #21 | `browserslist` untrusted custom-stats prototype write/crash | `4.28.2` | `4.29.0` | Build tooling | No user-controlled browserslist configuration or stats file | Patched to `4.29.0` |
| #22 | `browserslist` query-cache memory exhaustion | `4.28.2` | `4.29.0` | Build tooling | No runtime query endpoint; fixed build input only | Patched to `4.29.0` |
| #11 | `postcss` arbitrary file read via `sourceMappingURL` | `8.5.15` | `8.5.28` | Next/Tailwind build processing | No user CSS, source-map upload, or runtime PostCSS endpoint | Patched to `8.5.28` |
| #9 | `js-yaml` / `GHSA-52cp-r559-cp3m` merge-key CPU DoS | `4.1.1` | `4.3.0` | `eslint -> @eslint/eslintrc -> js-yaml`; development only | Lints repository-owned configuration; no untrusted YAML input | Patched to `4.3.2` through `@eslint/eslintrc@3.3.7` |
| #8 | `brace-expansion` / `GHSA-3jxr-9vmj-r5cp`, 1.x line | `1.1.14` | `1.1.16` | `eslint -> minimatch@3`; development only | Repository-owned lint globs only | Patched to `1.1.18` |
| #7 | Same advisory, 5.x line | `5.0.6` | `5.0.7` | `eslint-config-next -> typescript-eslint -> minimatch@10`; development only | Repository-owned lint globs only | Patched to `5.0.12` |
| #12 | `postcss` previous-source-map path traversal | `8.5.15` | `8.5.28` | Next/Tailwind build processing | No untrusted CSS/source map enters PostCSS | Patched to `8.5.28` |
| #32 | `js-yaml` / `GHSA-2883-xcg3-v3hh` empty merge-source CPU DoS | `4.1.1` | `4.3.2` | ESLint development path | No untrusted YAML input | Patched to `4.3.2` |
| #26 | `fast-uri` scheme-relative IDN host confusion | `3.1.5` | `3.1.8` | Sentry webpack plugin -> schema-utils -> Ajv; build-time | No TeamFrame request-routing or URL-fetch path uses this package | Patched to `3.1.8` |
| #23 | `fast-uri` percent-encoded scheme host confusion | `3.1.5` | `3.1.8` | Same build-time path | Same as #26 | Patched to `3.1.8` |
| #25 | `fast-uri` malformed IPv6 SSRF normalisation | `3.1.5` | `3.1.8` | Same build-time path | Same as #26 | Patched to `3.1.8` |
| #24 | `fast-uri` repeated hostname percent-decoding SSRF | `3.1.5` | `3.1.8` | Same build-time path | Same as #26 | Patched to `3.1.8` |
| #18 | `js-yaml` / `GHSA-5p4m-2wfm-xmqj` `!!omap` CPU DoS | `4.1.1` | `4.3.1` | ESLint development path | No untrusted YAML input | Patched to `4.3.2` |
| #10 | `sharp` inherited libvips CVEs | `0.34.5` | `0.35.4` (current aggregate-safe line) | Next image optimiser; optional production dependency | No untrusted image-transform route found | Patched to `0.35.4` |

## Bounded changes in this review

| Package | Before | After | Reason |
| --- | ---: | ---: | --- |
| `vitest` | `4.1.7` | `4.1.11` | Patch release also removes the known mocker path-traversal Moderate |
| `vite` | `8.0.14` | `8.0.16` | Smallest compatible patch for the High Windows development-server bypass |
| `@eslint/eslintrc` | `3.3.5` | `3.3.7` | Supported transitive patch that selects fixed `js-yaml@4.3.2` |
| `js-yaml` | `4.1.1` | `4.3.2` | Removes all three High YAML CPU advisories and one Moderate |
| `brace-expansion` under `minimatch@3.1.5` | `1.1.14` | `1.1.18` | Latest compatible 1.x patch; removes all three High advisories |
| `brace-expansion` under `minimatch@10.2.5` | `5.0.6` | `5.0.12` | Latest compatible 5.x patch; removes all three High advisories |

The existing production remediations remain pinned: Next.js `15.5.25`, Sharp `0.35.4`, Nano ID `3.3.19`, Browserslist `4.29.0`, PostCSS `8.5.28`, and fast-uri `3.1.8`.

## Moderate residual risk

The remaining npm count is an aggregate of two underlying advisory families, expanded across transitive dependants. This is why npm's 22 package entries do not equal GitHub's 9 Moderate alert rows on the older default branch:

1. `GHSA-8988-4f7v-96qf` in OpenTelemetry Core `<2.8.0`, pulled by `@sentry/nextjs@9.47.1`. It concerns unbounded W3C baggage parsing. npm reports no compatible fix on the current supported Sentry 9 line; the next available Sentry release is a major upgrade. TeamFrame does not deliberately propagate user-defined baggage, but an external baggage header can reach server instrumentation, so this is retained as a genuine Moderate runtime residual risk. Reassess in a dedicated Sentry major upgrade before broad public scale.
2. `GHSA-w5hq-g745-h8pq` in `uuid@9.0.1`, pulled by the Sentry webpack plugin. The affected v3/v5/v6 buffer API is not called by TeamFrame and this path is build-time. Accept until Sentry's supported parent update removes it.

No unresolved Moderate is being represented as a Critical or High launch blocker.

## Verification requirements

The release commit containing this review must retain evidence of:

- `npm audit`: `0 Critical / 0 High`.
- `npm audit --omit=dev`: `0 Critical / 0 High`.
- focused security, auth, storage, notifications, import, and operator-path tests.
- typecheck, lint, production build, `verify:release`, and `git diff --check`.

The lockfile changes 33 package nodes. All movement belongs to the four intended parent trees: `@eslint/eslintrc`/`js-yaml`, scoped `brace-expansion`, `vitest`, and `vite` (including Vitest/Rolldown platform packages). No Production framework, Supabase, Sentry, React, or business dependency moved in this pass.

## Reassessment triggers

- A supported Sentry patch/minor that upgrades OpenTelemetry Core to `>=2.8.0`.
- Any public feature that accepts W3C baggage values intentionally.
- Any feature that processes untrusted remote images through Next/Sharp.
- Any user-controlled CSS, source map, Browserslist stats, YAML, or glob-processing feature.
- Before a future Next.js or Sentry major migration.
