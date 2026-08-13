import "server-only";
import { z } from "zod";
import type { Actor } from "@/middleware/rbac";
import { createServiceRoleClient } from "@/lib/db/supabaseServer";

type PlatformOwnerRow = {
  auth_user_id: string;
  display_name: string;
  email: string;
  active: boolean;
  mfa_required: boolean;
  created_at: string;
  revoked_at: string | null;
};

type TransferRow = {
  id: string;
  replacement_email: string;
  replacement_display_name: string;
  state: "pending" | "accepted" | "cancelled";
  requested_at: string;
  accepted_at: string | null;
  cancelled_at: string | null;
};

const TransferSchema = z.object({
  replacementAuthUserId: z.string().uuid().optional().nullable(),
  replacementEmail: z.string().trim().toLowerCase().email(),
  replacementDisplayName: z.string().trim().min(1),
});

function requirePlatformOwner(actor: Actor): void {
  if (!actor.isPlatformOwner) throw new Error("FORBIDDEN");
}

async function countActivePlatformOwners(): Promise<number> {
  const supabase = createServiceRoleClient();
  const { count, error } = await supabase
    .from("platform_owners")
    .select("auth_user_id", { count: "exact", head: true })
    .eq("active", true)
    .is("revoked_at", null);
  if (error) throw new Error(`PLATFORM_OWNER_COUNT_FAILED: ${error.message}`);
  return count ?? 0;
}

export async function listPlatformOwnerState(actor: Actor): Promise<{
  owners: PlatformOwnerRow[];
  transfers: TransferRow[];
}> {
  requirePlatformOwner(actor);
  const supabase = createServiceRoleClient();
  const [{ data: owners, error: ownersError }, { data: transfers, error: transfersError }] = await Promise.all([
    supabase
      .from("platform_owners")
      .select("auth_user_id, display_name, email, active, mfa_required, created_at, revoked_at")
      .order("created_at", { ascending: true }),
    supabase
      .from("platform_owner_transfer_requests")
      .select("id, replacement_email, replacement_display_name, state, requested_at, accepted_at, cancelled_at")
      .order("requested_at", { ascending: false })
      .limit(10),
  ]);
  if (ownersError) throw new Error(`PLATFORM_OWNERS_LOAD_FAILED: ${ownersError.message}`);
  if (transfersError) throw new Error(`PLATFORM_OWNER_TRANSFERS_LOAD_FAILED: ${transfersError.message}`);
  return { owners: (owners ?? []) as PlatformOwnerRow[], transfers: (transfers ?? []) as TransferRow[] };
}

export async function listPendingPlatformOwnerTransfersForActor(actor: Actor): Promise<TransferRow[]> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("platform_owner_transfer_requests")
    .select("id, replacement_auth_user_id, replacement_email, replacement_display_name, state, requested_at, accepted_at, cancelled_at")
    .eq("state", "pending")
    .order("requested_at", { ascending: false });
  if (error) throw new Error(`PLATFORM_OWNER_TRANSFER_LOAD_FAILED: ${error.message}`);
  const email = actor.email.toLowerCase();
  return ((data ?? []) as Array<TransferRow & { replacement_auth_user_id: string | null }>).filter(
    (transfer) => transfer.replacement_auth_user_id === actor.authUserId || transfer.replacement_email === email,
  );
}

export async function nominatePlatformOwnerTransfer(
  actor: Actor,
  input: z.infer<typeof TransferSchema>,
): Promise<void> {
  requirePlatformOwner(actor);
  const parsed = TransferSchema.parse(input);
  const supabase = createServiceRoleClient();
  const { error: cancelError } = await supabase
    .from("platform_owner_transfer_requests")
    .update({ state: "cancelled", cancelled_at: new Date().toISOString() } as never)
    .eq("state", "pending");
  if (cancelError) throw new Error(`PLATFORM_OWNER_TRANSFER_SUPERSEDE_FAILED: ${cancelError.message}`);

  const { error } = await supabase.from("platform_owner_transfer_requests").insert({
    requested_by_user_id: actor.authUserId,
    replacement_auth_user_id: parsed.replacementAuthUserId ?? null,
    replacement_email: parsed.replacementEmail,
    replacement_display_name: parsed.replacementDisplayName,
    state: "pending",
  } as never);
  if (error) throw new Error(`PLATFORM_OWNER_TRANSFER_CREATE_FAILED: ${error.message}`);
}

export async function acceptPlatformOwnerTransfer(actor: Actor, transferId: string): Promise<void> {
  const id = z.string().uuid().parse(transferId);
  const supabase = createServiceRoleClient();
  const { data: transfer, error: transferError } = await supabase
    .from("platform_owner_transfer_requests")
    .select("id, replacement_auth_user_id, replacement_email, replacement_display_name, state")
    .eq("id", id)
    .maybeSingle();
  if (transferError) throw new Error(`PLATFORM_OWNER_TRANSFER_LOOKUP_FAILED: ${transferError.message}`);
  if (!transfer || (transfer as { state: string }).state !== "pending") throw new Error("PLATFORM_OWNER_TRANSFER_NOT_PENDING");
  const row = transfer as {
    replacement_auth_user_id: string | null;
    replacement_email: string;
    replacement_display_name: string;
  };
  if (row.replacement_auth_user_id && row.replacement_auth_user_id !== actor.authUserId) {
    throw new Error("FORBIDDEN");
  }
  if (!row.replacement_auth_user_id && row.replacement_email !== actor.email.toLowerCase()) {
    throw new Error("FORBIDDEN");
  }
  const { error: ownerError } = await supabase.from("platform_owners").upsert(
    {
      auth_user_id: actor.authUserId,
      email: row.replacement_email,
      display_name: row.replacement_display_name,
      active: true,
      mfa_required: true,
      revoked_at: null,
    } as never,
    { onConflict: "auth_user_id" },
  );
  if (ownerError) throw new Error(`PLATFORM_OWNER_TRANSFER_ACCEPT_FAILED: ${ownerError.message}`);
  const { error: updateError } = await supabase
    .from("platform_owner_transfer_requests")
    .update({
      replacement_auth_user_id: actor.authUserId,
      state: "accepted",
      accepted_at: new Date().toISOString(),
    } as never)
    .eq("id", id);
  if (updateError) throw new Error(`PLATFORM_OWNER_TRANSFER_CLOSE_FAILED: ${updateError.message}`);
}

export async function revokePlatformOwner(actor: Actor, authUserId: string): Promise<void> {
  requirePlatformOwner(actor);
  const target = z.string().uuid().parse(authUserId);
  if (target === actor.authUserId && (await countActivePlatformOwners()) <= 1) {
    throw new Error("LAST_PLATFORM_OWNER_REQUIRED");
  }
  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .from("platform_owners")
    .update({ active: false, revoked_at: new Date().toISOString() } as never)
    .eq("auth_user_id", target);
  if (error) throw new Error(`PLATFORM_OWNER_REVOKE_FAILED: ${error.message}`);
}
