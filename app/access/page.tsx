import { AppShell } from "@/components/AppShell";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";
import { requireTenantCapability } from "@/middleware/rbac";
import { listAccessMemberships } from "@/services/accessManagementService";
import { setMembershipActiveAction, updateAccessMatrixAction, updateAccessProfileAction } from "./actions";

export const dynamic = "force-dynamic";

const PROFILE_OPTIONS = [
  ["admin", "Admin"],
  ["finance", "Finance"],
  ["full_access", "Full Access"],
  ["employee", "Employee"],
] as const;

const PEOPLE_SCOPE_OPTIONS = [
  ["none", "None"],
  ["all", "All"],
  ["direct_reports", "Direct Reports"],
  ["selected_people", "Selected People"],
  ["all_except_selected_people", "All Except Selected People"],
] as const;

const SALARY_LEVEL_OPTIONS = [
  ["none", "None"],
  ["view", "View"],
  ["manage", "Manage"],
] as const;

const SALARY_SCOPE_OPTIONS = [
  ["all", "All"],
  ["direct_reports", "Direct Reports"],
  ["selected_people", "Selected People"],
  ["all_except_selected_people", "All Except Selected People"],
] as const;

const PRIVATE_DOCUMENT_SCOPE_OPTIONS = [
  ["none", "None"],
  ["all", "All"],
  ["selected_people", "Selected People"],
  ["all_except_selected_people", "All Except Selected People"],
] as const;

function idsValue(ids: string[]): string {
  return ids.join(", ");
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
    <main className="mx-auto max-w-6xl px-6 py-14">
      <AppShell actor={actor} activePath="/access" />
      <section className="tf-page-header">
        <div>
          <p className="tf-section-kicker">Access</p>
          <h1 className="text-[clamp(2rem,4vw,3.25rem)] font-extrabold tracking-tight text-ink-800">
            Company access
          </h1>
          <p className="mt-3 max-w-[760px] text-[16px] leading-7 text-ink-600">
            Full Access is the highest authority in this customer installation. Manager access is derived from current
            direct reports.
          </p>
        </div>
      </section>

      {params.error ? (
        <section className="tf-card mb-5 border-red-200 bg-red-50 text-[14px] text-red-900">
          Access change failed: {params.error}
        </section>
      ) : null}
      {params.status ? (
        <section className="tf-card mb-5 border-brand-signal/50 bg-white text-[14px] text-ink-800">
          Access change recorded.
        </section>
      ) : null}

      <section className="tf-card">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="tf-section-kicker">Users</p>
            <h2 className="text-2xl font-extrabold text-ink-800">Presets and custom access</h2>
          </div>
          <p className="max-w-md text-[13px] leading-6 text-ink-600">
            Custom means the effective matrix differs from the selected preset. There are no user-created roles.
          </p>
        </div>

        <div className="mt-5 divide-y divide-ink-100">
          {memberships.map((membership) => (
            <article key={membership.id} className="grid gap-4 py-5 xl:grid-cols-[minmax(0,1fr)_360px]">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-[17px] font-extrabold text-ink-800">{membership.display_name}</h3>
                  <span className="rounded-full border border-ink-200 px-2 py-1 text-[12px] font-bold text-ink-600">
                    {membership.display_profile}
                  </span>
                  {!membership.active ? (
                    <span className="rounded-full border border-red-200 bg-red-50 px-2 py-1 text-[12px] font-bold text-red-900">
                      Suspended
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-[13px] text-ink-500">{membership.email}</p>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-lg border border-ink-200 bg-ink-50 px-3 py-2">
                    <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-ink-500">People Operations</p>
                    <p className="mt-1 text-[14px] font-extrabold text-ink-800">{membership.people_access_scope.replace(/_/g, " ")}</p>
                  </div>
                  <div className="rounded-lg border border-ink-200 bg-ink-50 px-3 py-2">
                    <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-ink-500">Salary</p>
                    <p className="mt-1 text-[14px] font-extrabold text-ink-800">
                      {membership.salary_access_level} / {membership.salary_access_scope.replace(/_/g, " ")}
                    </p>
                  </div>
                  <div className="rounded-lg border border-ink-200 bg-ink-50 px-3 py-2">
                    <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-ink-500">Private Documents</p>
                    <p className="mt-1 text-[14px] font-extrabold text-ink-800">{membership.private_documents_scope.replace(/_/g, " ")}</p>
                  </div>
                  <div className="rounded-lg border border-ink-200 bg-ink-50 px-3 py-2">
                    <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-ink-500">Operations</p>
                    <p className="mt-1 text-[14px] font-extrabold text-ink-800">
                      {membership.finance_exports_access ? "Finance exports" : "No finance exports"}
                      {membership.manage_users_access ? " + access management" : ""}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid gap-3">
                <form action={updateAccessProfileAction} className="grid gap-2 rounded-lg border border-ink-200 p-3">
                  <input type="hidden" name="membership_id" value={membership.id} />
                  <label className="text-[13px] font-bold text-ink-700">
                    Preset
                    <select name="profile" defaultValue={membership.profile} className="mt-1 w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-[13px]">
                      {PROFILE_OPTIONS.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <PendingSubmitButton idleLabel="Apply preset" pendingLabel="Saving..." className="bg-brand-signal px-3 py-2 text-[13px] font-extrabold text-ink-900" />
                </form>

                <form action={updateAccessMatrixAction} className="grid gap-2 rounded-lg border border-ink-200 p-3">
                  <input type="hidden" name="membership_id" value={membership.id} />
                  <label className="text-[12px] font-bold text-ink-700">
                    People Operations
                    <select name="people_access_scope" defaultValue={membership.people_access_scope} className="mt-1 w-full rounded-lg border border-ink-200 bg-white px-2 py-2 text-[12px]">
                      {PEOPLE_SCOPE_OPTIONS.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <input name="people_selected_employee_ids" defaultValue={idsValue(membership.people_selected_employee_ids)} placeholder="Selected employee IDs" className="rounded-lg border border-ink-200 bg-white px-2 py-2 text-[12px]" />

                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-[12px] font-bold text-ink-700">
                      Salary level
                      <select name="salary_access_level" defaultValue={membership.salary_access_level} className="mt-1 w-full rounded-lg border border-ink-200 bg-white px-2 py-2 text-[12px]">
                        {SALARY_LEVEL_OPTIONS.map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-[12px] font-bold text-ink-700">
                      Salary scope
                      <select name="salary_access_scope" defaultValue={membership.salary_access_scope} className="mt-1 w-full rounded-lg border border-ink-200 bg-white px-2 py-2 text-[12px]">
                        {SALARY_SCOPE_OPTIONS.map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <input name="salary_selected_employee_ids" defaultValue={idsValue(membership.salary_selected_employee_ids)} placeholder="Selected salary employee IDs" className="rounded-lg border border-ink-200 bg-white px-2 py-2 text-[12px]" />

                  <label className="text-[12px] font-bold text-ink-700">
                    Private documents
                    <select name="private_documents_scope" defaultValue={membership.private_documents_scope} className="mt-1 w-full rounded-lg border border-ink-200 bg-white px-2 py-2 text-[12px]">
                      {PRIVATE_DOCUMENT_SCOPE_OPTIONS.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <input name="private_documents_selected_employee_ids" defaultValue={idsValue(membership.private_documents_selected_employee_ids)} placeholder="Selected document employee IDs" className="rounded-lg border border-ink-200 bg-white px-2 py-2 text-[12px]" />

                  <label className="flex items-center gap-2 text-[12px] font-bold text-ink-700">
                    <input name="finance_exports_access" type="checkbox" defaultChecked={membership.finance_exports_access} />
                    Finance / payroll exports
                  </label>
                  <label className="flex items-center gap-2 text-[12px] font-bold text-ink-700">
                    <input name="manage_users_access" type="checkbox" defaultChecked={membership.manage_users_access} />
                    Manage users and access
                  </label>
                  <PendingSubmitButton idleLabel="Save custom access" pendingLabel="Saving..." className="border border-ink-300 bg-white px-3 py-2 text-[13px] text-ink-800" />
                </form>

                <form action={setMembershipActiveAction}>
                  <input type="hidden" name="membership_id" value={membership.id} />
                  <input type="hidden" name="active" value={membership.active ? "false" : "true"} />
                  <PendingSubmitButton
                    idleLabel={membership.active ? "Suspend access" : "Reactivate access"}
                    pendingLabel="Saving..."
                    className="w-full border border-ink-300 bg-white px-3 py-2 text-[13px] text-ink-800"
                  />
                </form>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
