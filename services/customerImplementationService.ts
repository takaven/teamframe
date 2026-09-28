import "server-only";
import { z } from "zod";
import type { Actor } from "@/middleware/rbac";
import { createServiceRoleClient } from "@/lib/db/supabaseServer";
import { normalizeCountryCode } from "@/lib/geo/countries";
import { parseSetupPack, recordSetupPackPreview, commitSetupPack, type SetupPackPreview } from "@/services/customerProvisioningService";
import { createDepartment, createLeaveDefinition, createWorkLocation } from "@/services/configurationService";
import { createChecklistTemplate, addChecklistItem, setDefaultChecklist } from "@/services/onboardingService/checklistTemplates";
import { createPosition } from "@/services/positionService";
import { createDocumentRequirement } from "@/services/documentService";
import { createPolicy, publishPolicy } from "@/services/policyService";

const DateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year!, month! - 1, day!));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month! - 1 && parsed.getUTCDate() === day;
}, "invalid calendar date");
const CountrySchema = z.string().transform((value, context) => {
  const country = normalizeCountryCode(value);
  if (!country) context.addIssue({ code: z.ZodIssueCode.custom, message: "invalid country" });
  return country ?? value;
});

const SetupPackInputSchema = z.object({
  companyCsv: z.string().min(1),
  usersCsv: z.string().optional(),
  employeesCsv: z.string().min(1),
  holidaysCsv: z.string().optional(),
  accessExceptionsCsv: z.string().optional(),
});

const ImplementationPackSchema = z.object({
  setupPack: SetupPackInputSchema,
  departments: z.array(z.string().trim().min(1).max(120)).min(1),
  workLocations: z.array(z.object({ name: z.string().trim().min(1).max(120), country: CountrySchema })).min(1),
  positions: z.array(z.object({
    key: z.string().trim().min(1).max(80),
    title: z.string().trim().min(1).max(160),
    department: z.string().trim().min(1).max(120),
    workLocation: z.string().trim().min(1).max(120).optional(),
    parentKey: z.string().trim().min(1).max(80).nullable().optional(),
    employeeEmail: z.string().trim().toLowerCase().email().nullable().optional(),
    budgeted: z.boolean().nullable().optional(),
    note: z.string().trim().max(500).nullable().optional(),
  })),
  leaveDefinitions: z.array(z.object({
    display_name: z.string().trim().min(1).max(80),
    system_leave_type: z.enum(["annual", "sick", "unpaid", "other"]),
    active: z.boolean().default(true),
    default_entitlement_days: z.number().min(0).max(365).nullable(),
    counting_basis: z.enum(["working_days", "calendar_days"]),
    attachment_requirement: z.enum(["not_required", "optional", "required"]),
  })),
  onboarding: z.object({
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(500).optional(),
    tasks: z.array(z.object({
      title: z.string().trim().min(1).max(200),
      description: z.string().trim().max(500).optional(),
      ownerRole: z.enum(["employee", "manager", "admin"]),
      dueOffsetDays: z.number().int().min(-90).max(365),
      completionMode: z.enum(["manual_confirmation", "document_required"]),
      requiredDocumentType: z.string().trim().max(120).optional(),
    }).refine((task) => task.completionMode !== "document_required" || Boolean(task.requiredDocumentType), "document task requires a document type")),
  }).optional(),
  documentRequirements: z.array(z.object({
    employeeEmail: z.string().trim().toLowerCase().email(),
    documentType: z.string().trim().min(1).max(120),
    dueDate: DateSchema.nullable().optional(),
    expiryRequired: z.boolean().optional(),
    reviewRequired: z.boolean().optional(),
    employeeUploadAllowed: z.boolean().optional(),
  })),
  policies: z.array(z.object({
    title: z.string().trim().min(1).max(200),
    body: z.string().trim().max(20000).optional(),
    version: z.number().int().min(1).max(1000),
    effectiveDate: DateSchema.optional(),
    publish: z.boolean().default(true),
  })),
});

export type CustomerImplementationPack = z.infer<typeof ImplementationPackSchema>;
export type ImplementationStage = "validating pack" | "creating organisation" | "configuring leave" | "configuring onboarding" | "publishing policies" | "importing people" | "linking positions" | "configuring documents" | "configuring access" | "reconciling";
export type ImplementationCounts = {
  employees: number; departments: number; locations: number; positions: number; managerLinks: number;
  leaveDefinitions: number; holidays: number; onboardingTemplates: number; onboardingTemplateTasks: number;
  onboardingAssignedTasks: number; documentRequirements: number; policies: number; memberships: number; invitations: number;
};
export type ImplementationResult = {
  batchId: string; tenantId: string; company: string; requestedEmployees: number; createdEmployees: number; rejected: number;
  counts: ImplementationCounts; warnings: string[]; failures: string[]; reconciliation: "PASS" | "FAIL";
  completedStages: ImplementationStage[];
};

function unique(values: string[], label: string, errors: string[]): void {
  const seen = new Set<string>();
  for (const value of values) {
    const key = value.trim().toLowerCase();
    if (seen.has(key)) errors.push(`duplicate ${label}: ${value}`);
    seen.add(key);
  }
}

export function validateCustomerImplementationPack(input: unknown): {
  pack: CustomerImplementationPack | null;
  setupPreview: SetupPackPreview | null;
  validationErrors: string[];
} {
  const parsed = ImplementationPackSchema.safeParse(input);
  if (!parsed.success) return { pack: null, setupPreview: null, validationErrors: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`) };
  let setupPreview: SetupPackPreview;
  try {
    setupPreview = parseSetupPack(parsed.data.setupPack);
  } catch (error) {
    return { pack: parsed.data, setupPreview: null, validationErrors: [error instanceof Error ? error.message : "SETUP_PACK_INVALID"] };
  }
  const errors = [...setupPreview.validationErrors];
  unique(parsed.data.departments, "department", errors);
  unique(parsed.data.workLocations.map((item) => item.name), "work location", errors);
  unique(parsed.data.positions.map((item) => item.key), "position key", errors);
  unique(parsed.data.leaveDefinitions.map((item) => item.display_name), "leave definition", errors);
  unique(parsed.data.policies.map((item) => `${item.title}:${item.version}`), "policy version", errors);

  const departments = new Set(parsed.data.departments.map((value) => value.toLowerCase()));
  const locations = new Set(parsed.data.workLocations.map((value) => value.name.toLowerCase()));
  const employeeEmails = new Set(setupPreview.employees.map((employee) => employee.email));
  for (const employee of setupPreview.employees) {
    if (!departments.has(employee.department.toLowerCase())) errors.push(`unknown department: ${employee.department} (${employee.email})`);
    if (employee.workLocation && !locations.has(employee.workLocation.toLowerCase())) errors.push(`unknown location: ${employee.workLocation} (${employee.email})`);
  }
  const positionByKey = new Map(parsed.data.positions.map((position) => [position.key, position]));
  for (const position of parsed.data.positions) {
    if (!departments.has(position.department.toLowerCase())) errors.push(`unknown position department: ${position.department} (${position.key})`);
    if (position.workLocation && !locations.has(position.workLocation.toLowerCase())) errors.push(`unknown position location: ${position.workLocation} (${position.key})`);
    if (position.parentKey && !positionByKey.has(position.parentKey)) errors.push(`unknown parent position: ${position.parentKey} (${position.key})`);
    if (position.employeeEmail && !employeeEmails.has(position.employeeEmail)) errors.push(`unknown position employee: ${position.employeeEmail} (${position.key})`);
    const seen = new Set<string>();
    let current: typeof position | undefined = position;
    while (current) {
      if (seen.has(current.key)) { errors.push(`position reporting cycle: ${position.key}`); break; }
      seen.add(current.key);
      current = current.parentKey ? positionByKey.get(current.parentKey) : undefined;
    }
  }
  for (const requirement of parsed.data.documentRequirements) {
    if (!employeeEmails.has(requirement.employeeEmail)) errors.push(`unknown document employee: ${requirement.employeeEmail}`);
  }
  return { pack: parsed.data, setupPreview, validationErrors: [...new Set(errors)] };
}

async function counts(actor: Actor): Promise<ImplementationCounts> {
  if (!actor.tenantId) throw new Error("NO_TENANT_CONTEXT");
  const db = createServiceRoleClient();
  const count = async (table: string) => {
    const result = await db.from(table).select("id", { head: true, count: "exact" }).eq("tenant_id", actor.tenantId!);
    if (result.error) throw new Error(`IMPLEMENTATION_RECONCILIATION_FAILED:${table}:${result.error.message}`);
    return result.count ?? 0;
  };
  const managerResult = await db.from("employees").select("id", { head: true, count: "exact" }).eq("tenant_id", actor.tenantId).not("manager_id", "is", null);
  if (managerResult.error) throw new Error(`IMPLEMENTATION_RECONCILIATION_FAILED:manager_links:${managerResult.error.message}`);
  const tables = await Promise.all([
    count("employees"), count("departments"), count("work_locations"), count("positions"), count("leave_definitions"),
    count("company_holidays"), count("onboarding_checklist_templates"), count("onboarding_checklist_template_items"),
    count("onboarding_tasks"), count("document_requirements"), count("policies"), count("tenant_memberships"), count("tenant_access_invitations"),
  ]);
  return {
    employees: tables[0]!, departments: tables[1]!, locations: tables[2]!, positions: tables[3]!, managerLinks: managerResult.count ?? 0,
    leaveDefinitions: tables[4]!, holidays: tables[5]!, onboardingTemplates: tables[6]!, onboardingTemplateTasks: tables[7]!,
    onboardingAssignedTasks: tables[8]!, documentRequirements: tables[9]!, policies: tables[10]!, memberships: tables[11]!, invitations: tables[12]!,
  };
}

export async function reconcileCustomerImplementation(actor: Actor, pack: CustomerImplementationPack): Promise<{ counts: ImplementationCounts; pass: boolean; failures: string[] }> {
  const actual = await counts(actor);
  const setup = parseSetupPack(pack.setupPack);
  const expectedManagerLinks = setup.employees.filter((employee) => employee.managerEmail).length;
  const failures: string[] = [];
  const exact: Array<[keyof ImplementationCounts, number]> = [
    ["employees", setup.employees.length], ["departments", pack.departments.length], ["locations", pack.workLocations.length],
    ["positions", pack.positions.length], ["managerLinks", expectedManagerLinks], ["leaveDefinitions", pack.leaveDefinitions.length],
    ["holidays", setup.holidays.length], ["onboardingTemplates", pack.onboarding ? 1 : 0],
    ["onboardingTemplateTasks", pack.onboarding?.tasks.length ?? 0], ["documentRequirements", pack.documentRequirements.length],
    ["policies", pack.policies.length], ["invitations", setup.users.length],
  ];
  for (const [key, expected] of exact) if (actual[key] !== expected) failures.push(`${key}: expected ${expected}, found ${actual[key]}`);
  if (actual.memberships < 1) failures.push("memberships: expected at least the bootstrap operator");
  return { counts: actual, pass: failures.length === 0, failures };
}

export async function executeCustomerImplementation(
  actor: Actor,
  input: unknown,
  onProgress: (stage: ImplementationStage) => void = () => undefined,
): Promise<ImplementationResult> {
  const validation = validateCustomerImplementationPack(input);
  if (!validation.pack || !validation.setupPreview || validation.validationErrors.length > 0) {
    throw new Error(`IMPLEMENTATION_NOT_READY:${validation.validationErrors.join("|")}`);
  }
  const pack = validation.pack;
  const preview = validation.setupPreview;
  const completedStages: ImplementationStage[] = [];
  const stage = (value: ImplementationStage) => { onProgress(value); completedStages.push(value); };
  stage("validating pack");
  const recorded = await recordSetupPackPreview(actor, { tenantId: actor.tenantId, fileName: "customer-implementation-pack.json", ...pack.setupPack });
  const db = createServiceRoleClient();
  try {
    stage("creating organisation");
    for (const department of pack.departments) await createDepartment(actor, department);
    for (const location of pack.workLocations) await createWorkLocation(actor, location.name, location.country);

    stage("configuring leave");
    for (const definition of pack.leaveDefinitions) await createLeaveDefinition(actor, definition);

    stage("configuring onboarding");
    if (pack.onboarding) {
      const templateId = await createChecklistTemplate(actor, { name: pack.onboarding.name, description: pack.onboarding.description });
      for (const task of pack.onboarding.tasks) await addChecklistItem(actor, templateId, task);
      await setDefaultChecklist(actor, templateId);
    }

    stage("publishing policies");
    for (const policyInput of pack.policies) {
      const policy = await createPolicy(actor, policyInput);
      if (policyInput.publish) await publishPolicy(actor, policy.id, policy.updated_at);
    }

    stage("importing people");
    const tenantId = await commitSetupPack(actor, recorded.id);

    const [employeeRows, departmentRows, locationRows] = await Promise.all([
      db.from("employees").select("id,email").eq("tenant_id", tenantId),
      db.from("departments").select("id,name").eq("tenant_id", tenantId),
      db.from("work_locations").select("id,name").eq("tenant_id", tenantId),
    ]);
    if (employeeRows.error || departmentRows.error || locationRows.error) throw new Error("IMPLEMENTATION_LOOKUP_FAILED");
    const employeeIds = new Map(((employeeRows.data ?? []) as Array<{ id: string; email: string }>).map((row) => [row.email.toLowerCase(), row.id]));
    const departmentIds = new Map(((departmentRows.data ?? []) as Array<{ id: string; name: string }>).map((row) => [row.name.toLowerCase(), row.id]));
    const locationIds = new Map(((locationRows.data ?? []) as Array<{ id: string; name: string }>).map((row) => [row.name.toLowerCase(), row.id]));

    stage("linking positions");
    const pending = new Map(pack.positions.map((position) => [position.key, position]));
    const positionIds = new Map<string, string>();
    while (pending.size > 0) {
      let createdInPass = 0;
      for (const [key, position] of [...pending]) {
        if (position.parentKey && !positionIds.has(position.parentKey)) continue;
        const created = await createPosition(actor, {
          title: position.title, department: position.department,
          departmentId: departmentIds.get(position.department.toLowerCase()) ?? null,
          workLocationId: position.workLocation ? locationIds.get(position.workLocation.toLowerCase()) ?? null : null,
          parentPositionId: position.parentKey ? positionIds.get(position.parentKey) ?? null : null,
          assignedEmployeeId: position.employeeEmail ? employeeIds.get(position.employeeEmail) ?? null : null,
          budgeted: position.budgeted ?? null, note: position.note ?? null,
        });
        positionIds.set(key, created.id); pending.delete(key); createdInPass += 1;
      }
      if (createdInPass === 0) throw new Error("IMPLEMENTATION_POSITION_ORDER_FAILED");
    }

    stage("configuring documents");
    for (const requirement of pack.documentRequirements) {
      await createDocumentRequirement(actor, { ...requirement, employeeId: employeeIds.get(requirement.employeeEmail)! });
    }

    stage("configuring access");
    // Invitations and access exceptions are staged by the canonical setup-pack commit.

    stage("reconciling");
    const reconciliation = await reconcileCustomerImplementation(actor, pack);
    return {
      batchId: recorded.id, tenantId, company: preview.company.name, requestedEmployees: preview.employees.length,
      createdEmployees: reconciliation.counts.employees, rejected: 0, counts: reconciliation.counts,
      warnings: [], failures: reconciliation.failures, reconciliation: reconciliation.pass ? "PASS" : "FAIL", completedStages,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "IMPLEMENTATION_FAILED";
    await db.from("setup_import_batches").update({ state: "failed", validation_errors: [message] } as never)
      .eq("tenant_id", actor.tenantId!).eq("id", recorded.id);
    let partial: ImplementationCounts | null = null;
    try { partial = await counts(actor); } catch { /* the original failure remains primary */ }
    throw new Error(`IMPLEMENTATION_PARTIAL_FAILURE:${completedStages.at(-1) ?? "unknown"}:${message}:COUNTS=${JSON.stringify(partial)}:NEXT_ACTION=inspect_and_reconcile_do_not_rerun`);
  }
}
