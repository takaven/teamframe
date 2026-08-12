/**
 * Wave 4 — demo seed plan verification (pure, no DB).
 *
 * The seed script itself needs live Supabase credentials, so the demonstrable
 * guarantees live in the pure plan (scripts/lib/demo-plan.mjs) and are locked
 * here: every category the demo tenant must show is asserted against the plan.
 */
import { describe, expect, it } from "vitest";
import { buildDemoPlan, dateOnlyDaysFrom } from "../scripts/lib/demo-plan.mjs";

const NOW = new Date("2026-07-03T12:00:00.000Z");
const TODAY = dateOnlyDaysFrom(NOW, 0);

describe("demo seed plan — signal categories", () => {
  const plan = buildDemoPlan(NOW);
  const openSignals = plan.signals.filter((s) => s.resolved_at === null);

  it("has at least one open red signal", () => {
    expect(openSignals.filter((s) => s.severity === "red").length).toBeGreaterThanOrEqual(1);
  });

  it("has at least two open yellow signals", () => {
    expect(openSignals.filter((s) => s.severity === "yellow").length).toBeGreaterThanOrEqual(2);
  });

  it("has at least one resolved signal, with its action done", () => {
    const resolved = plan.signals.filter((s) => s.resolved_at !== null);
    expect(resolved.length).toBeGreaterThanOrEqual(1);
    for (const signal of resolved) {
      expect(signal.action_status).toBe("done");
    }
  });

  it("every signal carries complete founder-readable evidence", () => {
    for (const signal of plan.signals) {
      expect(signal.evidence.what_is_wrong.length).toBeGreaterThan(0);
      expect(signal.evidence.why_it_matters.length).toBeGreaterThan(0);
      expect(signal.evidence.what_to_do_next.length).toBeGreaterThan(0);
    }
  });

  it("signal subjects reference employees and documents that exist in the plan", () => {
    const employeeKeys = new Set(plan.employees.map((e) => e.key));
    const documentKeys = new Set(plan.documents.map((d) => d.key));
    for (const signal of plan.signals) {
      expect(employeeKeys.has(signal.employeeKey)).toBe(true);
      if (signal.documentKey !== null) {
        expect(documentKeys.has(signal.documentKey)).toBe(true);
      }
    }
  });
});

describe("demo seed plan — onboarding (mid-onboarding with overdue task)", () => {
  const plan = buildDemoPlan(NOW);

  it("has an employee mid-onboarding (preboarding lifecycle with tasks assigned)", () => {
    const midOnboarding = plan.employees.filter((e) => e.lifecycle_state === "preboarding");
    expect(midOnboarding.length).toBeGreaterThanOrEqual(1);
    const keys = new Set(midOnboarding.map((e) => e.key));
    const theirTasks = plan.onboardingTasks.filter((t) => keys.has(t.employeeKey));
    // mid-onboarding = at least one completed AND at least one still pending
    expect(theirTasks.some((t) => t.status === "completed")).toBe(true);
    expect(theirTasks.some((t) => t.status === "pending")).toBe(true);
  });

  it("has at least one OVERDUE pending task using the due_date column", () => {
    const overdue = plan.onboardingTasks.filter(
      (t) => t.status === "pending" && t.due_date !== null && t.due_date < TODAY,
    );
    expect(overdue.length).toBeGreaterThanOrEqual(1);
  });

  it("respects the completed_at DB constraint (completed ⇔ completed_at set)", () => {
    for (const task of plan.onboardingTasks) {
      if (task.status === "completed") {
        expect(task.completed_at).not.toBeNull();
      } else {
        expect(task.completed_at).toBeNull();
      }
    }
  });
});

describe("demo seed plan — documents", () => {
  const plan = buildDemoPlan(NOW);

  it("has at least one expiring document (future expiry within 30 days)", () => {
    const in30Days = new Date(NOW);
    in30Days.setUTCDate(in30Days.getUTCDate() + 30);
    const expiring = plan.documents.filter(
      (d) =>
        d.expires_at !== null &&
        new Date(d.expires_at) > NOW &&
        new Date(d.expires_at) <= in30Days,
    );
    expect(expiring.length).toBeGreaterThanOrEqual(1);
  });

  it("has at least one already-expired document (red signal subject)", () => {
    const expired = plan.documents.filter(
      (d) => d.expires_at !== null && new Date(d.expires_at) < NOW,
    );
    expect(expired.length).toBeGreaterThanOrEqual(1);
  });
});

describe("demo seed plan — policies (Wave 1 loop)", () => {
  const plan = buildDemoPlan(NOW);

  it("has at least one published policy and seeds NO acknowledgements", () => {
    expect(plan.policies.filter((p) => p.is_published).length).toBeGreaterThanOrEqual(1);
    // The plan intentionally has no acknowledgements collection at all:
    // published-but-unacknowledged must hold for every employee.
    expect("acknowledgements" in plan).toBe(false);
  });
});

describe("demo seed plan — leaves", () => {
  const plan = buildDemoPlan(NOW);

  it("has at least one pending leave with a valid date range", () => {
    const pending = plan.leaves.filter((l) => l.status === "pending");
    expect(pending.length).toBeGreaterThanOrEqual(1);
    for (const leave of pending) {
      expect(leave.end_date >= leave.start_date).toBe(true);
      expect(leave.leave_type).toBe("annual");
      expect(leave.requested_days).toBe(3);
    }
  });
});

describe("demo seed plan — hygiene", () => {
  const plan = buildDemoPlan(NOW);

  it("uses clearly-fake identities only (.example emails, no real PII)", () => {
    for (const employee of plan.employees) {
      expect(employee.email.endsWith(".example")).toBe(true);
    }
  });

  it("idempotency keys are unique (emails, document type per employee, task titles, policy titles)", () => {
    const emails = plan.employees.map((e) => e.email);
    expect(new Set(emails).size).toBe(emails.length);

    const docKeys = plan.documents.map((d) => `${d.employeeKey}:${d.document_type}`);
    expect(new Set(docKeys).size).toBe(docKeys.length);

    const taskKeys = plan.onboardingTasks.map((t) => `${t.employeeKey}:${t.title}`);
    expect(new Set(taskKeys).size).toBe(taskKeys.length);

    const policyTitles = plan.policies.map((p) => p.title);
    expect(new Set(policyTitles).size).toBe(policyTitles.length);
  });

  it("is deterministic for a fixed now", () => {
    expect(buildDemoPlan(NOW)).toEqual(buildDemoPlan(NOW));
  });
});
