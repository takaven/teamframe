import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/supabaseServer", () => ({ createServiceRoleClient: vi.fn() }));

import { createServiceRoleClient } from "@/lib/db/supabaseServer";
import {
  CHECK_IN_DEFAULTS,
  PROBATION_DEFAULTS,
  completeProbationReview,
  submitMyOnboardingCheckIn,
} from "@/services/earlyEmploymentService";

const root = process.cwd();

function read(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

const adminActor = {
  authUserId: "11111111-1111-4111-8111-111111111111",
  email: "admin@example.test",
  role: "admin" as const,
  tenantId: "22222222-2222-4222-8222-222222222222",
  employeeId: null,
};

const employeeActor = {
  authUserId: "33333333-3333-4333-8333-333333333333",
  email: "employee@example.test",
  role: "employee" as const,
  tenantId: "22222222-2222-4222-8222-222222222222",
  employeeId: "44444444-4444-4444-8444-444444444444",
};

describe("MR-4 join and early employment workflows", () => {
  it("adds bounded early-employment persistence after automation and before transactional employee mutations", () => {
    const schema = read("schemas/early_employment.sql");
    const schemaOrder = read("scripts/schema-order.mjs");
    const verifyInstall = read("scripts/verify-install.mjs");
    const verifyIntegration = read("scripts/verify-integration.mjs");

    expect(schemaOrder.indexOf('"hr_automation.sql"')).toBeLessThan(
      schemaOrder.indexOf('"early_employment.sql"'),
    );
    expect(schemaOrder.indexOf('"early_employment.sql"')).toBeLessThan(
      schemaOrder.indexOf('"transactional_mutations.sql"'),
    );
    expect(schema).toContain("create table if not exists employee_join_initializations");
    expect(schema).toContain("create table if not exists onboarding_check_ins");
    expect(schema).toContain("create table if not exists probation_reviews");
    expect(schema).toContain("onboarding_check_ins_employee_due_idx");
    expect(schema).toContain("probation_reviews_employee_end_date_idx");
    expect(verifyInstall).toContain('"early_employment.sql": ["employee_join_initializations", "onboarding_check_ins", "probation_reviews"]');
    for (const table of ["employee_join_initializations", "onboarding_check_ins", "probation_reviews"]) {
      expect(verifyIntegration).toContain(`"${table}"`);
    }
  });

  it("initializes ordinary onboarding work once from employee creation and guided setup", () => {
    const schema = read("schemas/early_employment.sql");
    const mutations = read("schemas/transactional_mutations.sql");

    expect(schema).toContain("function teamframe_initialize_join_work");
    expect(schema).toContain("employee_join_initializations");
    expect(schema).toContain("on conflict (tenant_id, employee_id) do nothing");
    for (const title of [
      "Sign your employment contract",
      "Complete your employee profile",
      "Meet your manager",
      "Upload ID and right-to-work documents",
      "Read and acknowledge company policies",
      "Confirm payroll and bank details",
    ]) {
      expect(schema).toContain(title);
    }
    expect(mutations.match(/teamframe_initialize_join_work/g)?.length).toBe(2);
  });

  it("schedules 30-day check-ins and probation reviews through MR-2 automation", () => {
    const schema = read("schemas/early_employment.sql");
    const automation = read("services/hrAutomation/index.ts");

    expect(CHECK_IN_DEFAULTS.milestoneDays).toBe(30);
    expect(PROBATION_DEFAULTS.durationDays).toBe(90);
    expect(PROBATION_DEFAULTS.reviewLeadDays).toBe(14);
    expect(schema).toContain("'onboarding.check_in.due'");
    expect(schema).toContain("'probation.review_due'");
    expect(schema).toContain("teamframe_ensure_hr_automation_item");
    expect(schema).toContain("teamframe_run_hr_automation_item");
    expect(automation).toContain('item.rule_key === "probation.review_due"');
    expect(automation).toContain('from("probation_reviews")');
    expect(automation).toContain('.eq("tenant_id", input.tenantId)');
  });

  it("keeps the check-in factual and deterministic rather than performance-scored", () => {
    const schema = read("schemas/early_employment.sql");
    // Phase 5C: the employee 30-day check-in form now lives on /me (moved off /onboarding).
    const page = read("app/me/page.tsx");

    for (const topic of [
      "role_clarity",
      "manager_team_clarity",
      "tools_ready",
      "training_clear",
      "policies_clear",
      "support_available",
      "has_blockers",
      "improvement_note",
    ]) {
      expect(schema).toContain(topic);
      expect(page).toContain(topic);
    }
    expect(schema).not.toMatch(/performance|score|competenc|sentiment|rating/i);
    expect(page).not.toMatch(/performance score|employee rating|sentiment/i);
  });

  it("creates one bounded follow-up only from configured response conditions", () => {
    const schema = read("schemas/early_employment.sql");

    expect(schema).toContain("v_needs_follow_up");
    expect(schema).toContain("has_blockers");
    expect(schema).toContain("tools_ready");
    expect(schema).toContain("support_available");
    expect(schema).toContain("onboarding_check_in_follow_up");
    expect(schema).toContain("risk_signals_open_check_in_follow_up_unique_idx");
    expect(schema).toContain("on conflict (tenant_id, risk_signal_id)");
    expect(schema).not.toMatch(/artificial intelligence|inferred risk|sentiment/i);
  });

  it("suppresses inappropriate early-employment work for offboarding and former lifecycle states", () => {
    const schema = read("schemas/early_employment.sql");

    expect(schema).toContain("v_lifecycle in ('offboarding', 'exited')");
    expect(schema).toContain("'lifecycle_suppressed'");
    expect(schema).toContain("teamframe_derive_employee_lifecycle");
  });

  it("protects early-employment tables and RPCs from browser writes", () => {
    const schema = read("schemas/early_employment.sql");
    const rls = read("schemas/tenancy_rls.sql");

    for (const table of ["employee_join_initializations", "onboarding_check_ins", "probation_reviews"]) {
      expect(rls).toContain(`alter table ${table} enable row level security`);
    }
    expect(rls).toContain("onboarding_check_ins_select");
    expect(rls).toContain("probation_reviews_select_admin");
    expect(rls).toContain("onboarding_check_ins_insert_blocked");
    expect(rls).toContain("probation_reviews_update_blocked");
    expect(schema).toContain("revoke all on function teamframe_initialize_join_work");
    expect(schema).toContain("revoke all on function teamframe_submit_onboarding_check_in");
    expect(schema).toContain("revoke all on function teamframe_complete_probation_review");
    expect(schema).toContain("to service_role");
  });

  it("lets employees submit only their own check-in through a service-role RPC", async () => {
    const rpc = vi.fn().mockReturnValue({
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: "55555555-5555-4555-8555-555555555555",
          employee_id: employeeActor.employeeId,
          due_date: "2026-09-10",
          status: "submitted",
          questions: [],
          responses: { has_blockers: false },
          flagged_follow_up: false,
          follow_up_action_item_id: null,
          submitted_at: "2026-09-10T12:00:00.000Z",
          created_at: "2026-08-11T12:00:00.000Z",
          updated_at: "2026-09-10T12:00:00.000Z",
        },
        error: null,
      }),
    });
    vi.mocked(createServiceRoleClient).mockReturnValue({ rpc } as any);

    await expect(
      submitMyOnboardingCheckIn(employeeActor, "55555555-5555-4555-8555-555555555555", {
        role_clarity: "clear",
        manager_team_clarity: "mostly_clear",
        tools_ready: true,
        training_clear: "mostly_clear",
        policies_clear: "clear",
        support_available: true,
        has_blockers: false,
      }),
    ).resolves.toMatchObject({ status: "submitted", flagged_follow_up: false });

    expect(rpc).toHaveBeenCalledWith(
      "teamframe_submit_onboarding_check_in",
      expect.objectContaining({
        p_tenant_id: employeeActor.tenantId,
        p_actor_user_id: employeeActor.authUserId,
        p_employee_id: employeeActor.employeeId,
      }),
    );
  });

  it("denies employee attempts to record admin probation outcomes", async () => {
    vi.mocked(createServiceRoleClient).mockReturnValue({ rpc: vi.fn() } as any);

    await expect(
      completeProbationReview(employeeActor, {
        reviewId: "66666666-6666-4666-8666-666666666666",
        outcome: "confirmed",
      }),
    ).rejects.toThrow("FORBIDDEN");
  });

  it("records admin probation outcomes through the bounded RPC", async () => {
    const rpc = vi.fn().mockReturnValue({
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: "66666666-6666-4666-8666-666666666666",
          employee_id: "44444444-4444-4444-8444-444444444444",
          probation_end_date: "2026-11-09",
          review_due_date: "2026-10-26",
          status: "completed",
          review_owner_user_id: adminActor.authUserId,
          outcome: "confirmed",
          outcome_notes: null,
          completed_at: "2026-10-26T12:00:00.000Z",
          created_at: "2026-08-11T12:00:00.000Z",
          updated_at: "2026-10-26T12:00:00.000Z",
        },
        error: null,
      }),
    });
    vi.mocked(createServiceRoleClient).mockReturnValue({ rpc } as any);

    await expect(
      completeProbationReview(adminActor, {
        reviewId: "66666666-6666-4666-8666-666666666666",
        outcome: "confirmed",
      }),
    ).resolves.toMatchObject({ status: "completed", outcome: "confirmed" });
  });

  it("records probation extension as history and schedules one next review obligation", () => {
    const schema = read("schemas/early_employment.sql");

    expect(schema).toContain("if p_outcome = 'extended' then");
    expect(schema).toContain("p_extended_until is null or p_extended_until <= v_review.probation_end_date");
    expect(schema).toContain("insert into probation_reviews");
    expect(schema).toContain("on conflict (tenant_id, employee_id, probation_end_date) do update set updated_at = clock_timestamp()");
    expect(schema).toContain("'probation.review:' || v_review.employee_id::text || ':' || p_extended_until::text");
    expect(schema).toContain("'extended_from', p_review_id");
    expect(schema).not.toContain("teamframe_record_employment_change");
  });
});
