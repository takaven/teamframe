/**
 * Northstar demo seed plan verification (pure, no DB).
 *
 * The seed script itself needs live Supabase credentials, so the demonstrable
 * guarantees live in the pure plan (scripts/lib/demo-plan.mjs) and are locked
 * here: the org shape, the scenario coverage every module needs, referential
 * integrity between the plan's keyed collections, and determinism.
 */
import { describe, expect, it } from "vitest";
import { buildDemoPlan, dateOnlyDaysFrom } from "../scripts/lib/demo-plan.mjs";

const NOW = new Date("2026-07-03T12:00:00.000Z");
const TODAY = dateOnlyDaysFrom(NOW, 0);
const PLAN = buildDemoPlan(NOW);

describe("demo seed plan — tenant identity", () => {
  it("is the Northstar professional-services tenant", () => {
    expect(PLAN.company.slug).toBe("northstar");
    expect(PLAN.company.name).toBe("Northstar Advisory");
    expect(PLAN.company.employee_number_prefix).toBe("NS");
  });

  it("carries no trace of the retired FPORS fixture", () => {
    const serialized = JSON.stringify(PLAN).toLowerCase();
    for (const remnant of [
      "sara founder",
      "demo-fpors",
      "demo fpors",
      "fpors",
      "lina operations",
      "omar new hire",
      "red-yellow-signal",
    ]) {
      expect(serialized).not.toContain(remnant);
    }
  });
});

describe("demo seed plan — org shape", () => {
  it("has a credible 12–18 person roster across the configured departments", () => {
    expect(PLAN.employees.length).toBeGreaterThanOrEqual(12);
    expect(PLAN.employees.length).toBeLessThanOrEqual(18);

    const departmentNames = new Set(PLAN.departments.map((d) => d.name));
    expect(departmentNames).toEqual(
      new Set(["Leadership", "Advisory", "Finance", "Operations", "People"]),
    );
    for (const employee of PLAN.employees) {
      expect(departmentNames.has(employee.department)).toBe(true);
    }
  });

  it("preserves the already-accepted synthetic identities", () => {
    const names = PLAN.employees.map((e) => e.full_name);
    expect(names).toContain("Maya Chen");
    expect(names).toContain("Jordan Vale");
    expect(names.some((n) => n.startsWith("Luca "))).toBe(true);
    expect(names.some((n) => n.startsWith("Nina "))).toBe(true);
  });

  it("has exactly one unmanaged founder/MD and no orphan or self-referencing managers", () => {
    const keys = new Set(PLAN.employees.map((e) => e.key));
    const roots = PLAN.employees.filter((e) => e.managerKey === null);
    expect(roots.length).toBe(1);
    expect(roots[0]?.key).toBe(PLAN.adminEmployeeKey);

    for (const employee of PLAN.employees) {
      if (employee.managerKey === null) continue;
      expect(employee.managerKey).not.toBe(employee.key);
      expect(keys.has(employee.managerKey)).toBe(true);
    }
  });

  it("has a leadership layer reporting to the MD, and ICs below it", () => {
    const leadership = PLAN.employees.filter((e) => e.managerKey === PLAN.adminEmployeeKey);
    expect(leadership.length).toBeGreaterThanOrEqual(3);
    const leadershipKeys = new Set(leadership.map((e) => e.key));
    const individualContributors = PLAN.employees.filter(
      (e) => e.managerKey !== null && !leadershipKeys.has(e.key),
    );
    expect(individualContributors.length).toBeGreaterThanOrEqual(8);
  });

  it("mirrors the reporting lines in positions, with one open seat", () => {
    const positionKeys = new Set(PLAN.positions.map((p) => p.key));
    const employeeKeys = new Set(PLAN.employees.map((e) => e.key));

    const roots = PLAN.positions.filter((p) => p.parentKey === null);
    expect(roots.length).toBe(1);

    for (const position of PLAN.positions) {
      if (position.parentKey !== null) {
        expect(position.parentKey).not.toBe(position.key);
        expect(positionKeys.has(position.parentKey)).toBe(true);
      }
      if (position.employeeKey !== null) {
        expect(employeeKeys.has(position.employeeKey)).toBe(true);
      }
    }

    // one position per employee (the DB allows a single active assignment)
    const assigned = PLAN.positions
      .map((p) => p.employeeKey)
      .filter((key): key is string => key !== null);
    expect(new Set(assigned).size).toBe(assigned.length);
    expect(new Set(assigned)).toEqual(employeeKeys);
    expect(PLAN.positions.filter((p) => p.employeeKey === null).length).toBe(1);
  });
});

describe("demo seed plan — leave", () => {
  it("has pending and approved requests, all against configured definitions", () => {
    const codes = new Set(PLAN.leaveDefinitions.map((d) => d.code));
    expect(PLAN.leaves.filter((l) => l.status === "pending").length).toBeGreaterThanOrEqual(1);
    expect(PLAN.leaves.filter((l) => l.status === "approved").length).toBeGreaterThanOrEqual(1);

    for (const leave of PLAN.leaves) {
      expect(codes.has(leave.definitionCode)).toBe(true);
      expect(leave.end_date >= leave.start_date).toBe(true);
      expect(leave.requested_days).toBeGreaterThan(0);
    }
  });

  it("has exactly one employee with overlapping requests (the leave_conflict demo)", () => {
    const byEmployee = new Map<string, { start_date: string; end_date: string }[]>();
    for (const leave of PLAN.leaves) {
      const list = byEmployee.get(leave.employeeKey) ?? [];
      list.push(leave);
      byEmployee.set(leave.employeeKey, list);
    }

    const conflicted = [...byEmployee.entries()].filter(([, list]) => {
      const sorted = [...list].sort((a, b) => a.start_date.localeCompare(b.start_date));
      return sorted.some(
        (leave, index) => index > 0 && leave.start_date <= (sorted[index - 1]?.end_date ?? ""),
      );
    });

    expect(conflicted.length).toBe(1);
    const conflictedKey = conflicted[0]?.[0];
    expect(PLAN.signals.some((s) => s.kind === "leave_conflict" && s.employeeKey === conflictedKey)).toBe(true);
  });

  it("keeps each employee's requests distinguishable for the idempotent upsert", () => {
    const keys = PLAN.leaves.map((l) => `${l.employeeKey}:${l.status}:${l.start_date}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("demo seed plan — onboarding (mid-onboarding with overdue tasks)", () => {
  it("has an employee mid-onboarding (preboarding lifecycle with tasks assigned)", () => {
    const midOnboarding = PLAN.employees.filter((e) => e.lifecycle_state === "preboarding");
    expect(midOnboarding.length).toBeGreaterThanOrEqual(1);
    const keys = new Set(midOnboarding.map((e) => e.key));
    const theirTasks = PLAN.onboardingTasks.filter((t) => keys.has(t.employeeKey));
    // mid-onboarding = at least one completed AND at least one still pending
    expect(theirTasks.some((t) => t.status === "completed")).toBe(true);
    expect(theirTasks.some((t) => t.status === "pending")).toBe(true);
  });

  it("has at least one OVERDUE pending task using the due_date column", () => {
    const overdue = PLAN.onboardingTasks.filter(
      (t) => t.status === "pending" && t.due_date !== null && t.due_date < TODAY,
    );
    expect(overdue.length).toBeGreaterThanOrEqual(1);
  });

  it("respects the completed_at DB constraint (completed ⇔ completed_at set)", () => {
    for (const task of PLAN.onboardingTasks) {
      if (task.status === "completed") {
        expect(task.completed_at).not.toBeNull();
      } else {
        expect(task.completed_at).toBeNull();
      }
    }
  });

  it("only declares a required document type on document_required tasks", () => {
    for (const task of PLAN.onboardingTasks) {
      if (task.completion_mode === "document_required") {
        expect(task.required_document_type).not.toBeNull();
      } else {
        expect(task.required_document_type).toBeNull();
      }
      // policy_acknowledgement tasks would be auto-completed by a DB trigger
      // when the seeded acknowledgements land, so the plan never uses them.
      expect(task.completion_mode).not.toBe("policy_acknowledgement");
    }
  });
});

describe("demo seed plan — documents", () => {
  it("has at least one expiring document (future expiry within 30 days)", () => {
    const in30Days = new Date(NOW);
    in30Days.setUTCDate(in30Days.getUTCDate() + 30);
    const expiring = PLAN.documents.filter(
      (d) =>
        d.expires_at !== null &&
        new Date(d.expires_at) > NOW &&
        new Date(d.expires_at) <= in30Days,
    );
    expect(expiring.length).toBeGreaterThanOrEqual(1);
  });

  it("has at least one already-expired document (red signal subject)", () => {
    const expired = PLAN.documents.filter(
      (d) => d.expires_at !== null && new Date(d.expires_at) < NOW,
    );
    expect(expired.length).toBeGreaterThanOrEqual(1);
  });

  it("leaves every evidence request open, so no DB trigger rewrites the seed", () => {
    expect(PLAN.documentRequirements.length).toBeGreaterThanOrEqual(1);
    for (const requirement of PLAN.documentRequirements) {
      expect(requirement.state).toBe("requested");
    }
  });
});

describe("demo seed plan — policies (publish → acknowledge loop)", () => {
  it("has published versioned policies plus a draft", () => {
    const published = PLAN.policies.filter((p) => p.is_published);
    expect(published.length).toBeGreaterThanOrEqual(2);
    expect(PLAN.policies.some((p) => !p.is_published)).toBe(true);
    expect(published.some((p) => p.version > 1)).toBe(true);
    for (const policy of PLAN.policies) {
      expect(policy.version).toBeGreaterThanOrEqual(1);
    }
  });

  it("acknowledges published policies PARTIALLY — never all of them, never nobody", () => {
    expect(PLAN.acknowledgements.length).toBeGreaterThan(0);
    const total = PLAN.employees.length;
    for (const policy of PLAN.policies.filter((p) => p.is_published)) {
      const acked = PLAN.acknowledgements.filter((a) => a.policyKey === policy.key);
      expect(acked.length).toBeGreaterThan(0);
      expect(acked.length).toBeLessThan(total);
    }
    // the draft policy is never acknowledged
    for (const policy of PLAN.policies.filter((p) => !p.is_published)) {
      expect(PLAN.acknowledgements.some((a) => a.policyKey === policy.key)).toBe(false);
    }
  });
});

describe("demo seed plan — early employment and employment changes", () => {
  it("tracks probation across scheduled, due and completed states", () => {
    expect(PLAN.probationReviews.length).toBeGreaterThanOrEqual(1);
    const states = new Set(PLAN.probationReviews.map((r) => r.status));
    expect(states.has("completed")).toBe(true);

    for (const review of PLAN.probationReviews) {
      expect(review.review_due_date <= review.probation_end_date).toBe(true);
      if (review.status === "completed") {
        expect(review.outcome).not.toBeNull();
        expect(review.completed_at).not.toBeNull();
      } else {
        expect(review.outcome).toBeNull();
        expect(review.completed_at).toBeNull();
      }
    }
  });

  it("has an applied change and a pending one with a future effective date", () => {
    expect(PLAN.employmentChanges.some((c) => c.status === "applied" && c.applied_at !== null)).toBe(true);
    const pending = PLAN.employmentChanges.filter((c) => c.status === "pending");
    expect(pending.length).toBeGreaterThanOrEqual(1);
    for (const change of pending) {
      expect(change.effective_date > TODAY).toBe(true);
      expect(change.applied_at).toBeNull();
    }
    for (const change of PLAN.employmentChanges) {
      expect(change.change_keys.length).toBeGreaterThan(0);
      for (const key of change.change_keys) {
        expect(Object.keys(change.new_values)).toContain(key);
        expect(Object.keys(change.old_values)).toContain(key);
      }
    }
  });
});

describe("demo seed plan — signal categories", () => {
  const openSignals = PLAN.signals.filter((s) => s.resolved_at === null);

  it("has at least one open red signal", () => {
    expect(openSignals.filter((s) => s.severity === "red").length).toBeGreaterThanOrEqual(1);
  });

  it("has at least two open yellow signals", () => {
    expect(openSignals.filter((s) => s.severity === "yellow").length).toBeGreaterThanOrEqual(2);
  });

  it("has at least one resolved signal, with its action done", () => {
    const resolved = PLAN.signals.filter((s) => s.resolved_at !== null);
    expect(resolved.length).toBeGreaterThanOrEqual(1);
    for (const signal of resolved) {
      expect(signal.action_status).toBe("done");
    }
  });

  it("uses only signal kinds the engine knows", () => {
    const known = new Set([
      "missing_contract",
      "expired_document",
      "expiring_document",
      "unacknowledged_policy",
      "incomplete_onboarding",
      "incomplete_offboarding",
      "active_access_after_exit",
      "unreturned_asset",
      "missing_jurisdiction_requirement",
      "leave_conflict",
    ]);
    for (const signal of PLAN.signals) {
      expect(known.has(signal.kind)).toBe(true);
    }
  });

  it("respects the open-document uniqueness index (one open signal per document)", () => {
    const openDocumentSignals = PLAN.signals.filter(
      (s) =>
        s.resolved_at === null &&
        (s.kind === "expiring_document" || s.kind === "expired_document") &&
        s.documentKey !== null,
    );
    const keys = openDocumentSignals.map((s) => `${s.kind}:${s.documentKey}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("every signal carries complete founder-readable evidence", () => {
    for (const signal of PLAN.signals) {
      expect(signal.evidence.what_is_wrong.length).toBeGreaterThan(0);
      expect(signal.evidence.why_it_matters.length).toBeGreaterThan(0);
      expect(signal.evidence.what_to_do_next.length).toBeGreaterThan(0);
    }
  });

  it("signal subjects reference employees and documents that exist in the plan", () => {
    const employeeKeys = new Set(PLAN.employees.map((e) => e.key));
    const documentKeys = new Set(PLAN.documents.map((d) => d.key));
    for (const signal of PLAN.signals) {
      expect(employeeKeys.has(signal.employeeKey)).toBe(true);
      if (signal.documentKey !== null) {
        expect(documentKeys.has(signal.documentKey)).toBe(true);
      }
    }
  });
});

describe("demo seed plan — referential integrity", () => {
  it("every keyed reference resolves to a row in the plan", () => {
    const employeeKeys = new Set(PLAN.employees.map((e) => e.key));
    const policyKeys = new Set(PLAN.policies.map((p) => p.key));

    for (const collection of [
      PLAN.documents,
      PLAN.documentRequirements,
      PLAN.onboardingTasks,
      PLAN.leaves,
      PLAN.probationReviews,
      PLAN.employmentChanges,
      PLAN.acknowledgements,
    ]) {
      for (const row of collection) {
        expect(employeeKeys.has(row.employeeKey)).toBe(true);
      }
    }

    for (const acknowledgement of PLAN.acknowledgements) {
      expect(policyKeys.has(acknowledgement.policyKey)).toBe(true);
    }

    expect(employeeKeys.has(PLAN.adminEmployeeKey)).toBe(true);
  });
});

describe("demo seed plan — hygiene", () => {
  it("uses clearly-fake identities only (.example emails, no real PII)", () => {
    for (const employee of PLAN.employees) {
      expect(employee.email.endsWith("@northstar.example")).toBe(true);
    }
  });

  it("gives every employee a stable, tenant-scoped identity", () => {
    for (const employee of PLAN.employees) {
      expect(employee.key.length).toBeGreaterThan(0);
      expect(employee.employee_number).toMatch(/^NS-\d{4}$/);
      const [local] = employee.email.split("@");
      expect(local).toBe(employee.full_name.toLowerCase().replace(/\s+/g, "."));
    }

    const keys = PLAN.employees.map((e) => e.key);
    expect(new Set(keys).size).toBe(keys.length);
    const numbers = PLAN.employees.map((e) => e.employee_number);
    expect(new Set(numbers).size).toBe(numbers.length);
  });

  it("idempotency keys are unique across every collection", () => {
    const emails = PLAN.employees.map((e) => e.email);
    expect(new Set(emails).size).toBe(emails.length);

    const departmentNames = PLAN.departments.map((d) => d.name);
    expect(new Set(departmentNames).size).toBe(departmentNames.length);

    const definitionCodes = PLAN.leaveDefinitions.map((d) => d.code);
    expect(new Set(definitionCodes).size).toBe(definitionCodes.length);

    // positions are looked up by (tenant, title) — titles must be distinct
    const positionTitles = PLAN.positions.map((p) => p.title);
    expect(new Set(positionTitles).size).toBe(positionTitles.length);

    const docKeys = PLAN.documents.map((d) => `${d.employeeKey}:${d.document_type}`);
    expect(new Set(docKeys).size).toBe(docKeys.length);

    const requirementKeys = PLAN.documentRequirements.map((r) => `${r.employeeKey}:${r.document_type}`);
    expect(new Set(requirementKeys).size).toBe(requirementKeys.length);

    const taskKeys = PLAN.onboardingTasks.map((t) => `${t.employeeKey}:${t.title}`);
    expect(new Set(taskKeys).size).toBe(taskKeys.length);

    const policyTitles = PLAN.policies.map((p) => p.title);
    expect(new Set(policyTitles).size).toBe(policyTitles.length);

    const ackKeys = PLAN.acknowledgements.map((a) => `${a.policyKey}:${a.employeeKey}`);
    expect(new Set(ackKeys).size).toBe(ackKeys.length);

    const probationKeys = PLAN.probationReviews.map((r) => r.employeeKey);
    expect(new Set(probationKeys).size).toBe(probationKeys.length);

    const changeKeys = PLAN.employmentChanges.map((c) => c.idempotency_key);
    expect(new Set(changeKeys).size).toBe(changeKeys.length);
  });

  it("is deterministic for a fixed now", () => {
    expect(buildDemoPlan(NOW)).toEqual(buildDemoPlan(NOW));
    expect(buildDemoPlan(new Date(NOW))).toEqual(PLAN);
  });

  it("derives every date from the reference timestamp (no wall-clock drift)", () => {
    const shifted = buildDemoPlan(new Date("2027-01-15T09:30:00.000Z"));
    expect(shifted).not.toEqual(PLAN);
    expect(shifted.company).toEqual(PLAN.company);
    expect(shifted.employees.map((e) => e.full_name)).toEqual(PLAN.employees.map((e) => e.full_name));
  });
});
