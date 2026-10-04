"use client";

import { useState } from "react";
import type { LeaveDefinition } from "@/services/configurationService";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";
import { createLeaveDefinitionAction, updateLeaveDefinitionAction } from "@/app/setup/actions";

const human = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());

export function LeaveDefinitionsSettings({ definitions }: { definitions: LeaveDefinition[] }) {
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <section className="tf-page-section">
      <div className="tf-section-heading">
        <div><h2 className="tf-h2">Leave types</h2><p>Set entitlement, accrual, carry-forward, counting and evidence rules. These are company policy settings, not statutory advice.</p></div>
        <button type="button" className="tf-secondary-action px-3 py-2 text-[12.5px]" onClick={() => setEditing(editing === "new" ? null : "new")}>{editing === "new" ? "Cancel" : "Add leave type"}</button>
      </div>

      {editing === "new" ? (
        <div className="tf-edit-panel mt-5">
          <h3 className="text-[15px] font-semibold text-ink-900">New leave type</h3>
          <form action={createLeaveDefinitionAction} className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="tf-field-label">Display name<input name="display_name" required className="tf-input mt-1" placeholder="Maternity leave" /></label>
            <label className="tf-field-label">Category<select name="system_leave_type" defaultValue="other" className="tf-select mt-1"><option value="annual">Annual</option><option value="sick">Sick</option><option value="unpaid">Unpaid</option><option value="other">Other</option></select></label>
            <label className="tf-field-label">Default entitlement (days)<input name="default_entitlement_days" type="number" min="0" max="365" className="tf-input mt-1" /></label>
            <label className="tf-field-label">Counting basis<select name="counting_basis" defaultValue="working_days" className="tf-select mt-1"><option value="working_days">Working days</option><option value="calendar_days">Calendar days</option></select></label>
            <label className="tf-field-label">Supporting document<select name="attachment_requirement" defaultValue="not_required" className="tf-select mt-1"><option value="not_required">Not required</option><option value="optional">Optional</option><option value="required">Required</option></select></label>
            <label className="tf-toggle"><input type="checkbox" name="accrual_enabled" /><span aria-hidden="true" /><strong>Accrue entitlement</strong></label>
            <label className="tf-field-label">Accrual frequency<select name="accrual_frequency" defaultValue="monthly" className="tf-select mt-1"><option value="monthly">Monthly</option><option value="annual">Annual</option></select></label>
            <label className="tf-toggle"><input type="checkbox" name="joining_date_pro_rata" /><span aria-hidden="true" /><strong>Pro-rate from joining date</strong></label>
            <label className="tf-toggle"><input type="checkbox" name="carry_forward_enabled" /><span aria-hidden="true" /><strong>Allow carry-forward</strong></label>
            <label className="tf-field-label">Carry-forward cap (days)<input name="carry_forward_cap_days" type="number" min="0" max="365" step="0.5" className="tf-input mt-1" /></label>
            <label className="tf-toggle"><input type="checkbox" name="active" defaultChecked /><span aria-hidden="true" /><strong>Active</strong></label>
            <div className="sm:col-span-2"><PendingSubmitButton idleLabel="Add leave type" pendingLabel="Adding…" className="tf-primary-action px-4 py-2 text-[13px]" /></div>
          </form>
        </div>
      ) : null}

      <div className="tf-config-list mt-5">
        {definitions.map((definition) => {
          const isEditing = editing === definition.id;
          return (
            <div key={definition.id} className="tf-config-item">
              <div className="tf-config-row">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><p className="text-[14px] font-semibold text-ink-900">{definition.display_name}</p>{definition.is_system ? <span className="tf-system-label">System</span> : null}</div>
                  <p className="mt-1 text-[12.5px] text-ink-600">{definition.default_entitlement_days ?? "No default"} {definition.default_entitlement_days === 1 ? "day" : "days"} · {definition.accrual_enabled ? `${human(definition.accrual_frequency)} accrual` : "Granted upfront"} · {definition.carry_forward_enabled ? `Carry up to ${definition.carry_forward_cap_days ?? "available"} days` : "No carry-forward"} · {human(definition.counting_basis)} · Document: {human(definition.attachment_requirement)}</p>
                </div>
                <span className={`tf-state-label ${definition.active ? "is-active" : ""}`}>{definition.active ? "Active" : "Inactive"}</span>
                <button type="button" className="tf-tertiary-action" aria-expanded={isEditing} aria-controls={`leave-editor-${definition.id}`} onClick={() => setEditing(isEditing ? null : definition.id)}>{isEditing ? "Cancel" : "Edit"}</button>
              </div>
              {isEditing ? (
                <form id={`leave-editor-${definition.id}`} action={updateLeaveDefinitionAction} className="tf-edit-panel mx-3 mb-3 grid gap-4 sm:grid-cols-2">
                  <input type="hidden" name="id" value={definition.id} />
                  <input type="hidden" name="system_leave_type" value={definition.system_leave_type} />
                  {definition.is_system ? <><input type="hidden" name="display_name" value={definition.display_name} /><div><span className="tf-field-label">Leave type</span><p className="mt-2 text-[14px] font-semibold text-ink-900">{definition.display_name} <span className="tf-system-label ml-2">System</span></p></div></> : <label className="tf-field-label">Leave type<input name="display_name" defaultValue={definition.display_name} className="tf-input mt-1" /></label>}
                  <label className="tf-field-label">Default entitlement (days)<input name="default_entitlement_days" type="number" min="0" max="365" defaultValue={definition.default_entitlement_days ?? ""} className="tf-input mt-1" /></label>
                  <label className="tf-field-label">Counting basis<select name="counting_basis" defaultValue={definition.counting_basis} className="tf-select mt-1"><option value="working_days">Working days</option><option value="calendar_days">Calendar days</option></select></label>
                  <label className="tf-field-label">Supporting document<select name="attachment_requirement" defaultValue={definition.attachment_requirement} className="tf-select mt-1"><option value="not_required">Not required</option><option value="optional">Optional</option><option value="required">Required</option></select></label>
                  <label className="tf-toggle"><input type="checkbox" name="accrual_enabled" defaultChecked={definition.accrual_enabled} /><span aria-hidden="true" /><strong>Accrue entitlement</strong></label>
                  <label className="tf-field-label">Accrual frequency<select name="accrual_frequency" defaultValue={definition.accrual_frequency} className="tf-select mt-1"><option value="monthly">Monthly</option><option value="annual">Annual</option></select></label>
                  <label className="tf-toggle"><input type="checkbox" name="joining_date_pro_rata" defaultChecked={definition.joining_date_pro_rata} /><span aria-hidden="true" /><strong>Pro-rate from joining date</strong></label>
                  <label className="tf-toggle"><input type="checkbox" name="carry_forward_enabled" defaultChecked={definition.carry_forward_enabled} /><span aria-hidden="true" /><strong>Allow carry-forward</strong></label>
                  <label className="tf-field-label">Carry-forward cap (days)<input name="carry_forward_cap_days" type="number" min="0" max="365" step="0.5" defaultValue={definition.carry_forward_cap_days ?? ""} className="tf-input mt-1" /></label>
                  <label className="tf-toggle"><input type="checkbox" name="active" defaultChecked={definition.active} /><span aria-hidden="true" /><strong>Active</strong></label>
                  <div className="sm:col-span-2"><PendingSubmitButton idleLabel="Save leave type" pendingLabel="Saving…" className="tf-primary-action px-4 py-2 text-[13px]" /></div>
                </form>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
