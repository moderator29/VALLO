import { liveSocials } from "@/lib/brand/socials";
import { siteUrl } from "@/lib/site";
import { SUPPORT_EMAIL } from "@/lib/support-email";

/**
 * A13. STRUCTURED DATA FOR THE PUBLIC PAGES, AS PURE BUILDERS.
 *
 * Every block states only what the platform can answer for:
 *
 *   Organization  the legal name printed in the footer, the logo file that
 *                 ships in `public/brand`, the support contact only when
 *                 the one contact address (`CONTACT_EMAIL`) is offered, and `sameAs` only for
 *                 the social accounts the footer itself draws
 *                 (`lib/brand/socials.ts`; an account with no address is not
 *                 claimed).
 *   WebSite       with a `SearchAction` only while the catalogue is open to
 *                 strangers: a search box in a result that lands a crawler on
 *                 a sign-in wall is a promise the page does not keep.
 *   WebPage, BreadcrumbList, FAQPage, Article  per page.
 *
 * No rating, no review count, no price, no invented date. An Article carries
 * the "last reviewed" date its guide states.
 */

export type JsonLdNode = Record<string, unknown>;

export const LEGAL_NAME = "VALLO SPACES LTD";

function absolute(path: string): string {
  const base = siteUrl().replace(/\/+$/, "");
  return path === "/" ? `${base}/` : `${base}${path}`;
}

/** The social accounts that exist (`lib/brand/socials.ts`): what `sameAs` claims. */
export function socialProfiles(): string[] {
  return liveSocials().map((a) => a.url);
}

export function organizationLd(): JsonLdNode {
  const sameAs = socialProfiles();
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": absolute("/#organization"),
    name: "Vallo",
    legalName: LEGAL_NAME,
    url: absolute("/"),
    logo: absolute("/brand/vallo-logo.png"),
    ...(SUPPORT_EMAIL
      ? { contactPoint: [{ "@type": "ContactPoint", contactType: "customer support", email: SUPPORT_EMAIL, areaServed: "NG" }] }
      : {}),
    ...(sameAs.length > 0 ? { sameAs } : {}),
  };
}

export function websiteLd(options: { searchOpen: boolean }): JsonLdNode {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": absolute("/#website"),
    name: "Vallo",
    url: absolute("/"),
    publisher: { "@id": absolute("/#organization") },
    inLanguage: ["en-NG", "ha-NG", "yo-NG", "ig-NG"],
    ...(options.searchOpen
      ? {
          potentialAction: {
            "@type": "SearchAction",
            target: { "@type": "EntryPoint", urlTemplate: `${absolute("/search")}?q={search_term_string}` },
            "query-input": "required name=search_term_string",
          },
        }
      : {}),
  };
}

export function webPageLd(page: { path: string; name: string; description?: string }): JsonLdNode {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": absolute(page.path),
    url: absolute(page.path),
    name: page.name,
    ...(page.description ? { description: page.description } : {}),
    isPartOf: { "@id": absolute("/#website") },
    publisher: { "@id": absolute("/#organization") },
  };
}

export function breadcrumbLd(trail: readonly { name: string; path: string }[]): JsonLdNode {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: absolute(crumb.path),
    })),
  };
}

export function faqLd(items: readonly { q: string; a: string }[]): JsonLdNode {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
}

export function articleLd(article: {
  path: string;
  title: string;
  description: string;
  reviewed: string;
  published: string;
}): JsonLdNode {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": absolute(article.path),
    mainEntityOfPage: absolute(article.path),
    headline: article.title,
    description: article.description,
    datePublished: article.published,
    dateModified: article.reviewed,
    inLanguage: "en-NG",
    author: { "@id": absolute("/#organization") },
    publisher: { "@id": absolute("/#organization") },
    image: absolute(`${article.path}/opengraph-image`),
  };
}

/** Safe inside a `<script>`: a `<` can never close the element early. */
export function jsonLdText(data: JsonLdNode | readonly JsonLdNode[]): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
