import "server-only";
import { z } from "zod";
import type { Actor } from "@/middleware/rbac";
import { createServiceRoleClient } from "@/lib/db/supabaseServer";
import { normalizeCountryCode } from "@/lib/geo/countries";

/**
 * Read access to the Phase-1 company-controlled configuration lists (departments,
 * work locations). Admin-scoped, tenant-scoped. Write/UI for these lives in the
 * later Setup/Administration phase; Phase 2B only needs to read them for the
 * position form dropdowns and for resolving ids to display names.
 */

export type DepartmentOption = { id: string; name: string; active: boolean };
export type WorkLocationOption = { id: string; name: string; country: string; active: boolean };

function requireTenant(actor: Actor): string {
  if (!actor.tenantId) throw new Error("NO_TENANT_CONTEXT");
  return actor.tenantId;
}

function requireAdmin(actor: Actor): void {
  if (actor.role !== "admin") throw new Error("FORBIDDEN");
}

export async function listDepartments(actor: Actor): Promise<DepartmentOption[]> {
  requireAdmin(actor);
  const tenantId = requireTenant(actor);
  const supabase = createServiceRoleClient();
  const query = await supabase
    .from("departments")
    .select("id, name, active")
    .eq("tenant_id", tenantId)
    .order("active", { ascending: false })
    .order("name", { ascending: true });
  if (query.error) throw new Error(`DEPARTMENTS_LIST_FAILED: ${query.error.message}`);
  return (query.data ?? []) as unknown as DepartmentOption[];
}

export async function listWorkLocations(actor: Actor): Promise<WorkLocationOption[]> {
  requireAdmin(actor);
  const tenantId = requireTenant(actor);
  const supabase = createServiceRoleClient();
  const query = await supabase
    .from("work_locations")
    .select("id, name, country, active")
    .eq("tenant_id", tenantId)
    .order("active", { ascending: false })
    .order("name", { ascending: true });
  if (query.error) throw new Error(`WORK_LOCATIONS_LIST_FAILED: ${query.error.message}`);
  return (query.data ?? []) as unknown as WorkLocationOption[];
}

// ── Departments CRUD ─────────────────────────────────────────────────────────
const NameSchema = z.string().trim().min(1).max(120);

export async function createDepartment(actor: Actor, name: string): Promise<void> {
  requireAdmin(actor);
  const tenantId = requireTenant(actor);
  const parsed = NameSchema.parse(name);
  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("departments").insert({ tenant_id: tenantId, name: parsed } as never);
  if (error) throw new Error(error.message.includes("unique") || error.message.includes("duplicate") ? "DEPARTMENT_DUPLICATE" : `DEPARTMENT_CREATE_FAILED: ${error.message}`);
}

export async function renameDepartment(actor: Actor, id: string, name: string): Promise<void> {
  requireAdmin(actor);
  const tenantId = requireTenant(actor);
  const parsed = NameSchema.parse(name);
  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("departments").update({ name: parsed } as never).eq("tenant_id", tenantId).eq("id", id);
  if (error) throw new Error(error.message.includes("unique") || error.message.includes("duplicate") ? "DEPARTMENT_DUPLICATE" : `DEPARTMENT_RENAME_FAILED: ${error.message}`);
}

// Deactivate/reactivate instead of destructive delete — legacy references (free-text
// department labels on employees/positions) are never invalidated.
export async function setDepartmentActive(actor: Actor, id: string, active: boolean): Promise<void> {
  requireAdmin(actor);
  const tenantId = requireTenant(actor);
  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("departments").update({ active } as never).eq("tenant_id", tenantId).eq("id", id);
  if (error) throw new Error(`DEPARTMENT_UPDATE_FAILED: ${error.message}`);
}

// ── Work locations CRUD ──────────────────────────────────────────────────────
export async function createWorkLocation(actor: Actor, name: string, country: string): Promise<void> {
  requireAdmin(actor);
  const tenantId = requireTenant(actor);
  const parsedName = NameSchema.parse(name);
  const iso = normalizeCountryCode(country);
  if (!iso) throw new Error("INVALID_COUNTRY");
  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("work_locations").insert({ tenant_id: tenantId, name: parsedName, country: iso } as never);
  if (error) throw new Error(error.message.includes("unique") || error.message.includes("duplicate") ? "WORK_LOCATION_DUPLICATE" : `WORK_LOCATION_CREATE_FAILED: ${error.message}`);
}

export async function updateWorkLocation(actor: Actor, id: string, name: string, country: string, active: boolean): Promise<void> {
  requireAdmin(actor);
  const tenantId = requireTenant(actor);
  const parsedName = NameSchema.parse(name);
  const iso = normalizeCountryCode(country);
  if (!iso) throw new Error("INVALID_COUNTRY");
  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("work_locations").update({ name: parsedName, country: iso, active } as never).eq("tenant_id", tenantId).eq("id", id);
  if (error) throw new Error(`WORK_LOCATION_UPDATE_FAILED: ${error.message}`);
}

// ── Leave definitions CRUD (configuration only; drives the future employee dropdown) ──
export type CountingBasis = "working_days" | "calendar_days";
export type AttachmentRequirement = "not_required" | "optional" | "required";
export type SystemLeaveType = "annual" | "sick" | "unpaid" | "other";
export type LeaveDefinition = {
  id: string; code: string; display_name: string; system_leave_type: SystemLeaveType; active: boolean;
  default_entitlement_days: number | null; counting_basis: CountingBasis; attachment_requirement: AttachmentRequirement;
  is_system: boolean; sort_order: number;
};

const LeaveDefinitionInputSchema = z.object({
  display_name: z.string().trim().min(1).max(80),
  system_leave_type: z.enum(["annual", "sick", "unpaid", "other"]),
  active: z.boolean(),
  default_entitlement_days: z.number().min(0).max(365).nullable(),
  counting_basis: z.enum(["working_days", "calendar_days"]),
  attachment_requirement: z.enum(["not_required", "optional", "required"]),
});

function slugify(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60) || "leave";
}

export async function listLeaveDefinitions(actor: Actor): Promise<LeaveDefinition[]> {
  requireAdmin(actor);
  const tenantId = requireTenant(actor);
  const supabase = createServiceRoleClient();
  const query = await supabase
    .from("leave_definitions")
    .select("id, code, display_name, system_leave_type, active, default_entitlement_days, counting_basis, attachment_requirement, is_system, sort_order")
    .eq("tenant_id", tenantId)
    .is("archived_at", null)
    .order("sort_order", { ascending: true })
    .order("display_name", { ascending: true });
  if (query.error) throw new Error(`LEAVE_DEFINITIONS_LIST_FAILED: ${query.error.message}`);
  return (query.data ?? []) as unknown as LeaveDefinition[];
}

export async function createLeaveDefinition(actor: Actor, input: unknown): Promise<void> {
  requireAdmin(actor);
  const tenantId = requireTenant(actor);
  const parsed = LeaveDefinitionInputSchema.parse(input);
  const supabase = createServiceRoleClient();
  // Unique per-tenant code derived from the name; suffix on collision.
  let code = slugify(parsed.display_name);
  const existing = await supabase.from("leave_definitions").select("code").eq("tenant_id", tenantId);
  const taken = new Set(((existing.data ?? []) as Array<{ code: string }>).map((r) => r.code));
  if (taken.has(code)) { let n = 2; while (taken.has(`${code}_${n}`)) n += 1; code = `${code}_${n}`; }
  const { error } = await supabase.from("leave_definitions").insert({
    tenant_id: tenantId, code, display_name: parsed.display_name, system_leave_type: parsed.system_leave_type,
    active: parsed.active, default_entitlement_days: parsed.default_entitlement_days, counting_basis: parsed.counting_basis,
    attachment_requirement: parsed.attachment_requirement, is_system: false, sort_order: 100,
  } as never);
  if (error) throw new Error(`LEAVE_DEFINITION_CREATE_FAILED: ${error.message}`);
}

export async function updateLeaveDefinition(actor: Actor, id: string, input: unknown): Promise<void> {
  requireAdmin(actor);
  const tenantId = requireTenant(actor);
  const parsed = LeaveDefinitionInputSchema.parse(input);
  const supabase = createServiceRoleClient();
  // System routing category is immutable for built-in definitions to keep the engine stable.
  const { error } = await supabase.from("leave_definitions").update({
    display_name: parsed.display_name, active: parsed.active, default_entitlement_days: parsed.default_entitlement_days,
    counting_basis: parsed.counting_basis, attachment_requirement: parsed.attachment_requirement,
  } as never).eq("tenant_id", tenantId).eq("id", id);
  if (error) throw new Error(`LEAVE_DEFINITION_UPDATE_FAILED: ${error.message}`);
}

// ── Company settings ─────────────────────────────────────────────────────────
export type CompanySettings = {
  id: string; name: string; country: string | null; default_timezone: string;
  default_working_days: number[]; thirty_day_check_in_enabled: boolean;
  employee_number_prefix: string | null; employee_number_separator: string; employee_number_digits: number;
  employee_number_next: number;
};

export async function getCompanySettings(actor: Actor): Promise<CompanySettings> {
  requireAdmin(actor);
  const tenantId = requireTenant(actor);
  const supabase = createServiceRoleClient();
  const query = await supabase
    .from("companies")
    .select("id, name, country, default_timezone, default_working_days, thirty_day_check_in_enabled, employee_number_prefix, employee_number_separator, employee_number_digits, employee_number_next")
    .eq("id", tenantId)
    .single();
  if (query.error) throw new Error(`COMPANY_SETTINGS_FETCH_FAILED: ${query.error.message}`);
  return query.data as unknown as CompanySettings;
}

const CompanySettingsInputSchema = z.object({
  name: z.string().trim().min(1).max(160),
  country: z.string().trim().optional(),
  default_timezone: z.string().trim().min(1).max(64),
  default_working_days: z.array(z.number().int().min(1).max(7)).min(1).max(7),
  thirty_day_check_in_enabled: z.boolean(),
  // Employee-number format (existing schema; existing issued numbers are never rewritten).
  employee_number_prefix: z.string().trim().max(12).optional(),
  employee_number_separator: z.string().max(3),
  employee_number_digits: z.number().int().min(1).max(12),
});

export async function updateCompanySettings(actor: Actor, input: unknown): Promise<void> {
  requireAdmin(actor);
  const tenantId = requireTenant(actor);
  const parsed = CompanySettingsInputSchema.parse(input);
  const iso = parsed.country ? normalizeCountryCode(parsed.country) : null;
  if (parsed.country && !iso) throw new Error("INVALID_COUNTRY");
  const supabase = createServiceRoleClient();
  // Note: employee_number_next (the running counter) is intentionally NOT touched here —
  // changing the format never renumbers already-issued employee numbers.
  const { error } = await supabase.from("companies").update({
    name: parsed.name, country: iso, default_timezone: parsed.default_timezone,
    default_working_days: parsed.default_working_days, thirty_day_check_in_enabled: parsed.thirty_day_check_in_enabled,
    employee_number_prefix: parsed.employee_number_prefix && parsed.employee_number_prefix.length > 0 ? parsed.employee_number_prefix : null,
    employee_number_separator: parsed.employee_number_separator,
    employee_number_digits: parsed.employee_number_digits,
  } as never).eq("id", tenantId);
  if (error) throw new Error(`COMPANY_SETTINGS_UPDATE_FAILED: ${error.message}`);
}

// ── Company logo ─────────────────────────────────────────────────────────────
// Stored in the private documents bucket under `<tenant>/branding/logo`; a signed URL is resolved
// at render (see lib/company/identity). Single stable object path (upsert) so old logos are not
// orphaned. Image only, ≤ 2 MB.
const LOGO_MIME = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
const LOGO_MAX_BYTES = 2 * 1024 * 1024;

export async function updateCompanyLogo(actor: Actor, file: File): Promise<void> {
  requireAdmin(actor);
  const tenantId = requireTenant(actor);
  if (!file || file.size === 0) throw new Error("LOGO_EMPTY_FILE");
  if (file.size > LOGO_MAX_BYTES) throw new Error("LOGO_TOO_LARGE");
  if (!LOGO_MIME.includes(file.type)) throw new Error("LOGO_UNSUPPORTED_TYPE");
  const bytes = Buffer.from(await file.arrayBuffer());
  const storagePath = `${tenantId}/branding/logo`;
  const supabase = createServiceRoleClient();
  const { error: uploadError } = await supabase.storage
    .from("documents")
    .upload(storagePath, bytes, { contentType: file.type, upsert: true });
  if (uploadError) throw new Error(`LOGO_UPLOAD_FAILED: ${uploadError.message}`);
  const { error } = await supabase.from("companies").update({ logo_path: storagePath } as never).eq("id", tenantId);
  if (error) throw new Error(`LOGO_SAVE_FAILED: ${error.message}`);
}

export async function removeCompanyLogo(actor: Actor): Promise<void> {
  requireAdmin(actor);
  const tenantId = requireTenant(actor);
  const supabase = createServiceRoleClient();
  await supabase.storage.from("documents").remove([`${tenantId}/branding/logo`]);
  const { error } = await supabase.from("companies").update({ logo_path: null } as never).eq("id", tenantId);
  if (error) throw new Error(`LOGO_REMOVE_FAILED: ${error.message}`);
}

export async function getCompanyLogoPath(actor: Actor): Promise<string | null> {
  requireAdmin(actor);
  const tenantId = requireTenant(actor);
  const supabase = createServiceRoleClient();
  const { data } = await supabase.from("companies").select("logo_path").eq("id", tenantId).maybeSingle();
  return (data as unknown as { logo_path: string | null } | null)?.logo_path ?? null;
}

// ── Compensation configuration ───────────────────────────────────────────────
// Company-level: choose Total-only vs Component breakdown, and manage the named components used in
// breakdown mode. Configuration only — NO payroll, tax, payslips, WPS or benchmarking. Values live
// on the employee record under the compensation capability; this is company setup, admin-gated.
export type CompensationMode = "total" | "components";
export type CompensationComponentOption = { id: string; name: string; sort_order: number; active: boolean };
export type CompensationConfig = { mode: CompensationMode; components: CompensationComponentOption[] };

export async function getCompensationConfig(actor: Actor): Promise<CompensationConfig> {
  requireAdmin(actor);
  const tenantId = requireTenant(actor);
  const supabase = createServiceRoleClient();
  const [companyRes, componentsRes] = await Promise.all([
    supabase.from("companies").select("compensation_mode").eq("id", tenantId).maybeSingle(),
    supabase.from("compensation_components").select("id, name, sort_order, active").eq("tenant_id", tenantId).order("sort_order").order("name"),
  ]);
  const mode = ((companyRes.data as unknown as { compensation_mode: string } | null)?.compensation_mode ?? "total") as CompensationMode;
  const components = (componentsRes.data ?? []) as unknown as CompensationComponentOption[];
  return { mode: mode === "components" ? "components" : "total", components };
}

export async function setCompensationMode(actor: Actor, mode: string): Promise<void> {
  requireAdmin(actor);
  const tenantId = requireTenant(actor);
  const value = mode === "components" ? "components" : "total";
  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("companies").update({ compensation_mode: value } as never).eq("id", tenantId);
  if (error) throw new Error(`COMPENSATION_MODE_UPDATE_FAILED: ${error.message}`);
}

const ComponentNameSchema = z.string().trim().min(1).max(80);

export async function createCompensationComponent(actor: Actor, name: string): Promise<void> {
  requireAdmin(actor);
  const tenantId = requireTenant(actor);
  const parsed = ComponentNameSchema.parse(name);
  const supabase = createServiceRoleClient();
  // Append to the end by sort_order.
  const { data: maxRow } = await supabase
    .from("compensation_components").select("sort_order").eq("tenant_id", tenantId).order("sort_order", { ascending: false }).limit(1).maybeSingle();
  const nextOrder = ((maxRow as unknown as { sort_order: number } | null)?.sort_order ?? 0) + 1;
  const { error } = await supabase.from("compensation_components").insert({ tenant_id: tenantId, name: parsed, sort_order: nextOrder } as never);
  if (error) throw new Error(error.message.includes("unique") || error.message.includes("duplicate") ? "COMPENSATION_COMPONENT_DUPLICATE" : `COMPENSATION_COMPONENT_CREATE_FAILED: ${error.message}`);
}

export async function renameCompensationComponent(actor: Actor, id: string, name: string): Promise<void> {
  requireAdmin(actor);
  const tenantId = requireTenant(actor);
  const parsed = ComponentNameSchema.parse(name);
  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("compensation_components").update({ name: parsed } as never).eq("tenant_id", tenantId).eq("id", id);
  if (error) throw new Error(error.message.includes("unique") || error.message.includes("duplicate") ? "COMPENSATION_COMPONENT_DUPLICATE" : `COMPENSATION_COMPONENT_RENAME_FAILED: ${error.message}`);
}

export async function setCompensationComponentActive(actor: Actor, id: string, active: boolean): Promise<void> {
  requireAdmin(actor);
  const tenantId = requireTenant(actor);
  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("compensation_components").update({ active } as never).eq("tenant_id", tenantId).eq("id", id);
  if (error) throw new Error(`COMPENSATION_COMPONENT_UPDATE_FAILED: ${error.message}`);
}
