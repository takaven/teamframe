# Vercel Preview Deployment Proof - 2026-08-06

Status: **PASS** for isolated non-production Preview verification with
synthetic data.

This is not a production deployment, paid-pilot approval, customer-data
approval, or monetisation approval.

## Scope

The proof used the personal Vercel account requested by Ismael, not the company
account.

- Vercel scope: `ismaelloveexcels-projects`
- Project: `teamframe`
- Git branch: `codex/reconcile-local-main`
- Preview deployment:
  `https://teamframe-goqs72yph-ismaelloveexcels-projects.vercel.app`
- Stable Preview alias:
  `https://teamframe-ismaelloveexcel-ismaelloveexcels-projects.vercel.app`
- Disposable Supabase project: `lrssimflgvhfdgrdkbnz`
- Data class: synthetic only

## Account-Control Evidence

An earlier disposable TeamFrame project was created under the company Vercel
account before the account direction was corrected. It was deleted. A later
new disposable personal project also produced an initial Production deployment
because Vercel treats the first deployment of a new project as Production. That
project was deleted as well and was not used for this proof.

The accepted proof used the existing personal `teamframe` project and a
branch-scoped Preview deployment. No Production deployment was promoted during
the accepted verification path.

## Environment Isolation

The Preview deployment was configured with branch-scoped Preview overrides for
`codex/reconcile-local-main` only. These values pointed to the disposable
Supabase project and were removed after the verification run.

Temporary Vercel automation protection bypass was enabled only to allow
non-browser verification requests against the protected Preview deployment. It
was disabled after the checks.

## Runtime Checks

Evidence files are stored outside the repository under:

`C:\Users\isuda\Dev\TeamFrame-hardening-evidence\operational-closure-2026-08-05`

Verified behaviours:

- Vercel Preview build completed successfully on Next.js `15.5.22`.
- `/api/health` returned HTTP `200` with shallow public status.
- `/api/health/deep` rejected requests without the TeamFrame header secret.
- `/api/health/deep?secret=bad` rejected query-string secret usage.
- `/api/health/deep` returned HTTP `200` with redacted subsystem status when
  called with the header secret.
- `/auth` returned HTTP `200`.
- `/admin/login` returned HTTP `200`.
- Supabase employee magic-link generation succeeded against the Preview
  callback URL.
- `/auth/callback` exchanged the generated token, redirected to `/me`, and set
  a session cookie.

## Limitations

The proof did not configure custom SMTP. Email delivery customisation remains a
separate operational requirement before real employee use.

The signed private Storage object behaviour was proven during disposable
restore verification and through the same disposable Supabase project. No real
employee files or production Storage buckets were used.

## Cleanup

- Company TeamFrame disposable Vercel project: deleted.
- Personal disposable new-project attempt: deleted.
- Branch-scoped Preview environment overrides on personal `teamframe`: removed.
- Temporary Vercel protection bypass: disabled.
- Local Vercel CLI link state remains ignored by `.gitignore` and is not source
  evidence.
