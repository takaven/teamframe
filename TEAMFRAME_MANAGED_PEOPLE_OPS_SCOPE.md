# TeamFrame — Product and optional HR support scope

**Status: controlling commercial scope.** The [execution ledger](docs/launch/EXECUTION_LEDGER.md) governs current work. The [45-day plan](docs/launch/TEAMFRAME_45_DAY_EXECUTION_PLAN.md) remains historical execution provenance. Existing technical documents remain authoritative for implemented behaviour, not for superseded market positioning.

TeamFrame is UAE-focused HR software for startups and growing small teams. It helps businesses establish and maintain core HR controls relevant to UAE employment requirements while leaving company policy and employee applicability explicit. Payroll, tax, employment-law advice, complex employee relations, immigration/legal advice and other specialist judgement remain outside the product and standard service scope.

TeamFrame is the customer-facing product and service brand. **TeamFrame is owned by TAKAVEN.** Ownership does not make TAKAVEN part of the customer-facing implementation, support or HR-service proposition, and neither offer depends on parent-company involvement.

TeamFrame is commercially available through two offers:

1. **TeamFrame / Tool Only.** TeamFrame implementation includes agreed configuration, data import, administrator/manager training and handover. The customer's own HR, Admin or Operations owner runs the independent installation.
2. **TeamFrame + HR Support.** The same software is paired with separately agreed TeamFrame HR foundation, setup or operational support. This may include HR foundation setup, record-administration support, onboarding/offboarding coordination, document follow-up, policy/process support and periodic UAE HR basics review.

The product wedge is **SEE → OWN → ACT → PROVE**: show unresolved People Ops work, explain it, identify the actual owner and deadline, support the next action, escalate when appropriate and retain resolution evidence. This is a product and operating principle, not a requirement for external operator involvement. No opaque HR health or legal-compliance score.

TeamFrame Hire remains on the existing HirePass architecture; Hire→People is a bounded handoff, not a shared database or live sync. Each TeamFrame customer remains isolated. Any access needed to deliver optional TeamFrame HR Support is explicitly authorised, customer-local and limited to the agreed scope; no central cross-customer HR runtime or operator platform is authorised.

TeamFrame is designed to be configured and ready for handover within 48 hours once complete setup information and required access are available. This is not an unconditional SLA and does not promise that bespoke HR-policy or foundation work will always be completed within 48 hours. Implementation timers, provisioning dashboards and SLA functionality remain out of scope.

No new module without founder approval. The no-build list includes payroll/WPS processing, attendance, biometrics, timesheets, shift scheduling, EOS/gratuity calculation, general AI legal advice, a generic workflow engine, government integrations and a central cross-customer operator platform.

## Product / service boundary

| Layer | Responsibility |
| --- | --- |
| TeamFrame product | Customer-isolated records, documents, leave, policies, lifecycle workflows, operational attention, ownership, actions and evidence. It remains useful with the customer's own HR, Admin or Operations owner. |
| Implementation | Customer installation, configuration, agreed data import, initial access setup, training and handover. |
| Optional TeamFrame HR Support | Agreed operational support around the customer's installation, including routine follow-up, record support and periodic review. |
| Specialist / external | Legal advice, payroll/WPS operation, tax, immigration/PRO work, complex employee relations, government submissions and other regulated or specialist judgement. |

Software features must not be built solely for optional support delivery unless they also have clear customer/product value.

## Product freeze and bounded gap decisions

TeamFrame is presumed **feature-complete for first-customer sale**. Future product work requires a genuine production defect, a real first-customer blocker, repeated buyer feedback or a separately founder-approved small improvement.

- **Normal working arrangement/hours: DEFER.** TeamFrame already records company working days, employee overrides, holidays and leave. A structured company-hours fact would require an additive schema/migration and changes across configuration, setup/import and tests. Employee custom fields can record a special arrangement where needed. The commercial benefit does not currently justify reopening the product.
- **Structured offboarding notice/final-dues facts: DEFER.** The current workflow already records the effective final date and requires notice confirmation, leave reconciliation, final exit-document evidence, access/property closeout and final HR review. Separate notice-period and final-dues fields would require an additive schema/migration and service/UI/test changes; wait for real customer evidence.

## Optional TeamFrame HR Support operating draft — not a customer commitment

For customers that choose TeamFrame + HR Support, candidate operations include employee-record administration; starter and leaver coordination; document and policy-acknowledgement follow-up; standard leave-administration support; hiring coordination; manager reminders; and recurring open-control review. These are working categories for SOP and capacity testing, **not** a staffed-service claim, response-time promise or contractual inclusion. Tool Only customers operate without TeamFrame HR Support. Payroll/tax processing, employment-law interpretation, complex employee relations, disciplinary investigations, immigration/legal advice, compensation consulting, benefits brokerage, H&S specialist advice, unlimited HR consulting and unsupported jurisdiction-specific advice are excluded from standard TeamFrame support; route them to an appropriately engaged specialist or the customer.

| Operational step | TeamFrame product | TeamFrame HR Support | Customer / employee | Specialist |
| --- | --- | --- | --- | --- |
| Detect and display a missing starter document, overdue acknowledgement, or unresolved hiring decision | Show factual state and evidence where implemented | Review exception and verify owner | Supply missing input or make the decision | None by default |
| Follow up on a routine control | Prepare/record status where supported | Send or coordinate an approved routine follow-up; record outcome | Respond, approve, or provide the requested item | Only if judgement leaves standard scope |
| Resolve a standard administrative item | Retain status and resolution evidence where supported | Check completion against the agreed SOP; close or escalate | Remain accountable for employment and business decisions | Advise only within separately agreed remit |
| Interpret legal validity, payroll/tax, or complex employee-relations matter | Do not decide | Flag and route; do not give specialist advice | Authorise the referral and decision | Provide qualified advice under a separate engagement |

Classify each human intervention as **AUTOMATE**, **STANDARD SOP**, **SPECIALIST**, or **EXCEPTION**, and record the specific intervention reason. For each handled control, capture customer/environment, control type, owner, action, start/end timestamps, active service minutes, waiting time separately, intervention class/reason, escalation, outcome, and evidence reference. Aggregate active minutes per resolved control and per employee per month; never count passive waiting as service effort. This is an internal measurement protocol, not evidence that the service is already staffed or repeatable. Validate actual responsibilities, cadence, capacity, templates and specialist handoffs before offering them externally.

## UAE positioning boundary

Approved headline-level positioning includes **“Built to help UAE businesses stay on top of key employment requirements”** and **“HR built around the realities of employing people in the UAE.”** TeamFrame does not guarantee legal compliance, provide legal advice, certify statutory compliance or claim complete UAE Labour Law coverage. Do not claim that “TeamFrame keeps you compliant with UAE Labour Law.”
