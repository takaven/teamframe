/**
 * Type declarations for scripts/lib/demo-plan.mjs so the vitest suite
 * (tests/seed-demo-plan.test.ts) can import the pure plan module under
 * `tsc --noEmit` with allowJs disabled.
 */

export type DemoEmployeePlan = {
  key: string;
  full_name: string;
  email: string;
  role_title: string;
  department: string;
  timezone: string;
  status: string;
  lifecycle_state: "preboarding" | "active" | "on_leave" | "offboarding" | "exited";
  start_date: string;
  country: string;
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

export type DemoOnboardingTaskPlan = {
  employeeKey: string;
  title: string;
  status: "pending" | "completed";
  due_date: string | null;
  completed_at: string | null;
};

export type DemoPolicyPlan = {
  title: string;
  body: string;
  version: number;
  is_published: boolean;
};

export type DemoLeavePlan = {
  employeeKey: string;
  start_date: string;
  end_date: string;
  status: "pending" | "approved" | "rejected";
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
  company: { slug: string; name: string };
  employees: DemoEmployeePlan[];
  documents: DemoDocumentPlan[];
  onboardingTasks: DemoOnboardingTaskPlan[];
  policies: DemoPolicyPlan[];
  leaves: DemoLeavePlan[];
  signals: DemoSignalPlan[];
};

export declare function isoDaysFrom(now: Date, days: number): string;
export declare function dateOnlyDaysFrom(now: Date, days: number): string;
export declare function buildDemoPlan(now?: Date): DemoPlan;
