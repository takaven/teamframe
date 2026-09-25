import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("Group D bounded notifications", () => {
  const schema = read("schemas/20260924_notification_deliveries.sql");
  const service = read("services/notificationService.ts");

  it("keeps a tenant-scoped idempotency ledger with bounded attempts", () => {
    expect(schema).toContain("unique (tenant_id, event_key)");
    expect(schema).toContain("attempt_count between 0 and 5");
    expect(schema).toContain("enable row level security");
    expect(schema).toContain("recipient_employee_id = current_actor_employee_id(tenant_id)");
  });

  it("does not store message bodies or sensitive HR values", () => {
    expect(schema).not.toMatch(/body|salary|bank|address|document_content/i);
    expect(service).not.toMatch(/salary|bank data|emergency contact|residential_address/i);
  });

  it("uses stable event keys for transactions and daily digest", () => {
    for (const key of ["document-request:", "leave:", "policy:", "onboarding:", "digest:"]) expect(service).toContain(key);
    expect(service).toContain('.eq("event_key", input.eventKey)');
  });

  it("never sends reserved synthetic review addresses externally", () => {
    expect(service).toContain("invalid|example|test");
    expect(service).toContain('domain === "localhost"');
    expect(service).toContain("preview-sink:");
  });

  it("fails email independently of the underlying HR action", () => {
    expect(service).toContain("notifyBestEffort");
    expect(service).toContain("[NOTIFICATION_RECORD_FAILED]");
    expect(read("app/leaves/actions.ts")).toMatch(/decideLeaveRequest[\s\S]+notifyLeaveDecision/);
  });

  it("uses the existing automation route and skips empty digests", () => {
    expect(read("app/api/automation/run/route.ts")).toContain("runDailyDigests");
    expect(service).toContain("if (count === 0)");
    expect(service).toContain("localDate(timezone)");
  });

  it("surfaces failures and bounded retry on Home", () => {
    const home = read("app/dashboard/page.tsx");
    expect(home).toContain("Email delivery needs review");
    expect(home).toContain("retryNotificationAction");
    expect(service).toContain("row.attempt_count >= 3");
    expect(service).toContain('.eq("id", row.id).eq("status", "failed")');
  });

  it("provides only the approved reminder actions", () => {
    const actions = read("app/notifications/actions.ts");
    expect(actions).toContain("remindDocumentAction");
    expect(actions).toContain("remindPolicyAction");
    expect(actions).not.toMatch(/remindLeave|remindEverything/);
  });
});
