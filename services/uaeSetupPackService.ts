import "server-only";

import { z } from "zod";
import type { Actor } from "@/middleware/rbac";
import {
  listLeaveDefinitions,
  updateLeaveDefinition,
  type CountingBasis,
  type LeaveDefinition,
} from "@/services/configurationService";
import { createServiceRoleClient } from "@/lib/db/supabaseServer";

const FEDERAL_LAW_URL = "https://uaelegislation.gov.ae/en/legislations/1541/download";
const UAE_OFFICIAL_GUIDANCE_URLS = {
  annualLeave:
    "https://u.ae/en/information-and-services/jobs/employment-in-the-private-sector/types-of-leaves-and-entitlements-in-the-private-sector/annual-leave",
  executiveRegulations:
    "https://www.uaelegislation.gov.ae/en/legislations/1547/download",
  hajjLeave:
    "https://u.ae/en/information-and-services/jobs/employment-in-the-private-sector/types-of-leaves-and-entitlements-in-the-private-sector/hajj-and-umrah-leave",
  nationalServiceLeave:
    "https://u.ae/en/information-and-services/jobs/employment-in-the-private-sector/types-of-leaves-and-entitlements-in-the-private-sector/sabbatical-leave",
  workingHours:
    "https://u.ae/en/information-and-services/jobs/employment-in-the-private-sector/working-hours",
  restAndHolidays:
    "https://u.ae/en/information-and-services/jobs/employment-in-the-private-sector/types-of-leaves-and-entitlements-in-the-private-sector/official-leaves-and-vacations",
  employmentModels:
    "https://u.ae/en/information-and-services/jobs/employment-in-the-private-sector/job-offers-and-work-permits-and-contracts/employment-contracts-duration-and-models-in-the-private-sector",
  termination:
    "https://u.ae/en/information-and-services/jobs/employment-in-the-private-sector/job-offers-and-work-permits-and-contracts/terminating-employment-contracts",
  finalDues:
    "https://u.ae/en/information-and-services/jobs/employment-in-the-private-sector/end-of-service-benefits-for-employees-in-the-private-sector",
  workInjuryResolution:
    "https://www.uaelegislation.gov.ae/en/legislations/1559/download",
  disciplinaryRules:
    "https://u.ae/en/information-and-services/jobs/employment-in-the-private-sector/disciplinary-rules",
  workplaceSafety:
    "https://u.ae/en/information-and-services/jobs/health-and-safety-at-workplace",
  healthInsurance:
    "https://u.ae/en/information-and-services/health-and-fitness/getting-a-health-insurance",
  unemploymentInsurance:
    "https://u.ae/en/information-and-services/jobs/insurance/unemployment-insurance-scheme",
  emiratisation:
    "https://u.ae/en/information-and-services/jobs/employment-in-the-private-sector/emiratis-employment-in-private-sector",
  uaePension:
    "https://gpssa.gov.ae/pages/en/help/faq/registration-gpssa-mandatory",
  gccPension:
    "https://www.gpssa.gov.ae/pages/en/services/gcc-overview",
  wageProtection:
    "https://u.ae/en/information-and-services/jobs/employment-in-the-private-sector/payment-of-wages",
} as const;

export const UAE_FEDERAL_REFERENCES = {
  annualLeave: {
    label: "Annual leave",
    summary: "30 days after one completed year; 2 days per month where service exceeds 6 months but is less than 1 year.",
    article: "Federal Decree-Law No. 33 of 2021, Article 29",
    sourceUrl: UAE_OFFICIAL_GUIDANCE_URLS.annualLeave,
    reviewedAt: "2026-10-09",
  },
  partTimeAnnualLeave: {
    label: "Part-time annual leave",
    summary: "Uses a separate hours-based calculation under the implementing regulations; confirm the employee-specific entitlement.",
    article: "Cabinet Resolution No. 1 of 2022, Article 18",
    sourceUrl: UAE_OFFICIAL_GUIDANCE_URLS.executiveRegulations,
    reviewedAt: "2026-10-09",
  },
  annualLeaveCarryForward: {
    label: "Annual leave carry-forward",
    summary: "The implementing regulations allow no more than half of annual leave to be carried to the following year; confirm company policy before setting a cap.",
    article: "Cabinet Resolution No. 1 of 2022, Article 19",
    sourceUrl: UAE_OFFICIAL_GUIDANCE_URLS.executiveRegulations,
    reviewedAt: "2026-10-09",
  },
  sickLeave: {
    label: "Sick leave",
    summary: "Up to 90 days per year after probation: first 15 days at full pay, next 30 at half pay and remaining 45 unpaid. TeamFrame records days only.",
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
  hajjLeave: {
    label: "Hajj leave",
    summary: "Hajj guidance describes unpaid leave of up to 30 days, once during employment with the same employer. Umrah has no separate statutory leave provision; the employer may handle a request under company policy, annual leave or unpaid leave.",
    article: "Official UAE Government guidance — Hajj and Umrah leave",
    sourceUrl: UAE_OFFICIAL_GUIDANCE_URLS.hajjLeave,
    reviewedAt: "2026-10-09",
  },
  nationalServiceLeave: {
    label: "National service leave",
    summary: "Paid sabbatical leave for UAE nationals; duration and applicability follow the applicable national-service requirement.",
    article: "Federal Decree-Law No. 33 of 2021, Article 32",
    sourceUrl: UAE_OFFICIAL_GUIDANCE_URLS.nationalServiceLeave,
    reviewedAt: "2026-10-09",
  },
  probation: {
    label: "Probation",
    summary: "May not exceed 6 months. The contractual end date must still be entered explicitly.",
    article: "Federal Decree-Law No. 33 of 2021, Article 9",
    sourceUrl: FEDERAL_LAW_URL,
    reviewedAt: "2026-10-09",
  },
  workingHours: {
    label: "Working hours and rest breaks",
    summary: "Ordinary private-sector baseline: 8 hours per day or 48 hours per week; Ramadan reduces normal hours by 2 per day; after 5 consecutive hours, breaks total at least 1 hour.",
    article: "Federal Decree-Law No. 33 of 2021, Articles 17–18",
    sourceUrl: UAE_OFFICIAL_GUIDANCE_URLS.workingHours,
    reviewedAt: "2026-10-09",
  },
  weeklyRest: {
    label: "Weekly rest and official holidays",
    summary: "At least one paid weekly rest day. Work on an official holiday is compensated by substitute rest or the applicable additional payment.",
    article: "Federal Decree-Law No. 33 of 2021, Articles 21 and 28",
    sourceUrl: UAE_OFFICIAL_GUIDANCE_URLS.restAndHolidays,
    reviewedAt: "2026-10-09",
  },
  employmentModels: {
    label: "Employment terms and work models",
    summary: "The private-sector framework recognises full-time, part-time, temporary, flexible, remote and job-sharing arrangements; record the agreed terms in contract evidence.",
    article: "Federal Decree-Law No. 33 of 2021 and Cabinet Resolution No. 1 of 2022",
    sourceUrl: UAE_OFFICIAL_GUIDANCE_URLS.employmentModels,
    reviewedAt: "2026-10-09",
  },
  noticePeriod: {
    label: "Ordinary notice period",
    summary: "Ordinary contractual termination notice is generally 30–90 days. Probation has separate notice rules that must be confirmed before termination or transfer.",
    article: "Federal Decree-Law No. 33 of 2021, Articles 9 and 43",
    sourceUrl: UAE_OFFICIAL_GUIDANCE_URLS.termination,
    reviewedAt: "2026-10-09",
  },
  finalDues: {
    label: "Final dues",
    summary: "Outstanding wages, other termination entitlements and any applicable gratuity are generally due within 14 days following termination.",
    article: "Federal Decree-Law No. 33 of 2021, Article 53",
    sourceUrl: UAE_OFFICIAL_GUIDANCE_URLS.finalDues,
    reviewedAt: "2026-10-09",
  },
  workInjury: {
    label: "Work injury reporting",
    summary: "Maintain an internal process; qualifying work injuries or occupational illnesses may require MoHRE reporting within 48 hours. TeamFrame does not submit government reports.",
    article: "Cabinet Resolution No. 33 of 2022, Article 3",
    sourceUrl: UAE_OFFICIAL_GUIDANCE_URLS.workInjuryResolution,
    reviewedAt: "2026-10-09",
  },
  workforce50WorkRegulations: {
    label: "50+ workers — internal work regulations",
    summary: "Establishments with 50 or more workers must establish internal work regulations and a clear complaints and grievance system.",
    article: "Cabinet Resolution No. 1 of 2022, Articles 14 and 24",
    sourceUrl: UAE_OFFICIAL_GUIDANCE_URLS.disciplinaryRules,
    reviewedAt: "2026-10-09",
  },
  workforce50InjuryMonitoring: {
    label: "50+ workers — injury monitoring",
    summary: "Establishments with 50 or more workers must maintain a system for monitoring work injuries and occupational diseases.",
    article: "Official MoHRE/U.AE workplace health and safety guidance",
    sourceUrl: UAE_OFFICIAL_GUIDANCE_URLS.workplaceSafety,
    reviewedAt: "2026-10-09",
  },
} as const;

export const UAE_EXTERNAL_OBLIGATION_REFERENCES = [
  {
    key: "health_insurance",
    label: "Health insurance",
    summary: "From 1 January 2025, employer-purchased health insurance is a prerequisite for issuing or renewing private-sector employee residency permits, subject to applicable transitional and emirate arrangements. Use TeamFrame's Medical Insurance document requirement to retain evidence and expiry.",
    sources: [{ label: "Official UAE Government guidance", url: UAE_OFFICIAL_GUIDANCE_URLS.healthInsurance }],
    reviewedAt: "2026-10-09",
  },
  {
    key: "iloe",
    label: "ILOE",
    summary: "Participation generally applies to Federal Government and private-sector employees, subject to statutory exclusions. Confirm individual applicability and retain ILOE evidence in TeamFrame where relevant.",
    sources: [{ label: "Official UAE Government guidance", url: UAE_OFFICIAL_GUIDANCE_URLS.unemploymentInsurance }],
    reviewedAt: "2026-10-09",
  },
  {
    key: "emiratisation",
    label: "Emiratisation",
    summary: "Workforce targets may apply based on company size, activity and current MoHRE classification, including selected establishments with 20–49 employees. TeamFrame does not calculate targets; confirm current obligations separately.",
    sources: [{ label: "Official UAE Government guidance", url: UAE_OFFICIAL_GUIDANCE_URLS.emiratisation }],
    reviewedAt: "2026-10-09",
  },
  {
    key: "uae_gcc_pension",
    label: "UAE/GCC national pension",
    summary: "UAE or GCC national employees may create pension or social-security registration and contribution obligations. Confirm the applicable authority and requirements separately.",
    sources: [
      { label: "GPSSA — UAE nationals", url: UAE_OFFICIAL_GUIDANCE_URLS.uaePension },
      { label: "GPSSA — GCC protection extension", url: UAE_OFFICIAL_GUIDANCE_URLS.gccPension },
    ],
    reviewedAt: "2026-10-09",
  },
  {
    key: "payroll_wps",
    label: "Payroll and WPS",
    summary: "Payroll and WPS administration remain outside TeamFrame. TeamFrame can hold employee and compensation information used in the HR/finance handoff; confirm applicable payment obligations separately.",
    sources: [{ label: "Official UAE Government guidance", url: UAE_OFFICIAL_GUIDANCE_URLS.wageProtection }],
    reviewedAt: "2026-10-09",
  },
] as const;

export const UAE_SUGGESTED_LEAVE_TEMPLATES = [
  {
    key: "maternity_leave",
    displayName: "Maternity Leave",
    defaultEntitlementDays: null,
    active: false,
    inactiveStorageBasis: "calendar_days" as CountingBasis,
    inactiveStorageAttachmentRequirement: "not_required" as const,
    reference: UAE_FEDERAL_REFERENCES.maternityLeave,
  },
  {
    key: "parental_leave",
    displayName: "Parental Leave",
    defaultEntitlementDays: null,
    active: false,
    inactiveStorageBasis: "calendar_days" as CountingBasis,
    inactiveStorageAttachmentRequirement: "not_required" as const,
    reference: UAE_FEDERAL_REFERENCES.parentalLeave,
  },
  {
    key: "bereavement_leave",
    displayName: "Bereavement Leave",
    defaultEntitlementDays: null,
    active: false,
    inactiveStorageBasis: "calendar_days" as CountingBasis,
    inactiveStorageAttachmentRequirement: "not_required" as const,
    reference: UAE_FEDERAL_REFERENCES.bereavementLeave,
  },
  {
    key: "study_leave",
    displayName: "Study Leave",
    defaultEntitlementDays: null,
    active: false,
    inactiveStorageBasis: "calendar_days" as CountingBasis,
    inactiveStorageAttachmentRequirement: "not_required" as const,
    reference: UAE_FEDERAL_REFERENCES.studyLeave,
  },
  {
    key: "hajj_leave",
    displayName: "Hajj Leave",
    defaultEntitlementDays: null,
    active: false,
    inactiveStorageBasis: "calendar_days" as CountingBasis,
    inactiveStorageAttachmentRequirement: "not_required" as const,
    reference: UAE_FEDERAL_REFERENCES.hajjLeave,
  },
  {
    key: "national_service_leave",
    displayName: "National Service Leave",
    defaultEntitlementDays: null,
    active: false,
    inactiveStorageBasis: "calendar_days" as CountingBasis,
    inactiveStorageAttachmentRequirement: "not_required" as const,
    reference: UAE_FEDERAL_REFERENCES.nationalServiceLeave,
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
    "Confirm official UAE holiday dates each year. Religious holiday dates can be updated after official announcement. If an employee works on an official holiday, confirm the applicable substitute rest or additional payment outside TeamFrame.",
  probationGuidance:
    "Record whether probation applies and enter the contractual end date explicitly. TeamFrame never invents a probation period.",
  offboardingGuidance:
    "Use the existing offboarding checklist to confirm the final date and contractual notice. Federal reference: ordinary notice is generally 30–90 days and final dues are generally payable within 14 days; probation has separate notice rules. Confirm final wages, unused-leave settlement and any applicable end-of-service entitlement outside TeamFrame, and add visa or permit cancellation evidence as a manual item.",
  employmentTermsGuidance:
    "Reflect the agreed work model and employment terms in the employee record and signed contract evidence. Use existing document expiry tracking where a fixed contract or related evidence needs review.",
  workInjuryGuidance:
    "Maintain an internal process for workplace injuries and occupational illnesses. Qualifying incidents may require MoHRE reporting within 48 hours. TeamFrame does not submit government reports.",
  workforce50Guidance:
    "50+ workers: review the Federal requirements for internal work regulations, a clear complaints and grievance system, and work-injury and occupational-disease monitoring. TeamFrame does not infer applicability or operate those processes.",
  policyCategories: [
    "Employment terms",
    "Leave and public holidays",
    "Working hours and overtime",
    "Conduct",
    "Equal treatment / anti-harassment",
    "Disciplinary and grievance",
    "Data and confidentiality",
    "Health, safety and work-injury reporting",
  ],
} as const;

const Input = z.object({
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
  suggestedLeaves: z.array(z.object({
    key: z.enum([
      "maternity_leave",
      "parental_leave",
      "bereavement_leave",
      "study_leave",
      "hajj_leave",
      "national_service_leave",
    ]),
    applicable: z.boolean(),
    entitlementDays: z.number().min(0).max(365).nullable(),
    countingBasis: z.enum(["calendar_days", "working_days"]).nullable(),
    attachmentRequirement: z.enum(["not_required", "optional", "required"]).nullable(),
  }).superRefine((leave, context) => {
    if (!leave.applicable) return;
    if (leave.entitlementDays === null) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "SUGGESTED_LEAVE_DAYS_REQUIRED", path: ["entitlementDays"] });
    }
    if (leave.countingBasis === null) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "SUGGESTED_LEAVE_BASIS_REQUIRED", path: ["countingBasis"] });
    }
    if (leave.attachmentRequirement === null) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "SUGGESTED_LEAVE_EVIDENCE_REQUIRED", path: ["attachmentRequirement"] });
    }
  })).default([]).superRefine((leaves, context) => {
    const keys = new Set<string>();
    for (const [index, leave] of leaves.entries()) {
      if (keys.has(leave.key)) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: "SUGGESTED_LEAVE_DUPLICATE", path: [index, "key"] });
      }
      keys.add(leave.key);
    }
  }),
  confirmed: z.literal(true),
});

export function isSameUaeSuggestedLeaveTemplate(
  definition: Pick<LeaveDefinition, "code" | "display_name">,
  template: (typeof UAE_SUGGESTED_LEAVE_TEMPLATES)[number],
): boolean {
  return (
    definition.code === template.key ||
    definition.display_name.trim().toLowerCase() === template.displayName.toLowerCase()
  );
}

async function applySuggestedLeaveConfiguration(
  actor: Actor,
  definitions: LeaveDefinition[],
  configurations: z.infer<typeof Input>["suggestedLeaves"],
  db: ReturnType<typeof createServiceRoleClient>,
): Promise<void> {
  if (!actor.tenantId) throw new Error("NO_TENANT_CONTEXT");
  const byKey = new Map(configurations.map((configuration) => [configuration.key, configuration]));
  for (const template of UAE_SUGGESTED_LEAVE_TEMPLATES) {
    const definition = definitions.find((candidate) => isSameUaeSuggestedLeaveTemplate(candidate, template));
    const configuration = byKey.get(template.key);
    if (definition) {
      if (!configuration) continue;
      await updateLeaveDefinition(actor, definition.id, {
        display_name: definition.display_name,
        system_leave_type: definition.system_leave_type,
        active: configuration.applicable,
        default_entitlement_days: configuration.entitlementDays,
        counting_basis: configuration.countingBasis ?? definition.counting_basis,
        attachment_requirement: configuration.attachmentRequirement ?? definition.attachment_requirement,
        accrual_enabled: definition.accrual_enabled,
        accrual_frequency: definition.accrual_frequency,
        joining_date_pro_rata: definition.joining_date_pro_rata,
        carry_forward_enabled: definition.carry_forward_enabled,
        carry_forward_cap_days: definition.carry_forward_cap_days,
      });
      continue;
    }
    const { error } = await db.from("leave_definitions").upsert({
      tenant_id: actor.tenantId,
      code: template.key,
      display_name: template.displayName,
      system_leave_type: "other",
      active: configuration?.applicable ?? false,
      default_entitlement_days: configuration?.entitlementDays ?? null,
      // The database requires a basis even for inactive definitions. This neutral
      // storage value is not shown as company policy and must be chosen explicitly
      // before activation.
      counting_basis: configuration?.countingBasis ?? template.inactiveStorageBasis,
      attachment_requirement:
        configuration?.attachmentRequirement ?? template.inactiveStorageAttachmentRequirement,
      is_system: false,
      sort_order: 100,
      accrual_enabled: false,
      accrual_frequency: "annual",
      joining_date_pro_rata: false,
      carry_forward_enabled: false,
      carry_forward_cap_days: null,
    } as never, { onConflict: "tenant_id,code", ignoreDuplicates: true });
    if (error) throw new Error(`UAE_SETUP_SUGGESTED_LEAVE_FAILED: ${error.message}`);
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
}): UaeHrBasicsSummaryItem[] {
  const annual = input.leaveDefinitions.find((definition) => definition.code === "annual");
  const sick = input.leaveDefinitions.find((definition) => definition.code === "sick");
  const conflictingTiming = Boolean(annual?.accrual_enabled && annual.joining_date_pro_rata);
  const suggestedDefinitions = UAE_SUGGESTED_LEAVE_TEMPLATES.map((template) =>
    input.leaveDefinitions.find((definition) => isSameUaeSuggestedLeaveTemplate(definition, template)),
  ).filter((definition): definition is LeaveDefinition => Boolean(definition));
  const activeSuggestedCount = suggestedDefinitions.filter((definition) => definition.active).length;
  const incompleteActiveSuggestedCount = suggestedDefinitions.filter(
    (definition) => definition.active && definition.default_entitlement_days === null,
  ).length;
  const principalLeaveConfigured = Boolean(
    annual?.active && annual.default_entitlement_days !== null &&
    sick?.active && sick.default_entitlement_days !== null,
  );

  return [
    {
      label: "Leave settings",
      state: conflictingTiming
        ? "needs_review"
        : incompleteActiveSuggestedCount > 0
          ? "needs_review"
          : principalLeaveConfigured
            ? "configured"
            : "needs_setup",
      detail: conflictingTiming
        ? "Annual leave has more than one entitlement-timing method selected."
        : incompleteActiveSuggestedCount > 0
          ? `${incompleteActiveSuggestedCount} active suggested leave type${incompleteActiveSuggestedCount === 1 ? " needs" : "s need"} company entitlement days.`
          : principalLeaveConfigured
            ? `Annual and sick leave are configured. ${activeSuggestedCount}/${UAE_SUGGESTED_LEAVE_TEMPLATES.length} suggested additional leave types are active by company choice.`
            : "Configure active annual and sick leave with company entitlement days.",
    },
  ];
}

export async function applyUaeSetupPack(actor: Actor, input: unknown): Promise<void> {
  if (actor.role !== "admin" || !actor.tenantId) throw new Error("FORBIDDEN");
  const value = Input.parse(input);
  const db = createServiceRoleClient();
  const definitions = await listLeaveDefinitions(actor);
  const annual = definitions.find((definition) => definition.code === "annual");
  const sick = definitions.find((definition) => definition.code === "sick");
  if (!annual || !sick) throw new Error("UAE_SETUP_LEAVE_DEFINITIONS_MISSING");

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
  await applySuggestedLeaveConfiguration(actor, definitions, value.suggestedLeaves, db);
  const audit = await db.from("audit_logs")
    .insert({
      tenant_id: actor.tenantId,
      actor_user_id: actor.authUserId,
      action_type: "setup.uae_pack_applied",
    } as never);
  if (audit.error) throw new Error(`AUDIT_LOG_FAILED: ${audit.error.message}`);
}
