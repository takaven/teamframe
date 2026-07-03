# M20 Evidence Pack - Backup, PITR, and Recovery Readiness

## Objective
Demonstrate TeamFrame can be recovered from data loss, corruption, or deployment incidents within agreed recovery objectives.

Status: OPEN

Evidence rule:
- M20 is CLOSED only when every section below is PASS and each PASS has attached evidence.
- If any section is FAIL or missing evidence, M20 remains OPEN.

Legend: any field marked `[FOUNDER]` awaits founder input from the Supabase dashboard. Everything else is pre-filled from the repo.

---

## Section 0 - Founder Step-by-Step (choose exactly one path)

Both paths below close Section 1. Path A is the recommended launch posture; Path B is an explicitly documented cost decision. Do not leave the choice implicit — record which path was taken in the evidence table.

### Path A - Enable PITR (recommended)

1. Sign in at https://supabase.com/dashboard and open the project `eucnsrtdjxcylknbuglw` (name shown in dashboard: record it below).
2. Confirm the plan: **Project Settings → Billing**. PITR requires the Pro plan (or higher) plus the PITR add-on. Upgrade if on Free.
3. Enable PITR: **Project Settings → Add-ons → Point in Time Recovery → Enable** (choose the retention window; 7 days is the minimum sensible setting for launch).
4. Wait for the add-on status to show as active, then open **Database → Backups → Point in Time** and confirm the "earliest restore point" timestamp is populating.
5. Take two screenshots: (1) the Add-ons page showing PITR enabled with its retention window; (2) the Database → Backups page showing the earliest/latest restore points.
6. Fill in the Section 1 evidence table below and set Section 1 Result to PASS.

### Path B - Stay on daily backups (documented tier decision)

1. Sign in at https://supabase.com/dashboard and open the project `eucnsrtdjxcylknbuglw`.
2. Confirm the plan: **Project Settings → Billing**. Daily backups require Pro (Free tier has no restorable backups — Free is NOT an acceptable launch posture; if the project is on Free, upgrading to Pro is the minimum for this path).
3. Open **Database → Backups → Scheduled backups** and confirm daily backups are listed with recent timestamps.
4. Take one screenshot of the Scheduled backups list showing at least one completed backup within the last 24h and the retention window (Pro default: 7 days).
5. Record the decision below: accepting daily backups means the RPO is up to 24 hours. This must be reflected in Section 2 (RPO cannot be approved lower than 24h on this path).
6. Fill in the Section 1 evidence table below and set Section 1 Result to PASS.

### Path decision record

- Path chosen (A = PITR / B = daily backups): [FOUNDER]
- If Path B: rationale for accepting up-to-24h data loss: [FOUNDER]
- Decision date: [FOUNDER]
- Decided by: [FOUNDER]

---

## Section 1 - Supabase Backup Configuration

### Environment
- Project Name: TeamFrame (dashboard name): [FOUNDER]
- Project ID: `eucnsrtdjxcylknbuglw` (derived from `NEXT_PUBLIC_SUPABASE_URL`)
- Region (dashboard → Project Settings → General): [FOUNDER]

### Backup Tier
- Current Supabase Plan (Free / Pro / Team): [FOUNDER]
- Daily Backup Enabled (Yes / No): [FOUNDER]
- PITR Enabled (Yes / No): [FOUNDER]
- Retention window (days): [FOUNDER]
- Earliest restore point shown in dashboard (timestamp): [FOUNDER]
- Latest backup completed at (timestamp): [FOUNDER]

### Evidence
- Screenshots attached (Yes / No): [FOUNDER]
- Screenshot list (paths or URLs — Path A requires 2, Path B requires 1):
  1. [FOUNDER] (Path A: Add-ons page with PITR + retention window / Path B: Scheduled backups list)
  2. [FOUNDER] (Path A only: Database → Backups restore-point range)
- Date Verified: [FOUNDER]
- Verified By: [FOUNDER]
- Additional Evidence: `NEXT_PUBLIC_SUPABASE_URL=https://eucnsrtdjxcylknbuglw.supabase.co` (repo, pre-filled)
- CLI Evidence: Supabase CLI unavailable locally (`supabase: command not found`) — dashboard evidence is the source of truth

Result:
- FAIL (dashboard-level backup/PITR evidence not yet attached — flips to PASS when the [FOUNDER] fields above are filled)

---

## Section 2 - Recovery Objectives

### Recovery Point Objective (RPO)
Maximum acceptable data loss:
- Proposed default: Path A (PITR) → 15 minutes; Path B (daily backups) → 24 hours
- Approved value: [FOUNDER]

### Recovery Time Objective (RTO)
Maximum acceptable recovery duration:
- Proposed default: 4 hours (restore-to-new-project + env cutover, per rollback runbook)
- Approved value: [FOUNDER]

Approved By:
- [FOUNDER]

Date:
- [FOUNDER]

Result:
- FAIL (RPO/RTO not approved — flips to PASS on founder approval above)

---

## Section 3 - Recovery Procedure

Documented Procedure Location:
- `docs/launch/runbooks/rollback-procedure.md` → section "Database Restore Procedure (Tested-Restore / Restore-to-New-Project)" (added Wave 4)

Procedure Includes:
- Restore initiation steps — YES (runbook, steps 1-6)
- Responsible personnel — YES (runbook, "Who executes")
- Validation steps — YES (runbook, "Post-Restore Verification Checklist")
- Rollback procedure — YES (same runbook, deploy-rollback sections)
- Communication procedure — PARTIAL: see `docs/launch/runbooks/incident-response.md` (communication templates still to be completed there)

Result:
- PASS (procedure documented and linked; communication templates tracked separately under incident-response runbook completion)

---

## Section 4 - Restore Test

Execute the "Database Restore Procedure (Tested-Restore / Restore-to-New-Project)" section of `docs/launch/runbooks/rollback-procedure.md` against a THROWAWAY new project (never production), then fill this section in.

### Test Date
- [FOUNDER]

### Test Type (circle one)
- PITR restore (Path A)
- Backup restore (Path B)
- Staging recovery
- Other: [FOUNDER]

### Test Steps Performed (from the runbook — record actual timestamps)
1. Restore initiated at: [FOUNDER]
2. New project available at: [FOUNDER]
3. Verification checklist completed at: [FOUNDER]
4. Throwaway project deleted at: [FOUNDER]

### Validation Performed (tick each — from runbook "Post-Restore Verification Checklist")
- [ ] Application accessible
- [ ] Authentication functional
- [ ] Database integrity verified (row counts + RLS spot checks)
- [ ] Core workflows verified (employee list, leave queue, signals)

### Outcome
PASS / FAIL
- [FOUNDER] (currently FAIL — restore test not yet executed)

Notes: [FOUNDER]

Evidence links (logs, screenshots, query output): [FOUNDER]

---

## Section 5 - Final Sign-Off

Backup Configuration Verified:
- PASS / FAIL
- FAIL — awaiting Section 1 [FOUNDER] fields

Recovery Objectives Defined:
- PASS / FAIL
- FAIL — awaiting Section 2 [FOUNDER] approval

Recovery Procedure Documented:
- PASS / FAIL
- PASS — runbook section added Wave 4 (see Section 3)

Restore Test Completed:
- PASS / FAIL
- FAIL — awaiting Section 4 [FOUNDER] execution

M20 Status:
- CLOSED
- OPEN
- OPEN

Approved By:
- [FOUNDER]

Date:
- [FOUNDER]

---

## Closure Checklist (Binary)
- [ ] Section 1 PASS with evidence
- [ ] Section 2 PASS with approval
- [ ] Section 3 PASS with procedure link
- [ ] Section 4 PASS with restore test evidence
- [ ] Section 5 signed

When all boxes are checked, update `docs/launch/audit-findings-consolidated.md` M20 to Closed and include this file path in Verification Artifact.
