# M20 Evidence Pack - Backup, PITR, and Recovery Readiness

## Objective
Demonstrate TeamFrame can be recovered from data loss, corruption, or deployment incidents within agreed recovery objectives.

Status: OPEN

Evidence rule:
- M20 is CLOSED only when every section below is PASS and each PASS has attached evidence.
- If any section is FAIL or missing evidence, M20 remains OPEN.

---

## Section 1 - Supabase Backup Configuration

### Environment
- Project Name: TeamFrame (production name to confirm in Supabase dashboard)
- Project ID: `eucnsrtdjxcylknbuglw` (derived from `NEXT_PUBLIC_SUPABASE_URL`)
- Region: Pending operator verification in Supabase dashboard

### Backup Tier
- Current Supabase Plan: Pending operator verification
- Backup Enabled: Pending operator verification (Yes / No)
- PITR Enabled: Pending operator verification (Yes / No)

### Evidence
- Screenshot attached: No
- Screenshot path or URL: TBD
- Date Verified: 2026-06-01 (partial, local evidence only)
- Verified By: Repo Orchestrator (local environment check)
- Additional Evidence: `NEXT_PUBLIC_SUPABASE_URL=https://eucnsrtdjxcylknbuglw.supabase.co`
- CLI Evidence: Supabase CLI unavailable locally (`supabase: command not found`)

Result:
- FAIL (dashboard-level backup/PITR evidence not yet attached)

---

## Section 2 - Recovery Objectives

### Recovery Point Objective (RPO)
Maximum acceptable data loss:
- Pending approval

### Recovery Time Objective (RTO)
Maximum acceptable recovery duration:
- Pending approval

Approved By:
- Pending

Date:
- Pending

Result:
- FAIL (RPO/RTO not approved)

---

## Section 3 - Recovery Procedure

Documented Procedure Location:
- Pending (must point to a concrete restore runbook path)

Procedure Includes:
- Restore initiation steps
- Responsible personnel
- Validation steps
- Rollback procedure
- Communication procedure

Result:
- FAIL (procedure not linked)

---

## Section 4 - Restore Test

### Test Date
- Pending

### Test Type
- PITR restore
- Backup restore
- Staging recovery
- Other

### Test Steps Performed
1.
2.
3.
4.

### Validation Performed
- Application accessible
- Authentication functional
- Database integrity verified
- Core workflows verified

### Outcome
PASS / FAIL
- FAIL (restore test not yet executed)

Notes:

Evidence links (logs, screenshots, query output):

---

## Section 5 - Final Sign-Off

Backup Configuration Verified:
- PASS / FAIL
- FAIL

Recovery Objectives Defined:
- PASS / FAIL
- FAIL

Recovery Procedure Documented:
- PASS / FAIL
- FAIL

Restore Test Completed:
- PASS / FAIL
- FAIL

M20 Status:
- CLOSED
- OPEN
- OPEN

Approved By:
- Pending

Date:
- Pending

---

## Closure Checklist (Binary)
- [ ] Section 1 PASS with evidence
- [ ] Section 2 PASS with approval
- [ ] Section 3 PASS with procedure link
- [ ] Section 4 PASS with restore test evidence
- [ ] Section 5 signed

When all boxes are checked, update `docs/launch/audit-findings-consolidated.md` M20 to Closed and include this file path in Verification Artifact.
