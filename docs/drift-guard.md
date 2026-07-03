# Drift Guard — Detailed Bans

Restates the scope bans already locked in [`README.md`](../README.md) and
[`docs/business/blueprint-locked.md`](business/blueprint-locked.md). This file adds
no new rules. If it ever disagrees with those sources, they win.

---

## Banned features (README "What TeamFrame is NOT")

Do not add any of the following (README, "What TeamFrame is NOT"):

- payroll
- benefits
- accounting / tax / compliance engines
- analytics dashboards / HR metrics / engagement scoring
- AI HR advisor / chatbot / copilot
- employee scoring, ranking, personality inference
- hiring pipelines / ATS
- onboarding **workflows** (tasks, reminders, checklists, automation states)
- reminders / notifications engine
- approvals engine, e-signatures, document versioning, retention engines
- performance reviews, compensation benchmarking
- integrations marketplace, Zapier/webhooks ecosystem
- workflow orchestration, automation platform
- plugin / extension systems
- enterprise admin systems, custom RBAC beyond `admin` / `employee`

If a feature resembles **enterprise HRIS**, **workflow automation**, or **AI assistant
platform** behavior — it is **V2** and must be rejected.

## Deletion-on-sight categories (blueprint §12 "Hard Boundaries")

TeamFrame must NEVER become (blueprint-locked.md §12; also Hard Rule 4 in §"Hard rules"):

- payroll engine
- ATS / recruitment tool
- performance management system
- compensation system
- EOR platform
- legal automation system

Any feature proposal that drifts into these is rejected at intake.

## Anti-drift rules (README "Anti-drift rules")

1. No new module unless it's already in the README allow list.
2. No AI surface in V1 (see README "AI limitations" and `docs/ai-boundaries.md`).
3. No new role beyond `admin` and `employee` (see `docs/rbac-rules.md`).
4. No new background subsystem (queue, scheduler, worker, event bus) in V1.
5. No premature scalability work (multi-region, sharding, microservices).
6. No client-side authorization as a security boundary.
7. No service-role key in any code path reachable from the browser.

## Object model is closed (blueprint §5)

Only the blueprint §5 objects exist (Person, Employment, Document, Asset, Policy,
PolicyAcknowledgement, LeaveRequest, Event, RiskSignal, ActionItem). New objects
require explicit blueprint amendment. Every feature must map to a Signal or an
Action — no standalone modules (blueprint §5, Hard Rule 3).

## Sanity check before any feature (README "Coding principles")

1. Does this move setup closer to or further from 72-hour readiness?
2. Does this reuse existing entities/tables?
3. Does this introduce workflow automation, HR-ops logic, analytics, or AI scope creep?
4. Can it ship without a new subsystem?

If any answer trends toward complexity, the feature is **V2**.

## Changing these rules

This file is derivative. Change the source, not this file: README changes per the
README's own contract ("the README wins until the README is changed"); blueprint
changes require explicit founder approval per blueprint-locked.md §18.
