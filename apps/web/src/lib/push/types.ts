import type { PushPlatform, PushRevokedReason } from "./schema";

/**
 * The shapes every transport agrees on.
 *
 * The important one is `ProviderReply`, and its shape is the whole lesson of
 * this build: a transport does not return "ok". It returns the STATUS the
 * push service gave back. A function that could return success without
 * carrying a status would let the 24-day fault back in through the type
 * system, so there is no such return value to reach for.
 */

export type { PushPlatform, PushRevokedReason };

/** A device, as the drain needs it. */
export type PushTarget = {
  id: string;
  platform: PushPlatform;
  /** THE CAPABILITY. Never logged, never put in an alert, never returned. */
  token: string;
  /** Web Push only. */
  p256dh: string | null;
  auth: string | null;
  /** The safe handle. This is what goes in a log line or an alert. */
  deviceRef: string;
};

/** What a person sees on their lock screen. */
export type PushPayload = {
  title: string;
  body: string;
  /** Where tapping it lands, as a path on our own origin. */
  href: string;
  /** Collapses on the device: a newer one of the same tag replaces the old. */
  tag: string;
  /** True for money and security, which also ignore quiet hours. */
  urgent: boolean;
  /** B11: an fyi (a like, a follow): shown without sound or vibration. */
  quiet?: boolean;
  /** V-53: up to two buttons, each a destination on our origin. */
  actions?: import("./actions").PushAction[];
};

/**
 * WHAT THE PUSH SERVICE ACTUALLY SAID.
 *
 * `status` is the HTTP status, and it is not optional, because every branch
 * that settles a delivery has to have read one. `outcome` is our reading of
 * it, and the three readings are genuinely different things:
 *
 *   accepted  the service took it. This is 201 for Web Push and APNs, 200
 *             for FCM. It does NOT mean a handset lit up; it means the
 *             service that owns that handset has it. That distinction is
 *             real and this code never claims more than it knows.
 *
 *   gone      the service says this token is dead: 404 or 410 on Web Push,
 *             410 on APNs, UNREGISTERED on FCM. The token is retired.
 *
 *   failed    anything else. Retryable, or not, by status.
 */
export type ProviderReply = {
  outcome: "accepted" | "gone" | "failed";
  /** The HTTP status. 0 only when the request never completed at all. */
  status: number;
  /** The provider's message id, when it gives one. Opaque. */
  messageId?: string;
  /**
   * A short machine token for why it failed. NEVER a response body: FCM and
   * APNs both echo the registration token back inside some error payloads,
   * and a token must never leave the tokens table.
   */
  error?: string;
};

/** A transport is a function from a device and a payload to what happened. */
export type PushTransportFn = (target: PushTarget, payload: PushPayload) => Promise<ProviderReply>;

/**
 * Turn a status into a reply, for the several places that read one.
 *
 * `gone` is decided by status alone, which is correct for Web Push and APNs.
 * FCM answers 404 with a body that distinguishes UNREGISTERED from other
 * causes, and its transport reads that itself before calling this.
 */
export function replyFromStatus(status: number, error?: string): ProviderReply {
  if (status >= 200 && status < 300) return { outcome: "accepted", status };
  if (status === 404 || status === 410) return { outcome: "gone", status, error: error ?? `http_${status}` };
  return { outcome: "failed", status, error: error ?? `http_${status}` };
}

/** Is this failure worth another go, or is it the same answer every time? */
export function isRetryable(reply: ProviderReply): boolean {
  if (reply.outcome !== "failed") return false;
  /* A request that never completed: a timeout, a reset, a DNS failure. */
  if (reply.status === 0) return true;
  /* Rate limited, or the service is having a bad day. */
  if (reply.status === 429) return true;
  if (reply.status >= 500) return true;
  /* 400, 401, 403, 413: our payload or our credentials are wrong and they
     will be exactly as wrong in five minutes. Retrying these is how a queue
     turns one mistake into a million requests. */
  return false;
}

/**
 * THE PROVIDER'S REFUSALS THAT ARE ABOUT OUR SET-UP, NOT THE DEVICE.
 *
 * A wrong APNs key, an expired provider token, a wrong bundle topic, a
 * service account without permission or a wrong FCM project id answers the
 * same way for every device on the deployment. Counting those against each
 * device's failure streak retired every token after eight notifications and
 * quietly emptied `push_tokens` for a configuration mistake. They are still
 * recorded and still permanent for the queue row; they are never the
 * device's fault.
 */
const CONFIGURATION_ERRORS: ReadonlySet<string> = new Set([
  /* APNs */
  "InvalidProviderToken",
  "ExpiredProviderToken",
  "MissingProviderToken",
  "BadCertificate",
  "BadCertificateEnvironment",
  "BadTopic",
  "MissingTopic",
  "TopicDisallowed",
  "BadPath",
  "Forbidden",
  /* FCM */
  "UNAUTHENTICATED",
  "PERMISSION_DENIED",
  "THIRD_PARTY_AUTH_ERROR",
  "NOT_FOUND",
]);

export function isConfigurationFailure(reply: ProviderReply): boolean {
  return reply.outcome === "failed" && CONFIGURATION_ERRORS.has(reply.error ?? "");
}

