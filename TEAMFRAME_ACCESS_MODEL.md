# TeamFrame Access Model

**STATUS: CANONICAL / INDEPENDENT CUSTOMER DEPLOYMENT MODEL**

This file governs TeamFrame production access, customer-local permissions, setup import and release handover.

Where older repository documents conflict with this file, this file controls unless explicitly superseded by a later product-owner decision.

## Production Operating Model

TeamFrame is independently deployable HR software.

Each customer installation is isolated:

```text
customer -> customer-controlled Vercel -> customer-controlled Supabase -> customer-owned TeamFrame installation
```

There is no central TeamFrame runtime/database containing all customer HR data, no global operator application spanning customers and no cross-customer switcher.

## Core Access Model

```text
auth identity -> local company membership -> profile -> effective access matrix -> authorized operation
```

Authentication proves who the user is. Database-backed membership and the effective access matrix decide what they may do in that customer installation.

Legacy JWT claims are compatibility fallback only.

```text
legacy admin -> Full Access
legacy employee -> Employee baseline
```

## Profiles

| Profile | Meaning | Default access |
| --- | --- | --- |
| Admin | People Operations operator | employee records, Org Chart, onboarding, leave, policies, offboarding, Control Centre, document workflow metadata |
| Finance | Payroll and finance handoff | compensation view, payment data and finance exports |
| Full Access | Highest in-product authority | all customer-local authority, including access settings and private employee files |
| Employee | Self-service baseline | own permitted profile, tasks, leave, policies and documents |

Full Access is the highest TeamFrame authority inside a customer installation. There is no in-product owner role above it.

## Effective Access Matrix

TeamFrame stores and evaluates effective access. It does not use a generic grant/deny/inheritance engine.

People Operations:

- None
- All
- Direct Reports
- Selected People
- All Except Selected People

Salary:

- Level: None / View / Manage
- Scope: All / Direct Reports / Selected People / All Except Selected People
- Manage implies View

Private Employee Documents:

- None
- All
- Selected People
- All Except Selected People

Finance / Payroll Exports:

- Yes / No

Manage Users & Access:

- Yes / No

No department permission scope, user-created role, rules DSL or explicit grant-vs-deny precedence engine is part of V1.

## Manager

Manager access is derived from the current reporting relationship.

```text
Own Team = current direct reports only
```

It is not recursive and is not a manually assigned base role. Reporting changes update derived manager authority automatically.

Manager default access:

- People Operations: Direct Reports
- Salary: View / Direct Reports

Managers do not automatically receive private documents, finance exports, policy administration, Org Chart administration, company settings, compensation-change authority or employment-change authority.

## Custom Access

Custom means the effective matrix differs from a standard preset or derived default. It is not another security role.

## Access-Only Users

Memberships are independent of employee records:

```text
auth user -> company membership -> zero/one employee link
```

External accountants, consultants and outsourced HR operators may have access without becoming employees, headcount, leave users, onboarding participants or Org Chart members.

## Sensitive Data

Salary visibility and salary-change authority are separate.

- Manager: view direct-report salary by default; cannot change compensation.
- Finance: view payroll-relevant compensation and payment data; cannot change source compensation by default.
- Full Access: view and manage compensation.
- Custom: according to effective matrix.

Private employee documents fail closed. Workflow metadata may be visible to People Operations, but opening, downloading or exporting restricted files requires self-access, Full Access or explicit Private Documents access.

Payment/bank information is separate from People Operations. Default access:

- Employee: own information.
- Finance: allowed.
- Admin: denied.
- Manager: denied.
- Full Access: allowed.

## Company Configuration

The intentionally small company configuration is:

- Company Name
- Country
- Location
- Default Timezone
- Default Working Days
- Company Holidays
- Annual Leave Default
- Sick Leave Default where supported
- Employee Number Format

Manual holidays are company-specific. TeamFrame does not auto-populate holidays from country, jurisdiction, statutory rules or external feeds.

## Initial Customer Setup

Initial customer migration uses installer-side workbook/scripts, not an in-product enterprise bulk-import platform.

Canonical workbook sheets:

- Company
- People
- Holidays
- Access Exceptions

Installer flow:

```text
validate -> preview -> provision/apply -> import -> create/recover Full Access -> verify -> handover report
```

Setup packs stage pending access invitations instead of fake auth identities. Existing employees imported during setup normally enter as `ACTIVE` and do not receive artificial new-starter automation. New/future starters use the locked lifecycle and normal automation.

Opening annual leave used is stored as opening migration state, not fake leave history.

## Full Access Recovery

If an installation would otherwise have no functioning Full Access user, a legitimate operator with direct customer infrastructure authority may run the local recovery utility:

```text
npm run access:bootstrap
```

This is not a remote backdoor, does not create cross-customer access and does not introduce a permanent product role above Full Access.

## 48-Hour Objective

Forty-eight hours is an implementation process objective, not a customer-facing TeamFrame feature. Do not build in-product SLA timers, setup countdowns, central provisioning dashboards or handover dashboards.

The operational promise is:

```text
A complete customer TeamFrame installation can be operational within 48 hours after a complete usable setup pack and necessary customer infrastructure/account access are available.
```

The installer handover report is sufficient evidence.

## Production Gates

Before production migrations:

- create a fresh logical production database backup/export;
- verify completion;
- store it securely outside the repository;
- record timestamp, source project and restore procedure.

Before real customer HR data enters production:

- provider-managed daily backups must be enabled on the production Supabase project;
- if the project is on a tier without provider-managed daily backups, upgrade before first real customer activation.

Real external mailbox invitation/magic-link round trip is a customer activation gate, not a deployment blocker.
