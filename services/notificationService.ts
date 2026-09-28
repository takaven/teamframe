import "server-only";
/* eslint-disable @typescript-eslint/no-explicit-any -- the generated Supabase schema types do not include the versioned ledger until regeneration; all rows are narrowed below. */
import { createServiceRoleClient } from "@/lib/db/supabaseServer";
import { env } from "@/lib/db/env";
import { loadControlCentreData } from "@/app/dashboard/data";
import { getManagerDashboard } from "@/services/managerService";
import type { Actor } from "@/middleware/rbac";

export type NotificationType = "document_action" | "task_assignment" | "leave_action" | "policy_acknowledgement" | "probation_check_in" | "offboarding" | "daily_digest";
export type NotificationInput = { tenantId: string; recipientEmployeeId?: string | null; recipientEmail?: string | null; type: NotificationType; eventKey: string; subject: string; text: string; actionPath: string; relatedEntityType?: string; relatedEntityId?: string | null };
type DeliveryRow = { id: string; tenant_id: string; recipient_employee_id: string | null; recipient_email: string | null; notification_type: NotificationType; event_key: string; related_entity_type: string | null; related_entity_id: string | null; action_path: string | null; status: "pending" | "sent" | "failed" | "skipped"; provider_message_id: string | null; attempt_count: number; last_error_summary: string | null };

function safeError(error: unknown): string {
  const message = error instanceof Error ? error.message : "Delivery failed";
  return message.replace(/[\r\n]+/g, " ").slice(0, 240);
}
function absolute(path: string): string { return new URL(path, env.siteUrl).toString(); }
function html(input: NotificationInput): string {
  const safe = (value: string) => value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
  return `<div style="font-family:Arial,sans-serif;max-width:560px;color:#20242b"><h1 style="font-size:22px">${safe(input.subject)}</h1><p style="line-height:1.5">${safe(input.text)}</p><p><a href="${safe(absolute(input.actionPath))}" style="display:inline-block;padding:10px 16px;border:2px solid #20242b;border-radius:8px;color:#20242b;text-decoration:none;font-weight:700">Open TeamFrame</a></p><p style="font-size:12px;color:#667085">Sign in normally to view the authorised record. Sensitive details are not included in this email.</p></div>`;
}

async function resolveEmail(input: NotificationInput): Promise<string | null> {
  if (input.recipientEmail) return input.recipientEmail.trim().toLowerCase();
  if (!input.recipientEmployeeId) return null;
  const db: any = createServiceRoleClient();
  const { data, error } = await db.from("employees").select("email").eq("tenant_id", input.tenantId).eq("id", input.recipientEmployeeId).maybeSingle();
  if (error) throw new Error(`NOTIFICATION_RECIPIENT_FAILED: ${error.message}`);
  return (data as { email?: string } | null)?.email?.trim().toLowerCase() ?? null;
}

async function transport(input: NotificationInput, email: string): Promise<string> {
  const domain = email.split("@").at(-1) ?? "";
  if (domain === "localhost" || /(?:^|\.)(?:invalid|example|test)$/.test(domain)) return `preview-sink:${crypto.randomUUID()}`;
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.TEAMFRAME_EMAIL_FROM;
  if (!apiKey || !from) throw new Error("EMAIL_NOT_CONFIGURED");
  const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json", "idempotency-key": input.eventKey }, body: JSON.stringify({ from, to: [email], subject: input.subject, text: `${input.text}\n\nOpen TeamFrame: ${absolute(input.actionPath)}`, html: html(input) }) });
  if (!response.ok) throw new Error(`EMAIL_PROVIDER_${response.status}`);
  const payload = await response.json() as { id?: string };
  return payload.id ?? "provider-accepted";
}

export async function deliverNotification(input: NotificationInput): Promise<{ status: DeliveryRow["status"]; id: string | null }> {
  const db: any = createServiceRoleClient();
  let email: string | null = null;
  try { email = await resolveEmail(input); } catch { email = null; }
  const { data: existing } = await db.from("notification_deliveries").select("*").eq("tenant_id", input.tenantId).eq("event_key", input.eventKey).maybeSingle();
  if (existing) return { status: (existing as DeliveryRow).status, id: (existing as DeliveryRow).id };
  const initialStatus = email ? "pending" : "skipped";
  const { data, error } = await db.from("notification_deliveries").insert({ tenant_id: input.tenantId, recipient_employee_id: input.recipientEmployeeId ?? null, recipient_email: email, notification_type: input.type, event_key: input.eventKey, related_entity_type: input.relatedEntityType ?? null, related_entity_id: input.relatedEntityId ?? null, action_path: input.actionPath, status: initialStatus, last_error_summary: email ? null : "No valid recipient email" }).select("*").single();
  if (error) { if (error.code === "23505") return { status: "sent", id: null }; throw new Error(`NOTIFICATION_LEDGER_FAILED: ${error.message}`); }
  const row = data as DeliveryRow;
  if (!email) return { status: "skipped", id: row.id };
  try {
    const providerId = await transport(input, email);
    await db.from("notification_deliveries").update({ status: "sent", provider_message_id: providerId, attempt_count: row.attempt_count + 1, attempted_at: new Date().toISOString(), sent_at: new Date().toISOString(), last_error_summary: null }).eq("tenant_id", input.tenantId).eq("id", row.id);
    return { status: "sent", id: row.id };
  } catch (error) {
    await db.from("notification_deliveries").update({ status: "failed", attempt_count: row.attempt_count + 1, attempted_at: new Date().toISOString(), last_error_summary: safeError(error) }).eq("tenant_id", input.tenantId).eq("id", row.id);
    return { status: "failed", id: row.id };
  }
}

export async function notifyBestEffort(input: NotificationInput): Promise<void> {
  try { await deliverNotification(input); } catch (error) { console.error("[NOTIFICATION_RECORD_FAILED]", safeError(error)); }
}

export async function notifyDocumentRequest(tenantId: string, requirementId: string): Promise<void> {
  const db: any = createServiceRoleClient();
  const { data } = await db.from("document_requirements").select("id,employee_id,document_type,due_date").eq("tenant_id", tenantId).eq("id", requirementId).maybeSingle();
  if (!data) return;
  const label = String(data.document_type).replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
  await notifyBestEffort({ tenantId, recipientEmployeeId: data.employee_id, type: "document_action", eventKey: `document-request:${requirementId}:requested`, subject: `${label} requested`, text: `Please upload ${label}${data.due_date ? ` by ${data.due_date}` : ""}.`, actionPath: "/documents-and-policies#documents", relatedEntityType: "document_requirement", relatedEntityId: requirementId });
}

export async function notifyLeaveDecision(tenantId: string, leaveId: string, decision: "approved" | "rejected"): Promise<void> {
  const db: any = createServiceRoleClient();
  const { data } = await db.from("leaves").select("employee_id,start_date,end_date").eq("tenant_id", tenantId).eq("id", leaveId).maybeSingle();
  if (!data) return;
  await notifyBestEffort({ tenantId, recipientEmployeeId: data.employee_id, type: "leave_action", eventKey: `leave:${leaveId}:decision:${decision}`, subject: `Your time off was ${decision}`, text: `Your time-off request for ${data.start_date}${data.end_date !== data.start_date ? ` to ${data.end_date}` : ""} was ${decision}.`, actionPath: "/leaves", relatedEntityType: "leave", relatedEntityId: leaveId });
}

export async function notifyLeaveRequest(tenantId: string, leaveId: string): Promise<void> {
  const db: any = createServiceRoleClient();
  const { data } = await db.from("leaves").select("employee_id,start_date,end_date").eq("tenant_id", tenantId).eq("id", leaveId).maybeSingle();
  if (!data) return;
  const { data: employee } = await db.from("employees").select("full_name,manager_id").eq("tenant_id", tenantId).eq("id", data.employee_id).maybeSingle();
  if (!employee?.manager_id) return;
  await notifyBestEffort({ tenantId, recipientEmployeeId: employee.manager_id, type: "leave_action", eventKey: `leave:${leaveId}:decision-needed`, subject: "Leave request needs your decision", text: `${employee.full_name} requested time off from ${data.start_date}${data.end_date !== data.start_date ? ` to ${data.end_date}` : ""}.`, actionPath: "/manager", relatedEntityType: "leave", relatedEntityId: leaveId });
}

export async function notifyTaskAssignment(tenantId: string, employeeId: string, eventId: string, title: string): Promise<void> {
  await notifyBestEffort({ tenantId, recipientEmployeeId: employeeId, type: "task_assignment", eventKey: `onboarding:${eventId}:assigned`, subject: "Onboarding task assigned", text: `${title} has been added to your onboarding checklist.`, actionPath: "/onboarding", relatedEntityType: "onboarding_task", relatedEntityId: eventId });
}

export async function notifyOffboardingAssignment(tenantId: string, item: { id: string; employeeId: string; ownerEmployeeId: string | null; title: string; dueDate: string | null }): Promise<void> {
  if (!item.ownerEmployeeId) return;
  await notifyBestEffort({ tenantId, recipientEmployeeId: item.ownerEmployeeId, type: "offboarding", eventKey: `offboarding:${item.id}:assigned`, subject: "Offboarding task assigned", text: `${item.title}${item.dueDate ? ` is due by ${item.dueDate}` : ""}.`, actionPath: item.ownerEmployeeId === item.employeeId ? "/home" : "/manager", relatedEntityType: "offboarding_item", relatedEntityId: item.id });
}

export async function notifyDueMilestone(tenantId: string, input: { ruleKey: string; subjectId: string; ownerEmployeeId: string | null }): Promise<void> {
  if (!input.ownerEmployeeId) return;
  if (input.ruleKey === "onboarding.check_in.due") {
    await notifyBestEffort({ tenantId, recipientEmployeeId: input.ownerEmployeeId, type: "probation_check_in", eventKey: `check-in:${input.subjectId}:due`, subject: "Your 30-day check-in is ready", text: "Please complete your 30-day check-in in TeamFrame.", actionPath: "/home#check-in", relatedEntityType: "onboarding_check_in", relatedEntityId: input.subjectId });
  }
  if (input.ruleKey === "probation.review_due") {
    await notifyBestEffort({ tenantId, recipientEmployeeId: input.ownerEmployeeId, type: "probation_check_in", eventKey: `probation:${input.subjectId}:manager-input-due`, subject: "Probation input is due", text: "A probation recommendation needs your input.", actionPath: "/manager", relatedEntityType: "probation_review", relatedEntityId: input.subjectId });
  }
}

export async function notifyPolicyPublished(tenantId: string, policyId: string): Promise<void> {
  const db: any = createServiceRoleClient();
  const [{ data: policy }, { data: employees }] = await Promise.all([
    db.from("policies").select("id,title,version").eq("tenant_id", tenantId).eq("id", policyId).maybeSingle(),
    db.from("employees").select("id").eq("tenant_id", tenantId).neq("lifecycle_state", "former").is("deleted_at", null),
  ]);
  if (!policy) return;
  await Promise.all(((employees ?? []) as Array<{ id: string }>).map((employee) => notifyBestEffort({ tenantId, recipientEmployeeId: employee.id, type: "policy_acknowledgement", eventKey: `policy:${policyId}:${policy.version}:ack:${employee.id}`, subject: "Policy acknowledgement needed", text: `${policy.title} is ready for you to read and acknowledge.`, actionPath: "/documents-and-policies#policies", relatedEntityType: "policy", relatedEntityId: policyId })));
}

export async function retryDelivery(actor: Actor & { tenantId: string }, id: string): Promise<void> {
  if (actor.role !== "admin") throw new Error("FORBIDDEN");
  const db: any = createServiceRoleClient();
  const { data, error } = await db.from("notification_deliveries").select("*").eq("tenant_id", actor.tenantId).eq("id", id).single();
  if (error || !data) throw new Error("NOTIFICATION_NOT_FOUND");
  const row = data as DeliveryRow;
  if (row.status !== "failed" || row.attempt_count >= 3 || !row.recipient_email) throw new Error("NOTIFICATION_RETRY_NOT_ALLOWED");
  const input: NotificationInput = { tenantId: row.tenant_id, recipientEmployeeId: row.recipient_employee_id, recipientEmail: row.recipient_email, type: row.notification_type, eventKey: row.event_key, subject: "TeamFrame notification", text: "You have an item that needs your attention.", actionPath: row.action_path ?? "/dashboard", relatedEntityType: row.related_entity_type ?? undefined, relatedEntityId: row.related_entity_id };
  try {
    const providerId = await transport(input, row.recipient_email);
    const { error: updateError } = await db.from("notification_deliveries").update({ status: "sent", provider_message_id: providerId, attempt_count: row.attempt_count + 1, attempted_at: new Date().toISOString(), sent_at: new Date().toISOString(), last_error_summary: null }).eq("tenant_id", actor.tenantId).eq("id", row.id).eq("status", "failed");
    if (updateError) throw new Error(`NOTIFICATION_RETRY_UPDATE_FAILED: ${updateError.message}`);
  } catch (error) {
    await db.from("notification_deliveries").update({ attempt_count: row.attempt_count + 1, attempted_at: new Date().toISOString(), last_error_summary: safeError(error) }).eq("tenant_id", actor.tenantId).eq("id", row.id).eq("status", "failed");
  }
}

export async function listFailedDeliveries(tenantId: string): Promise<DeliveryRow[]> {
  const { data, error } = await createServiceRoleClient().from("notification_deliveries").select("*").eq("tenant_id", tenantId).eq("status", "failed").order("created_at", { ascending: false }).limit(10);
  if (error) throw new Error(`NOTIFICATION_FAILURE_LIST_FAILED: ${error.message}`);
  return (data ?? []) as DeliveryRow[];
}

function localDate(timezone: string): string { return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }

export async function runDailyDigests(): Promise<{ sent: number; skipped: number; failed: number }> {
  const db: any = createServiceRoleClient();
  const [{ data: companies, error: companyError }, { data: memberships, error: membershipError }] = await Promise.all([
    db.from("companies").select("id,default_timezone"),
    db.from("tenant_memberships").select("tenant_id,auth_user_id,employee_id,email,profile,active").eq("active", true),
  ]);
  if (companyError || membershipError) throw new Error("DIGEST_SOURCE_FAILED");
  let sent = 0, skipped = 0, failed = 0;
  for (const company of (companies ?? []) as Array<{ id: string; default_timezone: string | null }>) {
    const timezone = company.default_timezone || "UTC";
    const date = localDate(timezone);
    for (const membership of ((memberships ?? []) as Array<{ tenant_id: string; auth_user_id: string; employee_id: string | null; email: string; profile: string; active: boolean }>).filter((m) => m.tenant_id === company.id)) {
      let count = 0;
      let actionPath = "/home";
      if (membership.profile === "full_access" || membership.profile === "admin") {
        count = (await loadControlCentreData({ tenantId: company.id })).allItems.filter((item) => !item.dueAt || item.dueAt <= new Date(Date.now() + 7 * 86400000).toISOString()).length;
        actionPath = "/dashboard";
      } else if (membership.employee_id) {
        const actor: Actor = { authUserId: membership.auth_user_id, email: membership.email, employeeId: membership.employee_id, tenantId: company.id, role: "employee" };
        const manager = await getManagerDashboard(actor);
        const [{ count: docs }, { data: policies }, { data: acknowledgements }, { count: tasks }] = await Promise.all([
          db.from("document_requirements").select("id", { count: "exact", head: true }).eq("tenant_id", company.id).eq("employee_id", membership.employee_id).in("state", ["requested", "rejected", "expired"]),
          db.from("policies").select("id,version").eq("tenant_id", company.id).eq("is_published", true).is("archived_at", null),
          db.from("acknowledgements").select("policy_id,policy_version").eq("tenant_id", company.id).eq("employee_id", membership.employee_id),
          db.from("onboarding_tasks").select("id", { count: "exact", head: true }).eq("tenant_id", company.id).eq("employee_id", membership.employee_id).eq("status", "pending"),
        ]);
        const acknowledged = new Set(((acknowledgements ?? []) as Array<{ policy_id: string; policy_version: number }>).map((row) => `${row.policy_id}:${row.policy_version}`));
        const policyCount = ((policies ?? []) as Array<{ id: string; version: number }>).filter((policy) => !acknowledged.has(`${policy.id}:${policy.version}`)).length;
        count = (docs ?? 0) + policyCount + (tasks ?? 0) + manager.pendingLeaves.length + manager.onboardingTasks.length + manager.offboardingItems.length;
        if (manager.directReports.length) actionPath = "/home";
      }
      if (count === 0) { skipped += 1; continue; }
      const result = await deliverNotification({ tenantId: company.id, recipientEmployeeId: membership.employee_id, recipientEmail: membership.email, type: "daily_digest", eventKey: `digest:${membership.auth_user_id}:${date}`, subject: `${count} ${count === 1 ? "item needs" : "items need"} your attention`, text: `TeamFrame has ${count} actionable ${count === 1 ? "item" : "items"} for you today.`, actionPath });
      if (result.status === "sent") sent += 1; else if (result.status === "failed") failed += 1; else skipped += 1;
    }
  }
  return { sent, skipped, failed };
}
