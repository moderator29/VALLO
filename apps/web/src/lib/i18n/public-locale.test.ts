import { describe, expect, it } from "vitest";
import { isPublicPath } from "../../proxy";
import {
  alternateUrls,
  hasTranslatedBody,
  hreflangLinkHeader,
  isLocalizablePath,
  LOCALIZABLE_SEGMENTS,
  localizedPath,
  preferredLocale,
  publicAlternates,
  splitLocalePrefix,
  TRANSLATED_BODY_SEGMENTS,
} from "./public-locale";

describe("language addresses (A10)", () => {
  it("splits a prefix off, and only a language prefix", () => {
    expect(splitLocalePrefix("/ha/about")).toEqual({ locale: "ha", path: "/about" });
    expect(splitLocalePrefix("/yo")).toEqual({ locale: "yo", path: "/" });
    expect(splitLocalePrefix("/ig/")).toEqual({ locale: "ig", path: "/" });
    expect(splitLocalePrefix("/en/about")).toEqual({ locale: null, path: "/en/about" });
    expect(splitLocalePrefix("/help")).toEqual({ locale: null, path: "/help" });
    expect(splitLocalePrefix("/hausa")).toEqual({ locale: null, path: "/hausa" });
  });

  it("writes English at the bare address and the others under their prefix", () => {
    expect(localizedPath("/", "en")).toBe("/");
    expect(localizedPath("/", "ha")).toBe("/ha");
    expect(localizedPath("/about/", "yo")).toBe("/yo/about");
  });

  it("gives every localizable page a public bare address and public language addresses", () => {
    for (const segment of LOCALIZABLE_SEGMENTS) {
      expect(isPublicPath(`/${segment}`), `/${segment} must be public to have a language address`).toBe(true);
      expect(isPublicPath(`/ha/${segment}`)).toBe(true);
    }
    expect(isPublicPath("/yo")).toBe(true);
    expect(isPublicPath("/ha/home")).toBe(false);
    expect(isPublicPath("/ig/messages")).toBe(false);
  });

  it("keeps the signed-in app out of it", () => {
    for (const path of ["/home", "/settings", "/messages", "/api/support", "/auth/callback", "/offline"]) {
      expect(isLocalizablePath(path), path).toBe(false);
    }
    expect(isLocalizablePath("/")).toBe(true);
    expect(isLocalizablePath("/sign-in")).toBe(true);
  });

  it("prefers the stored choice, then the browser, then English", () => {
    expect(preferredLocale("yo", "ha")).toBe("yo");
    expect(preferredLocale(undefined, "ig-NG,en;q=0.5")).toBe("ig");
    expect(preferredLocale("xx", null)).toBe("en");
  });

  it("lists all four addresses and English as x-default", () => {
    expect(alternateUrls("https://vallospaces.com/", "/about")).toEqual({
      en: "https://vallospaces.com/about",
      ha: "https://vallospaces.com/ha/about",
      yo: "https://vallospaces.com/yo/about",
      ig: "https://vallospaces.com/ig/about",
      "x-default": "https://vallospaces.com/about",
    });
    expect(alternateUrls("https://vallospaces.com", "/").en).toBe("https://vallospaces.com/");
  });
});

describe("a language address is canonical only where its body is in that language", () => {
  /* Search Console: "Duplicate, Google chose different canonical than user".
     /ha/terms served the English Terms word for word with a self canonical
     and a sitemap entry, so Google kept /terms and reported the copy. */
  const ORIGIN = "https://www.vallospaces.com";

  it("names the English page as canonical for a page whose body is English", () => {
    for (const locale of ["ha", "yo", "ig"] as const) {
      expect(publicAlternates(ORIGIN, "/terms", locale)).toEqual({ canonical: "/terms" });
      expect(publicAlternates(ORIGIN, "/docs/viewings", locale)).toEqual({ canonical: "/docs/viewings" });
      expect(publicAlternates(ORIGIN, "/guides/renting-in-lagos", locale).canonical).toBe("/guides/renting-in-lagos");
    }
    expect(publicAlternates(ORIGIN, "/terms", "en")).toEqual({ canonical: "/terms" });
  });

  it("keeps a self canonical and the four-language hreflang set where the body is translated", () => {
    expect(publicAlternates(ORIGIN, "/", "ha")).toEqual({ canonical: "/ha", languages: alternateUrls(ORIGIN, "/") });
    expect(publicAlternates(ORIGIN, "/check", "yo").canonical).toBe("/yo/check");
    expect(publicAlternates(ORIGIN, "/check", "yo").languages?.ig).toBe(`${ORIGIN}/ig/check`);
  });

  it("sends the hreflang Link header only for translated bodies", () => {
    expect(hreflangLinkHeader(ORIGIN, "/terms")).toBeNull();
    expect(hreflangLinkHeader(ORIGIN, "/about")).toBeNull();
    expect(hreflangLinkHeader(ORIGIN, "/")).toContain('hreflang="ha"');
  });

  it("lists only localizable segments as translated", () => {
    for (const segment of TRANSLATED_BODY_SEGMENTS) {
      expect(LOCALIZABLE_SEGMENTS.has(segment), segment).toBe(true);
    }
    expect(hasTranslatedBody("/")).toBe(true);
    expect(hasTranslatedBody("/privacy")).toBe(false);
  });
});
