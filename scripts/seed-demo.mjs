/**
 * TeamFrame FPORS demo seed.
 *
 * Applies the pure plan from scripts/lib/demo-plan.mjs (unit-tested in
 * tests/seed-demo-plan.test.ts) to a deterministic demo tenant. Idempotent:
 * safe to re-run; existing demo rows are updated in place, signals/actions
 * are reset and recreated.
 *
 * The seeded tenant makes every demo category visible:
 * - one open red signal, two open yellow signals, one resolved signal
 *   (each with a linked action item)
 * - an employee mid-onboarding with an OVERDUE pending task (due_date column)
 * - one expiring document (within 30 days)
 * - one published-but-unacknowledged policy (Wave 1 policies loop)
 * - one pending leave request
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

async function getOrCreateCompany(slug, name) {
  const { data: existing, error: selErr } = await supabase
    .from("companies")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (selErr) throw new Error(`COMPANY_LOOKUP_FAILED: ${selErr.message}`);
  if (existing?.id) return existing.id;

  const { data: created, error: insErr } = await supabase
    .from("companies")
    .insert({ slug, name })
    .select("id")
    .single();

  if (insErr || !created) {
    throw new Error(`COMPANY_CREATE_FAILED: ${insErr?.message ?? "no row"}`);
  }

  return created.id;
}

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
    role_title: input.role_title,
    department: input.department,
    timezone: input.timezone,
    status: input.status,
    setup_status: "active",
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
 * Idempotent by (tenant_id, employee_id, title). Uses the due_date column
 * added in Wave 2. `assignedBy` has no FK — the demo tenant has no auth user,
 * so the founder's employee id stands in as a stable, clearly-internal value.
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

/**
 * Idempotent by (tenant_id, title). Deliberately seeds NO acknowledgements,
 * so a published policy stays unacknowledged for every employee — the Wave 1
 * policies loop (publish → employees acknowledge) is demonstrable end-to-end.
 */
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
 * Idempotent per (tenant_id, employee_id, status): the demo needs exactly one
 * pending leave in the queue, so an existing pending row has its dates
 * refreshed instead of accumulating duplicates across re-runs.
 */
async function upsertLeave(tenantId, employeeId, input) {
  const { data: existingRows, error: selErr } = await supabase
    .from("leaves")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("employee_id", employeeId)
    .eq("status", input.status)
    .limit(1);

  if (selErr) throw new Error(`LEAVE_LOOKUP_FAILED: ${selErr.message}`);

  const payload = {
    tenant_id: tenantId,
    employee_id: employeeId,
    start_date: input.start_date,
    end_date: input.end_date,
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

  const redOpen = (signals ?? []).filter((s) => s.severity === "red" && s.resolved_at == null).length;
  const yellowOpen = (signals ?? []).filter((s) => s.severity === "yellow" && s.resolved_at == null).length;
  const resolved = (signals ?? []).filter((s) => s.resolved_at != null).length;
  const openActions = (actions ?? []).filter((a) => a.status === "open" || a.status === "in_progress").length;
  const overdueTasks = (tasks ?? []).filter(
    (t) => t.status === "pending" && t.due_date != null && t.due_date < todayDateOnly,
  ).length;
  const pendingLeaves = (leaves ?? []).filter((l) => l.status === "pending").length;
  const publishedPolicies = (policies ?? []).filter((p) => p.is_published).length;

  console.log("\nDemo state summary");
  console.log(`- Open red signals: ${redOpen}`);
  console.log(`- Open yellow signals: ${yellowOpen}`);
  console.log(`- Resolved signals: ${resolved}`);
  console.log(`- Open action items: ${openActions}`);
  console.log(`- Overdue pending onboarding tasks: ${overdueTasks}`);
  console.log(`- Pending leave requests: ${pendingLeaves}`);
  console.log(`- Published policies (unacknowledged by design): ${publishedPolicies}`);
}

async function main() {
  const now = new Date();
  const plan = buildDemoPlan(now);

  const tenantId = await getOrCreateCompany(plan.company.slug, plan.company.name);

  const employeeIdsByKey = new Map();
  for (const employee of plan.employees) {
    const { key, ...input } = employee;
    employeeIdsByKey.set(key, await upsertEmployee(tenantId, input));
  }

  const documentIdsByKey = new Map();
  for (const document of plan.documents) {
    const { key, employeeKey, ...input } = document;
    const employeeId = employeeIdsByKey.get(employeeKey);
    if (!employeeId) throw new Error(`PLAN_INVALID: unknown employee key ${employeeKey}`);
    documentIdsByKey.set(key, await upsertDocument(tenantId, employeeId, input));
  }

  const assignedBy = employeeIdsByKey.get("founder");
  for (const task of plan.onboardingTasks) {
    const { employeeKey, ...input } = task;
    const employeeId = employeeIdsByKey.get(employeeKey);
    if (!employeeId) throw new Error(`PLAN_INVALID: unknown employee key ${employeeKey}`);
    await upsertOnboardingTask(tenantId, employeeId, assignedBy, input);
  }

  for (const policy of plan.policies) {
    await upsertPolicy(tenantId, policy);
  }

  for (const leave of plan.leaves) {
    const { employeeKey, ...input } = leave;
    const employeeId = employeeIdsByKey.get(employeeKey);
    if (!employeeId) throw new Error(`PLAN_INVALID: unknown employee key ${employeeKey}`);
    await upsertLeave(tenantId, employeeId, input);
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
