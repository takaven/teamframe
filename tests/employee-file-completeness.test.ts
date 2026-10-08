import { describe, expect, it } from "vitest";
import { summarizeEmployeeFile } from "@/lib/ui/documentLabels";

describe("employee file completeness", () => {
  it("reports only factual required-document state", () => {
    const summary = summarizeEmployeeFile([
      { state: "accepted", current_expires_at: "2026-11-15" },
      { state: "requested", current_expires_at: null },
      { state: "received", current_expires_at: null },
      { state: "cancelled", current_expires_at: null },
    ], new Date("2026-10-07T00:00:00.000Z"));

    expect(summary).toEqual({
      required: 3,
      complete: 1,
      missing: 1,
      awaitingReview: 1,
      expiringWithin90Days: 1,
    });
  });
});
