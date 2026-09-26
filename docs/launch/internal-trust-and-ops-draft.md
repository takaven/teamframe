# Internal Trust and Managed Ops preparation

**Internal draft only — evidence-dependent; not a certification, legal advice, service promise, or external sales material.** The [execution ledger](EXECUTION_LEDGER.md) controls gate status; the [managed scope](../../TEAMFRAME_MANAGED_PEOPLE_OPS_SCOPE.md) controls candidate service boundaries. Do not send this document to buyers or imply M1 has passed.

## Internal claim-to-evidence map

This maps internal proof only; none of these rows authorises public or contractual wording. Recheck the ledger and the intended customer environment before drafting a buyer response.

| Internal statement | Evidence and limit | Owner / release gate |
| --- | --- | --- |
| A clean synthetic install enabled RLS on 39/39 public tables. | Ledger S5/R2: exact 32-file fresh install and read-only checks on a TAKAVEN disposable project. This does not prove role isolation or a real deployment. | Security / Platform; S1 live role and denial proof, then M1. |
| A private `documents` bucket was created in the synthetic environment. | Ledger S2/S5/R2: catalog-verified private bucket. Upload, download and revoked-access behavior are unproven. | Security / Platform; S1 file-access proof, then M1. |
| The corrected setup-pack import passed a clean synthetic 120-person run. | Ledger F2: 116 historical employees received no join work; four starters received 24 tasks. This is not a full activation, operator-time or invitation-delivery measure. | Customer Factory; F1 complete activation measurement and M3. |
| Live authentication, role/manager/employee denials, email delivery, file access and deployed Sentry exposure are proven. | **Unproven.** Ledger S1 remains PROVE; synthetic configuration and bootstrap are not these tests. | Security / Platform; S1 live proof and M1. |
| Customer data can be recovered to a tested point or within a stated time. | **Unproven.** Ledger S3: no export/clean-target restore performed; the Free disposable project has no scheduled provider backup. | Security / Platform; S3 restore proof and M1; any RPO/RTO needs separate approval. |
| A customer environment can be fully activated within a stated time or operator effort. | **Unproven.** Ledger F1/F2: importer timing exists, but remaining configuration, delivery, full elapsed time and active operator time are not measured. | Customer Factory; F1/M3 measurement; service-time commitment requires founder approval. |

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

## Internal operator SOPs — rehearsal required

These are preparation steps, not evidence that a staffed service, response time or customer handoff is ready. Work inside the relevant isolated customer environment only. Before any action, verify the factual control, source, person or role owner (otherwise `Owner not assigned`), required-by date and permitted operator action. The customer retains employment and business decisions. Do not mark a control resolved merely because a reminder was sent.

| Situation | Operator action | Stop / escalate | Closure evidence |
| --- | --- | --- | --- |
| Starter Rescue | Compare the start date with configured pre-start tasks and document requirements; identify the exact blocker and owner; request the missing item using an approved template where authorised. Distinguish post-start work from day-one readiness. | Missing owner, missing configuration, disputed document validity, or a customer decision: route to the customer owner; do not infer READY. | Requirement/task completion, accepted evidence where required, and recorded owner/action. |
| Document Recovery | Check the requirement and document state; ask the authorised owner for a missing or rejected file through the approved private route; verify that the expected private record is present. | Never download to an unapproved location or decide legal validity. Access failure, unexpected exposure, or suspected sensitive-data incident goes to the security/incident route. | Correct document linked to the requirement, review outcome if applicable, and access-safe evidence reference; not a copied file. |
| Hiring Decision Rescue | In HirePass, identify the pending decision and permitted Manager/Stakeholder owner; send a routine approved reminder and record the response/status. | Do not make the selection decision, expose HR-only notes, or transfer a candidate to People without approved handoff validation. | Decision recorded by the authorised person and source reference retained. |
| Routine manager reminder | Verify that a genuine action is still open, assigned to this manager, and not already submitted; use an approved template and channel. | Unassigned, stale, disputed or confidential item: route to the designated customer owner; do not send a speculative or duplicate reminder. | Message/action reference and subsequent decision or completion. A sent reminder alone leaves the control open. |
| Escalation and closure | On missed deadline, failed follow-up, conflicting status, or absent owner, record the reason and route to the named customer owner or internal accountable operator. Recheck after response. | Security incident follows the incident runbook. Employment, payroll, tax, legal and specialist judgement leaves the standard SOP; operator does not improvise a decision. | Resolution state, actual decision-maker, timestamp and evidence link. If unresolved, retain open/escalated state. |

Classify intervention as **AUTOMATE** (repeatable, validated rule/action candidate), **STANDARD SOP** (bounded operator step), **SPECIALIST** (qualified judgement outside scope), or **EXCEPTION** (missing inputs, conflicting state or non-standard case). Classification is not permission to automate a decision. For each intervention record customer/environment, control, owner, reason/class, action, start/end, result, escalation and evidence reference. Count **active operator minutes** for hands-on work and **waiting minutes separately** for customer, system or specialist delay. Record elapsed time as well; do not charge passive waiting as operator effort or count an unresolved item as completed.

### Activation failure and customer handoff

Before setup, verify customer inputs, approved isolated environment, configuration owner and synthetic-versus-real-data authority. Record automated and manual steps, validation failures, customer-dependent waits and QA. A failed pre-live activation with ambiguous partial writes is **quarantined for inspection**: stop further writes; do not retry against the dirty target, silently clean it or replay partial SQL. Recreate from validated inputs only after confirming the target has no real data and the action is authorised. If real data or a production resource is involved, stop for founder approval and an explicit recovery decision.

Before handoff, verify intended roles/access, actionable controls and ownership, invitations/email delivery, document privacy, support owner and monitoring route. List incomplete configuration and who owns each item. Do not call activation complete while access, evidence or ownership is unverified. These checks need a rehearsal and measured operator time before the ≤2-business-day / ≤8-operator-hour target can be claimed.

### Next synthetic activation rehearsal — operator-time and exception worksheet

Use this section as a one-run note inside the existing execution evidence, not a new tracker or a customer-facing target. Record run date, synthetic fixture/version, approved disposable target, operator, start/end timestamps and evidence references. Verify target/account identity and synthetic-only authority before any write; do not rerun the F2 one-shot acceptance helper or use the contaminated F1 target as a buyer baseline. The F1 239.0-second command and F2 218.4-second command are importer/acceptance timings, **not** total activation elapsed or active operator time.

| Stage to time, in order | Record for this run |
| --- | --- |
| Input receipt and preflight | Input completeness, missing/ambiguous fields, customer-dependent wait, validation/rework, approved target and clean-state check. |
| Environment and operator access | Setup/configuration, identity and permission checks, hands-on minutes and system wait. |
| Factory preview and commit | Separate preview, commit and verification timestamps; capture command/service timing as automated elapsed, plus actual human supervision or correction as active minutes. Record import counts and historical-versus-new-starter join-work assertions. |
| Remaining manual configuration | Time positions, policies, onboarding/offboarding, document categories/requirements and Hire setup separately; department/location free text is not catalog configuration. Mark each as completed, excluded by approved scope, or still open. |
| Invitations and end-to-end QA | Verify delivery rather than only invitation row creation; test intended roles, actionable control owners, private documents and monitoring/support route. Record each failed check and retest. |
| Handoff decision | Record open items with named owner and due date; handoff timestamp only after required access, evidence, ownership and support checks pass. Otherwise mark blocked, not complete. |

For each stage capture **start/end, active operator minutes, passive system/customer/specialist waiting minutes, automated elapsed, result, and evidence reference**. Log every undocumented step or intervention with trigger, exact action, owner, minutes, outcome and proposed **AUTOMATE / STANDARD SOP / SPECIALIST / EXCEPTION** class; an automation candidate is not approval to automate. Keep unresolved exceptions open with the next owner/action. Sum active minutes without double-counting parallel waits; report wall-clock start-to-handoff separately and label any missing segment **unmeasured**, never zero. Do not claim the ≤2-business-day / ≤8-operator-hour target from an importer run or an incomplete handoff.

On identity mismatch, unexpected rows, partial commit, failed verification or uncertain cleanup, stop writes and quarantine the target with the failed stage, observed state and evidence. Do not retry, patch rows to improve the result or silently reset; follow the activation-failure rule above and obtain the required recovery decision before a fresh synthetic run.

### Specialist referral

Describe the factual issue and required decision without offering advice. Confirm the customer authorises a referral and the recipient/channel is approved; share only the minimum necessary information through the approved private route. Record the referral owner, date, status and decision source. The specialist advises within a separate engagement; the customer remains responsible for the decision. Keep the control open until an authorised resolution is recorded.
