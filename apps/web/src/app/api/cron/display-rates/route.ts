import type { NextResponse } from "next/server";
import { displayRates } from "@/lib/currency/rates-job";
import { runCronJob } from "@/lib/cron/run";

/**
 * GET /api/cron/display-rates. The daily exchange rates for the "about
 * £2,516" guide beside naira prices, twice a day (vercel.json).
 *
 * Guarded by RECONCILE_CRON_SECRET and wrapped and reported through
 * lib/cron/run.ts like every job here: without the bearer the request is
 * refused before the job is called, so nothing is fetched and nothing is
 * written. See lib/currency/rates-job.ts and lib/currency/sources.ts. The
 * rates are for display only; nothing is ever charged with them.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Vercel Cron issues a GET. */
export async function GET(request: Request): Promise<NextResponse> {
  return runCronJob("display-rates", request, (admin) => displayRates(admin));
}

/** POST, for a hand-run. */
export async function POST(request: Request): Promise<NextResponse> {
  return runCronJob("display-rates", request, (admin) => displayRates(admin));
}
