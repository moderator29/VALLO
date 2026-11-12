import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * EVERY JOB THIS PLATFORM HAS IS ACTUALLY SCHEDULED, AND EVERY SCHEDULE HAS A
 * JOB BEHIND IT.
 *
 * `proxy.test.ts` already checks the other half of this: a path scheduled in
 * `vercel.json` must get through the sign-in wall. Nothing checked that a job
 * which EXISTS is reached by anything at all, and on 12 November 2026 one was
 * not: `sweepRewardsPayouts` (`lib/payouts/referral-payout.ts`) had been
 * written, unit tested and documented as "wiring is the cron lane's" for three
 * weeks with no route under `app/api/cron/`, no entry in `vercel.json` and no
 * `pg_cron` job. `grep sweepRewardsPayouts` across the repository found its
 * own declaration and nothing else.
 *
 * What that cost is in that file's header: it is the only reader of
 * `rewards_payouts_to_send`, so a Rewards Balance payout a human released from
 * review was never sent and the member's money stayed held; the only reader of
 * `rewards_payouts_to_verify`, so a transfer that may have gone was never read
 * back; and the only reader of `rewards_payouts_stuck`, so the "in flight for
 * over a day" alarm could not sound. Nothing failed anywhere, which is the
 * whole problem: an unscheduled job is indistinguishable from a job with
 * nothing to do.
 *
 * So two rules, and both of them are mechanical:
 *
 *   1. every directory under `app/api/cron/` is scheduled, by `vercel.json` or
 *      by a `pg_cron` requester named in PG_CRON_DRIVEN below;
 *   2. every job in MONEY_SWEEPS has a route AND a schedule, because those are
 *      the ones where not running is money standing still rather than a stale
 *      figure on a page.
 */

const WEB_ROOT = join(__dirname, "..", "..", "..");
const CRON_DIR = join(WEB_ROOT, "src", "app", "api", "cron");

/**
 * Jobs a `pg_cron` job calls over HTTP through `private.request_*` and pg_net
 * rather than Vercel Cron, so they are deliberately absent from `vercel.json`.
 * Adding a name here is a claim that a `pg_cron` row exists for it.
 */
const PG_CRON_DRIVEN: ReadonlySet<string> = new Set(["photo-hash-backfill"]);

/**
 * Jobs where a run that does not happen leaves money, or dates somebody has
 * not paid for, where they should not be. Deliberately not every job: the
 * list earns its keep by being the one a reviewer reads line by line.
 */
const MONEY_SWEEPS = [
  "rewards-payouts",
  "rent-share-refunds",
  "reservation-deposit-refunds",
  "crypto-reconcile",
  "arrangements-reconcile",
  "hold-sweep",
] as const;

function cronRouteNames(): string[] {
  return readdirSync(CRON_DIR)
    .filter((entry) => statSync(join(CRON_DIR, entry)).isDirectory())
    .sort();
}

function scheduledPaths(): string[] {
  const config = JSON.parse(readFileSync(join(WEB_ROOT, "vercel.json"), "utf8")) as {
    crons?: { path: string; schedule: string }[];
  };
  return (config.crons ?? []).map((c) => c.path);
}

describe("scheduled jobs", () => {
  it("schedules every job that has a route", () => {
    const scheduled = new Set(
      scheduledPaths()
        .filter((path) => path.startsWith("/api/cron/"))
        .map((path) => path.slice("/api/cron/".length)),
    );
    const unscheduled = cronRouteNames().filter((name) => !scheduled.has(name) && !PG_CRON_DRIVEN.has(name));
    expect(unscheduled, "a job with a route and no schedule never runs, and says nothing about it").toEqual([]);
  });

  it("has a route for every job it schedules", () => {
    const routes = new Set(cronRouteNames());
    const orphans = scheduledPaths()
      .filter((path) => path.startsWith("/api/cron/"))
      .map((path) => path.slice("/api/cron/".length))
      .filter((name) => !routes.has(name));
    expect(orphans, "a schedule with no route answers 200 with the site shell and reads as a clean run").toEqual([]);
  });

  it("gives every money sweep a route and a schedule", () => {
    const routes = new Set(cronRouteNames());
    const scheduled = new Set(scheduledPaths());
    for (const name of MONEY_SWEEPS) {
      expect(routes.has(name), `${name} moves money and has no route under app/api/cron`).toBe(true);
      expect(
        scheduled.has(`/api/cron/${name}`) || PG_CRON_DRIVEN.has(name),
        `${name} moves money and nothing schedules it`,
      ).toBe(true);
    }
  });
});
