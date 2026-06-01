"use server";

/**
 * Auth server actions.
 *
 * Magic-link only. No password flow. No OAuth.
 * The browser never holds a Supabase admin/service-role key.
 */

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { env } from "@/lib/db/env";
import { createServerClient } from "@/lib/db/supabaseServer";
import { resolveIdentity } from "@/lib/rbac/roles";

const EmailSchema = z.string().trim().toLowerCase().email();
const EMAIL_RATE_LIMIT_MAX = 3;
const EMAIL_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const IP_RATE_LIMIT_MAX = 5;
const IP_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

type RateLimitWindow = {
  count: number;
  windowStartMs: number;
};

const emailRateLimitStore = new Map<string, RateLimitWindow>();
const ipRateLimitStore = new Map<string, RateLimitWindow>();

function consumeRateLimit(
  store: Map<string, RateLimitWindow>,
  key: string,
  maxCount: number,
  windowMs: number,
  nowMs: number,
): boolean {
  const current = store.get(key);
  if (!current || nowMs - current.windowStartMs >= windowMs) {
    store.set(key, { count: 1, windowStartMs: nowMs });
    return true;
  }

  if (current.count >= maxCount) {
    return false;
  }

  store.set(key, { count: current.count + 1, windowStartMs: current.windowStartMs });
  return true;
}

async function getClientIpAddress(): Promise<string> {
  const requestHeaders = await headers();
  const forwardedFor = requestHeaders.get("x-forwarded-for") ?? "";
  const firstHop = forwardedFor.split(",")[0]?.trim();
  return firstHop || "unknown";
}

export async function sendMagicLink(formData: FormData): Promise<void> {
  const raw = formData.get("email");
  const parsed = EmailSchema.safeParse(raw);
  if (!parsed.success) {
    redirect(`/auth?error=invalid_email`);
  }
  const email = parsed.data;
  const nowMs = Date.now();
  const clientIp = await getClientIpAddress();

  if (
    !consumeRateLimit(
      emailRateLimitStore,
      email,
      EMAIL_RATE_LIMIT_MAX,
      EMAIL_RATE_LIMIT_WINDOW_MS,
      nowMs,
    )
  ) {
    redirect("/auth?error=rate_limited");
  }

  if (!consumeRateLimit(ipRateLimitStore, clientIp, IP_RATE_LIMIT_MAX, IP_RATE_LIMIT_WINDOW_MS, nowMs)) {
    redirect("/auth?error=rate_limited");
  }

  const supabase = await createServerClient();

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${env.siteUrl}/auth/callback`,
      shouldCreateUser: false,
    },
  });

  if (error) {
    const code = typeof (error as { code?: unknown }).code === "string" ? (error as { code: string }).code : null;
    const status = typeof (error as { status?: unknown }).status === "number" ? (error as { status: number }).status : null;
    console.warn("AUTH_SEND_MAGIC_LINK_DIAGNOSTIC", {
      email,
      code,
      status,
      message: error.message,
    });
  }
  // In all cases land on /auth/check-email — never reveal whether the email
  // is a known user (prevents enumeration).

  redirect(`/auth/check-email?email=${encodeURIComponent(email)}`);
}

export async function logoutAction(): Promise<void> {
  const supabase = await createServerClient();
  await supabase.auth.signOut();
  redirect("/auth?signed_out=1");
}

export async function continueCurrentSessionAction(): Promise<void> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth?error=callback_failed&reason=session_mismatch");
  }

  await resolveIdentity(user.id);
  redirect("/dashboard");
}

export async function switchAccountAction(): Promise<void> {
  const supabase = await createServerClient();
  await supabase.auth.signOut();
  redirect("/auth?switched_account=1");
}
