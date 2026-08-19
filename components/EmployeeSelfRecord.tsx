import type { EmployeeMasterRecord } from "@/services/employeeMasterService";
import { updateOwnProfileAction, updateOwnPaymentAction, updateOwnPhotoAction } from "@/app/me/actions";
import { StatusPill } from "@/components/StatusPill";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";
import { FileInput } from "@/components/FileInput";

// Employee self-service record. Editable personal/contact/emergency fields submit as a
// SINGLE form (the write path whitelist-updates them together). Work fields are
// employer-controlled and read-only. Missing-data uses a restrained amber cue with a
// lime action — never an error-red treatment.

function initials(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.charAt(0) ?? "") + (p.length > 1 ? p[p.length - 1]?.charAt(0) ?? "" : "")).toUpperCase() || "?";
}
function fmt(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
function maskIban(v: string | null): string {
  if (!v) return "—";
  const t = v.replace(/\s+/g, "");
  return t.length <= 4 ? t : `•••• ${t.slice(-4)}`;
}

const inputCls = "mt-1 w-full rounded-lg border border-ink-300 bg-white px-3 py-2 text-[14px]";
const roCls = "mt-0.5 text-[14px] text-ink-900";

function ReadField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[12px] text-ink-500">{label}</dt>
      <dd className={roCls}>{value === null || value === "" ? <span className="text-ink-400">—</span> : value}</dd>
    </div>
  );
}

// An editable field label that shows a subtle "Add" cue when empty.
function EditLabel({ label, filled }: { label: string; filled: boolean }) {
  return (
    <span className="flex items-center gap-2 text-[13px] text-ink-700">
      {label}
      {!filled ? <StatusPill tone="amber">Add</StatusPill> : null}
    </span>
  );
}

export function EmployeeSelfRecord({ record }: { record: EmployeeMasterRecord }) {
  const { identity, contact, employment, emergency_contact, payment_details } = record;
  const editable = [
    identity.preferred_name, identity.date_of_birth, identity.gender, identity.nationality,
    contact.personal_email, contact.personal_phone, contact.residential_address,
    emergency_contact.name, emergency_contact.relationship, emergency_contact.phone, emergency_contact.email,
  ];
  const missing = editable.filter((v) => !v || (typeof v === "string" && v.trim() === "")).length;

  return (
    <div className="space-y-5">
      {missing > 0 ? (
        <p className="rounded-lg border border-signal-amber/30 bg-signal-amber/10 px-4 py-3 text-[13px] text-signal-amber">
          <span className="font-semibold">{missing}</span> personal detail{missing === 1 ? "" : "s"} still to add. Complete the fields marked <span className="ml-0.5 mr-0.5 inline-flex"><StatusPill tone="amber">Add</StatusPill></span> below.
        </p>
      ) : null}

      {/* Identity + editable personal/contact/emergency — one form */}
      <form action={updateOwnProfileAction} className="space-y-5">
        <section className="rounded-xl border border-ink-200 bg-white/70 p-5">
          <div className="flex items-center gap-4">
            {identity.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={identity.photo_url} alt="" width={56} height={56} className="h-14 w-14 rounded-full object-cover" />
            ) : (
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-ink-100 text-[16px] font-bold text-ink-600">{initials(identity.full_name)}</span>
            )}
            <div>
              <h3 className="text-[16px] font-bold text-ink-900">{identity.full_name}</h3>
              <p className="text-[13px] text-ink-500">{employment.role_title} · {employment.department}</p>
            </div>
          </div>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <ReadField label="Employee number" value={identity.employee_number} />
            <ReadField label="Full / legal name" value={identity.full_name} />
            <label>{<EditLabel label="Preferred name" filled={!!identity.preferred_name} />}<input name="preferred_name" defaultValue={identity.preferred_name ?? ""} className={inputCls} /></label>
            <label>{<EditLabel label="Date of birth" filled={!!identity.date_of_birth} />}<input name="date_of_birth" type="date" defaultValue={identity.date_of_birth ?? ""} className={inputCls} /></label>
            <label>{<EditLabel label="Gender" filled={!!identity.gender} />}
              <select name="gender" defaultValue={identity.gender ?? ""} className={inputCls}>
                <option value="">—</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option><option value="prefer_not_to_say">Prefer not to say</option>
              </select>
            </label>
            <label>{<EditLabel label="Nationality" filled={!!identity.nationality} />}<input name="nationality" defaultValue={identity.nationality ?? ""} className={inputCls} /></label>
          </dl>
        </section>

        <section className="rounded-xl border border-ink-200 bg-white/70 p-5">
          <h3 className="text-[14px] font-bold text-ink-800">Contact</h3>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <label>{<EditLabel label="Personal email" filled={!!contact.personal_email} />}<input name="personal_email" type="email" defaultValue={contact.personal_email ?? ""} className={inputCls} /></label>
            <label>{<EditLabel label="Personal phone" filled={!!contact.personal_phone} />}<input name="mobile" defaultValue={contact.personal_phone ?? ""} className={inputCls} /></label>
            <label className="sm:col-span-2 lg:col-span-1">{<EditLabel label="Residential address" filled={!!contact.residential_address} />}<input name="residential_address" defaultValue={contact.residential_address ?? ""} className={inputCls} /></label>
            <ReadField label="Company email" value={contact.company_email} />
            <ReadField label="Company phone" value={contact.company_phone} />
          </dl>
        </section>

        <section className="rounded-xl border border-ink-200 bg-white/70 p-5">
          <h3 className="text-[14px] font-bold text-ink-800">Emergency contact</h3>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label>{<EditLabel label="Name" filled={!!emergency_contact.name} />}<input name="emergency_contact_name" defaultValue={emergency_contact.name ?? ""} className={inputCls} /></label>
            <label>{<EditLabel label="Relationship" filled={!!emergency_contact.relationship} />}<input name="emergency_contact_relationship" defaultValue={emergency_contact.relationship ?? ""} className={inputCls} /></label>
            <label>{<EditLabel label="Phone" filled={!!emergency_contact.phone} />}<input name="emergency_contact_phone" defaultValue={emergency_contact.phone ?? ""} className={inputCls} /></label>
            <label>{<EditLabel label="Email" filled={!!emergency_contact.email} />}<input name="emergency_contact_email" type="email" defaultValue={emergency_contact.email ?? ""} className={inputCls} /></label>
          </dl>
        </section>

        <PendingSubmitButton idleLabel="Save my details" pendingLabel="Saving…" className="rounded-lg bg-brand-signal px-5 py-2.5 text-[14px] font-medium text-ink-800 disabled:cursor-not-allowed disabled:bg-ink-300" />
      </form>

      {/* Work — employer-controlled, read-only */}
      <section className="rounded-xl border border-ink-200 bg-white/70 p-5">
        <h3 className="text-[14px] font-bold text-ink-800">Work</h3>
        <p className="mt-1 text-[12px] text-ink-500">Managed by your employer. Contact your admin if something looks wrong.</p>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <ReadField label="Role / job title" value={employment.role_title} />
          <ReadField label="Department" value={employment.department} />
          <ReadField label="Country" value={employment.country} />
          <ReadField label="Work location" value={employment.work_location} />
          <ReadField label="Timezone" value={employment.timezone} />
          <ReadField label="Employment type" value={employment.employment_type.replace(/_/g, " ")} />
          <ReadField label="Start date" value={fmt(employment.start_date)} />
          <ReadField label="End date" value={employment.end_date ? fmt(employment.end_date) : null} />
          <ReadField label="Lifecycle / status" value={`${employment.lifecycle_state} · ${employment.status}`} />
          <ReadField label="Working-days override" value={employment.working_days_override ? employment.working_days_override.join(", ") : null} />
          <ReadField label="Leave entitlement override" value={employment.annual_leave_entitlement_override} />
        </dl>
      </section>

      {/* Payment details — own record, editable */}
      <section className="rounded-xl border border-ink-200 bg-white/70 p-5">
        <h3 className="text-[14px] font-bold text-ink-800">Payment details</h3>
        <p className="mt-1 text-[12px] text-ink-500">Your own bank details for payroll. Only you and authorised finance staff can see these.</p>
        <p className="mt-2 text-[12px] text-ink-600">Current account / IBAN: <span className="font-mono">{maskIban(payment_details.account_number_iban)}</span></p>
        <form action={updateOwnPaymentAction} className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-[13px] text-ink-700">Account holder<input name="account_holder_name" defaultValue={payment_details.account_holder_name ?? ""} className={inputCls} /></label>
          <label className="text-[13px] text-ink-700">Bank<input name="bank_name" defaultValue={payment_details.bank_name ?? ""} className={inputCls} /></label>
          <label className="text-[13px] text-ink-700">Account number / IBAN<input name="account_number_iban" defaultValue={payment_details.account_number_iban ?? ""} className={inputCls} /></label>
          <label className="text-[13px] text-ink-700">Branch / routing<input name="routing_sort_branch_code" defaultValue={payment_details.routing_sort_branch_code ?? ""} className={inputCls} /></label>
          <label className="text-[13px] text-ink-700">SWIFT / BIC<input name="swift_bic" defaultValue={payment_details.swift_bic ?? ""} className={inputCls} /></label>
          <label className="text-[13px] text-ink-700">Currency<input name="account_currency" maxLength={3} defaultValue={payment_details.account_currency ?? ""} className={inputCls} placeholder="AED" /></label>
          <div className="sm:col-span-2 lg:col-span-3"><PendingSubmitButton idleLabel="Save payment details" pendingLabel="Saving…" className="rounded-lg border border-ink-300 bg-white px-4 py-2 text-[13px] text-ink-800 hover:border-ink-900 disabled:cursor-not-allowed disabled:text-ink-300" /></div>
        </form>
      </section>

      {/* Profile photo */}
      <section className="rounded-xl border border-ink-200 bg-white/70 p-5">
        <h3 className="text-[14px] font-bold text-ink-800">Profile photo</h3>
        <form action={updateOwnPhotoAction} className="mt-3 flex flex-wrap items-center gap-3" encType="multipart/form-data">
          <FileInput name="photo" accept="image/png,image/jpeg,image/webp" required label={identity.photo_url ? "Change photo" : "Add photo"} />
          <PendingSubmitButton idleLabel="Save" pendingLabel="Uploading…" className="rounded-lg border border-ink-300 bg-white px-3 py-1.5 text-[12px] font-medium text-ink-700 hover:border-ink-900 disabled:cursor-not-allowed disabled:text-ink-300" />
        </form>
      </section>
    </div>
  );
}
