/**
 * OUR ACCOUNTS, FOR THE FOOTER OF EVERY EMAIL (3 November 2026).
 *
 * The same rule as the site footer (`components/site/SiteFooter.tsx`): a mark
 * is drawn only for an account that exists, because a social icon that opens
 * nothing is the clearest picture of an unfinished product. Each address is
 * read from the environment, so adding an account is a setting and no code:
 *
 *   NEXT_PUBLIC_VALLO_X_URL          NEXT_PUBLIC_VALLO_INSTAGRAM_URL
 *   NEXT_PUBLIC_VALLO_LINKEDIN_URL   NEXT_PUBLIC_VALLO_FACEBOOK_URL
 *   NEXT_PUBLIC_VALLO_TELEGRAM_URL   NEXT_PUBLIC_VALLO_TIKTOK_URL
 *
 * Only an https address is accepted. The icons are 72px circles in
 * `public/brand/email/social/`, shown at 36px.
 */

export const SOCIAL_ICON_PATH = "/brand/email/social/";

export const SOCIALS = [
  { key: "x", label: "X", env: "NEXT_PUBLIC_VALLO_X_URL" },
  { key: "instagram", label: "Instagram", env: "NEXT_PUBLIC_VALLO_INSTAGRAM_URL" },
  { key: "linkedin", label: "LinkedIn", env: "NEXT_PUBLIC_VALLO_LINKEDIN_URL" },
  { key: "facebook", label: "Facebook", env: "NEXT_PUBLIC_VALLO_FACEBOOK_URL" },
  { key: "telegram", label: "Telegram", env: "NEXT_PUBLIC_VALLO_TELEGRAM_URL" },
  { key: "tiktok", label: "TikTok", env: "NEXT_PUBLIC_VALLO_TIKTOK_URL" },
] as const;

export type SocialLink = { key: (typeof SOCIALS)[number]["key"]; label: string; url: string };

/** The accounts that are set, in the fixed order above. */
export function configuredSocials(env: Record<string, string | undefined> = process.env): SocialLink[] {
  const out: SocialLink[] = [];
  for (const s of SOCIALS) {
    const url = env[s.env]?.trim();
    if (url && /^https:\/\/[^\s"<>]+$/i.test(url)) out.push({ key: s.key, label: s.label, url });
  }
  return out;
}
