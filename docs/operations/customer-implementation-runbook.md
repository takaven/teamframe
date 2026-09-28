# Customer implementation runbook

This is the maintained internal path for a standard TeamFrame customer implementation. It replaces one-off code harnesses. It does not install the database, create Production infrastructure, or bypass TeamFrame permissions.

Environment selection and deployment authority are governed by [ENVIRONMENTS.md](ENVIRONMENTS.md), [ACCOUNT-OWNERSHIP.md](ACCOUNT-OWNERSHIP.md), and [DEPLOYMENT.md](DEPLOYMENT.md). A project appearing in a historical allowlist is not enough to authorise a run.

## Required starting state

- Use a reviewed, allowlisted project recorded in `docs/launch/environment-parity.md`.
- Confirm its current status in `docs/operations/ENVIRONMENTS.md`; historical evidence does not make a paused, quarantined, or retired target write-eligible.
- Complete the canonical fresh database and private Storage installation first.
- Bootstrap exactly one Full Access implementation operator and one empty company workspace.
- Confirm the project contains no employee, configuration, file, or invitation data beyond that bootstrap identity.
- Keep the database URL and service-role key process-only. Never save them in the pack or repository.

## 1. Prepare one implementation pack

Prepare one JSON file with these top-level fields:

- `setupPack`: the existing canonical `companyCsv`, `employeesCsv`, optional `usersCsv`, `holidaysCsv`, and `accessExceptionsCsv` payloads;
- `departments`;
- `workLocations`;
- `positions` (stable pack key, optional parent key and employee email);
- `leaveDefinitions`;
- optional `onboarding` template and tasks;
- `documentRequirements`;
- `policies`.

The employee CSV column order is the canonical order already enforced by `customerProvisioningService.ts`. The operator command does not create a second employee/import model.

Use `docs/operations/customer-implementation-pack.example.json` as the maintained shape reference. CSV rows do not contain a header. Their exact columns are:

- company: name, country, location, annual leave default, sick leave default, timezone, working days, employee-number prefix, separator, digits, next number;
- employee: employee number, name, preferred name, work email, personal email, mobile, address, date of birth, nationality, title, department, manager email, start date, employment type, starter type, work location, country, working-days override, annual entitlement override, opening annual used, emergency name, relationship, phone, salary, currency, pay basis, bank, account holder, IBAN/account, routing code, SWIFT/BIC, account currency, emergency email;
- user: name, email, employee-linked (`yes`/`no`), access profile;
- holiday: ISO date, name;
- access exception: user email, people scope, salary level, salary scope, private-document scope, finance-export access, manage-users access, selected employee email.

## 2. Validate and preflight

Set the credentials only in the current process, then run:

```text
npm run customer:implement -- --preflight --pack <absolute-pack.json> --tenant-id <exact-company-uuid> --confirm-workspace <exact-company-slug>
```

Required process values:

- `TEAMFRAME_IMPLEMENTATION_PROJECT_REF=<exact-ref>`
- `TEAMFRAME_IMPLEMENTATION_CONTEXT=synthetic-customer-rehearsal` for synthetic rehearsal work
- `TEAMFRAME_IMPLEMENTATION_APPROVAL=preflight:<ref>:<tenant-id>`
- `TEAMFRAME_IMPLEMENTATION_DB_URL=<matching process-only postgres URL>`
- `NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY=<matching process-only key>`

The command must end with `IMPLEMENTATION READY`. It refuses non-allowlisted or mismatched targets, non-canonical schemas, dirty workspaces, missing private Storage, invalid countries/timezones/dates/employment types, duplicates, unknown departments/locations/managers, and reporting cycles.

Do not replace this command with a temporary HTTP helper, browser-only harness, direct SQL sequence, or one-off script. If the maintained path cannot complete, stop and fix or classify the maintained path itself.

## 3. Execute once

Change only the approval value to `execute:<ref>:<tenant-id>` and run the same command with `--execute`:

```text
npm run customer:implement -- --execute --pack <absolute-pack.json> --tenant-id <exact-company-uuid> --confirm-workspace <exact-company-slug>
```

The command reports each stage: organisation, leave, onboarding, policies, people, positions, documents, access and reconciliation. Do not interrupt it merely because employee import is the longest stage.

## 4. Read the result

Success prints `IMPLEMENTATION COMPLETE` with the company, requested/created/rejected employees, configuration counts, invitations/memberships and reconciliation result.

If execution fails, stop. The command prints the failed stage, partial counts and the safe next action. Do not rerun blindly and do not manually repair rows. Inspect and reconcile the target first; quarantine it if the state is not fully understood.

## 5. Complete browser QA and handover

Use the real deployed application and synthetic/customer-approved identities to verify:

1. Full Access: Home, People, one employee record, Settings, Documents, Policies, Time off and exports.
2. Manager: direct-report scope, one leave decision, one manager onboarding task and one probation recommendation.
3. Employee: own Home/Me, document upload, policy acknowledgement and own leave state.
4. Finance: the dedicated Exports destination and payroll export only; no general Reports or Admin surfaces.
5. Reconcile displayed headcount, departments, locations, managers and key workflow counts with the implementation result.

Record elapsed, hands-on, waiting and rework time separately. A two-business-day claim is supported only when this maintained path completes without temporary code, direct SQL, or developer intervention.
