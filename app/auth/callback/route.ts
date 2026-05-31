import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/db/supabaseServer";
import { resolveIdentity } from "@/lib/rbac/roles";

const NEXT_ALLOWLIST = ["/dashboard", "/employees", "/leaves", "/onboarding"] as const;

function safeNext(raw: string | null): string {
  if (!raw) return "";
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return "";
  if (raw.startsWith("/auth")) return "";
  for (const prefix of NEXT_ALLOWLIST) {
    if (raw === prefix || raw.startsWith(`${prefix}/`)) {
      return raw;
    }
  }
  return "";
}

function classifyAuthFailureMessage(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("expired")) return "expired_link";
  if (lower.includes("already") && (lower.includes("used") || lower.includes("consumed"))) {
    return "already_used_link";
  }
  if (lower.includes("invalid") || lower.includes("otp")) return "invalid_link";
  return "session_exchange_failed";
}

function callbackErrorRedirect(url: URL, reason: string): NextResponse {
  return NextResponse.redirect(new URL(`/auth?error=callback_failed&reason=${encodeURIComponent(reason)}`, url));
}

function successRedirect(url: URL, next: string): NextResponse {
  return NextResponse.redirect(new URL(next || "/dashboard", url));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const typeParam = (url.searchParams.get("type") ?? "magiclink") as
    | "magiclink"
    | "email"
    | "signup"
    | "invite"
    | "recovery"
    | "email_change";
  const next = safeNext(url.searchParams.get("next"));
  const providerError = url.searchParams.get("error_description") ?? url.searchParams.get("error");

  try {
    const supabase = await createServerClient();

    if (providerError) {
      return callbackErrorRedirect(url, classifyAuthFailureMessage(providerError));
    }

    if (!tokenHash && !code) {
      const {
        data: { user: existingUser },
      } = await supabase.auth.getUser();
      if (!existingUser) {
        return callbackErrorRedirect(url, "missing_token");
      }

      try {
        const identity = await resolveIdentity(existingUser.id);
        if (identity.role === "employee" && (!identity.employeeId || !identity.tenantId)) {
          return callbackErrorRedirect(url, "invalid_tenant");
        }
        return successRedirect(url, next);
      } catch {
        return callbackErrorRedirect(url, "identity_resolution_failed");
      }
    }

    if (tokenHash) {
      const { data, error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: typeParam,
      });

      if (error || !data?.user) {
        return callbackErrorRedirect(url, classifyAuthFailureMessage(error?.message ?? "invalid_link"));
      }
    } else {
      const { error } = await supabase.auth.exchangeCodeForSession(code ?? "");
      if (error) {
        return callbackErrorRedirect(url, classifyAuthFailureMessage(error.message));
      }
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return callbackErrorRedirect(url, "session_not_found");
    }

    const identity = await resolveIdentity(user.id);
    if (identity.role === "employee" && (!identity.employeeId || !identity.tenantId)) {
      return callbackErrorRedirect(url, "invalid_tenant");
    }

    return successRedirect(url, next);
  } catch (error) {
    // Never expose callback internals to end users.
    console.error("AUTH_CALLBACK_FAILED", error);
    return callbackErrorRedirect(url, "unknown");
  }
}
