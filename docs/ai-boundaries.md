# AI Boundaries

TeamFrame currently ships with no active AI module.

## Current Product Boundary

- `/lib/ai` is not part of the current codebase.
- No production route or service is allowed to depend on AI for core product behavior.
- `OPENAI_API_KEY` is not a required runtime dependency for the shipped flow.

## Hard Prohibitions

Until a new AI scope is approved, TeamFrame must not:

- add AI-driven user flows to auth, onboarding, leave, employee, or dashboard paths
- send employee profile or compensation data to external AI providers
- introduce AI calls from client components
- gate core workflows behind AI availability

## Re-introduction Rule

AI may only be re-introduced through a dedicated product decision that includes:

- explicit scope and boundaries
- security and privacy review
- updated architecture documentation
- tests and fallback behavior for provider outages
