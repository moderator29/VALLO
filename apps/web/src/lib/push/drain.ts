import "server-only";

import { randomUUID } from "node:crypto";

import type { JobVerdict } from "@/lib/bookings/lifecycle";
import { deliverablePlatforms, describeCredentials } from "./credentials";
import { decide, planCollapse, type QueuedNotification } from "./policy";
import { recipientLocale } from "./actions";
import type { NotificationKind } from "./preferences";
import type { PushClient, PushPlatform, PushQueueOutcome } from "./schema";
import { sendApns } from "./transport/apns";
import { apnsIsOpen, gatePlatforms } from "./apns-flag";
import { sendFcm } from "./transport/fcm";
import { sendWebPush } from "./transport/webpush";
import { isConfigurationFailure, isRetryable, type ProviderReply, type PushPayload, type PushTarget } from "./types";

/**
 * THE DRAIN. THE ONLY THING THAT SENDS.
 *
 * ===========================================================================
 * THE FAULT THIS IS WRITTEN AGAINST, NAMED AT THE TOP SO IT CANNOT BE MISSED.
 *
 * This platform lost twenty-four days to a scheduled job that handed a
 * payload to something and reported success without ever reading the reply.
 * Every decision below is shaped by that: a delivery is settled by the STATUS
 * A PUSH SERVICE RETURNED, the status is written into `push_deliveries`
 * before the row is called anything, and the database itself refuses a
 * settled delivery that carries no status. If this file ever stops reading a
 * reply, the insert fails; it cannot quietly succeed.
 *
 * The second half of the same lesson: a queue nobody can see is a queue that
 * stops. `verdictFor` below turns this run into the shape `lib/cron/run.ts`
 * already reports, and a stuck or failing queue becomes a row in
 * `risk_alerts`, which `/admin/alerts` already carries a badge for. Push
 * failures arrive at a desk that exists.
 *
 * ===========================================================================
 * THE FOUR PLACES A DOUBLE SEND COULD COME FROM, AND WHAT STOPS EACH.
 *
 * 1. THE EVENT QUEUED TWICE. `push_queue.notification_id` is unique. The
 *    trigger inserts `on conflict do nothing`.
 *
 * 2. TWO DRAINS CLAIMING ONE ROW. The claim is a single UPDATE filtered on
 *    the states a claimable row can be in, with `returning`. Under READ
 *    COMMITTED the second drain's UPDATE blocks on the row lock, re-reads
 *    the row after the first commits, finds `state = 'sending'`, and matches
 *    nothing. A drain therefore acts only on rows its own UPDATE returned.
 *
 * 3. ONE ROW SENT TWICE TO ONE DEVICE. `push_deliveries` is unique on
 *    `(queue_id, token_id)`, and `attemptable` below refuses any device that
 *    already has a row unless that row is an outright failure with attempts
 *    left.
 *
 * 4. A REAPED CLAIM RESENDING WHAT IT ALREADY SENT. This is the subtle one.
 *    `private.push_reap_stale_claims` hands a dead drain's rows back, which
 *    would be dangerous on its own: a worker that sent and then died would
 *    have its work repeated. It is safe here ONLY because of the delivery
 *    table, and specifically because a delivery still in `sending` is NEVER
 *    retried. A row we never read a reply for stays as it is, is counted by
 *    `push_queue_health`, and is a fact somebody reads rather than a retry.
 *    The email outbox built alongside this reached the same conclusion from
 *    the other direction, by refusing to have a reaper at all.
 *
 * ===========================================================================
 * NOTHING HERE LOGS A PERSONAL DATUM. Not a token, not a title, not a body,
 * not an address. The vocabulary of every count, every alert and every error
 * is: queue ids, `device_ref`, platform names, HTTP statuses and machine
 * tokens. A device token is the worst kind of personal datum, because it is
 * also a capability, and it never leaves `push_tokens`.
 */

/** How many queue rows one run will take on. */
const CLAIM_LIMIT = 100;
/** How many times one queue row is attempted before it is given up on. */
const MAX_QUEUE_ATTEMPTS = 4;
/** How many times one device is attempted for one event. */
const MAX_DEVICE_ATTEMPTS = 3;
/** Consecutive failures before a token is retired as hopeless. */
const FAILURE_STREAK_LIMIT = 8;
/** How long the oldest due row may wait before that is an alert, in seconds. */
const STUCK_SECONDS = 30 * 60;

/**
 * Every number this run produces, named.
 *
 * A concrete type rather than a bag of strings, because a counter that is
 * only ever spelled out in string literals is a counter that gets misspelled
 * once and then silently reports zero forever.
 */
type Counts = {
  reaped: number;
  claimed: number;
  sent: number;
  collapsed: number;
  suppressed: number;
  expired: number;
  held: number;
  no_device: number;
  failed: number;
  gave_up: number;
  tokens_retired: number;
  devices_accepted: number;
  devices_failed: number;
};

const ZERO_COUNTS: Counts = {
  reaped: 0,
  claimed: 0,
  sent: 0,
  collapsed: 0,
  suppressed: 0,
  expired: 0,
  held: 0,
  no_device: 0,
  failed: 0,
  gave_up: 0,
  tokens_retired: 0,
  devices_accepted: 0,
  devices_failed: 0,
};

type ClaimedRow = {
  id: string;
  notification_id: string;
  user_id: string;
  expires_at: string;
  attempts: number;
};

/**
 * Run the queue once.
 *
 * Never throws: it is wrapped by `lib/cron/run.ts`, which would turn a throw
 * into a 500 and a dead scheduler dashboard, but a queue that fails on one
 * malformed row must not stop the other ninety-nine.
 */
export async function pushDrain(admin: PushClient): Promise<JobVerdict> {
  /* TYPED AGAINST THE CRON CONTRACT, which it was not before. This parameter
     was `unknown` for as long as the push tables were missing from the
     generated types and the client had to be cast to a private view of them.
     `lib/cron/run.ts` declares `CronJob = (admin: AdminClient) => ...` and
     `AdminClient` is the same `SupabaseClient<Database>` this now takes, so
     the drain and the runner check against each other rather than meeting
     through an `unknown`. */
  /* V-53: iOS only once the founder has opened `native_push_apns`. The
     flag is read only when APNs credentials exist, so a deployment without
     them pays for no extra query. */
  const configured = deliverablePlatforms();
  const platforms = configured.includes("ios")
    ? gatePlatforms(configured, await apnsIsOpen(admin))
    : configured;

  /* NO CREDENTIALS MEANS DO NOT TOUCH THE QUEUE.
     A deployment with no keys must not claim rows, burn attempts against a
     wall and mark everything dead. It must say so, once, loudly, and leave
     the queue exactly as it is, so the day a key arrives everything waiting
     is still there to send. */
  if (platforms.length === 0) {
    const depth = await queueDepth(admin);
    /* V-53: keys present but every one is iOS behind the shut flag. That is a
       decision waiting, not a missing key, and it is named as one. */
    const flagShut = configured.length > 0;
    return {
      outcome: depth.waiting > 0 ? "attention" : "ok",
      counts: { ...ZERO_COUNTS, waiting: depth.waiting },
      detail: { credentials: describeCredentials() },
      alert:
        depth.waiting > 0
          ? {
              kind: flagShut ? "push.apns_flag_shut" : "push.no_credentials",
              severity: flagShut ? "warning" : "critical",
              detail: flagShut
                ? {
                    waiting: depth.waiting,
                    note: "Only APNs is configured and the native_push_apns flag is shut, so notifications are queueing. Open the flag (lib/push/apns-flag.ts) when the signed iOS build is ready.",
                  }
                : {
                    waiting: depth.waiting,
                    /* Variable NAMES, never values. */
                    note: "Push has no transport configured and notifications are queueing. See lib/push/credentials.ts for which variable is missing and who supplies it.",
                  },
            }
          : null,
    };
  }

  const counts: Counts = { ...ZERO_COUNTS };
  const notes: string[] = [];

  counts.reaped = await reapStaleClaims(admin);

  const claimToken = randomUUID();
  const claimed = await claimDue(admin, claimToken);
  counts.claimed = claimed.length;

  if (claimed.length === 0) {
    return verdictFor(admin, counts, notes);
  }

  /* Everything the decision needs, read in two queries rather than in two
     hundred. */
  const notifications = await readNotifications(admin, claimed.map((row) => row.notification_id));
  const settingsByUser = await readSettings(admin, [...new Set(claimed.map((row) => row.user_id))]);
  const now = new Date();

  /* Per person, because collapsing is a decision about a person's whole
     backlog rather than about any one notification in it. */
  const sendableByUser = new Map<string, Array<{ queueId: string; payload: PushPayload; createdAt: Date }>>();

  for (const row of claimed) {
    const notification = notifications.get(row.notification_id);
    if (!notification) {
      /* The notification was deleted between the trigger and here. There is
         nothing to send and nothing wrong. */
      await settle(admin, row.id, "done", "suppressed_expired");
      counts.expired += 1;
      continue;
    }

    const queued: QueuedNotification = {
      queueId: row.id,
      userId: row.user_id,
      kind: notification.kind as NotificationKind,
      title: notification.title,
      body: notification.body,
      href: notification.href,
      createdAt: new Date(notification.created_at),
      expiresAt: new Date(row.expires_at),
    };

    const decision = decide({ notification: queued, settings: settingsByUser.get(row.user_id), now });

    if (decision.action === "suppress") {
      await settle(admin, row.id, "done", decision.outcome);
      if (decision.outcome === "suppressed_expired") counts.expired += 1;
      else counts.suppressed += 1;
      continue;
    }

    if (decision.action === "hold") {
      /* Back to the queue, unclaimed, with the instant the window opens.
         `attempts` is deliberately NOT incremented: being asleep is not a
         failed attempt and must not count towards giving up. */
      await admin
        .from("push_queue")
        .update({
          state: "held",
          not_before: decision.until.toISOString(),
          claim_token: null,
          claimed_at: null,
        })
        .eq("id", row.id);
      counts.held += 1;
      continue;
    }

    const list = sendableByUser.get(row.user_id) ?? [];
    list.push({ queueId: row.id, payload: decision.payload, createdAt: queued.createdAt });
    sendableByUser.set(row.user_id, list);
  }

  for (const [userId, candidates] of sendableByUser) {
    const plan = planCollapse(candidates, recipientLocale(settingsByUser.get(userId)));

    for (const folded of plan.collapsed) {
      await admin
        .from("push_queue")
        .update({
          state: "done",
          outcome: "collapsed",
          collapsed_into: folded.into,
          settled_at: new Date().toISOString(),
          claim_token: null,
          claimed_at: null,
        })
        .eq("id", folded.queueId);
      counts.collapsed += 1;
    }

    const targets = await readTargets(admin, userId, platforms);
    if (targets.length === 0) {
      /* Every device was retired between the trigger's check and now. */
      for (const item of plan.send) {
        await settle(admin, item.queueId, "done", "suppressed_no_device");
        counts.no_device += 1;
      }
      continue;
    }

    for (const item of plan.send) {
      const outcome = await deliverOne(admin, item.queueId, targets, item.payload, counts, notes);
      if (outcome === "delivered") {
        await settle(admin, item.queueId, "done", "delivered");
        counts.sent += 1;
      } else {
        const row = claimed.find((candidate) => candidate.id === item.queueId);
        const attempts = (row?.attempts ?? 1);
        if (outcome === "permanent" || attempts >= MAX_QUEUE_ATTEMPTS) {
          await settle(admin, item.queueId, "dead", "gave_up");
          counts.gave_up += 1;
        } else {
          /* Back to the queue with a widening gap. 2, 4, 8, 16 minutes. */
          const backoffMinutes = Math.min(2 ** attempts, 16);
          await admin
            .from("push_queue")
            .update({
              state: "failed",
              not_before: new Date(Date.now() + backoffMinutes * 60_000).toISOString(),
              claim_token: null,
              claimed_at: null,
              last_error: "no_device_accepted",
            })
            .eq("id", item.queueId);
          counts.failed += 1;
        }
      }
    }
  }

  return verdictFor(admin, counts, notes);
}

/**
 * Send one payload to every one of a person's live devices.
 *
 * Returns `delivered` when AT LEAST ONE device accepted it, which is the
 * honest bar: a person with a dead tablet and a working phone has been
 * notified. `permanent` when every failure was one that will fail again
 * identically, so retrying is only a way of making the same mistake faster.
 */
async function deliverOne(
  admin: PushClient,
  queueId: string,
  targets: PushTarget[],
  payload: PushPayload,
  counts: Counts,
  notes: string[],
): Promise<"delivered" | "retry" | "permanent"> {
  const existing = await readDeliveries(admin, queueId);

  let accepted = 0;
  let attempted = 0;
  let retryable = 0;

  for (const target of targets) {
    const previous = existing.get(target.id);

    /* RULE 3 AND RULE 4 FROM THE HEAD, IN ONE PLACE.
       A device that already took it is never sent to again. A device whose
       reply we never read is never retried, because it may well have been
       delivered and we cannot know. */
    if (previous) {
      if (previous.state === "sent") accepted += 1;
      if (previous.state !== "failed") continue;
      if (previous.attempts >= MAX_DEVICE_ATTEMPTS) continue;
    }

    attempted += 1;
    const reply = await send(target, payload);

    /* THE REPLY IS WRITTEN DOWN BEFORE IT IS ACTED ON. */
    await recordDelivery(admin, queueId, target, reply, (previous?.attempts ?? 0) + 1);

    if (reply.outcome === "accepted") {
      accepted += 1;
      counts.devices_accepted += 1;
      await admin
        .from("push_tokens")
        .update({ failure_streak: 0, last_seen_at: new Date().toISOString() })
        .eq("id", target.id);
      continue;
    }

    counts.devices_failed += 1;

    if (reply.outcome === "gone") {
      /* The provider says this device is gone. Retired, not deleted, with
         the reason, so a build that is shedding tokens is visible later. */
      await admin
        .from("push_tokens")
        .update({ revoked_at: new Date().toISOString(), revoked_reason: "provider_gone" })
        .eq("id", target.id);
      counts.tokens_retired += 1;
      notes.push(`gone:${target.deviceRef}:${reply.status}`);
      continue;
    }

    if (isRetryable(reply)) {
      retryable += 1;
    } else if (!isConfigurationFailure(reply)) {
      /* A failure that is ours: a bad payload, bad credentials. Counted
         against the device so a token that is permanently unreachable does
         eventually go, but not retired on one bad day. Our key, our project
         or our topic is the same answer for every device, so it is recorded
         and never counted against this one (`isConfigurationFailure`). */
      await bumpFailureStreak(admin, target, counts);
    }
    notes.push(`fail:${target.deviceRef}:${reply.status}:${reply.error ?? "none"}`);
  }

  if (accepted > 0) return "delivered";
  if (attempted === 0) {
    /* Nothing was attemptable: every device already has a delivery row that
       is not a retryable failure. There is nothing more this row can do. */
    return "permanent";
  }
  return retryable > 0 ? "retry" : "permanent";
}

/** Pick the transport for a platform. The one place the three meet. */
async function send(target: PushTarget, payload: PushPayload): Promise<ProviderReply> {
  switch (target.platform) {
    case "web":
      return sendWebPush(target, payload);
    case "android":
      return sendFcm(target, payload);
    case "ios":
      return sendApns(target, payload);
    default:
      return { outcome: "failed", status: 0, error: "unknown_platform" };
  }
}

async function bumpFailureStreak(admin: PushClient, target: PushTarget, counts: Counts): Promise<void> {
  const { data } = await admin.from("push_tokens").select("failure_streak").eq("id", target.id).maybeSingle();
  const streak = (data?.failure_streak ?? 0) + 1;
  if (streak >= FAILURE_STREAK_LIMIT) {
    await admin
      .from("push_tokens")
      .update({
        failure_streak: streak,
        revoked_at: new Date().toISOString(),
        revoked_reason: "repeated_failure",
      })
      .eq("id", target.id);
    counts.tokens_retired += 1;
    return;
  }
  await admin.from("push_tokens").update({ failure_streak: streak }).eq("id", target.id);
}

/**
 * Write what the provider said.
 *
 * `upsert` on the unique `(queue_id, token_id)` so a retry updates the same
 * row rather than being refused. The status is always present on a settled
 * state, which the database's own check constraint independently enforces.
 */
async function recordDelivery(
  admin: PushClient,
  queueId: string,
  target: PushTarget,
  reply: ProviderReply,
  attempts: number,
): Promise<void> {
  const state = reply.outcome === "accepted" ? "sent" : reply.outcome === "gone" ? "gone" : "failed";
  await admin.from("push_deliveries").upsert(
    {
      queue_id: queueId,
      token_id: target.id,
      device_ref: target.deviceRef,
      platform: target.platform,
      state,
      attempts,
      provider_status: reply.status,
      provider_message_id: reply.messageId ?? null,
      /* A machine token, cut short. Never a body. */
      provider_error: reply.error ? reply.error.slice(0, 64) : null,
      attempted_at: new Date().toISOString(),
      settled_at: new Date().toISOString(),
    },
    { onConflict: "queue_id,token_id" },
  );
}

async function readDeliveries(
  admin: PushClient,
  queueId: string,
): Promise<Map<string, { state: string; attempts: number }>> {
  const { data } = await admin
    .from("push_deliveries")
    .select("token_id, state, attempts")
    .eq("queue_id", queueId);
  const out = new Map<string, { state: string; attempts: number }>();
  for (const row of data ?? []) {
    out.set(row.token_id, { state: row.state, attempts: row.attempts });
  }
  return out;
}

/**
 * Claim what is due.
 *
 * One UPDATE, filtered on the claimable states, returning only the rows it
 * actually moved. See note 2 at the head for why this is safe against a
 * second drain without an explicit lock.
 */
async function claimDue(admin: PushClient, claimToken: string): Promise<ClaimedRow[]> {
  const nowIso = new Date().toISOString();

  const { data: due } = await admin
    .from("push_queue")
    .select("id")
    .in("state", ["pending", "held", "failed"])
    .lte("not_before", nowIso)
    .order("not_before", { ascending: true })
    .limit(CLAIM_LIMIT);

  const ids = (due ?? []).map((row) => row.id);
  if (ids.length === 0) return [];

  const { data } = await admin
    .from("push_queue")
    .update({ state: "sending", claim_token: claimToken, claimed_at: nowIso })
    .in("id", ids)
    .in("state", ["pending", "held", "failed"])
    .select("id, notification_id, user_id, expires_at, attempts");

  /* `attempts` is incremented separately so the returned row carries the
     count of the attempt that is about to happen rather than the one
     before it. */
  const rows = (data ?? []) as ClaimedRow[];
  for (const row of rows) {
    row.attempts += 1;
    await admin.from("push_queue").update({ attempts: row.attempts }).eq("id", row.id);
  }
  return rows;
}

async function reapStaleClaims(admin: PushClient): Promise<number> {
  const cutoff = new Date(Date.now() - 10 * 60_000).toISOString();
  const { data } = await admin
    .from("push_queue")
    .update({ state: "failed", claim_token: null, claimed_at: null, last_error: "claim_expired" })
    .eq("state", "sending")
    .lt("claimed_at", cutoff)
    .select("id");
  return (data ?? []).length;
}

async function settle(
  admin: PushClient,
  queueId: string,
  state: "done" | "dead",
  outcome: PushQueueOutcome,
): Promise<void> {
  await admin
    .from("push_queue")
    .update({
      state,
      outcome,
      settled_at: new Date().toISOString(),
      claim_token: null,
      claimed_at: null,
    })
    .eq("id", queueId);
}

async function readNotifications(
  admin: PushClient,
  ids: string[],
): Promise<Map<string, { kind: string; title: string; body: string | null; href: string | null; created_at: string }>> {
  const out = new Map<string, { kind: string; title: string; body: string | null; href: string | null; created_at: string }>();
  if (ids.length === 0) return out;
  const { data } = await admin
    .from("notifications")
    .select("id, kind, title, body, href, created_at")
    .in("id", ids);
  for (const row of data ?? []) {
    out.set(row.id, { kind: row.kind, title: row.title, body: row.body, href: row.href, created_at: row.created_at });
  }
  return out;
}

async function readSettings(admin: PushClient, userIds: string[]): Promise<Map<string, unknown>> {
  const out = new Map<string, unknown>();
  if (userIds.length === 0) return out;
  const { data } = await admin.from("profiles").select("id, settings").in("id", userIds);
  for (const row of data ?? []) out.set(row.id, row.settings);
  return out;
}

/** A person's live devices, on platforms this deployment can actually reach. */
async function readTargets(
  admin: PushClient,
  userId: string,
  platforms: PushPlatform[],
): Promise<PushTarget[]> {
  const { data } = await admin
    .from("push_tokens")
    .select("id, platform, token, p256dh, auth, device_ref")
    .eq("user_id", userId)
    .is("revoked_at", null)
    .in("platform", platforms);
  return (data ?? []).map((row) => ({
    id: row.id,
    platform: row.platform,
    token: row.token,
    p256dh: row.p256dh,
    auth: row.auth,
    deviceRef: row.device_ref,
  }));
}

async function queueDepth(admin: PushClient): Promise<{ waiting: number; oldestSeconds: number }> {
  const nowIso = new Date().toISOString();
  const { data } = await admin
    .from("push_queue")
    .select("not_before")
    .in("state", ["pending", "failed"])
    .lte("not_before", nowIso)
    .order("not_before", { ascending: true })
    .limit(1000);
  const rows = data ?? [];
  if (rows.length === 0) return { waiting: 0, oldestSeconds: 0 };
  const first = rows[0];
  if (!first) return { waiting: 0, oldestSeconds: 0 };
  const oldest = new Date(first.not_before).getTime();
  return { waiting: rows.length, oldestSeconds: Math.max(0, Math.round((Date.now() - oldest) / 1000)) };
}

/**
 * Turn this run into something the desk reads.
 *
 * Three things raise an alert, and each is a different failure:
 *
 *  - A BACKLOG THAT IS NOT MOVING. The oldest due row is older than half an
 *    hour. This is the one that catches a drain that is running and failing,
 *    which is invisible in a green scheduler dashboard.
 *  - ROWS GIVEN UP ON. Something reached the end of its attempts. A person
 *    was not notified and never will be about that event.
 *  - A STALE CLAIM. A drain died mid flight. One is noise; several in a row
 *    is a process being killed, which is a real thing to know.
 */
async function verdictFor(admin: PushClient, counts: Counts, notes: string[]): Promise<JobVerdict> {
  const depth = await queueDepth(admin);
  const detail: Record<string, unknown> = {
    ...counts,
    waiting: depth.waiting,
    oldest_due_seconds: depth.oldestSeconds,
    /* Bounded, and every entry is deviceRef, status and a machine token. */
    notes: notes.slice(0, 20),
  };

  const stuck = depth.oldestSeconds > STUCK_SECONDS && depth.waiting > 0;
  const gaveUp = counts.gave_up > 0;

  if (!stuck && !gaveUp) {
    return { outcome: "ok", counts, detail, alert: null };
  }

  return {
    outcome: "attention",
    counts,
    detail,
    alert: {
      kind: stuck ? "push.queue_stuck" : "push.gave_up",
      severity: stuck ? "critical" : "warning",
      detail: {
        waiting: depth.waiting,
        oldest_due_seconds: depth.oldestSeconds,
        gave_up: counts.gave_up,
        devices_failed: counts.devices_failed,
        tokens_retired: counts.tokens_retired,
        reaped: counts.reaped,
      },
    },
  };
}
