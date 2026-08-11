import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/supabaseServer", () => ({ createServiceRoleClient: vi.fn() }));

import { createServiceRoleClient } from "@/lib/db/supabaseServer";
import { recordEmploymentChange } from "@/services/employmentChangeService";
import { runDueAutomationForTenant } from "@/services/hrAutomation";

const root = process.cwd();

function read(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

describe("MR-3A employment changes and people truth", () => {
  it("adds effective-dated employment-change storage in the schema order before transactional mutations", () => {
    const schema = read("schemas/employment_changes.sql");
    const schemaOrder = read("scripts/schema-order.mjs");
    const verifyInstall = read("scripts/verify-install.mjs");
    const verifyIntegration = read("scripts/verify-integration.mjs");

    expect(schemaOrder.indexOf('"hr_automation.sql"')).toBeLessThan(
      schemaOrder.indexOf('"employment_changes.sql"'),
    );
    expect(schemaOrder.indexOf('"employment_changes.sql"')).toBeLessThan(
      schemaOrder.indexOf('"transactional_mutations.sql"'),
    );
    expect(schema).toContain("create table if not exists employment_changes");
    expect(schema).toContain("employment_changes_idempotency_idx");
    expect(schema).toContain("references employees(tenant_id, id)");
    expect(schema).toContain("references hr_automation_items(tenant_id, id)");
    expect(verifyInstall).toContain('"employment_changes.sql": ["employment_changes"]');
    expect(verifyIntegration).toContain('"employment_changes"');
  });

  it("keeps the model bounded to approved employment facts", () => {
    const schema = read("schemas/employment_changes.sql");

    for (const key of [
      "role_title",
      "department",
      "manager_id",
      "position_id",
      "employment_type",
      "country",
      "grade",
      "start_date",
      "end_date",
      "compensation",
    ]) {
      expect(schema).toContain(`'${key}'`);
    }
    expect(schema).not.toContain("performance");
    expect(schema).not.toContain("payroll");
    expect(schema).not.toContain("workflow_builder");
  });

  it("records old/new values, conflicts, cancellation and service-role-only RPCs", () => {
    const schema = read("schemas/employment_changes.sql");
    const rls = read("schemas/tenancy_rls.sql");

    expect(schema).toContain("teamframe_current_employment_values");
    expect(schema).toContain("old_values");
    expect(schema).toContain("new_values");
    expect(schema).toContain("EMPLOYMENT_CHANGE_CONFLICT");
    expect(schema).toContain("teamframe_cancel_employment_change");
    expect(schema).toContain("status = 'cancelled'");
    expect(schema).toContain("status = 'suppressed'");
    expect(schema).toContain("revoke all on function teamframe_record_employment_change");
    expect(schema).toContain("from public, anon, authenticated");
    expect(schema).toContain("to service_role");
    expect(rls).toContain("alter table employment_changes enable row level security");
    expect(rls).toContain("employment_changes_select_admin");
    expect(rls).toContain("employment_changes_insert_blocked");
  });

  it("applies current projection and position transitions through one due-change RPC", () => {
    const schema = read("schemas/employment_changes.sql");

    expect(schema).toContain("teamframe_apply_employment_change");
    expect(schema).toContain("p_effective_as_of date default current_date");
    expect(schema).toContain("EMPLOYMENT_CHANGE_NOT_DUE");
    expect(schema).toContain("POSITION_ALREADY_FILLED");
    expect(schema).toContain("set assigned_employee_id = null");
    expect(schema).toContain("set assigned_employee_id = v_change.employee_id");
    expect(schema).toContain("lifecycle_state = teamframe_derive_employee_lifecycle");
    expect(schema).toContain("employment_change.applied");
    expect(schema).toContain("applied_by_actor_type");
  });

  it("routes future-effective changes through the MR-2 automation layer", () => {
    const schema = read("schemas/employment_changes.sql");
    const service = read("services/hrAutomation/index.ts");

    expect(schema).toContain("teamframe_ensure_hr_automation_item");
    expect(schema).toContain("'employment_change.apply'");
    expect(service).toContain("applyEmploymentChangeFromAutomation");
    expect(service).toContain('item.rule_key === "employment_change.apply"');
    expect(service).toContain("p_effective_as_of");
    expect(service).toContain("complete: true");
    expect(service).toContain("fail: true");
  });

  it("records immediate material employee edits through employment history before projection", () => {
    const transactional = read("schemas/transactional_mutations.sql");
    const start = transactional.indexOf("function teamframe_update_employee");
    const next = transactional.indexOf("create or replace function", start + 1);
    const body = transactional.slice(start, next === -1 ? undefined : next);

    expect(body).toContain("v_material_patch");
    expect(body).toContain("teamframe_record_employment_change");
    expect(body).toContain("employee_update:");
    expect(body).toContain("v_material_patch <> '{}'::jsonb or teamframe_timestamp_matches");
  });

  it("exposes a bounded admin UI for recording and cancelling employment changes", () => {
    const page = read("app/employees/page.tsx");
    const actions = read("app/employees/actions.ts");

    expect(page).toContain("Employment changes");
    expect(page).toContain("recordEmploymentChangeAction");
    expect(page).toContain("cancelEmploymentChangeAction");
    expect(page).toContain("Effective date");
    expect(actions).toContain("recordEmploymentChange");
    expect(actions).toContain("cancelEmploymentChange");
  });

  it("service calls use service-role RPCs and reject empty patches before persistence", async () => {
    const rpc = vi.fn().mockReturnValue({
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: "change-1",
          tenant_id: "tenant-1",
          employee_id: "employee-1",
          effective_date: "2026-09-01",
          status: "pending",
          change_keys: ["role_title"],
          old_values: {},
          new_values: { role_title: "Senior Engineer" },
        },
        error: null,
      }),
    });
    vi.mocked(createServiceRoleClient).mockReturnValue({ rpc } as any);

    await expect(
      recordEmploymentChange(
        {
          authUserId: "00000000-0000-0000-0000-000000000001",
          email: "admin@example.test",
          employeeId: null,
          tenantId: "00000000-0000-0000-0000-000000000010",
          role: "admin",
        },
        {
          employeeId: "00000000-0000-0000-0000-000000000020",
          effectiveDate: "2026-09-01",
          patch: { role_title: "Senior Engineer" },
        },
      ),
    ).resolves.toMatchObject({ id: "change-1" });

    expect(rpc).toHaveBeenCalledWith("teamframe_record_employment_change", expect.any(Object));

    await expect(
      recordEmploymentChange(
        {
          authUserId: "00000000-0000-0000-0000-000000000001",
          email: "admin@example.test",
          employeeId: null,
          tenantId: "00000000-0000-0000-0000-000000000010",
          role: "admin",
        },
        {
          employeeId: "00000000-0000-0000-0000-000000000020",
          effectiveDate: "2026-09-01",
          patch: {},
        },
      ),
    ).rejects.toThrow("EMPLOYMENT_CHANGE_EMPTY");
  });

  it("automation runner completes due employment changes through service-role application", async () => {
    const dueQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({
        data: [
          {
            id: "automation-1",
            tenant_id: "tenant-1",
            rule_key: "employment_change.apply",
            subject_id: "change-1",
            due_at: "2026-09-01T00:00:00.000Z",
            status: "scheduled",
            next_attempt_at: null,
          },
        ],
        error: null,
      }),
    };
    const from = vi.fn().mockReturnValue(dueQuery);
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: { id: "change-1", status: "applied" }, error: null })
      .mockResolvedValueOnce({
        data: { outcome: "completed", item_id: "automation-1" },
        error: null,
      });
    vi.mocked(createServiceRoleClient).mockReturnValue({ from, rpc } as any);

    await expect(
      runDueAutomationForTenant({
        tenantId: "tenant-1",
        now: new Date("2026-09-01T00:00:00.000Z"),
      }),
    ).resolves.toMatchObject({
      checked: 1,
      processed: 1,
      failed: 0,
    });

    expect(rpc).toHaveBeenNthCalledWith(1, "teamframe_apply_employment_change", expect.objectContaining({
      p_change_id: "change-1",
      p_actor_type: "system",
      p_effective_as_of: "2026-09-01",
    }));
    expect(rpc).toHaveBeenNthCalledWith(2, "teamframe_run_hr_automation_item", expect.objectContaining({
      p_complete: true,
    }));
  });
});
