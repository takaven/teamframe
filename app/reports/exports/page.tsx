import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { ReportsExports } from "@/components/ReportsExports";
import { requireTenantActor } from "@/middleware/rbac";
import { hasCapability } from "@/lib/rbac/access";
import { listPayrollChanges } from "@/services/payrollHandoffService";

export const dynamic = "force-dynamic";

export default async function FinanceExportsPage({searchParams}:{searchParams:Promise<{period?:string}>}) {
  const actor = await requireTenantActor();
  const canFinance = await hasCapability(actor, "finance_payroll_exports");
  if (!canFinance) redirect(actor.role === "admin" ? "/dashboard" : "/home");
  const canFull = actor.role === "admin" && await hasCapability(actor, "company_access_settings");
  const requestedPeriod=(await searchParams).period??new Date().toISOString().slice(0,7);
  const period=/^\d{4}-(0[1-9]|1[0-2])$/.test(requestedPeriod)?requestedPeriod:new Date().toISOString().slice(0,7);
  const payrollChanges=await listPayrollChanges(actor,period);
  return <main className="mx-auto max-w-5xl px-6 py-14">
    <AppShell actor={actor} activePath="/reports/exports" />
    <header className="border-b border-ink-300/60 pb-5">
      <p className="text-[12px] tracking-[0.14em] text-ink-500">Authorised finance handoff</p>
      <h1 className="mt-2 text-[34px] tracking-tight">Exports</h1>
      <p className="mt-1 text-[14px] text-ink-500">Download only the organisation data your access permits.</p>
    </header>
    <section className="mt-7"><h2 className="tf-h2">Payroll changes</h2><p className="mt-1 text-[13px] text-ink-500">Auditable joiner, leaver, compensation, payment-detail and unpaid-leave inputs for the selected handoff period. TeamFrame does not calculate payroll.</p><form className="mt-4 flex items-end gap-3"><label className="text-[12px] text-ink-500">Period<input name="period" type="month" required defaultValue={period} className="tf-input mt-1"/></label><button className="tf-secondary-action px-4 py-2 text-[13px]">View changes</button></form><div className="mt-5 overflow-x-auto border-y border-ink-200"><table className="min-w-full text-left text-[13px]"><thead><tr className="border-b border-ink-200"><th className="px-3 py-2">Employee</th><th className="px-3 py-2">Joiner</th><th className="px-3 py-2">Leaver</th><th className="px-3 py-2">Recorded changes</th><th className="px-3 py-2">Unpaid leave input</th></tr></thead><tbody className="divide-y divide-ink-100">{payrollChanges.length?payrollChanges.map((row)=><tr key={row.employeeId}><td className="px-3 py-3"><strong>{row.fullName}</strong><span className="ml-2 text-ink-500">{row.employeeNumber??"No number"}</span></td><td className="px-3 py-3">{row.joiner?"Yes":"—"}</td><td className="px-3 py-3">{row.leaver?"Yes":"—"}</td><td className="px-3 py-3">{row.changes.join(", ")||"—"}</td><td className="px-3 py-3">{row.unpaidLeaveDays||"—"}</td></tr>):<tr><td colSpan={5} className="px-3 py-8 text-center text-ink-500">No recorded payroll changes for this period.</td></tr>}</tbody></table></div></section>
    <section className="mt-9"><ReportsExports canFinance={canFinance} canFull={canFull} returnTo="/reports/exports" /></section>
  </main>;
}
