/**
 * VALLO'S OWN SOCIAL ACCOUNTS (28 October 2026, from the founder).
 *
 * The one place the accounts are written down: the footer, Contact, Help, the
 * app's Settings and the Organization data (`sameAs`) all read this list, so
 * an account can never be on one screen and missing from another.
 *
 * LINKEDIN is the founder's address of 28 October 2026 (an `/in/` profile
 * address; a company page would be `/company/`). A network with no address is
 * never drawn (an icon that opens nothing is a picture of a feature): set a
 * `url` to null and it disappears everywhere.
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
  { key: "linkedin", label: "LinkedIn", url: "https://ng.linkedin.com/in/vallo-home-ltd-088688447", handle: null },
];

/** The accounts that exist, in display order. */
export function liveSocials(accounts: readonly SocialAccount[] = SOCIAL_ACCOUNTS): (SocialAccount & { url: string })[] {
  return accounts.filter((a): a is SocialAccount & { url: string } => typeof a.url === "string" && /^https:\/\//.test(a.url));
}
