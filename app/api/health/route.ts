/**
 * TeamFrame — public shallow health.
 *
 * Public callers get only the stable contract body. Deep dependency probes
 * live at /api/health/deep and require a header secret.
 */

import { NextResponse } from "next/server";
import { buildPublicHealthPayload } from "@/lib/health/contract.mjs";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(buildPublicHealthPayload("ok"), {
    status: 200,
    headers: {
      "Cache-Control": "public, max-age=10, stale-while-revalidate=30",
    },
  });
}
