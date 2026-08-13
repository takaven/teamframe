# TEAMFRAME — MARKET-READY CANONICAL SCOPE
## Governing Product Definition for Market-Ready Implementation

**STATUS: CANONICAL / CONTROLLING**
**Purpose:** Record the market-ready TeamFrame product scope that has now been implemented and release-verified.
**Audience:** Product owner, Codex, engineering reviewers, QA/release reviewers.
**Important:** Where older repository documents conflict with this file, this file controls unless explicitly superseded by a later product-owner decision.

---

# 1. CANONICAL PRODUCT DEFINITION

> **TeamFrame is the essential HR system for startups without a dedicated HR team.**

It gives founders and small teams the essential tools to manage everyday HR responsibilities simply, correctly and consistently — without the complexity of traditional HR software.

The product hierarchy is:

1. **Basic HR administration = the product**
2. **Signal → Action → Resolution = an operating mechanism**
3. **Readiness, evidence and auditability = supporting outcomes**

TeamFrame is not primarily:

- a compliance platform;
- a readiness platform;
- an evidence platform;
- a policy-acknowledgement product;
- a workflow engine;
- an enterprise HRIS.

Technical verification: **COMPLETE**.
Baseline: `489c9606441618e898f21eafb0443a9ca33474ad`.
Final technical verdict: controlled extension, no rewrite required.
Product-scope reconciliation: **COMPLETE**.
Market-ready implementation: **COMPLETE**.
Final full-system E2E: **COMPLETE**.
Final visual production-readiness: **COMPLETE**.
Current phase: production release preparation and deployment against `TEAMFRAME_PRODUCTION_RUNBOOK.md`.

---

# 2. TARGET CUSTOMER

Initial target:

- founder-led startups and small businesses;
- approximately **5–25 employees**;
- no dedicated HR team;
- primarily salaried / knowledge-worker businesses.

Typical examples:

- SaaS;
- fintech;
- professional services;
- consultancy;
- agencies;
- similar office-based startups and small businesses.

TeamFrame should not initially optimise for:

- shift-heavy hospitality;
- manufacturing;
- complex hourly workforces;
- multi-location time-and-attendance operations.

Those use cases require scheduling, timeclock and overtime complexity that is outside the initial product scope.

---

# 3. PRODUCT OPERATING PRINCIPLE

TeamFrame should follow:

> **Capture once → trigger automatically → propagate automatically → remind automatically → close automatically where evidence permits → escalate only when human judgement is required.**

The founder should primarily spend time on:

- decisions;
- approvals;
- exceptions;
- sensitive employee matters;
- professional judgement.

The founder should not repeatedly spend time on:

- remembering routine HR actions;
- chasing employees;
- recreating data;
- manually propagating information between modules;
- manually calculating obvious dates;
- manually closing tasks where TeamFrame already has proof of completion;
- checking several modules to understand one employee's state.

---

# 4. PROFESSIONAL SIMPLICITY

TeamFrame must feel like a professional executive HR work queue, not a tutorial or consumer productivity app.

Language should be:

- concise;
- adult;
- specific;
- factual;
- operational.

Avoid:

- cheerleading;
- childish progress language;
- patronising explanations;
- unnecessary conversational copy;
- vague success/failure states.

Preferred pattern:

> **Probation review due in 7 days**
> Daniel Reyes · Software Engineer
> Owner: Sara Founder
> **Review**

---

# 5. CANONICAL EMPLOYEE LIFECYCLE

Market-ready implementation must express one authoritative lifecycle projection.

The intended conceptual model is:

> **PRE-START → ONBOARDING → ACTIVE → OFFBOARDING → FORMER**

The implementation does not have to use these exact enum names if the current architecture already supports the same truth safely.

However, market-ready TeamFrame must avoid competing independent status models that allow contradictory states.

Lifecycle state must correctly influence:

- active employee counts;
- onboarding;
- policy assignment and denominators;
- reminders;
- leave;
- employee self-service;
- Org Chart;
- offboarding;
- exports;
- dashboard work;
- archive/former-employee behaviour.

A future-dated employee should not be treated identically to a fully active employee.

A former employee must not continue generating normal active-HR obligations.

---

# 6. MARKET-READY CORE CAPABILITIES

## 6.1 COMPANY SETUP

A new paying customer must be able to initialize TeamFrame without developer intervention.

Keep this minimal and guided, not a large Settings system.

Minimum direction:

- company identity;
- country/location;
- administrator;
- basic workweek or relevant defaults where required;
- simple leave defaults;
- initial organisational structure;
- first employees.

The preferred experience is a guided setup flow.

---

## 6.2 PEOPLE

TeamFrame must maintain an authoritative employee/contractor record.

Core information includes, where relevant:

- legal/preferred name;
- contact details;
- emergency contact;
- employment type;
- lifecycle/status;
- start date;
- end date;
- probation information;
- manager/reporting relationship;
- position;
- department;
- location;
- work arrangement;
- contract type;
- relevant compensation basics if required by payroll handoff;
- employment history / effective-dated changes.

Employment changes must not silently overwrite history.

---

## 6.3 ORGANISATION

Core Org capability:

- positions;
- reporting structure;
- filled/vacant state;
- employee assignment;
- job-description attachment;
- unassigned employees;
- position vacancy on departure/archive.

Do not expand into:

- ATS;
- recruiting pipeline;
- succession planning;
- advanced workforce planning.

Employee, position and reporting data should remain synchronized without duplicate maintenance.

---

## 6.4 ONBOARDING / JOIN

TeamFrame must support repeatable onboarding.

Core:

- onboarding packs/templates;
- automatic or strongly inferred pack assignment from known employee data;
- task ownership;
- due dates;
- employee/admin/manager tasks where appropriate;
- policy assignment;
- document requirements;
- first-day readiness;
- reminders;
- overdue escalation;
- evidence-backed completion.

Preferred behavior:

> employee created
> → appropriate onboarding generated automatically
> → due dates calculated
> → tasks assigned
> → employee invited
> → required documents requested
> → policies assigned
> → founder sees only decisions/exceptions.

Do not blindly create organisation positions from free-text job titles without confirmation.

---

## 6.5 30-DAY ONBOARDING CHECK-IN

This is **approved market-ready core scope**.

Purpose:

> **Did onboarding actually work for the employee?**

Not:

> **How good is this employee?**

Expected lightweight flow:

> employee starts
> → approximately 30 days elapse
> → short employee onboarding evaluation/check-in issued automatically
> → employee completes it
> → only material issues create manager/founder follow-up.

The employee check-in should remain short and practical.

Example topics:

- role clarity;
- manager/team clarity;
- tools/access;
- training;
- policy understanding;
- support/help;
- blockers;
- what could improve.

Do not turn this into performance management.

---

## 6.6 PROBATION

This is **approved market-ready core scope**.

Expected basic flow:

> probation end date known
> → review opens automatically at the appropriate time
> → reminders are generated
> → human outcome is recorded
> → employment history/lifecycle updates.

Human judgement must remain human.

Do not build:

- ratings matrices;
- competencies;
- 360 reviews;
- performance cycles.

---

## 6.7 DOCUMENTS

Documents are a first-class core capability.

Market-ready loop:

> document required
> → employee sees request
> → employee uploads permitted document
> → TeamFrame stores and categorises it securely
> → requirement closes automatically when evidence is valid
> → reminders stop
> → expiry is monitored
> → replacement can satisfy renewal requirement
> → history remains.

Core:

- secure private storage;
- categories;
- employee/admin permissions;
- employee upload where appropriate;
- admin upload;
- document request/requirement object;
- expiry dates;
- reminders;
- replacement/history;
- evidence-linked task completion.

A task such as “Upload signed NDA” must not be completable merely through “Mark done” when no NDA exists.

---

## 6.8 POLICIES

Policies remain one component of TeamFrame, not the product identity.

Canonical operating model:

> **HYBRID — file upload is the normal path; simple in-app authoring may remain.**

Normal path:

> policy prepared externally
> → PDF/DOCX uploaded
> → title/version/effective date recorded
> → published
> → relevant employees assigned
> → acknowledgement requested
> → reminders/escalation
> → historical version retained.

Core:

- upload/create;
- versioning;
- publish;
- distribution;
- version-specific acknowledgement;
- reminders;
- archived-history retention;
- active obligations filtered correctly.

Archived versions may preserve historical acknowledgement evidence but must not generate active obligations.

Former employees must not contaminate current acknowledgement counts.

---

## 6.9 LEAVE

Basic leave administration is **market-ready core**.

Core:

- leave type;
- simple entitlement/allocation;
- current balance;
- employee request;
- date validation;
- overlap/conflict detection;
- approval/decline;
- durable leave/absence history;
- employee visibility.

Preferred behavior:

> request submitted
> → deterministic validation runs
> → correct approver receives it
> → human decides
> → leave history/balance updates automatically
> → relevant downstream information updates.

Core balance can remain simple.

Do not build for launch:

- advanced accrual engines;
- complex carry-forward;
- jurisdiction-specific statutory leave logic;
- time and attendance;
- shift scheduling.

A lightweight “Who’s Away” view is useful but may remain secondary if the core absence record is correct.

---

## 6.10 EMPLOYMENT CHANGES

Common changes should be structured HR events rather than silent field overwrites.

Examples:

- manager;
- position;
- employment type;
- location;
- department;
- work arrangement;
- compensation where relevant;
- contract;
- promotion.

Requirements:

- effective date;
- previous value/history;
- downstream propagation;
- appropriate audit history.

Human approval remains human.

---

## 6.11 LIGHTWEIGHT MANAGER DELEGATION

TeamFrame must be viable up to approximately 25 employees without every routine action terminating at the founder.

Market-ready scope includes bounded direct-report operational delegation.

Preferred direction where feasible:

> employee → occupied position → reporting position → manager

Potential manager responsibilities:

- leave approval;
- onboarding contribution;
- probation input;
- routine team follow-up.

Do not build:

- complex enterprise RBAC;
- multi-level workflow builders;
- elaborate approval hierarchies.

---

## 6.12 OFFBOARDING

Offboarding is **market-ready core**.

Expected trigger:

> resignation / termination / departure recorded

Then TeamFrame should support the minimum essential exit workflow:

- end date;
- notice/final HR information;
- final leave/payroll inputs where relevant;
- handover;
- access-removal checklist;
- asset return as a checklist item, not an asset-management module;
- final documents;
- Org Chart vacancy;
- suppression of inappropriate future reminders;
- archive/former transition;
- historical record retention.

Human departure/termination decisions remain manual.

Routine follow-up should be generated automatically.

---

## 6.13 HR CONTROL CENTRE

The founder needs one trustworthy operational view of HR work.

It should surface:

- due/overdue work;
- approvals;
- probation;
- onboarding;
- document expiry;
- policy exceptions;
- offboarding;
- meaningful employee lifecycle exceptions.

Signal → Action → Resolution remains useful as the operating mechanism, but not every routine item needs to become a Signal.

Distinguish:

- normal task;
- due soon;
- overdue;
- decision;
- exception.

Avoid noise.

Resolution/history must remain durable and truthful.

---

# 7. AUTOMATION AND REMINDER MODEL

Technical architecture is not frozen yet.

Codex must inspect current primitives before recommending architecture.

Product behavior must nevertheless support:

> Event → Rule → Action → Owner → Due date → Reminder → Escalation → Completion condition

Where appropriate.

The system should favor:

### SILENT BACKGROUND
For normal propagation, recalculation and automatic closure.

### ROUTINE REMINDER
Employee/manager reminder without founder involvement.

### ESCALATION
Founder/manager sees persistent non-response or meaningful risk.

### DECISION
Human judgement is required.

Do not replace manual work with notification noise.

---

# 8. COMPLETION TRUTH

TeamFrame must distinguish:

## EVIDENCE-VERIFIABLE COMPLETION

Examples:

- document uploaded;
- policy acknowledged;
- required form submitted;
- required data completed.

The system should close these automatically when the evidence exists.

## HUMAN-CONFIRMABLE COMPLETION

Examples:

- welcome meeting held;
- handover meeting completed;
- verbal discussion conducted.

Human confirmation is acceptable.

Manual completion must not be used as a substitute for evidence TeamFrame can verify itself.

---

# 9. RELIABILITY AND PRODUCT TRUTH

Market-ready TeamFrame must never make the founder guess whether an action succeeded.

Known behaviors requiring technical verification/repair include:

- actions returning 503 while mutations may have persisted;
- export failures;
- ambiguous success/failure;
- stale counters;
- archived employee contamination;
- disappearing Resolution history;
- false-success vacant-position deletion.

Specific known reliability item:

> **TF-BUG-001 — Vacant position deletion reports success while the position remains.**

This is a browser-observed reliability finding requiring runtime-regression verification against the current implementation. If reproduced on the current implementation, it becomes a release-blocking correctness defect.

---

# 10. PAYROLL / FINANCE HANDOFF

TeamFrame must not become a payroll engine.

A finance handoff export already exists and must be technically verified before expanding scope.

The product may automatically compile payroll-relevant HR changes where useful, such as:

- starters;
- leavers;
- employment changes;
- salary changes if salary data exists within approved scope;
- unpaid leave where identifiable.

The founder/accountant reviews or exports the handoff.

Do not build:

- payroll calculation;
- tax calculation;
- statutory filing;
- full compensation management;
- bonuses/reimbursements/overtime workflows unless separately approved.

---

# 11. EXPLICITLY DEFERRED / OUT OF SCOPE

Do not build for the market-ready release:

- ATS/recruiting pipeline;
- offer management;
- payroll calculation/tax filing;
- global payroll engine;
- benefits administration/brokerage;
- advanced performance management;
- ratings;
- goals;
- 360 reviews;
- engagement surveys;
- LMS;
- succession planning;
- workforce forecasting;
- shift scheduling;
- timeclock/time-and-attendance;
- advanced leave accrual/carry-forward engines;
- complex compensation management;
- reimbursements;
- overtime management;
- standalone asset-management module;
- global legal/compliance rule engine;
- AI legal conclusions;
- enterprise workflow builder;
- complex approval hierarchy;
- advanced analytics/report builder;
- broad configuration/settings maze.

---

# 12. DESIGN / BRAND STATUS

The current approved visual direction remains frozen.

Do not reopen:

- Direction B / Signature Signal;
- current brand palette;
- green-scarcity principle;
- Org Chart visual direction;
- general typography/component system.

Only make UI changes required to support approved functionality, truthful state, accessibility or operational clarity.

This market-ready programme is not a redesign exercise.

---

# 13. MARKET-READY ROOT WORKSTREAMS

The current product scope is organized into these root workstreams.

These are product workstreams, not assumed technical architecture.

## MR-0 — GUIDED COMPANY SETUP
- company identity;
- country/location;
- administrator;
- basic defaults;
- initial organisation structure;
- first employees through the canonical lifecycle.

## MR-1 — COMPANY & EMPLOYEE LIFECYCLE
- lifecycle truth;
- pre-start/onboarding/active/offboarding/former;
- end-date/archive semantics;
- active-work filtering.

## MR-2 — HR EVENT & AUTOMATION
- propagation;
- scheduled actions;
- reminders;
- escalation;
- completion conditions.

## MR-3 — PEOPLE / ORGANISATION / DELEGATION
- authoritative people record;
- positions;
- reporting;
- manager linkage;
- employment-change history;
- lightweight manager routing.

## MR-4 — JOIN / EARLY EMPLOYMENT
- automatic onboarding;
- document requirements;
- 30-day evaluation;
- probation.

## MR-5 — DOCUMENTS & POLICIES
- document request/upload/expiry/completion;
- policy upload/editor hybrid;
- versioning;
- acknowledgement/reminders.

## MR-6 — LEAVE
- type;
- simple allocation/balance;
- conflict detection;
- approval;
- durable absence/history.

## MR-7 — OFFBOARDING
- end date;
- generated exit work;
- relevant handover/access/asset checklist;
- final HR actions;
- archive transition.

## MR-8 — RELIABILITY & PRODUCT TRUTH
- 503 ambiguity;
- exports;
- counters;
- durable Resolution/history;
- archived contamination;
- false-success deletion;
- deterministic error handling.

---

# 14. MARKET-READY FINISH LINE

TeamFrame is market-ready when a new target startup can:

1. create/setup its company without developer intervention;
2. add employees;
3. maintain the authoritative employee and organisation record;
4. onboard employees;
5. collect required documents;
6. distribute and track policies;
7. manage basic leave;
8. handle 30-day and probation milestones;
9. record normal employment changes;
10. offboard employees;
11. delegate appropriate routine manager actions;
12. rely on TeamFrame to automatically handle predictable follow-up;
13. trust that displayed states, history, exports and completion are correct.

The founder should mainly perform:

> **decisions and exceptions**

rather than:

> **routine HR administration.**

The system should be usable without the TeamFrame team manually configuring, explaining or repairing ordinary customer workflows.

---

# 15. GOVERNANCE FOR PRODUCTION PHASE

## Technical verification

Technical verification is complete at baseline `489c9606441618e898f21eafb0443a9ca33474ad`.

## Scope reconciliation

Product-scope reconciliation is complete. The current governing set is:

- `TEAMFRAME_MARKET_READY_SCOPE.md`;
- `TEAMFRAME_MARKET_READY_EXECUTION_REGISTER.md`;
- `TEAMFRAME_AUTOMATION_REGISTER.md`;
- `TEAMFRAME_DEFERRED_SCOPE.md`;
- `TEAMFRAME_RELEASE_READINESS.md`.

## Implementation

Bounded workstreams MR-0 through MR-8 have been implemented, verified, reviewed and locked.

Future source changes should now be driven by:

- production defects;
- customer feedback;
- separately approved product development.

Do not reopen the market-ready scope merely because an additional HRIS feature is useful or common elsewhere.

---

# 16. CONTROLLING PRINCIPLE

> **A founder enters the HR fact once. TeamFrame handles the predictable administration around it automatically and professionally, keeps the record truthful, and interrupts the founder only when a real decision or exception requires human judgement.**

That is the market-ready TeamFrame product.
