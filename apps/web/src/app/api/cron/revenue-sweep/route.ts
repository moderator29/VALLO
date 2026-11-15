import type { NextResponse } from "next/server";
import { runCronJob } from "@/lib/cron/run";
import { revenueSweep } from "@/lib/cron/jobs/revenue-sweep";

/**
 * GET /api/cron/revenue-sweep. Vallo's own earnings are moved from its wallet
 * at the payment partner to Vallo's bank. Guarded by the cron bearer,
 * wrapped, reported and idempotent: see lib/cron/run.ts and
 * lib/cron/jobs/revenue-sweep.ts. It moves nothing until the founder switches
 * it on and names the destination.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Vercel Cron issues a GET. */
export async function GET(request: Request): Promise<NextResponse> {
  return runCronJob("revenue-sweep", request, revenueSweep);
}

/** POST, for anything that would rather not put a run behind a GET. */
export async function POST(request: Request): Promise<NextResponse> {
  return runCronJob("revenue-sweep", request, revenueSweep);
}
