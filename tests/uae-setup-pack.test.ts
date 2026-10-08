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
import { applyUaeSetupPack } from "@/services/uaeSetupPackService";

const actor={role:"admin",tenantId:"tenant-1",authUserId:"user-1"} as const;
const input={weekend:"friday_saturday",annualEntitlement:30,sickEntitlement:15,entitlementTiming:"monthly_accrual",carryForward:true,carryCap:5,confirmed:true} as const;
const definitions=[
  {id:"annual-1",code:"annual",display_name:"Annual Leave",system_leave_type:"annual",attachment_requirement:"not_required"},
  {id:"sick-1",code:"sick",display_name:"Sick Leave",system_leave_type:"sick",attachment_requirement:"not_required"},
];

beforeEach(()=>{
  vi.clearAllMocks();
  vi.mocked(getCompanySettings).mockResolvedValue({name:"Synthetic",country:"MU",default_working_days:[1,2,3,4,5]} as never);
  vi.mocked(listLeaveDefinitions).mockResolvedValue(definitions as never);
  vi.mocked(listChecklistTemplates).mockResolvedValue([] as never);
  vi.mocked(updateCompanySettings).mockResolvedValue(undefined as never);
  vi.mocked(updateLeaveDefinition).mockResolvedValue(undefined as never);
  vi.mocked(copyStarterChecklist).mockResolvedValue(undefined as never);
  const insert=vi.fn().mockResolvedValue({error:null});
  vi.mocked(createServiceRoleClient).mockReturnValue({from:vi.fn().mockReturnValue({insert})} as never);
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
    expect(updateLeaveDefinition).toHaveBeenCalledWith(actor,"annual-1",expect.objectContaining({default_entitlement_days:30,accrual_enabled:true,joining_date_pro_rata:false,carry_forward_cap_days:5}));
    expect(updateLeaveDefinition).toHaveBeenCalledWith(actor,"sick-1",expect.objectContaining({default_entitlement_days:15,accrual_enabled:false}));
    expect(copyStarterChecklist).toHaveBeenCalledWith(actor,"uae_sme");
    expect(createServiceRoleClient).toHaveBeenCalledOnce();
  });

  it("does not duplicate the UAE starter checklist",async()=>{
    vi.mocked(listChecklistTemplates).mockResolvedValue([{name:"UAE starter checklist"}] as never);
    await applyUaeSetupPack(actor as never,input);
    expect(copyStarterChecklist).not.toHaveBeenCalled();
  });
});
