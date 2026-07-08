"use client";

/**
 * Template-pack assign form (Wave 2 — gap audit 2026-05-30, Gap 5).
 *
 * Picks a static pack, pre-fills its tasks (each removable before assign),
 * and submits only the pack id + kept task indexes. The server action
 * re-expands the pack and computes due dates authoritatively from the
 * employee's start/created date — the previews here are UX only.
 */

import { useState } from "react";
import {
  ONBOARDING_TEMPLATE_PACKS,
  computeDueDate,
  dueOffsetLabel,
  getTemplatePack,
} from "@/services/onboardingService/templates";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";
import { assignOnboardingPackAction } from "./actions";

export type AssignPackEmployee = {
  id: string;
  full_name: string;
  role_title: string;
  start_date: string | null;
  created_at: string;
};

function formatDueDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function AssignPackForm({ employees }: { employees: AssignPackEmployee[] }) {
  const [employeeId, setEmployeeId] = useState("");
  const [packId, setPackId] = useState("");
  const [removed, setRemoved] = useState<Set<number>>(new Set());

  const pack = packId ? getTemplatePack(packId) : null;
  const employee = employees.find((e) => e.id === employeeId) ?? null;
  const baseDate = employee ? (employee.start_date ?? employee.created_at) : null;
  const keptIndexes = pack
    ? pack.tasks.map((_, index) => index).filter((index) => !removed.has(index))
    : [];

  function selectPack(nextPackId: string) {
    setPackId(nextPackId);
    setRemoved(new Set());
  }

  function removeTask(index: number) {
    setRemoved((current) => {
      const next = new Set(current);
      next.add(index);
      return next;
    });
  }

  return (
    <form action={assignOnboardingPackAction} className="mt-4 space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="pack_employee_id" className="text-[12px] text-ink-500">Employee</label>
          <select
            id="pack_employee_id"
            name="employee_id"
            required
            value={employeeId}
            onChange={(event) => setEmployeeId(event.target.value)}
            className="rounded-md border border-ink-300 px-3 py-2 text-[14px] bg-white"
          >
            <option value="">Select employee…</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.full_name} — {e.role_title}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="pack_id" className="text-[12px] text-ink-500">Template pack</label>
          <select
            id="pack_id"
            name="pack_id"
            required
            value={packId}
            onChange={(event) => selectPack(event.target.value)}
            className="rounded-md border border-ink-300 px-3 py-2 text-[14px] bg-white"
          >
            <option value="">Select pack…</option>
            {ONBOARDING_TEMPLATE_PACKS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.tasks.length} tasks)
              </option>
            ))}
          </select>
        </div>
      </div>

      {pack ? (
        <div className="rounded-md border border-ink-300/50 bg-ink-100/40 px-4 py-3">
          <p className="text-[13px] text-ink-700">{pack.description}</p>
          {keptIndexes.length === 0 ? (
            <p className="mt-3 text-[13px] text-ink-500">
              All tasks removed. Pick the pack again to start over, or use the single-task form below.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {keptIndexes.map((index) => {
                const task = pack.tasks[index];
                if (!task) return null;
                return (
                  <li
                    key={index}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-ink-300/50 bg-white px-3 py-2"
                  >
                    <input type="hidden" name="task_index" value={index} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] text-ink-900">{task.title}</p>
                      <p className="text-[12px] text-ink-500">
                        {dueOffsetLabel(task.dueOffsetDays)}
                        {baseDate ? ` — due ${formatDueDate(computeDueDate(baseDate, task.dueOffsetDays))}` : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeTask(index)}
                      className="rounded-full border border-ink-300 px-3 py-1 text-[12px] text-ink-700 transition hover:border-ink-900 hover:text-ink-900"
                    >
                      Remove
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-3 text-[12px] text-ink-500">
            {employee
              ? employee.start_date
                ? `Due dates are counted from ${employee.full_name.split(" ")[0]}'s start date.`
                : "This employee has no start date yet — due dates are counted from the day they were added."
              : "Pick an employee to preview due dates."}
          </p>
        </div>
      ) : null}

      <PendingSubmitButton
        idleLabel={keptIndexes.length > 0 ? `Assign ${keptIndexes.length} tasks` : "Assign pack"}
        pendingLabel="Assigning…"
        disabled={!pack || keptIndexes.length === 0}
        className="rounded-full bg-ink-900 px-5 py-2 text-[14px] font-medium text-paper transition hover:bg-ink-700 disabled:cursor-not-allowed disabled:bg-ink-300"
      />
    </form>
  );
}
