"use client";

import { useState } from "react";
import type { CustomFieldDefinition } from "@/services/customFieldService";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";
import { createCustomFieldAction, toggleCustomFieldAction } from "@/app/setup/custom-field-actions";

const typeLabel = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());

export function PeopleFieldsSettings({ fields }: { fields: CustomFieldDefinition[] }) {
  const [fieldType, setFieldType] = useState("text");

  return (
    <section className="tf-page-section">
      <div className="tf-section-heading">
        <div>
          <h2 className="tf-h2">People fields</h2>
          <p>Add company-specific information to employee records.</p>
        </div>
      </div>

      <div className="tf-edit-panel mt-5">
        <div className="mb-4">
          <h3 className="text-[15px] font-semibold text-ink-900">Configure an employee field</h3>
          <p className="mt-1 text-[13px] text-ink-600">Choose a clear label and the type of information employees or administrators will record.</p>
        </div>
        <form action={createCustomFieldAction} className="grid gap-4 sm:grid-cols-2 sm:items-end">
          <label className="tf-field-label">Field label<input name="label" required className="tf-input mt-1" placeholder="e.g. Professional membership" /></label>
          <label className="tf-field-label">Field type<select name="field_type" className="tf-select mt-1" value={fieldType} onChange={(event) => setFieldType(event.target.value)}><option value="text">Text</option><option value="number">Number</option><option value="date">Date</option><option value="yes_no">Yes / No</option><option value="single_select">Single select</option></select></label>
          {fieldType === "single_select" ? <label className="tf-field-label sm:col-span-2">Choices<input name="choices" required className="tf-input mt-1" placeholder="Option A, Option B" /><span className="mt-1 block text-[12px] font-normal text-ink-500">Separate choices with commas.</span></label> : <input type="hidden" name="choices" value="" />}
          <div className="sm:col-span-2"><PendingSubmitButton idleLabel="Add field" pendingLabel="Adding…" className="tf-primary-action px-4 py-2 text-[13px]" /></div>
        </form>
      </div>

      <div className="tf-config-list mt-6">
        <div className="tf-config-list-header"><span>Configured fields</span><span>{fields.length}</span></div>
        {fields.length === 0 ? <p className="px-4 py-5 text-[13px] text-ink-600">No additional people fields yet.</p> : fields.map((field) => (
          <div key={field.id} className="tf-config-row">
            <div className="min-w-0">
              <p className="text-[14px] font-semibold text-ink-900">{field.label}</p>
              <p className="mt-0.5 text-[12.5px] text-ink-600">{typeLabel(field.field_type)}{field.choices.length > 0 ? ` · ${field.choices.join(", ")}` : ""}</p>
            </div>
            <span className={`tf-state-label ${field.active ? "is-active" : ""}`}>{field.active ? "Active" : "Inactive"}</span>
            <form action={toggleCustomFieldAction}>
              <input type="hidden" name="id" value={field.id} />
              <input type="hidden" name="active" value={String(!field.active)} />
              <PendingSubmitButton idleLabel={field.active ? "Deactivate" : "Reactivate"} pendingLabel="Saving…" className="tf-tertiary-action" />
            </form>
          </div>
        ))}
      </div>
    </section>
  );
}
