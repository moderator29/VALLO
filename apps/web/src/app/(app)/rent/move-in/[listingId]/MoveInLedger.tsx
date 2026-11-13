import { isModestExample } from "@/lib/listings/example-imagery";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { formatMoney, formatNumber, plural, type Dictionary, type Locale } from "@vallo/i18n/core";
import type { Listing } from "@/lib/listings/types";
import type { RentPeriod } from "@/lib/listings/pricing";
import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";
import { BrandIcon } from "@/design-system/icons/BrandIcon";
import { MediaFrame } from "@/components/app/MediaFrame";
import { Amount } from "@/components/ui/Amount";
import { ICON } from "@/components/app/Screen";
import { DocFigure, DocHead, DocNote, DocumentSheet } from "@/components/app/money/DocumentSheet";
import "@/app/css/catalogue.css";

export type LedgerLine = {
  key: string;
  icon: UiIconName;
  label: string;
  hint: string;
  minor: number;
};

export type AreaComparison = {
  averageMinor: number;
  deltaPercent: number;
  count: number;
  period: RentPeriod;
  area: string;
};

/**
 * The ledger itself, presentational, so the preview harness can render it
 * with fixture props and the route can render it with the real read.
 */
export function MoveInLedger({
  listing,
  lines,
  totalMinor,
  stated,
  comparison,
  locale,
  t,
  proceed,
}: {
  listing: Listing;
  lines: LedgerLine[];
  totalMinor: number;
  stated: boolean;
  comparison: AreaComparison | null;
  locale: Locale;
  t: Dictionary;
  proceed: ReactNode;
}) {
  const copy = t.catalogue.ledger;
  const photo = listing.photos[0];
  const where =
    listing.area && listing.area !== listing.city
      ? `${listing.area}, ${listing.city}`
      : listing.area || listing.city;

  return (
    <div className="flex flex-col gap-md" data-testid="move-in-ledger">
      {/* ------------------------------------------------ the listing */}
      <Link href={`/listing/${listing.id}`} className="nf-ledger-card flex gap-sm">
        <span className="relative block h-24 w-28 shrink-0 overflow-hidden rounded-md">
          <MediaFrame hue={listing.hue} kind={listing.kind} drawn={isModestExample(listing)} sizes="112px" />
          {photo && <Image src={photo} alt="" fill sizes="112px" className="object-cover" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-start justify-between gap-xs">
            <span className="nf-body font-semibold leading-snug text-[var(--nf-content-primary)] [overflow-wrap:anywhere]">
              {listing.title}
            </span>
            <span className="nf-badge nf-badge--info nf-detail-tag shrink-0">{t.catalogue.card.forRent}</span>
          </span>
          <span className="nf-caption mt-2xs flex items-center gap-inline-tight text-[var(--nf-content-secondary)]">
            <UiIcon name="location" size={12} className="text-[var(--nf-brand-secondary)]" />
            {where}
          </span>
          <span className="nf-caption mt-xs flex flex-wrap gap-x-sm gap-y-2xs text-[var(--nf-content-muted)]">
            {listing.bedrooms > 0 && (
              <span className="inline-flex items-center gap-2xs">
                <UiIcon name="bed" size={12} />
                {plural(listing.bedrooms, t.units.beds, locale)}
              </span>
            )}
            {listing.bathrooms > 0 && (
              <span className="inline-flex items-center gap-2xs">
                <UiIcon name="bath" size={12} />
                {plural(listing.bathrooms, t.units.baths, locale)}
              </span>
            )}
            {listing.sizeSqm !== undefined && listing.sizeSqm > 0 && (
              <span className="inline-flex items-center gap-2xs">
                <UiIcon name="grid" size={12} />
                {formatNumber(listing.sizeSqm, locale)} {t.catalogue.card.sqm}
              </span>
            )}
          </span>
        </span>
      </Link>

      {/* ------------------------------------------------ the breakdown

          THE LEDGER IS A DOCUMENT (reference 7073, north star 10 D, D28.1).
          Before it was a card like every other card, with the total at the
          foot, counting up. It is now the paper sheet the receipt and the
          agreement use: the total leads as the hero figure, because the whole
          cost before the action that incurs it is the point of the page;
          every named cost is its own row with its line glyph and the
          arithmetic beneath it; and the total closes the column under its
          rule, so the column visibly adds up. The figure does not count up:
          it is a stated obligation, not a number arriving. Tax lines appear
          only when Session 2's tax layer supplies them (D4, R-22). */}
      <DocumentSheet kind="document" printable as="section" aria-labelledby="ledger-breakdown" data-testid="ledger-sheet">
        <DocHead label={copy.breakdown} title={listing.title} id="ledger-breakdown" />
        <div className="nf-doc__hero">
          <p className="nf-doc__label">{stated ? copy.total : copy.namedSoFar}</p>
          <DocFigure testId="ledger-figure">
            <Amount
              minorUnits={totalMinor}
              locale={locale}
              currency={listing.currency}
              secondaryClassName="nf-doc__kobo"
            />
          </DocFigure>
        </div>
        <dl className="nf-doc__rows nf-doc__rows--ledger">
          {lines.map((line) => (
            <div
              key={line.key}
              className={`nf-doc__row nf-doc__row--glyph${line.key === "remainder" ? " nf-doc__row--attention" : ""}`}
              data-testid={`ledger-line-${line.key}`}
            >
              <dt>
                <span className="nf-doc__glyph" aria-hidden="true">
                  <UiIcon name={line.icon} size={ICON.row} />
                </span>
                <span className="nf-doc__line">
                  <span className="nf-doc__line-label">{line.label}</span>
                  <span className="nf-doc__line-hint">{line.hint}</span>
                </span>
              </dt>
              <dd className="nf-numeric">
                <Amount minorUnits={line.minor} locale={locale} currency={listing.currency} />
              </dd>
            </div>
          ))}
          <div className="nf-doc__row nf-doc__row--total" data-testid="ledger-total">
            <dt>{stated ? copy.total : copy.namedSoFar}</dt>
            <dd className="nf-numeric">
              <Amount minorUnits={totalMinor} locale={locale} currency={listing.currency} />
            </dd>
          </div>
        </dl>
        <DocNote>{stated ? copy.statedNote : copy.summedNote}</DocNote>
      </DocumentSheet>

      {/* ------------------------------------------- the comparison
          Only from real listings in the same area; never invented. */}
      {comparison && (
        <section className="nf-ledger-card" aria-labelledby="ledger-compare" data-testid="ledger-compare">
          <div className="nf-ledger-compare">
            <div className="flex items-center gap-sm">
              <span className="nf-ledger-row__glyph" aria-hidden="true">
                <UiIcon name="location" size={ICON.row} />
              </span>
              <span className="min-w-0">
                <span id="ledger-compare" className="nf-body block font-semibold text-[var(--nf-content-primary)]">
                  {copy.areaComparison}
                </span>
                <span className="nf-caption block text-[var(--nf-content-muted)]">{comparison.area}</span>
              </span>
            </div>
            <div className="text-right">
              <span className="nf-caption block text-[var(--nf-content-muted)]">{copy.averageInArea}</span>
              <span className="nf-numeric nf-body font-bold text-[var(--nf-brand-secondary)]">
                {formatMoney(comparison.averageMinor, locale, listing.currency)}
                <span className="nf-caption font-normal text-[var(--nf-content-muted)]">
                  {" "}
                  {t.experienceLabels.periodSlash[comparison.period]}
                </span>
              </span>
            </div>
          </div>
          <p className="nf-ledger-compare__verdict">
            <UiIcon
              name={comparison.deltaPercent <= 0 ? "arrow-down" : "arrow-up"}
              size={16}
              className="shrink-0 text-[var(--nf-brand-secondary)]"
            />
            <span>
              {comparison.deltaPercent < 0
                ? copy.lowerThanAverage.replace("{percent}", String(Math.abs(comparison.deltaPercent)))
                : comparison.deltaPercent > 0
                  ? copy.higherThanAverage.replace("{percent}", String(comparison.deltaPercent))
                  : copy.aboutAverage}
              {" · "}
              {copy.comparedWith
                .replace("{count}", formatNumber(comparison.count, locale))
                .replace("{area}", comparison.area)}
            </span>
          </p>
        </section>
      )}

      {/* --------------------------------------------------- proceed */}
      <section className="nf-ledger-card" data-testid="ledger-proceed">
        {proceed}
        <p className="nf-ledger-note">
          <span className="inline-flex items-center gap-2xs">
            <span className="block h-4 w-4" aria-hidden="true">
              <BrandIcon name="shield-check" fill />
            </span>
            {copy.payAfter}
          </span>
          {listing.verified && !listing.isDemo && (
            <span className="inline-flex items-center gap-2xs">
              <UiIcon name="verified" size={12} />
              {copy.verified}
            </span>
          )}
          <span className="inline-flex items-center gap-2xs">
            <UiIcon name="chat-bubble" size={12} />
            {copy.insideVallo}
          </span>
        </p>
      </section>
    </div>
  );
}
