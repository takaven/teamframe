# TeamFrame — Product and optional HR service scope

**Status: controlling commercial scope.** The [execution ledger](docs/launch/EXECUTION_LEDGER.md) governs current work. The [45-day plan](docs/launch/TEAMFRAME_45_DAY_EXECUTION_PLAN.md) remains historical execution provenance. Existing technical documents remain authoritative for implemented behaviour, not for superseded market positioning.

TeamFrame is UAE-focused HR software for startups and growing small teams. It helps businesses establish and maintain core HR controls relevant to UAE employment requirements while leaving company policy and employee applicability explicit. Payroll, tax, employment-law advice, complex employee relations, immigration/legal advice and other specialist judgement remain outside the product and standard service scope.

TeamFrame is commercially available through two offers:

1. **TeamFrame / Tool Only.** TAKAVEN implements, configures, imports agreed data and trains the customer. The customer's own HR, Admin or Operations owner runs the independent installation.
2. **TeamFrame + HR Service.** The same software is paired with separately agreed TAKAVEN HR operational support. This may include HR foundation setup, record administration support, onboarding/offboarding coordination, document follow-up, policy/process support and periodic UAE HR basics review.

The product wedge is **SEE → OWN → ACT → PROVE**: show unresolved People Ops work, explain it, identify the actual owner and deadline, support the next action, escalate when appropriate and retain resolution evidence. This is a product and operating principle, not a requirement for TAKAVEN operator involvement. No opaque HR health or legal-compliance score.

TeamFrame Hire remains on the existing HirePass architecture; Hire→People is a bounded handoff, not a shared database or live sync. Each TeamFrame customer remains isolated. Where the customer buys HR Service, TAKAVEN uses authorised customer-local access; no central cross-customer HR runtime or operator platform is authorised.

Implementation speed and service-effort targets remain internal operating measures, not product features or customer-facing guarantees unless separately approved.

No new module without founder approval. The no-build list includes payroll/WPS processing, attendance, biometrics, timesheets, shift scheduling, EOS/gratuity calculation, general AI legal advice, a generic workflow engine, government integrations and a central cross-customer operator platform.

## Product / service boundary

| Layer | Responsibility |
| --- | --- |
| TeamFrame product | Customer-isolated records, documents, leave, policies, lifecycle workflows, operational attention, ownership, actions and evidence. It must remain useful without TAKAVEN administering HR. |
| Implementation | Customer installation, configuration, agreed data import, initial access setup, training and handover. |
| Optional HR service | Agreed operational support around the customer's installation, including routine follow-up, record support and periodic review. |
| Specialist / external | Legal advice, payroll/WPS operation, tax, immigration/PRO work, complex employee relations, government submissions and other regulated or specialist judgement. |

Software features must not be built solely to operate TAKAVEN's optional service unless they also have clear customer/product value.

## Product freeze and bounded gap decisions

TeamFrame is presumed **feature-complete for first-customer sale**. Future product work requires a genuine production defect, a real first-customer blocker, repeated buyer feedback or a separately founder-approved small improvement.

- **Normal working arrangement/hours: DEFER.** TeamFrame already records company working days, employee overrides, holidays and leave. A structured company-hours fact would require an additive schema/migration and changes across configuration, setup/import and tests. Employee custom fields can record a special arrangement where needed. The commercial benefit does not currently justify reopening the product.
- **Structured offboarding notice/final-dues facts: DEFER.** The current workflow already records the effective final date and requires notice confirmation, leave reconciliation, final exit-document evidence, access/property closeout and final HR review. Separate notice-period and final-dues fields would require an additive schema/migration and service/UI/test changes; wait for real customer evidence.

## Optional HR service operating draft — not a customer commitment

For customers that choose TeamFrame + HR Service, candidate operations include employee-record administration; starter and leaver coordination; document and policy-acknowledgement follow-up; standard leave administration support; hiring coordination; manager reminders; and recurring open-control review. These are working categories for SOP and capacity testing, **not** a staffed-service claim, response-time promise or contractual inclusion. Tool Only customers do not require TAKAVEN operators. Payroll/tax processing, employment-law interpretation, complex employee relations, disciplinary investigations, immigration/legal advice, compensation consulting, benefits brokerage, H&S specialist advice, unlimited HR consulting and unsupported jurisdiction-specific advice are excluded from standard operator work; route them to an appropriately engaged specialist or the customer.

| Operational step | TeamFrame | TAKAVEN operator | Customer / employee | Specialist |
| --- | --- | --- | --- | --- |
| Detect and display a missing starter document, overdue acknowledgement, or unresolved hiring decision | Show factual state and evidence where implemented | Review exception and verify owner | Supply missing input or make the decision | None by default |
| Follow up on a routine control | Prepare/record status where supported | Send or coordinate an approved routine follow-up; record outcome | Respond, approve, or provide the requested item | Only if judgement leaves standard scope |
| Resolve a standard administrative item | Retain status and resolution evidence where supported | Check completion against the SOP; close or escalate | Remain accountable for employment and business decisions | Advise only within separately agreed remit |
| Interpret legal validity, payroll/tax, or complex employee-relations matter | Do not decide | Flag and route; do not give specialist advice | Authorise the referral and decision | Provide qualified advice under a separate engagement |

Classify each human intervention as **AUTOMATE**, **STANDARD SOP**, **SPECIALIST**, or **EXCEPTION**, and record the specific intervention reason. For each handled control, capture customer/environment, control type, owner, action, start/end timestamps, active operator minutes, waiting time separately, intervention class/reason, escalation, outcome, and evidence reference. Aggregate active minutes per resolved control and per employee per month; never count passive waiting as operator effort. This is a measurement protocol for the synthetic/private-launch proof, not evidence that the service is already staffed or repeatable. Validate actual responsibilities, cadence, capacity, templates, and specialist handoffs before offering them externally.
