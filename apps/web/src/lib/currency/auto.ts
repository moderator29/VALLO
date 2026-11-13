import type { DisplayCurrency } from "./currencies";

/**
 * WHAT "AUTOMATIC" MEANS. Client-safe, pure.
 *
 * Nigeria shows naira. Elsewhere the deployment's country header decides
 * (`x-vercel-ip-country`, set by the host on every request, in the browser
 * and in the app shells alike, which load the same site). With no country
 * header (a local run, another host) the reader's language list decides, by
 * the region in its first tag that names one. Whenever the answer is not
 * clear, naira: it is the price of record, so it is never wrong, only less
 * convenient.
 *
 * en-US IS "UNSURE", ON PURPOSE. American English is the factory language of
 * a large share of the phones sold in Nigeria, so "en-US" says far more about
 * the phone than about where its owner thinks in money. Reading it as US
 * dollars would show dollars to people in Lagos. A real US visitor still gets
 * dollars, from the country header, which is what normally decides.
 *
 * A country Vallo has no currency for (Japan, say) is also unsure: naira, not
 * a guess at a neighbour's currency. The person can always choose.
 */

export const COUNTRY_HEADER = "x-vercel-ip-country";

const EUROZONE = [
  "AT", "BE", "HR", "CY", "EE", "FI", "FR", "DE", "GR", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PT", "SK", "SI", "ES",
  /* Not members, and use the euro all the same. */
  "AD", "MC", "SM", "VA", "ME", "XK",
];

/** WAEMU, the eight countries of the West African CFA franc. */
const CFA_WEST = ["BJ", "BF", "CI", "GW", "ML", "NE", "SN", "TG"];

const BY_COUNTRY: ReadonlyMap<string, DisplayCurrency> = new Map<string, DisplayCurrency>([
  ["NG", "NGN"],
  ["US", "USD"],
  ["GB", "GBP"],
  ["GG", "GBP"],
  ["JE", "GBP"],
  ["IM", "GBP"],
  ["CA", "CAD"],
  ["GH", "GHS"],
  ["ZA", "ZAR"],
  ["KE", "KES"],
  ["AE", "AED"],
  ["AU", "AUD"],
  ...EUROZONE.map((c) => [c, "EUR"] as [string, DisplayCurrency]),
  ...CFA_WEST.map((c) => [c, "XOF"] as [string, DisplayCurrency]),
]);

/** Languages that only a Nigerian reader is likely to list first. */
const NIGERIAN_LANGUAGES: ReadonlySet<string> = new Set(["yo", "ha", "ig", "pcm"]);

export type AutoInput = { country?: string | null; acceptLanguage?: string | null };

export type AutoVerdict = { currency: DisplayCurrency; from: "country" | "language" | "unsure" };

export function automaticCurrency(input: AutoInput): AutoVerdict {
  const country = (input.country ?? "").trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(country)) {
    const byCountry = BY_COUNTRY.get(country);
    return byCountry ? { currency: byCountry, from: "country" } : { currency: "NGN", from: "unsure" };
  }

  for (const tag of languageTags(input.acceptLanguage)) {
    const [language = "", ...rest] = tag.toLowerCase().split("-");
    if (NIGERIAN_LANGUAGES.has(language)) return { currency: "NGN", from: "language" };
    const region = rest.find((part) => /^[a-z]{2}$/.test(part))?.toUpperCase();
    if (!region) continue;
    /* The first tag that names a region decides, one way or the other. */
    if (region === "US") return { currency: "NGN", from: "unsure" };
    const byRegion = BY_COUNTRY.get(region);
    return byRegion ? { currency: byRegion, from: "language" } : { currency: "NGN", from: "unsure" };
  }
  return { currency: "NGN", from: "unsure" };
}

/** Accept-Language tags in the reader's order of preference, q=0 dropped. */
export function languageTags(header: string | null | undefined): string[] {
  if (!header) return [];
  return header
    .slice(0, 512)
    .split(",")
    .map((part, index) => {
      const [tag = "", ...params] = part.trim().split(";");
      const q = params.map((p) => /^\s*q=([0-9.]+)\s*$/.exec(p)?.[1]).find(Boolean);
      return { tag: tag.trim(), q: q === undefined ? 1 : Number(q), index };
    })
    .filter((entry) => /^[A-Za-z]{1,8}(-[A-Za-z0-9]{1,8})*$/.test(entry.tag) && entry.q > 0)
    .sort((a, b) => b.q - a.q || a.index - b.index)
    .map((entry) => entry.tag);
}
