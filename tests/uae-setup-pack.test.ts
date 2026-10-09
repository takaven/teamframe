import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/services/configurationService", () => ({
  getCompanySettings: vi.fn(), listLeaveDefinitions: vi.fn(), updateCompanySettings: vi.fn(), updateLeaveDefinition: vi.fn(),
}));
vi.mock("@/services/onboardingService/checklistTemplates", () => ({ copyStarterChecklist: vi.fn(), listChecklistTemplates: vi.fn() }));
vi.mock("@/lib/db/supabaseServer", () => ({ createServiceRoleClient: vi.fn() }));

import { createServiceRoleClient } from "@/lib/db/supabaseServer";
import { getCompanySettings, listLeaveDefinitions, updateCompanySettings, updateLeaveDefinition } from "@/services/configurationService";
import { copyStarterChecklist, listChecklistTemplates } from "@/services/onboardingService/checklistTemplates";
import {
  applyUaeSetupPack,
  buildUaeHrBasicsSummary,
  UAE_CORE_LEAVE_TEMPLATES,
  UAE_FEDERAL_REFERENCES,
} from "@/services/uaeSetupPackService";

const actor={role:"admin",tenantId:"tenant-1",authUserId:"user-1"} as const;
const input={weekend:"friday_saturday",annualEntitlement:30,annualCountingBasis:"calendar_days",sickEntitlement:90,entitlementTiming:"monthly_accrual",carryForward:true,carryCap:5,confirmed:true} as const;
const definitions=[
  {id:"annual-1",code:"annual",display_name:"Annual Leave",system_leave_type:"annual",active:true,default_entitlement_days:25,counting_basis:"working_days",attachment_requirement:"not_required",accrual_enabled:false,accrual_frequency:"annual",joining_date_pro_rata:false,carry_forward_enabled:false,carry_forward_cap_days:null,is_system:true,sort_order:10},
  {id:"sick-1",code:"sick",display_name:"Sick Leave",system_leave_type:"sick",active:true,default_entitlement_days:15,counting_basis:"working_days",attachment_requirement:"optional",accrual_enabled:false,accrual_frequency:"annual",joining_date_pro_rata:false,carry_forward_enabled:false,carry_forward_cap_days:null,is_system:true,sort_order:20},
];
const insert=vi.fn();
const upsert=vi.fn();

beforeEach(()=>{
  vi.clearAllMocks();
  vi.mocked(getCompanySettings).mockResolvedValue({name:"Synthetic",country:"MU",default_working_days:[1,2,3,4,5]} as never);
  vi.mocked(listLeaveDefinitions).mockResolvedValue(definitions as never);
  vi.mocked(listChecklistTemplates).mockResolvedValue([] as never);
  vi.mocked(updateCompanySettings).mockResolvedValue(undefined as never);
  vi.mocked(updateLeaveDefinition).mockResolvedValue(undefined as never);
  vi.mocked(copyStarterChecklist).mockResolvedValue(undefined as never);
  insert.mockResolvedValue({error:null});
  upsert.mockResolvedValue({error:null});
  vi.mocked(createServiceRoleClient).mockReturnValue({
    from:vi.fn((table:string)=>table==="leave_definitions"?{upsert}:{insert}),
  } as never);
});

describe("M6 UAE setup pack",()=>{
  it("rejects non-admin and missing confirmation before any write",async()=>{
    await expect(applyUaeSetupPack({...actor,role:"employee"} as never,input)).rejects.toThrow("FORBIDDEN");
    await expect(applyUaeSetupPack(actor as never,{...input,confirmed:false})).rejects.toThrow();
    expect(updateCompanySettings).not.toHaveBeenCalled();
  });

  it("applies the confirmed weekend and leave values, copies once, and audits",async()=>{
    await applyUaeSetupPack(actor as never,input);
    expect(updateCompanySettings).toHaveBeenCalledWith(actor,expect.objectContaining({country:"AE",default_working_days:[7,1,2,3,4]}));
    expect(updateLeaveDefinition).toHaveBeenCalledWith(actor,"annual-1",expect.objectContaining({default_entitlement_days:30,counting_basis:"calendar_days",accrual_enabled:true,accrual_frequency:"monthly",joining_date_pro_rata:false,carry_forward_cap_days:5}));
    expect(updateLeaveDefinition).toHaveBeenCalledWith(actor,"sick-1",expect.objectContaining({default_entitlement_days:90,counting_basis:"working_days",attachment_requirement:"optional"}));
    expect(upsert).toHaveBeenCalledTimes(4);
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({code:"maternity_leave",display_name:"Maternity Leave",active:false,default_entitlement_days:60,counting_basis:"calendar_days"}),expect.objectContaining({onConflict:"tenant_id,code",ignoreDuplicates:true}));
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({code:"parental_leave",display_name:"Parental Leave",active:false,default_entitlement_days:5,counting_basis:"working_days"}),expect.anything());
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({code:"bereavement_leave",display_name:"Bereavement Leave",active:false,default_entitlement_days:null}),expect.anything());
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({code:"study_leave",display_name:"Study Leave",active:false,default_entitlement_days:10,counting_basis:"working_days"}),expect.anything());
    expect(copyStarterChecklist).toHaveBeenCalledWith(actor,"uae_sme");
    expect(createServiceRoleClient).toHaveBeenCalledOnce();
  });

  it("does not duplicate the UAE starter checklist",async()=>{
    vi.mocked(listChecklistTemplates).mockResolvedValue([{name:"UAE starter checklist"}] as never);
    await applyUaeSetupPack(actor as never,input);
    expect(copyStarterChecklist).not.toHaveBeenCalled();
  });

  it("does not duplicate or reset existing core leave templates",async()=>{
    vi.mocked(listLeaveDefinitions).mockResolvedValue([
      ...definitions,
      ...UAE_CORE_LEAVE_TEMPLATES.map((template,index)=>({
        id:`custom-${index}`,code:template.key,display_name:template.displayName,system_leave_type:"other",active:index!==3,
        default_entitlement_days:index===0?75:template.defaultEntitlementDays,counting_basis:template.countingBasis,
        attachment_requirement:template.attachmentRequirement,accrual_enabled:false,accrual_frequency:"annual",
        joining_date_pro_rata:false,carry_forward_enabled:false,carry_forward_cap_days:null,is_system:false,sort_order:100,
      })),
    ] as never);
    await applyUaeSetupPack(actor as never,input);
    expect(upsert).not.toHaveBeenCalled();
    expect(updateLeaveDefinition).not.toHaveBeenCalledWith(actor,"custom-0",expect.anything());
  });

  it("supports annual accrual without restoring dual entitlement timing",async()=>{
    await applyUaeSetupPack(actor as never,{...input,entitlementTiming:"annual_accrual"});
    expect(updateLeaveDefinition).toHaveBeenCalledWith(actor,"annual-1",expect.objectContaining({accrual_enabled:true,accrual_frequency:"annual",joining_date_pro_rata:false}));
  });
});

describe("UAE HR basics references and summary",()=>{
  it("keeps the official references factual and reviewed",()=>{
    expect(UAE_FEDERAL_REFERENCES.annualLeave.summary).toContain("30 days");
    expect(UAE_FEDERAL_REFERENCES.sickLeave.summary).toContain("90 days");
    expect(UAE_FEDERAL_REFERENCES.probation.summary).toContain("6 months");
    for(const reference of Object.values(UAE_FEDERAL_REFERENCES)){
      expect(reference.sourceUrl).toContain("uaelegislation.gov.ae");
      expect(reference.reviewedAt).toBe("2026-10-09");
    }
  });

  it("reports factual setup states without a compliance conclusion",()=>{
    const summary=buildUaeHrBasicsSummary({leaveDefinitions:definitions as never,currentYearHolidayCount:0,hasUaeStarterChecklist:false,hasPublishedPolicy:false});
    expect(summary.find((item)=>item.label==="Leave settings")?.state).toBe("needs_setup");
    expect(summary.find((item)=>item.label==="Current-year holidays")?.detail).toContain("have not been added");
    expect(JSON.stringify(summary).toLowerCase()).not.toContain("non-compliant");
    expect(JSON.stringify(summary).toLowerCase()).not.toContain("score");
  });

  it("keeps inactive statutory templates in review rather than calling them configured",()=>{
    const summary=buildUaeHrBasicsSummary({
      leaveDefinitions:[
        ...definitions,
        ...UAE_CORE_LEAVE_TEMPLATES.map((template,index)=>({
          id:`template-${index}`,code:template.key,display_name:template.displayName,system_leave_type:"other",active:false,
          default_entitlement_days:template.defaultEntitlementDays,counting_basis:template.countingBasis,
          attachment_requirement:template.attachmentRequirement,accrual_enabled:false,accrual_frequency:"annual",
          joining_date_pro_rata:false,carry_forward_enabled:false,carry_forward_cap_days:null,is_system:false,sort_order:100,
        })),
      ] as never,
      currentYearHolidayCount:1,
      hasUaeStarterChecklist:true,
      hasPublishedPolicy:true,
    });
    expect(summary.find((item)=>item.label==="Leave settings")?.state).toBe("needs_review");
    expect(summary.find((item)=>item.label==="Leave settings")?.detail).toContain("await company review and activation");
  });
});
