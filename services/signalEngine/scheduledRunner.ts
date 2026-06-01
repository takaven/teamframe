import "server-only";

import { createServiceRoleClient } from "@/lib/db/supabaseServer";
import { runSignalEngineForTenant, type SignalEngineRunResult } from "@/services/signalEngine";

export type ScheduledSignalRunResult = {
  tenantsProcessed: number;
  results: Array<{ tenantId: string; result: SignalEngineRunResult }>;
};

export async function runSignalsForAllTenants(params?: {
  now?: Date;
  actorUserId?: string;
}): Promise<ScheduledSignalRunResult> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("companies")
    .select("id")
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`SIGNAL_SCHEDULE_TENANT_QUERY_FAILED: ${error.message}`);
  }

  const results: Array<{ tenantId: string; result: SignalEngineRunResult }> = [];
  for (const row of (data ?? []) as Array<{ id: string }>) {
    const result = await runSignalEngineForTenant({
      tenantId: row.id,
      actorUserId: params?.actorUserId,
      now: params?.now,
    });
    results.push({ tenantId: row.id, result });
  }

  return {
    tenantsProcessed: results.length,
    results,
  };
}
