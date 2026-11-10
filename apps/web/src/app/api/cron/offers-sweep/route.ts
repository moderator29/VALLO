import type { NextResponse } from "next/server";
import { runCronJob } from "@/lib/cron/run";
import { offersSweep } from "@/lib/cron/jobs/offers-sweep";

/**
 * GET /api/cron/offers-sweep. Expires sale offers past their date and nudges the side whose answer is waiting.
 * Guarded by RECONCILE_CRON_SECRET, wrapped, reported, idempotent: see
 * lib/cron/run.ts and lib/cron/jobs/offers-sweep.ts.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Vercel Cron issues a GET. */
export async function GET(request: Request): Promise<NextResponse> {
  return runCronJob("offers-sweep", request, offersSweep);
}

/** POST, for anything that would rather not put a run behind a GET. */
export async function POST(request: Request): Promise<NextResponse> {
  return runCronJob("offers-sweep", request, offersSweep);
}
