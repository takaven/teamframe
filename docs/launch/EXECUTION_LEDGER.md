# TeamFrame 45-day execution ledger

**Single execution tracker.** States: PROVE, IMPLEMENT, DOCUMENT, PASS, BLOCKED, CUT, DEFERRED. Before IMPLEMENT, set target/max active hours and stop condition. Maximum three concurrent technical workstreams.

Milestones: **M1 Production trustworthy** · **M2 Product wedge visible** · **M3 Private launch ready** · **M4 First external buyer exposure** · **M5 Paid/financially committed launch partner** · **M6 Public launch**.

Daily question: **Are current tasks moving TeamFrame toward M5/M6, or merely closing technical tickets?** Current milestone M1/M2; Day 45 date follows actual execution start, not a fabricated date.

| ID | Milestone | Workstream | Task | Depends On | Blocks | Agent | State | Effort Used | Effort Ceiling | Evidence | Decision | Approval |
| -- | --------- | ---------- | ---- | ---------- | ------ | ----- | ----- | ----------: | -------------: | -------- | -------- | -------- |
| G0 | M1–M6 | Governance | Establish canonical scope, plan, agent rules, ledger, decisions, README links | Locked blueprint | All workstreams | Main Orchestrator | DOCUMENT | 0.5h | 3h max; stop at minimum controls | Commit pending | No further beautification | None |
| S1 | M1 | Security / Platform | Verify TAKAVEN synthetic project, current migration state, auth/RLS/storage/email/backup/restore/Sentry exposure | G0; disposable project identity | Production trust gate | Security / Platform | PROVE | 0h this phase | Set target/max after proof, before IMPLEMENT | Project `syytforaidoorrvrbqwz`; local dependency patch `e91233f` | No ARIE project use; no Sentry major upgrade without exposure proof | Material auth/RLS redesign or real data only |
| F1 | M3 | Customer Factory | Measure unchanged 120-person provisioning and customer-input preflight; elapsed/operator/automated/manual time | G0; synthetic fixture | Activation bottleneck decisions | Customer Factory | PROVE | 0h | Set after proof | Existing provisioning scripts to inspect | No speculative rewrite | Meaningful spend or real data only |
| P1 | M2 | Product Control | Map existing TeamFrame/HirePass states to minimal Control Kernel and baseline buyer-visible journeys | G0 | Control Centre, three controls, Operator Mode | Product Control | PROVE | 0h | Set after proof | Existing Control Centre and manager services | No graph/workflow platform | New module or reduced boundary only |
| O1 | M3 | Managed Ops | Draft bounded service catalogue, exclusions, responsibility matrix, intervention classification | G0; scope | Operator Mode/SOPs | Managed Ops | PROVE | 0h | Set after proof | Locked plan | No contractual promise | Service-scope commitment requires approval |
| H1 | M2 | Hire / Continuity | Prove current Hire→People path and source-reference strategy | P1; F1 schema proof | Handoff implementation | Hire / Continuity | DEFERRED | 0h | Set after proof | HirePass baseline | No shared DB or live sync | Material architecture only |
| C1 | M4–M5 | Commercial / Trust | Prepare buyer evidence and offer for later controlled activation | M2/M3 proof | First buyer exposure | Commercial / Trust | DEFERRED | 0h | Set after proof | Buyer-visible baseline pending | No external activation yet | First external activation and pricing |
| L1 | M6 | Launch | Day-44 GO/MODIFY/STOP then conditional Day-45 public launch | M1–M5 | Public launch | Main Orchestrator | DEFERRED | 0h | Set later | No launch evidence yet | Gate must be evidence-based | Founder public-launch approval |

Founder interruptions: password handoff for synthetic project was required operational input; repeated terminal visibility troubleshooting was avoidable and should not recur. No new founder approval is pending for governance.
