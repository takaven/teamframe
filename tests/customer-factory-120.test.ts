import { performance } from "node:perf_hooks";
import { describe, expect, it, vi } from "vitest";
import { customerFactory120Pack } from "./fixtures/customer-factory-120";

vi.mock("server-only", () => ({}));

describe("synthetic 120-person setup pack", () => {
  it("validates with the unchanged setup-pack parser and measures local parse time", async () => {
    const { parseSetupPack } = await import("@/services/customerProvisioningService");
    const pack = customerFactory120Pack();
    const preview = parseSetupPack(pack);

    expect(preview.validationErrors).toEqual([]);
    expect(preview.employees).toHaveLength(120);
    expect(preview.users).toHaveLength(121);
    expect(preview.employees.filter((person) => person.starterType === "new_starter")).toHaveLength(4);
    expect(preview.employees.filter((person) => person.managerEmail !== null)).toHaveLength(108);
    expect(preview.holidays).toHaveLength(2);

    const runs = 100;
    const started = performance.now();
    for (let index = 0; index < runs; index++) parseSetupPack(pack);
    const elapsedMs = performance.now() - started;
    console.info(`customer-factory-120 parse/validate: ${runs} runs in ${elapsedMs.toFixed(1)} ms (${(elapsedMs / runs).toFixed(2)} ms/run)`);
  });
});
