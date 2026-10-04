import { AppShell } from "@/components/AppShell";
import { DateField } from "@/components/DateField";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";
import { requireTenantActor } from "@/middleware/rbac";
import { listPerformanceReviews, listPerformanceTemplates } from "@/services/performanceReviewService";
import { listEmployeesForAdmin } from "@/services/employeeService";
import { acknowledgePerformanceReviewAction, completePerformanceReviewAction, createPerformanceCycleAction, createPerformanceTemplateAction, setPerformanceTemplateActiveAction, submitPerformanceSelfReviewAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function PerformancePage({ searchParams }: { searchParams: Promise<{ status?: string; error?: string }> }) {
  const actor = await requireTenantActor();
  const params = await searchParams;
  const [reviews, templates, employees] = await Promise.all([
    listPerformanceReviews(actor),
    actor.role === "admin" ? listPerformanceTemplates(actor) : Promise.resolve([]),
    actor.role === "admin" ? listEmployeesForAdmin(actor) : Promise.resolve([]),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  const completed = reviews.filter((review) => ["completed", "acknowledged"].includes(review.status));
  const average = completed.length ? completed.reduce((total, review) => total + (review.rating ?? 0), 0) / completed.length : null;

  return <main className="mx-auto max-w-5xl px-6 py-14">
    <AppShell actor={actor} activePath="/performance" />
    <header className="border-b border-ink-300/60 pb-5"><p className="text-[12px] tracking-[0.14em] text-ink-500">People development</p><h1 className="mt-2 text-[34px] tracking-tight">Performance reviews</h1><p className="mt-1 text-[14px] text-ink-500">Lightweight review cycles with private manager feedback and employee acknowledgement.</p></header>
    {params.status ? <p role="status" className="mt-5 text-signal-green">Saved.</p> : null}
    {params.error ? <p role="alert" className="mt-5 text-signal-red">The review action could not be completed.</p> : null}
    {actor.role === "admin" ? <section aria-label="Review reporting" className="tf-value-strip mt-6">
      <div className="tf-value-cell"><p className="tf-value-label">Due</p><p className="tf-value-text">{reviews.filter((review) => !["completed", "acknowledged"].includes(review.status) && review.cycle.due_date >= today).length}</p></div>
      <div className="tf-value-cell"><p className="tf-value-label">Overdue</p><p className="tf-value-text">{reviews.filter((review) => !["completed", "acknowledged"].includes(review.status) && review.cycle.due_date < today).length}</p></div>
      <div className="tf-value-cell"><p className="tf-value-label">Completed</p><p className="tf-value-text">{completed.length}</p></div>
      <div className="tf-value-cell"><p className="tf-value-label">Average rating</p><p className="tf-value-text">{average === null ? "—" : average.toFixed(1)}</p></div>
    </section> : null}
    {actor.role === "admin" ? <>
      <section className="mt-7 grid gap-5 lg:grid-cols-2">
        <form action={createPerformanceTemplateAction} className="tf-surface-flat grid gap-3 p-5">
          <h2 className="tf-h2">Review template</h2>
          <label className="text-[12px] text-ink-500">Name<input name="name" required maxLength={120} className="tf-input mt-1" /></label>
          <label className="text-[12px] text-ink-500">Questions (one per line; use Section :: Question and prefix [optional] where needed)<textarea name="questions" required className="tf-input mt-1 min-h-28" /></label>
          <label className="text-[12px] text-ink-500">Rating scale<input name="rating_scale_max" type="number" min="3" max="10" defaultValue="5" className="tf-input mt-1" /></label>
          <PendingSubmitButton idleLabel="Create template" pendingLabel="Creating…" className="tf-primary-action px-4 py-2" />
        </form>
        <form action={createPerformanceCycleAction} className="tf-surface-flat grid gap-3 p-5">
          <h2 className="tf-h2">Open review cycle</h2>
          <label className="text-[12px] text-ink-500">Cycle name<input name="name" required maxLength={120} className="tf-input mt-1" /></label>
          <label className="text-[12px] text-ink-500">Template<select name="template_id" required className="tf-select mt-1">{templates.filter((template) => template.active).map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></label>
          <label className="text-[12px] text-ink-500">Due date<DateField name="due_date" required /></label>
          <fieldset><legend className="text-[12px] text-ink-500">People with a manager</legend><div className="mt-2 max-h-40 space-y-2 overflow-y-auto">{employees.filter((employee) => employee.manager_id).map((employee) => <label key={employee.id} className="flex items-center gap-2 text-[13px]"><input type="checkbox" name="employee_id" value={employee.id} />{employee.full_name}</label>)}</div></fieldset>
          <label className="flex items-center gap-2 text-[12px] text-ink-600"><input type="checkbox" name="self_input_enabled" value="true" defaultChecked />Require employee self input before manager completion</label>
          <p className="text-[12px] text-ink-500">Selected employees are assigned to their recorded direct manager. Template and self-input settings are frozen with the cycle.</p>
          <PendingSubmitButton idleLabel="Open cycle" pendingLabel="Opening…" className="tf-primary-action px-4 py-2" />
        </form>
      </section>
      <section className="tf-surface-flat mt-5 p-5"><h2 className="tf-h2">Templates</h2><ul className="mt-3 divide-y divide-ink-100">{templates.map((template) => <li key={template.id} className="flex items-center justify-between gap-3 py-3 text-[13px]"><span><strong>{template.name}</strong> · {template.questions.length} questions · {template.rating_scale_max}-point scale · {template.active ? "Active" : "Inactive"}</span><form action={setPerformanceTemplateActiveAction}><input type="hidden" name="template_id" value={template.id} /><input type="hidden" name="active" value={template.active ? "false" : "true"} /><PendingSubmitButton idleLabel={template.active ? "Deactivate" : "Activate"} pendingLabel="Saving…" className="tf-secondary-action px-3 py-1.5 text-[12px]" /></form></li>)}</ul></section>
    </> : null}
    <section className="mt-7 space-y-4"><h2 className="tf-h2">Your reviews</h2>{reviews.length === 0 ? <p className="tf-surface-flat p-5 text-ink-500">No reviews assigned.</p> : reviews.map((review) => {
      const employeeOwn = actor.employeeId === review.employee_id;
      const reviewer = actor.role === "admin" || actor.employeeId === review.reviewer_employee_id;
      const managerReady = review.cycle.self_input_enabled ? review.status === "self_submitted" : review.status === "assigned";
      return <article key={review.id} className="tf-surface-flat p-5">
        <div className="flex flex-wrap justify-between gap-3"><div><h3 className="font-semibold">{review.cycle.name}</h3><p className="text-[12px] text-ink-500">Due {review.cycle.due_date} · {review.status.replaceAll("_", " ")}</p></div>{review.status === "completed" && employeeOwn ? <form action={acknowledgePerformanceReviewAction}><input type="hidden" name="review_id" value={review.id} /><PendingSubmitButton idleLabel="Acknowledge" pendingLabel="Saving…" className="tf-secondary-action px-3 py-2" /></form> : null}</div>
        {employeeOwn && review.status === "assigned" && review.cycle.self_input_enabled ? <form action={submitPerformanceSelfReviewAction} className="mt-4 grid gap-3"><input type="hidden" name="review_id" value={review.id} />{review.cycle.questions_snapshot.map((question) => <label key={question.id} className="text-[12px] text-ink-600"><span className="font-medium">{question.section}</span> · {question.prompt}<textarea name={`answer_${question.id}`} required={question.required} className="tf-input mt-1 min-h-20" /></label>)}<PendingSubmitButton idleLabel="Submit self-review" pendingLabel="Submitting…" className="tf-primary-action px-4 py-2" /></form> : null}
        {reviewer && managerReady ? <form action={completePerformanceReviewAction} className="mt-4 grid gap-3"><input type="hidden" name="review_id" value={review.id} />{review.cycle.questions_snapshot.map((question) => <label key={question.id} className="text-[12px] text-ink-600"><span className="font-medium">{question.section}</span> · {question.prompt}<textarea name={`answer_${question.id}`} required={question.required} className="tf-input mt-1 min-h-20" /></label>)}<label className="text-[12px] text-ink-600">Overall rating<input name="rating" type="number" min="1" max={review.cycle.rating_scale_max_snapshot} step="0.5" required className="tf-input mt-1" /></label><label className="text-[12px] text-ink-600">Overall comments<textarea name="comments" maxLength={4000} className="tf-input mt-1 min-h-24" /></label><PendingSubmitButton idleLabel="Complete review" pendingLabel="Completing…" className="tf-primary-action px-4 py-2" /></form> : null}
        {["completed", "acknowledged"].includes(review.status) ? <div className="mt-4 rounded-lg bg-ink-50 p-4 text-[13px]"><p><strong>Rating:</strong> {review.rating ?? "—"} / {review.cycle.rating_scale_max_snapshot}</p><p className="mt-2 whitespace-pre-wrap">{review.reviewer_comments}</p></div> : null}
      </article>;
    })}</section>
  </main>;
}
