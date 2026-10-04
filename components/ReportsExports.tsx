import { PendingSubmitButton } from "@/components/PendingSubmitButton";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { exportFinanceHandoffAction } from "@/app/employees/actions";
import { exportTenantDataAction } from "@/app/setup/actions";

export function ReportsExports({ canFinance, canFull, returnTo }: { canFinance: boolean; canFull: boolean; returnTo: string }) {
  return <>
    <h2 className="tf-h2">Exports</h2>
    <p className="mt-1 text-[13px] text-ink-500">Authorised, private organisation exports.</p>
    <div className="mt-6 grid gap-4 md:grid-cols-2">
      <section className="rounded-xl border border-ink-200 p-5">
        <h3 className="font-bold">Payroll export</h3>
        <p className="mt-1 text-[13px] text-ink-500">Period-aware finance handoff. It prepares payroll inputs and change flags; it does not calculate payroll, deductions or statutory amounts.</p>
        {canFinance ? <form action={exportFinanceHandoffAction} className="mt-4 flex flex-wrap items-end gap-3">
          <input type="hidden" name="return_to" value={returnTo}/>
          <label className="text-[12px] text-ink-500">Payroll period<input name="period" type="month" required defaultValue={new Date().toISOString().slice(0, 7)} className="tf-input mt-1"/></label>
          <PendingSubmitButton idleLabel="Export payroll data" pendingLabel="Preparing…" className="tf-primary-action px-4 py-2 text-[13px]"/>
        </form> : <p className="mt-4 text-[13px] text-ink-500">Finance export access is required.</p>}
      </section>
      {canFull ? <section className="rounded-xl border border-ink-200 p-5">
        <h3 className="font-bold">Full data export</h3>
        <p className="mt-1 text-[13px] text-ink-500">Portable tenant records and uploaded documents.</p>
        <form action={exportTenantDataAction} className="mt-4">
          <ConfirmSubmitButton idleLabel="Export all TeamFrame data" pendingLabel="Preparing…" className="tf-primary-action px-4 py-2 text-[13px]" confirmMessage="Prepare a private full installation export?"/>
        </form>
      </section> : null}
    </div>
  </>;
}
