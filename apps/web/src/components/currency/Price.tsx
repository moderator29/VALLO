"use client";

import type { Locale } from "@vallo/i18n/core";
import type { SpokenPeriod } from "@/lib/money/spoken";
import { guideFor, type DisplayMoney } from "@/lib/currency/display";
import { Money } from "@/components/ui/Money";
import { useDisplayMoney, type GuideCopy } from "./DisplayMoneyProvider";

/**
 * A NAIRA PRICE ON A BROWSING SURFACE, WITH THE READER'S GUIDE BESIDE IT.
 *
 * The naira figure is drawn exactly as `<Money>` draws it, always, first and
 * in full: it is the price of record. When the reader chose another currency
 * and a fresh rate is stored, a small muted "about £2,516" follows it, and a
 * screen reader hears "approximately 2,516 British pounds, as a guide. You
 * pay in naira." Without a fresh rate, or with naira chosen, nothing follows.
 *
 * `<PriceGuide>` is the guide alone, for a surface that already draws its
 * naira figure with `<Amount>` and only needs the guide placed after it.
 *
 * FOR BROWSING SURFACES ONLY: cards, the listing and stay headline, search,
 * map pins, saved shelves. NEVER on a money surface (checkout, payment,
 * wallet, receipts, refunds, payouts, offers, agreements, the move-in
 * ledger, anything a person signs or pays): those keep `<Money>`, `<Amount>`
 * or `formatMoney` and show naira only. See `lib/currency/currencies.ts`,
 * and `lib/currency/money-surfaces.test.ts`, which holds the line.
 *
 * The page that shows a guide must also show `<RatesAttribution>` once; the
 * rate source's terms require it.
 */

type GuideProps = {
  /** The amount in minor units of `currency`: kobo, as everywhere. */
  minor: number;
  /** The amount's own currency. A guide is only ever worked from naira; anything else draws nothing. */
  currency?: string;
  /** Short figures ("£12.5k") from ten thousand units, for a card or a pin. */
  compact?: boolean;
  /** On its own line under the price, or after it. */
  below?: boolean;
  className?: string;
  /** Overrides the provider, for a surface that resolves its own. */
  display?: DisplayMoney | null;
  copy?: GuideCopy | null;
};

export function PriceGuide({ minor, currency = "NGN", compact = false, below = false, className, display, copy }: GuideProps) {
  const context = useDisplayMoney();
  const resolved = display === undefined ? (context?.display ?? null) : display;
  const words = copy ?? context?.copy ?? null;
  const figure = words && currency === "NGN" ? guideFor(resolved, minor, { compact }) : null;
  if (!figure || !words) return null;
  return (
    <>
      {below ? null : " "}
      <span
        className={[below ? "block" : "", "nf-caption font-normal text-[var(--nf-content-muted)]", className ?? ""]
          .filter(Boolean)
          .join(" ")}
        data-guide={figure.currency}
      >
        <span aria-hidden="true">{(figure.kind === "under" ? words.under : words.about).replace("{amount}", figure.text)}</span>
        <span className="sr-only">{words.aboutSpoken.replace("{amount}", figure.spoken)}</span>
      </span>
    </>
  );
}

export function Price({
  minor,
  locale,
  currency = "NGN",
  mode = "full",
  period = null,
  suffix,
  guide = "inline",
  className,
  guideClassName,
  display,
  copy,
}: {
  /** The naira amount in kobo, as everywhere. */
  minor: number;
  locale: Locale;
  /** The listing's currency, "NGN" in practice. No guide is drawn for any other. */
  currency?: string;
  /** As `<Money>`: the naira figure's form. The guide is short in "compact" and "glance". */
  mode?: "compact" | "glance" | "full";
  period?: SpokenPeriod | null;
  suffix?: string;
  /** Where the guide sits: after the price, on its own line under it, or not at all. */
  guide?: "inline" | "below" | "none";
  className?: string;
  guideClassName?: string;
  display?: DisplayMoney | null;
  copy?: GuideCopy | null;
}) {
  return (
    <span className={className} data-price="">
      <Money minor={minor} locale={locale} currency={currency} mode={mode} period={period} suffix={suffix} />
      {guide === "none" ? null : (
        <PriceGuide
          minor={minor}
          currency={currency}
          compact={mode !== "full"}
          below={guide === "below"}
          className={guideClassName}
          display={display}
          copy={copy}
        />
      )}
    </span>
  );
}
