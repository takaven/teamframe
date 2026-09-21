# TeamFrame execution agents

The [45-day plan](docs/launch/TEAMFRAME_45_DAY_EXECUTION_PLAN.md) governs execution; the [scope](TEAMFRAME_MANAGED_PEOPLE_OPS_SCOPE.md) governs commercial positioning. [EXECUTION_LEDGER](docs/launch/EXECUTION_LEDGER.md) is the only task tracker; [DECISIONS](docs/launch/DECISIONS.md) records material choices. Technical documents remain authoritative within their technical domain.

## Orchestrator

The main orchestrator controls priorities, dependencies, at most **three active technical workstreams**, effort ceilings, integration, and routine decisions. Phase-0 governance is capped at **3 active hours**. Every workstream proves current state, implements only a verified gap, documents final state, then stops. Before IMPLEMENT, record target hours, maximum hours, and stop condition in the ledger. Approach the ceiling: simplify, cut, defer, or escalate; never silently exceed it.

## Delegation

Bounded specialists may cover Security/Platform, Customer Factory, Product Control, Hire/Continuity, Managed Ops, Commercial/Trust, QA/Red Team, and Documentation. Each assignment states objective, existing capability to inspect, allowed and forbidden scope, dependencies, acceptance test, effort ceiling, evidence, and approval gates. Each handoff returns facts, changes, tests, risks, active effort, and PASS/FIX/CUT/ESCALATE recommendation. No agent may self-certify high-risk auth, RLS, migration, import, private-file, backup/restore, external-message, or security work before integration; require independent second-agent review.

Use bounded branches/worktrees where useful; integrate or justify within three execution days. Do not build an agent platform or competing tracker.

## Founder gates

Escalate only material strategy/scope, central cross-customer architecture, major auth/RLS redesign or reduced boundary, first real customer deployment or customer-data use/destruction, pricing/contracts/SLA/legal claims, meaningful spend, first external sales activation, or public launch. Routine implementation and documentation are orchestrator decisions. Classify every founder interruption as required approval or avoidable interruption.

Never use real ARIE, Baynunah, or customer data in the launch-test environment. The approved TAKAVEN synthetic project is `syytforaidoorrvrbqwz`; the older ARIE-associated project `qrsxoumymbcehtltbtgn` is **not** a test target.
For live Supabase work, verify the signed-in `admin@takaven.com` account and the project against [environment identity](docs/launch/environment-parity.md) before any write. A correct project URL with the wrong browser account is not sufficient. Never infer that a password, migration, backup or access test passed from a command invocation alone.
