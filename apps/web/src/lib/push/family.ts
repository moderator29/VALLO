import type { NotificationKind } from "./preferences";

/**
 * WHICH FAMILY A PUSH BELONGS TO (FEATURE_BACKLOG A1 to A3, Agent NATIVE job
 * 6, 7 November 2026). The founder showed his lock screen: the best apps
 * there say what kind of thing arrived before they say what it is.
 *
 * One family per push decides three things on every platform at once:
 *
 *   label           the header line (`subtitle`): iOS draws it in bold under
 *                   the title; web push puts it before the body
 *   androidChannel  the Android channel, so a member can silence offers in
 *                   the system settings without silencing messages. Created
 *                   by the shell at start (`lib/native/push-taps.ts`); a push
 *                   for a channel a phone does not have yet falls back to the
 *                   manifest's default channel (FCM's own rule), never lost
 *   iosCategory     the APNs `category`, which the Notification Service
 *                   Extension and any future buttons key off
 *
 * Calls and missed calls keep the channels they already have, whose
 * importance is fixed on every phone that has ever received one.
 */
export type PushFamily = "messages" | "bookings" | "money" | "activity" | "offers" | "calls";

export type FamilyInfo = { family: PushFamily; label: string; androidChannel: string; iosCategory: string };

/** English, like the other words added before a native speaker has read them. */
const INFO: Record<PushFamily, Omit<FamilyInfo, "family">> = {
  messages: { label: "Messages", androidChannel: "vallo_messages", iosCategory: "VALLO_MESSAGES" },
  bookings: { label: "Bookings", androidChannel: "vallo_bookings", iosCategory: "VALLO_BOOKINGS" },
  money: { label: "Money", androidChannel: "vallo_money", iosCategory: "VALLO_MONEY" },
  activity: { label: "Activity", androidChannel: "vallo_activity", iosCategory: "VALLO_ACTIVITY" },
  offers: { label: "Offers", androidChannel: "vallo_offers", iosCategory: "VALLO_OFFERS" },
  calls: { label: "Calls", androidChannel: "vallo_calls", iosCategory: "VALLO_CALLS" },
};

/** The Android channels the shell creates, with their importance (4 high, 3 default, 2 low). */
export const ANDROID_CHANNELS: ReadonlyArray<{ id: string; name: string; importance: number; description: string }> = [
  { id: "vallo_messages", name: "Messages", importance: 4, description: "New messages and replies" },
  { id: "vallo_bookings", name: "Bookings", importance: 4, description: "Requests, confirmations and reminders for your bookings" },
  { id: "vallo_money", name: "Money", importance: 4, description: "Payments, payouts and refunds" },
  { id: "vallo_activity", name: "Activity", importance: 3, description: "Your listings, follows, likes and updates from Vallo" },
  { id: "vallo_offers", name: "Offers", importance: 2, description: "Price drops on places you saved, and news" },
];

/**
 * The family of one push. `call` and `missed` come from the path (the call
 * paths in policy.ts); a price drop on a saved place is an offer, whatever
 * kind carried it.
 */
export function familyOf(input: { kind: NotificationKind; call?: boolean; missedCall?: boolean; priceDrop?: boolean }): FamilyInfo {
  const pick = (family: PushFamily): FamilyInfo => ({ family, ...INFO[family] });
  if (input.call || input.missedCall) return pick("calls");
  if (input.priceDrop) return pick("offers");
  switch (input.kind) {
    case "message":
    case "support":
      /* A support reply is a conversation too. */
      return pick("messages");
    case "booking":
      return pick("bookings");
    case "wallet":
      return pick("money");
    default:
      return pick("activity");
  }
}

/** The APNs category for a family. */
export function familyCategory(family: PushFamily): string {
  return INFO[family].iosCategory;
}

/**
 * The Android channel a push is drawn on. A call's ring and a missed call
 * keep the channels every phone already has (`vallo_calls`, `vallo_missed`);
 * a push with no family (the night's summary) stays on `vallo_default`.
 */
export function androidChannelFor(payload: { call?: boolean; quiet?: boolean; tag: string; category?: PushFamily }): string {
  if (payload.call) return "vallo_calls";
  if (payload.quiet && payload.tag === "vallo-missed-call") return "vallo_missed";
  if (!payload.category || payload.category === "calls") return "vallo_default";
  return INFO[payload.category].androidChannel;
}

/**
 * A10 (founder, 7 November 2026): Vallo's own notification sound, a short
 * two-note bell (A5 then E6, 0.8 s), in the iOS bundle as `vallo_chime.caf`
 * and in Android's `res/raw/vallo_chime.wav`, both from build 1.0.2 (the
 * same samples in two containers). The names here must match the files,
 * which `lib/push/rich-push.test.ts` checks.
 */
export const CHIME_IOS = "vallo_chime.caf";
export const CHIME_ANDROID = "vallo_chime";
/** The Android channel sound, as the push plugin's `createChannel` takes it. */
export const CHIME_ANDROID_FILE = "vallo_chime.wav";
