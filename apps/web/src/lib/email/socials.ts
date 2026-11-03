import { liveSocials } from "@/lib/brand/socials";

/**
 * OUR ACCOUNTS, FOR THE FOOTER OF EVERY EMAIL (3 November 2026).
 *
 * The same list the site footer, Contact, Help and Settings read
 * (`lib/brand/socials.ts`), so an account is never on one surface and missing
 * from another. An account with no address is never drawn. Shown as plain
 * clickable words in the footer ("Follow us: Facebook, Instagram ...").
 */
export type SocialLink = { key: "x" | "instagram" | "linkedin" | "facebook" | "telegram" | "tiktok"; label: string; url: string };

/** The accounts that exist, in the shared order. */
export function configuredSocials(): SocialLink[] {
  return liveSocials().map((a) => ({ key: a.key, label: a.label, url: a.url }));
}
