/**
 * TeamFrame FPORS demo seed.
 *
 * Creates a deterministic demo tenant with screenshot-ready states:
 * - At least one red signal
 * - At least one yellow signal
 * - At least one resolved signal
 * - At least one action item generated from signals
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

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

function isoDaysFromNow(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

function dateOnlyDaysFromNow(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

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

async function upsertDocument(tenantId, input) {
  const { data: existing, error: selErr } = await supabase
    .from("documents")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("employee_id", input.employee_id)
    .eq("document_type", input.document_type)
    .is("deleted_at", null)
    .maybeSingle();

  if (selErr) throw new Error(`DOCUMENT_LOOKUP_FAILED: ${selErr.message}`);

  const payload = {
    tenant_id: tenantId,
    employee_id: input.employee_id,
    subject_person_id: input.employee_id,
    document_type: input.document_type,
    type: input.type,
    file_url: input.file_url,
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

async function summarizeSignals(tenantId) {
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

  const redOpen = (signals ?? []).filter((s) => s.severity === "red" && s.resolved_at == null).length;
  const yellowOpen = (signals ?? []).filter((s) => s.severity === "yellow" && s.resolved_at == null).length;
  const resolved = (signals ?? []).filter((s) => s.resolved_at != null).length;
  const openActions = (actions ?? []).filter((a) => a.status === "open" || a.status === "in_progress").length;

  console.log("\nDemo state summary");
  console.log(`- Open red signals: ${redOpen}`);
  console.log(`- Open yellow signals: ${yellowOpen}`);
  console.log(`- Resolved signals: ${resolved}`);
  console.log(`- Open action items: ${openActions}`);
}

async function main() {
  const tenantId = await getOrCreateCompany("demo-fpors", "Demo FPORS Startup");

  const founderId = await upsertEmployee(tenantId, {
    full_name: "Sara Founder",
    email: "sara.founder@demo-fpors.example",
    role_title: "Founder",
    department: "Leadership",
    timezone: "Asia/Dubai",
    status: "active",
    lifecycle_state: "active",
    start_date: dateOnlyDaysFromNow(-120),
    country: "UAE",
  });

  const operatorId = await upsertEmployee(tenantId, {
    full_name: "Lina Operations",
    email: "lina.ops@demo-fpors.example",
    role_title: "Operations Manager",
    department: "Operations",
    timezone: "Asia/Dubai",
    status: "active",
    lifecycle_state: "active",
    start_date: dateOnlyDaysFromNow(-40),
    country: "UAE",
  });

  const newHireId = await upsertEmployee(tenantId, {
    full_name: "Omar New Hire",
    email: "omar.newhire@demo-fpors.example",
    role_title: "Software Engineer",
    department: "Engineering",
    timezone: "Asia/Dubai",
    status: "active",
    lifecycle_state: "preboarding",
    start_date: dateOnlyDaysFromNow(14),
    country: "UAE",
  });

  const founderPassportId = await upsertDocument(tenantId, {
    employee_id: founderId,
    document_type: "passport",
    type: "CV",
    file_url: `${tenantId}/${founderId}/demo-passport.pdf`,
    signed_at: isoDaysFromNow(-150),
    expires_at: isoDaysFromNow(240),
  });

  const operatorEmiratesId = await upsertDocument(tenantId, {
    employee_id: operatorId,
    document_type: "emirates_id",
    type: "PHOTO",
    file_url: `${tenantId}/${operatorId}/demo-emirates-id.pdf`,
    signed_at: isoDaysFromNow(-300),
    expires_at: isoDaysFromNow(-5),
  });

  const newHirePassportId = await upsertDocument(tenantId, {
    employee_id: newHireId,
    document_type: "passport",
    type: "CV",
    file_url: `${tenantId}/${newHireId}/demo-passport-newhire.pdf`,
    signed_at: null,
    expires_at: isoDaysFromNow(25),
  });

  await resetSignalState(tenantId);

  await createSignalWithAction(tenantId, {
    kind: "expired_document",
    severity: "red",
    subject_employee_id: operatorId,
    subject_document_id: operatorEmiratesId,
    action_title: "Upload renewed Emirates ID",
    action_status: "open",
    evidence: {
      what_is_wrong: "Emirates ID is expired.",
      why_it_matters: "This can block operations and create compliance risk for the company.",
      what_to_do_next: "Upload renewed Emirates ID.",
    },
  });

  await createSignalWithAction(tenantId, {
    kind: "expiring_document",
    severity: "yellow",
    subject_employee_id: newHireId,
    subject_document_id: newHirePassportId,
    action_title: "Request renewal for passport",
    action_status: "open",
    evidence: {
      what_is_wrong: "Passport is expiring soon.",
      why_it_matters: "Travel and onboarding can be blocked if renewal is delayed.",
      what_to_do_next: "Request passport renewal now.",
    },
  });

  await createSignalWithAction(tenantId, {
    kind: "missing_contract",
    severity: "yellow",
    subject_employee_id: newHireId,
    subject_document_id: null,
    action_title: "Upload signed contract",
    action_status: "open",
    evidence: {
      what_is_wrong: "New hire has no signed contract on file.",
      why_it_matters: "Starting work without a signed contract creates legal and compliance risk.",
      what_to_do_next: "Upload a signed contract before start date.",
    },
  });

  await createSignalWithAction(tenantId, {
    kind: "expiring_document",
    severity: "yellow",
    subject_employee_id: founderId,
    subject_document_id: founderPassportId,
    action_title: "Request renewal for passport",
    action_status: "done",
    resolved_at: new Date().toISOString(),
    evidence: {
      what_is_wrong: "Passport had been expiring soon.",
      why_it_matters: "Founders need uninterrupted travel and compliance readiness.",
      what_to_do_next: "Renewed passport uploaded.",
    },
  });

  await summarizeSignals(tenantId);

  console.log("\nSeed complete for tenant:", tenantId);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
