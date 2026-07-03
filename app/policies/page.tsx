import { redirect } from "next/navigation";
import { requireTenantActor } from "@/middleware/rbac";
import { listPolicies, type PolicyAdminRecord } from "@/services/policyService";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { StatusPill, type StatusPillTone } from "@/components/StatusPill";
import { archivePolicyAction, createPolicyAction, publishPolicyAction } from "./actions";

export const dynamic = "force-dynamic";

const STATUS_COPY: Record<string, string> = {
  created: "Policy created as a draft. Publish it when it is ready.",
  published: "Policy published. Employees will now be asked to acknowledge it.",
  archived: "Policy archived. It no longer generates acknowledgement risks.",
};

const ERROR_COPY: Record<string, string> = {
  FORBIDDEN: "You do not have permission for that action.",
  NO_TENANT_CONTEXT: "Session error — please sign out and back in.",
  STALE_WRITE: "This policy changed. Refresh and try again.",
  MISSING_EXPECTED_UPDATED_AT: "This action is out of date. Refresh and retry.",
  INVALID_INPUT: "Check the title, body, and version, then try again.",
  POLICY_CREATE_FAILED: "Could not create the policy.",
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
  searchParams: Promise<{ status?: string; error?: string }>;
}) {
  const actor = await requireTenantActor();
  const { status, error } = await searchParams;

  if (actor.role !== "admin") {
    // Employees acknowledge policies from their self-service hub.
    redirect("/me");
  }

  const successMessage = status ? (STATUS_COPY[status] ?? null) : null;
  const errorMessage = error ? (ERROR_COPY[error] ?? ERROR_COPY.UNKNOWN) : null;

  const policies = await listPolicies(actor);
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
          <p className="text-[12px] tracking-[0.14em] text-ink-500">Admin</p>
          <h1 className="text-[34px] leading-tight tracking-tight">Policies</h1>
          <p className="text-[14px] text-ink-500">
            Publish the rules your team works by and collect acknowledgements as compliance proof.
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
          className="mt-7 rounded-lg border border-ink-300/80 bg-white/80 px-4 py-3 text-[14px] text-ink-700"
        >
          {errorMessage}
        </p>
      ) : null}

      <section className="mt-8 rounded-xl border border-ink-300/70 bg-white/80 p-5">
        <h2 className="text-[19px] font-medium tracking-tight">Create policy</h2>
        <p className="mt-1 text-[13px] text-ink-500">
          Policies start as drafts. Publishing asks every current team member to acknowledge that version.
        </p>
        <form action={createPolicyAction} className="mt-4 grid gap-3">
          <div className="grid gap-3 md:grid-cols-[1fr_140px]">
            <input
              name="title"
              placeholder="Policy title (e.g. Remote work policy)"
              required
              maxLength={200}
              className="rounded-md border border-ink-300 px-3 py-2 text-[14px]"
            />
            <input
              name="version"
              type="number"
              min={1}
              max={1000}
              step={1}
              defaultValue={1}
              required
              aria-label="Version"
              className="rounded-md border border-ink-300 px-3 py-2 text-[14px]"
            />
          </div>
          <textarea
            name="body"
            placeholder="Policy text (plain text)"
            required
            rows={6}
            maxLength={20000}
            className="rounded-md border border-ink-300 px-3 py-2 text-[14px]"
          />
          <div>
            <PendingSubmitButton
              idleLabel="Create draft"
              pendingLabel="Creating..."
              className="rounded-full bg-ink-900 px-5 py-2 text-[14px] font-medium text-paper transition hover:bg-ink-700 disabled:cursor-not-allowed disabled:bg-ink-300"
            />
          </div>
        </form>
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
                        Created <span className="font-mono tabular-nums">{formatDate(policy.created_at)}</span> · Updated{" "}
                        <span className="font-mono tabular-nums">{formatDate(policy.updated_at)}</span>
                      </p>
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
                      {!policy.is_published && !policy.archived_at ? (
                        <form action={publishPolicyAction} className="w-full sm:w-auto">
                          <input type="hidden" name="policy_id" value={policy.id} />
                          <input type="hidden" name="expected_updated_at" value={policy.updated_at} />
                          <PendingSubmitButton
                            idleLabel="Publish"
                            pendingLabel="Publishing..."
                            className="w-full rounded-full bg-ink-900 px-4 py-1.5 text-[13px] font-medium text-paper transition hover:bg-ink-700 disabled:cursor-not-allowed disabled:bg-ink-300 sm:w-auto"
                          />
                        </form>
                      ) : null}
                      {!policy.archived_at ? (
                        <form action={archivePolicyAction} className="w-full sm:w-auto">
                          <input type="hidden" name="policy_id" value={policy.id} />
                          <input type="hidden" name="expected_updated_at" value={policy.updated_at} />
                          <ConfirmSubmitButton
                            idleLabel="Archive"
                            pendingLabel="Archiving..."
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
