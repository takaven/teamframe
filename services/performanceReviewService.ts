import "server-only";
import { z } from "zod";
import type { Actor } from "@/middleware/rbac";
import { createServiceRoleClient } from "@/lib/db/supabaseServer";
import { notifyPerformanceReviewDue } from "@/services/notificationService";

const Question = z.object({ id:z.string().regex(/^q\d+$/), section:z.string().trim().min(1).max(80), prompt:z.string().trim().min(1).max(240), type:z.literal("text"), required:z.boolean() });
const Questions = z.array(Question).min(1).max(12);
const Responses = z.record(z.string(), z.string().trim().max(2000));
// Additive Preview tables are server-only until the generated database snapshot is refreshed.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const serviceDb = () => createServiceRoleClient() as unknown as { from: (table: string) => any };

function tenant(actor: Actor): string { if (!actor.tenantId) throw new Error("NO_TENANT_CONTEXT"); return actor.tenantId; }
function admin(actor: Actor): void { if (actor.role !== "admin") throw new Error("FORBIDDEN"); }

export type PerformanceReview = {
  id: string; cycle_id: string; employee_id: string; reviewer_employee_id: string;
  employee_responses: Record<string,string>; reviewer_responses: Record<string,string>;
  rating: number | null; reviewer_comments: string | null; status: "assigned"|"self_submitted"|"completed"|"acknowledged";
  employee_submitted_at: string|null; reviewer_completed_at: string|null; acknowledged_at: string|null;
  cycle: { name: string; due_date: string; questions_snapshot: z.infer<typeof Question>[]; rating_scale_max_snapshot: number; self_input_enabled:boolean };
};

function validateResponses(questions:z.infer<typeof Questions>,untrusted:unknown):Record<string,string>{
  const parsed=Responses.parse(untrusted);const allowed=new Set(questions.map((question)=>question.id));
  if(Object.keys(parsed).some((key)=>!allowed.has(key)))throw new Error("PERFORMANCE_RESPONSES_INVALID");
  for(const question of questions){if(question.required&&!parsed[question.id]?.trim())throw new Error("PERFORMANCE_RESPONSES_REQUIRED");}
  return parsed;
}

async function audit(actor: Actor, action: string, targetId: string) {
  const result = await serviceDb().from("audit_logs").insert({ tenant_id: tenant(actor), actor_user_id: actor.authUserId, action_type: action, target_id: targetId } as never);
  if (result.error) throw new Error(`AUDIT_LOG_FAILED: ${result.error.message}`);
}

export async function createPerformanceTemplate(actor: Actor, input: unknown): Promise<void> {
  admin(actor); const parsed = z.object({ name:z.string().trim().min(1).max(120), questions:Questions, ratingScaleMax:z.number().int().min(3).max(10) }).parse(input);
  const result = await serviceDb().from("performance_review_templates").insert({ tenant_id:tenant(actor), name:parsed.name, questions:parsed.questions, rating_scale_max:parsed.ratingScaleMax, created_by_user_id:actor.authUserId } as never);
  if (result.error) throw new Error(`PERFORMANCE_TEMPLATE_CREATE_FAILED: ${result.error.message}`);
}

export async function listPerformanceTemplates(actor: Actor): Promise<Array<{id:string;name:string;questions:z.infer<typeof Questions>;rating_scale_max:number;active:boolean}>> {
  admin(actor); const result = await serviceDb().from("performance_review_templates").select("id,name,questions,rating_scale_max,active").eq("tenant_id",tenant(actor)).order("name");
  if (result.error) throw new Error(`PERFORMANCE_TEMPLATE_LIST_FAILED: ${result.error.message}`); return result.data ?? [];
}

export async function setPerformanceTemplateActive(actor:Actor,templateId:string,active:boolean):Promise<void>{admin(actor);const id=z.string().uuid().parse(templateId);const result=await serviceDb().from("performance_review_templates").update({active,updated_at:new Date().toISOString()} as never).eq("tenant_id",tenant(actor)).eq("id",id).select("id").maybeSingle();if(result.error||!result.data)throw new Error("PERFORMANCE_TEMPLATE_NOT_FOUND");await audit(actor,active?"performance.template_activated":"performance.template_deactivated",id);}

export async function createPerformanceCycle(actor: Actor, input: unknown): Promise<void> {
  admin(actor); const parsed = z.object({ templateId:z.string().uuid(), name:z.string().trim().min(1).max(120), dueDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/), employeeIds:z.array(z.string().uuid()).min(1), selfInputEnabled:z.boolean() }).parse(input);
  const db=serviceDb(); const t=tenant(actor);
  const templateQ=await db.from("performance_review_templates").select("id,name,questions,rating_scale_max").eq("tenant_id",t).eq("id",parsed.templateId).eq("active",true).maybeSingle();
  if(templateQ.error||!templateQ.data) throw new Error("PERFORMANCE_TEMPLATE_NOT_FOUND");
  const template=templateQ.data as {id:string;name:string;questions:z.infer<typeof Questions>;rating_scale_max:number};
  Questions.parse(template.questions);
  const employeesQ=await db.from("employees").select("id,manager_id").eq("tenant_id",t).is("deleted_at",null).in("lifecycle_state",["pre_start","active","offboarding"]);
  if(employeesQ.error) throw new Error(`PERFORMANCE_ASSIGNMENT_FAILED: ${employeesQ.error.message}`);
  const selected=new Set(parsed.employeeIds);
  const selectedEmployees=((employeesQ.data??[]) as Array<{id:string;manager_id:string|null}>).filter((employee)=>selected.has(employee.id));
  if(selectedEmployees.length!==selected.size||selectedEmployees.some((employee)=>!employee.manager_id))throw new Error("PERFORMANCE_ASSIGNMENT_MANAGER_REQUIRED");
  const cycleQ=await db.from("performance_review_cycles").insert({tenant_id:t,template_id:template.id,name:parsed.name,due_date:parsed.dueDate,status:"open",template_name_snapshot:template.name,questions_snapshot:template.questions,rating_scale_max_snapshot:template.rating_scale_max,self_input_enabled:parsed.selfInputEnabled,created_by_user_id:actor.authUserId} as never).select("id").single();
  if(cycleQ.error||!cycleQ.data) throw new Error(`PERFORMANCE_CYCLE_CREATE_FAILED: ${cycleQ.error?.message}`);
  const cycleId=(cycleQ.data as {id:string}).id;
  const assignments=selectedEmployees.map((employee)=>({tenant_id:t,cycle_id:cycleId,employee_id:employee.id,reviewer_employee_id:employee.manager_id!}));
  if(assignments.length){const insertQ=await db.from("performance_reviews").insert(assignments as never);if(insertQ.error){await db.from("performance_review_cycles").delete().eq("tenant_id",t).eq("id",cycleId);throw new Error(`PERFORMANCE_ASSIGNMENT_FAILED: ${insertQ.error.message}`);}}
  await audit(actor,"performance.cycle_created",cycleId);
}

export async function listPerformanceReviews(actor: Actor): Promise<PerformanceReview[]> {
  const t=tenant(actor); const db=serviceDb();
  let query=db.from("performance_reviews").select("id,cycle_id,employee_id,reviewer_employee_id,employee_responses,reviewer_responses,rating,reviewer_comments,status,employee_submitted_at,reviewer_completed_at,acknowledged_at,cycle:performance_review_cycles(name,due_date,questions_snapshot,rating_scale_max_snapshot,self_input_enabled)").eq("tenant_id",t).order("created_at",{ascending:false});
  if(actor.role!=="admin") { if(!actor.employeeId) return []; query=query.or(`employee_id.eq.${actor.employeeId},reviewer_employee_id.eq.${actor.employeeId}`); }
  const result=await query; if(result.error)throw new Error(`PERFORMANCE_REVIEW_LIST_FAILED: ${result.error.message}`); return (result.data??[]) as unknown as PerformanceReview[];
}

async function getReview(actor:Actor,id:string){const q=await serviceDb().from("performance_reviews").select("*,cycle:performance_review_cycles(name,due_date,questions_snapshot,rating_scale_max_snapshot,self_input_enabled)").eq("tenant_id",tenant(actor)).eq("id",id).maybeSingle();if(q.error||!q.data)throw new Error("PERFORMANCE_REVIEW_NOT_FOUND");return q.data as unknown as PerformanceReview;}

export async function submitPerformanceSelfReview(actor:Actor,reviewId:string,responses:unknown){if(!actor.employeeId)throw new Error("FORBIDDEN");const review=await getReview(actor,reviewId);if(review.employee_id!==actor.employeeId||review.status!=="assigned"||!review.cycle.self_input_enabled)throw new Error("FORBIDDEN");const parsed=validateResponses(Questions.parse(review.cycle.questions_snapshot),responses);const q=await serviceDb().from("performance_reviews").update({employee_responses:parsed,status:"self_submitted",employee_submitted_at:new Date().toISOString(),updated_at:new Date().toISOString()} as never).eq("tenant_id",tenant(actor)).eq("id",reviewId).eq("status","assigned").select("id").maybeSingle();if(q.error)throw new Error(`PERFORMANCE_REVIEW_SUBMIT_FAILED: ${q.error.message}`);if(!q.data)throw new Error("PERFORMANCE_REVIEW_STATE_INVALID");await audit(actor,"performance.self_submitted",reviewId);}

export async function completePerformanceReview(actor:Actor,reviewId:string,input:unknown){const review=await getReview(actor,reviewId);if(actor.role!=="admin"&&review.reviewer_employee_id!==actor.employeeId)throw new Error("FORBIDDEN");const expectedStatus=review.cycle.self_input_enabled?"self_submitted":"assigned";if(review.status!==expectedStatus)throw new Error("PERFORMANCE_REVIEW_STATE_INVALID");const questions=Questions.parse(review.cycle.questions_snapshot);const parsed=z.object({responses:Responses,rating:z.number().min(1).max(review.cycle.rating_scale_max_snapshot),comments:z.string().trim().max(4000)}).parse(input);const responses=validateResponses(questions,parsed.responses);const q=await serviceDb().from("performance_reviews").update({reviewer_responses:responses,rating:parsed.rating,reviewer_comments:parsed.comments,status:"completed",reviewer_completed_at:new Date().toISOString(),updated_at:new Date().toISOString()} as never).eq("tenant_id",tenant(actor)).eq("id",reviewId).eq("status",expectedStatus).select("id").maybeSingle();if(q.error)throw new Error(`PERFORMANCE_REVIEW_COMPLETE_FAILED: ${q.error.message}`);if(!q.data)throw new Error("PERFORMANCE_REVIEW_STATE_INVALID");await audit(actor,"performance.completed",reviewId);}

export async function acknowledgePerformanceReview(actor:Actor,reviewId:string){if(!actor.employeeId)throw new Error("FORBIDDEN");const review=await getReview(actor,reviewId);if(review.employee_id!==actor.employeeId||review.status!=="completed")throw new Error("FORBIDDEN");const q=await serviceDb().from("performance_reviews").update({status:"acknowledged",acknowledged_at:new Date().toISOString(),updated_at:new Date().toISOString()} as never).eq("tenant_id",tenant(actor)).eq("id",reviewId).eq("status","completed").select("id").maybeSingle();if(q.error)throw new Error(`PERFORMANCE_REVIEW_ACK_FAILED: ${q.error.message}`);if(!q.data)throw new Error("PERFORMANCE_REVIEW_STATE_INVALID");await audit(actor,"performance.acknowledged",reviewId);}

export async function runPerformanceReviewReminders():Promise<number>{
  const db=serviceDb();const today=new Date().toISOString().slice(0,10);
  const cycles=await db.from("performance_review_cycles").select("id,tenant_id,name,self_input_enabled").eq("status","open").lte("due_date",today);
  if(cycles.error)throw new Error(`PERFORMANCE_REMINDER_FAILED: ${cycles.error.message}`);
  const cycleRows=(cycles.data??[]) as Array<{id:string;tenant_id:string;name:string;self_input_enabled:boolean}>;
  if(!cycleRows.length)return 0;
  const cycleById=new Map(cycleRows.map((cycle)=>[cycle.id,cycle]));
  const reviews=await db.from("performance_reviews").select("id,tenant_id,cycle_id,employee_id,reviewer_employee_id,status,employee_reminder_sent_at,reviewer_reminder_sent_at").in("cycle_id",cycleRows.map((cycle)=>cycle.id)).in("status",["assigned","self_submitted"]);
  if(reviews.error)throw new Error(`PERFORMANCE_REMINDER_FAILED: ${reviews.error.message}`);
  let processed=0;
  for(const review of (reviews.data??[]) as Array<{id:string;tenant_id:string;cycle_id:string;employee_id:string;reviewer_employee_id:string;status:"assigned"|"self_submitted";employee_reminder_sent_at:string|null;reviewer_reminder_sent_at:string|null}>){
    const cycle=cycleById.get(review.cycle_id);if(!cycle||cycle.tenant_id!==review.tenant_id)continue;
    const employeeStage=review.status==="assigned"&&cycle.self_input_enabled;
    const sentAt=employeeStage?review.employee_reminder_sent_at:review.reviewer_reminder_sent_at;
    if(sentAt)continue;
    const recipient=employeeStage?review.employee_id:review.reviewer_employee_id;
    const column=employeeStage?"employee_reminder_sent_at":"reviewer_reminder_sent_at";
    await notifyPerformanceReviewDue(review.tenant_id,recipient,review.id,cycle.name,employeeStage?"employee":"reviewer");
    const update=await db.from("performance_reviews").update({[column]:new Date().toISOString()} as never).eq("tenant_id",review.tenant_id).eq("id",review.id).eq("status",review.status).is(column,null).select("id").maybeSingle();
    if(update.error)throw new Error(`PERFORMANCE_REMINDER_FAILED: ${update.error.message}`);if(update.data)processed+=1;
  }
  return processed;
}
