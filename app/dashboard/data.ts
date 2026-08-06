import "server-only";

import { createServiceRoleClient } from "@/lib/db/supabaseServer";
import { runSignalEngineForTenant } from "@/services/signalEngine";

export type DashboardRefreshStatus =
  | { state: "success" }
  | { state: "timeout" }
  | { state: "failed"; message: string };

export type DashboardSavedDataStatus =
  | { state: "success" }
  | { state: "timeout" }
  | { state: "failed"; message: string };

export type RiskSignalRow = {
  id: string;
  kind: string;
  severity: "red" | "yellow";
  subject_employee_id: string | null;
  evidence: {
    what_is_wrong?: string;
    why_it_matters?: string;
    what_to_do_next?: string;
    missing_policy_count?: number;
    pending_task_count?: number;
    open_action_count?: number;
    open_asset_return_count?: number;
    overlap_count?: number;
  } | null;
  last_seen_at: string;
  resolved_at: string | null;
};

export type ActionItemRow = {
  id: string;
  risk_signal_id: string;
  title: string;
  status: "open" | "in_progress" | "done" | "dismissed";
};

export type EmployeeRow = {
  id: string;
  full_name: string;
};

export type DashboardData = {
  refreshStatus: DashboardRefreshStatus;
  savedDataStatus: DashboardSavedDataStatus;
  signals: RiskSignalRow[];
  actions: ActionItemRow[];
  employees: EmployeeRow[];
};

const DASHBOARD_SIGNAL_REFRESH_TIMEOUT_MS = 4500;
const DASHBOARD_SAVED_DATA_TIMEOUT_MS = 5000;

function refreshTimeoutAfter(ms: number): Promise<DashboardRefreshStatus> {
  return new Promise((resolve) => {
    setTimeout(() => resolve({ state: "timeout" }), ms);
  });
}

function savedDataTimeoutAfter(ms: number): Promise<DashboardData> {
  return new Promise((resolve) => {
    setTimeout(
      () =>
        resolve({
          refreshStatus: { state: "success" },
          savedDataStatus: { state: "timeout" },
          signals: [],
          actions: [],
          employees: [],
        }),
      ms,
    );
  });
}

export async function refreshDashboardSignals(params: {
  tenantId: string;
  actorUserId: string;
  timeoutMs?: number;
}): Promise<DashboardRefreshStatus> {
  const timeoutMs = params.timeoutMs ?? DASHBOARD_SIGNAL_REFRESH_TIMEOUT_MS;
  try {
    return await Promise.race([
      runSignalEngineForTenant({
        tenantId: params.tenantId,
        actorUserId: params.actorUserId,
      }).then((): DashboardRefreshStatus => ({ state: "success" })),
      refreshTimeoutAfter(timeoutMs),
    ]);
  } catch (error) {
    return {
      state: "failed",
      message: error instanceof Error ? error.message : "unknown refresh failure",
    };
  }
}

export async function loadDashboardData(params: {
  tenantId: string;
  actorUserId: string;
  refreshTimeoutMs?: number;
  savedDataTimeoutMs?: number;
}): Promise<DashboardData> {
  const supabase = createServiceRoleClient();
  const refreshStatus = await refreshDashboardSignals({
    tenantId: params.tenantId,
    actorUserId: params.actorUserId,
    timeoutMs: params.refreshTimeoutMs,
  });

  const loadSavedRows = async (): Promise<DashboardData> => {
    const [{ data: signalData, error: signalError }, { data: actionData, error: actionError }, { data: employeeData, error: employeeError }] = await Promise.all([
      supabase
        .from("risk_signals")
        .select("id, kind, severity, subject_employee_id, evidence, last_seen_at, resolved_at")
        .eq("tenant_id", params.tenantId)
        .order("resolved_at", { ascending: true, nullsFirst: true })
        .order("last_seen_at", { ascending: false })
        .limit(60),
      supabase
        .from("action_items")
        .select("id, risk_signal_id, title, status")
        .eq("tenant_id", params.tenantId)
        .order("created_at", { ascending: false })
        .limit(120),
      supabase
        .from("employees")
        .select("id, full_name")
        .eq("tenant_id", params.tenantId)
        .is("deleted_at", null),
    ]);

    if (signalError) {
      throw new Error(`DASHBOARD_SIGNALS_FAILED: ${signalError.message}`);
    }
    if (actionError) {
      throw new Error(`DASHBOARD_ACTIONS_FAILED: ${actionError.message}`);
    }
    if (employeeError) {
      throw new Error(`DASHBOARD_EMPLOYEES_FAILED: ${employeeError.message}`);
    }

    return {
      refreshStatus,
      savedDataStatus: { state: "success" },
      signals: (signalData ?? []) as RiskSignalRow[],
      actions: (actionData ?? []) as ActionItemRow[],
      employees: (employeeData ?? []) as EmployeeRow[],
    };
  };

  try {
    const result = await Promise.race([
      loadSavedRows(),
      savedDataTimeoutAfter(params.savedDataTimeoutMs ?? DASHBOARD_SAVED_DATA_TIMEOUT_MS),
    ]);
    return {
      ...result,
      refreshStatus,
    };
  } catch (error) {
    return {
      refreshStatus,
      savedDataStatus: {
        state: "failed",
        message: error instanceof Error ? error.message : "unknown dashboard data failure",
      },
      signals: [],
      actions: [],
      employees: [],
    };
  }
}
