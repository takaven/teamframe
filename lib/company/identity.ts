import "server-only";
import { createServiceRoleClient } from "@/lib/db/supabaseServer";
import { createPrivateStorageSignedUrl } from "@/services/documentService";

export type CompanyIdentity = {
  name: string;
  monogram: string;
  logoUrl: string | null;
};

/**
 * Two-letter monogram used as the workspace avatar when no logo is uploaded. Derives from the
 * company name: first letters of the first two words, else the first two letters of a single word.
 */
export function companyMonogram(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "TF";
  if (words.length === 1) return (words[0] ?? "").slice(0, 2).toUpperCase() || "TF";
  return ((words[0]?.[0] ?? "") + (words[1]?.[0] ?? "")).toUpperCase() || "TF";
}

/**
 * First name of the signed-in actor for greetings. Prefers the linked employee's preferred/full
 * name; falls back to the email local part; else empty (caller drops the name from the greeting).
 */
export async function getActorFirstName(actor: { employeeId: string | null; tenantId: string | null; authUserId?: string | null }): Promise<string> {
  try {
    const supabase = createServiceRoleClient();
    if (actor.employeeId && actor.tenantId) {
      const { data: raw } = await supabase
        .from("employees")
        .select("preferred_name, full_name")
        .eq("tenant_id", actor.tenantId)
        .eq("id", actor.employeeId)
        .maybeSingle();
      const data = raw as unknown as { preferred_name: string | null; full_name: string | null } | null;
      const name = (data?.preferred_name || data?.full_name || "").trim();
      if (name) return name.split(/\s+/)[0] ?? name;
    }
  } catch {
    /* fall through to empty */
  }
  return "";
}

/**
 * Customer workspace identity for the app shell: the company's own name, plus a signed URL for its
 * uploaded logo when present (logos live in the private documents bucket under `<tenant>/branding/`,
 * resolved to a short-lived signed URL per render — never a public/permanent URL). Falls back to a
 * monogram avatar. Read via the service-role client because the shell renders for every member and
 * the company row is not otherwise exposed by RLS to plain members.
 */
export async function getCompanyIdentity(tenantId: string | null): Promise<CompanyIdentity> {
  if (!tenantId) return { name: "TeamFrame", monogram: "TF", logoUrl: null };
  try {
    const supabase = createServiceRoleClient();
    const { data: raw } = await supabase
      .from("companies")
      .select("name, logo_path")
      .eq("id", tenantId)
      .maybeSingle();
    const data = raw as unknown as { name: string | null; logo_path: string | null } | null;
    const name = (data?.name ?? "TeamFrame").trim() || "TeamFrame";
    let logoUrl: string | null = null;
    if (data?.logo_path) {
      try {
        logoUrl = await createPrivateStorageSignedUrl(data.logo_path, 3600);
      } catch {
        logoUrl = null;
      }
    }
    return { name, monogram: companyMonogram(name), logoUrl };
  } catch {
    return { name: "TeamFrame", monogram: "TF", logoUrl: null };
  }
}
