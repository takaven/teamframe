import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
const root=process.cwd();
const schema=readFileSync(join(root,"schemas","20261004_performance_reviews.sql"),"utf8");
const service=readFileSync(join(root,"services","performanceReviewService.ts"),"utf8");
const page=readFileSync(join(root,"app","performance","page.tsx"),"utf8");
const people=readFileSync(join(root,"components","PeopleExperience.tsx"),"utf8");
const automation=readFileSync(join(root,"app","api","automation","run","route.ts"),"utf8");

describe("M4 lightweight performance reviews",()=>{
  it("snapshots templates into cycles and assigns each employee once",()=>{expect(schema).toContain("questions_snapshot jsonb not null");expect(schema).toContain("rating_scale_max_snapshot");expect(schema).toContain("unique(cycle_id, employee_id)");expect(service).toContain("template_name_snapshot");});
  it("enforces the bounded state machine and exact actors",()=>{for(const state of ["assigned","self_submitted","completed","acknowledged"])expect(schema).toContain(state);expect(service).toContain('review.employee_id!==actor.employeeId');expect(service).toContain('review.reviewer_employee_id!==actor.employeeId');expect(service).toContain("PERFORMANCE_REVIEW_STATE_INVALID");});
  it("keeps confidential review rows limited to admin, employee, and assigned reviewer",()=>{expect(schema).toContain("current_actor_employee_id(tenant_id) in (employee_id, reviewer_employee_id)");expect(schema).toContain("performance_reviews_no_direct_write");expect(service).toContain('query.or(`employee_id.eq.${actor.employeeId},reviewer_employee_id.eq.${actor.employeeId}`)');});
  it("supports self input, manager feedback, rating, completion and acknowledgement",()=>{expect(page).toContain("Submit self-review");expect(page).toContain("Complete review");expect(page).toContain("Acknowledge");expect(service).toContain("rating_scale_max_snapshot");});
  it("keeps employee and reviewer reminders independently idempotent and does not add goals",()=>{expect(service).toContain('employee_reminder_sent_at');expect(service).toContain('reviewer_reminder_sent_at');expect(service).toContain('reviewer_employee_id');expect(schema).not.toContain("performance_goals");});
  it("keeps template/cycle foreign keys tenant-bound",()=>{expect(schema).toContain("performance_review_cycles_template_fk");expect(schema).toContain("performance_reviews_cycle_fk");expect(schema).toContain("foreign key(tenant_id,cycle_id)");});
  it("surfaces completed review history and bounded reporting",()=>{expect(people).toContain("Performance review ·");for(const label of ["Due","Overdue","Completed","Average rating"])expect(page).toContain(label);});
  it("explains the existing three-step workflow without adding another interface",()=>{for(const label of ["1. Choose a template","2. Start a cycle","3. Complete and acknowledge"])expect(page).toContain(label);expect(page).toContain("Performance :: What went well?");expect(page).toContain("[optional] Development :: What support would help?");expect(page).toContain("sm:grid-cols-3");});
  it("identifies admin review records and maps stored states to human stages",()=>{for(const label of ["Employee:","Reviewer:","Cycle:","Awaiting employee","Awaiting manager","Completed","Acknowledged"])expect(page).toContain(label);expect(page).toContain("employeeNameById");expect(page).not.toContain('review.status.replaceAll("_", " ")');});
  it("preserves progressive disclosure and the existing status model",()=>{expect(page).toContain('<details className="tf-surface-flat p-5">');for(const state of ["assigned","self_submitted","completed","acknowledged"])expect(service).toContain(state);expect(schema).not.toContain("performance_review_drafts");});
  it("runs idempotent reminders through the existing daily automation route",()=>{expect(service).toContain("notifyPerformanceReviewDue");expect(service).toContain("runPerformanceReviewReminders");expect(automation).toContain("runPerformanceReviewReminders");});
});
