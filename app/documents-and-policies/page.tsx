import { redirect } from "next/navigation";
import { requireTenantActor } from "@/middleware/rbac";
import { listDocumentRequirementsForEmployee } from "@/services/documentService";
import { listUnacknowledgedForEmployee } from "@/services/policyService";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { DocumentsChecklist } from "@/components/DocumentsChecklist";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";
import { acknowledgePolicyAction, downloadPolicyFileAction } from "@/app/policies/actions";

export const dynamic = "force-dynamic";

const STATUS_COPY: Record<string, string> = {
  policy_acknowledged: "Policy acknowledged. Thank you.",
  document_uploaded: "Document uploaded.",
};

const ERROR_COPY: Record<string, string> = {
  FORBIDDEN: "You do not have permission for that action.",
  NO_EMPLOYEE_RECORD: "Your account is not linked to an employee profile yet. Ask your admin.",
  INVALID_INPUT: "Check the details and try again.",
  UNKNOWN: "Something went wrong. Refresh and try again.",
};

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default async function DocumentsAndPoliciesPage({ searchParams }: { searchParams: Promise<{ status?: string; error?: string }> }) {
  const actor = await requireTenantActor();
  const { status, error } = await searchParams;
  if (actor.role === "admin") redirect("/documents");

  if (!actor.employeeId) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-14">
        <AppShell actor={actor} activePath="/documents-and-policies" />
        <EmptyState className="mt-8" message="Your account is not linked to an employee profile." hint="Ask your admin to add you as an employee." />
      </main>
    );
  }

  const [requirements, policies] = await Promise.all([
    listDocumentRequirementsForEmployee(actor, actor.employeeId),
    listUnacknowledgedForEmployee(actor),
  ]);
  const successMessage = status ? (STATUS_COPY[status] ?? null) : null;
  const errorMessage = error ? (ERROR_COPY[error] ?? ERROR_COPY.UNKNOWN) : null;

  return (
    <main className="mx-auto max-w-5xl px-6 py-14">
      <AppShell actor={actor} activePath="/documents-and-policies" />
      <header className="border-b border-ink-300/60 pb-5">
        <p className="text-[12px] tracking-[0.14em] text-ink-500">Self-service</p>
        <h1 className="mt-2 text-[34px] leading-tight tracking-tight">Documents &amp; policies</h1>
        <p className="mt-1 text-[14px] text-ink-500">Upload requested documents and acknowledge the policies assigned to you.</p>
      </header>
      {successMessage ? <p role="status" aria-live="polite" className="mt-6 rounded-lg border border-accent/70 bg-white/80 px-4 py-3 text-[14px] text-accent">{successMessage}</p> : null}
      {errorMessage ? <p role="alert" className="mt-6 rounded-lg border border-signal-red/30 bg-signal-red/10 px-4 py-3 text-[14px] text-signal-red">{errorMessage}</p> : null}

      <section id="documents" className="mt-7 scroll-mt-6 tf-surface-flat p-5">
        <h2 className="tf-h2">Documents</h2>
        <p className="mt-1 text-[13px] text-ink-500">Each upload is recorded against the matching request.</p>
        <div className="mt-4"><DocumentsChecklist requirements={requirements} returnTo="/documents-and-policies#documents" /></div>
      </section>

      <section id="policies" className="mt-6 scroll-mt-6 tf-surface-flat">
        <div className="border-b border-ink-200 px-5 py-4">
          <h2 className="tf-h2">Policies to acknowledge — <span className="tabular-nums">{policies.length}</span></h2>
          <p className="mt-1 text-[13px] text-ink-500">Read each policy, then confirm you have understood it.</p>
        </div>
        {policies.length === 0 ? (
          <p className="px-5 py-5 text-[14px] text-ink-500">You have acknowledged every published policy assigned to you.</p>
        ) : (
          <ul className="divide-y divide-ink-100">
            {policies.map((policy) => (
              <li key={policy.id} className="px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-[15px] font-medium text-ink-900">{policy.title} <span className="text-[12px] tabular-nums text-ink-500">v{policy.version}</span></p>
                    {policy.effective_date ? <p className="text-[12px] text-ink-500">Effective <span className="tabular-nums">{formatDay(policy.effective_date)}</span></p> : null}
                    {policy.file_original_name ? <form action={downloadPolicyFileAction}><input type="hidden" name="policy_id" value={policy.id} /><input type="hidden" name="return_to" value="/documents-and-policies#policies" /><PendingSubmitButton idleLabel="Open policy document" pendingLabel="Opening…" className="text-[12px] text-accent underline underline-offset-2 disabled:text-ink-400" /></form> : null}
                    {policy.body ? <details><summary className="cursor-pointer text-[12px] text-ink-500 hover:text-ink-900">Read policy text</summary><p className="mt-2 whitespace-pre-wrap rounded-md border border-ink-200 bg-ink-50/60 px-3 py-2 text-[13px] text-ink-700">{policy.body}</p></details> : null}
                  </div>
                  <form action={acknowledgePolicyAction} className="w-full sm:w-auto">
                    <input type="hidden" name="policy_id" value={policy.id} />
                    <input type="hidden" name="policy_version" value={policy.version} />
                    <input type="hidden" name="return_to" value="/documents-and-policies#policies" />
                    <ConfirmSubmitButton idleLabel="I acknowledge" pendingLabel="Recording…" confirmMessage={`Acknowledge "${policy.title}" v${policy.version}? This confirms you have read and understood it.`} className="w-full tf-primary-action px-4 py-1.5 text-[13px] font-medium sm:w-auto" />
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
