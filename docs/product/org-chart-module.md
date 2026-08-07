# Org Chart Module

Status: founder-approved bounded V1 exception.

## Purpose

Org Chart lets a founder design the intended team structure before every role is filled. The module answers:

- Which positions exist?
- Who reports to whom?
- Which positions are filled?
- Which positions are vacant?
- Which positions have a job description attached?

It supports the product sequence:

> Design the Team -> Fill Positions -> Manage Employee Readiness -> Signal -> Action -> Resolution

## Position Concept

The module is position-first. A position exists independently of an employee.

Example:

```text
Managing Director
  Head of Operations
    Operations Coordinator
```

Reporting relationships are between positions, not directly between employees. Employees may be assigned to positions, but the position survives turnover.

## Filled And Vacant

Position status is derived from assignment:

- `Filled`: an active employee is assigned.
- `Vacant`: no active employee is assigned.

A vacant position is not a recruiting workflow. It only means the intended structure contains a role that is not currently occupied.

## Assignment Rules

- One position can have zero or one active assigned employee.
- One active employee can occupy zero or one active position.
- Vacating a position does not delete the employee.
- Archiving or deleting an employee does not delete the position.

## Reporting Hierarchy

Each position can report to one parent position or be top-level.

The database rejects:

- self-reporting positions;
- circular reporting chains;
- cross-tenant parent positions.

The chart is a visualisation. Reporting changes are made through normal forms.

## Job Description Attachment

The job description is a private file attachment, not an editor field.

Supported file types:

- PDF
- DOCX

The attachment uses the existing private storage and file lifecycle model:

- size checked before buffering;
- zero-byte files rejected;
- MIME type and extension checked;
- basic file signature checked;
- server-controlled tenant-scoped storage path;
- durable file operation record;
- private signed URL for admin download.

## Permissions

Admins may:

- view the organisation structure;
- create and edit positions;
- change reporting relationships;
- assign and vacate employees;
- upload, replace, remove and download job descriptions;
- open the assigned employee record.

Employees have no Org Chart editing permissions.

## Tenant Protections

Position records are tenant-scoped. Composite tenant relationships protect:

- position to parent position;
- position to assigned employee.

RLS permits only tenant admins to read and mutate positions. Service-role mutations still pass explicit tenant context.

## Audit Events

The module records audit evidence for:

- position creation;
- position update;
- reporting relationship change;
- employee assignment;
- position vacation;
- job description upload;
- job description replacement;
- job description removal.

Database-only mutations use transactional RPCs. Storage-backed JD changes use file lifecycle compensation rather than claiming full database/storage atomicity.

## Deletion Rule

Hard deletion is intentionally conservative. A position can only be removed when it is:

- vacant;
- childless;
- not already deleted;
- without a job-description attachment.

Otherwise the position should be edited or vacated instead.

## Non-Goals

Org Chart does not add:

- recruiting or ATS workflows;
- candidates;
- headcount budgeting;
- salary bands;
- compensation planning;
- workforce forecasting;
- succession planning;
- employee review or rating workflows;
- matrix or dotted-line reporting;
- scenario modelling;
- drag-and-drop restructuring;
- AI job-description generation.
