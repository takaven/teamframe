import "server-only";
import { z } from "zod";
import type { Actor } from "@/middleware/rbac";
import { createServiceRoleClient } from "@/lib/db/supabaseServer";
import type { AccessCapability, AccessEffect, AccessProfile, AccessScope } from "@/lib/rbac/roles";

type ParsedUser = {
  name: string;
  email: string;
  employeeLinked: boolean;
  profile: AccessProfile;
};

type ParsedEmployee = {
  employeeNumber: string | null;
  name: string;
  preferredName: string | null;
  email: string;
  personalEmail: string | null;
  mobile: string | null;
  residentialAddress: string | null;
  dateOfBirth: string | null;
  nationality: string | null;
  title: string;
  department: string;
  managerEmail: string | null;
  startDate: string;
  starterType: "existing" | "new_starter";
  workLocation: string | null;
  country: string | null;
  employmentType: "full_time" | "part_time" | "contractor" | "intern";
  workingDaysOverride: number[] | null;
  annualLeaveEntitlementOverride: number | null;
  openingAnnualUsed: number;
  salary: number | null;
  currency: string | null;
  payBasis: "annual" | "monthly" | "hourly" | null;
  bankName: string | null;
  accountHolderName: string | null;
  accountNumberIban: string | null;
  routingSortBranchCode: string | null;
  swiftBic: string | null;
  accountCurrency: string | null;
  emergencyContactName: string | null;
  emergencyContactRelationship: string | null;
  emergencyContactPhone: string | null;
  emergencyContactEmail: string | null;
};

type ParsedHoliday = {
  date: string;
  name: string;
};

type ParsedAccessException = {
  email: string;
  capability: AccessCapability;
  effect: AccessEffect;
  scope: AccessScope;
  department: string | null;
  employeeEmail: string | null;
};

export type SetupPackPreview = {
  company: {
    name: string;
    country: string;
    location: string;
    defaultTimezone: string;
    defaultWorkingDays: number[];
    annualLeaveDefaultDays: number;
    sickLeaveDefaultDays: number;
    employeeNumberPrefix: string | null;
    employeeNumberSeparator: string;
    employeeNumberDigits: number;
    employeeNumberNext: number;
  };
  users: ParsedUser[];
  employees: ParsedEmployee[];
  holidays: ParsedHoliday[];
  accessExceptions: ParsedAccessException[];
  validationErrors: string[];
};

const CompanySchema = z.object({
  name: z.string().trim().min(1),
  country: z.string().trim().min(2),
  location: z.string().trim().min(1),
  defaultTimezone: z.string().trim().min(1),
  defaultWorkingDays: z.array(z.number().int().min(1).max(7)).min(1).max(7),
  annualLeaveDefaultDays: z.coerce.number().int().min(0).max(365),
  sickLeaveDefaultDays: z.coerce.number().int().min(0).max(365),
  employeeNumberPrefix: z.string().trim().max(20).nullable(),
  employeeNumberSeparator: z.string().trim().max(5).default("-"),
  employeeNumberDigits: z.coerce.number().int().min(1).max(12),
  employeeNumberNext: z.coerce.number().int().min(1),
});

const CAPABILITIES: readonly AccessCapability[] = [
  "people_operations",
  "compensation_view",
  "compensation_manage",
  "private_employee_documents",
  "finance_payroll_exports",
  "company_access_settings",
] as const;

function requirePlatformOwner(actor: Actor): void {
  if (!actor.isPlatformOwner) throw new Error("FORBIDDEN");
}

function parseCsvRows(input: string): string[][] {
  return input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(",").map((cell) => cell.trim()));
}

function text(value: string | undefined): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseProfile(value: string): AccessProfile {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, "_");
  if (normalized === "admin") return "admin";
  if (normalized === "finance") return "finance";
  if (normalized === "full_access" || normalized === "full access") return "full_access";
  if (normalized === "employee") return "employee";
  throw new Error(`invalid access profile: ${value}`);
}

function parseCapability(value: string): AccessCapability {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, "_");
  if ((CAPABILITIES as readonly string[]).includes(normalized)) return normalized as AccessCapability;
  throw new Error(`invalid capability: ${value}`);
}

function parseScope(value: string): AccessScope {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, "_");
  if (normalized === "whole_company") return "whole_company";
  if (normalized === "own_team") return "own_team";
  if (normalized === "department") return "department";
  if (normalized === "selected_people") return "selected_people";
  throw new Error(`invalid access scope: ${value}`);
}

function parseEffect(value: string): AccessEffect {
  const normalized = value.trim().toLowerCase();
  if (normalized === "allow" || normalized === "grant") return "allow";
  if (normalized === "restrict" || normalized === "deny" || normalized === "exclude") return "restrict";
  throw new Error(`invalid access effect: ${value}`);
}

function parseBoolean(value: string): boolean {
  return ["yes", "true", "1", "linked"].includes(value.trim().toLowerCase());
}

function parseOptionalNumber(value: string | undefined): number | null {
  const normalized = text(value);
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) throw new Error(`invalid number: ${value}`);
  return parsed;
}

function parseRequiredNumber(value: string | undefined, fallback = 0): number {
  const parsed = parseOptionalNumber(value);
  return parsed ?? fallback;
}

function emailKey(value: string): string {
  const email = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error(`invalid email: ${value}`);
  return email;
}

function assertDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`invalid date: ${value}`);
  return value;
}

function parseWorkingDays(value: string | undefined, fallback = [1, 2, 3, 4, 5]): number[] {
  const raw = text(value);
  if (!raw) return fallback;
  const aliases = new Map([
    ["mon", 1],
    ["monday", 1],
    ["tue", 2],
    ["tuesday", 2],
    ["wed", 3],
    ["wednesday", 3],
    ["thu", 4],
    ["thursday", 4],
    ["fri", 5],
    ["friday", 5],
    ["sat", 6],
    ["saturday", 6],
    ["sun", 7],
    ["sunday", 7],
  ]);
  const values = raw
    .split(/[|; ]+/)
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean)
    .map((part) => {
      const numeric = Number(part);
      if (Number.isInteger(numeric) && numeric >= 1 && numeric <= 7) return numeric;
      const alias = aliases.get(part);
      if (alias) return alias;
      throw new Error(`invalid working day: ${part}`);
    });
  const unique = [...new Set(values)].sort((a, b) => a - b);
  if (unique.length === 0) throw new Error("invalid empty workweek");
  return unique;
}

function assertTimezone(value: string): string {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format(new Date());
    return value;
  } catch {
    throw new Error(`invalid timezone: ${value}`);
  }
}

function formatEmployeeNumber(config: SetupPackPreview["company"], next: number): string {
  const prefix = config.employeeNumberPrefix ? `${config.employeeNumberPrefix}${config.employeeNumberSeparator}` : "";
  return `${prefix}${String(next).padStart(config.employeeNumberDigits, "0")}`;
}

export function parseSetupPack(input: {
  companyCsv: string;
  usersCsv?: string;
  employeesCsv: string;
  holidaysCsv?: string;
  accessExceptionsCsv?: string;
}): SetupPackPreview {
  const companyRow = parseCsvRows(input.companyCsv)[0];
  if (!companyRow || companyRow.length < 5) throw new Error("SETUP_PACK_COMPANY_INVALID");
  const company = CompanySchema.parse({
    name: companyRow[0],
    country: companyRow[1],
    location: companyRow[2],
    annualLeaveDefaultDays: companyRow[3],
    sickLeaveDefaultDays: companyRow[4],
    defaultTimezone: assertTimezone(companyRow[5] || "UTC"),
    defaultWorkingDays: parseWorkingDays(companyRow[6], [1, 2, 3, 4, 5]),
    employeeNumberPrefix: text(companyRow[7]),
    employeeNumberSeparator: companyRow[8] || "-",
    employeeNumberDigits: companyRow[9] || 4,
    employeeNumberNext: companyRow[10] || 1,
  });

  const employeeRows = parseCsvRows(input.employeesCsv);
  const employees = employeeRows.map((row) => {
    const salary = parseOptionalNumber(row[23]);
    const currency = text(row[24])?.toUpperCase() ?? null;
    const payBasis = (text(row[25]) as ParsedEmployee["payBasis"]) ?? null;
    if (salary != null && (!currency || !payBasis)) throw new Error(`compensation missing currency/pay basis: ${row[3] ?? ""}`);
    if (payBasis && !["annual", "monthly", "hourly"].includes(payBasis)) throw new Error(`invalid pay basis: ${payBasis}`);
    const starterType: ParsedEmployee["starterType"] = (row[14] ?? "existing") === "new_starter" ? "new_starter" : "existing";
    return {
      employeeNumber: text(row[0]),
      name: row[1] ?? "",
      preferredName: text(row[2]),
      email: emailKey(row[3] ?? ""),
      personalEmail: text(row[4]) ? emailKey(row[4] ?? "") : null,
      mobile: text(row[5]),
      residentialAddress: text(row[6]),
      dateOfBirth: text(row[7]) ? assertDate(row[7] ?? "") : null,
      nationality: text(row[8]),
      title: row[9] ?? "",
      department: row[10] ?? "",
      managerEmail: text(row[11]) ? emailKey(row[11] ?? "") : null,
      startDate: assertDate(row[12] ?? ""),
      employmentType: ((row[13] || "full_time") as ParsedEmployee["employmentType"]),
      starterType,
      workLocation: text(row[15]) ?? company.location,
      country: text(row[16]) ?? company.country,
      workingDaysOverride: text(row[17]) ? parseWorkingDays(row[17], company.defaultWorkingDays) : null,
      annualLeaveEntitlementOverride: parseOptionalNumber(row[18]),
      openingAnnualUsed: parseRequiredNumber(row[19], 0),
      emergencyContactName: text(row[20]),
      emergencyContactRelationship: text(row[21]),
      emergencyContactPhone: text(row[22]),
      salary,
      currency,
      payBasis,
      bankName: text(row[26]),
      accountHolderName: text(row[27]),
      accountNumberIban: text(row[28]),
      routingSortBranchCode: text(row[29]),
      swiftBic: text(row[30]),
      accountCurrency: text(row[31])?.toUpperCase() ?? currency,
      emergencyContactEmail: text(row[32]) ? emailKey(row[32] ?? "") : null,
    };
  });

  const userRows = parseCsvRows(input.usersCsv ?? "");
  const users = userRows.map((row) => ({
    name: row[0] ?? "",
    email: emailKey(row[1] ?? ""),
    employeeLinked: parseBoolean(row[2] ?? ""),
    profile: parseProfile(row[3] ?? "employee"),
  }));

  for (const employee of employees) {
    if (!users.some((user) => user.email === employee.email)) {
      users.push({
        name: employee.name,
        email: employee.email,
        employeeLinked: true,
        profile: "employee",
      });
    }
  }

  const holidays = parseCsvRows(input.holidaysCsv ?? "").map((row) => ({
    date: assertDate(row[0] ?? ""),
    name: row[1] ?? "",
  }));

  const accessExceptions = parseCsvRows(input.accessExceptionsCsv ?? "").map((row) => ({
    email: emailKey(row[0] ?? ""),
    capability: parseCapability(row[1] ?? ""),
    effect: parseEffect(row[2] ?? ""),
    scope: parseScope(row[3] ?? "whole_company"),
    department: text(row[4]),
    employeeEmail: text(row[5]) ? emailKey(row[5] ?? "") : null,
  }));

  const validationErrors: string[] = [];
  const employeeEmails = new Set<string>();
  const employeeNumbers = new Set<string>();
  for (const employee of employees) {
    if (!employee.name || !employee.title || !employee.department) validationErrors.push(`missing employee required field: ${employee.email}`);
    if (employeeEmails.has(employee.email)) validationErrors.push(`duplicate employee: ${employee.email}`);
    employeeEmails.add(employee.email);
    if (employee.employeeNumber) {
      if (employeeNumbers.has(employee.employeeNumber)) validationErrors.push(`duplicate employee number: ${employee.employeeNumber}`);
      employeeNumbers.add(employee.employeeNumber);
    }
    if (employee.managerEmail && !employees.some((candidate) => candidate.email === employee.managerEmail)) {
      validationErrors.push(`unknown manager: ${employee.managerEmail}`);
    }
    if (employee.openingAnnualUsed < 0) validationErrors.push(`invalid leave adjustment: ${employee.email}`);
    if (employee.annualLeaveEntitlementOverride != null && employee.annualLeaveEntitlementOverride < 0) {
      validationErrors.push(`invalid annual entitlement: ${employee.email}`);
    }
  }

  const userEmails = new Set<string>();
  for (const user of users) {
    if (userEmails.has(user.email)) validationErrors.push(`duplicate access user: ${user.email}`);
    userEmails.add(user.email);
    if (user.employeeLinked && !employeeEmails.has(user.email)) validationErrors.push(`linked access user has no employee: ${user.email}`);
  }

  const holidaysByDate = new Set<string>();
  for (const holiday of holidays) {
    if (!holiday.name) validationErrors.push(`holiday name required: ${holiday.date}`);
    if (holidaysByDate.has(holiday.date)) validationErrors.push(`duplicate holiday: ${holiday.date}`);
    holidaysByDate.add(holiday.date);
  }

  const managerByEmployee = new Map(employees.map((employee) => [employee.email, employee.managerEmail]));
  for (const employee of employees) {
    const seen = new Set<string>();
    let current: string | null = employee.email;
    while (current) {
      if (seen.has(current)) {
        validationErrors.push(`manager reporting cycle: ${employee.email}`);
        break;
      }
      seen.add(current);
      current = managerByEmployee.get(current) ?? null;
    }
  }

  for (const exception of accessExceptions) {
    if (!userEmails.has(exception.email)) validationErrors.push(`access exception user not staged: ${exception.email}`);
    if (exception.scope === "department" && !exception.department) validationErrors.push(`department scope missing department: ${exception.email}`);
    if (exception.scope === "selected_people" && !exception.employeeEmail) validationErrors.push(`selected people scope missing employee: ${exception.email}`);
    if (exception.employeeEmail && !employeeEmails.has(exception.employeeEmail)) {
      validationErrors.push(`access exception target employee unknown: ${exception.employeeEmail}`);
    }
  }

  if (!users.some((user) => user.profile === "full_access")) {
    validationErrors.push("at least one Full Access user is required");
  }

  return { company, users, employees, holidays, accessExceptions, validationErrors };
}

export async function recordSetupPackPreview(
  actor: Actor,
  input: {
    tenantId?: string | null;
    fileName: string;
    companyCsv: string;
    usersCsv?: string;
    employeesCsv: string;
    holidaysCsv?: string;
    accessExceptionsCsv?: string;
  },
): Promise<{ id: string; preview: SetupPackPreview }> {
  requirePlatformOwner(actor);
  const preview = parseSetupPack(input);
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("setup_import_batches")
    .insert({
      tenant_id: input.tenantId ?? null,
      uploaded_by_user_id: actor.authUserId,
      file_name: input.fileName,
      state: preview.validationErrors.length > 0 ? "invalid" : "validated",
      validation_errors: preview.validationErrors,
      preview,
    } as never)
    .select("id")
    .single();
  if (error || !data) throw new Error(`SETUP_PACK_PREVIEW_FAILED: ${error?.message ?? "no row"}`);
  return { id: (data as { id: string }).id, preview };
}

export async function commitSetupPack(actor: Actor, batchId: string): Promise<string> {
  requirePlatformOwner(actor);
  const supabase = createServiceRoleClient();
  const { data: batch, error: batchError } = await supabase
    .from("setup_import_batches")
    .select("id, tenant_id, state, preview")
    .eq("id", batchId)
    .maybeSingle();
  if (batchError) throw new Error(`SETUP_PACK_LOOKUP_FAILED: ${batchError.message}`);
  if (!batch) throw new Error("SETUP_PACK_NOT_FOUND");
  const preview = (batch as { preview: SetupPackPreview; state: string }).preview;
  if ((batch as { state: string }).state !== "validated" || preview.validationErrors.length > 0) {
    throw new Error("SETUP_PACK_INVALID");
  }

  let tenantId: string | null = (batch as { tenant_id?: string | null }).tenant_id ?? null;
  let createdTenant = false;
  const now = new Date().toISOString();
  const slug = preview.company.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  try {
    if (tenantId) {
      const { error } = await supabase
        .from("companies")
        .update({
          name: preview.company.name,
          country: preview.company.country,
          location: preview.company.location,
          default_timezone: preview.company.defaultTimezone,
          default_working_days: preview.company.defaultWorkingDays,
          annual_leave_default_days: preview.company.annualLeaveDefaultDays,
          sick_leave_default_days: preview.company.sickLeaveDefaultDays,
          employee_number_prefix: preview.company.employeeNumberPrefix,
          employee_number_separator: preview.company.employeeNumberSeparator,
          employee_number_digits: preview.company.employeeNumberDigits,
          employee_number_next: preview.company.employeeNumberNext,
          setup_state: "active",
          status: "active",
          intake_completed_at: now,
          setup_due_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
          activated_at: now,
          setup_completed_at: now,
          setup_completed_by: actor.authUserId,
        } as never)
        .eq("id", tenantId);
      if (error) throw new Error(`SETUP_COMPANY_UPDATE_FAILED: ${error.message}`);
    } else {
      const { data: company, error } = await supabase
        .from("companies")
        .insert({
          name: preview.company.name,
          slug: `${slug}-${Date.now()}`,
          country: preview.company.country,
          location: preview.company.location,
          default_timezone: preview.company.defaultTimezone,
          default_working_days: preview.company.defaultWorkingDays,
          annual_leave_default_days: preview.company.annualLeaveDefaultDays,
          sick_leave_default_days: preview.company.sickLeaveDefaultDays,
          employee_number_prefix: preview.company.employeeNumberPrefix,
          employee_number_separator: preview.company.employeeNumberSeparator,
          employee_number_digits: preview.company.employeeNumberDigits,
          employee_number_next: preview.company.employeeNumberNext,
          setup_state: "active",
          status: "active",
          intake_completed_at: now,
          setup_due_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
          activated_at: now,
          setup_completed_at: now,
          setup_completed_by: actor.authUserId,
        } as never)
        .select("id")
        .single();
      if (error || !company) throw new Error(`SETUP_COMPANY_CREATE_FAILED: ${error?.message ?? "no row"}`);
      tenantId = (company as { id: string }).id;
      createdTenant = true;
    }

    const employeeIds = new Map<string, string>();
    let nextNumber = preview.company.employeeNumberNext;
    for (const employee of preview.employees) {
      const employeeNumber = employee.employeeNumber ?? formatEmployeeNumber(preview.company, nextNumber++);
      const { data: created, error } = await supabase
        .rpc("teamframe_create_employee", {
          p_tenant_id: tenantId,
          p_actor_user_id: actor.authUserId,
          p_full_name: employee.name,
          p_email: employee.email,
          p_role_title: employee.title,
          p_department: employee.department,
          p_timezone: preview.company.defaultTimezone,
          p_employment_type: employee.employmentType,
          p_country: employee.country ?? preview.company.country,
          p_start_date: employee.startDate,
          p_end_date: null,
          p_manager_id: null,
          p_grade: null,
          p_status: "active",
          p_setup_status: employee.starterType === "existing" ? "active" : "incomplete",
        } as never)
        .single();
      if (error || !created) throw new Error(`SETUP_EMPLOYEE_CREATE_FAILED: ${error?.message ?? employee.email}`);
      const employeeId = (created as { id: string }).id;
      employeeIds.set(employee.email, employeeId);

      const { error: profileError } = await supabase
        .from("employees")
        .update({
          employee_number: employeeNumber,
          preferred_name: employee.preferredName,
          personal_email: employee.personalEmail,
          mobile: employee.mobile,
          residential_address: employee.residentialAddress,
          date_of_birth: employee.dateOfBirth,
          nationality: employee.nationality,
          work_location: employee.workLocation,
          working_days_override: employee.workingDaysOverride,
          annual_leave_entitlement_override: employee.annualLeaveEntitlementOverride,
          emergency_contact_name: employee.emergencyContactName,
          emergency_contact_relationship: employee.emergencyContactRelationship,
          emergency_contact_phone: employee.emergencyContactPhone,
          emergency_contact_email: employee.emergencyContactEmail,
        } as never)
        .eq("tenant_id", tenantId)
        .eq("id", employeeId);
      if (profileError) throw new Error(`SETUP_EMPLOYEE_PROFILE_FAILED: ${profileError.message}`);

      if (employee.salary != null && employee.currency && employee.payBasis) {
        const { error: compensationError } = await supabase.from("compensation").upsert({
          tenant_id: tenantId,
          employee_id: employeeId,
          base_salary: employee.salary,
          currency: employee.currency,
          pay_basis: employee.payBasis,
          grade_band: null,
        } as never);
        if (compensationError) throw new Error(`SETUP_COMPENSATION_CREATE_FAILED: ${compensationError.message}`);
      }

      if (employee.accountNumberIban || employee.bankName || employee.accountHolderName) {
        const { error: paymentError } = await supabase.from("employee_payment_details").upsert({
          tenant_id: tenantId,
          employee_id: employeeId,
          account_holder_name: employee.accountHolderName,
          bank_name: employee.bankName,
          account_number_iban: employee.accountNumberIban,
          routing_sort_branch_code: employee.routingSortBranchCode,
          swift_bic: employee.swiftBic,
          account_currency: employee.accountCurrency,
        } as never);
        if (paymentError) throw new Error(`SETUP_PAYMENT_DETAILS_FAILED: ${paymentError.message}`);
      }
    }

    await supabase
      .from("companies")
      .update({ employee_number_next: nextNumber } as never)
      .eq("id", tenantId);

    for (const employee of preview.employees) {
      if (!employee.managerEmail) continue;
      const employeeId = employeeIds.get(employee.email);
      const managerId = employeeIds.get(employee.managerEmail);
      if (!employeeId || !managerId) throw new Error("SETUP_MANAGER_LINK_FAILED");
      const { error } = await supabase.from("employees").update({ manager_id: managerId } as never).eq("tenant_id", tenantId).eq("id", employeeId);
      if (error) throw new Error(`SETUP_MANAGER_LINK_FAILED: ${error.message}`);
    }

    for (const holiday of preview.holidays) {
      const { error } = await supabase.from("company_holidays").upsert({
        tenant_id: tenantId,
        holiday_date: holiday.date,
        name: holiday.name,
      } as never);
      if (error) throw new Error(`SETUP_HOLIDAY_FAILED: ${error.message}`);
    }

    const invitationIds = new Map<string, string>();
    for (const user of preview.users) {
      const employeeId = user.employeeLinked ? employeeIds.get(user.email) ?? null : null;
      const { data: invitation, error } = await supabase
        .from("tenant_access_invitations")
        .upsert(
          {
            tenant_id: tenantId,
            employee_id: employeeId,
            email: user.email,
            display_name: user.name,
            profile: user.profile,
            active: true,
            invited_by_user_id: actor.authUserId,
          } as never,
          { onConflict: "tenant_id,email" },
        )
        .select("id")
        .single();
      if (error || !invitation) throw new Error(`SETUP_ACCESS_STAGE_FAILED: ${error?.message ?? user.email}`);
      invitationIds.set(user.email, (invitation as { id: string }).id);
    }

    for (const exception of preview.accessExceptions) {
      const invitationId = invitationIds.get(exception.email);
      if (!invitationId) throw new Error(`SETUP_ACCESS_EXCEPTION_STAGE_FAILED: ${exception.email}`);
      const targetEmployeeId = exception.employeeEmail ? employeeIds.get(exception.employeeEmail) ?? null : null;
      const { error } = await supabase.from("tenant_access_invitation_rules").insert({
        tenant_id: tenantId,
        invitation_id: invitationId,
        capability: exception.capability,
        effect: exception.effect,
        scope: exception.scope,
        department: exception.scope === "department" ? exception.department : null,
        employee_id: exception.scope === "selected_people" ? targetEmployeeId : null,
        created_by_user_id: actor.authUserId,
      } as never);
      if (error) throw new Error(`SETUP_ACCESS_EXCEPTION_STAGE_FAILED: ${error.message}`);
    }

    for (const employee of preview.employees) {
      const employeeId = employeeIds.get(employee.email);
      if (!employeeId || employee.openingAnnualUsed <= 0) continue;
      const { error } = await supabase.from("leave_opening_adjustments").upsert({
        tenant_id: tenantId,
        employee_id: employeeId,
        period_year: new Date(employee.startDate).getUTCFullYear(),
        leave_type: "annual",
        used_days: employee.openingAnnualUsed,
        note: "Opening balance from setup import",
        created_by_user_id: actor.authUserId,
      } as never);
      if (error) throw new Error(`SETUP_LEAVE_OPENING_FAILED: ${error.message}`);
    }

    await supabase
      .from("setup_import_batches")
      .update({ tenant_id: tenantId, state: "committed", committed_at: new Date().toISOString() } as never)
      .eq("id", batchId);
    return tenantId;
  } catch (error) {
    if (tenantId && createdTenant) {
      await supabase.from("companies").delete().eq("id", tenantId);
    }
    await supabase
      .from("setup_import_batches")
      .update({
        state: "failed",
        validation_errors: [error instanceof Error ? error.message : "SETUP_PACK_COMMIT_FAILED"],
      } as never)
      .eq("id", batchId);
    throw error;
  }
}
