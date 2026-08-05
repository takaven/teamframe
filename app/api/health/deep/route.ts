/**
 * TeamFrame — protected deep health.
 *
 * Requires x-teamframe-health-secret. Never accepts query-string secrets.
 */

import { type NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createServiceRoleClient } from "@/lib/db/supabaseServer";
import { logAction } from "@/lib/telemetry/logger";
import { captureActionError } from "@/lib/telemetry/sentry";

export const dynamic = "force-dynamic";

const SUBSYSTEM_TIMEOUT_MS = 1500;
const RESPONSE_CEILING_MS = 2200;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 10;
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

type SubsystemStatus = "ok" | "fail";
type DeepHealthResult = {
  db: SubsystemStatus;
  storage: SubsystemStatus;
  auth: SubsystemStatus;
};

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms),
    ),
  ]);
}

function safeCompareSecret(candidate: string, secret: string): boolean {
  const candidateBuf = Buffer.from(candidate, "utf8");
  const secretBuf = Buffer.from(secret, "utf8");
  if (candidateBuf.length !== secretBuf.length) return false;
  return timingSafeEqual(candidateBuf, secretBuf);
}

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.DEEP_HEALTH_SECRET;
  if (!secret) return false;
  const candidate = req.headers.get("x-teamframe-health-secret") ?? "";
  return safeCompareSecret(candidate, secret);
}

function clientKey(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

function isRateLimited(req: NextRequest): boolean {
  const key = clientKey(req);
  const now = Date.now();
  const bucket = rateBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  bucket.count += 1;
  return bucket.count > RATE_LIMIT_MAX;
}

async function checkDb(): Promise<SubsystemStatus> {
  try {
    const supabase = createServiceRoleClient();
    const { error } = await withTimeout(
      supabase
        .from("companies")
        .select("id", { count: "planned", head: true })
        .limit(1) as unknown as Promise<{ error: unknown }>,
      SUBSYSTEM_TIMEOUT_MS,
    );
    return error ? "fail" : "ok";
  } catch {
    return "fail";
  }
}

async function checkStorage(): Promise<SubsystemStatus> {
  try {
    const supabase = createServiceRoleClient();
    const { error } = await withTimeout(supabase.storage.listBuckets(), SUBSYSTEM_TIMEOUT_MS);
    return error ? "fail" : "ok";
  } catch {
    return "fail";
  }
}

async function checkAuth(): Promise<SubsystemStatus> {
  try {
    const supabase = createServiceRoleClient();
    const authPromise = supabase.auth.admin.listUsers({ page: 1, perPage: 1 });
    authPromise.catch(() => {});
    const { error } = await withTimeout(authPromise, SUBSYSTEM_TIMEOUT_MS);
    return error ? "fail" : "ok";
  } catch {
    return "fail";
  }
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const requestId = crypto.randomUUID();
  const start = Date.now();

  if (
    req.nextUrl.searchParams.has("secret") ||
    req.nextUrl.searchParams.has("key") ||
    req.nextUrl.searchParams.has("healthcheck_secret")
  ) {
    return NextResponse.json({ status: "forbidden" }, { status: 403 });
  }

  if (isRateLimited(req)) {
    return NextResponse.json({ status: "rate_limited" }, { status: 429 });
  }

  if (!isAuthorized(req)) {
    return NextResponse.json({ status: "unauthorized" }, { status: 401 });
  }

  const ceiling = new Promise<null>((resolve) =>
    setTimeout(() => resolve(null), RESPONSE_CEILING_MS),
  );
  const checksPromise = Promise.allSettled([checkDb(), checkStorage(), checkAuth()]);
  const raceResult = await Promise.race([checksPromise, ceiling]);

  const result: DeepHealthResult =
    raceResult === null
      ? { db: "fail", storage: "fail", auth: "fail" }
      : {
          db: raceResult[0].status === "fulfilled" ? raceResult[0].value : "fail",
          storage: raceResult[1].status === "fulfilled" ? raceResult[1].value : "fail",
          auth: raceResult[2].status === "fulfilled" ? raceResult[2].value : "fail",
        };

  const overallStatus =
    result.db === "ok" && result.storage === "ok" && result.auth === "ok" ? "ok" : "degraded";
  const httpStatus = overallStatus === "ok" ? 200 : 503;

  if (overallStatus !== "ok") {
    const msg = `[DEEP_HEALTH_FAIL] db=${result.db} storage=${result.storage} auth=${result.auth}`;
    logAction({
      action: "deep_healthcheck",
      actorUserId: null,
      actorTenantId: null,
      durationMs: Date.now() - start,
      outcome: "fail",
      error: new Error(msg),
      requestId,
    });
    captureActionError("deep_healthcheck", new Error(msg), { requestId });
  }

  return NextResponse.json(
    {
      status: overallStatus,
      subsystems: result,
      checked_at: new Date().toISOString(),
      request_id: requestId,
    },
    {
      status: httpStatus,
      headers: {
        "Cache-Control": "private, max-age=5",
      },
    },
  );
}
