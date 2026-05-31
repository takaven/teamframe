import "server-only";

import { createServiceRoleClient } from "@/lib/db/supabaseServer";
import type {
  ActionInsertDraft,
  SignalInsertDraft,
  SignalKind,
  SignalRepository,
} from "@/services/signalEngine/contracts";

type SupabaseSignalIdRow = { id: string };

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
        .insert(draft)
        .select("id")
        .single();

      if (error || !data) {
        throw new Error(`SIGNAL_EMIT_INSERT_FAILED: ${error?.message ?? "no row"}`);
      }

      const row = data as SupabaseSignalIdRow;
      return row.id;
    },

    async createAction(draft: ActionInsertDraft): Promise<void> {
      const { error } = await supabase.from("action_items").insert(draft);
      if (error) {
        throw new Error(`SIGNAL_EMIT_ACTION_CREATE_FAILED: ${error.message}`);
      }
    },
  };
}