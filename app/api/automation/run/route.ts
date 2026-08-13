import { type NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { runDueAutomation } from "@/services/hrAutomation";

export const dynamic = "force-dynamic";

function safeCompareSecret(candidate: string, secret: string): boolean {
  const candidateBuf = Buffer.from(candidate, "utf8");
  const secretBuf = Buffer.from(secret, "utf8");
  if (candidateBuf.length !== secretBuf.length) return false;
  return timingSafeEqual(candidateBuf, secretBuf);
}

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.TEAMFRAME_AUTOMATION_SECRET;
  if (!secret) return false;
  const headerSecret = req.headers.get("x-teamframe-automation-secret") ?? "";
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  return safeCompareSecret(headerSecret, secret) || safeCompareSecret(bearer, secret);
}

async function handleAutomationRun(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ status: "unauthorized" }, { status: 401 });
  }

  const result = await runDueAutomation();
  return NextResponse.json({
    status: result.failed === 0 ? "ok" : "degraded",
    checked: result.checked,
    processed: result.processed,
    skipped: result.skipped,
    failed: result.failed,
    tenants: result.tenants,
  });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  return handleAutomationRun(req);
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  return handleAutomationRun(req);
}
