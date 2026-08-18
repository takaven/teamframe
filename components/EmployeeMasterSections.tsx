import type { EmployeeMasterRecord } from "@/services/employeeMasterService";
import type { EmployeeAssignmentRecord } from "@/services/positionAssignmentService";
import { updateEmployeePhotoAction } from "@/app/employees/actions";

// Structured, read-oriented employee master record. Compensation/payment blocks render
// only when the record's capability flag (canView) is true — the confidential-access
// separation is enforced in the service (getEmployeeMasterRecord); this component never
// receives the values otherwise.

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const a = parts[0]?.charAt(0) ?? "";
  const b = parts.length > 1 ? parts[parts.length - 1]?.charAt(0) ?? "" : "";
  return (a + b).toUpperCase() || "?";
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function maskIban(v: string | null): string {
  if (!v) return "—";
  const t = v.replace(/\s+/g, "");
  return t.length <= 4 ? t : `•••• ${t.slice(-4)}`;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[12px] text-ink-500">{label}</dt>
      <dd className="mt-0.5 text-[14px] text-ink-900">{value === null || value === "" ? <span className="text-ink-400">—</span> : value}</dd>
    </div>
  );
}

function Section({ title, children, note }: { title: string; children: React.ReactNode; note?: string }) {
  return (
    <section className="rounded-xl border border-ink-200 bg-white/70 p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-[14px] font-bold tracking-tight text-ink-800">{title}</h3>
        {note ? <span className="text-[11px] text-ink-500">{note}</span> : null}
      </div>
      <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</dl>
    </section>
  );
}

export function EmployeeMasterSections({
  master,
  photoUrl,
  positionTitle,
  managerName,
  assignments,
}: {
  master: EmployeeMasterRecord;
  photoUrl: string | null;
  positionTitle: string | null;
  managerName: string | null;
  assignments: EmployeeAssignmentRecord[];
}) {
  const { identity, contact, employment, emergency_contact, compensation, payment_details } = master;
  const roleDiverges = positionTitle !== null && employment.role_title.trim().toLowerCase() !== positionTitle.trim().toLowerCase();

  return (
    <div className="space-y-4">
      {/* Identity */}
      <section className="rounded-xl border border-ink-200 bg-white/70 p-5">
        <div className="flex items-center gap-4">
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl} alt="" width={56} height={56} className="h-14 w-14 rounded-full object-cover" />
          ) : (
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-ink-100 text-[16px] font-bold text-ink-600">
              {initialsOf(identity.full_name)}
            </span>
          )}
          <div>
            <h3 className="text-[16px] font-bold text-ink-900">{identity.full_name}</h3>
            <p className="text-[13px] text-ink-500">
              {employment.role_title} · {employment.department}
            </p>
            <form action={updateEmployeePhotoAction} className="mt-2 flex items-center gap-2" encType="multipart/form-data">
              <input type="hidden" name="employee_id" value={identity.id} />
              <input
                type="file"
                name="photo"
                accept="image/png,image/jpeg,image/webp"
                required
                className="text-[11px] text-ink-600 file:mr-2 file:rounded file:border file:border-ink-300 file:bg-white file:px-2 file:py-1 file:text-[11px]"
              />
              <button type="submit" className="rounded-lg border border-ink-300 bg-white px-3 py-1 text-[12px] font-medium text-ink-700 hover:border-ink-900">
                {photoUrl ? "Change photo" : "Add photo"}
              </button>
            </form>
          </div>
        </div>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Employee number" value={identity.employee_number} />
          <Field label="Preferred name" value={identity.preferred_name} />
          <Field label="Date of birth" value={identity.date_of_birth ? fmtDate(identity.date_of_birth) : null} />
          <Field label="Gender" value={identity.gender} />
          <Field label="Nationality" value={identity.nationality} />
          <Field label="Lifecycle / status" value={`${employment.lifecycle_state} · ${employment.status}`} />
        </dl>
      </section>

      <Section title="Contact">
        <Field label="Personal email" value={contact.personal_email} />
        <Field label="Personal phone" value={contact.personal_phone} />
        <Field label="Company email" value={contact.company_email} />
        <Field label="Company phone" value={contact.company_phone} />
        <Field label="Residential address" value={contact.residential_address} />
      </Section>

      <Section title="Employment" note={roleDiverges ? "Role title differs from position title" : undefined}>
        <Field label="Position (slot)" value={positionTitle ?? <span className="text-ink-400">Not assigned</span>} />
        <Field label="Role / job title" value={employment.role_title} />
        <Field label="Department" value={employment.department} />
        <Field label="Manager" value={managerName} />
        <Field label="Country" value={employment.country} />
        <Field label="Work location" value={employment.work_location} />
        <Field label="Timezone" value={employment.timezone} />
        <Field label="Employment type" value={employment.employment_type.replace(/_/g, " ")} />
        <Field label="Start date" value={fmtDate(employment.start_date)} />
        <Field label="End date" value={employment.end_date ? fmtDate(employment.end_date) : null} />
        <Field label="Working-days override" value={employment.working_days_override ? employment.working_days_override.join(", ") : null} />
        <Field label="Leave entitlement override" value={employment.annual_leave_entitlement_override} />
      </Section>

      <Section title="Emergency contact">
        <Field label="Name" value={emergency_contact.name} />
        <Field label="Relationship" value={emergency_contact.relationship} />
        <Field label="Phone" value={emergency_contact.phone} />
        <Field label="Email" value={emergency_contact.email} />
      </Section>

      {compensation.canView ? (
        <Section title="Compensation" note="Restricted — compensation access">
          <Field label="Base salary" value={compensation.base_salary === null ? null : `${compensation.base_salary} ${compensation.currency ?? ""}`.trim()} />
          <Field label="Currency" value={compensation.currency} />
          <Field label="Pay basis" value={compensation.pay_basis} />
          <Field label="Grade band" value={compensation.grade_band} />
        </Section>
      ) : (
        <section className="rounded-xl border border-dashed border-ink-200 bg-ink-50/40 p-4 text-[12px] text-ink-500">
          Compensation is hidden — you do not have compensation access for this employee.
        </section>
      )}

      {payment_details.canView ? (
        <Section title="Payment details" note="Restricted — finance / own record">
          <Field label="Account holder" value={payment_details.account_holder_name} />
          <Field label="Bank" value={payment_details.bank_name} />
          <Field label="Account / IBAN" value={maskIban(payment_details.account_number_iban)} />
          <Field label="Branch / routing" value={payment_details.routing_sort_branch_code} />
          <Field label="SWIFT / BIC" value={payment_details.swift_bic} />
          <Field label="Currency" value={payment_details.account_currency} />
        </Section>
      ) : (
        <section className="rounded-xl border border-dashed border-ink-200 bg-ink-50/40 p-4 text-[12px] text-ink-500">
          Payment details are hidden — requires finance entitlement (or the employee&apos;s own access).
        </section>
      )}

      <Section title="Position history">
        {assignments.length === 0 ? (
          <p className="text-[13px] text-ink-500 sm:col-span-3">No recorded position assignments.</p>
        ) : (
          <ul className="space-y-2 sm:col-span-3">
            {assignments.map((a) => {
              const start = a.effective_start ? fmtDate(a.effective_start) : null;
              const end = a.effective_end ? fmtDate(a.effective_end) : null;
              const period = a.effective_end === null
                ? (start ? `Since ${start}` : "Current assignment — start date not recorded")
                : (start ? `${start} – ${end}` : `Until ${end}`);
              return (
                <li key={a.id} className="flex items-center justify-between gap-3 rounded-lg border border-ink-100 px-3 py-2">
                  <span className="text-[13px] text-ink-800">{a.position_title ?? "Position"}</span>
                  <span className="text-[12px] text-ink-500">{period}{a.effective_end === null ? " · Current" : ""}</span>
                </li>
              );
            })}
          </ul>
        )}
      </Section>
    </div>
  );
}
