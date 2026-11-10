"use client";

import { useState } from "react";
import Link from "next/link";
import type { UiIconName } from "@/design-system/icons/UiIcon";
import { DocCard, DocCardGrid } from "@/components/docs/DocCard";
import { GuideShot, ShotPlaceholder } from "./GuideShot";

/** One guide as the index needs it: plain data, no paragraphs. */
export type GuideCardData = {
  slug: string;
  title: string;
  description: string;
  category: string;
  categoryLabel: string;
  icon: UiIconName;
  /** "3 min read". */
  readLine: string;
  /** The reviewed date as an ISO day, for `<time>`. */
  reviewed: string;
  /** "10 November 2026": the byline's date. */
  reviewedDate: string;
  featured: boolean;
  cover?: { dark: string; light: string; alt: string };
};

/**
 * THE GUIDES INDEX AS A MAGAZINE (R91; DOCS_AND_PRESENCE_UPGRADE.md 2.7 and
 * 4.7). Category chips across the top, one selected (the platform's selected
 * chip: Vallo blue on a blue hairline, never a black pill), the featured
 * guide on its own card with a real product screen, a kicker, the title, the
 * description and the byline, then "Latest" as the kit's cards.
 *
 * The chips filter in place with no reload; with no script every guide is
 * listed under All, which is the state the server draws.
 */
export function GuidesMagazine({
  guides,
  categories,
}: {
  guides: GuideCardData[];
  categories: { id: string; label: string }[];
}) {
  const [selected, setSelected] = useState<string>("all");
  const inView = selected === "all" ? guides : guides.filter((g) => g.category === selected);
  const featured = inView.find((g) => g.featured) ?? null;
  const latest = inView.filter((g) => g !== featured);

  return (
    <div className="grid gap-block">
      <div
        role="group"
        aria-label="Guide categories"
        className="-mx-md flex gap-xs overflow-x-auto px-md pb-3xs [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {[{ id: "all", label: "All" }, ...categories].map((c) => (
          <button
            key={c.id}
            type="button"
            className="nf-chip shrink-0"
            aria-pressed={selected === c.id}
            onClick={() => setSelected(c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>

      {featured ? <FeaturedCard guide={featured} /> : null}

      {latest.length > 0 ? (
        <section aria-labelledby="guides-latest" className="grid gap-sm">
          <h2 id="guides-latest" className="nf-h3">
            Latest
          </h2>
          <DocCardGrid label="Latest guides">
            {latest.map((g) => (
              <DocCard
                key={g.slug}
                href={`/guides/${g.slug}`}
                icon={g.icon}
                title={g.title}
                description={g.description}
                meta={`${g.categoryLabel} · ${g.readLine}`}
              />
            ))}
          </DocCardGrid>
        </section>
      ) : null}
    </div>
  );
}

/**
 * The featured card: the screen, then the kicker (FEATURED and the
 * category), the title, the description, and who wrote it and when. Until
 * the capture runs, the screen is a tinted plate with the category's glyph,
 * so the card keeps its shape and never shows a broken image.
 */
function FeaturedCard({ guide }: { guide: GuideCardData }) {
  const plate = <ShotPlaceholder icon={guide.icon} />;
  return (
    <Link
      href={`/guides/${guide.slug}`}
      className="nf-tap grid gap-sm rounded-[var(--nf-radius-xl)] border border-[var(--nf-border-subtle)] bg-[var(--nf-surface-raised)] p-sm transition-colors hover:border-[var(--nf-border-brand)] md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] md:items-center md:gap-lg md:p-md"
    >
      {guide.cover ? (
        <GuideShot dark={guide.cover.dark} light={guide.cover.light} alt={guide.cover.alt} variant="wide" fallback={plate} />
      ) : (
        plate
      )}
      <span className="grid gap-xs px-2xs pb-2xs md:p-0">
        <span className="text-[length:var(--nf-text-overline)] font-bold tracking-[0.08em] text-[var(--nf-content-link)] uppercase">
          Featured · {guide.categoryLabel}
        </span>
        <span className="font-[family-name:var(--nf-font-display)] text-[length:var(--nf-text-h3)] leading-tight font-bold text-[var(--nf-content-primary)]">
          {guide.title}
        </span>
        <span className="text-[length:var(--nf-text-body)] leading-relaxed text-[var(--nf-content-secondary)]">
          {guide.description}
        </span>
        <span className="text-[length:var(--nf-text-caption)] text-[var(--nf-content-muted)]">
          The Vallo team · <time dateTime={guide.reviewed}>{guide.reviewedDate}</time> · {guide.readLine}
        </span>
      </span>
    </Link>
  );
}
