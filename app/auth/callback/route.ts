import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/db/supabaseServer";
import { resolveIdentity } from "@/lib/rbac/roles";
import { track } from "@/lib/telemetry/track";

const NEXT_ALLOWLIST = ["/dashboard", "/employees", "/leaves", "/onboarding", "/me", "/platform", "/access", "/setup"] as const;

function safeNext(raw: string | null): string {
  if (!raw) return "";
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return "";
  const [rawPathname, search = ""] = raw.split("?");
  const pathname = rawPathname ?? "";
  if (pathname.startsWith("/auth")) return "";
  for (const prefix of NEXT_ALLOWLIST) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      return search ? `${pathname}?${search}` : pathname;
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

function roleDefaultPath(role: string): string {
  if (role === "platform_owner") return "/platform";
  return role === "employee" ? "/me" : "/dashboard";
}

function successRedirect(url: URL, next: string, role = "admin"): NextResponse {
  return NextResponse.redirect(new URL(next || roleDefaultPath(role), url));
}

async function recoverExistingSession(params: {
  supabase: Awaited<ReturnType<typeof createServerClient>>;
  url: URL;
  next: string;
}): Promise<NextResponse | null> {
  const {
    data: { user },
  } = await params.supabase.auth.getUser();

  if (!user) {
    return null;
  }

  try {
    const identity = await resolveIdentity(user.id);
    if (identity.role === "employee" && (!identity.employeeId || !identity.tenantId)) {
      return callbackErrorRedirect(params.url, "invalid_tenant");
    }
    return successRedirect(params.url, params.next, identity.role);
  } catch {
    return null;
  }
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
      const recoveredSession = await recoverExistingSession({ supabase, url, next });
      if (recoveredSession) {
        return recoveredSession;
      }
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
        return successRedirect(url, next, identity.role);
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
        const recoveredSession = await recoverExistingSession({ supabase, url, next });
        if (recoveredSession) {
          return recoveredSession;
        }
        return callbackErrorRedirect(url, classifyAuthFailureMessage(error?.message ?? "invalid_link"));
      }
    } else {
      const { error } = await supabase.auth.exchangeCodeForSession(code ?? "");
      if (error) {
        const recoveredSession = await recoverExistingSession({ supabase, url, next });
        if (recoveredSession) {
          return recoveredSession;
        }
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

    await track({
      tenantId: identity.tenantId,
      userId: identity.authUserId,
      eventName: "session_started",
      properties: { role: identity.role },
    });

    return successRedirect(url, next, identity.role);
  } catch (error) {
    // Never expose callback internals to end users.
    console.error("AUTH_CALLBACK_FAILED", error);
    return callbackErrorRedirect(url, "unknown");
  }
}
