import "server-only";

import { createServiceRoleClient } from "@/lib/db/supabaseServer";
import type {
  ActionInsertDraft,
  SignalInsertDraft,
  SignalKind,
  SignalRepository,
} from "@/services/signalEngine/contracts";

type SupabaseSignalIdRow = { id: string };

export type OpenSignalCounts = {
  red: number;
  yellow: number;
};

type ActorScope = {
  role: "admin" | "employee";
  tenantId: string | null;
};

/**
 * Read-only count of open (unresolved) risk signals for the actor's tenant,
 * split by severity. Powers the Risk Pulse element in the AppShell.
 *
 * Wave 3 note: this is the single allowed service-layer addition for the UI
 * elevation pass. One cheap round-trip — selects only the `severity` column
 * of unresolved rows (bounded at target scale of 5–20 employees) and counts
 * in memory, so red vs yellow comes from a single query.
 */
export async function countOpenSignals(actor: ActorScope): Promise<OpenSignalCounts> {
  if (actor.role !== "admin") {
    throw new Error("FORBIDDEN");
  }
  if (!actor.tenantId) {
    throw new Error("NO_TENANT_CONTEXT");
  }

  const supabase: any = createServiceRoleClient();
  const { data, error } = await supabase
    .from("risk_signals")
    .select("severity")
    .eq("tenant_id", actor.tenantId)
    .is("resolved_at", null);

  if (error) {
    throw new Error(`SIGNAL_COUNT_FAILED: ${error.message}`);
  }

  const rows = (data ?? []) as Array<{ severity: "red" | "yellow" }>;
  return {
    red: rows.filter((row) => row.severity === "red").length,
    yellow: rows.filter((row) => row.severity === "yellow").length,
  };
}

export function createSignalRepository(): SignalRepository {
  const supabase: any = createServiceRoleClient();

  return {
    async findOpenSignalId(input: { tenantId: string; employeeId: string; kind: SignalKind }): Promise<string | null> {
      const { data, error } = await supabase
        .from("risk_signals")
        .select("id")
        .eq("tenant_id", input.tenantId)
        .eq("kind", input.kind)
        .eq("subject_employee_id", input.employeeId)
        .is("resolved_at", null)
        .limit(1)
        .maybeSingle();

      if (error) {
        throw new Error(`SIGNAL_EMIT_LOOKUP_FAILED: ${error.message}`);
      }

      const row = data as SupabaseSignalIdRow | null;
      return row?.id ?? null;
    },

    async hasOpenActionForSignal(input: { tenantId: string; signalId: string }): Promise<boolean> {
      const { data, error } = await supabase
        .from("action_items")
        .select("id")
        .eq("tenant_id", input.tenantId)
        .eq("risk_signal_id", input.signalId)
        .in("status", ["open", "in_progress"])
        .limit(1)
        .maybeSingle();

      if (error) {
        throw new Error(`SIGNAL_EMIT_ACTION_LOOKUP_FAILED: ${error.message}`);
      }

      const row = data as SupabaseSignalIdRow | null;
      return Boolean(row?.id);
    },

    async createSignal(draft: SignalInsertDraft): Promise<string> {
      const { data, error } = await supabase
        .from("risk_signals")
        .insert({
          tenant_id: draft.tenant_id,
          kind: draft.kind,
          trigger_reason: draft.trigger_reason,
          severity: draft.severity,
          subject_employee_id: draft.subject_employee_id,
          evidence: draft.evidence,
          first_seen_at: draft.first_seen_at,
          last_seen_at: draft.last_seen_at,
          resolved_at: draft.resolved_at,
        })
        .select("id")
        .single();

      if (error || !data) {
        throw new Error(`SIGNAL_EMIT_INSERT_FAILED: ${error?.message ?? "no row"}`);
      }

      const row = data as SupabaseSignalIdRow;
      return row.id;
    },

    async createAction(draft: ActionInsertDraft): Promise<void> {
      const { error } = await supabase.from("action_items").insert({
        tenant_id: draft.tenant_id,
        risk_signal_id: draft.risk_signal_id,
        subject_employee_id: draft.subject_employee_id,
        category: draft.category,
        title: draft.title,
        suggested_action: draft.suggested_action,
        status: draft.status,
      });
      if (error) {
        throw new Error(`SIGNAL_EMIT_ACTION_CREATE_FAILED: ${error.message}`);
      }
    },
  };
}