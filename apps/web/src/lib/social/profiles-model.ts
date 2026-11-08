

export const HANDLE_MIN = 3;

export const HANDLE_MAX = 20;

/** `check (handle ~ '^[a-z][a-z0-9_]{2,19}$')` on public.social_profiles. */
export const HANDLE_PATTERN = /^[a-z][a-z0-9_]{2,19}$/;

export const BIO_MAX = 240;

export const PRONOUNS_MAX = 24;

export const LINK_MAX = 120;

export const HANDLE_HELP =
  "3 to 20 characters. Letters, numbers and underscores, starting with a letter.";

/* ------------------------------------------------------------------ policy */

export const CONTACT_POLICIES = ["REQUEST", "OPEN"] as const;

export type ContactPolicy = (typeof CONTACT_POLICIES)[number];

/**
 * Who may open a chat with you. The default is REQUEST, because a stranger
 * being able to message anyone by default is how a social layer becomes a
 * harassment surface.
 */
/** SW11: source of truth is now `packages/i18n/src/locales/social.en.ts`. */
import { getDictionary } from "@vallo/i18n";
const _dict = getDictionary("en").social;
export const CONTACT_POLICY_COPY = _dict.contactPolicy as Record<ContactPolicy, { title: string; detail: string }>;
export const PIDGIN_COPY = _dict.pidgin;

/* ------------------------------------------------------------------ fields */

/**
 * Names the platform keeps for itself.
 *
 * `private.validate_social_handle` refuses any handle containing `vallo` or
 * `vallo` outright, with SQLSTATE RM002. This is that same rule, said
 * before the round trip rather than after it, because `/u/rentme` used to offer
 * a visitor a "Claim @vallo" button that walked them into a refusal, and
 * `@vallo` is now a name the product itself uses in every thread.
 *
 * **It is deliberately not the whole rule.** The database also keeps a
 * `private.reserved_handles` table and a ninety day lock on released handles,
 * and neither is readable from a page. Those two still surface as the
 * database's own sentence in the editor, which is the right place for a rule
 * this screen cannot know. What is covered here is the one part that is
 * knowable, permanent, and currently on screen.
 */
export function isOfficialHandle(handle: string): boolean {
  const value = handle.trim().toLowerCase();
  return value.includes("vallo") || value.includes("vallo");
}

/**
 * A link, kept deliberately forgiving at the front and strict at the back.
 *
 * People type `myshop.ng`, not `https://myshop.ng`, so the scheme is optional
 * on the way in and added on the way out. Anything that is not plausibly a web
 * address is refused rather than stored and rendered as a dead link.
 */
export const LINK_PATTERN = /^(https?:\/\/)?[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9-]+)+(\/\S*)?$/i;

export function normaliseLink(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

/** What a link should read as on a profile: no scheme, no trailing slash. */
export function linkLabel(link: string): string {
  return link.replace(/^https?:\/\//i, "").replace(/\/$/, "");
}

/* ------------------------------------------------------------------ covers */

/** The public bucket a cover photo is stored in. */
export const COVER_BUCKET = "social-covers";

/** The longest edge a cover is re-encoded to before it is uploaded. */
export const COVER_MAX_EDGE = 1600;

/** The biggest file we will even try to re-encode. */
export const COVER_MAX_BYTES = 10 * 1024 * 1024;

/**
 * A cover's public URL.
 *
 * The bucket is public, so an object serves straight from its public URL with
 * no signed request. A stored value that is already a URL is returned
 * untouched, which keeps this safe if the projection ever hands one over.
 */
export function coverPublicUrl(supabaseUrl: string, storagePath: string): string {
  if (storagePath.length === 0) return "";
  if (/^https?:\/\//i.test(storagePath)) return storagePath;
  return `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/${COVER_BUCKET}/${storagePath}`;
}

/** The three states a bio can be in, mirroring public.social_status. */
export type BioStatus = "LIVE" | "HELD" | "REMOVED";

/**
 * Why a bio is held, said plainly.
 *
 * A trigger holds a bio or link carrying a ten digit run or payment language
 * before it is ever public. The owner of the bio is told exactly that; everyone
 * else is shown a profile with no bio at all, never a blurred teaser.
 */
export const BIO_HELD_TITLE = "Your bio is under review";

export const BIO_HELD_DETAIL =
  "It looked like it carried a phone number, an account number or a payment ask. Nobody else can see it while we check. Edit it to something without those and it goes live again straight away.";

/** What the saved result hands back to the surface that asked for it. */
export type SocialProfileSaved = {
  handle: string;
  bioStatus: BioStatus;
  /** True when this save created the profile rather than editing one. */
  claimed: boolean;
};
