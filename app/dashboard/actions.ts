"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createServiceRoleClient } from "@/lib/db/supabaseServer";
import { requireTenantRole } from "@/middleware/rbac";
import { runSignalEngineForTenant } from "@/services/signalEngine";

const ExecuteActionSchema = z.object({
  actionItemId: z.string().uuid(),
  nextStatus: z.enum(["in_progress", "done"]),
});

export async function executeActionItemAction(formData: FormData): Promise<void> {
  const actor = await requireTenantRole("admin");
  const parsed = ExecuteActionSchema.safeParse({
    actionItemId: String(formData.get("actionItemId") ?? ""),
    nextStatus: String(formData.get("nextStatus") ?? ""),
  });

  if (!parsed.success) {
    throw new Error("INVALID_INPUT");
  }

  const supabase = createServiceRoleClient();
  const nowIso = new Date().toISOString();

  const { data: actionItem, error: actionQueryError } = await supabase
    .from("action_items")
    .select("id, tenant_id, status")
    .eq("tenant_id", actor.tenantId)
    .eq("id", parsed.data.actionItemId)
    .maybeSingle();

  if (actionQueryError) {
    throw new Error(`DASHBOARD_ACTION_ITEM_QUERY_FAILED: ${actionQueryError.message}`);
  }

  if (!actionItem) {
    throw new Error("ACTION_ITEM_NOT_FOUND");
  }

  if (parsed.data.nextStatus === "in_progress") {
    const { error: actionUpdateError } = await supabase
      .from("action_items")
      .update({
        status: "in_progress",
      } as never)
      .eq("tenant_id", actor.tenantId)
      .eq("id", parsed.data.actionItemId)
      .eq("status", "open");

    if (actionUpdateError) {
      throw new Error(`DASHBOARD_ACTION_ITEM_START_FAILED: ${actionUpdateError.message}`);
    }
  }

  if (parsed.data.nextStatus === "done") {
    const { error: actionResolveError } = await supabase
      .from("action_items")
      .update({
        status: "done",
        resolved_at: nowIso,
        resolved_by_user_id: actor.authUserId,
      } as never)
      .eq("tenant_id", actor.tenantId)
      .eq("id", parsed.data.actionItemId)
      .in("status", ["open", "in_progress"]);

    if (actionResolveError) {
      throw new Error(`DASHBOARD_ACTION_ITEM_RESOLVE_FAILED: ${actionResolveError.message}`);
    }
  }

  await runSignalEngineForTenant({
    tenantId: actor.tenantId,
    actorUserId: actor.authUserId,
  });

  revalidatePath("/dashboard");
}
