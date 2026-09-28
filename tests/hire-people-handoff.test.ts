import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/supabaseServer", () => ({ createServiceRoleClient: vi.fn() }));
vi.mock("@/services/onboardingService/checklistTemplates", () => ({ assignDefaultChecklist: vi.fn().mockResolvedValue(0) }));

import { createServiceRoleClient } from "@/lib/db/supabaseServer";
import { createEmployeeFromReviewedHire, HirePeopleSnapshotSchema } from "@/services/hirePeopleHandoff";

const actor = { role: "admin", tenantId: "tenant-1", authUserId: "operator-1" } as const;
const snapshot = {
  pass_candidate_id: 17,
  offer_id: 21,
  candidate_status: "hired",
  offer_status: "accepted",
  approval_reference: "reviewed-offer-21",
  full_name: "Synthetic Person",
  email: "synthetic@example.invalid",
  role_title: "Analyst",
  department: "Operations",
  timezone: "UTC",
  employment_type: "full_time",
  country: "MU",
  start_date: "2026-10-15",
  end_date: null,
  manager_id: null,
  grade: null,
} as const;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("TEAMFRAME_HIREPASS_SOURCE_NAMESPACE", "hirepass-customer-1");
});
afterEach(() => vi.unstubAllEnvs());

describe("one-way Hire→People handoff", () => {
  it("requires accepted/hired source assertion, explicit People fields and no extra data", () => {
    expect(HirePeopleSnapshotSchema.safeParse(snapshot).success).toBe(true);
    expect(HirePeopleSnapshotSchema.safeParse({ ...snapshot, offer_status: "pending" }).success).toBe(false);
    expect(HirePeopleSnapshotSchema.safeParse({ ...snapshot, start_date: "" }).success).toBe(false);
    expect(HirePeopleSnapshotSchema.safeParse({ ...snapshot, salary: 100000 }).success).toBe(false);
    expect(HirePeopleSnapshotSchema.safeParse({ ...snapshot, cv: "private" }).success).toBe(false);
    expect(HirePeopleSnapshotSchema.safeParse({ ...snapshot, source_namespace: "different-source" }).success).toBe(false);
    expect(HirePeopleSnapshotSchema.safeParse({ ...snapshot, end_date: "2026-10-14" }).success).toBe(false);
  });

  it("restricts to an admin and passes only the reviewed normalized snapshot to one RPC", async () => {
    const rpc = vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: "employee-1" }, error: null }) });
    vi.mocked(createServiceRoleClient).mockReturnValue({ rpc } as never);
    await expect(createEmployeeFromReviewedHire({ ...actor, role: "employee" } as never, snapshot)).rejects.toThrow("FORBIDDEN");
    expect(rpc).not.toHaveBeenCalled();
    await expect(createEmployeeFromReviewedHire(actor as never, { ...snapshot, email: "SYNTHETIC@example.invalid" })).resolves.toEqual({ employeeId: "employee-1" });
    expect(rpc).toHaveBeenCalledWith("teamframe_create_employee_from_hire", {
      p_tenant_id: actor.tenantId,
      p_actor_user_id: actor.authUserId,
      p_snapshot: { ...snapshot, email: "synthetic@example.invalid", source_namespace: "hirepass-customer-1" },
    });
  });

  it("returns the database identity unchanged on a retry and surfaces a conflicting retry", async () => {
    const single = vi.fn()
      .mockResolvedValueOnce({ data: { id: "employee-1" }, error: null })
      .mockResolvedValueOnce({ data: { id: "employee-1" }, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: "HIRE_HANDOFF_CONFLICT" } });
    const rpc = vi.fn().mockReturnValue({ single });
    vi.mocked(createServiceRoleClient).mockReturnValue({ rpc } as never);
    expect(await createEmployeeFromReviewedHire(actor as never, snapshot)).toEqual({ employeeId: "employee-1" });
    expect(await createEmployeeFromReviewedHire(actor as never, snapshot)).toEqual({ employeeId: "employee-1" });
    await expect(createEmployeeFromReviewedHire(actor as never, { ...snapshot, offer_id: 22 }))
      .rejects.toThrow("HIRE_HANDOFF_CONFLICT");
    expect(rpc).toHaveBeenCalledTimes(3);
  });

  it("fails closed if the stable source namespace is absent", async () => {
    vi.stubEnv("TEAMFRAME_HIREPASS_SOURCE_NAMESPACE", "");
    await expect(createEmployeeFromReviewedHire(actor as never, snapshot))
      .rejects.toThrow("HIRE_HANDOFF_SOURCE_NOT_CONFIGURED");
    expect(createServiceRoleClient).not.toHaveBeenCalled();
  });

  it("defines database-level idempotency, conflict, transaction rollback and restricted invocation", () => {
    const sql = readFileSync(join(process.cwd(), "schemas/hire_people_handoff.sql"), "utf8");
    const order = readFileSync(join(process.cwd(), "scripts/schema-order.mjs"), "utf8");
    const action = readFileSync(join(process.cwd(), "app/employees/actions.ts"), "utf8");
    expect(order.indexOf("api_privileges.sql")).toBeLessThan(order.indexOf("hire_people_handoff.sql"));
    expect(sql).toContain("create unique index if not exists employees_hire_source_unique");
    expect(sql).toContain("create unique index if not exists employees_hire_offer_unique");
    expect(sql).toContain("pg_advisory_xact_lock");
    expect(sql).toContain("v_existing.hire_handoff_snapshot <> p_snapshot");
    expect(sql).toContain("raise exception 'HIRE_HANDOFF_CONFLICT'");
    expect(sql).toContain("p_snapshot->>'candidate_status' is distinct from 'hired'");
    expect(sql).toContain("p_snapshot->>'offer_status' is distinct from 'accepted'");
    expect(sql).toContain("return v_existing");
    expect(sql).toContain("v_employee := teamframe_create_employee(");
    expect(sql).toContain("update employees set");
    expect(sql).toContain("'employee.created_from_hire'");
    expect(sql).toContain("from public, anon, authenticated");
    expect(sql).toContain("to service_role");
    expect(action).toContain('formData.get("source_reviewed") !== "yes"');
    expect(action).toContain('candidate_status: formData.get("candidate_status")');
    expect(action).toContain('offer_status: formData.get("offer_status")');
    expect(action).not.toContain('formData.get("source_namespace")');
    expect(action).not.toContain("inviteEmployeeAuthUser");
  });
});
