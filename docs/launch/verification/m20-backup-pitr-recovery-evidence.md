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
- Project Name:
- Project ID:
- Region:

### Backup Tier
- Current Supabase Plan:
- Backup Enabled: Yes / No
- PITR Enabled: Yes / No

### Evidence
- Screenshot attached: Yes / No
- Screenshot path or URL:
- Date Verified:
- Verified By:

Result:
- PASS / FAIL

---

## Section 2 - Recovery Objectives

### Recovery Point Objective (RPO)
Maximum acceptable data loss:

### Recovery Time Objective (RTO)
Maximum acceptable recovery duration:

Approved By:

Date:

Result:
- PASS / FAIL

---

## Section 3 - Recovery Procedure

Documented Procedure Location:

Procedure Includes:
- Restore initiation steps
- Responsible personnel
- Validation steps
- Rollback procedure
- Communication procedure

Result:
- PASS / FAIL

---

## Section 4 - Restore Test

### Test Date

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

Notes:

Evidence links (logs, screenshots, query output):

---

## Section 5 - Final Sign-Off

Backup Configuration Verified:
- PASS / FAIL

Recovery Objectives Defined:
- PASS / FAIL

Recovery Procedure Documented:
- PASS / FAIL

Restore Test Completed:
- PASS / FAIL

M20 Status:
- CLOSED
- OPEN

Approved By:

Date:

---

## Closure Checklist (Binary)
- [ ] Section 1 PASS with evidence
- [ ] Section 2 PASS with approval
- [ ] Section 3 PASS with procedure link
- [ ] Section 4 PASS with restore test evidence
- [ ] Section 5 signed

When all boxes are checked, update `docs/launch/audit-findings-consolidated.md` M20 to Closed and include this file path in Verification Artifact.
