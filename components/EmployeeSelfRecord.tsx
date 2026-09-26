import type { EmployeeMasterRecord } from "@/services/employeeMasterService";
import { DateField } from "@/components/DateField";
import { updateOwnProfileAction, updateOwnPaymentAction, updateOwnPhotoAction } from "@/app/me/actions";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";
import { FileInput } from "@/components/FileInput";
import { getCountryName } from "@/lib/geo/countries";

function fmt(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function maskIban(value: string | null): string {
  if (!value) return "—";
  const trimmed = value.replace(/\s+/g, "");
  return trimmed.length <= 4 ? trimmed : `•••• ${trimmed.slice(-4)}`;
}

function titleCase(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

const inputCls = "mt-1 w-full rounded-lg border border-ink-300 bg-white px-3 py-2 text-[14px]";

function ReadField({ label, value, editable = false }: { label: string; value: React.ReactNode; editable?: boolean }) {
  const empty = value === null || value === undefined || value === "";
  return (
    <div>
      <dt className="text-[12px] text-ink-600">{label}</dt>
      <dd className="mt-1 text-[14px] text-ink-900">
        {empty ? <span className={editable ? "font-medium text-ink-600" : "text-ink-500"}>{editable ? `Add ${label.toLocaleLowerCase()} →` : "Not set"}</span> : value}
      </dd>
    </div>
  );
}

function EditPanel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <details className="tf-profile-edit mt-4">
      <summary className="tf-secondary-action inline-flex cursor-pointer list-none items-center px-3 py-2 text-[12px] font-medium">Edit {label}</summary>
      <div className="mt-4 border-t border-ink-200 pt-4">{children}</div>
    </details>
  );
}

export function EmployeeSelfRecord({ record }: { record: EmployeeMasterRecord }) {
  const { identity, contact, employment, emergency_contact, payment_details } = record;
  const editable = [identity.preferred_name, identity.date_of_birth, identity.gender, identity.nationality, contact.personal_email, contact.personal_phone, contact.residential_address, emergency_contact.name, emergency_contact.relationship, emergency_contact.phone, emergency_contact.email];
  const missing = editable.filter((value) => !value || (typeof value === "string" && value.trim() === "")).length;

  return (
    <div className="space-y-5">
      <p className="tf-profile-completion text-[13px] text-ink-700" role="status">
        {missing === 0 ? "Profile details complete" : <><span className="font-semibold">{missing}</span> profile detail{missing === 1 ? "" : "s"} missing</>}
      </p>

      <section className="tf-profile-section">
        <h3 className="text-[15px] font-semibold text-ink-900">Personal &amp; contact</h3>
        <p className="mt-1 text-[12px] text-ink-600">Your personal details and the best ways to reach you.</p>
        <dl className="mt-5 grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
          <ReadField label="Employee number" value={identity.employee_number} />
          <ReadField label="Full / legal name" value={identity.full_name} />
          <ReadField label="Preferred name" value={identity.preferred_name} editable />
          <ReadField label="Date of birth" value={identity.date_of_birth ? fmt(identity.date_of_birth) : null} editable />
          <ReadField label="Gender" value={identity.gender ? titleCase(identity.gender) : null} editable />
          <ReadField label="Nationality" value={identity.nationality} editable />
          <ReadField label="Personal email" value={contact.personal_email} editable />
          <ReadField label="Personal phone" value={contact.personal_phone} editable />
          <ReadField label="Residential address" value={contact.residential_address} editable />
          <ReadField label="Company email" value={contact.company_email} />
          <ReadField label="Company phone" value={contact.company_phone} />
        </dl>
        <EditPanel label="personal & contact details">
          <form action={updateOwnProfileAction} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <label className="text-[13px] text-ink-700">Preferred name<input name="preferred_name" defaultValue={identity.preferred_name ?? ""} className={inputCls} /></label>
            <label className="text-[13px] text-ink-700">Date of birth<DateField name="date_of_birth" defaultValue={identity.date_of_birth ?? ""} /></label>
            <label className="text-[13px] text-ink-700">Gender<select name="gender" defaultValue={identity.gender ?? ""} className={inputCls}><option value="">—</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option><option value="prefer_not_to_say">Prefer not to say</option></select></label>
            <label className="text-[13px] text-ink-700">Nationality<input name="nationality" defaultValue={identity.nationality ?? ""} className={inputCls} /></label>
            <label className="text-[13px] text-ink-700">Personal email<input name="personal_email" type="email" defaultValue={contact.personal_email ?? ""} className={inputCls} /></label>
            <label className="text-[13px] text-ink-700">Personal phone<input name="mobile" defaultValue={contact.personal_phone ?? ""} className={inputCls} /></label>
            <label className="text-[13px] text-ink-700 sm:col-span-2 lg:col-span-3">Residential address<input name="residential_address" defaultValue={contact.residential_address ?? ""} className={inputCls} /></label>
            <input type="hidden" name="emergency_contact_name" value={emergency_contact.name ?? ""} />
            <input type="hidden" name="emergency_contact_relationship" value={emergency_contact.relationship ?? ""} />
            <input type="hidden" name="emergency_contact_phone" value={emergency_contact.phone ?? ""} />
            <input type="hidden" name="emergency_contact_email" value={emergency_contact.email ?? ""} />
            <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-3"><PendingSubmitButton idleLabel="Save personal details" pendingLabel="Saving…" className="tf-primary-action px-5 py-2.5 text-[14px]" /><span className="text-[12px] text-ink-600">Close this section to cancel unsaved changes.</span></div>
          </form>
        </EditPanel>
      </section>

      <section className="tf-profile-section">
        <h3 className="text-[15px] font-semibold text-ink-900">Emergency contact</h3>
        <dl className="mt-5 grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
          <ReadField label="Name" value={emergency_contact.name} editable />
          <ReadField label="Relationship" value={emergency_contact.relationship} editable />
          <ReadField label="Phone" value={emergency_contact.phone} editable />
          <ReadField label="Email" value={emergency_contact.email} editable />
        </dl>
        <EditPanel label="emergency contact">
          <form action={updateOwnProfileAction} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <input type="hidden" name="preferred_name" value={identity.preferred_name ?? ""} /><input type="hidden" name="date_of_birth" value={identity.date_of_birth ?? ""} /><input type="hidden" name="gender" value={identity.gender ?? ""} /><input type="hidden" name="nationality" value={identity.nationality ?? ""} /><input type="hidden" name="personal_email" value={contact.personal_email ?? ""} /><input type="hidden" name="mobile" value={contact.personal_phone ?? ""} /><input type="hidden" name="residential_address" value={contact.residential_address ?? ""} />
            <label className="text-[13px] text-ink-700">Name<input name="emergency_contact_name" defaultValue={emergency_contact.name ?? ""} className={inputCls} /></label>
            <label className="text-[13px] text-ink-700">Relationship<input name="emergency_contact_relationship" defaultValue={emergency_contact.relationship ?? ""} className={inputCls} /></label>
            <label className="text-[13px] text-ink-700">Phone<input name="emergency_contact_phone" defaultValue={emergency_contact.phone ?? ""} className={inputCls} /></label>
            <label className="text-[13px] text-ink-700">Email<input name="emergency_contact_email" type="email" defaultValue={emergency_contact.email ?? ""} className={inputCls} /></label>
            <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-4"><PendingSubmitButton idleLabel="Save emergency contact" pendingLabel="Saving…" className="tf-primary-action px-5 py-2.5 text-[14px]" /><span className="text-[12px] text-ink-600">Close this section to cancel unsaved changes.</span></div>
          </form>
        </EditPanel>
      </section>

      <section className="tf-profile-section tf-profile-work">
        <h3 className="text-[15px] font-semibold text-ink-900">Work</h3>
        <p className="mt-1 text-[12px] text-ink-600">Managed by your employer. Contact your admin if something looks wrong.</p>
        <dl className="mt-5 grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
          <ReadField label="Role / job title" value={employment.role_title} /><ReadField label="Department" value={employment.department} /><ReadField label="Country" value={getCountryName(employment.country) ?? employment.country} /><ReadField label="Work location" value={employment.work_location} /><ReadField label="Timezone" value={employment.timezone} /><ReadField label="Employment type" value={titleCase(employment.employment_type)} /><ReadField label="Start date" value={fmt(employment.start_date)} /><ReadField label="End date" value={employment.end_date ? fmt(employment.end_date) : null} />
        </dl>
      </section>

      <section className="tf-profile-section">
        <h3 className="text-[15px] font-semibold text-ink-900">Payment details</h3>
        <p className="mt-1 text-[12px] text-ink-600">Only you and authorised finance staff can see these details.</p>
        <dl className="mt-5 grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
          <ReadField label="Account holder" value={payment_details.account_holder_name} editable /><ReadField label="Bank" value={payment_details.bank_name} editable /><ReadField label="Account / IBAN" value={payment_details.account_number_iban ? maskIban(payment_details.account_number_iban) : null} editable /><ReadField label="Branch / routing" value={payment_details.routing_sort_branch_code} editable /><ReadField label="SWIFT / BIC" value={payment_details.swift_bic} editable /><ReadField label="Currency" value={payment_details.account_currency} editable />
        </dl>
        <EditPanel label="payment details">
          <form action={updateOwnPaymentAction} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <label className="text-[13px] text-ink-700">Account holder<input name="account_holder_name" defaultValue={payment_details.account_holder_name ?? ""} className={inputCls} /></label><label className="text-[13px] text-ink-700">Bank<input name="bank_name" defaultValue={payment_details.bank_name ?? ""} className={inputCls} /></label><label className="text-[13px] text-ink-700">Account number / IBAN<input name="account_number_iban" defaultValue={payment_details.account_number_iban ?? ""} className={inputCls} /></label><label className="text-[13px] text-ink-700">Branch / routing<input name="routing_sort_branch_code" defaultValue={payment_details.routing_sort_branch_code ?? ""} className={inputCls} /></label><label className="text-[13px] text-ink-700">SWIFT / BIC<input name="swift_bic" defaultValue={payment_details.swift_bic ?? ""} className={inputCls} /></label><label className="text-[13px] text-ink-700">Currency<input name="account_currency" maxLength={3} defaultValue={payment_details.account_currency ?? ""} className={inputCls} placeholder="AED" /></label>
            <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-3"><PendingSubmitButton idleLabel="Save payment details" pendingLabel="Saving…" className="tf-primary-action px-5 py-2.5 text-[14px]" /><span className="text-[12px] text-ink-600">Close this section to cancel unsaved changes.</span></div>
          </form>
        </EditPanel>
      </section>

      <section className="tf-profile-section">
        <h3 className="text-[15px] font-semibold text-ink-900">Profile photo</h3>
        <details className="tf-profile-edit mt-4"><summary className="tf-secondary-action inline-flex cursor-pointer list-none items-center px-3 py-2 text-[12px] font-medium">{identity.photo_url ? "Change photo" : "Add photo"}</summary><form action={updateOwnPhotoAction} className="mt-4 flex flex-wrap items-center gap-3 border-t border-ink-200 pt-4" encType="multipart/form-data"><FileInput name="photo" accept="image/png,image/jpeg,image/webp" required label={identity.photo_url ? "Choose a new photo" : "Choose a photo"} /><PendingSubmitButton idleLabel="Save photo" pendingLabel="Uploading…" className="tf-primary-action px-4 py-2 text-[13px]" /></form></details>
      </section>
    </div>
  );
}
