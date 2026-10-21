import type { MetadataRoute } from "next";
import { DEFAULT_LOCALE, LOCALES } from "@vallo/i18n/core";
import { GUIDE_SLUGS } from "@/lib/guides/slugs";
import { alternateUrls, hasTranslatedBody, localizedPath } from "@/lib/i18n/public-locale";

/**
 * What the sitemap says, decided away from the route that serves it.
 *
 * ===========================================================================
 * WHAT CHANGED ON 23 SEPTEMBER, AND IT IS NOT A TIDY-UP
 * ===========================================================================
 *
 * This file used to take the published catalogue and emit a URL per listing,
 * per accommodation and, behind a flag, per restaurant. It does not any more,
 * because there is nothing left for a crawler to fetch.
 *
 * The founder's item 8 closed the platform: `/listing/[id]`, `/search`,
 * `/stay/[id]`, `/around` and the rest now send a signed-out visitor to
 * `/sign-in` before the page runs. Googlebot is a signed-out visitor. A
 * sitemap that kept naming those addresses would be a list of URLs that every
 * crawler is then refused at, which is a WORSE signal than no sitemap at all:
 * Search Console reports it as "Page with redirect" for every row, and the
 * one honest public surface we do have is buried under a queue of bounces.
 *
 * The founder accepted this consequence by name: "No listing will be indexed
 * by Google, so the landing page becomes our only public surface." It is
 * written up in `docs/STORE_SUBMISSION_NOTES.md` so nobody later reports the
 * empty catalogue in the sitemap as a regression and "fixes" it.
 *
 * THE SYNDICATION GATE IS NOT GONE AND MUST NOT BE REMOVED.
 * `lib/listings/syndication.ts` still governs the JSON-LD block, the Open
 * Graph card and email, which are the three remaining ways a listing reaches
 * a machine. This file simply no longer has rows to pass through it.
 *
 * WHAT WOULD HAVE TO HAPPEN TO PUT INVENTORY BACK. The gate would have to
 * reopen `listing` in `proxy.ts` first. Restoring the rows here without that
 * would publish the same queue of refusals. The order matters and it is
 * written down rather than left to be worked out again.
 */

/**
 * The public, indexable pages, and they are now the whole sitemap.
 *
 * Every path here is one `isPublicPath` in `src/proxy.ts` allows, and
 * `app/sitemap.test.ts` asserts exactly that against the live rule rather than
 * against a copy of it. A sitemap entry that redirects to sign-in is a wasted
 * crawl and a bad signal, and after item 8 that is true of almost every
 * address on this platform.
 *
 * `/delete-account` is here deliberately. It is the page Google Play requires
 * to be publicly reachable, and a page a store reviewer must be able to FIND
 * as well as open.
 *
 * `/offline`, the auth screens and `/welcome` are public and are deliberately
 * absent: they are public because a person needs them, not because a crawler
 * does, and each of them carries its own noindex.
 *
 * `/styleguide` is ours, carries noindex, and is behind the gate.
 *
 * Priority is left off deliberately. Google has said for years that it ignores
 * it, and a made-up ranking of our own pages is a claim we cannot support.
 */
export const PUBLIC_PAGES: readonly {
  path: string;
  changeFrequency: "daily" | "weekly" | "monthly" | "yearly";
}[] = [
  { path: "/", changeFrequency: "daily" },
  { path: "/about", changeFrequency: "monthly" },
  { path: "/help", changeFrequency: "monthly" },
  { path: "/docs", changeFrequency: "monthly" },
  { path: "/safety", changeFrequency: "monthly" },
  { path: "/standards", changeFrequency: "monthly" },
  { path: "/cancellations", changeFrequency: "monthly" },
  { path: "/contact", changeFrequency: "monthly" },
  { path: "/careers", changeFrequency: "monthly" },
  /* Recommendations A: the trust tools (A7), the supply doors (A9), the
     calculator (A8) and the guides (A14). All public, all indexable. */
  { path: "/check", changeFrequency: "monthly" },
  { path: "/r", changeFrequency: "yearly" },
  { path: "/move-in-cost", changeFrequency: "monthly" },
  { path: "/for-agents", changeFrequency: "monthly" },
  { path: "/for-hosts", changeFrequency: "monthly" },
  { path: "/for-landlords", changeFrequency: "monthly" },
  { path: "/guides", changeFrequency: "weekly" },
  ...GUIDE_SLUGS.map((slug) => ({ path: `/guides/${slug}`, changeFrequency: "monthly" as const })),
  { path: "/delete-account", changeFrequency: "yearly" },
  { path: "/eula", changeFrequency: "yearly" },
  { path: "/terms", changeFrequency: "yearly" },
  { path: "/host-agreement", changeFrequency: "yearly" },
  { path: "/privacy", changeFrequency: "yearly" },
];

/**
 * The sitemap, from an origin and nothing else.
 *
 * It takes no rows, and that is the signature doing the work: a function that
 * accepted a catalogue and quietly dropped it would be a lie generator, and
 * the next person to hold this file would reasonably assume the rows were
 * being published.
 */
export function buildSitemap(
  origin: string,
  /**
   * The public area price pages (V-82) that exist right now, and only those.
   * `lib/areas/pages.ts` decides which: an area needs the Price Check minimum
   * of REAL listings, so today this is empty and the sitemap grows with
   * supply rather than ahead of it. Each is an aggregate page, never a
   * listing, so the "no inventory address" rule below still holds.
   */
  areaPages: readonly { path: string; lastModified?: string | null }[] = [],
  /**
   * The public docs chapters (`/docs/<slug>`), from `app/(site)/docs/slugs.ts`,
   * which a test holds equal to the chapters. Each is
   * written in all four languages like the pages above.
   */
  docSlugs: readonly string[] = [],
): MetadataRoute.Sitemap {
  const base = origin.replace(/\/+$/, "");
  /* A10: a public page whose body is written in all four languages is listed
     in all four, each entry naming the others as its alternates (hreflang),
     English also as x-default. A page whose body is English in every locale
     is listed once, at its English address, with no alternates: its language
     addresses are canonical at the English page (`hasTranslatedBody`), and
     listing them was the "Duplicate, Google chose different canonical"
     report. */
  const languages = (path: string) => {
    if (!hasTranslatedBody(path)) return {};
    const urls = alternateUrls(base, path);
    return { alternates: { languages: urls } };
  };
  const localesOf = (path: string) => (hasTranslatedBody(path) ? LOCALES : [DEFAULT_LOCALE]);
  return [
    ...PUBLIC_PAGES.flatMap((page) =>
      localesOf(page.path).map((locale) => {
        const localized = localizedPath(page.path, locale);
        return {
          url: localized === "/" ? base : `${base}${localized}`,
          changeFrequency: page.changeFrequency,
          ...languages(page.path),
        };
      }),
    ),
    ...docSlugs
      .filter((slug) => /^[a-z0-9-]+$/.test(slug))
      .flatMap((slug) =>
        localesOf(`/docs/${slug}`).map((locale) => ({
          url: `${base}${localizedPath(`/docs/${slug}`, locale)}`,
          changeFrequency: "monthly" as const,
          ...languages(`/docs/${slug}`),
        })),
      ),
    ...areaPages
      .filter((page) => /^\/areas\/[a-z0-9-]+\/[a-z0-9-]+$/.test(page.path))
      .map((page) => ({
        url: `${base}${page.path}`,
        changeFrequency: "weekly" as const,
        ...(page.lastModified ? { lastModified: page.lastModified } : {}),
        ...languages(page.path),
      })),
  ];
}
