import { describe, expect, it } from "vitest";

import {
  ONBOARDING_TEMPLATE_PACKS,
  computeDueDate,
  dueOffsetLabel,
  expandTemplatePack,
  getTemplatePack,
  isTaskOverdue,
} from "@/services/onboardingService/templates";

describe("onboarding template packs (static data)", () => {
  it("ships exactly the three Wave 2 packs", () => {
    expect(ONBOARDING_TEMPLATE_PACKS.map((p) => p.id)).toEqual([
      "every_hire",
      "engineering",
      "operations",
    ]);
  });

  it("every pack has 5-8 tasks with non-empty titles and non-negative offsets", () => {
    for (const pack of ONBOARDING_TEMPLATE_PACKS) {
      expect(pack.tasks.length).toBeGreaterThanOrEqual(5);
      expect(pack.tasks.length).toBeLessThanOrEqual(8);
      for (const task of pack.tasks) {
        expect(task.title.trim().length).toBeGreaterThan(0);
        expect(task.dueOffsetDays).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(task.dueOffsetDays)).toBe(true);
      }
    }
  });

  it("getTemplatePack resolves known ids and rejects unknown ids", () => {
    expect(getTemplatePack("engineering")?.name).toBe("Engineering");
    expect(getTemplatePack("payroll_pack")).toBeNull();
    expect(getTemplatePack("")).toBeNull();
  });
});

describe("computeDueDate", () => {
  it("offset 0 is the start date itself (day 1)", () => {
    expect(computeDueDate("2026-07-01", 0)).toBe("2026-07-01");
  });

  it("adds day offsets within a month", () => {
    expect(computeDueDate("2026-07-01", 2)).toBe("2026-07-03");
    expect(computeDueDate("2026-07-01", 7)).toBe("2026-07-08");
  });

  it("rolls over month and year boundaries", () => {
    expect(computeDueDate("2026-01-30", 7)).toBe("2026-02-06");
    expect(computeDueDate("2026-12-29", 14)).toBe("2027-01-12");
  });

  it("handles leap-day arithmetic", () => {
    expect(computeDueDate("2028-02-27", 2)).toBe("2028-02-29");
  });

  it("accepts a full ISO timestamp base (employee created_at fallback)", () => {
    expect(computeDueDate("2026-07-01T15:30:00.000Z", 1)).toBe("2026-07-02");
  });

  it("rejects garbage input instead of producing a bogus date", () => {
    expect(() => computeDueDate("not-a-date", 1)).toThrow("INVALID_BASE_DATE");
    expect(() => computeDueDate("", 0)).toThrow("INVALID_BASE_DATE");
  });
});

describe("expandTemplatePack", () => {
  it("expands kept tasks in pack order with computed due dates", () => {
    const pack = getTemplatePack("every_hire")!;
    const all = pack.tasks.map((_, i) => i);
    const expanded = expandTemplatePack("every_hire", all, "2026-07-06");

    expect(expanded).toHaveLength(pack.tasks.length);
    expect(expanded.map((t) => t.title)).toEqual(pack.tasks.map((t) => t.title));
    expect(expanded[0]!.due_date).toBe(computeDueDate("2026-07-06", pack.tasks[0]!.dueOffsetDays));
  });

  it("omits removed tasks while preserving order", () => {
    const pack = getTemplatePack("engineering")!;
    const kept = [0, 2, 4];
    const expanded = expandTemplatePack("engineering", kept, "2026-07-06");

    expect(expanded.map((t) => t.title)).toEqual(kept.map((i) => pack.tasks[i]!.title));
  });

  it("ignores out-of-range and duplicate indexes", () => {
    const expanded = expandTemplatePack("operations", [0, 0, 99, -1, 1], "2026-07-06");
    expect(expanded).toHaveLength(2);
  });

  it("returns empty when every task was removed", () => {
    expect(expandTemplatePack("every_hire", [], "2026-07-06")).toEqual([]);
  });

  it("throws for an unknown pack id", () => {
    expect(() => expandTemplatePack("nope", [0], "2026-07-06")).toThrow("ONBOARDING_UNKNOWN_PACK");
  });
});

describe("dueOffsetLabel", () => {
  it("labels day and week offsets for the assign-form preview", () => {
    expect(dueOffsetLabel(0)).toBe("Day 1");
    expect(dueOffsetLabel(2)).toBe("Day 3");
    expect(dueOffsetLabel(7)).toBe("Week 1");
    expect(dueOffsetLabel(10)).toBe("Week 2");
    expect(dueOffsetLabel(14)).toBe("Week 2");
  });
});

describe("isTaskOverdue", () => {
  const today = "2026-07-03";

  it("is overdue only when pending and strictly past the due date", () => {
    expect(isTaskOverdue("2026-07-02", "pending", today)).toBe(true);
    expect(isTaskOverdue("2026-07-03", "pending", today)).toBe(false);
    expect(isTaskOverdue("2026-07-04", "pending", today)).toBe(false);
  });

  it("completed tasks are never overdue", () => {
    expect(isTaskOverdue("2026-07-01", "completed", today)).toBe(false);
  });

  it("tasks without a due date are never overdue", () => {
    expect(isTaskOverdue(null, "pending", today)).toBe(false);
  });
});
