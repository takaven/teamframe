# TEAMFRAME — FINAL 45-DAY MULTI-AGENT EXECUTION PLAN

**Status:** LOCKED FOR EXECUTION
**Execution model:** Main Orchestrator + specialist agents
**Founder role:** Strategic and material-risk approvals only
**Launch target:** Day 45
**Commercial exposure begins:** Days 15–21
**Feature freeze:** Day 21
**Public launch decision:** Day 44
**Public launch:** Day 45 if gates pass

---

# 1. EXECUTIVE DECISION

TeamFrame is being commercialised as:

# A TECHNOLOGY-ENABLED MANAGED PEOPLE OPERATIONS PLATFORM

Target customer:

> **25–80 employee knowledge-work startups and scale-ups without a mature internal People function.**

Initial sectors:

* SaaS;
* AI / technology;
* digital businesses;
* professional services;
* consulting;
* agencies;
* similar knowledge-work companies.

TeamFrame combines:

### SOFTWARE

**TeamFrame Hire + TeamFrame People + TeamFrame Control**

### AUTOMATION

Routine monitoring, reminders, preparation, workflow and resolution.

### HUMAN OPERATORS

TAKAVEN handles defined operational exceptions requiring judgement.

### SPECIALISTS

Payroll, tax, employment law, complex ER and jurisdiction-specific specialist matters remain outside standard TeamFrame scope.

---

# 2. THE BUSINESS PROBLEM

Do not sell:

> startups need HR software.

Sell the actual operational problem:

> **Growing companies reach a stage where People Operations is too important to remain scattered across founders, Ops, Finance, spreadsheets, email and memory—but building a mature internal People function is still expensive and premature.**

Traditional HR software usually still requires somebody internally to:

* monitor deadlines;
* chase managers;
* notice missing documents;
* coordinate onboarding;
* follow up with employees;
* monitor policy acknowledgement;
* identify stalled recruitment;
* manage exceptions;
* remember what needs doing.

TeamFrame exists to absorb that operational burden.

---

# 3. COMMERCIAL POSITIONING

# TEAMFRAME

## Professional People Operations without immediately building a full internal HR function.

Supporting proposition:

> **TeamFrame continuously detects what is incomplete, overdue or at risk, drives routine People Ops work toward resolution, and introduces human expertise only where judgement is required.**

Product philosophy:

# SEE → OWN → ACT → PROVE

Every meaningful TeamFrame control must answer:

1. What requires attention?
2. Why?
3. Who owns it?
4. When is action required?
5. What should happen next?
6. Can TeamFrame handle it?
7. Does a human need to intervene?
8. Was the issue resolved?
9. What evidence proves closure?

---

# 4. DIFFERENTIATION

TeamFrame is **not differentiated** because it has:

* leave;
* onboarding;
* recruitment;
* employee records;
* documents;
* policy acknowledgement;
* AI;
* fractional HR.

Competitors already offer these.

The differentiator is:

> **TeamFrame actively monitors People Operations and drives unresolved routine work toward completion while human operators handle exceptions.**

The operating flywheel is:

**Human executes**

↓

**SOP established**

↓

**TeamFrame detects trigger**

↓

**TeamFrame recommends/prepares action**

↓

**Human approves where necessary**

↓

**TeamFrame executes**

↓

**Resolution captured**

↓

**TeamFrame handles more of the routine process next time**

The technology should progressively reduce human effort per customer.

---

# 5. NORTH-STAR OPERATING OBJECTIVE

The technical objective is:

> **Every customer should require less human intervention than the one before.**

Primary internal metrics:

### CUSTOMER RETENTION

Does TeamFrame solve an important recurring operational problem?

### HUMAN MINUTES / EMPLOYEE / MONTH

Is operator leverage increasing?

### RESOLUTION RATE

Are identified People Ops controls actually getting resolved?

Supporting metrics:

* controls detected;
* controls automatically resolved;
* controls requiring intervention;
* median resolution time;
* human minutes / resolved control;
* repeat exceptions;
* customers / operator;
* escalations;
* unresolved controls.

No vanity “HR health score”.

---

# 6. CONTROL KERNEL

The Control Kernel becomes TeamFrame's canonical internal language.

A control may contain:

* Company
* Subject
* Process
* Control
* Trigger
* Requirement
* Owner
* Deadline
* Priority
* State
* Evidence
* Recommended Action
* Approval
* Execution
* Escalation
* Human Intervention
* Human Intervention Reason
* Resolution
* Resolution Evidence

The Control Kernel does **not** authorise:

* graph databases;
* event sourcing;
* general workflow engines;
* shared cross-product architecture;
* a large platform rewrite.

Existing TeamFrame and HirePass data should be mapped into this model with the smallest viable abstraction.

---

# 7. THREE LAUNCH CLOSED-LOOP CONTROLS

Only three controls are authorised for the launch wedge.

No fourth launch control without founder approval.

---

## CONTROL A — STARTER RESCUE

TeamFrame detects:

> **A new starter is not ready.**

It identifies:

* employee;
* start date;
* missing requirement;
* owner;
* consequence;
* required action.

Flow:

**Detect**

→ explain

→ assign

→ prepare action

→ approve where required

→ execute

→ escalate if unresolved

→ confirm readiness

→ preserve resolution evidence.

Starter status should be factual:

# READY

or:

# ACTION REQUIRED

No arbitrary readiness score.

---

## CONTROL B — DOCUMENT RECOVERY

TeamFrame detects:

* missing document;
* expired document;
* approaching expiry.

Flow:

**Detect**

→ identify owner

→ prepare request

→ approve where required

→ send/request

→ track

→ escalate

→ receive replacement

→ verify closure

→ preserve evidence.

---

## CONTROL C — HIRING DECISION RESCUE

TeamFrame Hire detects:

* interview completed;
* required evaluation missing;
* authorised stakeholder has not acted;
* hiring decision stalled.

Flow:

**Detect**

→ explain delay

→ identify responsible stakeholder

→ prepare reminder/action

→ approve where required

→ execute

→ escalate

→ evaluation/decision completed

→ resolution recorded.

Ordinary open vacancies are not themselves problems.

---

# 8. CONTROL CENTRE

The existing TeamFrame Control Centre is refined, **not rebuilt**.

Customer-facing rows should expose where supported:

| Attention | Owner | Required by | Next action | Reason |
| --------- | ----- | ----------- | ----------- | ------ |

Owner hierarchy:

1. named person where genuinely known;
2. role owner, e.g. Line Manager / HR Administrator / Employee;
3. **Owner not assigned**.

Never invent ownership.

`Owner not assigned` is itself an exception.

Priority groups:

### BLOCKED / TIME-CRITICAL

### OVERDUE ACTION / DECISION

### UPCOMING / ACTIVE

No opaque scoring.

No AI priority engine.

Use deterministic existing facts.

Where useful, `Owner not assigned` should be filterable.

---

# 9. PRIORITY RULES

Do not create parallel prioritisation logic where existing domain states already exist.

Map existing:

* decision;
* overdue;
* due;
* exception;
* severity;
* due date;
* unresolved age;

into the approved three groups.

For launch:

### Blocked / Time-Critical

Known blocker or severe time-sensitive consequence.

### Overdue

A genuine required date has passed.

### Upcoming

A valid future-dated action.

If existing domain logic does not already define “due soon”, use:

# 7 CALENDAR DAYS

Within a group:

1. closest/past deadline;
2. blocking consequence;
3. oldest unresolved item.

No weighted scores.

---

# 10. STARTER READINESS

Starter Readiness is a Control Centre capability, not a new module.

Example:

# ACTION REQUIRED

**Starts Monday**
**Owner: Line Manager**

* Passport missing
* Manager induction overdue
* Policy acknowledgement pending

Where the relationship is factual, explain simple blocking chains:

> Passport missing → starter cannot be marked ready.

Do not build a dependency engine.

Each blocker should link to the action required where reasonably possible.

---

# 11. MANAGER PRIORITIES — PEOPLE

Primary manager experience:

# MANAGER PRIORITIES

Show genuine work requiring action:

* leave decisions;
* onboarding responsibilities;
* offboarding responsibilities;
* probation input where already supported;
* other approved direct-report operational responsibilities.

Each item should clearly show:

* person;
* action;
* due state;
* due date;
* reason;
* direct action.

Then separately:

# MY TEAM

Normal employees are not themselves priorities.

Empty state:

> **You're up to date. No manager action currently requires attention.**

An empty priority queue is success.

---

# 12. MANAGER PRIORITIES — HIRE

Reuse HirePass's existing Hiring Control state derivation.

Do **not** expose HR-only Hiring Control directly to external managers.

Manager/Stakeholder Pass remains the permission boundary.

A stakeholder sees only authorised actions such as:

* evaluation required;
* feedback required after an actual interview;
* decision required;
* authorised candidate handoff/action.

Do not fill the queue with normal open vacancies merely to make it look active.

---

# 13. HIRE → PEOPLE CONTINUITY

Build the smallest reliable handoff.

Flow:

**Candidate Hired**

↓

**Transfer preview**

↓

**Validation**

↓

**TeamFrame employee**

↓

**Onboarding**

Supported fields where current schemas permit:

* candidate name;
* email;
* position;
* department;
* manager;
* start date;
* location;
* employment type;
* HirePass application/reference ID.

Required safeguards:

## IDEMPOTENCY

Same tenant + HirePass reference cannot create duplicate employees.

## ATOMICITY

Validation failure creates no partial employee.

## PROVENANCE

Retain:

* source system;
* HirePass reference;
* resulting TeamFrame employee;
* imported timestamp;
* importing actor/process.

## SYSTEM OF RECORD

After successful transfer:

# TEAMFRAME PEOPLE OWNS THE EMPLOYEE RECORD.

No synchronisation project.

No dual master.

No back-sync.

---

# 14. OPERATOR MODE V1

This is a deliberate amendment to the previous 45-day plan.

Do NOT build a central cross-customer Operator Workspace yet.

TeamFrame currently favours isolated customer deployments.

Therefore launch scope is:

# PER-CUSTOMER OPERATOR MODE

Inside each customer's isolated TeamFrame environment, TAKAVEN operators should be able to understand:

* controls requiring human intervention;
* overdue controls;
* escalations;
* pending approvals;
* operator-owned actions;
* due dates;
* intervention reason;
* resolution status.

Do not build at launch:

* central customer database;
* cross-customer PII store;
* cross-customer event system;
* multi-customer analytics;
* support CRM;
* centralised operator control plane.

A future central workspace requires:

1. multiple paying customers;
2. measured context-switching cost;
3. deliberate security/data architecture;
4. founder approval.

---

# 15. HUMAN-INTERVENTION CLASSIFICATION

Each human intervention is classified:

## AUTOMATE

Repeatable and appropriate for future automation.

## STANDARD SOP

Human action remains appropriate but can be delegated consistently.

## SPECIALIST

Requires legal, payroll, tax or other specialist expertise.

## EXCEPTION

Unusual judgement-heavy situation.

Also capture:

# HUMAN INTERVENTION REASON

This becomes product intelligence.

---

# 16. SERVICE CATALOGUE

Before Customer #1, recurring activities must be classified contractually.

## INCLUDED MANAGED OPERATIONS

Examples:

* employee administration;
* onboarding coordination;
* offboarding coordination;
* document follow-up;
* standard leave administration support;
* policy acknowledgement follow-up;
* hiring coordination;
* manager reminders;
* routine employee-record administration;
* recurring People Ops control review.

## EXPLICITLY EXCLUDED

* employment-law advice;
* legal interpretation;
* complex employee relations;
* disciplinary investigations;
* payroll processing;
* payroll tax;
* compensation consulting;
* benefits brokerage;
* immigration/legal advice;
* H&S specialist advice;
* unlimited HR consulting;
* unsupported jurisdiction-specific specialist advice.

Specialists handle those matters.

---

# 17. RESPONSIBILITY MATRIX

Every recurring operational activity should map:

| Activity | TeamFrame | TAKAVEN Operator | Customer | Specialist |
| -------- | --------- | ---------------- | -------- | ---------- |

Example:

**Document expiry detection**
→ TeamFrame

**Document follow-up**
→ TeamFrame / TAKAVEN Operator

**Employee provides document**
→ Customer employee

**Legal-validity interpretation**
→ Specialist

No ambiguity.

---

# 18. MANAGED-SERVICE CADENCE

Standard customer model:

### CONTINUOUS

TeamFrame monitoring.

### DAILY / DEFINED CADENCE

Operator reviews exception/escalation controls.

### WEEKLY

Outstanding operational-control review.

### MONTHLY

People Ops Control Review.

### QUARTERLY

Formal operating review where appropriate.

Do not create bespoke cadence per customer without commercial justification.

---

# 19. CUSTOMER FACTORY

Standard customer target after Implementation Ready:

# ≤2 BUSINESS DAYS ELAPSED

and

# ≤8 OPERATOR HOURS

Later target:

# ≤4 OPERATOR HOURS.

Every customer starts from:

* Golden Configuration;
* standard input pack;
* preflight validation;
* standard roles;
* workflow templates;
* standard managed-service configuration.

No customer starts from zero.

---

# 20. INPUT PREFLIGHT

Before activation begins, customer input returns:

# READY

or:

# CUSTOMER ACTION REQUIRED.

Validate where supported:

* missing required fields;
* duplicate employees;
* duplicate emails;
* malformed dates;
* invalid managers;
* unknown departments;
* unsupported values;
* malformed records.

Do not quietly repair ambiguous customer data.

---

# 21. IMPLEMENTATION READY GATE

Activation clock begins only when:

### COMMERCIAL

* agreement signed;
* required payment received;
* activation slot confirmed.

### COMPANY

* company information;
* logo;
* administrator.

### ORGANISATION

* departments;
* positions;
* managers;
* reporting structure.

### PEOPLE DATA

Approved input template passes validation.

### LEAVE

Required configuration provided.

### DOCUMENTS

Required categories identified.

### POLICIES

Relevant policy files supplied.

### WORKFLOWS

Standard onboarding/offboarding selected.

---

# 22. SECURITY STANDARD

Production acceptance requires:

> **Production risks understood, material vulnerabilities resolved, and mandatory live controls proven.**

Mandatory proof:

* authentication;
* authorisation;
* RLS/access boundaries;
* customer separation;
* private documents;
* revoked access;
* magic links;
* upload restrictions;
* backup;
* restore;
* email;
* monitoring;
* production secrets.

Security is never weakened to meet commercial deadlines.

---

# 23. REPOSITORY AS EXECUTION OPERATING SYSTEM

The repo becomes the single source of execution truth.

Create/update:

## `TEAMFRAME_MANAGED_PEOPLE_OPS_SCOPE.md`

Current controlling commercial scope.

## `docs/launch/TEAMFRAME_45_DAY_EXECUTION_PLAN.md`

This document.

## `AGENTS.md`

Agent hierarchy and decision rights.

## `docs/launch/EXECUTION_LEDGER.md`

Single task/evidence ledger.

## `docs/launch/DECISIONS.md`

Short material-decision log.

Do not create a parallel project-management system.

---

# 24. PHASE 0 GOVERNANCE LIMIT

Repository governance setup:

# MAXIMUM 3 ACTIVE HOURS.

Complete only enough to prevent contradictory instructions.

After 3 active hours:

# EXECUTION STARTS.

Documentation does not need to be aesthetically perfect.

---

# 25. DECISION LOG

`docs/launch/DECISIONS.md`

Format:

| Date | Decision | Reason | Evidence | Supersedes |
| ---- | -------- | ------ | -------- | ---------- |

Only material decisions.

Example:

> Operator Mode remains per-customer because isolated deployment architecture makes a central control plane premature.

Keep it short.

---

# 26. EXECUTION LEDGER

Required fields:

| ID | Milestone | Workstream | Task | Depends On | Blocks | Agent | State | Effort Used | Effort Ceiling | Evidence | Decision | Approval |
| -- | --------- | ---------- | ---- | ---------- | ------ | ----- | ----- | ----------: | -------------: | -------- | -------- | -------- |

Allowed states:

### PROVE

### IMPLEMENT

### DOCUMENT

### PASS

### BLOCKED

### CUT

### DEFERRED

One ledger only.

---

# 27. THREE-STATE EXECUTION PATTERN

Every meaningful workstream follows:

# PROVE CURRENT STATE

↓

# IMPLEMENT VERIFIED GAP

↓

# DOCUMENT FINAL STATE

Agents must not use:

> “While inspecting, I noticed several things worth improving...”

as permission to widen scope.

First prove.

Then close the verified gap.

Then document.

Then stop.

---

# 28. WIP LIMIT

Maximum:

# THREE ACTIVE TECHNICAL WORKSTREAMS

at once.

Initial technical WIP:

1. Security / Platform
2. Customer Factory
3. Product Control / Control Kernel

Non-code work may proceed in parallel:

* Managed Ops;
* Commercial / Trust;
* Documentation;
* target-account preparation.

The Main Orchestrator controls WIP admission.

---

# 29. MAIN ORCHESTRATOR

The Main Orchestrator:

* owns the locked plan;
* decomposes work;
* allocates agents;
* resolves routine implementation decisions;
* prevents duplicated work;
* controls WIP;
* tracks effort;
* integrates work;
* enforces acceptance gates;
* updates execution status;
* escalates only material founder decisions.

Default:

# ORCHESTRATOR DECIDES.

---

# 30. SPECIALIST AGENTS

## SECURITY / PLATFORM AGENT

Owns:

* dependencies;
* disposable environments;
* Supabase/Vercel;
* RLS;
* auth;
* storage;
* backups;
* restore;
* email;
* secrets;
* monitoring.

---

## PRODUCT CONTROL AGENT

Owns:

* Control Kernel;
* Control Centre;
* Starter Rescue;
* Document Recovery;
* Manager Priorities — People.

---

## HIRE / CONTINUITY AGENT

Owns:

* Hiring Decision Rescue;
* Manager Priorities — Hire;
* Hire→People handoff;
* idempotency;
* atomicity;
* provenance.

---

## CUSTOMER FACTORY AGENT

Owns:

* input templates;
* preflight;
* Golden Configuration;
* customer setup;
* provisioning measurement;
* setup runbook.

---

## MANAGED OPS AGENT

Owns:

* service catalogue;
* responsibility matrix;
* SOPs;
* intervention classification;
* escalation model;
* operating cadence;
* per-customer Operator Mode.

---

## COMMERCIAL / TRUST AGENT

Owns:

* trust pack;
* product explanation;
* service offer;
* pricing documentation;
* launch collateral;
* distribution assets;
* private-launch preparation.

Does not autonomously make external promises.

---

## QA / RED-TEAM AGENT

Owns:

* independent acceptance;
* regression;
* blind usability;
* failure testing;
* security review;
* Day-44 red team.

High-risk implementers cannot self-certify.

---

## DOCUMENTATION STEWARD

Owns:

* ledger hygiene;
* canonical docs;
* decisions;
* runbook updates;
* release notes;
* contradictory-document detection.

Routine documentation work requires no founder approval.

---

# 31. SUBAGENT TASK FORMAT

Every delegated task must specify:

### OBJECTIVE

### EXISTING CAPABILITY TO INSPECT FIRST

### ALLOWED SCOPE

### FORBIDDEN SCOPE

### DEPENDENCIES

### ACCEPTANCE TEST

### EFFORT CEILING

### REQUIRED EVIDENCE

### APPROVAL GATES

No agent receives vague instructions such as:

> improve TeamFrame.

---

# 32. SUBAGENT HANDOFF FORMAT

Every agent returns:

## FACTS

## CHANGES

## TESTS

## RISKS

## ACTIVE EFFORT

## RECOMMENDED DECISION

Allowed recommendations:

* PASS
* FIX
* CUT
* ESCALATE

Main Orchestrator decides normal outcomes.

---

# 33. EFFORT CEILINGS

Every workstream receives:

* target effort;
* maximum effort;
* stop condition.

Ceiling must be entered before IMPLEMENT begins.

The orchestrator may set/tighten it after PROVE.

Illustrative ceilings:

| Workstream              |       Maximum |
| ----------------------- | ------------: |
| Governance              |            3h |
| Security / live proof   |          ~10h |
| Customer Factory        |           ~8h |
| Control Kernel / Centre |           ~8h |
| Three launch controls   | ~12h combined |
| Hire→People             |           ~5h |
| Operator Mode           |           ~5h |

These are ceilings, not entitlements.

When a ceiling is approached:

* simplify;
* reuse;
* reduce implementation depth;
* defer;
* escalate.

Do not simply exceed it.

---

# 34. BRANCH / WORKTREE RULE

Parallel work may use bounded worktrees/branches.

No branch survives more than:

# 3 EXECUTION DAYS

without:

### INTEGRATION

or:

### EXPLICIT ORCHESTRATOR JUSTIFICATION.

Merge process:

1. scope-specific tests;
2. integration/release tests;
3. second-agent review for high-risk work;
4. integrate;
5. ledger update;
6. canonical-doc update where required;
7. retire branch/worktree.

---

# 35. SECOND-AGENT REVIEW

Mandatory before integration for:

* auth;
* RLS;
* private files;
* migrations;
* import logic;
* Hire→People atomicity/idempotency;
* backup/restore;
* external-message automation;
* dependency/security remediation.

This replaces unnecessary founder approvals.

---

# 36. FOUNDER APPROVAL GATES

Founder involvement is deliberately limited.

Approval required only for:

## STRATEGY

* new module;
* ICP change;
* managed-service thesis change;
* removal of mandatory launch outcome.

## MATERIAL ARCHITECTURE / SECURITY

* central customer control plane;
* material auth/RLS architecture change;
* reduction of security boundary.

## REAL CUSTOMER / PRODUCTION

* first production deployment;
* real customer data;
* destructive real-environment action;
* material data deletion/movement.

## COMMERCIAL

* pricing change;
* contract/SLA commitment;
* material service-scope change;
* legal/compliance claim.

## SPEND

* meaningful new recurring spend.

## EXTERNAL ACTIVATION

* first external sales activation;
* public launch.

For everything else:

# DO NOT INTERRUPT THE FOUNDER.

---

# 37. ADMIN TASKS TO AUTOMATE / DELEGATE

Default delegation:

* test execution;
* test summaries;
* dependency audits;
* fixtures;
* documentation;
* ledger maintenance;
* runbooks;
* release notes;
* evidence collection;
* stale-document identification;
* provisioning measurements;
* customer-input validation;
* SOP drafting;
* operator-time aggregation;
* QA;
* launch collateral consistency;
* target-account research preparation.

Founder should not manually administer these.

---

# 38. DO NOT BUILD AN AGENT PLATFORM

No:

* agent dashboard;
* internal orchestration SaaS;
* custom project manager;
* semantic documentation engine;
* multi-agent framework product.

Use:

# ONE ORCHESTRATOR

# SPECIALIST WORKERS

# ONE LEDGER

# ONE DECISION LOG

# CLEAR GATES.

If orchestration becomes more work than execution:

simplify immediately.

---

# 39. COMMERCIAL MILESTONES

These must remain visible at the top of the execution ledger.

## M1 — PRODUCTION TRUSTWORTHY

Security and production controls proven.

## M2 — PRODUCT WEDGE VISIBLE

SEE → OWN → ACT → PROVE is unmistakable.

## M3 — PRIVATE LAUNCH READY

Product + managed service + trust + offer ready.

## M4 — FIRST EXTERNAL BUYER EXPOSURE

Controlled selling starts.

## M5 — PAID / FINANCIALLY COMMITTED LAUNCH PARTNER

Real commercial evidence.

## M6 — PUBLIC LAUNCH

Launch gates passed.

Daily orchestrator question:

> **Are we moving toward M5/M6, or merely closing technical tickets?**

---

# 40. DAYS 1–3 — GOVERNANCE + FOUNDATION

## Governance

Maximum 3 active hours.

Create/update canonical docs and execution system.

Then stop governance work.

## Technical

Begin:

* live security proof;
* disposable environment;
* backup/restore;
* email;
* Sentry/runtime assessment;
* provisioning baseline.

## Product

Map existing product state into Control Kernel.

## Managed Ops

Draft:

* service catalogue;
* responsibility matrix;
* human-intervention classifications.

No feature expansion.

---

# 41. DAYS 4–7 — PROVE EXISTING SYSTEM

Technical WIP:

### Security

Run actual live controls.

### Customer Factory

Measure current setup unchanged.

Record:

* automated time;
* manual time;
* operator time;
* undocumented steps;
* provisioning gaps.

### Product

Prove what Control Centre, Manager surfaces and automation already do.

Do not rebuild before evidence.

By Day 7:

* each workstream has verified gap;
* implementation route;
* ceiling;
* acceptance criteria.

---

# 42. DAYS 8–14 — CORE PRODUCT WEDGE

Implement bounded verified gaps only.

Complete/refine:

### Control Kernel v1

### Control Centre

### Starter Readiness

### Manager Priorities

### Hire→People

### First end-to-end Action

### Per-customer Operator Mode foundation where dependencies permit

No platform rewrite.

No central customer workspace.

---

# 43. DAYS 15–21 — THREE CONTROLS + CONTROLLED SELLING

Complete:

### Starter Rescue

### Document Recovery

### Hiring Decision Rescue

### basic resolution tracking

### Operator Mode v1

At the same time begin controlled selling to:

# 10–15 HIGHLY QUALIFIED COMPANIES

This is selling.

Not product research.

Synthetic/demo environments may be used before production/customer-data gates are complete.

Question:

> Does this operating model solve a real enough problem that you will adopt/pay for it?

---

# 44. DAY 21 — FEATURE FREEZE

# ABSOLUTE FEATURE FREEZE.

After Day 21:

No new product capability.

Only:

* bug fixes;
* usability clarity;
* security;
* repeatability;
* operator workflow;
* service preparation;
* commercial preparation.

---

# 45. DAYS 22–28 — USABILITY + PRIVATE LAUNCH

Run blind comprehension testing.

Ask:

> **Tell me what TeamFrame does.**

Positive spontaneous concepts:

* proactive People Ops;
* operational control;
* automates chasing;
* tells managers what needs attention;
* managed People Operations;
* resolves admin work.

Weak response:

> employee database.

> HR dashboard.

> leave system.

If the wedge is unclear:

fix positioning/clarity.

Do not add modules.

Target:

* 5–10 relevant buyer conversations;
* 3 serious launch-partner candidates;
* ≥1 paid or financially committed pilot by the wider private-launch window.

---

# 46. DAYS 29–35 — MANAGED-SERVICE MACHINE

Finalise:

* service catalogue;
* exclusions;
* SOP library;
* escalation rules;
* operator assignment;
* intervention categories;
* customer responsibility matrix;
* operator capacity model;
* time tracking;
* support model.

No new module development.

---

# 47. DAYS 30–38 — DISTRIBUTION ENGINE

Build only sales/distribution assets required for launch:

1. self-guided demonstration;
2. People Ops Control Scan;
3. landing site;
4. pricing/offer;
5. useful startup People Ops templates/tools;
6. candidate-facing TeamFrame exposure where already supported;
7. direct outbound infrastructure.

Do not convert this into a content-marketing project.

---

# 48. DAYS 36–41 — CUSTOMER FACTORY PROOF

Prove customer #2 / #3 style setup requires:

* no founder coding;
* ≤8 operator hours;
* repeatable configuration;
* security isolation;
* backup;
* monitoring;
* support.

Also run:

# CONTRACT → PAYMENT → SETUP → OPERATION → SUPPORT → EXPORT → TERMINATION

No tabletop simulation.

Actually execute the synthetic lifecycle.

---

# 49. DAYS 42–43 — ADVERSARIAL RED TEAM

Challenge:

## PROBLEM

Is People Ops capacity genuinely painful?

## DIFFERENTIATION

Why TeamFrame instead of HR software + fractional HR?

## PRODUCT

Does TeamFrame actively monitor and resolve work?

## OPERATOR LEVERAGE

Does software materially reduce human work?

## COMMERCIAL

Will companies pay enough to sustain the model?

## REPEATABILITY

Can customer #4 launch without engineering?

## DEFENSIBILITY

Is TeamFrame building structured control/resolution intelligence rather than just automations?

No defensive bias.

---

# 50. DAY 44 — GO / MODIFY / STOP

## GO

Evidence shows:

* buyers understand the problem;
* managed execution is valued;
* TeamFrame differentiation is clear;
* product works;
* security is green;
* operator economics are credible;
* real paid/committed interest exists;
* customer factory is repeatable.

## MODIFY

Pain exists but:

* positioning;
* pricing;
* service structure;
* scope packaging

needs adjustment.

Do NOT add modules.

## STOP / MATERIAL RETHINK

If:

* buyers only want commodity HRIS;
* customers prefer standard fractional HR;
* managed execution has little value;
* human service hours destroy economics;
* controls vary radically per customer;
* TeamFrame fails to reduce operator effort;
* buyers describe it as glorified task management;
* the wedge cannot be explained unaided.

---

# 51. DAY 45 — PUBLIC LAUNCH

Launch only when:

### PRODUCT

Three closed-loop controls genuinely resolve operational work.

### CONTROL

Control Kernel is used consistently.

### OPERATOR

Per-customer Operator Mode supports managed delivery.

### SERVICE

Catalogue, exclusions and SOPs are complete.

### CUSTOMER FACTORY

Activation is repeatable.

### SECURITY

Green.

### COMMERCIAL

Paid/committed launch evidence exists.

### POSITIONING

Understood without lengthy explanation.

### DISTRIBUTION

Ready.

Then launch.

---

# 52. NO-BUILD LIST

No:

* payroll;
* attendance;
* performance management;
* LMS;
* compensation;
* engagement surveys;
* benefits;
* expenses;
* full mobile app;
* broad integrations;
* benchmarking;
* marketplace;
* general AI chatbot;
* autonomous employment decisions;
* generic workflow engine;
* central cross-customer operator platform;
* new module requested by one prospect.

Specialisation before expansion.

---

# 53. POST-LAUNCH AUTOMATION FLYWHEEL

Every repeated operator activity asks:

> **Can TeamFrame safely perform this next time?**

Progression:

Human executes

↓

SOP established

↓

TeamFrame detects

↓

TeamFrame recommends/prepares

↓

Human approves

↓

TeamFrame executes

↓

TeamFrame resolves routine work

↓

Human handles only exceptions.

Human service becomes real-world product intelligence.

---

# 54. AGENT-SYSTEM SUCCESS METRIC

Track founder interventions.

Each intervention is classified:

### REQUIRED APPROVAL

or

### AVOIDABLE INTERRUPTION

Goal:

# AVOIDABLE INTERRUPTIONS TREND TOWARD ZERO.

Founder should spend time on:

* major strategy;
* money;
* key customers;
* legal/compliance risk;
* major architecture;
* production risk.

Not:

* routine documentation;
* QA;
* branch decisions;
* task assignment;
* test execution;
* internal administration.

---

# 55. FINAL EXECUTION PRINCIPLE

The next 45 days are not about building more HR software.

They are about proving a business model:

> **TeamFrame can continuously identify routine People Operations work, drive it toward resolution, use humans only where judgement is genuinely required, and progressively reduce the human effort required to operate HR for growing companies.**

Everything executed must advance one of:

# PRODUCT WEDGE

# OPERATOR LEVERAGE

# CUSTOMER REPEATABILITY

# TRUST

# SALES

# LAUNCH.

If a task advances none of these:

# DO NOT DO IT.

If an agent framework starts becoming a project:

# SIMPLIFY IT.

If a feature threatens the launch:

# CUT THE FEATURE.

If security fails:

# STOP PRODUCTION.

If buyers do not value the managed model:

# CHANGE THE BUSINESS MODEL — NOT THE FEATURE LIST.

Day 45 is the decision point.

Execute.
