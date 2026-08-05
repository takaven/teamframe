# TeamFrame dependency risk decision - 2026-08-05

## Decision

**Dependency clearance target:** prepare the source tree for disposable Supabase verification with synthetic data only.

**Decision:** update the approved Next.js 15.5 patch line, remediate the independently fixable production High findings for `brace-expansion` and `fast-uri`, and temporarily accept the remaining Next.js/PostCSS/Sharp findings only for disposable-environment verification.

This is **not** production approval, paid-pilot approval, customer-data approval, monetisation approval, or a permanent security acceptance.

## Source state

- Repository: `C:\Users\isuda\Dev\TeamFrame-canonical`
- Branch: `codex/reconcile-local-main`
- Starting commit: `1e993423bdbb3c7656ab7d59ed44228dfc15a7f5`
- Final commit: recorded in the completion evidence for the commit containing this file
- Node: `v24.14.1`
- npm: `11.11.0`

## Package changes

| Package | Before | After | Disposition |
| --- | --- | --- | --- |
| `next` | `^15.5.21` resolving `15.5.21` | `15.5.22` | Exact approved 15.5 patch-line update. |
| `eslint-config-next` | `^15.5.21` resolving `15.5.21` | `15.5.22` | Exact matching lint config patch-line update. |
| `brace-expansion` | `2.1.1` under production Sentry paths | `2.1.4` under affected `minimatch` paths | Remediated with narrow compatible overrides. |
| `fast-uri` | `3.1.2` under `ajv` | `3.1.5` under `ajv` | Remediated with a narrow compatible override. |

No Next.js 16 migration was performed. No Sentry major upgrade was performed. No `npm audit fix --force` was used.

## Audit totals

| Stage | Critical | High | Moderate | Total |
| --- | ---: | ---: | ---: | ---: |
| Before remediation, `npm audit --omit=dev` | 0 | 5 | 20 | 25 |
| After targeted remediation, `npm audit --omit=dev` | 0 | 3 | 20 | 23 |

Baseline evidence:

- `C:\Users\isuda\Dev\TeamFrame-hardening-evidence\dependency-remediation-2026-08-05\baseline-npm-audit-prod.json`
- `C:\Users\isuda\Dev\TeamFrame-hardening-evidence\dependency-remediation-2026-08-05\baseline-npm-ls.txt`
- `C:\Users\isuda\Dev\TeamFrame-hardening-evidence\dependency-remediation-2026-08-05\baseline-explain-brace-expansion.txt`
- `C:\Users\isuda\Dev\TeamFrame-hardening-evidence\dependency-remediation-2026-08-05\baseline-explain-fast-uri.txt`

Post-remediation evidence:

- `C:\Users\isuda\Dev\TeamFrame-hardening-evidence\dependency-remediation-2026-08-05\after-targeted-remediation-npm-audit-prod.json`
- `C:\Users\isuda\Dev\TeamFrame-hardening-evidence\dependency-remediation-2026-08-05\after-targeted-remediation-npm-ls.txt`

## Remediated High findings

### brace-expansion

Advisories:

- `GHSA-3jxr-9vmj-r5cp` - DoS via exponential-time expansion of consecutive non-expanding groups.
- `GHSA-mh99-v99m-4gvg` - DoS via unbounded expansion length.
- `GHSA-rgw5-rvv9-x895` - DoS via unbounded intermediate arrays.

Baseline production paths:

- `@sentry/nextjs@9.47.1 -> @sentry/node@9.47.1 -> minimatch@9.0.9 -> brace-expansion@2.1.1`
- `@sentry/nextjs@9.47.1 -> @sentry/webpack-plugin@3.6.1 -> @sentry/bundler-plugin-core@3.6.1 -> glob@9.3.5 -> minimatch@8.0.7 -> brace-expansion@2.1.1`

Disposition: remediated with parent-scoped npm overrides:

- `minimatch@8.0.7 -> brace-expansion@2.1.4`
- `minimatch@9.0.9 -> brace-expansion@2.1.4`

Both parent ranges accept the patched version: `^2.0.1` and `^2.0.2` respectively.

### fast-uri

Advisories:

- `GHSA-v2hh-gcrm-f6hx` - host confusion via literal backslash authority delimiter.
- `GHSA-7p8r-x3mc-p8w7` - host confusion via backslash authority introducer.
- `GHSA-4c8g-83qw-93j6` - host confusion via failed IDN canonicalization.

Baseline production path:

- `@sentry/nextjs@9.47.1 -> @sentry/webpack-plugin@3.6.1 -> webpack@5.107.2 -> schema-utils@4.3.3 -> ajv@8.20.0 -> fast-uri@3.1.2`

Disposition: remediated with an npm override:

- `ajv -> fast-uri@3.1.5`

The parent range accepts the patched version: `^3.0.1`.

## Remaining High findings

After remediation, the remaining production High findings are:

- `next`
- `postcss`
- `sharp`

The `next` finding is an aggregate caused by the bundled `postcss` and optional `sharp` dependency paths. npm reports the available fix as `next@16.3.0`, which is a semver-major framework migration and is outside this bounded pass.

## PostCSS advisory inventory and reachability

Installed vulnerable path:

- `next@15.5.22 -> postcss@8.4.31`

TeamFrame also has a top-level `postcss` dependency resolving to a patched 8.5 line for Tailwind tooling, but the production audit finding is the bundled Next.js copy.

| Advisory | Vulnerable package/version | Required attacker-controlled input | TeamFrame input path | Reachable? | Decision |
| --- | --- | --- | --- | --- | --- |
| `GHSA-qx2v-qp2m-jg93` - unescaped `</style>` in CSS stringify output | `next/node_modules/postcss@8.4.31` | Attacker-controlled CSS processed and stringified into HTML/style context | No user CSS upload, theme editor, raw CSS API, or customer-controlled CSS build input identified | No identified path | Accepted residual risk for disposable verification only - no identified attacker-controlled CSS or source-map path |
| `GHSA-6g55-p6wh-862q` - arbitrary file read via attacker-controlled `sourceMappingURL` in CSS comments | `next/node_modules/postcss@8.4.31` | Attacker-controlled CSS comments/source maps entering PostCSS processing | Production build uses repository CSS only: `app/globals.css`; route scan found no CSS/source-map upload path | No identified path | Accepted residual risk for disposable verification only - no identified attacker-controlled CSS or source-map path |
| `GHSA-r28c-9q8g-f849` - path traversal in previous source-map auto-loading | `next/node_modules/postcss@8.4.31` | Attacker-controlled previous source-map path or CSS source-map reference | No customer repository import, no external CSS source, no source-map upload, no raw CSS API | No identified path | Accepted residual risk for disposable verification only - no identified attacker-controlled CSS or source-map path |
| `GHSA-fxqj-rqcc-2cmp` - incomplete fix for attacker-controlled `sourceMappingURL` when `from` is unset | `next/node_modules/postcss@8.4.31` | Attacker-controlled CSS/source map processed by PostCSS with unsafe source-map loading behavior | No TeamFrame path inserts customer-controlled fields into CSS before PostCSS; no uploaded files are passed to PostCSS | No identified path | Accepted residual risk for disposable verification only - no identified attacker-controlled CSS or source-map path |

Source evidence:

- `postcss.config.mjs:1-5` loads only `@tailwindcss/postcss`.
- `app/globals.css:1-3` imports Tailwind and defines source-controlled theme tokens.
- `app/layout.tsx:3` imports only the source-controlled global stylesheet.
- `app` route inventory contains no CSS, source-map, theme, or external repository ingestion route.
- Search evidence found no `sourceMappingURL`, user CSS upload, theme upload, or raw CSS processing endpoint in application/service source.
- `next.config.ts:51-79` gates Sentry source-map upload on `SENTRY_AUTH_TOKEN`; this is upload of generated build artifacts, not customer-supplied CSS/source maps.

## Sharp advisory inventory and reachability

Installed vulnerable path:

- `next@15.5.22 -> sharp@0.34.5`

Advisory:

- `GHSA-f88m-g3jw-g9cj` - Sharp inherited vulnerabilities in libvips: `CVE-2026-33327`, `CVE-2026-33328`, `CVE-2026-35590`, `CVE-2026-35591`.

| Input source | Trusted or untrusted | Processed by Sharp? | Evidence | Risk decision |
| --- | --- | --- | --- | --- |
| Marketing dashboard screenshot | Trusted, source-controlled | Yes, through `next/image` optimisation path | `app/page.tsx:2-3` imports `next/image` and `@/public/marketing/dashboard-risk-signals.png`; `app/page.tsx:84-90` renders that imported static image; file exists at `public/marketing/dashboard-risk-signals.png` | Accepted residual risk for disposable verification only - trusted image input only |
| Remote image URL | Untrusted if accepted | No identified path | `next.config.ts:37-49` has no `images.remotePatterns`, remote loader, or unrestricted image host configuration | Accepted residual risk for disposable verification only - no identified untrusted image-processing path |
| Employee document upload, including `photo` document type | Untrusted upload | No identified Sharp path; stored in Supabase Storage as a document | `app/employees/actions.ts:529-564` passes the uploaded file to `uploadDocument`; `services/documentService/index.ts:117-156` allowlists document/image signatures; `services/documentService/index.ts:432-447` validates size, filename, MIME, and extension before buffering; `services/documentService/index.ts:687-700` uploads bytes to storage without Sharp | Accepted residual risk for disposable verification only - no identified untrusted image-processing path |
| Direct Sharp API usage | N/A | No | Source search found no `sharp` import or invocation outside `package-lock.json` and documentation text | Accepted residual risk for disposable verification only - no direct application Sharp usage |

## Temporary acceptance scope

The remaining PostCSS and Sharp findings are accepted only for:

- Clean local verification.
- Disposable Supabase verification.
- Synthetic employee data.
- Non-public testing.
- Temporary test deployments with no real users and no real customer data.

The acceptance does not permit:

- Production deployment.
- Customer data.
- Paid pilots.
- External demonstrations using sensitive data.
- Public launch.
- General release.
- Permanent security acceptance.

## Reassessment triggers

Reassess these findings:

- Before any paid pilot.
- Before production deployment.
- Before importing real employee data.
- When a patched supported Next.js 15 release becomes available.
- During a dedicated Next.js 16 migration assessment.
- If TeamFrame introduces user CSS, themes, source maps, remote images, avatars, logos, or image transformation.

## Future Next.js 16 decision

`next@16.3.0` is now a stable major release and declares newer PostCSS and Sharp dependency lines. TeamFrame is not migrating to Next.js 16 in this bounded pass because that is a framework-major change requiring its own regression programme.

A future decision must cover:

- Node.js runtime requirements.
- The Next.js 15-to-16 migration guide.
- Removed or changed APIs.
- Middleware/proxy changes.
- Build-system differences.
- App Router behaviour.
- Server Actions.
- Authentication callback handling.
- Sentry compatibility.
- ESLint configuration changes.
- Deployment platform support.
- Full functional regression testing.
- Disposable Supabase testing.
- Rollback plan.

The future decision must be one of:

1. Formally accept residual risk for a narrowly controlled managed pilot, supported by professional security review.
2. Execute a dedicated Next.js 16 migration and full regression programme.

No such production or paid-pilot decision is made here.
