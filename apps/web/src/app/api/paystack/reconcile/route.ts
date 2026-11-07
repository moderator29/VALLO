import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { logMoney } from "@/lib/payments/observability";
import { getAdminClient } from "@/lib/supabase/service";
import { recordMoneyAudit } from "@/lib/money/audit";
import { DEFAULT_SWEEP_HOURS, runMoneyReconciliation } from "@/lib/payments/reconciliation";
import { recordAlert } from "@/lib/alerts";
import { cronAuthVerdict, fromPlatformScheduler } from "@/lib/cron/auth";
import { refusalAlert } from "@/lib/cron/run";
import { failureReason } from "@/lib/payments/observability";
import { ROUTE_FAILURE_LIMITS, countRouteFailure } from "@/lib/security/money-limits";
import {
  RECONCILE_SUBJECT,
  reconcileAlert,
  reconcileAuditOutcome,
  type ReconcileRunSummary,
} from "./outcome";

/**
 * The scheduled money reconciliation.
 *
 * WHY THIS IS AN HTTP ENDPOINT AND NOT A pg_cron JOB. Six pg_cron jobs already
 * run on this database and not one of them touches money. Three of the four
 * checks reconciliation has to make can only be made from here, because they
 * require asking PAYSTACK what it actually charged and what became of each
 * transfer. Postgres cannot do that. The database-side halves already exist and
 * have never been called: private.wallets_overdrawn() and
 * private.stale_withdrawal_holds(). This job calls their equivalents on every
 * run, so the two checks that could have run in the database for months
 * actually run now.
 *
 * WHAT IT DOES, EVERY RUN:
 *  1. Asks Paystack for every successful charge in the window and compares them
 *     against wallet_entries and transactions. A funding gap is posted; a
 *     booking gap is reported loudly and left for a human.
 *  2. Asks Paystack what became of every PENDING withdrawal hold older than the
 *     timeout, and settles or releases each one on the processor's answer. This
 *     is the only thing standing between a lost transfer webhook and somebody's
 *     balance being held forever.
 *  3. Reports any wallet whose derived balance has gone below zero.
 *
 * HOW IT IS AUTHENTICATED. A bearer token compared in constant time against
 * RECONCILE_CRON_SECRET, which is exactly the header Vercel Cron sends. When
 * the secret is not set the endpoint refuses everything: an unauthenticated
 * endpoint that can move money is worse than a job that does not run, and a
 * job that does not run says so in the log on every attempt.
 *
 * WHAT IT ANSWERS. A summary with counts and kobo, never a customer email and
 * never a raw processor payload. Non-2xx when the run could not happen, so a
 * scheduler's own failure log is honest about it.
 *
 * DEFAULT IS DRY. `?apply=1` is required before anything is written, so the
 * first run against a live database can only ever report. Wire the schedule
 * with apply once a dry run has been read.
 *
 * IT IS ON THE SCHEDULE NOW, AND IT WAS NOT. `apps/web/vercel.json` carried
 * four crons, all of them BA's lifecycle sweeps, and this route was not among
 * them: nothing on Vercel and nothing in pg_cron called it, so the job that
 * recovers a lost webhook, settles a stranded withdrawal hold and reports an
 * overdrawn wallet had never run at all. Every paragraph above described a
 * schedule that did not exist. It is `10 * * * *` from this commit, hourly,
 * between the hold sweep at :05 and the pg_cron watch at :20.
 *
 * AND IT IS WIRED DRY, DELIBERATELY. The path in vercel.json carries no
 * `apply=1`, so the hourly run reports and alerts and writes NOTHING, which is
 * what this file's own instruction above asks for: read a dry run first. The
 * lead flips it by appending `?apply=1` to the cron path once a dry run has
 * been read against the live project. Until then the desk hears about a gap
 * and a person closes it by hand, which is strictly better than the nothing
 * that was there before and strictly safer than a sweep nobody has watched
 * moving money on its own.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** How far back a scheduled run looks, capped so one call cannot page forever. */
const MAX_HOURS = 24 * 30;

function refused(reason: string, status: number): NextResponse {
  return NextResponse.json({ ok: false, reason }, { status });
}

/** Constant-time bearer comparison. False on any shape we do not recognise. */
function authorised(request: Request): boolean {
  const expected = process.env.RECONCILE_CRON_SECRET ?? "";
  if (expected.length === 0) return false;

  const header = request.headers.get("authorization") ?? "";
  const presented = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (presented.length === 0) return false;

  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(presented, "utf8");
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

async function run(request: Request): Promise<NextResponse> {
  if (!authorised(request)) {
    /* Failures per address, so a guessed secret is answered from the deny
       cache after thirty tries and the desk hears about it once. */
    const spray = await countRouteFailure(ROUTE_FAILURE_LIMITS.cronBadSecret, request.headers);
    if (!spray.allowed) {
      return NextResponse.json(
        { ok: false, reason: "too_many_failures" },
        { status: 429, headers: { "retry-after": String(spray.retryAfterSeconds) } },
      );
    }
    logMoney({ surface: "reconcile", outcome: "rejected", reason: "cron_secret_invalid" });
    /* A refused stranger is a warning. A refused SCHEDULER is the money sweep
       not running, hourly, until somebody changes a secret, and it is told at
       the level that means a person. The whole argument, and the 69 medium
       rows this route had already put on the desk saying the first thing while
       meaning the second, is in lib/cron/auth.ts. */
    /* The verdict is MEASURED here rather than left to a default. This call
       site is the one that proved why: it inherited "secret-mismatch" and
       reported it for a request that carried no bearer at all. */
    await recordAlert(
      refusalAlert(RECONCILE_SUBJECT, fromPlatformScheduler(request), cronAuthVerdict(request)),
    );
    return refused("unauthorised", 401);
  }

  const admin = getAdminClient();
  if (!admin) {
    // The failure that started all of this. It gets a 503, not a 200, so the
    // scheduler's own dashboard turns red instead of green.
    logMoney({
      surface: "reconcile",
      outcome: "unconfigured",
      reason: "service_role_key_missing",
    });
    await recordAlert({
      kind: "cron.reconcile.unconfigured",
      severity: "critical",
      detail: { reason: "service_role_key_missing" },
      subjectId: RECONCILE_SUBJECT,
    });
    return refused("service_role_key_missing", 503);
  }

  const url = new URL(request.url);
  const apply = url.searchParams.get("apply") === "1";
  const hoursParam = Number(url.searchParams.get("hours") ?? DEFAULT_SWEEP_HOURS);
  const hours =
    Number.isFinite(hoursParam) && hoursParam > 0
      ? Math.min(Math.trunc(hoursParam), MAX_HOURS)
      : DEFAULT_SWEEP_HOURS;

  let report: Awaited<ReturnType<typeof runMoneyReconciliation>>;
  try {
    report = await runMoneyReconciliation(admin, { hours, apply, actor: { kind: "sweep" } });
  } catch (error) {
    /* A run that threw is the one outcome the scheduler's own log cannot
       explain. 500 so it shows red there, and a critical alert so it shows
       on the desk with the reason beside it. */
    const reason = failureReason(error);
    logMoney({ surface: "reconcile", outcome: "failed", reason: `run_threw:${reason}` });
    await recordAlert({
      kind: "cron.reconcile.failed",
      severity: "critical",
      detail: { hours, apply, reason },
      subjectId: RECONCILE_SUBJECT,
    });
    return refused("run_failed", 500);
  }

  /*
   * Every run writes its audit row, clean or not (A2-121): a job that has
   * stopped firing is invisible unless its last clean row has a date on it.
   * The desk hears only about a run that needs a person (BA's convention in
   * lib/cron/report.ts), so the alerts badge counts attention, not the clock.
   */
  const summary: ReconcileRunSummary = {
    hours,
    apply,
    needsAttention: report.needsAttention,
    counts: {
      charges_seen: report.charges.chargesSeen,
      charges_ours: report.charges.chargesOurs,
      gaps: report.charges.gaps.length,
      refunded_minor: report.charges.refundedMinor,
    },
  };

  const alert = reconcileAlert(summary);
  if (alert) await recordAlert(alert);

  /* R-03 (Survey B): two schedulers run this, and a row per run was 97% of
     audit_log, burying the staff actions an auditor reads. A run that found
     anything always writes. A CLEAN run writes only when the newest row is
     older than CLEAN_HEARTBEAT_MS, which keeps the freshness watch
     (`lib/cron/freshness.ts`, 3 hours) fed even with one scheduler down. */
  const outcome = reconcileAuditOutcome(summary);
  if (outcome === "clean" && (await cleanRunRecordedRecently(admin))) {
    return NextResponse.json({ ok: true, apply, needsAttention: report.needsAttention, recorded: false });
  }

  await recordMoneyAudit(admin, {
    actor: { kind: "sweep" },
    action: "payment.reconciliation.run",
    reference: null,
    outcome,
    detail: { hours, apply, ...summary.counts },
  });

  return NextResponse.json(
    {
      ok: true,
      apply,
      window: { from: report.charges.from, to: report.charges.to, hours },
      charges: {
        seen: report.charges.chargesSeen,
        ours: report.charges.chargesOurs,
        unavailable: report.charges.unavailable,
        reason: report.charges.reason,
        refundedMinor: report.charges.refundedMinor,
        gaps: report.charges.gaps,
      },
      needsAttention: report.needsAttention,
    },
    { status: 200 },
  );
}

/** Vercel Cron issues a GET. */
export async function GET(request: Request): Promise<NextResponse> {
  return run(request);
}

/** POST, for anything that would rather not put a run behind a GET. */
export async function POST(request: Request): Promise<NextResponse> {
  return run(request);
}

/** A clean run's row at most this often: under the 3 hour freshness window. */
const CLEAN_HEARTBEAT_MS = 100 * 60 * 1000;

/** True when a reconciliation row was written inside the heartbeat. A failed read answers false, so the row is written. */
async function cleanRunRecordedRecently(admin: NonNullable<ReturnType<typeof getAdminClient>>): Promise<boolean> {
  try {
    const since = new Date(Date.now() - CLEAN_HEARTBEAT_MS).toISOString();
    const { count, error } = await admin
      .from("audit_log")
      .select("id", { count: "exact", head: true })
      .eq("action", "payment.reconciliation.run")
      .gte("created_at", since);
    return !error && (count ?? 0) > 0;
  } catch {
    return false;
  }
}
