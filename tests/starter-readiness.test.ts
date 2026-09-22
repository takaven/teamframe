import { describe, expect, it } from "vitest";
import { configuredPreStartChecks } from "@/services/starterReadiness";
import type { OnboardingTask } from "@/services/onboardingService";
import type { DocumentRequirementRecord } from "@/services/documentService";

const start = "2026-10-15";
const names = new Map([["manager-1", "Named Manager"]]);
const task = (patch: Partial<OnboardingTask> = {}) => ({
  id: "task-1", employee_id: "starter-1", title: "Contract", status: "pending", owner_role: "manager",
  owner_employee_id: "manager-1", completion_mode: "manual_confirmation", required_document_type: null,
  required_policy_id: null, required_policy_version: null, form_requirement_key: null, assigned_by: "admin-1",
  due_date: start, automation_item_id: null, completed_at: null, created_at: start, updated_at: start,
  ...patch,
}) as OnboardingTask;
const requirement = (patch: Partial<DocumentRequirementRecord> = {}) => ({
  id: "requirement-1", employee_id: "starter-1", document_type: "contract", due_date: start,
  expiry_required: false, review_required: true, employee_upload_allowed: true, state: "accepted",
  current_document_id: "document-1", current_expires_at: null, requested_at: start,
  received_at: start, reviewed_at: start, satisfied_at: start, created_at: start, updated_at: start,
  ...patch,
}) as DocumentRequirementRecord;

describe("configured pre-start checks", () => {
  it("fails closed on missing start, missing configuration, and undated work", () => {
    expect(configuredPreStartChecks(null, [], [], names).ready).toBe(false);
    expect(configuredPreStartChecks(start, [], [], names).ready).toBe(false);
    expect(configuredPreStartChecks(start, [task({ due_date: null })], [], names).ready).toBe(false);
    expect(configuredPreStartChecks(start, [], [requirement({ due_date: null })], names).ready).toBe(false);
  });
  it("checks day zero, excludes later work, and names the assigned owner", () => {
    const result = configuredPreStartChecks(start, [task(), task({ id: "later", due_date: "2026-10-17" })], [], names);
    expect(result.checked).toBe(1);
    expect(result.blockers).toEqual([{ label: "Contract · due 2026-10-15", owner: "Named Manager", nextAction: "Complete this onboarding task." }]);
    expect(configuredPreStartChecks(start, [task({ status: "completed" }), task({ id: "later", due_date: "2026-10-17" })], [], names).ready).toBe(true);
  });
  it.each(["requested", "received", "rejected", "expired"] as const)("blocks %s evidence", (state) => {
    expect(configuredPreStartChecks(start, [], [requirement({ state })], names).ready).toBe(false);
  });
  it("blocks evidence expiring before start and accepts current reviewed evidence", () => {
    expect(configuredPreStartChecks(start, [], [requirement({ current_expires_at: "2026-10-14" })], names).ready).toBe(false);
    expect(configuredPreStartChecks(start, [], [requirement({ current_expires_at: start })], names).ready).toBe(true);
    expect(configuredPreStartChecks(start, [], [requirement({ current_document_id: null })], names).ready).toBe(false);
    expect(configuredPreStartChecks(start, [], [requirement({ expiry_required: true, current_expires_at: null })], names).ready).toBe(false);
  });
});
