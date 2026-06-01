export type SignalSeverity = "red" | "yellow";

export type SignalKind =
  | "missing_contract"
  | "expired_document"
  | "expiring_document"
  | "unacknowledged_policy"
  | "incomplete_onboarding"
  | "incomplete_offboarding"
  | "active_access_after_exit"
  | "unreturned_asset"
  | "missing_jurisdiction_requirement"
  | "leave_conflict";

export type EmployeeLifecycleState = "preboarding" | "active" | "on_leave" | "offboarding" | "exited";

export type EmployeeOffboardingStateRow = {
  id: string;
  tenant_id: string;
  lifecycle_state: EmployeeLifecycleState;
  status: "active" | "on_leave" | "inactive";
};

export type EmployeeDocumentStateRow = {
  id: string;
  tenant_id: string;
  employee_id: string;
  document_type: string | null;
  signed_at: string | null;
  expires_at: string | null;
};

export type EmployeeActionStateRow = {
  id: string;
  tenant_id: string;
  risk_signal_id: string;
  subject_employee_id: string | null;
  category: string;
  status: "open" | "in_progress" | "done" | "dismissed";
};

export type RiskSignalRow = {
  id: string;
  tenant_id: string;
  kind: SignalKind;
  severity: SignalSeverity;
  subject_employee_id: string | null;
  resolved_at: string | null;
  last_seen_at: string;
};

export type SignalEmitRequest = {
  tenant_id: string;
  employee_id: string;
  kind: SignalKind;
  status: "open" | "in_progress" | "done" | "dismissed";
};

export type SignalInsertDraft = {
  tenant_id: string;
  kind: SignalKind;
  trigger_reason: string;
  severity: SignalSeverity;
  subject_employee_id: string;
  evidence: Record<string, unknown>;
  first_seen_at: string;
  last_seen_at: string;
  resolved_at: null;
};

export type ActionInsertDraft = {
  tenant_id: string;
  risk_signal_id: string;
  subject_employee_id: string;
  category: string;
  title: string;
  suggested_action: string;
  status: "open";
};

export type EmitOffboardingPlan = {
  existingSignalId: string | null;
  shouldCreateSignal: boolean;
  shouldCreateAction: boolean;
  signalDraft: SignalInsertDraft;
  actionDraft: Omit<ActionInsertDraft, "risk_signal_id">;
};

export type SignalRepository = {
  findOpenSignalId(input: { tenantId: string; employeeId: string; kind: SignalKind }): Promise<string | null>;
  hasOpenActionForSignal(input: { tenantId: string; signalId: string }): Promise<boolean>;
  createSignal(draft: SignalInsertDraft): Promise<string>;
  createAction(draft: ActionInsertDraft): Promise<void>;
};