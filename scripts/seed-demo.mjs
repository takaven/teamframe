/**
 * TeamFrame "Northstar" premium demo seed.
 *
 * Applies the pure plan from scripts/lib/demo-plan.mjs (unit-tested in
 * tests/seed-demo-plan.test.ts) to a deterministic demo tenant. Idempotent:
 * safe to re-run; existing demo rows are updated in place, signals/actions
 * are reset and recreated.
 *
 * The seeded tenant makes every module demonstrable:
 * - a 17-person org with departments, positions and reporting lines
 * - configured leave definitions plus pending, approved and conflicting leave
 * - two people mid-onboarding with OVERDUE tasks (due_date column)
 * - versioned published policies with PARTIAL acknowledgement (+ one draft)
 * - documents with expiry (one expired, two expiring) and open evidence requests
 * - probation reviews (scheduled / due / completed) and employment changes
 * - open red, open yellow and resolved signals, each with a linked action item
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { buildDemoPlan } from "./lib/demo-plan.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
dotenv.config({ path: join(repoRoot, ".env.local") });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** Idempotent by slug; company-level defaults are refreshed on every run. */
async function upsertCompany(input) {
  const settings = {
    name: input.name,
    country: input.country,
    location: input.location,
    default_timezone: input.default_timezone,
    annual_leave_default_days: input.annual_leave_default_days,
    sick_leave_default_days: input.sick_leave_default_days,
    employee_number_prefix: input.employee_number_prefix,
  };

  const { data: existing, error: selErr } = await supabase
    .from("companies")
    .select("id")
    .eq("slug", input.slug)
    .maybeSingle();

  if (selErr) throw new Error(`COMPANY_LOOKUP_FAILED: ${selErr.message}`);

  if (existing?.id) {
    const { error: updErr } = await supabase.from("companies").update(settings).eq("id", existing.id);
    if (updErr) throw new Error(`COMPANY_UPDATE_FAILED: ${updErr.message}`);
    return existing.id;
  }

  const { data: created, error: insErr } = await supabase
    .from("companies")
    .insert({ slug: input.slug, ...settings })
    .select("id")
    .single();

  if (insErr || !created) {
    throw new Error(`COMPANY_CREATE_FAILED: ${insErr?.message ?? "no row"}`);
  }

  return created.id;
}

/** Idempotent by (tenant_id, name). Departments are the list employees resolve against. */
async function upsertDepartment(tenantId, input) {
  const { data: existing, error: selErr } = await supabase
    .from("departments")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("name", input.name)
    .maybeSingle();

  if (selErr) throw new Error(`DEPARTMENT_LOOKUP_FAILED: ${selErr.message}`);

  const payload = { tenant_id: tenantId, name: input.name, active: input.active };

  if (existing?.id) {
    const { error: updErr } = await supabase.from("departments").update(payload).eq("id", existing.id);
    if (updErr) throw new Error(`DEPARTMENT_UPDATE_FAILED: ${updErr.message}`);
    return existing.id;
  }

  const { data: created, error: insErr } = await supabase
    .from("departments")
    .insert(payload)
    .select("id")
    .single();

  if (insErr || !created) throw new Error(`DEPARTMENT_CREATE_FAILED: ${insErr?.message ?? "no row"}`);
  return created.id;
}

/** Idempotent by (tenant_id, code) — the leave engine itself is untouched. */
async function upsertLeaveDefinition(tenantId, input) {
  const { data: existing, error: selErr } = await supabase
    .from("leave_definitions")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("code", input.code)
    .maybeSingle();

  if (selErr) throw new Error(`LEAVE_DEFINITION_LOOKUP_FAILED: ${selErr.message}`);

  const payload = {
    tenant_id: tenantId,
    code: input.code,
    display_name: input.display_name,
    system_leave_type: input.system_leave_type,
    active: true,
    default_entitlement_days: input.default_entitlement_days,
    counting_basis: input.counting_basis,
    attachment_requirement: input.attachment_requirement,
    is_system: input.is_system,
    sort_order: input.sort_order,
  };

  if (existing?.id) {
    const { error: updErr } = await supabase
      .from("leave_definitions")
      .update(payload)
      .eq("id", existing.id);
    if (updErr) throw new Error(`LEAVE_DEFINITION_UPDATE_FAILED: ${updErr.message}`);
    return existing.id;
  }

  const { data: created, error: insErr } = await supabase
    .from("leave_definitions")
    .insert(payload)
    .select("id")
    .single();

  if (insErr || !created) {
    throw new Error(`LEAVE_DEFINITION_CREATE_FAILED: ${insErr?.message ?? "no row"}`);
  }

  return created.id;
}

/**
 * Idempotent by (tenant_id, email). `manager_id` is applied in a second pass
 * (linkManagers) once every employee row exists.
 */
async function upsertEmployee(tenantId, input) {
  const { data: existing, error: selErr } = await supabase
    .from("employees")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("email", input.email)
    .maybeSingle();

  if (selErr) throw new Error(`EMPLOYEE_LOOKUP_FAILED: ${selErr.message}`);

  const payload = {
    tenant_id: tenantId,
    full_name: input.full_name,
    email: input.email,
    employee_number: input.employee_number,
    role_title: input.role_title,
    department: input.department,
    employment_type: input.employment_type,
    timezone: input.timezone,
    status: input.status,
    setup_status: input.setup_status,
    lifecycle_state: input.lifecycle_state,
    start_date: input.start_date,
    country: input.country,
  };

  if (existing?.id) {
    const { error: updErr } = await supabase.from("employees").update(payload).eq("id", existing.id);
    if (updErr) throw new Error(`EMPLOYEE_UPDATE_FAILED: ${updErr.message}`);
    return existing.id;
  }

  const { data: created, error: insErr } = await supabase
    .from("employees")
    .insert(payload)
    .select("id")
    .single();

  if (insErr || !created) {
    throw new Error(`EMPLOYEE_CREATE_FAILED: ${insErr?.message ?? "no row"}`);
  }

  return created.id;
}

async function linkManagers(employees, employeeIdsByKey) {
  for (const employee of employees) {
    const employeeId = employeeIdsByKey.get(employee.key);
    const managerId = employee.managerKey ? employeeIdsByKey.get(employee.managerKey) : null;
    if (employee.managerKey && !managerId) {
      throw new Error(`PLAN_INVALID: unknown manager key ${employee.managerKey}`);
    }
    const { error } = await supabase
      .from("employees")
      .update({ manager_id: managerId ?? null })
      .eq("id", employeeId);
    if (error) throw new Error(`EMPLOYEE_MANAGER_LINK_FAILED: ${error.message}`);
  }
}

/**
 * Idempotent by (tenant_id, title) among live rows — the plan gives every
 * position a distinct title, including the deliberately vacant seat.
 */
async function upsertPosition(tenantId, input) {
  const { data: existing, error: selErr } = await supabase
    .from("positions")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("title", input.title)
    .is("deleted_at", null)
    .maybeSingle();

  if (selErr) throw new Error(`POSITION_LOOKUP_FAILED: ${selErr.message}`);

  const payload = {
    tenant_id: tenantId,
    title: input.title,
    department: input.department,
    parent_position_id: input.parent_position_id,
    assigned_employee_id: input.assigned_employee_id,
    budgeted: input.budgeted,
  };

  if (existing?.id) {
    const { error: updErr } = await supabase.from("positions").update(payload).eq("id", existing.id);
    if (updErr) throw new Error(`POSITION_UPDATE_FAILED: ${updErr.message}`);
    return existing.id;
  }

  const { data: created, error: insErr } = await supabase
    .from("positions")
    .insert(payload)
    .select("id")
    .single();

  if (insErr || !created) throw new Error(`POSITION_CREATE_FAILED: ${insErr?.message ?? "no row"}`);
  return created.id;
}

async function upsertDocument(tenantId, employeeId, input) {
  const { data: existing, error: selErr } = await supabase
    .from("documents")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("employee_id", employeeId)
    .eq("document_type", input.document_type)
    .is("deleted_at", null)
    .maybeSingle();

  if (selErr) throw new Error(`DOCUMENT_LOOKUP_FAILED: ${selErr.message}`);

  const payload = {
    tenant_id: tenantId,
    employee_id: employeeId,
    subject_person_id: employeeId,
    document_type: input.document_type,
    type: input.type,
    file_url: `${tenantId}/${employeeId}/${input.file_name}`,
    signed_at: input.signed_at,
    expires_at: input.expires_at,
  };

  if (existing?.id) {
    const { error: updErr } = await supabase.from("documents").update(payload).eq("id", existing.id);
    if (updErr) throw new Error(`DOCUMENT_UPDATE_FAILED: ${updErr.message}`);
    return existing.id;
  }

  const { data: created, error: insErr } = await supabase
    .from("documents")
    .insert(payload)
    .select("id")
    .single();

  if (insErr || !created) {
    throw new Error(`DOCUMENT_CREATE_FAILED: ${insErr?.message ?? "no row"}`);
  }

  return created.id;
}

/**
 * Idempotent by (tenant_id, employee_id, document_type). Every seeded row stays
 * in the 'requested' state, so the accepted-evidence trigger never fires and the
 * demo's open evidence queue is exactly what the plan declares.
 */
async function upsertDocumentRequirement(tenantId, employeeId, requestedBy, input) {
  const { data: existing, error: selErr } = await supabase
    .from("document_requirements")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("employee_id", employeeId)
    .eq("document_type", input.document_type)
    .maybeSingle();

  if (selErr) throw new Error(`DOCUMENT_REQUIREMENT_LOOKUP_FAILED: ${selErr.message}`);

  const payload = {
    tenant_id: tenantId,
    employee_id: employeeId,
    document_type: input.document_type,
    due_date: input.due_date,
    expiry_required: input.expiry_required,
    review_required: input.review_required,
    employee_upload_allowed: input.employee_upload_allowed,
    state: input.state,
    requested_at: input.requested_at,
    requested_by_user_id: requestedBy,
  };

  if (existing?.id) {
    const { error: updErr } = await supabase
      .from("document_requirements")
      .update(payload)
      .eq("id", existing.id);
    if (updErr) throw new Error(`DOCUMENT_REQUIREMENT_UPDATE_FAILED: ${updErr.message}`);
    return existing.id;
  }

  const { data: created, error: insErr } = await supabase
    .from("document_requirements")
    .insert(payload)
    .select("id")
    .single();

  if (insErr || !created) {
    throw new Error(`DOCUMENT_REQUIREMENT_CREATE_FAILED: ${insErr?.message ?? "no row"}`);
  }

  return created.id;
}

/**
 * Idempotent by (tenant_id, employee_id, title). Uses the due_date column
 * added in Wave 2. `assignedBy` has no FK — the demo tenant has no auth user,
 * so the managing director's employee id stands in as a stable, clearly-internal
 * value.
 */
async function upsertOnboardingTask(tenantId, employeeId, assignedBy, input) {
  const { data: existing, error: selErr } = await supabase
    .from("onboarding_tasks")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("employee_id", employeeId)
    .eq("title", input.title)
    .maybeSingle();

  if (selErr) throw new Error(`ONBOARDING_TASK_LOOKUP_FAILED: ${selErr.message}`);

  const payload = {
    tenant_id: tenantId,
    employee_id: employeeId,
    title: input.title,
    status: input.status,
    owner_role: input.owner_role,
    completion_mode: input.completion_mode,
    required_document_type: input.required_document_type,
    assigned_by: assignedBy,
    due_date: input.due_date,
    completed_at: input.completed_at,
  };

  if (existing?.id) {
    const { error: updErr } = await supabase
      .from("onboarding_tasks")
      .update(payload)
      .eq("id", existing.id);
    if (updErr) throw new Error(`ONBOARDING_TASK_UPDATE_FAILED: ${updErr.message}`);
    return existing.id;
  }

  const { data: created, error: insErr } = await supabase
    .from("onboarding_tasks")
    .insert(payload)
    .select("id")
    .single();

  if (insErr || !created) {
    throw new Error(`ONBOARDING_TASK_CREATE_FAILED: ${insErr?.message ?? "no row"}`);
  }

  return created.id;
}

/** Idempotent by (tenant_id, title). Acknowledgements are seeded separately. */
async function upsertPolicy(tenantId, input) {
  const { data: existing, error: selErr } = await supabase
    .from("policies")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("title", input.title)
    .maybeSingle();

  if (selErr) throw new Error(`POLICY_LOOKUP_FAILED: ${selErr.message}`);

  const payload = {
    tenant_id: tenantId,
    title: input.title,
    body: input.body,
    version: input.version,
    is_published: input.is_published,
    effective_date: input.effective_date,
  };

  if (existing?.id) {
    const { error: updErr } = await supabase.from("policies").update(payload).eq("id", existing.id);
    if (updErr) throw new Error(`POLICY_UPDATE_FAILED: ${updErr.message}`);
    return existing.id;
  }

  const { data: created, error: insErr } = await supabase
    .from("policies")
    .insert(payload)
    .select("id")
    .single();

  if (insErr || !created) {
    throw new Error(`POLICY_CREATE_FAILED: ${insErr?.message ?? "no row"}`);
  }

  return created.id;
}

/**
 * Acknowledgements are immutable acceptance events, unique per
 * (tenant, policy, version, employee) — an existing row is left untouched.
 */
async function upsertAcknowledgement(tenantId, policyId, policyVersion, employeeId, acknowledgedAt) {
  const { data: existing, error: selErr } = await supabase
    .from("acknowledgements")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("policy_id", policyId)
    .eq("policy_version", policyVersion)
    .eq("employee_id", employeeId)
    .maybeSingle();

  if (selErr) throw new Error(`ACKNOWLEDGEMENT_LOOKUP_FAILED: ${selErr.message}`);
  if (existing?.id) return existing.id;

  const { data: created, error: insErr } = await supabase
    .from("acknowledgements")
    .insert({
      tenant_id: tenantId,
      policy_id: policyId,
      policy_version: policyVersion,
      employee_id: employeeId,
      acknowledged_at: acknowledgedAt,
    })
    .select("id")
    .single();

  if (insErr || !created) {
    throw new Error(`ACKNOWLEDGEMENT_CREATE_FAILED: ${insErr?.message ?? "no row"}`);
  }

  return created.id;
}

/**
 * Idempotent per (tenant_id, employee_id, status, start_date): the plan seeds
 * an employee's overlapping requests under different statuses, so re-runs
 * refresh the same rows instead of accumulating duplicates.
 */
async function upsertLeave(tenantId, employeeId, leaveDefinitionId, input) {
  const { data: existingRows, error: selErr } = await supabase
    .from("leaves")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("employee_id", employeeId)
    .eq("status", input.status)
    .eq("start_date", input.start_date)
    .limit(1);

  if (selErr) throw new Error(`LEAVE_LOOKUP_FAILED: ${selErr.message}`);

  const payload = {
    tenant_id: tenantId,
    employee_id: employeeId,
    leave_definition_id: leaveDefinitionId,
    start_date: input.start_date,
    end_date: input.end_date,
    leave_type: input.leave_type ?? "annual",
    requested_days:
      input.requested_days ??
      Math.floor((Date.parse(`${input.end_date}T00:00:00.000Z`) - Date.parse(`${input.start_date}T00:00:00.000Z`)) / 86_400_000) +
        1,
    reason: input.reason ?? null,
    status: input.status,
  };

  const existing = existingRows?.[0];
  if (existing?.id) {
    const { error: updErr } = await supabase.from("leaves").update(payload).eq("id", existing.id);
    if (updErr) throw new Error(`LEAVE_UPDATE_FAILED: ${updErr.message}`);
    return existing.id;
  }

  const { data: created, error: insErr } = await supabase
    .from("leaves")
    .insert(payload)
    .select("id")
    .single();

  if (insErr || !created) {
    throw new Error(`LEAVE_CREATE_FAILED: ${insErr?.message ?? "no row"}`);
  }

  return created.id;
}

/** Idempotent by (tenant_id, employee_id) — one probation record per person. */
async function upsertProbationReview(tenantId, employeeId, reviewOwner, input) {
  const { data: existingRows, error: selErr } = await supabase
    .from("probation_reviews")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("employee_id", employeeId)
    .limit(1);

  if (selErr) throw new Error(`PROBATION_REVIEW_LOOKUP_FAILED: ${selErr.message}`);

  const payload = {
    tenant_id: tenantId,
    employee_id: employeeId,
    probation_end_date: input.probation_end_date,
    review_due_date: input.review_due_date,
    status: input.status,
    review_owner_user_id: reviewOwner,
    outcome: input.outcome,
    outcome_notes: input.outcome_notes,
    completed_at: input.completed_at,
    completed_by_user_id: input.completed_at ? reviewOwner : null,
  };

  const existing = existingRows?.[0];
  if (existing?.id) {
    const { error: updErr } = await supabase
      .from("probation_reviews")
      .update(payload)
      .eq("id", existing.id);
    if (updErr) throw new Error(`PROBATION_REVIEW_UPDATE_FAILED: ${updErr.message}`);
    return existing.id;
  }

  const { data: created, error: insErr } = await supabase
    .from("probation_reviews")
    .insert(payload)
    .select("id")
    .single();

  if (insErr || !created) {
    throw new Error(`PROBATION_REVIEW_CREATE_FAILED: ${insErr?.message ?? "no row"}`);
  }

  return created.id;
}

/** Idempotent by (tenant_id, idempotency_key) — the table's own uniqueness key. */
async function upsertEmploymentChange(tenantId, employeeId, recordedBy, input) {
  const { data: existing, error: selErr } = await supabase
    .from("employment_changes")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("idempotency_key", input.idempotency_key)
    .maybeSingle();

  if (selErr) throw new Error(`EMPLOYMENT_CHANGE_LOOKUP_FAILED: ${selErr.message}`);

  const payload = {
    tenant_id: tenantId,
    employee_id: employeeId,
    effective_date: input.effective_date,
    status: input.status,
    change_keys: input.change_keys,
    old_values: input.old_values,
    new_values: input.new_values,
    recorded_by_user_id: recordedBy,
    recorded_at: input.recorded_at,
    applied_at: input.applied_at,
    applied_by_actor_type: input.applied_by_actor_type,
    idempotency_key: input.idempotency_key,
  };

  if (existing?.id) {
    const { error: updErr } = await supabase
      .from("employment_changes")
      .update(payload)
      .eq("id", existing.id);
    if (updErr) throw new Error(`EMPLOYMENT_CHANGE_UPDATE_FAILED: ${updErr.message}`);
    return existing.id;
  }

  const { data: created, error: insErr } = await supabase
    .from("employment_changes")
    .insert(payload)
    .select("id")
    .single();

  if (insErr || !created) {
    throw new Error(`EMPLOYMENT_CHANGE_CREATE_FAILED: ${insErr?.message ?? "no row"}`);
  }

  return created.id;
}

async function resetSignalState(tenantId) {
  const { error: actionDeleteError } = await supabase.from("action_items").delete().eq("tenant_id", tenantId);
  if (actionDeleteError) throw new Error(`ACTION_RESET_FAILED: ${actionDeleteError.message}`);

  const { error: signalDeleteError } = await supabase.from("risk_signals").delete().eq("tenant_id", tenantId);
  if (signalDeleteError) throw new Error(`SIGNAL_RESET_FAILED: ${signalDeleteError.message}`);
}

async function createSignalWithAction(tenantId, input) {
  const { data: signal, error: signalError } = await supabase
    .from("risk_signals")
    .insert({
      tenant_id: tenantId,
      kind: input.kind,
      trigger_reason: input.kind,
      severity: input.severity,
      subject_employee_id: input.subject_employee_id,
      subject_document_id: input.subject_document_id,
      evidence: input.evidence,
      first_seen_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString(),
      resolved_at: input.resolved_at ?? null,
    })
    .select("id")
    .single();

  if (signalError || !signal) throw new Error(`SIGNAL_CREATE_FAILED: ${signalError?.message ?? "no row"}`);

  const { data: action, error: actionError } = await supabase
    .from("action_items")
    .insert({
      tenant_id: tenantId,
      risk_signal_id: signal.id,
      subject_employee_id: input.subject_employee_id,
      category: input.kind,
      title: input.action_title,
      suggested_action: input.action_title,
      status: input.action_status,
      resolved_at: input.action_status === "done" ? new Date().toISOString() : null,
    })
    .select("id")
    .single();

  if (actionError || !action) throw new Error(`ACTION_CREATE_FAILED: ${actionError?.message ?? "no row"}`);

  if (input.resolved_at) {
    const { error: linkError } = await supabase
      .from("risk_signals")
      .update({ resolution_action_item_id: action.id })
      .eq("id", signal.id);
    if (linkError) throw new Error(`SIGNAL_LINK_FAILED: ${linkError.message}`);
  }
}

async function summarizeDemoState(tenantId, todayDateOnly) {
  const { data: signals, error: signalErr } = await supabase
    .from("risk_signals")
    .select("id, kind, severity, resolved_at")
    .eq("tenant_id", tenantId)
    .order("first_seen_at", { ascending: false });

  if (signalErr) throw new Error(`SIGNAL_SUMMARY_FAILED: ${signalErr.message}`);

  const { data: actions, error: actionErr } = await supabase
    .from("action_items")
    .select("id, status, category")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (actionErr) throw new Error(`ACTION_SUMMARY_FAILED: ${actionErr.message}`);

  const { data: employees, error: employeeErr } = await supabase
    .from("employees")
    .select("id, lifecycle_state")
    .eq("tenant_id", tenantId)
    .is("deleted_at", null);

  if (employeeErr) throw new Error(`EMPLOYEE_SUMMARY_FAILED: ${employeeErr.message}`);

  const { data: positions, error: positionErr } = await supabase
    .from("positions")
    .select("id, assigned_employee_id")
    .eq("tenant_id", tenantId)
    .is("deleted_at", null);

  if (positionErr) throw new Error(`POSITION_SUMMARY_FAILED: ${positionErr.message}`);

  const { data: tasks, error: taskErr } = await supabase
    .from("onboarding_tasks")
    .select("id, status, due_date")
    .eq("tenant_id", tenantId);

  if (taskErr) throw new Error(`TASK_SUMMARY_FAILED: ${taskErr.message}`);

  const { data: leaves, error: leaveErr } = await supabase
    .from("leaves")
    .select("id, status")
    .eq("tenant_id", tenantId);

  if (leaveErr) throw new Error(`LEAVE_SUMMARY_FAILED: ${leaveErr.message}`);

  const { data: policies, error: policyErr } = await supabase
    .from("policies")
    .select("id, is_published")
    .eq("tenant_id", tenantId);

  if (policyErr) throw new Error(`POLICY_SUMMARY_FAILED: ${policyErr.message}`);

  const { data: acknowledgements, error: ackErr } = await supabase
    .from("acknowledgements")
    .select("id")
    .eq("tenant_id", tenantId);

  if (ackErr) throw new Error(`ACKNOWLEDGEMENT_SUMMARY_FAILED: ${ackErr.message}`);

  const redOpen = (signals ?? []).filter((s) => s.severity === "red" && s.resolved_at == null).length;
  const yellowOpen = (signals ?? []).filter((s) => s.severity === "yellow" && s.resolved_at == null).length;
  const resolved = (signals ?? []).filter((s) => s.resolved_at != null).length;
  const openActions = (actions ?? []).filter((a) => a.status === "open" || a.status === "in_progress").length;
  const preboarding = (employees ?? []).filter((e) => e.lifecycle_state === "preboarding").length;
  const vacantPositions = (positions ?? []).filter((p) => p.assigned_employee_id == null).length;
  const overdueTasks = (tasks ?? []).filter(
    (t) => t.status === "pending" && t.due_date != null && t.due_date < todayDateOnly,
  ).length;
  const pendingLeaves = (leaves ?? []).filter((l) => l.status === "pending").length;
  const publishedPolicies = (policies ?? []).filter((p) => p.is_published).length;

  console.log("\nDemo state summary");
  console.log(`- Employees: ${(employees ?? []).length} (${preboarding} preboarding)`);
  console.log(`- Positions: ${(positions ?? []).length} (${vacantPositions} vacant)`);
  console.log(`- Open red signals: ${redOpen}`);
  console.log(`- Open yellow signals: ${yellowOpen}`);
  console.log(`- Resolved signals: ${resolved}`);
  console.log(`- Open action items: ${openActions}`);
  console.log(`- Overdue pending onboarding tasks: ${overdueTasks}`);
  console.log(`- Pending leave requests: ${pendingLeaves}`);
  console.log(`- Published policies: ${publishedPolicies}`);
  console.log(`- Policy acknowledgements recorded: ${(acknowledgements ?? []).length}`);
}

async function main() {
  const now = new Date();
  const plan = buildDemoPlan(now);

  const tenantId = await upsertCompany(plan.company);

  // Departments first: the employees/positions department_id triggers resolve
  // the free-text department against this list on write.
  for (const department of plan.departments) {
    await upsertDepartment(tenantId, department);
  }

  const leaveDefinitionIdsByCode = new Map();
  for (const definition of plan.leaveDefinitions) {
    leaveDefinitionIdsByCode.set(definition.code, await upsertLeaveDefinition(tenantId, definition));
  }

  const employeeIdsByKey = new Map();
  for (const employee of plan.employees) {
    const { key, managerKey: _managerKey, ...input } = employee;
    employeeIdsByKey.set(key, await upsertEmployee(tenantId, input));
  }
  await linkManagers(plan.employees, employeeIdsByKey);

  const adminEmployeeId = employeeIdsByKey.get(plan.adminEmployeeKey);
  if (!adminEmployeeId) {
    throw new Error(`PLAN_INVALID: unknown admin employee key ${plan.adminEmployeeKey}`);
  }

  // Positions are listed parents-first so parent ids resolve in a single pass.
  const positionIdsByKey = new Map();
  for (const position of plan.positions) {
    const { key, parentKey, employeeKey, ...input } = position;
    const parentId = parentKey ? positionIdsByKey.get(parentKey) : null;
    if (parentKey && !parentId) throw new Error(`PLAN_INVALID: unknown position key ${parentKey}`);
    const assignedEmployeeId = employeeKey ? employeeIdsByKey.get(employeeKey) : null;
    if (employeeKey && !assignedEmployeeId) {
      throw new Error(`PLAN_INVALID: unknown employee key ${employeeKey}`);
    }
    positionIdsByKey.set(
      key,
      await upsertPosition(tenantId, {
        ...input,
        parent_position_id: parentId ?? null,
        assigned_employee_id: assignedEmployeeId ?? null,
      }),
    );
  }

  const documentIdsByKey = new Map();
  for (const document of plan.documents) {
    const { key, employeeKey, ...input } = document;
    const employeeId = employeeIdsByKey.get(employeeKey);
    if (!employeeId) throw new Error(`PLAN_INVALID: unknown employee key ${employeeKey}`);
    documentIdsByKey.set(key, await upsertDocument(tenantId, employeeId, input));
  }

  for (const requirement of plan.documentRequirements) {
    const { employeeKey, ...input } = requirement;
    const employeeId = employeeIdsByKey.get(employeeKey);
    if (!employeeId) throw new Error(`PLAN_INVALID: unknown employee key ${employeeKey}`);
    await upsertDocumentRequirement(tenantId, employeeId, adminEmployeeId, input);
  }

  for (const task of plan.onboardingTasks) {
    const { employeeKey, ...input } = task;
    const employeeId = employeeIdsByKey.get(employeeKey);
    if (!employeeId) throw new Error(`PLAN_INVALID: unknown employee key ${employeeKey}`);
    await upsertOnboardingTask(tenantId, employeeId, adminEmployeeId, input);
  }

  const policyIdsByKey = new Map();
  const policyVersionsByKey = new Map();
  for (const policy of plan.policies) {
    const { key, ...input } = policy;
    policyIdsByKey.set(key, await upsertPolicy(tenantId, input));
    policyVersionsByKey.set(key, input.version);
  }

  for (const acknowledgement of plan.acknowledgements) {
    const policyId = policyIdsByKey.get(acknowledgement.policyKey);
    const policyVersion = policyVersionsByKey.get(acknowledgement.policyKey);
    if (!policyId) throw new Error(`PLAN_INVALID: unknown policy key ${acknowledgement.policyKey}`);
    const employeeId = employeeIdsByKey.get(acknowledgement.employeeKey);
    if (!employeeId) throw new Error(`PLAN_INVALID: unknown employee key ${acknowledgement.employeeKey}`);
    await upsertAcknowledgement(
      tenantId,
      policyId,
      policyVersion,
      employeeId,
      acknowledgement.acknowledged_at,
    );
  }

  for (const leave of plan.leaves) {
    const { employeeKey, definitionCode, ...input } = leave;
    const employeeId = employeeIdsByKey.get(employeeKey);
    if (!employeeId) throw new Error(`PLAN_INVALID: unknown employee key ${employeeKey}`);
    const definitionId = leaveDefinitionIdsByCode.get(definitionCode);
    if (!definitionId) throw new Error(`PLAN_INVALID: unknown leave definition ${definitionCode}`);
    await upsertLeave(tenantId, employeeId, definitionId, input);
  }

  for (const review of plan.probationReviews) {
    const { employeeKey, ...input } = review;
    const employeeId = employeeIdsByKey.get(employeeKey);
    if (!employeeId) throw new Error(`PLAN_INVALID: unknown employee key ${employeeKey}`);
    await upsertProbationReview(tenantId, employeeId, adminEmployeeId, input);
  }

  for (const change of plan.employmentChanges) {
    const { employeeKey, ...input } = change;
    const employeeId = employeeIdsByKey.get(employeeKey);
    if (!employeeId) throw new Error(`PLAN_INVALID: unknown employee key ${employeeKey}`);
    await upsertEmploymentChange(tenantId, employeeId, adminEmployeeId, input);
  }

  await resetSignalState(tenantId);

  for (const signal of plan.signals) {
    const { employeeKey, documentKey, ...input } = signal;
    const employeeId = employeeIdsByKey.get(employeeKey);
    if (!employeeId) throw new Error(`PLAN_INVALID: unknown employee key ${employeeKey}`);
    const documentId = documentKey ? documentIdsByKey.get(documentKey) : null;
    if (documentKey && !documentId) throw new Error(`PLAN_INVALID: unknown document key ${documentKey}`);
    await createSignalWithAction(tenantId, {
      ...input,
      subject_employee_id: employeeId,
      subject_document_id: documentId ?? null,
    });
  }

  await summarizeDemoState(tenantId, now.toISOString().slice(0, 10));

  console.log("\nSeed complete for tenant:", tenantId);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
