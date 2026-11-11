import { spokenMoney, spokenSuffix } from "@/lib/money/spoken";
import { COMPACT_FROM_MINOR, intlTag, isGlanceCompact, moneyParts, type Locale } from "@vallo/i18n/core";
import { CountUp, CountUpMoney } from "@/components/motion/CountUp";

/**
 * Money, set the way the reference set sets money.
 *
 * Across the fifteen supplied references the hero figure is always two-tone:
 * the number itself lands at full weight and near-full contrast, and the part
 * that is not the number - the ".00", the "of 300", the "/8hrs", the "/night" -
 * drops to a muted colour at a smaller size. It is a small detail and it is one
 * of the strongest single tells separating a premium product from a competent
 * one.
 *
 * The platform had this exactly once, on the wallet balance. Every other price
 * on the platform - including the listing detail page, which is the screen that
 * sells the product - rendered as flat single-tone text.
 *
 * Two other things this fixes on the way past:
 *
 * 1. Tabular figures. Digits are proportional by default in Inter, so a column
 *    of prices visibly jitters as values change. Every Amount is tabular.
 *
 * 2. Locale-consistent assembly. `formatMoney` returns one opaque string, and
 *    the naira sign was additionally hard-coded in five places. Those disagreed:
 *    ha-NG emits "₦ 9,000,000" with a space, so the wallet hero and the ledger
 *    row directly beneath it rendered the same currency differently. Building
 *    from `formatToParts` means the symbol, the grouping and the spacing all
 *    come from the locale, once, here.
 */

export type AmountProps = {
  /** Minor units. Kobo for NGN, exactly as the database stores it. */
  minorUnits: number;
  locale?: Locale;
  currency?: string;
  /**
   * Renders the fractional part (kobo) in the muted tone. Off by default,
   * because most prices on the platform are whole naira and a permanent ".00"
   * is noise. On for ledgers and receipts, where exactness is the point.
   */
  showFraction?: boolean;
  /**
   * The trailing qualifier: "/night", "of 300", "total". Rendered in the muted
   * tone at the smaller size, which is what makes the pairing read as one
   * composed figure rather than two pieces of text.
   */
  suffix?: string;
  /** Short form for dense rows and chart labels: ₦9m rather than ₦9,000,000. */
  compact?: boolean;
  /**
   * The glance rule, applied here rather than at the call site.
   *
   * `compact` is unconditional and belongs where the SPACE is fixed and tiny: a
   * map pin, a stat tile. A card in a scrolling list is different. A stay at
   * ₦95,000 a night must read ₦95,000, because that is the number somebody is
   * comparing against the card below it, but a rental at ₦4,500,000 a year is
   * written ₦4.5m by every Nigerian who has ever advertised one.
   *
   * One threshold, owned by `@vallo/i18n`, so a search page mixing nightly
   * stays and yearly rents gets both right with no per-card decision anywhere.
   */
  glance?: boolean;
  /** Tailwind classes for the PRIMARY figure. Size and weight live here. */
  className?: string;
  /** Overrides the muted part's classes when the default relative size is wrong. */
  secondaryClassName?: string;
  /**
   * THE HERO FIGURE COUNTS UP (the founder's count-up ruling, 30 September
   * 2026): 0 to the amount once, on first view, ~600ms, off under reduced
   * motion, Calm and Off (`CountUpMoney`). Only where the figure is the hero
   * of its card; the server still prints the final figure.
   */
  count?: boolean;
};

export function Amount(props: AmountProps) {
  if (!props.count) return <AmountStatic {...props} />;
  const { minorUnits, locale = "en", currency = "NGN", compact = false, glance = false, className } = props;
  return (
    <CountUpMoney
      minorUnits={minorUnits}
      locale={locale}
      currency={currency}
      glance={compact || glance}
      eager
      frameClassName={className}
    >
      <AmountStatic {...props} />
    </CountUpMoney>
  );
}

function AmountStatic({
  minorUnits,
  locale = "en",
  currency = "NGN",
  showFraction,
  suffix,
  compact = false,
  glance = false,
  className,
  secondaryClassName,
}: AmountProps) {
  const major = minorUnits / 100;
  /* UI-13: compact never applies under ₦1,000, where it would round kobo. */
  const short = (compact || (glance && isGlanceCompact(minorUnits))) && Math.abs(minorUnits) >= COMPACT_FROM_MINOR;
  /* UI-13: kobo shows when there is kobo, as `formatMoney` does, unless the
     caller says otherwise. It used to round ₦42,000.75 to ₦42,001 by default. */
  const withKobo = showFraction ?? Math.abs(Math.round(minorUnits)) % 100 !== 0;

  /* Built from the same normalised parts as `formatMoney` (`moneyParts` in
     packages/i18n): the narrow naira sign on every engine, no space beside
     it, so the server's HTML and the browser's hydration always agree. */
  const parts = moneyParts(major, locale, currency, {
    /*
     * Compact notation carries its precision in the fraction: ₦1,500 compacts
     * to "₦1.5K". Forcing maximumFractionDigits to 0 rounds that to "₦2K",
     * which is a DIFFERENT NUMBER rather than a shortened one.
     *
     * THIS USED TO SAY THAT INTL DEFAULTS TO ONE FRACTIONAL DIGIT, AND IT DOES
     * NOT. Compact notation defaults to two SIGNIFICANT digits, so the tenth
     * survives only while the integer part is a single digit: ₦6,800,000 gave
     * ₦6.8m and ₦14,700,000 gave ₦15m. The comment was right about the
     * principle and wrong about the default, so the guard it described was
     * never actually in place, and every glance figure over ten million with a
     * non-zero tenth was a different number from the one it stood for. F3
     * found it on the listing page's move-in bar, printing ₦15m directly under
     * a card reading ₦14,700,000.
     *
     * One fraction digit, stated. The minimum is stated too, because
     * `style: "currency"` defaults it to the currency's own two digits and
     * naming only a maximum clamps the minimum up with it, which turned ₦45k
     * into ₦45.0k. `formatMoney` in packages/i18n carries the identical pair
     * for the identical reason; the two formatters must not disagree about
     * what a shortened figure means.
     */
    ...(short
      ? {
          notation: "compact" as const,
          minimumFractionDigits: 0,
          maximumFractionDigits: 1,
          roundingMode: "trunc" as const,
        }
      : {
          minimumFractionDigits: withKobo ? 2 : 0,
          maximumFractionDigits: withKobo ? 2 : 0,
        }),
  });

  /*
   * The split point is the decimal separator: everything before it - symbol,
   * any locale spacing, sign, integer digits and group separators - is the
   * primary figure, and the separator plus the fraction are secondary.
   *
   * The magnitude suffix is the exception. In compact notation Intl emits it
   * AFTER the fraction, so a naive slice put the "M" of "₦9.00M" into the muted
   * tail and ₦9,000,000 read as ₦9. Anything following the fraction digits
   * belongs to the figure, not to the tail.
   */
  const splitAt = parts.findIndex((p) => p.type === "decimal");
  const lastFraction = parts.map((p) => p.type).lastIndexOf("fraction");

  const join = (from: number, to?: number) =>
    parts
      .slice(from, to)
      .map((p) => p.value)
      .join("");

  // head · fraction · tail, rendered in that order so the magnitude suffix
  // stays where the locale put it rather than being moved behind the kobo.
  const lower = (v: string) => (short ? v.replace(/[A-Za-z]+$/, (m) => m.toLowerCase()) : v);
  // With no fraction Intl puts the magnitude suffix at the end of the head
  // ("₦9M"), and with one it puts it after the fraction ("₦4.5M"), so both
  // ends get the same treatment.
  const head = lower(splitAt === -1 ? join(0) : join(0, splitAt));
  const fraction = splitAt === -1 ? "" : join(splitAt, lastFraction + 1);
  /* Intl emits an upper-case magnitude suffix ("₦4.5M"); the platform writes it
     lower ("₦4.5m"), which is how it is written on every Nigerian listing and
     what `formatMoney` already does. Same rule, one place. */
  const tail = lower(splitAt === -1 || lastFraction === -1 ? "" : join(lastFraction + 1));

  /* The muted part is 0.62 of the figure, and never under 12px (north star
     section 5: nothing below 12 anywhere). On a 16px row figure 0.62em was
     9.9px kobo; on a hero figure the floor changes nothing. */
  const muted = secondaryClassName ?? "text-[length:max(0.75rem,0.62em)] font-semibold opacity-60";
  /*
   * THE WORD SUFFIX DOES NOT INHERIT THE FIGURE'S TRACKING.
   *
   * A hero figure is set tight: "in full" sat under `tracking-[-0.03em]` on
   * the checkout total, which is a 40 to 60px number. The suffix renders at
   * about a third of that size, where the same em value is a far harsher cut.
   * Measured in WebKit at 390: a 3.4px space against 1.2px of negative
   * tracking, so "N360,000.00 in full" read as one word, ".00in full". Kobo
   * keeps the figure's tracking, because it is part of the number; the word
   * does not, because it is a word.
   */
  const suffixClass = [muted, "tracking-normal"].join(" ");

  /*
   * B15: WHAT A SCREEN READER HEARS. A compact figure ("₦2.8m") is read
   * "naira two point eight m", and a short suffix ("/yr") "slash y r". Either
   * way the printed form is hidden from the ear and a visually hidden spoken
   * one ("2.8 million naira a year") stands beside it. A full figure with a
   * word suffix is left exactly as it was: engines read it correctly.
   */
  const slashSuffix = Boolean(suffix && suffix.trim().startsWith("/"));
  if (short || slashSuffix) {
    const spokenFigure = short ? spokenMoney(minorUnits, locale, currency) : `${head}${fraction}${tail}`;
    const spoken = [spokenFigure, spokenSuffix(suffix)].filter(Boolean).join(" ");
    return (
      <span className={["nf-numeric", className ?? ""].filter(Boolean).join(" ")}>
        <span aria-hidden="true">
          {head}
          {/* A compact figure's fraction is part of the number, not kobo:
              "₦2.4m" with a faint ".4" read as ₦2m on the map card. So in
              short form it keeps the figure's weight; only kobo is muted. */}
          {fraction ? short ? fraction : <span className={muted}>{fraction}</span> : null}
          {tail}
          {suffix ? <span className={suffixClass}> {suffix}</span> : null}
        </span>
        <span className="sr-only">{spoken}</span>
      </span>
    );
  }

  return (
    <span className={["nf-numeric", className ?? ""].filter(Boolean).join(" ")}>
      {head}
      {fraction ? <span className={muted}>{fraction}</span> : null}
      {tail}
      {suffix ? <span className={suffixClass}> {suffix}</span> : null}
    </span>
  );
}

/**
 * The non-money sibling: a bare figure with a muted unit or denominator.
 * Reference 2's "260 of 300", reference 6's "7h 52m", reference 13's "92 bpm".
 */
export function Figure({
  value,
  suffix,
  locale = "en",
  className,
  secondaryClassName,
  count = false,
}: {
  value: number | string;
  suffix?: string;
  locale?: Locale;
  className?: string;
  secondaryClassName?: string;
  /** A whole number that is the hero of its card counts up once (CountUp). */
  count?: boolean;
}) {
  const shown =
    typeof value === "number"
      ? count && Number.isSafeInteger(value) && value >= 0
        ? <CountUp value={value} tag={intlTag[locale]} eager />
        : value.toLocaleString(intlTag[locale])
      : value;
  const muted = secondaryClassName ?? "text-[length:max(0.75rem,0.62em)] font-semibold opacity-60";
  /* The word suffix keeps normal tracking, as on `Amount`: see the note there. */
  return (
    <span className={["nf-numeric", className ?? ""].filter(Boolean).join(" ")}>
      {shown}
      {suffix ? <span className={[muted, "tracking-normal"].join(" ")}> {suffix}</span> : null}
    </span>
  );
}
