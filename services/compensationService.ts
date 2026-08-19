import "server-only";
import { z } from "zod";
import type { Actor } from "@/middleware/rbac";
import { createServiceRoleClient } from "@/lib/db/supabaseServer";
import { canViewCompensation, canManageCompensation } from "@/lib/rbac/access";

// Employee-level compensation for the record's Compensation tab. Storage only — NO payroll, tax,
// payslips, WPS or benchmarking. Read is gated on compensation_view, edit on compensation_manage
// (per-employee scope), matching the RLS on the compensation tables. Service-role client is used so
// the code enforces the capability gate explicitly.

export type CompensationComponentAmount = { id: string; name: string; amount: number | null };
export type CompensationHistoryEntry = {
  id: string;
  effective_date: string;
  currency: string;
  pay_basis: string;
  mode: string;
  total_amount: number;
  note: string | null;
  created_at: string;
};
export type EmployeeCompensationDetail = {
  canView: boolean;
  canManage: boolean;
  mode: "total" | "components";
  currency: string | null;
  pay_basis: string | null;
  base_salary: number | null;
  effective_date: string | null;
  grade_band: string | null;
  components: CompensationComponentAmount[];
  derivedTotal: number | null;
  history: CompensationHistoryEntry[];
};

function requireTenant(actor: Actor): string {
  if (!actor.tenantId) throw new Error("NO_TENANT_CONTEXT");
  return actor.tenantId;
}

export async function getEmployeeCompensationDetail(actor: Actor, employeeId: string): Promise<EmployeeCompensationDetail> {
  const tenantId = requireTenant(actor);
  const canView = await canViewCompensation(actor, employeeId);
  const empty: EmployeeCompensationDetail = {
    canView: false, canManage: false, mode: "total", currency: null, pay_basis: null,
    base_salary: null, effective_date: null, grade_band: null, components: [], derivedTotal: null, history: [],
  };
  if (!canView) return empty;
  const canManage = await canManageCompensation(actor, employeeId);
  const supabase = createServiceRoleClient();

  const [companyRes, compRes, componentsRes, amountsRes, historyRes] = await Promise.all([
    supabase.from("companies").select("compensation_mode").eq("id", tenantId).maybeSingle(),
    supabase.from("compensation").select("base_salary, currency, pay_basis, grade_band, effective_date").eq("tenant_id", tenantId).eq("employee_id", employeeId).maybeSingle(),
    supabase.from("compensation_components").select("id, name, sort_order").eq("tenant_id", tenantId).eq("active", true).order("sort_order").order("name"),
    supabase.from("compensation_component_amounts").select("component_id, amount").eq("tenant_id", tenantId).eq("employee_id", employeeId),
    supabase.from("compensation_history").select("id, effective_date, currency, pay_basis, mode, total_amount, note, created_at").eq("tenant_id", tenantId).eq("employee_id", employeeId).order("effective_date", { ascending: false }).order("created_at", { ascending: false }).limit(20),
  ]);

  const mode = (((companyRes.data as unknown as { compensation_mode: string } | null)?.compensation_mode) === "components" ? "components" : "total") as "total" | "components";
  const comp = compRes.data as unknown as { base_salary: number | null; currency: string | null; pay_basis: string | null; grade_band: string | null; effective_date: string | null } | null;
  const componentDefs = (componentsRes.data ?? []) as unknown as { id: string; name: string }[];
  const amountRows = (amountsRes.data ?? []) as unknown as { component_id: string; amount: number | null }[];
  const amountByComponent = new Map(amountRows.map((r) => [r.component_id, r.amount]));
  const components: CompensationComponentAmount[] = componentDefs.map((d) => ({ id: d.id, name: d.name, amount: amountByComponent.get(d.id) ?? null }));
  const history = (historyRes.data ?? []) as unknown as CompensationHistoryEntry[];

  const derivedTotal = mode === "components"
    ? components.reduce((sum, c) => sum + (c.amount ?? 0), 0)
    : comp?.base_salary ?? null;

  return {
    canView: true,
    canManage,
    mode,
    currency: comp?.currency ?? null,
    pay_basis: comp?.pay_basis ?? null,
    base_salary: comp?.base_salary ?? null,
    effective_date: comp?.effective_date ?? null,
    grade_band: comp?.grade_band ?? null,
    components,
    derivedTotal,
    history,
  };
}

const SaveSchema = z.object({
  currency: z.string().trim().length(3),
  pay_basis: z.enum(["annual", "monthly", "hourly"]),
  effective_date: z.string().trim().min(1),
  note: z.string().trim().max(500).optional(),
  total_amount: z.number().nonnegative().optional(),
  component_amounts: z.record(z.string().uuid(), z.number().nonnegative()).optional(),
});

export async function saveEmployeeCompensation(actor: Actor, employeeId: string, rawInput: unknown): Promise<void> {
  const tenantId = requireTenant(actor);
  if (!(await canManageCompensation(actor, employeeId))) throw new Error("FORBIDDEN");
  const input = SaveSchema.parse(rawInput);
  const supabase = createServiceRoleClient();

  const { data: companyRow } = await supabase.from("companies").select("compensation_mode").eq("id", tenantId).maybeSingle();
  const mode = (((companyRow as unknown as { compensation_mode: string } | null)?.compensation_mode) === "components" ? "components" : "total") as "total" | "components";

  const currency = input.currency.toUpperCase();
  let total: number;
  if (mode === "components") {
    const amounts = input.component_amounts ?? {};
    total = Object.values(amounts).reduce((sum, v) => sum + (Number.isFinite(v) ? v : 0), 0);
  } else {
    total = input.total_amount ?? 0;
  }

  // Current-state compensation row (base_salary carries the total; existing grade_band preserved).
  const { error: compErr } = await supabase.from("compensation").upsert({
    tenant_id: tenantId,
    employee_id: employeeId,
    base_salary: total,
    currency,
    pay_basis: input.pay_basis,
    effective_date: input.effective_date,
  } as never, { onConflict: "employee_id" });
  if (compErr) throw new Error(`COMPENSATION_SAVE_FAILED: ${compErr.message}`);

  if (mode === "components" && input.component_amounts) {
    const rows = Object.entries(input.component_amounts).map(([component_id, amount]) => ({
      tenant_id: tenantId, employee_id: employeeId, component_id, amount,
    }));
    if (rows.length > 0) {
      const { error: amtErr } = await supabase.from("compensation_component_amounts").upsert(rows as never, { onConflict: "employee_id,component_id" });
      if (amtErr) throw new Error(`COMPENSATION_COMPONENT_SAVE_FAILED: ${amtErr.message}`);
    }
  }

  const { error: histErr } = await supabase.from("compensation_history").insert({
    tenant_id: tenantId,
    employee_id: employeeId,
    effective_date: input.effective_date,
    currency,
    pay_basis: input.pay_basis,
    mode,
    total_amount: total,
    note: input.note && input.note.length > 0 ? input.note : null,
    created_by: actor.employeeId ?? null,
  } as never);
  if (histErr) throw new Error(`COMPENSATION_HISTORY_FAILED: ${histErr.message}`);
}
