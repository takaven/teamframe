import "server-only";

import { z } from "zod";
import type { Actor } from "@/middleware/rbac";
import {
  getCompanySettings,
  listLeaveDefinitions,
  updateCompanySettings,
  updateLeaveDefinition,
  type CountingBasis,
  type LeaveDefinition,
} from "@/services/configurationService";
import {
  copyStarterChecklist,
  listChecklistTemplates,
} from "@/services/onboardingService/checklistTemplates";
import { createServiceRoleClient } from "@/lib/db/supabaseServer";

const FEDERAL_LAW_URL = "https://uaelegislation.gov.ae/en/legislations/1541/download";

export const UAE_FEDERAL_REFERENCES = {
  annualLeave: {
    label: "Annual leave",
    summary: "30 days per completed year of service.",
    article: "Federal Decree-Law No. 33 of 2021, Article 29",
    sourceUrl: FEDERAL_LAW_URL,
    reviewedAt: "2026-10-09",
  },
  sickLeave: {
    label: "Sick leave",
    summary: "Up to 90 days per year after probation. Pay treatment remains outside TeamFrame.",
    article: "Federal Decree-Law No. 33 of 2021, Article 31",
    sourceUrl: FEDERAL_LAW_URL,
    reviewedAt: "2026-10-09",
  },
  maternityLeave: {
    label: "Maternity leave",
    summary: "60 days (45 days at full pay and 15 days at half pay). TeamFrame records leave days only.",
    article: "Federal Decree-Law No. 33 of 2021, Article 30",
    sourceUrl: FEDERAL_LAW_URL,
    reviewedAt: "2026-10-09",
  },
  parentalLeave: {
    label: "Parental leave",
    summary: "5 working days, subject to the statutory timing conditions.",
    article: "Federal Decree-Law No. 33 of 2021, Article 32",
    sourceUrl: FEDERAL_LAW_URL,
    reviewedAt: "2026-10-09",
  },
  bereavementLeave: {
    label: "Bereavement leave",
    summary: "5 days for a spouse, or 3 days for the relatives specified by the law.",
    article: "Federal Decree-Law No. 33 of 2021, Article 32",
    sourceUrl: FEDERAL_LAW_URL,
    reviewedAt: "2026-10-09",
  },
  studyLeave: {
    label: "Study leave",
    summary: "10 working days per year where the statutory eligibility conditions are met.",
    article: "Federal Decree-Law No. 33 of 2021, Article 32",
    sourceUrl: FEDERAL_LAW_URL,
    reviewedAt: "2026-10-09",
  },
  probation: {
    label: "Probation",
    summary: "May not exceed 6 months. The contractual end date must still be entered explicitly.",
    article: "Federal Decree-Law No. 33 of 2021, Article 9",
    sourceUrl: FEDERAL_LAW_URL,
    reviewedAt: "2026-10-09",
  },
} as const;

export const UAE_CORE_LEAVE_TEMPLATES = [
  {
    key: "maternity_leave",
    displayName: "Maternity Leave",
    defaultEntitlementDays: 60,
    active: false,
    countingBasis: "calendar_days" as CountingBasis,
    attachmentRequirement: "optional" as const,
    reference: UAE_FEDERAL_REFERENCES.maternityLeave,
  },
  {
    key: "parental_leave",
    displayName: "Parental Leave",
    defaultEntitlementDays: 5,
    active: false,
    countingBasis: "working_days" as CountingBasis,
    attachmentRequirement: "optional" as const,
    reference: UAE_FEDERAL_REFERENCES.parentalLeave,
  },
  {
    key: "bereavement_leave",
    displayName: "Bereavement Leave",
    defaultEntitlementDays: null,
    active: false,
    countingBasis: "calendar_days" as CountingBasis,
    attachmentRequirement: "not_required" as const,
    reference: UAE_FEDERAL_REFERENCES.bereavementLeave,
  },
  {
    key: "study_leave",
    displayName: "Study Leave",
    defaultEntitlementDays: 10,
    active: false,
    countingBasis: "working_days" as CountingBasis,
    attachmentRequirement: "optional" as const,
    reference: UAE_FEDERAL_REFERENCES.studyLeave,
  },
] as const;

export const UAE_SETUP_PACK = {
  documentCategories: [
    "Employment contract / signed employment terms",
    "Emirates ID",
    "Passport",
    "Residence visa",
    "Labour card / work permit",
    "Medical fitness",
    "Medical insurance",
    "ILOE",
  ],
  holidayGuidance:
    "Confirm official UAE holiday dates each year. Religious holiday dates can be updated after official announcement.",
  probationGuidance:
    "Record whether probation applies and enter the contractual end date explicitly. TeamFrame never invents a probation period.",
  offboardingGuidance:
    "Use the existing standard offboarding checklist and add any applicable visa or permit cancellation evidence as a manual item.",
  policyCategories: [
    "Employment",
    "Leave and attendance",
    "Conduct",
    "Data and confidentiality",
    "Health and safety",
  ],
} as const;

const Input = z.object({
  weekend: z.enum(["friday_saturday", "saturday_sunday"]),
  annualEntitlement: z.number().min(0).max(365),
  annualCountingBasis: z.enum(["calendar_days", "working_days"]),
  sickEntitlement: z.number().min(0).max(365),
  entitlementTiming: z.enum([
    "upfront",
    "joining_date_proration",
    "monthly_accrual",
    "annual_accrual",
  ]),
  carryForward: z.boolean(),
  carryCap: z.number().min(0).max(365).nullable(),
  confirmed: z.literal(true),
});

function isSameLeaveTemplate(
  definition: Pick<LeaveDefinition, "code" | "display_name">,
  template: (typeof UAE_CORE_LEAVE_TEMPLATES)[number],
): boolean {
  return (
    definition.code === template.key ||
    definition.display_name.trim().toLowerCase() === template.displayName.toLowerCase()
  );
}

async function createMissingCoreLeaveTemplates(
  actor: Actor,
  definitions: LeaveDefinition[],
  db: ReturnType<typeof createServiceRoleClient>,
): Promise<void> {
  if (!actor.tenantId) throw new Error("NO_TENANT_CONTEXT");
  for (const template of UAE_CORE_LEAVE_TEMPLATES) {
    if (definitions.some((definition) => isSameLeaveTemplate(definition, template))) continue;
    const { error } = await db.from("leave_definitions").upsert({
      tenant_id: actor.tenantId,
      code: template.key,
      display_name: template.displayName,
      system_leave_type: "other",
      active: template.active,
      default_entitlement_days: template.defaultEntitlementDays,
      counting_basis: template.countingBasis,
      attachment_requirement: template.attachmentRequirement,
      is_system: false,
      sort_order: 100,
      accrual_enabled: false,
      accrual_frequency: "annual",
      joining_date_pro_rata: false,
      carry_forward_enabled: false,
      carry_forward_cap_days: null,
    } as never, { onConflict: "tenant_id,code", ignoreDuplicates: true });
    if (error) throw new Error(`UAE_SETUP_LEAVE_TEMPLATE_FAILED: ${error.message}`);
  }
}

export type UaeHrBasicsState = "configured" | "needs_setup" | "needs_review";

export type UaeHrBasicsSummaryItem = {
  label: string;
  state: UaeHrBasicsState;
  detail: string;
};

export function buildUaeHrBasicsSummary(input: {
  leaveDefinitions: LeaveDefinition[];
  currentYearHolidayCount: number;
  hasUaeStarterChecklist: boolean;
  hasPublishedPolicy: boolean;
}): UaeHrBasicsSummaryItem[] {
  const annual = input.leaveDefinitions.find((definition) => definition.code === "annual");
  const sick = input.leaveDefinitions.find((definition) => definition.code === "sick");
  const conflictingTiming = Boolean(annual?.accrual_enabled && annual.joining_date_pro_rata);
  const coreTemplates = UAE_CORE_LEAVE_TEMPLATES.map((template) =>
    input.leaveDefinitions.find((definition) => isSameLeaveTemplate(definition, template)),
  ).filter((definition): definition is LeaveDefinition => Boolean(definition));
  const coreTemplateCount = coreTemplates.length;
  const inactiveCoreTemplateCount = coreTemplates.filter((definition) => !definition.active).length;

  return [
    {
      label: "Leave settings",
      state: conflictingTiming
        ? "needs_review"
        : annual?.active && sick?.active && coreTemplateCount === UAE_CORE_LEAVE_TEMPLATES.length
          ? inactiveCoreTemplateCount > 0
            ? "needs_review"
            : "configured"
          : "needs_setup",
      detail: conflictingTiming
        ? "Annual leave has more than one entitlement-timing method selected."
        : inactiveCoreTemplateCount > 0
          ? `${coreTemplateCount}/${UAE_CORE_LEAVE_TEMPLATES.length} core additional leave templates are available; ${inactiveCoreTemplateCount} await company review and activation.`
          : `${coreTemplateCount}/${UAE_CORE_LEAVE_TEMPLATES.length} core additional leave types are available.`,
    },
    {
      label: "Current-year holidays",
      state: input.currentYearHolidayCount > 0 ? "configured" : "needs_setup",
      detail:
        input.currentYearHolidayCount > 0
          ? `${input.currentYearHolidayCount} confirmed holiday date${input.currentYearHolidayCount === 1 ? "" : "s"} entered.`
          : "Current-year public holidays have not been added.",
    },
    {
      label: "UAE starter checklist",
      state: input.hasUaeStarterChecklist ? "configured" : "needs_setup",
      detail: input.hasUaeStarterChecklist
        ? "The editable UAE starter checklist is available."
        : "Apply the UAE setup pack to copy the starter checklist.",
    },
    {
      label: "Policies",
      state: input.hasPublishedPolicy ? "configured" : "needs_setup",
      detail: input.hasPublishedPolicy
        ? "At least one policy is published for acknowledgement."
        : "No published policy is available for acknowledgement yet.",
    },
  ];
}

export async function applyUaeSetupPack(actor: Actor, input: unknown): Promise<void> {
  if (actor.role !== "admin" || !actor.tenantId) throw new Error("FORBIDDEN");
  const value = Input.parse(input);
  const db = createServiceRoleClient();
  const [company, definitions, checklists] = await Promise.all([
    getCompanySettings(actor),
    listLeaveDefinitions(actor),
    listChecklistTemplates(actor),
  ]);
  const annual = definitions.find((definition) => definition.code === "annual");
  const sick = definitions.find((definition) => definition.code === "sick");
  if (!annual || !sick) throw new Error("UAE_SETUP_LEAVE_DEFINITIONS_MISSING");

  await updateCompanySettings(actor, {
    ...company,
    country: "AE",
    default_working_days:
      value.weekend === "friday_saturday" ? [7, 1, 2, 3, 4] : [1, 2, 3, 4, 5],
  });
  await updateLeaveDefinition(actor, annual.id, {
    display_name: annual.display_name,
    system_leave_type: annual.system_leave_type,
    active: true,
    default_entitlement_days: value.annualEntitlement,
    counting_basis: value.annualCountingBasis,
    attachment_requirement: annual.attachment_requirement,
    accrual_enabled:
      value.entitlementTiming === "monthly_accrual" ||
      value.entitlementTiming === "annual_accrual",
    accrual_frequency: value.entitlementTiming === "annual_accrual" ? "annual" : "monthly",
    joining_date_pro_rata: value.entitlementTiming === "joining_date_proration",
    carry_forward_enabled: value.carryForward,
    carry_forward_cap_days: value.carryForward ? value.carryCap : null,
  });
  await updateLeaveDefinition(actor, sick.id, {
    display_name: sick.display_name,
    system_leave_type: sick.system_leave_type,
    active: true,
    default_entitlement_days: value.sickEntitlement,
    counting_basis: sick.counting_basis,
    attachment_requirement: sick.attachment_requirement,
    accrual_enabled: sick.accrual_enabled,
    accrual_frequency: sick.accrual_frequency,
    joining_date_pro_rata: sick.joining_date_pro_rata,
    carry_forward_enabled: sick.carry_forward_enabled,
    carry_forward_cap_days: sick.carry_forward_cap_days,
  });
  await createMissingCoreLeaveTemplates(actor, definitions, db);
  if (!checklists.some((template) => template.name === "UAE starter checklist")) {
    await copyStarterChecklist(actor, "uae_sme");
  }
  const audit = await db.from("audit_logs")
    .insert({
      tenant_id: actor.tenantId,
      actor_user_id: actor.authUserId,
      action_type: "setup.uae_pack_applied",
    } as never);
  if (audit.error) throw new Error(`AUDIT_LOG_FAILED: ${audit.error.message}`);
}
