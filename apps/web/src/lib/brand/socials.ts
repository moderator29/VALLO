/**
 * VALLO'S OWN SOCIAL ACCOUNTS (28 October 2026, from the founder).
 *
 * The one place the accounts are written down: the footer, Contact, Help, the
 * app's Settings and the Organization data (`sameAs`) all read this list, so
 * an account can never be on one screen and missing from another.
 *
 * LINKEDIN HAS NO ADDRESS YET. The founder named "LinkedIn: Profile of VALLO
 * HOME LTD" without a link, and the company is VALLO SPACES LTD, so the page
 * address is left empty rather than guessed. A network with no address is
 * never drawn (an icon that opens nothing is a picture of a feature). Put the
 * real page address in `url` and it appears everywhere, with no other change.
 */
export type SocialKey = "facebook" | "instagram" | "tiktok" | "linkedin";

export type SocialAccount = {
  key: SocialKey;
  /** The network's own name, as people say it. */
  label: string;
  /** The profile address, or null until there is a real one. */
  url: string | null;
  /** The handle as it appears on the network, for the screen reader and the share line. */
  handle: string | null;
};

export const SOCIAL_ACCOUNTS: readonly SocialAccount[] = [
  { key: "facebook", label: "Facebook", url: "https://www.facebook.com/profile.php?id=61595844516966", handle: null },
  { key: "instagram", label: "Instagram", url: "https://www.instagram.com/vallospaces", handle: "@vallospaces" },
  { key: "tiktok", label: "TikTok", url: "https://www.tiktok.com/@vallo.spaces", handle: "@vallo.spaces" },
  { key: "linkedin", label: "LinkedIn", url: null, handle: null },
];

/** The accounts that exist, in display order. */
export function liveSocials(accounts: readonly SocialAccount[] = SOCIAL_ACCOUNTS): (SocialAccount & { url: string })[] {
  return accounts.filter((a): a is SocialAccount & { url: string } => typeof a.url === "string" && /^https:\/\//.test(a.url));
}
