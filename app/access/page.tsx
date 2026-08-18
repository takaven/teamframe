import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";
import { requireTenantCapability } from "@/middleware/rbac";
import { listAccessMemberships } from "@/services/accessManagementService";
import { setMembershipActiveAction, updateAccessMatrixAction, updateAccessProfileAction } from "./actions";

export const dynamic = "force-dynamic";

// Manager is intentionally NOT a manually-assignable preset — it is derived from
// current reporting relationships.
const PROFILE_OPTIONS = [
  ["full_access", "Full Access"],
  ["admin", "Admin"],
  ["finance", "Finance"],
  ["employee", "Employee"],
] as const;

const PEOPLE_SCOPE_OPTIONS = [
  ["none", "None"], ["all", "All"], ["direct_reports", "Direct Reports"],
  ["selected_people", "Selected People"], ["all_except_selected_people", "All Except Selected People"],
] as const;
const SALARY_LEVEL_OPTIONS = [["none", "None"], ["view", "View"], ["manage", "Manage"]] as const;
const SALARY_SCOPE_OPTIONS = [["all", "All"], ["direct_reports", "Direct Reports"], ["selected_people", "Selected People"], ["all_except_selected_people", "All Except Selected People"]] as const;
const PRIVATE_DOCUMENT_SCOPE_OPTIONS = [["none", "None"], ["all", "All"], ["selected_people", "Selected People"], ["all_except_selected_people", "All Except Selected People"]] as const;

function idsValue(ids: string[]): string { return ids.join(", "); }

type Membership = Awaited<ReturnType<typeof listAccessMemberships>>["memberships"][number];

// Plain-English "what can this person see and do?" summary.
function accessSummary(m: Membership): string {
  const parts: string[] = [];
  parts.push(`People: ${m.people_access_scope.replace(/_/g, " ")}`);
  parts.push(`Salary: ${m.salary_access_level}${m.salary_access_level !== "none" ? ` (${m.salary_access_scope.replace(/_/g, " ")})` : ""}`);
  parts.push(`Private docs: ${m.private_documents_scope.replace(/_/g, " ")}`);
  if (m.finance_exports_access) parts.push("Finance exports");
  if (m.manage_users_access) parts.push("Manage access");
  return parts.join(" · ");
}

export default async function AccessPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; status?: string }>;
}) {
  const actor = await requireTenantCapability("company_access_settings");
  const { memberships } = await listAccessMemberships(actor);
  const params = (await searchParams) ?? {};

  return (
    <main className="mx-auto max-w-5xl px-6 py-14">
      <AppShell actor={actor} activePath="/setup" />
      <div className="border-b border-ink-300/60 pb-5">
        <p className="text-[12px] tracking-[0.14em] text-ink-500">
          <Link href="/setup" className="hover:text-ink-800">Setup</Link> · Users &amp; Access
        </p>
        <h1 className="mt-2 text-[34px] leading-tight tracking-tight">Users &amp; Access</h1>
        <p className="mt-1 max-w-2xl text-[14px] text-ink-500">
          Access starts from clear presets. Manager access is derived from current direct reports — it is not assigned here.
          Fine-grained custom access is available under “Customize access” for exceptions.
        </p>
      </div>

      {params.error ? (
        <p role="alert" className="mt-6 rounded-lg border border-signal-red/30 bg-signal-red/10 px-4 py-3 text-[14px] text-signal-red">Access change failed: {params.error}</p>
      ) : null}
      {params.status ? (
        <p className="mt-6 rounded-lg border border-accent/70 bg-white/80 px-4 py-3 text-[14px] text-accent">Access change recorded.</p>
      ) : null}

      <div className="mt-7 overflow-hidden rounded-xl border border-ink-300/70 bg-white/70">
        <div className="hidden grid-cols-[1.4fr_1fr_0.8fr_auto] gap-3 border-b border-ink-200 bg-ink-50/60 px-5 py-3 text-[11px] font-bold uppercase tracking-[0.1em] text-ink-500 lg:grid">
          <span>User</span><span>Access level</span><span>Status</span><span>Actions</span>
        </div>
        <ul className="divide-y divide-ink-100">
          {memberships.map((membership) => (
            <li key={membership.id} className="px-5 py-4">
              <div className="grid items-start gap-3 lg:grid-cols-[1.4fr_1fr_0.8fr_auto]">
                {/* User */}
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold text-ink-900">{membership.display_name}</p>
                  <p className="text-[12px] text-ink-500">{membership.email}</p>
                  <p className="mt-1 text-[12px] text-ink-500">{accessSummary(membership)}</p>
                </div>
                {/* Access level (preset) */}
                <div>
                  <span className="inline-flex rounded-full border border-ink-200 bg-white px-2.5 py-1 text-[12px] font-bold text-ink-700">
                    {membership.display_profile}
                  </span>
                  {membership.display_profile === "Custom" ? (
                    <p className="mt-1 text-[11px] text-ink-500">Effective access differs from a standard preset.</p>
                  ) : null}
                </div>
                {/* Status */}
                <div>
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-[12px] font-semibold ${membership.active ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                    {membership.active ? "Active" : "Suspended"}
                  </span>
                </div>
                {/* Actions */}
                <div className="flex flex-col items-stretch gap-2 lg:w-[220px]">
                  <form action={updateAccessProfileAction} className="flex items-center gap-2">
                    <input type="hidden" name="membership_id" value={membership.id} />
                    <select name="profile" defaultValue={membership.profile} className="min-w-0 flex-1 rounded-lg border border-ink-300 bg-white px-2 py-1.5 text-[12px]">
                      {PROFILE_OPTIONS.map(([value, label]) => (<option key={value} value={value}>{label}</option>))}
                    </select>
                    <PendingSubmitButton idleLabel="Apply" pendingLabel="…" className="rounded-lg bg-brand-signal px-3 py-1.5 text-[12px] font-medium text-ink-800" />
                  </form>
                  <form action={setMembershipActiveAction}>
                    <input type="hidden" name="membership_id" value={membership.id} />
                    <input type="hidden" name="active" value={membership.active ? "false" : "true"} />
                    <PendingSubmitButton idleLabel={membership.active ? "Suspend" : "Reactivate"} pendingLabel="…" className="w-full rounded-lg border border-ink-300 bg-white px-3 py-1.5 text-[12px] text-ink-700 hover:border-ink-900" />
                  </form>
                </div>
              </div>

              {/* Custom access — granular controls hidden by default */}
              <details className="mt-3">
                <summary className="cursor-pointer text-[12px] font-medium text-ink-700 hover:text-ink-900">Customize access</summary>
                <form action={updateAccessMatrixAction} className="mt-3 grid gap-2 rounded-lg border border-ink-200 bg-ink-50/40 p-3 lg:grid-cols-2">
                  <input type="hidden" name="membership_id" value={membership.id} />
                  <label className="text-[12px] font-bold text-ink-700">People Operations
                    <select name="people_access_scope" defaultValue={membership.people_access_scope} className="mt-1 w-full rounded-lg border border-ink-200 bg-white px-2 py-2 text-[12px]">
                      {PEOPLE_SCOPE_OPTIONS.map(([value, label]) => (<option key={value} value={value}>{label}</option>))}
                    </select>
                  </label>
                  <label className="text-[12px] font-bold text-ink-700">People — selected employee IDs
                    <input name="people_selected_employee_ids" defaultValue={idsValue(membership.people_selected_employee_ids)} placeholder="comma-separated" className="mt-1 w-full rounded-lg border border-ink-200 bg-white px-2 py-2 text-[12px]" />
                  </label>
                  <label className="text-[12px] font-bold text-ink-700">Salary level
                    <select name="salary_access_level" defaultValue={membership.salary_access_level} className="mt-1 w-full rounded-lg border border-ink-200 bg-white px-2 py-2 text-[12px]">
                      {SALARY_LEVEL_OPTIONS.map(([value, label]) => (<option key={value} value={value}>{label}</option>))}
                    </select>
                  </label>
                  <label className="text-[12px] font-bold text-ink-700">Salary scope
                    <select name="salary_access_scope" defaultValue={membership.salary_access_scope} className="mt-1 w-full rounded-lg border border-ink-200 bg-white px-2 py-2 text-[12px]">
                      {SALARY_SCOPE_OPTIONS.map(([value, label]) => (<option key={value} value={value}>{label}</option>))}
                    </select>
                  </label>
                  <label className="text-[12px] font-bold text-ink-700 lg:col-span-2">Salary — selected employee IDs
                    <input name="salary_selected_employee_ids" defaultValue={idsValue(membership.salary_selected_employee_ids)} placeholder="comma-separated" className="mt-1 w-full rounded-lg border border-ink-200 bg-white px-2 py-2 text-[12px]" />
                  </label>
                  <label className="text-[12px] font-bold text-ink-700">Private documents
                    <select name="private_documents_scope" defaultValue={membership.private_documents_scope} className="mt-1 w-full rounded-lg border border-ink-200 bg-white px-2 py-2 text-[12px]">
                      {PRIVATE_DOCUMENT_SCOPE_OPTIONS.map(([value, label]) => (<option key={value} value={value}>{label}</option>))}
                    </select>
                  </label>
                  <label className="text-[12px] font-bold text-ink-700">Private documents — selected IDs
                    <input name="private_documents_selected_employee_ids" defaultValue={idsValue(membership.private_documents_selected_employee_ids)} placeholder="comma-separated" className="mt-1 w-full rounded-lg border border-ink-200 bg-white px-2 py-2 text-[12px]" />
                  </label>
                  <label className="flex items-center gap-2 text-[12px] font-bold text-ink-700">
                    <input name="finance_exports_access" type="checkbox" defaultChecked={membership.finance_exports_access} /> Finance / payroll exports
                  </label>
                  <label className="flex items-center gap-2 text-[12px] font-bold text-ink-700">
                    <input name="manage_users_access" type="checkbox" defaultChecked={membership.manage_users_access} /> Manage users and access
                  </label>
                  <div className="lg:col-span-2">
                    <PendingSubmitButton idleLabel="Save custom access" pendingLabel="Saving…" className="rounded-lg border border-ink-300 bg-white px-3 py-2 text-[13px] text-ink-800 hover:border-ink-900" />
                  </div>
                </form>
              </details>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
