import type { Metadata } from "next";
import { localizedAlternates } from "@/lib/i18n/public-metadata";
import { formatDate } from "@vallo/i18n/core";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { JsonLd } from "@/components/site/JsonLd";
import { DocHelpPanel, DocShell } from "@/components/docs/DocShell";
import { GUIDES, GUIDE_CATEGORIES, guideCategory, readingMinutes } from "@/lib/guides/articles";
import { breadcrumbLd, webPageLd } from "@/lib/site/structured-data";
import { GuidesMagazine, type GuideCardData } from "./GuidesMagazine";

/**
 * A14, on the documentation kit (R91). `/guides`: plain answers and
 * step-by-steps, public and free to read with no account. The articles live
 * in `lib/guides/articles.ts`; the index reads only their titles, lines,
 * categories and dates, and hands the browser those alone.
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
  const dateOf = (iso: string) =>
    formatDate(new Date(`${iso}T12:00:00+01:00`), locale, { day: "numeric", month: "long", year: "numeric" });

  /* Newest first: "Latest" means it. */
  const cards: GuideCardData[] = [...GUIDES]
    .sort((a, b) => b.published.localeCompare(a.published) || b.reviewed.localeCompare(a.reviewed))
    .map((guide) => {
      const category = guideCategory(guide.category);
      return {
        slug: guide.slug,
        title: guide.title,
        description: guide.description,
        category: guide.category,
        categoryLabel: category.label,
        icon: category.icon,
        reviewed: guide.reviewed,
        reviewedDate: dateOf(guide.reviewed),
        readLine: g.readTime.replace("{minutes}", String(readingMinutes(guide))),
        featured: guide.featured === true,
        cover: guide.cover,
      };
    });

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
      <DocShell section="Guides" sectionHref="/guides" back={false} wide>
        <header className="grid gap-sm">
          <h1 className="font-[family-name:var(--nf-font-display)] text-[length:var(--nf-text-title-lg)] font-bold leading-tight">
            {g.title}
          </h1>
          {/* The one-line promise. */}
          <p className="max-w-measure-body text-[length:var(--nf-text-body)] leading-relaxed text-[var(--nf-content-secondary)]">
            {g.lede}
          </p>
          {locale !== "en" && <p className="nf-caption text-[var(--nf-content-muted)]">{g.englishOnly}</p>}
        </header>
        <div lang="en">
          <GuidesMagazine guides={cards} categories={GUIDE_CATEGORIES.map(({ id, label }) => ({ id, label }))} />
        </div>
        <DocHelpPanel href="/help" label="Open the help centre" />
      </DocShell>
    </>
  );
}
