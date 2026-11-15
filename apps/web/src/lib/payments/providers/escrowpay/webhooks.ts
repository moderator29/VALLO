import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * THE PROVIDER'S WEBHOOKS, the pure half. Every fact is the provider's own
 * (docs.escrowpay.app, "Webhooks: inbound deliveries"):
 *
 *  - the delivery is an HTTP POST with a JSON body, sent at least once; a
 *    redelivery carries the same `EscrowPay-Event-Id`, which is the body's
 *    `id` (`WHEV_...`), and that is what Vallo de-duplicates on;
 *  - `EscrowPay-Signature: t=<unix_seconds>,v1=<hex>` where
 *    `v1 = hex(HMAC_SHA256(signing_secret, "<t>." + raw_body_bytes))`, the
 *    signing secret being the endpoint's own (`whsec_...`), not the API key;
 *  - a delivery whose `t` is more than 300 seconds from now is refused;
 *  - during a rotation either the current or the previous secret is valid
 *    for 24 hours;
 *  - the envelope is `{ id, type, api_version, created_at, object,
 *    object_id, data }`, `type` from a closed set (`ESCROWPAY_EVENT_TYPES`).
 *
 * The discipline: verify over the raw body in constant time, store the raw
 * event first (`provider_webhook_events`, idempotent on provider and event
 * key), never trust the arrival order, and acknowledge an event Vallo does
 * not act on without acting on it.
 */
export const ESCROWPAY_SIGNATURE_HEADER = "escrowpay-signature";
export const ESCROWPAY_EVENT_ID_HEADER = "escrowpay-event-id";

/** How far the signed time may be from now, in seconds, either way. */
export const ESCROWPAY_SIGNATURE_TOLERANCE_SECONDS = 300;

/** The provider's closed set of event names, as its guide lists them. */
export const ESCROWPAY_EVENT_TYPES = [
  "business.verification_updated",
  "transaction.created",
  "transaction.funding_started",
  "transaction.partially_funded",
  "transaction.funded",
  "transaction.expired",
  "transaction.cancelled",
  "charge.pending",
  "charge.succeeded",
  "charge.failed",
  "charge.reversed",
  "payment_account.active",
  "payment_account.funded",
  "payment_account.expired",
  "milestone.funded",
  "milestone.release_scheduled",
  "milestone.released",
  "milestone.refunded",
  "release.created",
  "release.scheduled",
  "release.completed",
  "release.failed",
  "refund.created",
  "refund.processing",
  "refund.completed",
  "refund.failed",
  "refund.requires_action",
  "wallet.credited",
  "wallet.debited",
  "payout.created",
  "payout.processing",
  "payout.completed",
  "payout.failed",
  "payout.reversed",
  "administrative_hold.applied",
  "administrative_hold.released",
  "reconciliation.issue_detected",
] as const;

export type EscrowPayEventType = (typeof ESCROWPAY_EVENT_TYPES)[number];

function parseSignature(header: string): { t: string; v1: string } | null {
  let t: string | null = null;
  let v1: string | null = null;
  for (const part of header.split(",")) {
    const at = part.indexOf("=");
    if (at < 1) continue;
    const name = part.slice(0, at).trim();
    const value = part.slice(at + 1).trim();
    if (name === "t" && t === null) t = value;
    if (name === "v1" && v1 === null) v1 = value;
  }
  if (!t || !v1 || !/^\d{1,12}$/.test(t) || !/^[0-9a-f]{64}$/i.test(v1)) return null;
  return { t, v1: v1.toLowerCase() };
}

/**
 * Whether the delivery was signed by one of the endpoint's secrets, within
 * the time window. `rawBody` is the request's body exactly as it arrived.
 */
export function verifyEscrowPaySignature(
  rawBody: string,
  header: string | null,
  secrets: readonly (string | null | undefined)[] | string | null,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): boolean {
  if (!header) return false;
  const known = (Array.isArray(secrets) ? secrets : [secrets]).filter((s): s is string => typeof s === "string" && s.length > 0);
  if (known.length === 0) return false;
  const signature = parseSignature(header);
  if (!signature) return false;
  if (Math.abs(nowSeconds - Number(signature.t)) > ESCROWPAY_SIGNATURE_TOLERANCE_SECONDS) return false;
  const given = Buffer.from(signature.v1, "hex");
  const message = Buffer.concat([Buffer.from(`${signature.t}.`, "ascii"), Buffer.from(rawBody, "utf8")]);
  let valid = false;
  for (const secret of known) {
    const expected = createHmac("sha256", secret).update(message).digest();
    /* Every secret is compared, so the time taken does not say which one matched. */
    if (expected.length === given.length && timingSafeEqual(expected, given)) valid = true;
  }
  return valid;
}

export type EscrowPayWebhook = {
  /** The event's own id (`WHEV_...`): the de-duplication key. */
  key: string;
  /** The event name, as sent. One of `ESCROWPAY_EVENT_TYPES`, or a name newer than this list. */
  event: string;
  /** The kind of thing the event is about (`transaction`, `release`, ...). */
  object: string;
  objectId: string;
  /** The transaction the event belongs to, when the event names one. */
  transactionId: string | null;
  /** The principal the event reports, in kobo, when it reports one. */
  amountMinor: number | null;
  createdAt: string | null;
  data: Record<string, unknown>;
};

const text = (value: unknown): string | null => (typeof value === "string" && value.trim().length > 0 ? value.trim() : null);

/**
 * Parse a verified body. Null for anything that is not the documented
 * envelope: the route records it as malformed and acts on nothing.
 */
export function parseEscrowPayWebhook(body: unknown): EscrowPayWebhook | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const b = body as Record<string, unknown>;
  const key = text(b.id);
  const event = text(b.type);
  const object = text(b.object);
  const objectId = text(b.object_id);
  if (!key || !event || !object || !objectId) return null;
  const data = b.data && typeof b.data === "object" && !Array.isArray(b.data) ? (b.data as Record<string, unknown>) : {};
  /* A transaction event is about the transaction itself; anything else names it in its snapshot. */
  const transactionId = object === "transaction" ? objectId : text(data.transaction_id);
  const amount = data.amount_minor;
  return {
    key: key.slice(0, 200),
    event: event.slice(0, 100),
    object: object.slice(0, 60),
    objectId: objectId.slice(0, 120),
    transactionId: transactionId ? transactionId.slice(0, 120) : null,
    amountMinor: typeof amount === "number" && Number.isSafeInteger(amount) && amount > 0 ? amount : null,
    createdAt: text(b.created_at),
    data,
  };
}
