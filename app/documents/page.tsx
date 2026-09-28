import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { DateField } from "@/components/DateField";
import { EmptyState } from "@/components/EmptyState";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";
import { StatusPill } from "@/components/StatusPill";
import { humaneDate } from "@/lib/ui/formatDate";
import { documentLabel } from "@/lib/ui/documentLabels";
import { requireTenantActor } from "@/middleware/rbac";
import { listEmployeesForAdmin } from "@/services/employeeService";
import { listWorkspaceDocuments } from "@/services/documentService";
import { createDocumentRequirementAction, reviewDocumentRequirementAction } from "@/app/employees/actions";
import { remindDocumentAction } from "@/app/notifications/actions";

export const dynamic = "force-dynamic";

function dateOrDash(value: string | null): string {
  return value ? humaneDate(value) : "—";
}

export default async function DocumentsPage({ searchParams }: { searchParams: Promise<{ view?: string; status?: string; error?: string }> }) {
  const actor = await requireTenantActor();
  if (actor.role !== "admin") return null;
  const params = await searchParams;
  const view = params.view === "expiring" || params.view === "all" ? params.view : "outstanding";
  const [{ requirements, documents }, employees] = await Promise.all([listWorkspaceDocuments(actor), listEmployeesForAdmin(actor)]);
  const today = new Date();
  const ninetyDays = new Date(today.getTime() + 90 * 86_400_000);
  const openStates = new Set(["requested", "received", "rejected", "expired"]);
  const outstanding = requirements.filter((item) => openStates.has(item.state));
  const expiring = documents.filter((item) => {
    if (!item.expires_at) return false;
    const date = new Date(`${item.expires_at}T00:00:00Z`);
    return Number.isFinite(date.getTime()) && date <= ninetyDays;
  }).sort((a, b) => String(a.expires_at).localeCompare(String(b.expires_at)));

  return (
    <main className="mx-auto max-w-6xl px-6 py-14">
      <AppShell actor={actor} activePath="/documents" />
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-ink-300/60 pb-5">
        <div className="space-y-2">
          <p className="text-[12px] tracking-[0.14em] text-ink-500">People records</p>
          <h1 className="text-[34px] leading-tight tracking-tight">Documents</h1>
          <p className="text-[14px] text-ink-500">Request, review and monitor employee documents in one place.</p>
        </div>
        <a href="#request-document" className="tf-primary-action px-4 py-2 text-[13px]">Request document</a>
      </header>

      <div className="tf-summary mt-6 max-w-2xl">
        <div><div className="tf-summary-label">Outstanding</div><div className="tf-summary-value">{outstanding.length}</div></div>
        <div><div className="tf-summary-label">Expiring in 90 days</div><div className="tf-summary-value">{expiring.length}</div></div>
        <div><div className="tf-summary-label">On file</div><div className="tf-summary-value">{documents.length}</div></div>
      </div>

      <nav className="mt-8 flex gap-1 border-b border-ink-300/60" aria-label="Document views">
        {[["outstanding", "Outstanding"], ["expiring", "Expiring"], ["all", "All documents"]].map(([id, label]) => (
          <Link key={id} href={id === "outstanding" ? "/documents" : `/documents?view=${id}`} aria-current={view === id ? "page" : undefined} className={`-mb-px border-b-2 px-4 py-2 text-[14px] ${view === id ? "border-ink-900 font-medium text-ink-900" : "border-transparent text-ink-500 hover:text-ink-900"}`}>{label}</Link>
        ))}
      </nav>

      {view === "outstanding" ? (
        <section className="mt-7 tf-surface-flat overflow-hidden">
          {outstanding.length === 0 ? <EmptyState message="No documents need attention." hint="New requests and documents awaiting review will appear here." /> : (
            <div className="overflow-x-auto"><table className="min-w-full text-left text-[13px]">
              <thead className="border-b border-ink-200 text-[11px] uppercase tracking-[0.1em] text-ink-500"><tr><th className="px-4 py-3">Person</th><th className="px-4 py-3">Document</th><th className="px-4 py-3">State</th><th className="px-4 py-3">Due</th><th className="px-4 py-3 text-right">Action</th></tr></thead>
              <tbody className="divide-y divide-ink-100">{outstanding.map((item) => <tr key={item.id}>
                <td className="px-4 py-3"><Link className="font-semibold hover:underline" href={`/people/${item.employee_id}#documents`}>{item.employee_name}</Link><div className="text-[11px] text-ink-500">{item.employee_role_title}</div></td>
                <td className="px-4 py-3 font-medium">{documentLabel(item.document_type)}</td>
                <td className="px-4 py-3"><StatusPill tone={item.state === "expired" || item.state === "rejected" ? "red" : "amber"}>{item.state === "received" ? "Needs review" : item.state === "rejected" ? "Re-upload needed" : item.state}</StatusPill></td>
                <td className="px-4 py-3 tabular-nums">{dateOrDash(item.due_date)}</td>
                <td className="px-4 py-3"><div className="flex justify-end gap-2">{item.state === "received" ? <>
                  <form action={reviewDocumentRequirementAction}><input type="hidden" name="requirement_id" value={item.id}/><input type="hidden" name="decision" value="accepted"/><input type="hidden" name="return_to" value="/documents"/><PendingSubmitButton idleLabel="Accept" pendingLabel="Accepting…" className="tf-primary-action h-9 px-3 text-[12px]"/></form>
                  <form action={reviewDocumentRequirementAction}><input type="hidden" name="requirement_id" value={item.id}/><input type="hidden" name="decision" value="rejected"/><input type="hidden" name="return_to" value="/documents"/><PendingSubmitButton idleLabel="Reject" pendingLabel="Rejecting…" className="tf-secondary-action h-9 px-3 text-[12px]"/></form>
                </> : <><Link href={`/people/${item.employee_id}#documents`} className="tf-quiet-action">Open record</Link><form action={remindDocumentAction}><input type="hidden" name="requirement_id" value={item.id}/><PendingSubmitButton idleLabel="Remind" pendingLabel="Sending…" className="tf-tertiary-action h-8 px-2 text-[12px]"/></form></>}</div></td>
              </tr>)}</tbody>
            </table></div>
          )}
        </section>
      ) : view === "expiring" ? (
        <section className="mt-7 tf-surface-flat overflow-hidden"><div className="overflow-x-auto"><table className="min-w-full text-left text-[13px]">
          <thead className="border-b border-ink-200 text-[11px] uppercase tracking-[0.1em] text-ink-500"><tr><th className="px-4 py-3">Person</th><th className="px-4 py-3">Document</th><th className="px-4 py-3">Expires</th><th className="px-4 py-3">Window</th></tr></thead>
          <tbody className="divide-y divide-ink-100">{expiring.map((item) => { const days = Math.ceil((new Date(`${item.expires_at}T00:00:00Z`).getTime() - today.getTime()) / 86_400_000); return <tr key={item.id}><td className="px-4 py-3"><Link className="font-semibold hover:underline" href={`/people/${item.employee_id}#documents`}>{item.employee_name}</Link></td><td className="px-4 py-3">{documentLabel(item.document_type)}</td><td className="px-4 py-3 tabular-nums">{dateOrDash(item.expires_at)}</td><td className="px-4 py-3"><StatusPill tone={days < 0 ? "red" : days <= 30 ? "amber" : "neutral"}>{days < 0 ? "Expired" : `${days} days`}</StatusPill></td></tr>; })}</tbody>
        </table></div></section>
      ) : (
        <section className="mt-7 tf-surface-flat overflow-hidden"><div className="overflow-x-auto"><table className="min-w-full text-left text-[13px]">
          <thead className="border-b border-ink-200 text-[11px] uppercase tracking-[0.1em] text-ink-500"><tr><th className="px-4 py-3">Person</th><th className="px-4 py-3">Document</th><th className="px-4 py-3">Issued / signed</th><th className="px-4 py-3">Expiry</th><th className="px-4 py-3">Status</th></tr></thead>
          <tbody className="divide-y divide-ink-100">{documents.map((item) => <tr key={item.id}><td className="px-4 py-3"><Link className="font-semibold hover:underline" href={`/people/${item.employee_id}#documents`}>{item.employee_name}</Link></td><td className="px-4 py-3">{documentLabel(item.document_type)}</td><td className="px-4 py-3 tabular-nums">{dateOrDash(item.issued_at ?? item.signed_at)}</td><td className="px-4 py-3 tabular-nums">{dateOrDash(item.expires_at)}</td><td className="px-4 py-3"><StatusPill tone={item.expires_at && item.expires_at < today.toISOString().slice(0, 10) ? "red" : "neutral"}>{item.expires_at && item.expires_at < today.toISOString().slice(0, 10) ? "Expired" : "On file"}</StatusPill></td></tr>)}</tbody>
        </table></div></section>
      )}

      <section id="request-document" className="mt-8 tf-surface-flat p-5 scroll-mt-8">
        <h2 className="text-[18px] font-semibold">Request document</h2>
        <p className="mt-1 text-[13px] text-ink-500">The request appears here and in the person’s record.</p>
        <form action={createDocumentRequirementAction} className="mt-5 grid gap-3 md:grid-cols-3">
          <input type="hidden" name="return_to" value="/documents" />
          <label className="text-[12px] text-ink-500">Person<select name="employee_id" required className="tf-select-sm mt-1 w-full"><option value="">Select person</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.full_name}</option>)}</select></label>
          <label className="text-[12px] text-ink-500">Document type<select name="document_type" defaultValue="passport" className="tf-select-sm mt-1 w-full"><option value="passport">Passport</option><option value="employment_contract">Employment contract</option><option value="right_to_work">Right to work</option><option value="medical_fitness">Medical fitness certificate</option><option value="emirates_id">Emirates ID</option><option value="jd">Job description</option></select></label>
          <label className="text-[12px] text-ink-500">Due date<DateField name="due_date" dense /></label>
          <label className="flex items-center gap-2 text-[12px] text-ink-600"><input type="checkbox" name="expiry_required"/>Monitor expiry</label>
          <label className="flex items-center gap-2 text-[12px] text-ink-600"><input type="checkbox" name="review_required" defaultChecked/>Review required</label>
          <label className="flex items-center gap-2 text-[12px] text-ink-600"><input type="checkbox" name="employee_upload_allowed" defaultChecked/>Employee can upload</label>
          <div className="md:col-span-3"><PendingSubmitButton idleLabel="Request document" pendingLabel="Requesting…" className="tf-primary-action px-4 py-2 text-[13px]"/></div>
        </form>
      </section>
    </main>
  );
}
