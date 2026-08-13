import { AppShell } from "@/components/AppShell";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";
import { requireTenantCapability } from "@/middleware/rbac";
import { listAccessMemberships } from "@/services/accessManagementService";
import {
  createAccessRuleAction,
  deleteAccessRuleAction,
  setMembershipActiveAction,
  updateAccessProfileAction,
} from "./actions";

export const dynamic = "force-dynamic";

const PROFILE_OPTIONS = [
  ["admin", "Admin"],
  ["finance", "Finance"],
  ["full_access", "Full Access"],
  ["employee", "Employee"],
] as const;

const CAPABILITY_OPTIONS = [
  ["people_operations", "People Operations"],
  ["compensation_view", "Salary view"],
  ["compensation_manage", "Salary changes"],
  ["private_employee_documents", "Private documents"],
  ["finance_payroll_exports", "Finance exports"],
  ["company_access_settings", "Company and access"],
] as const;

const SCOPE_OPTIONS = [
  ["whole_company", "Whole Company"],
  ["own_team", "Own Team"],
  ["department", "Department"],
  ["selected_people", "Selected People"],
] as const;

function profileLabel(profile: string): string {
  return PROFILE_OPTIONS.find(([value]) => value === profile)?.[1] ?? profile;
}

export default async function AccessPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; status?: string }>;
}) {
  const actor = await requireTenantCapability("company_access_settings");
  const { memberships, rules } = await listAccessMemberships(actor);
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
            Standard profiles stay simple. Exceptions are explicit, scoped and effective immediately.
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
            <h2 className="text-2xl font-extrabold text-ink-800">Profiles and exceptions</h2>
          </div>
          <p className="max-w-md text-[13px] leading-6 text-ink-600">
            Manager access is automatic for current direct reports. Custom means one or more explicit rules exists.
          </p>
        </div>

        <div className="mt-5 divide-y divide-ink-100">
          {memberships.map((membership) => {
            const membershipRules = rules.filter((rule) => rule.membership_id === membership.id);
            return (
              <article key={membership.id} className="grid gap-4 py-5 lg:grid-cols-[minmax(0,1fr)_300px]">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-[17px] font-extrabold text-ink-800">{membership.display_name}</h3>
                    <span className="rounded-full border border-ink-200 px-2 py-1 text-[12px] font-bold text-ink-600">
                      {membership.rule_count > 0 ? "Custom" : profileLabel(membership.profile)}
                    </span>
                    {!membership.active ? (
                      <span className="rounded-full border border-red-200 bg-red-50 px-2 py-1 text-[12px] font-bold text-red-900">
                        Suspended
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-[13px] text-ink-500">{membership.email}</p>

                  <div className="mt-4 grid gap-2 md:grid-cols-2">
                    {membershipRules.length === 0 ? (
                      <p className="text-[13px] text-ink-500">No custom exceptions.</p>
                    ) : (
                      membershipRules.map((rule) => (
                        <div key={rule.id} className="rounded-lg border border-ink-200 bg-ink-50 px-3 py-2">
                          <p className="text-[13px] font-bold text-ink-800">
                            {rule.effect === "allow" ? "Allow" : "Restrict"} {rule.capability.replace(/_/g, " ")}
                          </p>
                          <p className="text-[12px] text-ink-500">
                            {rule.scope.replace(/_/g, " ")}
                            {rule.department ? `: ${rule.department}` : ""}
                            {rule.employee_id ? `: ${rule.employee_id}` : ""}
                          </p>
                          <form action={deleteAccessRuleAction} className="mt-2">
                            <input type="hidden" name="rule_id" value={rule.id} />
                            <PendingSubmitButton idleLabel="Remove" pendingLabel="Removing..." className="border border-ink-300 bg-white px-2 py-1 text-[12px] text-ink-800" />
                          </form>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="grid gap-3">
                  <form action={updateAccessProfileAction} className="grid gap-2 rounded-lg border border-ink-200 p-3">
                    <input type="hidden" name="membership_id" value={membership.id} />
                    <label className="text-[13px] font-bold text-ink-700">
                      Standard profile
                      <select name="profile" defaultValue={membership.profile} className="mt-1 w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-[13px]">
                        {PROFILE_OPTIONS.map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <PendingSubmitButton idleLabel="Save profile" pendingLabel="Saving..." className="bg-brand-signal px-3 py-2 text-[13px] font-extrabold text-ink-900" />
                  </form>

                  <form action={createAccessRuleAction} className="grid gap-2 rounded-lg border border-ink-200 p-3">
                    <input type="hidden" name="membership_id" value={membership.id} />
                    <div className="grid grid-cols-2 gap-2">
                      <select name="effect" className="rounded-lg border border-ink-200 bg-white px-2 py-2 text-[12px]">
                        <option value="allow">Allow</option>
                        <option value="restrict">Restrict</option>
                      </select>
                      <select name="scope" className="rounded-lg border border-ink-200 bg-white px-2 py-2 text-[12px]">
                        {SCOPE_OPTIONS.map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <select name="capability" className="rounded-lg border border-ink-200 bg-white px-2 py-2 text-[12px]">
                      {CAPABILITY_OPTIONS.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <input name="department" placeholder="Department scope if selected" className="rounded-lg border border-ink-200 bg-white px-2 py-2 text-[12px]" />
                    <input name="employee_id" placeholder="Employee id for selected person" className="rounded-lg border border-ink-200 bg-white px-2 py-2 text-[12px]" />
                    <PendingSubmitButton idleLabel="Add exception" pendingLabel="Adding..." className="border border-ink-300 bg-white px-3 py-2 text-[13px] text-ink-800" />
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
            );
          })}
        </div>
      </section>
    </main>
  );
}
