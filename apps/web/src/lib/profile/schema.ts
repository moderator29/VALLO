/**
 * schema: the zod schemas the SERVER validates with.
 *
 * Everything a client component may import (the constants, labels, limits,
 * copy and pure helpers) lives in `./model` and is re-exported here, so a server
 * module still imports from this file as before. A client component imports
 * the model, never this file, because this file builds zod schemas at import
 * time and zod's classic API is 64 KB gzipped in every client chunk that
 * reaches it (W13, chunk 2008felnqkn1d).
 */

import { z } from "zod";

/**
 * Profile and settings input schemas.
 *
 * Identity (first name, surname, nickname, state) lives in real columns on
 * profiles, and display_name is derived from them by a database trigger, so
 * the rendered name can never disagree with its parts. The settings jsonb
 * carries preferences only: notification channels, privacy, locale and the
 * data saver. Everything a client sends is validated here, on the server,
 * before a single row is touched.
 */
import {
  AVATAR_PATH_RE,
  LOCALE_CODES,
  MAX_NAME_LENGTH,
  MAX_NICKNAME_LENGTH,
  MAX_PHONE_LENGTH,
  NOTIFICATION_TOPICS,
  type NotificationTopic,
  PHONE_SHAPE_RE,
  ResolvedProfileSettings,
  SETTINGS_DEFAULTS,
  VISIBILITY_LEVELS,
  phoneDigits,
} from "./model";
export * from "./model";

const nameField = (label: string) =>
  z
    .string({ message: `Enter your ${label}.` })
    .trim()
    .min(1, `Enter your ${label}.`)
    .max(MAX_NAME_LENGTH, `That ${label} is too long. Keep it under ${MAX_NAME_LENGTH} characters.`);

export const updateProfileSchema = z.object({
  firstName: nameField("first name"),
  surname: nameField("surname"),
  nickname: z
    .string()
    .trim()
    .max(MAX_NICKNAME_LENGTH, `Keep your nickname under ${MAX_NICKNAME_LENGTH} characters.`)
    .optional()
    .default(""),
  phone: z
    .string()
    .trim()
    .max(MAX_PHONE_LENGTH, "That phone number is too long.")
    .optional()
    .default("")
    .refine(
      (value) => value === "" || (PHONE_SHAPE_RE.test(value) && phoneDigits(value) >= 10),
      "Enter a phone number like 0803 123 4567, or leave it empty.",
    ),
});

/*
 * There is deliberately no state here.
 *
 * `profiles.state_code` carries a foreign key to `public.states (code)`, whose
 * primary key is the two-letter code, and this form used to post the state's
 * NAME from a hardcoded list. Every save with a state selected was refused by
 * the database with 23503 and reported to the person as a generic "we could not
 * save that just now", so the whole profile form silently stopped working the
 * moment somebody chose where they live.
 *
 * Where somebody is now lives on its own screen, `/settings/place`, alongside
 * the local government it has to agree with. One question, one place to answer
 * it, codes on the wire.
 */

export type UpdateProfileInput = z.input<typeof updateProfileSchema>;

export type UpdateProfileValues = z.output<typeof updateProfileSchema>;

/* ------------------------------------------------------------------ settings */

/**
 * Tolerant reader for the stored blob. jsonb can hold anything a past version
 * of the app wrote, so every branch falls back to a default rather than
 * throwing: a malformed settings document must never stop the page rendering.
 */
/* R3-14: the matrix's push column and quiet hours. Shapes are the push
   policy's own readers' (lib/push/preferences.ts, lib/push/quiet-hours.ts), so
   what the screen writes is exactly what delivery reads. */
const CLOCK = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;
const topicPush = z.object({ push: z.boolean() }).partial();
const channelsSchema = z
  .object({
    bookings: topicPush,
    messages: topicPush,
    wallet: topicPush,
    listings: topicPush,
    social: topicPush,
    marketing: topicPush,
  } satisfies Record<NotificationTopic, typeof topicPush>)
  .partial();
const quietHoursSchema = z.object({
  enabled: z.boolean(),
  from: z.string().regex(CLOCK),
  to: z.string().regex(CLOCK),
  timezone: z.string().min(1).max(64),
});

const storedSettingsSchema = z
  .object({
    notifications: z
      .object({
        bookings: z.boolean(),
        messages: z.boolean(),
        wallet: z.boolean(),
        marketing: z.boolean(),
        savedPriceDrops: z.boolean(),
        channels: channelsSchema.optional().catch(undefined),
        quiet_hours: quietHoursSchema.optional().catch(undefined),
      })
      .partial()
      .catch({}),
    privacy: z
      .object({
        hideActivity: z.boolean(),
        showOccupation: z.boolean(),
        showHomeTown: z.boolean(),
        profileVisibility: z.enum(VISIBILITY_LEVELS),
        messagingAccess: z.enum(VISIBILITY_LEVELS),
        contactDiscovery: z.boolean(),
      })
      .partial().catch({}),
    locale: z.enum(LOCALE_CODES).optional().catch(undefined),
    dataSaver: z.boolean().optional().catch(undefined),
    interestsAsked: z.boolean().optional().catch(undefined),
    welcomeSeen: z.boolean().optional().catch(undefined),
    aiConsent: z
      .object({ version: z.string().max(40), at: z.string().max(40) })
      .nullable()
      .optional()
      .catch(undefined),
  })
  .partial()
  .catch({});

export function parseSettings(raw: unknown): ResolvedProfileSettings {
  const stored = storedSettingsSchema.parse(raw);
  return {
    notifications: { ...SETTINGS_DEFAULTS.notifications, ...stored.notifications },
    privacy: { ...SETTINGS_DEFAULTS.privacy, ...stored.privacy },
    locale: stored.locale ?? SETTINGS_DEFAULTS.locale,
    dataSaver: stored.dataSaver ?? SETTINGS_DEFAULTS.dataSaver,
    welcomeSeen: stored.welcomeSeen ?? SETTINGS_DEFAULTS.welcomeSeen,
    interestsAsked: stored.interestsAsked ?? SETTINGS_DEFAULTS.interestsAsked,
    aiConsent: stored.aiConsent ?? SETTINGS_DEFAULTS.aiConsent,
  };
}

/** What a client may change through updateSettings. Identity has its own action. */
export const settingsPatchSchema = z
  .object({
    notifications: z
      .object({
        bookings: z.boolean(),
        messages: z.boolean(),
        wallet: z.boolean(),
        marketing: z.boolean(),
        savedPriceDrops: z.boolean(),
        channels: channelsSchema,
        quiet_hours: quietHoursSchema,
      })
      .partial()
      .optional(),
    privacy: z
      .object({
        hideActivity: z.boolean(),
        showOccupation: z.boolean(),
        showHomeTown: z.boolean(),
        profileVisibility: z.enum(VISIBILITY_LEVELS),
        messagingAccess: z.enum(VISIBILITY_LEVELS),
        contactDiscovery: z.boolean(),
      })
      .partial().optional(),
    locale: z.enum(LOCALE_CODES).optional(),
    dataSaver: z.boolean().optional(),
    interestsAsked: z.boolean().optional(),
    welcomeSeen: z.boolean().optional(),
  })
  .refine((patch) => Object.values(patch).some((value) => value !== undefined), {
    message: "Nothing to save. Change a preference first.",
  });

export type SettingsPatch = z.infer<typeof settingsPatchSchema>;

/**
 * Deep merge a patch over the stored document. The merge happens on the
 * server against a fresh read, so two devices changing different toggles at
 * the same time cannot wipe each other's choice.
 *
 * KEYS THIS SCHEMA DOES NOT KNOW ARE KEPT, EXACTLY AS STORED (13 November
 * 2026). This used to return the parsed document and nothing else, and the
 * parse strips every key the zod schema does not name. So every save through
 * here (a notification toggle, the interests question, the AI consent, the
 * marketing opt-out at sign-up) silently erased whatever else the document
 * held: `whatsappDoorbell`, which `lib/notify/whatsapp-drain.ts` and the
 * database's WhatsApp door read, so a member who had it on lost it the next
 * time they changed anything; `notifications.payments`, which the database
 * mirror trigger then refilled from `wallet` and so could never differ from
 * it; and `display` (the currency and floor-area preference,
 * `lib/currency/preference.ts`). Nothing failed and nothing was logged.
 *
 * The rule now: the known keys are parsed, defaulted and merged as before, so
 * a malformed value is still repaired on write; every other key at the top
 * level, inside `notifications` and inside `privacy` is carried over as it
 * was stored. A reader that wants one of those keys reads the raw document,
 * as the drains already do. The return type names the known keys only; the
 * carried keys are there at runtime and go to the database with the rest.
 */
export function mergeSettings(
  currentRaw: unknown,
  patch: SettingsPatch & { aiConsent?: ResolvedProfileSettings["aiConsent"] },
): ResolvedProfileSettings {
  const current = parseSettings(currentRaw);
  const raw = plainObject(currentRaw);
  return {
    ...raw,
    notifications: {
      ...unknownKeys(raw.notifications, KNOWN_NOTIFICATION_KEYS),
      ...mergeNotifications(current.notifications, patch.notifications),
    },
    privacy: { ...unknownKeys(raw.privacy, KNOWN_PRIVACY_KEYS), ...current.privacy, ...patch.privacy },
    locale: patch.locale ?? current.locale,
    dataSaver: patch.dataSaver ?? current.dataSaver,
    interestsAsked: patch.interestsAsked ?? current.interestsAsked,
    welcomeSeen: patch.welcomeSeen ?? current.welcomeSeen,
    aiConsent: patch.aiConsent === undefined ? current.aiConsent : patch.aiConsent,
  } as ResolvedProfileSettings;
}

/** A stored value as a plain object, or an empty one when it is anything else. */
function plainObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

/* The keys the stored schema above names inside `notifications` and
   `privacy`. They are left out of the carried-over copy, so a malformed
   stored value under one of them (a `channels` string, say) is dropped or
   repaired by the parse rather than carried back in beside it. */
const KNOWN_NOTIFICATION_KEYS: ReadonlySet<string> = new Set([
  "bookings",
  "messages",
  "wallet",
  "marketing",
  "savedPriceDrops",
  "channels",
  "quiet_hours",
]);
const KNOWN_PRIVACY_KEYS: ReadonlySet<string> = new Set([
  "hideActivity",
  "showOccupation",
  "showHomeTown",
  "profileVisibility",
  "messagingAccess",
  "contactDiscovery",
]);

/** The stored object's keys that the schema does not name, as stored. */
function unknownKeys(value: unknown, known: ReadonlySet<string>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(plainObject(value)).filter(([key]) => !known.has(key)));
}

/* -------------------------------------------------------------------- avatar */

export const setAvatarSchema = z.object({
  storagePath: z
    .string({ message: "The upload did not complete. Try again." })
    .trim()
    .max(200, "That file path is too long.")
    .regex(AVATAR_PATH_RE, "The upload did not complete. Choose the photo again."),
});

export type SetAvatarInput = z.infer<typeof setAvatarSchema>;

/**
 * The notifications document, merged one level deeper than the rest: a push
 * switch for one topic must not wipe the push switch for another, and a patch
 * without quiet hours keeps the stored window.
 */
function mergeNotifications(
  current: ResolvedProfileSettings["notifications"],
  patch: SettingsPatch["notifications"],
): ResolvedProfileSettings["notifications"] {
  if (!patch) return current;
  const { channels: patchChannels, quiet_hours: patchQuiet, ...flags } = patch;
  const channels = { ...(current.channels ?? {}) };
  for (const topic of NOTIFICATION_TOPICS) {
    const next = patchChannels?.[topic];
    if (next) channels[topic] = { ...(channels[topic] ?? {}), ...next };
  }
  const quiet = patchQuiet ?? current.quiet_hours;
  return {
    ...current,
    ...flags,
    ...(Object.keys(channels).length > 0 ? { channels } : {}),
    ...(quiet ? { quiet_hours: quiet } : {}),
  };
}
