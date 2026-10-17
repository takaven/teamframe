# TeamFrame execution agents

Before making claims or changes about Production, Founder Review, deployment, environment identity, launch readiness, customer data, branches, access/recovery or infrastructure, start with [SYSTEM-HANDOVER](docs/operations/SYSTEM-HANDOVER.md), then read [CURRENT-STATE](docs/operations/CURRENT-STATE.md), [MANUAL-ACTIONS](docs/operations/MANUAL-ACTIONS.md) and [ENVIRONMENTS](docs/operations/ENVIRONMENTS.md). Current authority is domain-specific: [DEPLOYMENT](docs/operations/DEPLOYMENT.md) governs deployment/change procedure; [TEAMFRAME_ACCESS_MODEL](TEAMFRAME_ACCESS_MODEL.md) governs the access/deployment model; [TEAMFRAME_MANAGED_PEOPLE_OPS_SCOPE](TEAMFRAME_MANAGED_PEOPLE_OPS_SCOPE.md) and [DECISIONS](docs/launch/DECISIONS.md) govern current product/commercial positioning. Historical plans and ledgers are evidence, not current operational authority. If current authority documents conflict, stop and reconcile them against live state before proceeding.

## Orchestrator

The main orchestrator controls priorities, dependencies, at most **three active technical workstreams**, effort ceilings, integration, and routine decisions. Phase-0 governance is capped at **3 active hours**. Every workstream proves current state, implements only a verified gap, documents final state, then stops. Before IMPLEMENT, record target hours, maximum hours, and stop condition in the ledger. Approach the ceiling: simplify, cut, defer, or escalate; never silently exceed it.

## Delegation

Bounded specialists may cover Security/Platform, Customer Factory, Product Control, Hire/Continuity, Managed Ops, Commercial/Trust, QA/Red Team, and Documentation. Each assignment states objective, existing capability to inspect, allowed and forbidden scope, dependencies, acceptance test, effort ceiling, evidence, and approval gates. Each handoff returns facts, changes, tests, risks, active effort, and PASS/FIX/CUT/ESCALATE recommendation. No agent may self-certify high-risk auth, RLS, migration, import, private-file, backup/restore, external-message, or security work before integration; require independent second-agent review.

Use bounded branches/worktrees where useful; integrate or justify within three execution days. Do not build an agent platform or competing tracker.

## Founder gates

Escalate only material strategy/scope, central cross-customer architecture, major auth/RLS redesign or reduced boundary, first real customer deployment or customer-data use/destruction, pricing/contracts/SLA/legal claims, meaningful spend, first external sales activation, or public launch. Routine implementation and documentation are orchestrator decisions. Classify every founder interruption as required approval or avoidable interruption.

Never use real employer or customer data in launch-test environments. Approved TAKAVEN synthetic project refs are maintained in `scripts/approved-launch-projects.mjs`; their current purposes and operating states are controlled by [ENVIRONMENTS](docs/operations/ENVIRONMENTS.md). [environment-parity](docs/launch/environment-parity.md) is historical environment-provenance evidence, not current identity authority. Verify the approval source and current environment record before use. The older externally associated project `qrsxoumymbcehtltbtgn` is **not** a test target.
For live Supabase work, verify the provider project against [ENVIRONMENTS](docs/operations/ENVIRONMENTS.md) and select the required signed-in account/role using [ACCOUNT-OWNERSHIP](docs/operations/ACCOUNT-OWNERSHIP.md) before any write. A correct project URL with the wrong browser account is not sufficient. Never infer that a password, migration, backup or access test passed from a command invocation alone.

## Quality policy

Fix every confirmed defect and investigate credible suspected defects. Evaluate commercially valuable improvements on customer evidence, benefit and maintenance burden. Founder approval is required for material spend, architecture, security-boundary or product-boundary changes. The historical feature freeze prevents speculative expansion; it is not permission to leave a known defect unresolved.

## Separate public marketing website (verified live 2026-10-13)

The live TeamFrame marketing website source is `takaven/takaven-web` at `teamframe/`, separate from this protected product application repository and `app.takaven.com`. The superseded `takaven/teamframe-site` repository was deleted by the founder after source reconciliation; do not recreate or reuse it. Do not deploy marketing assets here or edit the product application for a website release. When marketing positioning, canonical source or URL changes, reconcile the website README/operations, this application's README/current-state/decision record and the portfolio registry `takaven/product-portfolio/PORTFOLIO.yaml`; do not update generated portfolio documents by hand. Domain verification must be established from live provider state rather than dated documentation. Marketing website publication is not approval for real employee/customer data.
