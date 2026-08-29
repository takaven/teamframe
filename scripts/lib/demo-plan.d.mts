/**
 * Type declarations for scripts/lib/demo-plan.mjs so the vitest suite
 * (tests/seed-demo-plan.test.ts) can import the pure plan module under
 * `tsc --noEmit` with allowJs disabled.
 */

export type DemoCompanyPlan = {
  slug: string;
  name: string;
  country: string;
  location: string;
  default_timezone: string;
  annual_leave_default_days: number;
  sick_leave_default_days: number;
  employee_number_prefix: string;
};

export type DemoDepartmentPlan = {
  name: string;
  active: boolean;
};

export type DemoLeaveDefinitionPlan = {
  code: string;
  display_name: string;
  system_leave_type: "annual" | "sick" | "unpaid" | "other";
  default_entitlement_days: number | null;
  counting_basis: "working_days" | "calendar_days";
  attachment_requirement: "not_required" | "optional" | "required";
  is_system: boolean;
  sort_order: number;
};

export type DemoEmployeePlan = {
  key: string;
  full_name: string;
  email: string;
  employee_number: string;
  role_title: string;
  department: string;
  managerKey: string | null;
  employment_type: "full_time" | "part_time" | "contractor" | "intern";
  timezone: string;
  status: "active" | "on_leave" | "inactive";
  setup_status: "incomplete" | "ready" | "active";
  lifecycle_state: "preboarding" | "active" | "on_leave" | "offboarding" | "exited";
  start_date: string;
  country: string;
};

export type DemoPositionPlan = {
  key: string;
  title: string;
  department: string;
  parentKey: string | null;
  employeeKey: string | null;
  budgeted: boolean;
};

export type DemoDocumentPlan = {
  key: string;
  employeeKey: string;
  document_type: string;
  type: string;
  file_name: string;
  signed_at: string | null;
  expires_at: string | null;
};

export type DemoDocumentRequirementPlan = {
  employeeKey: string;
  document_type: string;
  due_date: string | null;
  expiry_required: boolean;
  review_required: boolean;
  employee_upload_allowed: boolean;
  state: "requested" | "received" | "accepted" | "rejected" | "expired" | "replaced" | "cancelled";
  requested_at: string;
};

export type DemoOnboardingTaskPlan = {
  employeeKey: string;
  title: string;
  status: "pending" | "completed";
  owner_role: "employee" | "manager" | "admin" | "system";
  completion_mode:
    | "manual_confirmation"
    | "document_required"
    | "policy_acknowledgement"
    | "form_or_data_required";
  required_document_type: string | null;
  due_date: string | null;
  completed_at: string | null;
};

export type DemoPolicyPlan = {
  key: string;
  title: string;
  body: string;
  version: number;
  is_published: boolean;
  effective_date: string;
};

export type DemoAcknowledgementPlan = {
  policyKey: string;
  employeeKey: string;
  acknowledged_at: string;
};

export type DemoLeavePlan = {
  employeeKey: string;
  definitionCode: string;
  leave_type: "annual" | "sick" | "unpaid" | "other";
  start_date: string;
  end_date: string;
  requested_days: number;
  reason: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled";
};

export type DemoProbationReviewPlan = {
  employeeKey: string;
  probation_end_date: string;
  review_due_date: string;
  status: "scheduled" | "due" | "completed" | "cancelled" | "suppressed";
  outcome: "confirmed" | "extended" | "employment_ending" | null;
  outcome_notes: string | null;
  completed_at: string | null;
};

export type DemoEmploymentChangePlan = {
  employeeKey: string;
  effective_date: string;
  status: "pending" | "applied" | "cancelled" | "superseded" | "failed";
  change_keys: string[];
  old_values: Record<string, string>;
  new_values: Record<string, string>;
  idempotency_key: string;
  recorded_at: string;
  applied_at: string | null;
  applied_by_actor_type: "human" | "system" | null;
};

export type DemoSignalPlan = {
  kind: string;
  severity: "red" | "yellow";
  employeeKey: string;
  documentKey: string | null;
  action_title: string;
  action_status: "open" | "in_progress" | "done" | "dismissed";
  resolved_at: string | null;
  evidence: {
    what_is_wrong: string;
    why_it_matters: string;
    what_to_do_next: string;
  };
};

export type DemoPlan = {
  company: DemoCompanyPlan;
  adminEmployeeKey: string;
  departments: DemoDepartmentPlan[];
  leaveDefinitions: DemoLeaveDefinitionPlan[];
  employees: DemoEmployeePlan[];
  positions: DemoPositionPlan[];
  documents: DemoDocumentPlan[];
  documentRequirements: DemoDocumentRequirementPlan[];
  onboardingTasks: DemoOnboardingTaskPlan[];
  policies: DemoPolicyPlan[];
  acknowledgements: DemoAcknowledgementPlan[];
  leaves: DemoLeavePlan[];
  probationReviews: DemoProbationReviewPlan[];
  employmentChanges: DemoEmploymentChangePlan[];
  signals: DemoSignalPlan[];
};

export declare function isoDaysFrom(now: Date, days: number): string;
export declare function dateOnlyDaysFrom(now: Date, days: number): string;
export declare function buildDemoPlan(now?: Date): DemoPlan;
