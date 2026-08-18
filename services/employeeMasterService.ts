import "server-only";
import type { Actor } from "@/middleware/rbac";
import { createServiceRoleClient } from "@/lib/db/supabaseServer";
import {
  canReadEmployeeProfile,
  canReadOwnEmployeeRecord,
  canViewCompensation,
  canRunFinanceExport,
} from "@/lib/rbac/access";

/**
 * Employee master record — READ composition (Phase 2 foundation for the 2B UI).
 *
 * Exposes the master fields that already exist in the schema, organised into
 * sections, and composes the EXISTING capability gates for the confidential blocks.
 * It does NOT change the access model: compensation follows `compensation_view`;
 * payment/bank details follow finance entitlement (or the employee's own record);
 * ordinary People-Ops/Admin without those entitlements get null + a `canView*` = false
 * flag rather than the data.
 */

type EmployeeMasterRow = {
  id: string; employee_number: string | null; full_name: string; preferred_name: string | null;
  email: string; personal_email: string | null; mobile: string | null; company_phone: string | null;
  residential_address: string | null; date_of_birth: string | null; gender: string | null; nationality: string | null;
  work_location: string | null; work_location_id: string | null; country: string | null; timezone: string;
  role_title: string; department: string; department_id: string | null; manager_id: string | null;
  employment_type: string; status: string; lifecycle_state: string; start_date: string | null; end_date: string | null;
  grade: string | null; working_days_override: number[] | null; annual_leave_entitlement_override: number | null;
  emergency_contact_name: string | null; emergency_contact_relationship: string | null;
  emergency_contact_phone: string | null; emergency_contact_email: string | null;
};
type CompensationRow = { base_salary: number | null; currency: string | null; pay_basis: string | null; grade_band: string | null };
type PaymentRow = {
  account_holder_name: string | null; bank_name: string | null; account_number_iban: string | null;
  routing_sort_branch_code: string | null; swift_bic: string | null; account_currency: string | null;
};

export type EmployeeMasterRecord = {
  identity: {
    id: string;
    employee_number: string | null;
    full_name: string;
    preferred_name: string | null;
    photo_url: string | null;
    date_of_birth: string | null;
    gender: string | null;
    nationality: string | null;
  };
  contact: {
    personal_email: string | null;
    personal_phone: string | null; // employees.mobile
    company_email: string; // employees.email
    company_phone: string | null;
    residential_address: string | null;
  };
  employment: {
    role_title: string;
    department: string;
    department_id: string | null;
    manager_id: string | null;
    country: string | null;
    work_location: string | null;
    work_location_id: string | null;
    timezone: string;
    employment_type: string;
    start_date: string | null;
    end_date: string | null;
    lifecycle_state: string;
    status: string;
    grade: string | null;
    working_days_override: number[] | null;
    annual_leave_entitlement_override: number | null;
  };
  emergency_contact: {
    name: string | null;
    relationship: string | null;
    phone: string | null;
    email: string | null;
  };
  compensation: {
    canView: boolean;
    base_salary: number | null;
    currency: string | null;
    pay_basis: string | null;
    grade_band: string | null;
  };
  payment_details: {
    canView: boolean;
    account_holder_name: string | null;
    bank_name: string | null;
    account_number_iban: string | null;
    routing_sort_branch_code: string | null;
    swift_bic: string | null;
    account_currency: string | null;
  };
};

export async function getEmployeeMasterRecord(actor: Actor, employeeId: string): Promise<EmployeeMasterRecord> {
  if (!actor.tenantId) throw new Error("NO_TENANT_CONTEXT");
  if (!(await canReadEmployeeProfile(actor, employeeId))) throw new Error("FORBIDDEN");

  const supabase = createServiceRoleClient();
  const empQuery = await supabase
    .from("employees")
    .select(
      "id, tenant_id, employee_number, full_name, preferred_name, email, personal_email, mobile, company_phone, residential_address, date_of_birth, gender, nationality, work_location, work_location_id, country, timezone, role_title, department, department_id, manager_id, employment_type, status, lifecycle_state, start_date, end_date, grade, working_days_override, annual_leave_entitlement_override, emergency_contact_name, emergency_contact_relationship, emergency_contact_phone, emergency_contact_email",
    )
    .eq("tenant_id", actor.tenantId)
    .eq("id", employeeId)
    .is("deleted_at", null)
    .maybeSingle();
  if (empQuery.error) throw new Error(`EMPLOYEE_MASTER_FETCH_FAILED: ${empQuery.error.message}`);
  // Cast: several master fields are newer than the generated Supabase types.
  const emp = empQuery.data as unknown as EmployeeMasterRow | null;
  if (!emp) throw new Error("NOT_FOUND");

  const profileQuery = await supabase
    .from("employee_profiles")
    .select("photo_url")
    .eq("tenant_id", actor.tenantId)
    .eq("employee_id", employeeId)
    .maybeSingle();
  const profile = profileQuery.data as unknown as { photo_url: string | null } | null;

  const canComp = await canViewCompensation(actor, employeeId);
  const canPay = (await canReadOwnEmployeeRecord(actor, employeeId)) || (await canRunFinanceExport(actor));

  let comp: CompensationRow = { base_salary: null, currency: null, pay_basis: null, grade_band: null };
  if (canComp) {
    const compQuery = await supabase
      .from("compensation")
      .select("base_salary, currency, pay_basis, grade_band")
      .eq("tenant_id", actor.tenantId)
      .eq("employee_id", employeeId)
      .maybeSingle();
    const data = compQuery.data as unknown as CompensationRow | null;
    if (data) comp = data;
  }

  let pay: PaymentRow = {
    account_holder_name: null, bank_name: null, account_number_iban: null,
    routing_sort_branch_code: null, swift_bic: null, account_currency: null,
  };
  if (canPay) {
    const payQuery = await supabase
      .from("employee_payment_details")
      .select("account_holder_name, bank_name, account_number_iban, routing_sort_branch_code, swift_bic, account_currency")
      .eq("tenant_id", actor.tenantId)
      .eq("employee_id", employeeId)
      .maybeSingle();
    const data = payQuery.data as unknown as PaymentRow | null;
    if (data) pay = data;
  }

  return {
    identity: {
      id: emp.id, employee_number: emp.employee_number, full_name: emp.full_name, preferred_name: emp.preferred_name,
      photo_url: profile?.photo_url ?? null, date_of_birth: emp.date_of_birth, gender: emp.gender, nationality: emp.nationality,
    },
    contact: {
      personal_email: emp.personal_email, personal_phone: emp.mobile, company_email: emp.email,
      company_phone: emp.company_phone, residential_address: emp.residential_address,
    },
    employment: {
      role_title: emp.role_title, department: emp.department, department_id: emp.department_id, manager_id: emp.manager_id,
      country: emp.country, work_location: emp.work_location, work_location_id: emp.work_location_id, timezone: emp.timezone,
      employment_type: emp.employment_type, start_date: emp.start_date, end_date: emp.end_date,
      lifecycle_state: emp.lifecycle_state, status: emp.status, grade: emp.grade,
      working_days_override: emp.working_days_override, annual_leave_entitlement_override: emp.annual_leave_entitlement_override,
    },
    emergency_contact: {
      name: emp.emergency_contact_name, relationship: emp.emergency_contact_relationship,
      phone: emp.emergency_contact_phone, email: emp.emergency_contact_email,
    },
    compensation: { canView: canComp, ...comp },
    payment_details: { canView: canPay, ...pay },
  };
}

/** Presentation helper: single reliable avatar source with initials fallback. */
export function resolveAvatar(input: { full_name: string; photo_url?: string | null }): { photoUrl: string | null; initials: string } {
  const parts = input.full_name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1] ?? "" : "";
  const initials = (first.charAt(0) + last.charAt(0)).toUpperCase() || "?";
  return { photoUrl: input.photo_url ?? null, initials };
}
