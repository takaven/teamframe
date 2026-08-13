import "server-only";
import type { Actor } from "@/middleware/rbac";
import { createServiceRoleClient } from "@/lib/db/supabaseServer";

type CompanyRow = {
  id: string;
  name: string;
  slug: string;
  status: "active" | "suspended" | "closed";
  setup_state: string;
  intake_completed_at: string | null;
  setup_due_at: string | null;
  activated_at: string | null;
  created_at: string;
};

export type PlatformOverview = {
  companies: Array<CompanyRow & {
    employee_count: number;
    membership_count: number;
    automation_failures: number;
    export_failures: number;
    setup_sla: "not_started" | "within_sla" | "approaching_sla" | "overdue" | "complete";
  }>;
  totals: {
    companies: number;
    active: number;
    suspended: number;
    closed: number;
    overdue_setups: number;
    automation_failures: number;
    export_failures: number;
  };
};

function requirePlatformOwner(actor: Actor): void {
  if (!actor.isPlatformOwner) throw new Error("FORBIDDEN");
}

function slaState(company: CompanyRow, now = new Date()): PlatformOverview["companies"][number]["setup_sla"] {
  if (company.setup_state === "active" || company.activated_at) return "complete";
  if (!company.intake_completed_at || !company.setup_due_at) return "not_started";
  const due = new Date(company.setup_due_at);
  if (due.getTime() < now.getTime()) return "overdue";
  if (due.getTime() - now.getTime() <= 6 * 60 * 60 * 1000) return "approaching_sla";
  return "within_sla";
}

export async function loadPlatformOverview(actor: Actor): Promise<PlatformOverview> {
  requirePlatformOwner(actor);
  const supabase = createServiceRoleClient();
  const [
    { data: companyData, error: companyError },
    { data: employeeData, error: employeeError },
    { data: membershipData, error: membershipError },
    { data: automationData, error: automationError },
    { data: exportData, error: exportError },
  ] = await Promise.all([
    supabase
      .from("companies")
      .select("id, name, slug, status, setup_state, intake_completed_at, setup_due_at, activated_at, created_at")
      .order("created_at", { ascending: false }),
    supabase.from("employees").select("tenant_id, id").is("deleted_at", null),
    supabase.from("tenant_memberships").select("tenant_id, id").eq("active", true).is("removed_at", null),
    supabase.from("hr_automation_items").select("tenant_id, id").eq("status", "failed"),
    supabase.from("file_operations").select("tenant_id, id").eq("status", "failed"),
  ]);
  if (companyError) throw new Error(`PLATFORM_COMPANIES_FAILED: ${companyError.message}`);
  if (employeeError) throw new Error(`PLATFORM_EMPLOYEES_FAILED: ${employeeError.message}`);
  if (membershipError) throw new Error(`PLATFORM_MEMBERSHIPS_FAILED: ${membershipError.message}`);
  if (automationError) throw new Error(`PLATFORM_AUTOMATION_FAILED: ${automationError.message}`);
  if (exportError) throw new Error(`PLATFORM_EXPORTS_FAILED: ${exportError.message}`);

  const countByTenant = (rows: Array<{ tenant_id: string | null }>) => {
    const map = new Map<string, number>();
    for (const row of rows) {
      if (!row.tenant_id) continue;
      map.set(row.tenant_id, (map.get(row.tenant_id) ?? 0) + 1);
    }
    return map;
  };
  const employees = countByTenant((employeeData ?? []) as Array<{ tenant_id: string }>);
  const memberships = countByTenant((membershipData ?? []) as Array<{ tenant_id: string }>);
  const automation = countByTenant((automationData ?? []) as Array<{ tenant_id: string }>);
  const exports = countByTenant((exportData ?? []) as Array<{ tenant_id: string }>);
  const companies = ((companyData ?? []) as CompanyRow[]).map((company) => ({
    ...company,
    employee_count: employees.get(company.id) ?? 0,
    membership_count: memberships.get(company.id) ?? 0,
    automation_failures: automation.get(company.id) ?? 0,
    export_failures: exports.get(company.id) ?? 0,
    setup_sla: slaState(company),
  }));

  return {
    companies,
    totals: {
      companies: companies.length,
      active: companies.filter((company) => company.status === "active").length,
      suspended: companies.filter((company) => company.status === "suspended").length,
      closed: companies.filter((company) => company.status === "closed").length,
      overdue_setups: companies.filter((company) => company.setup_sla === "overdue").length,
      automation_failures: companies.reduce((sum, company) => sum + company.automation_failures, 0),
      export_failures: companies.reduce((sum, company) => sum + company.export_failures, 0),
    },
  };
}

export async function updateCompanyStatus(
  actor: Actor,
  companyId: string,
  status: "active" | "suspended" | "closed",
): Promise<void> {
  requirePlatformOwner(actor);
  const supabase = createServiceRoleClient();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("companies")
    .update({
      status,
      setup_state: status,
      suspended_at: status === "suspended" ? now : null,
      closed_at: status === "closed" ? now : null,
      activated_at: status === "active" ? now : undefined,
    } as never)
    .eq("id", companyId);
  if (error) throw new Error(`PLATFORM_COMPANY_STATUS_FAILED: ${error.message}`);
}
