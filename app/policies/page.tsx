import { redirect } from "next/navigation";
import { requireTenantActor } from "@/middleware/rbac";
import { listPolicies, type PolicyAdminRecord } from "@/services/policyService";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { StatusPill, type StatusPillTone } from "@/components/StatusPill";
import { archivePolicyAction, attachPolicyFileAction, createPolicyAction, downloadPolicyFileAction, publishPolicyAction, uploadPolicyAction } from "./actions";

export const dynamic = "force-dynamic";

const STATUS_COPY: Record<string, string> = {
  created: "Text policy created as a draft. Publish it when it is ready.",
  uploaded: "Policy uploaded.",
  file_attached: "Policy file attached.",
  published: "Policy published. Employees will now be asked to acknowledge it.",
  archived: "Policy archived. It no longer generates acknowledgement risks.",
};

const ERROR_COPY: Record<string, string> = {
  FORBIDDEN: "You do not have permission for that action.",
  NO_TENANT_CONTEXT: "Session error — please sign out and back in.",
  STALE_WRITE: "This policy changed. Refresh and try again.",
  MISSING_EXPECTED_UPDATED_AT: "This action is out of date. Refresh and retry.",
  INVALID_INPUT: "Check the title, version, and effective date, then try again.",
  POLICY_CREATE_FAILED: "Could not create the policy.",
  POLICY_FILE_REQUIRED: "Attach a policy file (PDF, DOC, or DOCX) to upload a policy.",
  POLICY_FILE_ATTACH_FAILED: "Could not attach the policy file.",
  POLICY_FILE_UNSUPPORTED_TYPE: "Policy files must be PDF, DOC, or DOCX.",
  POLICY_FILE_NOT_FOUND: "No file is attached to that policy version.",
  POLICY_PUBLISH_FAILED: "Could not publish the policy.",
  POLICY_ARCHIVE_FAILED: "Could not archive the policy.",
  POLICY_LIST_FAILED: "Could not load policies.",
  POLICY_NOT_FOUND: "That policy could not be found.",
  POLICY_NOT_PUBLISHED: "That policy is not published, so it cannot be acknowledged.",
  AUDIT_LOG_FAILED: "Could not record required audit trail. No change was applied.",
  UNKNOWN: "Something went wrong. Refresh and try again.",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function policyState(policy: PolicyAdminRecord): {
  label: "Draft" | "Published" | "Archived";
  tone: StatusPillTone;
  help: string;
} {
  if (policy.archived_at) {
    return {
      label: "Archived",
      tone: "neutral",
      help: `Archived ${formatDate(policy.archived_at)}. No longer requires acknowledgement.`,
    };
  }
  if (policy.is_published) {
    return {
      label: "Published",
      tone: "green",
      help: `${policy.acknowledged_count} of ${policy.active_employee_count} team member${policy.active_employee_count === 1 ? "" : "s"} acknowledged v${policy.version}.`,
    };
  }
  return {
    label: "Draft",
    tone: "amber",
    help: "Not visible to employees until published.",
  };
}

export default async function PoliciesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; error?: string; nv_title?: string; nv_version?: string }>;
}) {
  const actor = await requireTenantActor();
  const { status, error, nv_title: nvTitle, nv_version: nvVersion } = await searchParams;

  if (actor.role !== "admin") {
    // Employees acknowledge policies from their self-service hub.
    redirect("/me");
  }

  const successMessage = status ? (STATUS_COPY[status] ?? null) : null;
  const errorMessage = error ? (ERROR_COPY[error] ?? ERROR_COPY.UNKNOWN) : null;

  const policies = await listPolicies(actor);
  const uploadDefaultTitle = nvTitle ?? "";
  const uploadDefaultVersion = nvVersion && /^\d+$/.test(nvVersion) ? Number(nvVersion) : 1;
  const isNewVersion = Boolean(nvTitle);
  const published = policies.filter((p) => p.is_published && !p.archived_at);
  const drafts = policies.filter((p) => !p.is_published && !p.archived_at);
  const awaiting = published.reduce(
    (sum, p) => sum + Math.max(0, p.active_employee_count - p.acknowledged_count),
    0,
  );

  return (
    <main className="mx-auto max-w-5xl px-6 py-14">
      <AppShell actor={actor} activePath="/policies" />

      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-ink-300/60 pb-5">
        <div className="space-y-2">
          <p className="text-[12px] tracking-[0.14em] text-ink-500">Admin queue</p>
          <h1 className="text-[34px] leading-tight tracking-tight">Policies</h1>
          <p className="text-[14px] text-ink-500">
            Publish the rules your team works by and collect acknowledgement records.
          </p>
        </div>
      </div>

      <section className="mt-7 grid gap-4 sm:grid-cols-3">
        <article className="rounded-xl border border-ink-300/70 bg-white/75 p-4">
          <p className="text-[12px] text-ink-500">Published</p>
          <p className="mt-2 font-mono text-[24px] tabular-nums tracking-tight">{published.length}</p>
        </article>
        <article className="rounded-xl border border-ink-300/70 bg-white/75 p-4">
          <p className="text-[12px] text-ink-500">Drafts</p>
          <p className="mt-2 font-mono text-[24px] tabular-nums tracking-tight">{drafts.length}</p>
        </article>
        <article className="rounded-xl border border-ink-300/70 bg-white/75 p-4">
          <p className="text-[12px] text-ink-500">Acknowledgements outstanding</p>
          <p className="mt-2 font-mono text-[24px] tabular-nums tracking-tight">{awaiting}</p>
        </article>
      </section>

      {successMessage ? (
        <p className="mt-7 rounded-lg border border-accent/70 bg-white/80 px-4 py-3 text-[14px] text-accent">
          {successMessage}
        </p>
      ) : null}
      {errorMessage ? (
        <p
          role="alert"
          className="mt-7 rounded-lg border border-signal-red/30 bg-signal-red/10 px-4 py-3 text-[14px] text-signal-red"
        >
          {errorMessage}
        </p>
      ) : null}

      <section id="upload" className="mt-8 rounded-xl border border-ink-300/70 bg-white/80 p-5">
        <h2 className="text-[19px] font-medium tracking-tight">{isNewVersion ? "Upload new version" : "Upload policy"}</h2>
        <p className="mt-1 text-[13px] text-ink-500">
          {isNewVersion
            ? "This creates a new version as its own record. Earlier versions and their acknowledgements are preserved."
            : "The primary way to add a policy: upload the document, set its version and effective date, then publish."}
        </p>
        <form action={uploadPolicyAction} className="mt-4 grid gap-3" encType="multipart/form-data">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_120px_160px]">
            <label className="flex flex-col gap-1 text-[12px] text-ink-500">
              Title
              <input
                name="title"
                defaultValue={uploadDefaultTitle}
                readOnly={isNewVersion}
                placeholder="e.g. Employee Handbook"
                required
                maxLength={200}
                className="rounded-md border border-ink-300 px-3 py-2 text-[14px] text-ink-900"
              />
            </label>
            <label className="flex flex-col gap-1 text-[12px] text-ink-500">
              Version
              <input name="version" type="number" min={1} max={1000} step={1} defaultValue={uploadDefaultVersion} required className="rounded-md border border-ink-300 px-3 py-2 text-[14px] text-ink-900" />
            </label>
            <label className="flex flex-col gap-1 text-[12px] text-ink-500">
              Effective date
              <input name="effective_date" type="date" required className="rounded-md border border-ink-300 px-3 py-2 text-[14px] text-ink-900" />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-[12px] text-ink-500">
            Policy file (PDF, DOC, or DOCX)
            <input name="file" type="file" required accept=".pdf,.doc,.docx" className="rounded-md border border-ink-300 bg-white px-3 py-2 text-[13px] text-ink-900" />
          </label>
          <label className="flex items-center gap-2 text-[13px] text-ink-700">
            <input type="checkbox" name="publish" defaultChecked className="h-4 w-4 rounded border-ink-300" />
            Publish now (employees will be asked to acknowledge this version)
          </label>
          <div>
            <PendingSubmitButton
              idleLabel={isNewVersion ? "Upload new version" : "Upload policy"}
              pendingLabel="Uploading…"
              className="rounded-lg bg-brand-signal px-5 py-2 text-[14px] font-medium text-ink-800 transition hover:bg-[#00E51F] disabled:cursor-not-allowed disabled:bg-ink-300"
            />
          </div>
        </form>

        <details className="mt-4 rounded-lg border border-ink-300/50 bg-white/70">
          <summary className="cursor-pointer px-4 py-2.5 text-[13px] font-medium text-ink-700 hover:text-ink-900">
            Create simple text policy instead
          </summary>
          <form action={createPolicyAction} className="grid gap-3 border-t border-ink-300/40 px-4 py-4">
            <p className="text-[12px] text-ink-500">For lightweight policies without a document. Historical text policies keep working.</p>
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_120px_160px]">
              <label className="flex flex-col gap-1 text-[12px] text-ink-500">
                Title
                <input name="title" required maxLength={200} className="rounded-md border border-ink-300 px-3 py-2 text-[14px] text-ink-900" />
              </label>
              <label className="flex flex-col gap-1 text-[12px] text-ink-500">
                Version
                <input name="version" type="number" min={1} max={1000} step={1} defaultValue={1} required className="rounded-md border border-ink-300 px-3 py-2 text-[14px] text-ink-900" />
              </label>
              <label className="flex flex-col gap-1 text-[12px] text-ink-500">
                Effective date
                <input name="effective_date" type="date" className="rounded-md border border-ink-300 px-3 py-2 text-[14px] text-ink-900" />
              </label>
            </div>
            <label className="flex flex-col gap-1 text-[12px] text-ink-500">
              Policy text
              <textarea name="body" required rows={4} maxLength={20000} placeholder="Write the policy in plain text" className="rounded-md border border-ink-300 px-3 py-2 text-[14px] text-ink-900" />
            </label>
            <div>
              <PendingSubmitButton idleLabel="Create text draft" pendingLabel="Creating…" className="rounded-lg border border-ink-300 px-5 py-2 text-[14px] font-medium text-ink-700 transition hover:border-ink-900 disabled:text-ink-300" />
            </div>
          </form>
        </details>
      </section>

      {policies.length === 0 ? (
        <EmptyState
          className="mt-8"
          message="No policies yet."
          hint="Create your first policy above, then publish it to start collecting acknowledgements."
        />
      ) : (
        <section className="mt-8 rounded-xl border border-ink-300/70 bg-white/80">
          <div className="border-b border-ink-300/60 px-5 py-4">
            <h2 className="text-[17px] font-medium tracking-tight">
              All policies — <span className="font-mono tabular-nums">{policies.length}</span>
            </h2>
          </div>
          <ul className="divide-y divide-ink-300/40">
            {policies.map((policy) => {
              const state = policyState(policy);
              return (
                <li key={policy.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="text-[15px] text-ink-900 font-medium">
                        {policy.title}{" "}
                        <span className="font-mono text-[12px] tabular-nums text-ink-500 font-normal">v{policy.version}</span>
                      </p>
                      <p>
                        <StatusPill tone={state.tone}>{state.label}</StatusPill>
                      </p>
                      <p className="text-[12px] text-ink-500">{state.help}</p>
                      <p className="text-[12px] text-ink-500">
                        {policy.effective_date ? <>Effective <span className="font-mono tabular-nums">{formatDate(policy.effective_date)}</span> · </> : null}
                        Created <span className="font-mono tabular-nums">{formatDate(policy.created_at)}</span> · Updated{" "}
                        <span className="font-mono tabular-nums">{formatDate(policy.updated_at)}</span>
                      </p>
                      <div className="mt-2 rounded-md border border-ink-300/50 bg-ink-100/30 px-3 py-2">
                        <p className="text-[12px] font-medium text-ink-900">
                          Policy file: {policy.file_original_name ?? "No file attached"}
                        </p>
                        {policy.file_uploaded_at ? (
                          <div className="mt-1 flex flex-wrap items-center gap-3">
                            <p className="text-[12px] text-ink-500">
                              Uploaded <span className="font-mono tabular-nums">{formatDate(policy.file_uploaded_at)}</span>
                            </p>
                            <form action={downloadPolicyFileAction}>
                              <input type="hidden" name="policy_id" value={policy.id} />
                              <input type="hidden" name="return_to" value="/policies" />
                              <button type="submit" className="text-[12px] text-accent underline underline-offset-2">View / download</button>
                            </form>
                          </div>
                        ) : (
                          <p className="mt-1 text-[12px] text-ink-500">
                            PDF or DOCX upload is the normal policy content path; plain text remains available for simple policies.
                          </p>
                        )}
                        {!policy.archived_at ? (
                          <form action={attachPolicyFileAction} className="mt-2 flex flex-wrap items-end gap-2" encType="multipart/form-data">
                            <input type="hidden" name="policy_id" value={policy.id} />
                            <label className="flex min-w-0 flex-1 flex-col gap-1 text-[11px] text-ink-500">
                              Attach PDF/DOCX
                              <input name="file" type="file" required className="rounded-md border border-ink-300 bg-white px-2 py-1.5 text-[12px] text-ink-900" />
                            </label>
                            <PendingSubmitButton
                              idleLabel={policy.file_original_name ? "Replace file" : "Attach file"}
                              pendingLabel="Uploading…"
                              className="rounded-md border border-ink-300 px-3 py-1.5 text-[12px] font-medium text-ink-700 hover:border-ink-900 disabled:text-ink-300"
                            />
                          </form>
                        ) : null}
                      </div>
                      {policy.is_published && !policy.archived_at ? (
                        <details className="mt-3 rounded-md border border-ink-300/50 bg-white">
                          <summary className="cursor-pointer px-3 py-2 text-[12px] font-medium text-ink-800 hover:text-ink-900">
                            Acknowledgement evidence ·{" "}
                            <span className="font-mono tabular-nums">
                              {policy.acknowledged_count}/{policy.active_employee_count}
                            </span>
                          </summary>
                          {policy.acknowledgement_evidence.length === 0 ? (
                            <p className="border-t border-ink-300/40 px-3 py-3 text-[12px] text-ink-500">
                              No eligible employees for this policy version.
                            </p>
                          ) : (
                            <ul className="divide-y divide-ink-300/40 border-t border-ink-300/40">
                              {policy.acknowledgement_evidence.slice(0, 8).map((entry) => (
                                <li key={entry.employee_id} className="grid gap-2 px-3 py-2 text-[12px] sm:grid-cols-[1fr_auto_auto] sm:items-center">
                                  <div>
                                    <p className="font-medium text-ink-900">{entry.full_name}</p>
                                    <p className="text-ink-500">{entry.email}</p>
                                  </div>
                                  <StatusPill tone={entry.status === "acknowledged" ? "green" : "amber"}>
                                    {entry.status === "acknowledged" ? "Acknowledged" : "Outstanding"}
                                  </StatusPill>
                                  <p className="font-mono tabular-nums text-ink-500">
                                    {entry.acknowledged_at ? formatDate(entry.acknowledged_at) : "-"}
                                  </p>
                                </li>
                              ))}
                            </ul>
                          )}
                          {policy.acknowledgement_evidence.length > 8 ? (
                            <p className="border-t border-ink-300/40 px-3 py-2 text-[12px] text-ink-500">
                              Showing first 8 records. Outstanding acknowledgements are listed first.
                            </p>
                          ) : null}
                        </details>
                      ) : null}
                      <details className="mt-1">
                        <summary className="cursor-pointer text-[12px] text-ink-500 hover:text-ink-900 transition">
                          Read policy text
                        </summary>
                        <p className="mt-2 whitespace-pre-wrap rounded-md border border-ink-300/50 bg-ink-100/40 px-3 py-2 text-[13px] text-ink-700">
                          {policy.body}
                        </p>
                      </details>
                    </div>
                    <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:flex-nowrap">
                      {!policy.archived_at ? (
                        <a
                          href={`/policies?nv_title=${encodeURIComponent(policy.title)}&nv_version=${policy.version + 1}#upload`}
                          className="w-full rounded-full border border-ink-300 px-4 py-1.5 text-center text-[13px] text-ink-700 transition hover:border-ink-900 hover:text-ink-900 sm:w-auto"
                        >
                          New version
                        </a>
                      ) : null}
                      {!policy.is_published && !policy.archived_at ? (
                        <form action={publishPolicyAction} className="w-full sm:w-auto">
                          <input type="hidden" name="policy_id" value={policy.id} />
                          <input type="hidden" name="expected_updated_at" value={policy.updated_at} />
                          <PendingSubmitButton
                            idleLabel="Publish"
                            pendingLabel="Publishing…"
                            className="w-full rounded-lg bg-brand-signal px-4 py-1.5 text-[13px] font-medium text-ink-800 transition hover:bg-[#00E51F] disabled:cursor-not-allowed disabled:bg-ink-300 sm:w-auto"
                          />
                        </form>
                      ) : null}
                      {!policy.archived_at ? (
                        <form action={archivePolicyAction} className="w-full sm:w-auto">
                          <input type="hidden" name="policy_id" value={policy.id} />
                          <input type="hidden" name="expected_updated_at" value={policy.updated_at} />
                          <ConfirmSubmitButton
                            idleLabel="Archive"
                            pendingLabel="Archiving…"
                            confirmMessage={`Archive "${policy.title}" v${policy.version}? Employees will no longer be asked to acknowledge it.`}
                            className="w-full rounded-full border border-ink-300 px-4 py-1.5 text-[13px] text-ink-700 transition hover:border-ink-900 hover:text-ink-900 disabled:cursor-not-allowed disabled:border-ink-300/50 disabled:text-ink-300 sm:w-auto"
                          />
                        </form>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </main>
  );
}
