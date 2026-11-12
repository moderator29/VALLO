import type { NextResponse } from "next/server";
import { runCronJob } from "@/lib/cron/run";
import { rewardsPayouts } from "@/lib/cron/jobs/rewards-payouts";

/**
 * GET /api/cron/rewards-payouts. Sends Rewards Balance payouts that were
 * opened or released from review but never initiated, reads back the ones in
 * flight, and raises a critical alert for any in flight for over a day
 * (D51/D62). Guarded by RECONCILE_CRON_SECRET, wrapped and reported by
 * lib/cron/run.ts.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  return runCronJob("rewards-payouts", request, () => rewardsPayouts());
}

export async function POST(request: Request): Promise<NextResponse> {
  return runCronJob("rewards-payouts", request, () => rewardsPayouts());
}
