import "server-only";
import { z } from "zod";
import type { Actor } from "@/middleware/rbac";
import { createServiceRoleClient } from "@/lib/db/supabaseServer";

export type CompanySetupState = {
  id: string;
  name: string;
  country: string | null;
  location: string | null;
  annual_leave_default_days: number | null;
  sick_leave_default_days: number | null;
  setup_completed_at: string | null;
};

export type ParsedSetupPosition = {
  title: string;
  department: string;
  reportsToTitle: string | null;
};

export type ParsedSetupEmployee = {
  fullName: string;
  email: string;
  roleTitle: string;
  department: string;
  startDate: string;
};

const SetupInputSchema = z.object({
  companyName: z.string().trim().min(1).max(160),
  country: z.string().trim().min(2).max(100),
  location: z.string().trim().max(160).optional(),
  annualLeaveDefaultDays: z.coerce.number().int().min(0).max(365),
  sickLeaveDefaultDays: z.coerce.number().int().min(0).max(365),
  positionsText: z.string().trim().min(1).max(6000),
  employeesText: z.string().trim().min(1).max(8000),
});

function requireTenant(actor: Actor): string {
  if (!actor.tenantId) throw new Error("NO_TENANT_CONTEXT");
  return actor.tenantId;
}

function requireAdmin(actor: Actor): void {
  if (actor.role !== "admin") throw new Error("FORBIDDEN");
}

function normaliseTitle(value: string): string {
  return value.trim().toLowerCase();
}

function nonEmptyLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export function parseSetupPositions(value: string): ParsedSetupPosition[] {
  const lines = nonEmptyLines(value);
  if (lines.length > 25) throw new Error("SETUP_TOO_MANY_POSITIONS");

  const seen = new Set<string>();
  const positions = lines.map((line) => {
    const [titleRaw, departmentRaw, reportsToRaw] = line.split("|").map((part) => part.trim());
    if (!titleRaw || !departmentRaw) throw new Error("SETUP_POSITION_LINE_INVALID");
    const key = normaliseTitle(titleRaw);
    if (seen.has(key)) throw new Error("SETUP_POSITION_TITLE_DUPLICATE");
    seen.add(key);
    return {
      title: titleRaw,
      department: departmentRaw,
      reportsToTitle: reportsToRaw ? reportsToRaw : null,
    };
  });

  for (const position of positions) {
    if (position.reportsToTitle && !seen.has(normaliseTitle(position.reportsToTitle))) {
      throw new Error("SETUP_POSITION_PARENT_UNKNOWN");
    }
    if (position.reportsToTitle && normaliseTitle(position.reportsToTitle) === normaliseTitle(position.title)) {
      throw new Error("SETUP_POSITION_PARENT_SELF");
    }
  }

  return positions;
}

export function parseSetupEmployees(value: string): ParsedSetupEmployee[] {
  const lines = nonEmptyLines(value);
  if (lines.length > 25) throw new Error("SETUP_TOO_MANY_EMPLOYEES");

  const seenEmails = new Set<string>();
  return lines.map((line) => {
    const [fullNameRaw, emailRaw, roleTitleRaw, departmentRaw, startDateRaw] = line
      .split("|")
      .map((part) => part.trim());
    if (!fullNameRaw || !emailRaw || !roleTitleRaw || !departmentRaw || !startDateRaw) {
      throw new Error("SETUP_EMPLOYEE_LINE_INVALID");
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDateRaw)) throw new Error("SETUP_EMPLOYEE_START_DATE_INVALID");
    const email = emailRaw.toLowerCase();
    if (seenEmails.has(email)) throw new Error("SETUP_EMPLOYEE_EMAIL_DUPLICATE");
    seenEmails.add(email);
    return {
      fullName: fullNameRaw,
      email,
      roleTitle: roleTitleRaw,
      department: departmentRaw,
      startDate: startDateRaw,
    };
  });
}

export function orderPositionsForCreation(positions: ParsedSetupPosition[]): ParsedSetupPosition[] {
  const remaining = new Map(positions.map((position) => [normaliseTitle(position.title), position]));
  const created = new Set<string>();
  const ordered: ParsedSetupPosition[] = [];

  while (remaining.size > 0) {
    const next = [...remaining.values()].find(
      (position) => !position.reportsToTitle || created.has(normaliseTitle(position.reportsToTitle)),
    );
    if (!next) throw new Error("SETUP_POSITION_PARENT_CYCLE");
    const key = normaliseTitle(next.title);
    ordered.push(next);
    created.add(key);
    remaining.delete(key);
  }

  return ordered;
}

export async function getCompanySetupState(actor: Actor): Promise<CompanySetupState> {
  requireAdmin(actor);
  const tenantId = requireTenant(actor);
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("companies")
    .select("id, name, country, location, annual_leave_default_days, sick_leave_default_days, setup_completed_at")
    .eq("id", tenantId)
    .maybeSingle();

  if (error) throw new Error(`COMPANY_SETUP_FETCH_FAILED: ${error.message}`);
  if (!data) throw new Error("COMPANY_NOT_FOUND");
  return data as CompanySetupState;
}

export async function completeGuidedCompanySetup(actor: Actor, input: unknown): Promise<CompanySetupState> {
  requireAdmin(actor);
  const tenantId = requireTenant(actor);
  const current = await getCompanySetupState(actor);
  if (current.setup_completed_at) throw new Error("SETUP_ALREADY_COMPLETED");

  const parsed = SetupInputSchema.parse(input);
  const positions = parseSetupPositions(parsed.positionsText);
  const employees = parseSetupEmployees(parsed.employeesText);
  const supabase = createServiceRoleClient();
  const orderedPositions = orderPositionsForCreation(positions);

  const { data, error } = await supabase
    .rpc("teamframe_complete_guided_company_setup", {
      p_tenant_id: tenantId,
      p_actor_user_id: actor.authUserId,
      p_name: parsed.companyName,
      p_country: parsed.country,
      p_location: parsed.location ?? "",
      p_annual_leave_default_days: parsed.annualLeaveDefaultDays,
      p_sick_leave_default_days: parsed.sickLeaveDefaultDays,
      p_positions: orderedPositions,
      p_employees: employees,
    } as never)
    .single();

  if (error || !data) throw new Error(`COMPANY_SETUP_SAVE_FAILED: ${error?.message ?? "no row"}`);
  return data as CompanySetupState;
}
