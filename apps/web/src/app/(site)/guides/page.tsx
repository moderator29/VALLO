import type { Metadata } from "next";
import { localizedAlternates } from "@/lib/i18n/public-metadata";
import { DocCards } from "@/components/docs/DocCard";
import { DocShell } from "@/components/docs/DocShell";
import { formatDate } from "@vallo/i18n/core";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { SiteHead } from "@/components/site/SiteHead";
import { JsonLd } from "@/components/site/JsonLd";
import { GUIDES, readingMinutes } from "@/lib/guides/articles";
import { breadcrumbLd, webPageLd } from "@/lib/site/structured-data";

/**
 * A14. `/guides`: plain answers for renters and guests, public while the
 * catalogue is closed. The articles live in `lib/guides/articles.ts`.
 */
export async function generateMetadata(): Promise<Metadata> {
  const g = getDictionary(await getLocale()).publicDoors.guides;
  return {
    title: g.metaTitle,
    description: g.metaDescription,
    /* A10: canonical in the page's language, and the hreflang set. */
    alternates: (await localizedAlternates("/guides")) ?? { canonical: "/guides" },
    openGraph: { url: "/guides", title: g.metaTitle, description: g.metaDescription },
  };
}

export default async function GuidesPage() {
  const locale = await getLocale();
  const g = getDictionary(locale).publicDoors.guides;
  return (
    <>
      <JsonLd
        data={[
          webPageLd({ path: "/guides", name: g.metaTitle, description: g.metaDescription }),
          breadcrumbLd([
            { name: "Vallo", path: "/" },
            { name: g.chip, path: "/guides" },
          ]),
        ]}
      />
      <SiteHead plate="living-room-dusk" icon="doc-review" chip={g.chip} title={g.title} lede={g.lede} />
      <div className="nf-shell pb-section">
        {/* The guides rise 60ms apart on the shared reveal (Session 3), the
            same arrival as every card list on the public site. */}
        <div lang="en" className="mx-auto max-w-4xl">
          <DocShell section="Guides" home="/guides">
            <DocCards
              label="Guides"
              items={GUIDES.map((guide) => ({
                href: `/guides/${guide.slug}`,
                icon: "file-text" as const,
                title: guide.title,
                line: `${guide.description} ${g.readTime.replace("{minutes}", String(readingMinutes(guide)))}, ${g.reviewed.replace(
                  "{date}",
                  formatDate(new Date(`${guide.reviewed}T12:00:00+01:00`), locale, { day: "numeric", month: "long", year: "numeric" }),
                )}.`,
              }))}
            />
          </DocShell>
        </div>
        {locale !== "en" && <p className="nf-caption mt-md text-center text-[var(--nf-content-muted)]">{g.englishOnly}</p>}
      </div>
    </>
  );
}
