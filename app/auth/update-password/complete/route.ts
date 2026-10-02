import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/db/supabaseServer";
import {
  isServerRecoveryBoundToUser,
  RECOVERY_COOKIE_NAME,
  updateRecoveredPassword,
} from "@/lib/auth/recovery";

function clearRecoveryMarker(response: NextResponse, request: Request): void {
  response.cookies.set(RECOVERY_COOKIE_NAME, "", {
    httpOnly: true,
    secure: new URL(request.url).protocol === "https:",
    sameSite: "lax",
    maxAge: 0,
    path: "/auth/update-password",
  });
}

export async function POST(request: Request) {
  const [cookieStore, supabase] = await Promise.all([cookies(), createServerClient()]);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const marker = cookieStore.get(RECOVERY_COOKIE_NAME)?.value;

  if (!isServerRecoveryBoundToUser(marker, user?.id)) {
    const response = NextResponse.json(
      { ok: false, message: "This password reset link is invalid or has expired." },
      { status: 403 },
    );
    clearRecoveryMarker(response, request);
    return response;
  }

  let body: { password?: unknown; confirmation?: unknown };
  try {
    body = (await request.json()) as { password?: unknown; confirmation?: unknown };
  } catch {
    return NextResponse.json({ ok: false, message: "Enter a new password." }, { status: 400 });
  }

  const result = await updateRecoveredPassword(
    supabase,
    typeof body.password === "string" ? body.password : "",
    typeof body.confirmation === "string" ? body.confirmation : "",
  );
  const response = NextResponse.json(result, { status: result.ok ? 200 : 400 });
  if (result.ok || result.passwordUpdated) {
    clearRecoveryMarker(response, request);
  }
  return response;
}
