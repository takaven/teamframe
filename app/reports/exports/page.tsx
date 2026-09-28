import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { ReportsExports } from "@/components/ReportsExports";
import { requireTenantActor } from "@/middleware/rbac";
import { hasCapability } from "@/lib/rbac/access";

export const dynamic = "force-dynamic";

export default async function FinanceExportsPage() {
  const actor = await requireTenantActor();
  const canFinance = await hasCapability(actor, "finance_payroll_exports");
  if (!canFinance) redirect(actor.role === "admin" ? "/dashboard" : "/home");
  const canFull = actor.role === "admin" && await hasCapability(actor, "company_access_settings");
  return <main className="mx-auto max-w-5xl px-6 py-14">
    <AppShell actor={actor} activePath="/reports/exports" />
    <header className="border-b border-ink-300/60 pb-5">
      <p className="text-[12px] tracking-[0.14em] text-ink-500">Authorised finance handoff</p>
      <h1 className="mt-2 text-[34px] tracking-tight">Exports</h1>
      <p className="mt-1 text-[14px] text-ink-500">Download only the organisation data your access permits.</p>
    </header>
    <section className="mt-7"><ReportsExports canFinance={canFinance} canFull={canFull} returnTo="/reports/exports" /></section>
  </main>;
}
