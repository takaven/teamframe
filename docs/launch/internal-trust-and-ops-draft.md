# Internal Trust and Managed Ops preparation

**Internal draft only — evidence-dependent; not a certification, legal advice, service promise, or external sales material.** The [execution ledger](EXECUTION_LEDGER.md) controls gate status; the [managed scope](../../TEAMFRAME_MANAGED_PEOPLE_OPS_SCOPE.md) controls candidate service boundaries. Do not send this document to buyers or imply M1 has passed.

## Trust evidence to assemble before buyer use

| Topic | Current internal position | Evidence or decision still required |
| --- | --- | --- |
| Architecture and hosting | Intended delivery uses isolated customer TeamFrame/Supabase environments; Hire remains on HirePass. Synthetic launch tests use TAKAVEN disposable projects only. | Verify each real deployment's topology, environment-specific secrets, access boundary, hosting region and actual data flows before making a customer-specific statement. |
| Subprocessors and data location | Inventory not approved for external use. | Confirm each active provider, purpose, data categories, region, contractual terms and subprocessors for the intended production configuration. Do not infer residency from the Mumbai disposable project. |
| Access controls and documents | Fresh disposable install has 39/39 public tables with RLS; private `documents` bucket exists. | Live role denials, manager/employee scope, revoked access, upload and download tests remain open. Configuration alone is not access proof. |
| Backup and recovery | Free disposable project has no scheduled provider backup. | Complete logical export, clean-target restore, authentication, relationship, permission and representative file recovery before claiming recoverability or setting an RPO/RTO. |
| Email and monitoring | Not yet live-proven for the launch environment. | Prove invitation/magic-link delivery, failure visibility, and deployed Sentry exposure; record the applicable operational alert owner. |
| Retention, deletion, export and termination | No launch customer process is approved here. | Define data categories, retention triggers, verified export contents, deletion steps, backups/replicas treatment, evidence and customer approval before contractual claims. Never test destruction on real data without founder approval. |
| Incident handling | [Incident runbook](runbooks/incident-response.md) is incomplete. | Name on-call owner, severity/triage, access containment, evidence capture, notification review, customer communication approval and post-incident follow-up; rehearse before external commitments. |
| DPA and security FAQ | Draft questions only, not signed terms or legal guidance. | Legal review of controller/processor roles, subprocessors, transfers, breach notices, deletion, audit rights and jurisdiction-specific clauses. Answer FAQ items only from verified evidence. |

## Operator SOP skeleton — rehearsal required

For **Starter Rescue**, **Document Recovery** and **Hiring Decision Rescue**, review the factual control, validate its source and required-by date, identify the actual person/role owner (or `Owner not assigned`), choose the next action, record the intervention reason, escalate missing decisions or specialist matters, and close only with a resolution/evidence reference. A routine manager reminder is an action within these controls, not a fourth launch control. No agent makes employment, payroll, legal, or specialist decisions.

Use the existing intervention classes: **AUTOMATE**, **STANDARD SOP**, **SPECIALIST**, **EXCEPTION**. For each intervention capture customer/environment, control, owner, action, start/end, **active operator minutes**, **waiting minutes separately**, class/reason, escalation, result and evidence reference. Do not count passive waiting as operator labour or an unresolved item as completed.

Activation SOP: validate customer inputs and intended isolated environment before setup; log automated steps, hands-on configuration, customer-dependent waiting, elapsed time and QA. A failed pre-live activation with ambiguous partial writes is **quarantined for inspection**; after verifying no real data, recreate the isolated environment from validated inputs rather than manually replaying partial SQL. Customer handoff requires verified roles, controls, invitation delivery, documents, support owner and an explicit list of unfinished configuration. These are internal rehearsal checks, not a claim that the ≤2-business-day / ≤8-operator-hour target is met.
