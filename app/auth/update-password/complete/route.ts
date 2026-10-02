import { NextResponse } from "next/server";
import { RECOVERY_COOKIE_NAME } from "@/lib/auth/recovery";

export async function POST(request: Request) {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(RECOVERY_COOKIE_NAME, "", {
    httpOnly: true,
    secure: new URL(request.url).protocol === "https:",
    sameSite: "lax",
    maxAge: 0,
    path: "/auth/update-password",
  });
  return response;
}
