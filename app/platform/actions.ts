"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createServerClient } from "@/lib/db/supabaseServer";
import { createServiceRoleClient } from "@/lib/db/supabaseServer";
import { requireActor, requirePlatformOwnerAal2 } from "@/middleware/rbac";
import {
  acceptPlatformOwnerTransfer,
  nominatePlatformOwnerTransfer,
  revokePlatformOwner,
} from "@/services/platformOwnerService";
import { updateCompanyStatus } from "@/services/platformService";

const StatusSchema = z.object({
  company_id: z.string().uuid(),
  status: z.enum(["active", "suspended", "closed"]),
});

const NominateSchema = z.object({
  replacement_auth_user_id: z.string().uuid().optional().nullable(),
  replacement_email: z.string().trim().toLowerCase().email(),
  replacement_display_name: z.string().trim().min(1),
});

function errorCode(error: unknown): string {
  return error instanceof Error ? (error.message.split(":")[0] ?? "UNKNOWN") : "UNKNOWN";
}

async function requireAal2Actor() {
  const actor = await requireActor();
  const supabase = await createServerClient();
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) throw new Error("MFA_STATUS_UNAVAILABLE");
  if (data.currentLevel !== "aal2") throw new Error("MFA_REQUIRED");
  return actor;
}

export async function updateCompanyStatusAction(formData: FormData): Promise<void> {
  try {
    const actor = await requirePlatformOwnerAal2();
    const parsed = StatusSchema.parse({
      company_id: formData.get("company_id"),
      status: formData.get("status"),
    });
    await updateCompanyStatus(actor, parsed.company_id, parsed.status);
  } catch (error) {
    redirect(`/platform?error=${encodeURIComponent(errorCode(error))}`);
  }
  redirect("/platform?status=company_updated");
}

export async function enterCompanyAction(formData: FormData): Promise<void> {
  try {
    await requirePlatformOwnerAal2();
    const companyId = z.string().uuid().parse(formData.get("company_id"));
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("UNAUTHENTICATED");
    const service = createServiceRoleClient();
    const { data: company, error: companyError } = await service
      .from("companies")
      .select("id")
      .eq("id", companyId)
      .neq("status", "closed")
      .maybeSingle();
    if (companyError) throw new Error(`PLATFORM_TENANT_ENTRY_FAILED: ${companyError.message}`);
    if (!company) throw new Error("COMPANY_NOT_FOUND");
    const { error } = await service.auth.admin.updateUserById(user.id, {
      app_metadata: { ...(user.app_metadata ?? {}), platform_view_tenant_id: companyId },
    });
    if (error) throw new Error(`PLATFORM_TENANT_ENTRY_FAILED: ${error.message}`);
  } catch (error) {
    redirect(`/platform?error=${encodeURIComponent(errorCode(error))}`);
  }
  redirect("/dashboard");
}

export async function nominatePlatformOwnerTransferAction(formData: FormData): Promise<void> {
  try {
    const actor = await requirePlatformOwnerAal2();
    const parsed = NominateSchema.parse({
      replacement_auth_user_id: formData.get("replacement_auth_user_id") || null,
      replacement_email: formData.get("replacement_email"),
      replacement_display_name: formData.get("replacement_display_name"),
    });
    await nominatePlatformOwnerTransfer(actor, {
      replacementAuthUserId: parsed.replacement_auth_user_id,
      replacementEmail: parsed.replacement_email,
      replacementDisplayName: parsed.replacement_display_name,
    });
  } catch (error) {
    redirect(`/platform?error=${encodeURIComponent(errorCode(error))}`);
  }
  redirect("/platform?status=transfer_requested");
}

export async function acceptPlatformOwnerTransferAction(formData: FormData): Promise<void> {
  try {
    const actor = await requireAal2Actor();
    const transferId = z.string().uuid().parse(formData.get("transfer_id"));
    await acceptPlatformOwnerTransfer(actor, transferId);
  } catch (error) {
    redirect(`/platform/transfer?error=${encodeURIComponent(errorCode(error))}`);
  }
  redirect("/platform?status=transfer_accepted");
}

export async function revokePlatformOwnerAction(formData: FormData): Promise<void> {
  try {
    const actor = await requirePlatformOwnerAal2();
    const authUserId = z.string().uuid().parse(formData.get("auth_user_id"));
    await revokePlatformOwner(actor, authUserId);
  } catch (error) {
    redirect(`/platform?error=${encodeURIComponent(errorCode(error))}`);
  }
  redirect("/platform?status=owner_revoked");
}
