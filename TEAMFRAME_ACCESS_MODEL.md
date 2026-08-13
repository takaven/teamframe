# TeamFrame Access Model

**STATUS: CANONICAL / PRODUCTION ACCESS MODEL**

This file governs TeamFrame production access, Platform Owner authority, customer permissions and fast customer provisioning.

Where older repository documents conflict with this file, this file controls unless explicitly superseded by a later product-owner decision.

## Core Model

TeamFrame access is:

```text
auth identity -> company membership -> profile -> capability/scope rules -> effective access
```

Authentication proves who the user is. Database-backed membership and access rules decide what they can do right now.

Do not depend on long-lived JWT claims as the only source of tenant authority.

## Production Operating Model

TeamFrame production is operated as a multi-company application with database-backed customer memberships, tenant isolation and an internal Platform Owner Control Room.

`teamframe-production` is the production application. Customer companies are separate tenant workspaces inside that application, not separate products created through a GitHub or infrastructure workflow.

## Platform Owner

Platform Owner is an internal platform operator identity.

Platform Owner:

- is not a customer employee;
- does not create a company membership by default;
- does not appear in headcount, Org Chart, Who's Away, policy denominators, onboarding, offboarding or exports;
- has unrestricted application authority across TeamFrame customer companies after MFA/AAL2 verification;
- remains auditable as Platform Owner, not as an impersonated customer admin.

Platform Owner access requires TOTP MFA and AAL2 for `/platform`, Platform Owner transfer/recovery and privileged deployment-owner operations.

The real Platform Owner account must not be activated until TOTP enrollment and AAL2 login are verified.

Platform Owner transfer must be possible through the product's dedicated handover mechanism. Do not require direct database editing to transfer platform ownership.

## Customer Profiles

Profiles are shortcuts, not hard-coded security roles.

| Profile | Meaning | Default access |
| --- | --- | --- |
| Admin | Company-wide People Operations | employee records, Org Chart, onboarding, leave, policies, offboarding, Control Centre, document workflow metadata |
| Finance | Finance/payroll handoff | compensation view and finance exports |
| Full Access | Everything inside one company | People Ops, compensation manage, private documents, finance exports, company/access settings |
| Employee | Self-service baseline | own permitted profile, tasks, leave, policies and documents |

Legacy migration rule:

```text
legacy admin -> Full Access
legacy employee -> Employee baseline
```

This preserves existing administrator authority before any deliberate reduction.

## Manager

Manager access is derived from the current reporting relationship.

```text
Own Team = direct reports only
```

It is not recursive and is not a third customer role.

Managers may see and act only where the product has explicitly delegated operational work for direct reports. Managers may view direct-report salary by default, but they do not automatically receive private documents, finance exports, policy administration, Org Chart administration, company settings, source compensation-change authority or employment-change authority.

## Custom Access

Custom Access means a standard profile plus explicit exceptions.

Capabilities:

- People Operations
- Compensation View
- Compensation Manage
- Private Employee Documents
- Finance / Payroll Exports
- Company & Access Settings

Scopes:

- Whole Company
- Own Team
- Department
- Selected People

Precedence:

1. tenant suspension or closure denies ordinary tenant operation;
2. Platform Owner is unrestricted across TeamFrame customer companies after MFA/AAL2;
3. employee self-service baseline applies to own permitted records;
4. explicit restriction wins;
5. explicit allow applies;
6. standard profile applies;
7. derived direct-report manager access applies;
8. otherwise deny.

## Sensitive Data

Salary visibility and salary-change authority are separate.

- Manager: view direct-report salary by default; cannot change compensation.
- Finance: view payroll-relevant compensation; cannot change source compensation by default.
- Full Access: view and manage compensation.
- Platform Owner: view and manage compensation across TeamFrame customer companies.
- Custom Access: may explicitly grant or restrict compensation view/manage.

Private employee documents fail closed. Workflow metadata may be visible to People Ops, but opening/downloading/exporting restricted files requires self-access, Full Access, Platform Owner or explicit Private Documents access.

Finance handoff exports require Finance Exports access.

## Customer Membership

Memberships are independent of employee records:

```text
auth user -> company membership -> zero/one employee link
```

Company switching is allowed only for authenticated users with authoritative memberships in more than one customer company. Platform Owner can open any customer workspace through `/platform` without becoming a customer employee or tenant member.

## Customer-Owned Setup / 48-Hour Handover

TeamFrame supports three setup paths:

- guided customer setup;
- structured setup-pack import;
- Platform Owner assisted setup.

All paths must produce the same canonical company, employee, membership and access model.

Setup-pack flow:

```text
Upload -> Parse -> Validate -> Error report -> Preview -> Confirm -> Commit
```

Invalid packs must fail before customer tenant creation where practical. Commit should be atomic or use bounded compensating cleanup. Real auth memberships are created only when real auth users exist; setup packs stage pending access invitations instead of fake auth identities.

Existing employees imported during setup normally enter as `ACTIVE` and must not receive inappropriate new-starter automation. New/future starters use the locked lifecycle and normal automation.

Opening annual leave used is stored as opening migration state, not fake leave history.

## Production Gates

Before production migrations:

- create a fresh logical production database backup/export;
- verify completion;
- store it securely outside the repository;
- record timestamp, source project and restore procedure.

Before real customer HR data enters production:

- provider-managed daily backups must be enabled on production Supabase;
- if the project is on a tier without provider-managed daily backups, upgrade before first real customer activation.

Real external mailbox invitation/magic-link round trip is a customer activation gate, not a deployment blocker.
