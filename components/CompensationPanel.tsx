import type { EmployeeCompensationDetail } from "@/services/compensationService";
import { DateField } from "@/components/DateField";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";
import { saveCompensationAction } from "@/app/employees/actions";

function fmtMoney(amount: number | null, currency: string | null): string {
  if (amount === null) return "—";
  const c = currency ?? "";
  return `${amount.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${c}`.trim();
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

const input = "mt-1 w-full rounded-lg border border-ink-300 bg-white px-3 py-2 text-[14px]";

export function CompensationPanel({
  detail,
  employeeId,
}: {
  detail: EmployeeCompensationDetail;
  employeeId: string;
}) {
  if (!detail.canView) {
    return (
      <section className="rounded-xl border border-dashed border-ink-200 bg-ink-50/40 p-4 text-[12px] text-ink-500">
        Compensation is hidden — you do not have compensation access for this employee.
      </section>
    );
  }
  const today = new Date().toISOString().slice(0, 10);
  const total = detail.derivedTotal;

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-ink-200 bg-white/70 p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-[14px] font-bold tracking-tight text-ink-800">Compensation</h3>
          <span className="text-[11px] text-ink-500">Restricted · {detail.mode === "components" ? "Component breakdown" : "Total only"}</span>
        </div>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-[12px] text-ink-500">{detail.mode === "components" ? "Total (derived)" : "Total"}</dt>
            <dd className="mt-0.5 text-[16px] font-bold text-ink-900">{fmtMoney(total, detail.currency)}</dd>
          </div>
          <div><dt className="text-[12px] text-ink-500">Pay basis</dt><dd className="mt-0.5 text-[14px] text-ink-900">{detail.pay_basis ?? <span className="text-ink-400">—</span>}</dd></div>
          <div><dt className="text-[12px] text-ink-500">Effective date</dt><dd className="mt-0.5 text-[14px] text-ink-900">{fmtDate(detail.effective_date)}</dd></div>
        </dl>

        {detail.mode === "components" && detail.components.length > 0 ? (
          <div className="mt-4 rounded-lg border border-ink-100">
            <ul className="divide-y divide-ink-100">
              {detail.components.map((c) => (
                <li key={c.id} className="flex items-center justify-between px-3 py-2 text-[13px]">
                  <span className="text-ink-700">{c.name}</span>
                  <span className="tabular-nums text-ink-900">{fmtMoney(c.amount, detail.currency)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      {detail.canManage ? (
        <details className="group rounded-xl border border-ink-200 bg-white/70 p-5">
          <summary className="flex cursor-pointer list-none items-center justify-between text-[13px] font-bold text-ink-800 marker:hidden">
            <span>Update compensation</span>
            <span className="text-[12px] font-normal text-ink-500 group-open:hidden">Edit</span>
          </summary>
          <form action={saveCompensationAction} className="mt-4 grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="employee_id" value={employeeId} />
            {detail.mode === "components" ? (
              <div className="sm:col-span-2 grid gap-3 sm:grid-cols-2">
                {detail.components.length === 0 ? (
                  <p className="text-[12px] text-ink-500 sm:col-span-2">No active components configured. Add them under Setup → Compensation.</p>
                ) : (
                  detail.components.map((c) => (
                    <label key={c.id} className="text-[13px] text-ink-700">
                      {c.name}
                      <input name={`component_${c.id}`} type="number" min="0" step="0.01" defaultValue={c.amount ?? ""} className={input} />
                    </label>
                  ))
                )}
              </div>
            ) : (
              <label className="text-[13px] text-ink-700 sm:col-span-2">
                Total amount
                <input name="total_amount" type="number" min="0" step="0.01" defaultValue={detail.base_salary ?? ""} required className={input} />
              </label>
            )}
            <label className="text-[13px] text-ink-700">
              Currency
              <input name="currency" maxLength={3} defaultValue={detail.currency ?? ""} placeholder="AED" required className={`${input} uppercase`} />
            </label>
            <label className="text-[13px] text-ink-700">
              Pay basis
              <select name="pay_basis" defaultValue={detail.pay_basis ?? "annual"} className={input}>
                <option value="annual">Annual</option>
                <option value="monthly">Monthly</option>
                <option value="hourly">Hourly</option>
              </select>
            </label>
            <label className="text-[13px] text-ink-700">
              Effective date
              <DateField name="effective_date" defaultValue={detail.effective_date ?? today} required />
            </label>
            <label className="text-[13px] text-ink-700">
              Note (optional)
              <input name="note" maxLength={500} placeholder="e.g. Annual review" className={input} />
            </label>
            <div className="sm:col-span-2">
              <PendingSubmitButton idleLabel="Save compensation" pendingLabel="Saving…" className="tf-primary-action px-4 py-2 text-[13px]" />
            </div>
          </form>
        </details>
      ) : null}

      {detail.history.length > 0 ? (
        <section className="rounded-xl border border-ink-200 bg-white/70 p-5">
          <h3 className="text-[14px] font-bold tracking-tight text-ink-800">History</h3>
          <ul className="mt-3 divide-y divide-ink-100">
            {detail.history.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-[13px]">
                <span className="text-ink-500">{fmtDate(h.effective_date)}</span>
                <span className="tabular-nums font-medium text-ink-900">{fmtMoney(h.total_amount, h.currency)} · {h.pay_basis}</span>
                <span className="w-full text-[12px] text-ink-500 sm:w-auto">{h.note ?? ""}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
