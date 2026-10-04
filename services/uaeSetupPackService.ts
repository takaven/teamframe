import "server-only";
import { z } from "zod";
import type { Actor } from "@/middleware/rbac";
import { getCompanySettings, listLeaveDefinitions, updateCompanySettings, updateLeaveDefinition } from "@/services/configurationService";
import { copyStarterChecklist, listChecklistTemplates } from "@/services/onboardingService/checklistTemplates";
import { createServiceRoleClient } from "@/lib/db/supabaseServer";

export const UAE_SETUP_PACK = {
  documentCategories:["Emirates ID","Passport","Residence visa","Labour card / work permit","Medical fitness","Medical insurance","ILOE"],
  holidayGuidance:"Import or enter each year's UAE holiday dates only after an administrator confirms the official dates. Religious dates remain editable and unconfirmed by default.",
  probationGuidance:"Use the existing probation workflow and confirm the review period against the employment terms.",
  offboardingGuidance:"Use the existing standard offboarding checklist, then tailor assigned tasks to the employee.",
  policyCategories:["Employment","Leave and attendance","Conduct","Data and confidentiality","Health and safety"],
} as const;

const Input=z.object({weekend:z.enum(["friday_saturday","saturday_sunday"]),annualEntitlement:z.number().min(0).max(365),sickEntitlement:z.number().min(0).max(365),annualAccrual:z.boolean(),annualProRata:z.boolean(),carryForward:z.boolean(),carryCap:z.number().min(0).max(365).nullable(),confirmed:z.literal(true)});

export async function applyUaeSetupPack(actor:Actor,input:unknown):Promise<void>{
  if(actor.role!=="admin"||!actor.tenantId)throw new Error("FORBIDDEN");const value=Input.parse(input);
  const [company,definitions,checklists]=await Promise.all([getCompanySettings(actor),listLeaveDefinitions(actor),listChecklistTemplates(actor)]);
  const annual=definitions.find((definition)=>definition.code==="annual");const sick=definitions.find((definition)=>definition.code==="sick");
  if(!annual||!sick)throw new Error("UAE_SETUP_LEAVE_DEFINITIONS_MISSING");
  await updateCompanySettings(actor,{...company,country:"AE",default_working_days:value.weekend==="friday_saturday"?[7,1,2,3,4]:[1,2,3,4,5]});
  await updateLeaveDefinition(actor,annual.id,{display_name:annual.display_name,system_leave_type:annual.system_leave_type,active:true,default_entitlement_days:value.annualEntitlement,counting_basis:"working_days",attachment_requirement:annual.attachment_requirement,accrual_enabled:value.annualAccrual,accrual_frequency:"monthly",joining_date_pro_rata:value.annualProRata,carry_forward_enabled:value.carryForward,carry_forward_cap_days:value.carryForward?value.carryCap:null});
  await updateLeaveDefinition(actor,sick.id,{display_name:sick.display_name,system_leave_type:sick.system_leave_type,active:true,default_entitlement_days:value.sickEntitlement,counting_basis:"calendar_days",attachment_requirement:sick.attachment_requirement,accrual_enabled:false,accrual_frequency:"annual",joining_date_pro_rata:false,carry_forward_enabled:false,carry_forward_cap_days:null});
  if(!checklists.some((template)=>template.name==="UAE starter checklist"))await copyStarterChecklist(actor,"uae_sme");
  const audit=await createServiceRoleClient().from("audit_logs").insert({tenant_id:actor.tenantId,actor_user_id:actor.authUserId,action_type:"setup.uae_pack_applied"} as never);
  if(audit.error)throw new Error(`AUDIT_LOG_FAILED: ${audit.error.message}`);
}
