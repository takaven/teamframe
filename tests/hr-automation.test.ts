import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/supabaseServer", () => ({ createServiceRoleClient: vi.fn() }));

import { createServiceRoleClient } from "@/lib/db/supabaseServer";
import { ensureAutomationItem, runAutomationItem } from "@/services/hrAutomation";

const root = process.cwd();

function read(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

describe("MR-2 HR automation operating layer", () => {
  it("adds a durable tenant-scoped automation schema with idempotent work and event records", () => {
    const schema = read("schemas/hr_automation.sql");
    const schemaOrder = read("scripts/schema-order.mjs");
    const verifyInstall = read("scripts/verify-install.mjs");
    const verifyIntegration = read("scripts/verify-integration.mjs");

    expect(schemaOrder.indexOf('"hr_automation.sql"')).toBeLessThan(
      schemaOrder.indexOf('"onboarding_tasks.sql"'),
    );
    expect(schemaOrder.indexOf('"hr_automation.sql"')).toBeLessThan(
      schemaOrder.indexOf('"tenancy_rls.sql"'),
    );
    expect(schema).toContain("create table if not exists hr_automation_items");
    expect(schema).toContain("create table if not exists hr_automation_events");
    expect(schema).toContain("hr_automation_items_idempotency_idx");
    expect(schema).toContain("on hr_automation_items(tenant_id, rule_key, idempotency_key)");
    expect(schema).toContain("hr_automation_events_key_idx");
    expect(schema).toContain("references employees(tenant_id, id)");
    expect(verifyInstall).toContain('"hr_automation.sql": ["hr_automation_items", "hr_automation_events"]');
    expect(verifyIntegration).toContain('"hr_automation_items"');
    expect(verifyIntegration).toContain('"hr_automation_events"');
  });

  it("keeps notification levels bounded to the approved MR-2 semantics", () => {
    const schema = read("schemas/hr_automation.sql");

    for (const level of ["background", "routine_reminder", "escalation", "decision"]) {
      expect(schema).toContain(`'${level}'`);
    }
    expect(schema).not.toContain("workflow_builder");
    expect(schema).not.toContain("notification_preferences");
  });

  it("implements completion suppression, recurrence, retry and escalation at the database boundary", () => {
    const schema = read("schemas/hr_automation.sql");

    expect(schema).toContain("function teamframe_ensure_hr_automation_item");
    expect(schema).toContain("function teamframe_run_hr_automation_item");
    expect(schema).toContain("if v_item.status in ('completed', 'suppressed')");
    expect(schema).toContain("if not p_complete");
    expect(schema).toContain("and v_item.due_at > p_now");
    expect(schema).toContain("v_item.attempt_count + 1");
    expect(schema).toContain("v_attempt >= v_item.max_attempts");
    expect(schema).toContain("'automation.item_escalated'");
    expect(schema).toContain("p_next_recurrence_idempotency_key");
    expect(schema).toContain("on conflict (tenant_id, rule_key, idempotency_key)");
    expect(schema).toContain("on conflict (tenant_id, event_key) do nothing");
  });

  it("audits automation events without exposing RPCs to browser roles", () => {
    const schema = read("schemas/hr_automation.sql");
    const auditSchema = read("schemas/audit_logs.sql");

    expect(auditSchema).toContain("actor_type");
    expect(auditSchema).toContain("check (actor_type in ('human', 'system'))");
    expect(auditSchema).toContain("audit_logs_actor_type_idx");
    for (const action of [
      "automation.item_created",
      "automation.routine_reminder",
      "automation.item_escalated",
      "automation.item_completed",
    ]) {
      expect(schema).toContain(action);
    }
    expect(schema).toContain("'system'");
    expect(schema).toContain("actor_type");
    expect(schema).toContain("revoke all on function teamframe_ensure_hr_automation_item");
    expect(schema).toContain("revoke all on function teamframe_run_hr_automation_item");
    expect(schema).toContain("from public, anon, authenticated");
    expect(schema).toContain("to service_role");
  });

  it("protects automation tables with tenant-scoped read and blocked browser writes", () => {
    const rls = read("schemas/tenancy_rls.sql");

    expect(rls).toContain("alter table hr_automation_items enable row level security");
    expect(rls).toContain("alter table hr_automation_events enable row level security");
    expect(rls).toContain("hr_automation_items_select_admin");
    expect(rls).toContain("hr_automation_events_select_admin");
    expect(rls).toContain("hr_automation_items_insert_blocked");
    expect(rls).toContain("hr_automation_events_insert_blocked");
    expect(rls).toContain("hr_automation_items_update_blocked");
    expect(rls).toContain("hr_automation_events_update_blocked");
  });

  it("routes service calls through service-role RPCs rather than client-reachable table mutations", async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: "5a79f9a9-a16a-426f-ac8b-41d3ca424b61", error: null })
      .mockResolvedValueOnce({
        data: { outcome: "completed", item_id: "5a79f9a9-a16a-426f-ac8b-41d3ca424b61" },
        error: null,
      });
    vi.mocked(createServiceRoleClient).mockReturnValue({ rpc } as any);

    await expect(
      ensureAutomationItem({
        tenantId: "tenant-1",
        ruleKey: "document.request",
        idempotencyKey: "document.request:employee-1:contract",
        subjectType: "document_requirement",
        subjectId: "subject-1",
        ownerEmployeeId: "employee-1",
        dueAt: new Date("2026-08-20T00:00:00.000Z"),
      }),
    ).resolves.toBe("5a79f9a9-a16a-426f-ac8b-41d3ca424b61");

    await expect(
      runAutomationItem({
        tenantId: "tenant-1",
        itemId: "5a79f9a9-a16a-426f-ac8b-41d3ca424b61",
        now: new Date("2026-08-20T00:00:00.000Z"),
        complete: true,
      }),
    ).resolves.toEqual({
      outcome: "completed",
      item_id: "5a79f9a9-a16a-426f-ac8b-41d3ca424b61",
    });

    expect(rpc).toHaveBeenNthCalledWith(1, "teamframe_ensure_hr_automation_item", expect.any(Object));
    expect(rpc).toHaveBeenNthCalledWith(2, "teamframe_run_hr_automation_item", expect.any(Object));
  });

  it("provides a protected background runner entrypoint without creating a workflow builder", () => {
    const route = read("app/api/automation/run/route.ts");
    const service = read("services/hrAutomation/index.ts");
    const envExample = read(".env.example");
    const tenancyGuard = read("scripts/guard-tenancy-filter.mjs");

    expect(route).toContain("export async function POST");
    expect(route).toContain("export async function GET");
    expect(route).toContain("return handleAutomationRun(req)");
    expect(route).toContain("TEAMFRAME_AUTOMATION_SECRET");
    expect(route).toContain("runDueAutomation");
    expect(route).toContain("timingSafeEqual");
    expect(route).toMatch(/export async function GET[\s\S]*return handleAutomationRun\(req\);[\s\S]*}/);
    expect(service).toContain("runDueAutomationForTenant");
    expect(service).toContain("listDueAutomationItemsForTenant");
    expect(service).toContain(".from(\"hr_automation_items\")");
    expect(service).toContain(".eq(\"tenant_id\", input.tenantId)");
    expect(service).toContain(".in(\"status\", [\"scheduled\", \"due\", \"failed\"])");
    expect(service).toContain("teamframe_run_hr_automation_item");
    expect(envExample).toContain("TEAMFRAME_AUTOMATION_SECRET=");
    expect(tenancyGuard).toContain("services/hrAutomation/index.ts");
    expect(service).not.toContain("workflow builder");
    expect(service).not.toContain("preferences");
  });
});
