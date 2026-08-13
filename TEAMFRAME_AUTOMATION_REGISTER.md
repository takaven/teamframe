# TeamFrame Automation Register

**STATUS: CANONICAL / PRODUCT-BEHAVIOUR REGISTER**

This register describes required market-ready product behaviour. It is not a technical architecture document and does not freeze table names, job-runner implementation or exact reminder day/hour defaults.

Implementation status:

- MR-2 automation is implemented and locked.
- Production execution uses the protected server endpoint `POST /api/automation/run`.
- The runner must be invoked only with the server-only `TEAMFRAME_AUTOMATION_SECRET` via `x-teamframe-automation-secret` or `Authorization: Bearer <secret>`.
- Production scheduling must use the approved Vercel Cron or equivalent trusted scheduler for the production deployment target.
- The runner is idempotent: repeated or overlapping invocations must not duplicate business effects.
- Completion suppression, recurrence, retry/failure visibility and human/system audit attribution are verified release behaviour.

Notification levels:

- BACKGROUND: silent system action.
- ROUTINE REMINDER: employee/manager reminder.
- ESCALATION: persistent non-response or material issue.
- DECISION: human judgement required.

| Automation ID | Trigger | Known fact | Automatic action | Owner | Due logic | Reminder/escalation | Completion condition | Scope status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| TF-AUTO-001 | Company setup started | Company identity and admin are known | Create initial tenant setup checklist and defaults | Admin/founder | During setup | Escalate only if setup remains incomplete before intended launch | Required setup facts completed | MARKET-READY REQUIRED |
| TF-AUTO-002 | Employee created | Start date, role/function and lifecycle facts are known | Initialise appropriate onboarding work where deterministic | Admin/founder; manager where authorised | Derived from start date and task template | Routine reminder then escalation for overdue items | Required onboarding items completed or evidence received | MARKET-READY REQUIRED |
| TF-AUTO-003 | Employee invite delivery fails | Invite attempt failed or remains incomplete | Record failure, perform bounded safe automatic retry, then create recovery action only if retries fail | System, then admin/founder if retries fail | Immediate or next safe retry window | Escalate only after bounded retries fail | Invite sent/linked or founder resolves recovery action | MARKET-READY REQUIRED |
| TF-AUTO-004 | Published policy | Policy version and eligible population are known | Create acknowledgement obligations | Employee | Based on effective date / assignment date | Routine reminder then escalation for outstanding acknowledgement | Version-specific acknowledgement recorded | MARKET-READY REQUIRED |
| TF-AUTO-005 | Outstanding policy acknowledgement | Acknowledgement is overdue or repeatedly ignored | Remind employee; escalate persistent non-response | Employee, then manager/founder where authorised | No exact day defaults frozen | Completion suppresses reminders | Acknowledgement record exists or obligation no longer current | MARKET-READY REQUIRED |
| TF-AUTO-006 | Document requirement created | Required document type, employee and due date are known | Request employee upload and show requirement in self-service | Employee | Due date from requirement/template | Routine reminder then escalation | Configured matching evidence received; admin review accepted where review is configured | MARKET-READY REQUIRED |
| TF-AUTO-007 | Document uploaded | Employee/admin uploaded a permitted document | Store receipt, link evidence, close matching configured requirement where permitted | System | Immediate background action | No reminder after configured matching evidence closes requirement | Matching permitted evidence exists; admin review accepted where configured | MARKET-READY REQUIRED |
| TF-AUTO-008 | Document approaching expiry | Existing document has expiry date | Create renewal requirement/work item | Employee/admin as configured | Based on expiry window | Routine reminder then escalation near/after expiry | Replacement document accepted | MARKET-READY REQUIRED |
| TF-AUTO-009 | Approximately 30 days after start | Employee is in early employment lifecycle | Issue short onboarding check-in | Employee | Derived from start date | Reminder if not completed; escalate only from configured response conditions | Check-in submitted; follow-up created only when configured response conditions are met | MARKET-READY REQUIRED |
| TF-AUTO-010 | Probation approaching | Probation end date is known | Open probation review work item | Manager/founder | Derived from probation end date | Routine reminder then escalation if overdue | Human outcome recorded | MARKET-READY REQUIRED |
| TF-AUTO-011 | Leave request submitted | Employee, dates and leave type are known | Validate dates/balance/conflicts and route decision | Manager/founder according to delegation | Immediate decision queue | Reminder to approver if pending too long | Approved/declined/cancelled with history | MARKET-READY REQUIRED |
| TF-AUTO-012 | Leave approved/declined | Decision is recorded | Update leave history and balance where applicable | System | Immediate background action | None unless propagation fails | History/balance projection updated | MARKET-READY REQUIRED |
| TF-AUTO-013 | Employment change recorded | Change type, effective date and previous/current values are known | Store history and propagate current projection when effective | System with admin/founder decision | Effective date | Reminder/escalation for pending required inputs | Change applied or cancelled with audit trail | MARKET-READY REQUIRED |
| TF-AUTO-014 | Departure/offboarding started | End date and departure context are known | Generate exit workflow and relevant checklist | Founder/manager/employee by task | Based on end date | Routine reminder then escalation for overdue exit work | Required exit work complete | MARKET-READY REQUIRED |
| TF-AUTO-015 | Employee becomes former | End date passed and required exit work complete | Suppress active obligations, vacate position, retain history | System | Immediate background action | Escalate only if suppression/transition fails | Former projection applied and historical record retained | MARKET-READY REQUIRED |
| TF-AUTO-016 | Signal/action resolved | Required evidence or manual confirmation exists | Mark signal/action resolved and preserve durable history | System/admin/founder | Immediate background action | Completion suppresses future reminders for same obligation | Resolution recorded without suppressing legitimate recurrence | MARKET-READY REQUIRED |
| TF-AUTO-017 | Export requested | Export type and authorised actor are known | Generate export and provide truthful status/download | Admin/founder | Immediate or queued job | Escalate only on persistent export failure | Export generated or clear failure recorded | MARKET-READY REQUIRED |

Exact production schedule cadence must be recorded during deployment. Do not add founder-facing automation-rule configuration unless separately approved.
