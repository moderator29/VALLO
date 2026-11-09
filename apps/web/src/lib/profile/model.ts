

/** Product locales, matching packages/i18n and the public.locale enum. */
export const LOCALE_CODES = ["en", "yo", "ha", "ig"] as const;

export type LocaleCode = (typeof LOCALE_CODES)[number];

export const MAX_NAME_LENGTH = 80;

export const MAX_NICKNAME_LENGTH = 40;

export const MAX_PHONE_LENGTH = 24;

/**
 * Phone numbers as Nigerians actually write them: 0803 123 4567,
 * +234 803 123 4567, 08031234567. Spaces, brackets and hyphens are allowed
 * and the digit count is what is really checked.
 */
export const PHONE_SHAPE_RE = /^\+?[\d][\d\s()-]{5,22}$/;

export function phoneDigits(value: string): number {
  return value.replace(/\D/g, "").length;
}

export type NotificationSettings = {
  bookings: boolean;
  messages: boolean;
  /**
   * The Payments channel: payment, receipt and payout emails. The stored key
   * is still `wallet`, a name from the retired custody model (D48), because
   * renaming a persisted key needs Session 2's migration (R3-31). The screen
   * calls it Payments (`AccountToggles.tsx`).
   */
  wallet: boolean;
  marketing: boolean;
  /** B13: push for a price drop on a saved place. On by default. */
  savedPriceDrops?: boolean;
  /**
   * R3-14: the push column of the notification matrix, per topic. Read by
   * `wantsPush` (lib/push/preferences.ts, rule 1) before the legacy boolean.
   * The topic keys are the push policy's own (`wallet` is the Payments row,
   * for the reason under `wallet` above).
   */
  channels?: Partial<Record<NotificationTopic, { push?: boolean }>>;
  /**
   * R3-14: quiet hours for push, read by `readQuietHours`
   * (lib/push/quiet-hours.ts). Off unless the member turns them on.
   */
  quiet_hours?: { enabled: boolean; from: string; to: string; timezone: string };
};

/** The topics a push preference is stored against (lib/push/preferences.ts `PushTopic`). */
export const NOTIFICATION_TOPICS = ["bookings", "messages", "wallet", "listings", "social", "marketing"] as const;
export type NotificationTopic = (typeof NOTIFICATION_TOPICS)[number];

export const VISIBILITY_LEVELS = ["everyone", "verified", "connections"] as const;
export type VisibilityLevel = (typeof VISIBILITY_LEVELS)[number];

export type PrivacySettings = {
  hideActivity: boolean;
  /** V-64: publish the occupation on the member's page. Off by default. */
  showOccupation: boolean;
  /** V-64: publish the home town (local government and state). Off by default. */
  showHomeTown: boolean;
  /** TODO 2.4: who can see the full profile. Default: everyone. */
  profileVisibility: VisibilityLevel;
  /** TODO 2.4: who can start a conversation. Default: everyone. */
  messagingAccess: VisibilityLevel;
  /** TODO 2.4: let people find this account by phone or email. Default: true. */
  contactDiscovery: boolean;
};

export type ProfileSettings = {
  notifications: NotificationSettings;
  privacy: PrivacySettings;
  locale?: LocaleCode;
  dataSaver?: boolean;
  /**
   * True once the first-run intent question has been put to this person, by
   * either answering it or skipping it.
   *
   * It lives here rather than beside `profiles.interests` because it is not a
   * fact about the catalogue, it is a note about a conversation we have already
   * had. `interests` alone cannot carry it: an empty array is both "never
   * asked" and "asked and declined", and a skip that is indistinguishable from
   * silence is a skip that asks again tomorrow.
   */
  interestsAsked?: boolean;
  /**
   * True once the three welcome cards have been shown and dismissed, by
   * reading them through or by skipping.
   *
   * Separate from `interestsAsked` because they are two different promises.
   * The cards are us talking and the question is them answering, and somebody
   * who read the cards and then closed the tab has been told what this place
   * is; putting them through it again on their next sign-in is the platform
   * failing to remember a conversation it started. A RETURNING USER MUST NEVER
   * SEE THEM.
   */
  welcomeSeen?: boolean;
  /**
   * STORE-07. When this person agreed that what they type to the assistant or
   * the support chat is sent to Anthropic, and to which wording (`version`,
   * `lib/ai/consent.ts`). Null until they agree; set and cleared only by
   * `recordAiConsent` / `withdrawAiConsent`, never by `updateSettings`.
   */
  aiConsent?: { version: string; at: string } | null;
};

/** Settings with every optional filled in, which is what the UI renders from. */
export type ResolvedProfileSettings = Required<ProfileSettings>;

export const SETTINGS_DEFAULTS: ResolvedProfileSettings = {
  /* B13: savedPriceDrops, the push for a price drop on a saved place, is on
     by default (the founder, 30 September 2026). Marketing email is on by
     default too (the founder, 4 November 2026): the sign-up form shows it as a
     ticked box that can be unticked, and Settings can turn it off at any time.
     It used to be false, and every save of settings (the interests step, for
     one) wrote that false into the member's own row as if they had chosen it. */
  notifications: { bookings: true, messages: true, wallet: true, marketing: true, savedPriceDrops: true },
  /* V-64: occupation and home town are private until the member turns each
     one on. `public.profile_public_facts` reads these two keys. */
  privacy: {
    hideActivity: false,
    showOccupation: false,
    showHomeTown: false,
    profileVisibility: "everyone",
    messagingAccess: "everyone",
    contactDiscovery: true,
  },
  locale: "en",
  dataSaver: false,
  interestsAsked: false,
  welcomeSeen: false,
  aiConsent: null,
};

/** The longest edge an avatar is stored at. The client downscales to this. */
export const AVATAR_MAX_EDGE = 512;

/** The largest upload accepted after downscaling. */
export const AVATAR_MAX_BYTES = 1_500_000;

export const AVATAR_BUCKET = "avatars";

export const AVATAR_PATH_RE = /^[0-9a-f-]{36}\/[A-Za-z0-9._-]{1,80}\.(jpe?g|png|webp)$/i;

/** The public URL a stored avatar is served from. */
export function avatarPublicUrl(supabaseUrl: string, storagePath: string): string {
  return `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/${AVATAR_BUCKET}/${storagePath}`;
}

/* ------------------------------------------------------------------- deletion */

/*
 * DELETION LIVES IN `lib/account-deletion`, AND IT LIVES THERE ONCE.
 *
 * `DELETE_CONFIRM_PHRASE` and `deleteAccountSchema` used to be declared here
 * as well, word for word. Nothing imported this copy any more: the panel and
 * the action both read `lib/account-deletion/constants.ts` and
 * `lib/account-deletion/schema.ts`. A second copy of a confirmation phrase is
 * not redundant, it is a trap with a delay on it: the day somebody changes
 * the words a person has to type, they change one of the two, the form keeps
 * validating against the other, and the failure is an account that cannot be
 * deleted or one that deletes on the wrong words. Deleted rather than
 * re-exported, because a re-export is still a second name for it.
 */

/* ---------------------------------------------------------------- name helpers */

/** One display name from the parts, with no stray spacing. */
export function composeDisplayName(firstName: string, surname: string): string {
  return [firstName.trim(), surname.trim()].filter(Boolean).join(" ");
}

/**
 * Best effort split of a stored display name, used only when the identity
 * block is empty (rows the signup trigger created from auth metadata). The
 * first word is the first name and everything after it is the surname, so
 * compound surnames survive the round trip.
 */
export function splitDisplayName(displayName: string | null): {
  firstName: string;
  surname: string;
} {
  const parts = (displayName ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", surname: "" };
  const [first, ...rest] = parts;
  return { firstName: first ?? "", surname: rest.join(" ") };
}
