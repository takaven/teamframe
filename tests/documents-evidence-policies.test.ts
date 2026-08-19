import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/supabaseServer", () => ({ createServiceRoleClient: vi.fn() }));
vi.mock("@/services/signalEngine", () => ({ runSignalEngineForTenant: vi.fn() }));
vi.mock("@/services/hrAutomation", () => ({
  ensureAutomationItem: vi.fn(),
  runAutomationItem: vi.fn(),
}));

import { createServiceRoleClient } from "@/lib/db/supabaseServer";
import { completeOnboardingTask } from "@/services/onboardingService";

const root = process.cwd();

function read(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

const actor = {
  authUserId: "11111111-1111-4111-8111-111111111111",
  email: "admin@example.test",
  role: "admin" as const,
  tenantId: "22222222-2222-4222-8222-222222222222",
  employeeId: null,
};

describe("MR-5 documents, evidence and policies", () => {
  it("registers document requirements in schema apply, install and integration verification", () => {
    const schemaOrder = read("scripts/schema-order.mjs");
    const verifyInstall = read("scripts/verify-install.mjs");
    const verifyIntegration = read("scripts/verify-integration.mjs");

    expect(schemaOrder.indexOf('"hr_automation.sql"')).toBeLessThan(
      schemaOrder.indexOf('"document_requirements.sql"'),
    );
    expect(schemaOrder.indexOf('"document_requirements.sql"')).toBeLessThan(
      schemaOrder.indexOf('"tenancy_rls.sql"'),
    );
    expect(verifyInstall).toContain('"document_requirements.sql": ["document_requirements"]');
    expect(verifyIntegration).toContain('"document_requirements"');
  });

  it("adds tenant-scoped document requirement state and evidence sync hooks", () => {
    const schema = read("schemas/document_requirements.sql");

    for (const state of ["requested", "received", "accepted", "rejected", "expired", "replaced", "cancelled"]) {
      expect(schema).toContain(`'${state}'`);
    }
    expect(schema).toContain("document_requirements_employee_same_tenant_fk");
    expect(schema).toContain("document_requirements_document_same_tenant_fk");
    expect(schema).toContain("document_requirements_open_unique_idx");
    expect(schema).toContain("teamframe_sync_document_evidence_tasks");
    expect(schema).toContain("teamframe_sync_policy_acknowledgement_tasks");
    expect(schema).toContain("teamframe_maybe_activate_employee_setup");
    expect(schema).toContain("acknowledgements_sync_policy_tasks");
  });

  it("protects document requirements through RLS and service-role-only functions", () => {
    const rls = read("schemas/tenancy_rls.sql");
    const schema = read("schemas/document_requirements.sql");

    expect(rls).toContain("alter table document_requirements enable row level security");
    expect(rls).toContain("document_requirements_select");
    expect(rls).toContain("document_requirements_insert_blocked");
    expect(rls).toContain("document_requirements_update_blocked");
    expect(rls).toContain("document_requirements_delete_blocked");
    expect(schema).toContain("revoke all on function teamframe_sync_document_evidence_tasks");
    expect(schema).toContain("revoke all on function teamframe_sync_policy_acknowledgement_tasks");
    expect(schema).toContain("to service_role");
  });

  it("models evidence-backed onboarding completion modes and prevents generic manual bypass", async () => {
    const onboardingSchema = read("schemas/onboarding_tasks.sql");
    const onboardingService = read("services/onboardingService/index.ts");
    const templates = read("services/onboardingService/templates.ts");

    for (const mode of ["manual_confirmation", "document_required", "policy_acknowledgement", "form_or_data_required"]) {
      expect(onboardingSchema).toContain(`'${mode}'`);
    }
    expect(templates).toContain('completionMode: "document_required"');
    expect(templates).toContain('requiredDocumentType: "contract"');
    expect(templates).toContain('requiredDocumentType: "right_to_work"');
    expect(onboardingService).toContain('throw new Error("EVIDENCE_REQUIRED")');

    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: "task-1",
        tenant_id: actor.tenantId,
        employee_id: "employee-1",
        title: "Upload signed contract",
        status: "pending",
        completion_mode: "document_required",
        required_document_type: "contract",
        required_policy_id: null,
        required_policy_version: null,
        form_requirement_key: null,
        assigned_by: actor.authUserId,
        due_date: null,
        completed_at: null,
        created_at: "2026-08-12T00:00:00.000Z",
        updated_at: "2026-08-12T00:00:00.000Z",
      },
      error: null,
    });
    const eq = vi.fn().mockReturnThis();
    const select = vi.fn().mockReturnValue({ eq });
    eq.mockReturnValue({ eq, maybeSingle });
    vi.mocked(createServiceRoleClient).mockReturnValue({
      from: vi.fn().mockReturnValue({ select }),
    } as any);

    await expect(completeOnboardingTask(actor, "task-1", "2026-08-12T00:00:00.000Z")).rejects.toThrow(
      "EVIDENCE_REQUIRED",
    );
  });

  it("uses MR-2 automation for document due, review and expiry work", () => {
    const service = read("services/documentService/index.ts");
    const automation = read("services/hrAutomation/index.ts");

    expect(service).toContain('ruleKey: "document.request_due"');
    expect(service).toContain('ruleKey: "document.review_due"');
    expect(service).toContain('ruleKey: "document.expiry_due"');
    expect(service).toContain("runAutomationItem");
    expect(service).toContain("DOCUMENT_REPLACEMENT_MARK_FAILED");
    expect(service).toContain('source: "document_requirement.replaced"');
    expect(service).toContain("dateAtUtcHour(document.expires_at)");
    expect(automation).toContain('item.rule_key === "document.expiry_due"');
    expect(automation).toContain("markDocumentRequirementExpiredFromAutomation");
  });

  it("adds private policy file metadata without replacing version-specific acknowledgements", () => {
    const policies = read("schemas/policies.sql");
    const policyService = read("services/policyService/index.ts");
    const acknowledgementSchema = read("schemas/acknowledgements.sql");

    for (const column of ["file_storage_path", "file_original_name", "file_mime_type", "file_uploaded_at", "file_uploaded_by"]) {
      expect(policies).toContain(column);
    }
    expect(policyService).toContain("attachPolicyFile");
    expect(policyService).toContain("assertPrivateDocumentStorageReady");
    expect(policyService).toContain("POLICY_FILE_UNSUPPORTED_TYPE");
    expect(acknowledgementSchema).toContain("policy_version = p_policy_version");
    expect(acknowledgementSchema).toContain("archived_at is null");
  });

  it("keeps archived policies historical and out of current employee obligations", () => {
    const policyService = read("services/policyService/index.ts");
    const signal = read("services/signalEngine/unacknowledgedPolicy.ts");

    expect(policyService).toContain('.is("archived_at", null)');
    expect(policyService).toContain(".eq(\"is_published\", true)");
    expect(signal).toContain("archived_at");
    expect(signal).toContain("is_published");
  });

  it("Phase 5D: upload-first policies with effective date, authorised file retrieval, hardened RPCs", () => {
    const policies = read("schemas/policies.sql");
    const acknowledgementSchema = read("schemas/acknowledgements.sql");
    const policyService = read("services/policyService/index.ts");
    const documentService = read("services/documentService/index.ts");
    const actions = read("app/policies/actions.ts");
    const page = read("app/policies/page.tsx");

    // Additive effective_date column, backward-compatible (nullable).
    expect(policies).toContain("effective_date date");
    expect(policies).toContain("add column if not exists effective_date date");
    expect(policyService).toContain("effective_date");

    // Upload-first + download actions; primary flow is uploadPolicyAction.
    expect(actions).toContain("uploadPolicyAction");
    expect(actions).toContain("downloadPolicyFileAction");
    expect(page).toContain("uploadPolicyAction");
    expect(page).toContain("Upload policy");
    expect(page).toContain("Create simple text policy"); // text remains, secondary

    // Authorised private-file retrieval via a signed URL (no public URL).
    expect(policyService).toContain("getPolicyFileSignedUrl");
    expect(documentService).toContain("createPrivateStorageSignedUrl");
    expect(documentService).toContain("createSignedUrl");

    // Security-definer policy RPCs are service-role only (crafted-request hardening).
    expect(policies).toContain("revoke all on function teamframe_create_policy");
    expect(policies).toContain("grant execute on function teamframe_publish_policy");
    expect(acknowledgementSchema).toContain("revoke all on function teamframe_acknowledge_policy(uuid, uuid, uuid, uuid, integer) from public, anon, authenticated");
    expect(acknowledgementSchema).toContain("grant execute on function teamframe_acknowledge_policy(uuid, uuid, uuid, uuid, integer) to service_role");

    // Version-specific acknowledgement integrity preserved.
    expect(acknowledgementSchema).toContain("policy_version = p_policy_version");
    expect(acknowledgementSchema).toContain("is_published = true");
  });
});
