/**
 * TeamFrame — rbac middleware
 *
 * Resolves the actor for the current authenticated request and exposes
 * server-side guards for protected operations.
 *
 * Contract:
 *  - server-only (never imported into a client component)
 *  - session resolves to Platform Owner, tenant membership, or employee baseline
 *  - capabilities are database-backed and never accepted from input
 *  - services accept an explicit `Actor` and re-validate authorization
 */

import "server-only";
import { requireAuthSession } from "./auth";
import { createServerClient } from "@/lib/db/supabaseServer";
import { resolveIdentity, type AccessProfile, type ResolvedMembership, type Role } from "@/lib/rbac/roles";
import { requireCapability } from "@/lib/rbac/access";

/**
 * Thrown when a session has no tenant_id in its JWT app_metadata.
 * This replaces the silent 'NO_TENANT_CONTEXT' error string so callers
 * can distinguish missing-tenant from other auth failures if needed.
 * Added in Phase 1A (Weekend 1) alongside tenancy_rls_v2.sql.
 */
export class MissingTenantContextError extends Error {
  readonly code = "NO_TENANT_CONTEXT" as const;
  constructor() {
    // Message prefix MUST remain "NO_TENANT_CONTEXT" — existing services throw
    // Error("NO_TENANT_CONTEXT") and UI pages map that exact code via getErrorCode().
    // Changing the prefix silently degrades the user-facing error message to UNKNOWN.
    super("NO_TENANT_CONTEXT: session has no app_metadata.tenant_id");
    this.name = "MissingTenantContextError";
  }
}

export type Actor = {
  authUserId: string;
  email: string;
  employeeId: string | null;
  tenantId: string | null;
  role: Role;
  isPlatformOwner?: boolean;
  accessProfile?: AccessProfile | "platform_owner";
  membershipId?: string | null;
  memberships?: ResolvedMembership[];
  currentMembership?: ResolvedMembership | null;
  tenantStatus?: "active" | "suspended" | "closed";
};

export async function getActor(): Promise<Actor | null> {
  try {
    const session = await requireAuthSession();
    return await resolveIdentity(session.userId);
  } catch {
    return null;
  }
}

export async function requireActor(): Promise<Actor> {
  const actor = await getActor();
  if (!actor) throw new Error("UNAUTHENTICATED");
  return actor;
}

export async function requireRole(role: Role): Promise<Actor> {
  const actor = await requireActor();
  if (actor.role !== role && !(role === "admin" && actor.isPlatformOwner)) {
    throw new Error("FORBIDDEN");
  }
  return actor;
}

export async function requireTenantRole(role: Role): Promise<Actor & { tenantId: string }> {
  const actor = role === "admin" ? await requireTenantCapability("people_operations") : await requireRole(role);
  if (!actor.tenantId) {
    console.error("[TENANT_RESOLUTION_FAIL] requireTenantRole: actor has no tenantId", {
      authUserId: actor.authUserId,
      email: actor.email,
      role: actor.role,
    });
    throw new MissingTenantContextError();
  }
  return { ...actor, tenantId: actor.tenantId };
}

export async function requireSelfOrAdmin(targetEmployeeId: string): Promise<Actor> {
  const actor = await requireActor();
  if (await requireSelfOrCapability(actor, targetEmployeeId, "people_operations")) return actor;
  throw new Error("FORBIDDEN");
}

async function requireSelfOrCapability(
  actor: Actor,
  targetEmployeeId: string,
  capability: "people_operations",
): Promise<boolean> {
  if (actor.employeeId && actor.employeeId === targetEmployeeId) return true;
  try {
    await requireCapability(actor, capability, { employeeId: targetEmployeeId });
    return true;
  } catch {
    return false;
  }
}

export async function requireLinkedEmployee(): Promise<Actor & { employeeId: string }> {
  const actor = await requireActor();
  if (!actor.employeeId) {
    throw new Error("NO_EMPLOYEE_RECORD");
  }
  return { ...actor, employeeId: actor.employeeId };
}

export async function requireTenantActor(): Promise<Actor & { tenantId: string }> {
  const actor = await requireActor();
  if (!actor.tenantId) {
    // Throw MissingTenantContextError (not a generic Error) so monitoring can
    // surface sessions without a tenant_id JWT claim explicitly.
    // See: middleware/rbac.ts MissingTenantContextError, tenancy_rls_v2.sql.
    console.error("[TENANT_RESOLUTION_FAIL] requireTenantActor: actor has no tenantId", {
      authUserId: actor.authUserId,
      email: actor.email,
    });
    throw new MissingTenantContextError();
  }
  return { ...actor, tenantId: actor.tenantId };
}

export async function requireTenantCapability(
  capability: "people_operations" | "compensation_view" | "compensation_manage" | "private_employee_documents" | "finance_payroll_exports" | "company_access_settings",
  target: { employeeId?: string | null; department?: string | null } = {},
): Promise<Actor & { tenantId: string }> {
  const actor = await requireTenantActor();
  await requireCapability(actor, capability, target);
  return actor;
}

export async function requirePlatformOwner(): Promise<Actor> {
  const actor = await requireActor();
  if (!actor.isPlatformOwner) throw new Error("FORBIDDEN");
  return actor;
}

export async function requirePlatformOwnerAal2(): Promise<Actor> {
  const actor = await requirePlatformOwner();
  const supabase = await createServerClient();
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) throw new Error("MFA_STATUS_UNAVAILABLE");
  if (data.currentLevel !== "aal2") {
    throw new Error("MFA_REQUIRED");
  }
  return actor;
}
