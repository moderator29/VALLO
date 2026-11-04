import { liveSocials } from "@/lib/brand/socials";

/**
 * OUR ACCOUNTS, FOR THE FOOTER OF EVERY EMAIL (4 November 2026).
 *
 * The same list the site footer, Contact, Help and Settings read
 * (`lib/brand/socials.ts`), so an account is never on one surface and missing
 * from another. An account with no address is never drawn. Drawn as round icons
 * above the footer links.
 */

/** 72px round marks in `public/brand/email/social/`, shown at 36px. */
export const SOCIAL_ICON_PATH = "/brand/email/social/";

export type SocialLink = { key: string; label: string; url: string };

/** The accounts that exist, in the shared order. */
export function configuredSocials(): SocialLink[] {
  return liveSocials().map((a) => ({ key: a.key, label: a.label, url: a.url }));
}
