# Phase A existing-configuration review

Date: 2026-10-08  
Scope: aggregate-safe review instructions for the Phase A correctness release.

No live or customer tenant was queried during implementation. The repository contains synthetic fixtures only; no committed artifact contains tenant names, employee names, or configuration values from a live customer.

## Leave timing

The prior model allowed both `joining_date_pro_rata` and `accrual_enabled`. For an annual value of 30 and a 1 April 2026 start, the previous calculation reduced the annual value to 22.60 and then accrued from that reduced amount, producing 16.95 by year end. Phase A calculates accrued-to-date from the configured annual value and caps it at the applicable entitlement, so the same entitlement is not reduced twice.

Monthly accrual now uses one inclusive calendar-day convention for partial first and final months. For each month, the configured annual value is divided by 12 and multiplied by eligible service days divided by calendar days in that month. For example, service from 15–30 April is 16 eligible days out of 30. Intermediate calculations retain PostgreSQL numeric precision; only the final projected accrual is rounded once to two decimal places, matching the existing ledger/display convention. Joining-date proration remains a separate strategy and is not combined with monthly accrual for new or edited definitions.

Existing dual-strategy rows are not rewritten. The new constraint is `NOT VALID`, the UI labels them **Timing review required**, and all new writes require one explicit timing choice.

Secure operator review, when separately authorised, should report only aggregate counts by workspace:

```sql
select tenant_id, count(*) as definitions_requiring_review
from leave_definitions
where archived_at is null and accrual_enabled and joining_date_pro_rata
group by tenant_id
order by tenant_id;
```

## Probation

Existing probation rows, dates, manager input, outcomes, evidence, and automation history are preserved. New probation reviews are scheduled only when an explicit contractual end date is supplied. The operational 30-day check-in remains independent.

Potential legacy rows can be identified for administrator confirmation without changing them:

```sql
select e.tenant_id, count(*) as potential_legacy_ninety_day_rows
from probation_reviews p
join employees e on e.tenant_id = p.tenant_id and e.id = p.employee_id
where e.start_date is not null and p.probation_end_date = e.start_date + 90
group by e.tenant_id
order by e.tenant_id;
```

The result is a review queue, not proof that any individual record is wrong.

## Country-derived document signals

The runtime inference is retired. The migration dismisses open linked actions, resolves the old signals with the reason `RULE RETIRED — APPLICABILITY REQUIRES EXPLICIT CONFIRMATION`, and writes an idempotent audit entry. It does not change explicit document requirements or document evidence.

## Safety outcome

- Leave ledger and historical requests: unchanged.
- Existing leave settings: unchanged; ambiguous dual settings are flagged for review.
- Existing probation records: unchanged.
- Explicit document requirements and evidence: unchanged.
- Customer data reviewed or exported: none.
