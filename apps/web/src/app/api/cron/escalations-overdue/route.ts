import type { NextResponse } from "next/server";
import { runCronJob } from "@/lib/cron/run";
import { escalationsOverdue } from "@/lib/cron/jobs/escalations-overdue";

/**
 * GET /api/cron/escalations-overdue. Staff escalations past their response
 * time move up a level (team, COO, super admin) and the next people are
 * told. Guarded by the cron bearer, wrapped, reported and idempotent: see
 * lib/cron/run.ts and lib/cron/jobs/escalations-overdue.ts.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Vercel Cron issues a GET. */
export async function GET(request: Request): Promise<NextResponse> {
  return runCronJob("escalations-overdue", request, escalationsOverdue);
}

/** POST, for anything that would rather not put a run behind a GET. */
export async function POST(request: Request): Promise<NextResponse> {
  return runCronJob("escalations-overdue", request, escalationsOverdue);
}
