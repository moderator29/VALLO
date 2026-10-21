import "server-only";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { getDictionary, LOCALES, type Locale, type PublicPageKey } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { siteUrl } from "@/lib/site";
import { OWN_CARD, SITE_CARD } from "@/lib/site/site-card";
import {
  isLocalizablePath,
  OG_LOCALE,
  publicAlternates,
  splitLocalePrefix,
  URL_PATH_HEADER,
} from "./public-locale";

/**
 * A10: WHAT A PUBLIC PAGE TELLS A SEARCH ENGINE AND A CHAT UNFURLER, IN THE
 * PAGE'S OWN LANGUAGE.
 *
 * Under the proxy's rewrite a page only sees its bare path, so a relative
 * canonical (`./`) on `/ha/about` would name `/about` and tell a search
 * engine the Hausa page is a copy of the English one. The proxy passes the
 * address as typed on `x-vallo-url-path`; this reads it back and writes the
 * canonical, the four hreflang alternates and the Open Graph locale from it.
 */

/** The bare path of the public page being rendered, or null off the public site. */
export async function publicBarePath(): Promise<string | null> {
  const address = (await headers()).get(URL_PATH_HEADER);
  if (!address) return null;
  const bare = splitLocalePrefix(address).path;
  return isLocalizablePath(bare) ? bare : null;
}

/** Canonical plus hreflang for a public page, in the page's language. */
export async function localizedAlternates(barePath?: string): Promise<Metadata["alternates"] | undefined> {
  const bare = barePath ?? (await publicBarePath());
  if (!bare) return undefined;
  const locale = await getLocale();
  /* A language address whose body is still English is canonical at the
     English page and carries no hreflang set (`hasTranslatedBody`). */
  const { canonical, languages } = publicAlternates(siteUrl(), bare, locale);
  return languages ? { canonical, languages: { ...languages } } : { canonical };
}

/** The Open Graph locale for the page's language, with the other three as alternates. */
export function openGraphLocales(locale: Locale): { locale: string; alternateLocale: string[] } {
  return {
    locale: OG_LOCALE[locale],
    alternateLocale: LOCALES.filter((other) => other !== locale).map((other) => OG_LOCALE[other]),
  };
}

/**
 * A public page's metadata from `publicMeta.pages[key]` in the reader's
 * language: title, description, canonical and hreflang, and the Open Graph
 * locale. `extra` is merged last (a page's robots rule, for instance).
 */
export async function publicPageMetadata(key: PublicPageKey, extra: Metadata = {}): Promise<Metadata> {
  const locale = await getLocale();
  const page = getDictionary(locale).publicMeta.pages[key] as { title: string; description?: string };
  const alternates = await localizedAlternates();
  return {
    title: page.title,
    ...(page.description ? { description: page.description } : {}),
    ...(alternates ? { alternates } : {}),
    openGraph: {
      siteName: "Vallo",
      type: "website",
      title: page.title,
      ...(page.description ? { description: page.description } : {}),
      /* Other-language card locales only where those languages have a body. */
      ...(alternates && !alternates.languages ? { locale: OG_LOCALE[locale] } : openGraphLocales(locale)),
      ...(alternates?.canonical ? { url: alternates.canonical as string } : {}),
      /* A page without its own card names the site's, or it unfurls blank. */
      ...(OWN_CARD.has(key) ? {} : { images: [SITE_CARD] }),
    },
    ...extra,
  };
}
