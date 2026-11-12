/**
 * THE LIGHT HALF OF @vallo/i18n (Track M performance, 25 September 2026).
 *
 * Everything here works without a dictionary: the locale list and its
 * negotiation, the Intl tags, and the money, number, date, rating and plural
 * formatters. `index.ts` re-exports all of it and adds the four dictionaries.
 *
 * WHY IT IS A SEPARATE ENTRY. The package had one entry, and that entry
 * imports English, Yoruba, Hausa and Igbo at the top. A client component that
 * imported nothing but `formatMoney` therefore shipped every word of every
 * language to the browser: a 717 KB chunk (222 KB gzipped) that the landing
 * page, Home, Search and nearly every other route downloaded and ran before
 * they were interactive. Client code imports from `@vallo/i18n/core`; only
 * code that really needs a dictionary imports `@vallo/i18n`.
 *
 * Nothing in this file may import a locale's dictionary; the counted-noun
 * tables in `locales/units.ts` are the one exception, because `countOf`
 * needs them and they are a few kilobytes. `core-entry.test.ts` fails if a
 * dictionary comes in.
 */
import { matchAcceptLanguage } from "./negotiate";
import type { CountForms, PluralForms } from "./plural";
import {
  unitsEn,
  unitsHa,
  unitsIg,
  unitsYo,
  type UnitNoun,
} from "./locales/units";

export type { Dictionary } from "./locales/en";
export type { UnitNoun };
export type { CountForms, PluralForms };
export {
  parseAcceptLanguage,
  matchAcceptLanguage,
  type LanguageRange,
} from "./negotiate";

export const LOCALES = ["en", "yo", "ha", "ig"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (LOCALES as readonly string[]).includes(value);
}

/**
 * The locale a browser is asking for, or null if it is asking for none we ship.
 *
 * This is the whole of Vallo's knowledge of `Accept-Language`. The parsing
 * lives in `negotiate.ts` and knows nothing about this platform; this line is
 * the only place the supported list meets it, so there is exactly one answer to
 * "which languages do we negotiate over" and it is `LOCALES`.
 *
 * Returning null rather than the default is deliberate. The caller has to
 * decide what silence means, and on the server that decision is ordered:
 * an explicitly stored choice, then this, then English. Folding the default in
 * here would make the second and third steps indistinguishable to the caller.
 */
export function localeFromAcceptLanguage(
  header: string | null | undefined
): Locale | null {
  return matchAcceptLanguage(header, LOCALES);
}

/** Display metadata for the language switcher. */
export const localeMeta: Record<
  Locale,
  { label: string; native: string; short: string }
> = {
  en: { label: "English", native: "English", short: "EN" },
  yo: { label: "Yoruba", native: "Yorùbá", short: "YO" },
  ha: { label: "Hausa", native: "Hausa", short: "HA" },
  ig: { label: "Igbo", native: "Igbo", short: "IG" },
};

/**
 * THE TAG EVERY FORMATTER ASKS OF, AND WHY IT IS en-NG FOR EVERY LOCALE.
 *
 * Chromium carries no locale data for Yoruba, Hausa or Igbo. Asked for yo-NG
 * it quietly formats in the phone's own language instead: "Sep 25, 2026" on a
 * phone set to American English, "4 500 000 ₦" on one set to French,
 * "4.500.000 ₦" in German, Arabic-Indic digits in Arabic. Node, which renders
 * the server's HTML, carries all of CLDR and writes "25 Oṣù Owewe 2026" and
 * "₦4,500,000". So on a Yoruba, Hausa or Igbo page the server and the browser
 * wrote every price, date and short figure differently, and each one was a
 * hydration mismatch: React threw the server's HTML away and drew the page
 * again, and the reader watched the page change under them.
 *
 * en-NG is carried by every engine and writes the same thing in all of them,
 * so every locale formats with it: "₦4,500,000", "₦45k", "₦1.2b", "25 Sept
 * 2026". For numbers and money that is exactly what Node wrote for yo-NG,
 * ha-NG and ig-NG anyway. What changes is the words: month and weekday names,
 * and the letter after a short figure (Hausa wrote thousands "D" for dubu,
 * Yoruba and Igbo wrote a billion "G"), which Chrome never showed. Month names
 * in the reader's language can come back as words the locale files carry,
 * once a native speaker supplies them, rather than as whatever one engine
 * happens to ship. `portable-intl.test.ts` holds the line.
 *
 * Exported because the `<Amount>` primitive builds money from `formatToParts`
 * and must ask the same tag this file does; a second private copy would
 * drift, which is how the naira sign once ended up hard-coded in five places.
 */
export const intlTag: Record<Locale, string> = {
  en: "en-NG",
  yo: "en-NG",
  ha: "en-NG",
  ig: "en-NG",
};

/**
 * Plural rules are the one piece of Yoruba, Hausa and Igbo every engine
 * carries, and they agree: Hausa has one and other, Yoruba and Igbo only
 * other. So counted phrases keep the reader's own rules.
 */
export const pluralTag: Record<Locale, string> = {
  en: "en-NG",
  yo: "yo-NG",
  ha: "ha-NG",
  ig: "ig-NG",
};

/**
 * Dates are written on Lagos time unless a caller says otherwise. The server
 * runs on UTC and a phone runs on its own zone, so a date formatted in
 * "whatever zone this is" is written one way by the server and another by the
 * browser for the hour either side of midnight, every night, and a time of
 * day is written differently all day.
 */
export const LAGOS_TIME_ZONE = "Africa/Lagos";

/**
 * THE NAIRA SIGN, THE SAME ON THE SERVER AND IN EVERY BROWSER.
 *
 * Money is asked of `intlTag` (en-NG for every locale; it says why) with
 * `narrowSymbol`, which asks for the sign itself, and a space beside the sign
 * is dropped, as Nigerian writing does ("₦4,500,000"). The space rule dates
 * from when Hausa money was asked of ha-NG, which Node spaced ("₦ 4,500,000")
 * and Chrome did not; it stays so that no tag can bring the space back.
 * `formatMoney` and the `<Amount>` primitive both build money from these
 * parts, so they cannot disagree.
 */
export function moneyParts(
  major: number,
  locale: Locale,
  currency: string,
  options: Intl.NumberFormatOptions
): Intl.NumberFormatPart[] {
  const parts = new Intl.NumberFormat(intlTag[locale], {
    ...options,
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
  }).formatToParts(major);
  return parts.filter(
    (part, index) =>
      !(
        part.type === "literal" &&
        /^\s+$/.test(part.value) &&
        (parts[index - 1]?.type === "currency" ||
          parts[index + 1]?.type === "currency")
      )
  );
}

const joinParts = (parts: Intl.NumberFormatPart[]): string =>
  parts.map((part) => part.value).join("");

/**
 * Money.
 *
 * Amounts are ALWAYS integer minor units (kobo). Never pass a float, and never
 * store one. 100 kobo is 1 naira. This is the only place that divides.
 */
/** Below ₦1,000 (in kobo) compact money is written in full (UI-13). */
export const COMPACT_FROM_MINOR = 100_000;

export function formatMoney(
  minorUnits: number,
  locale: Locale = DEFAULT_LOCALE,
  currency = "NGN",
  options: { compact?: boolean } = {}
): string {
  const major = minorUnits / 100;

  /* UI-13: under ₦1,000 there is nothing to abbreviate, and compact
     notation would round kobo away (1 kobo read "₦0", 99 kobo "₦1"), so the
     full figure is written instead. */
  if (options.compact && Math.abs(minorUnits) >= COMPACT_FROM_MINOR) {
    /*
     * COMPACT USED TO BE WRONG, AND WRONG ABOUT MONEY.
     *
     * `maximumFractionDigits: 0` was applied to every call, including compact
     * ones, and it overrides the fraction digit that compact notation exists
     * to show. ₦1,200,000 rendered as "₦1M", ₦12,500,000 as "₦13M". Those are
     * not abbreviations, they are different numbers, and they were on the
     * agent's earnings tile and on every price pin on the map.
     *
     * Left to itself the formatter gives ₦999, ₦45K, ₦1.2M, ₦1.2B, which is
     * exactly the scale asked for. The suffix is then lowered because that is
     * how naira is written in Nigeria: ₦45k, ₦1.2m, never ₦45K.
     *
     * Hausa abbreviates thousands as "D" for dubu, but only in engines that
     * carry Hausa, so the server wrote "₦45d" and Chrome "₦45k" (see
     * `intlTag`). Every locale now writes the short figure the en-NG way.
     */
    /*
     * ONE FRACTION DIGIT, ALWAYS, because compact notation left alone keeps
     * two SIGNIFICANT digits and that silently changes the number.
     *
     * ₦6,800,000 came out ₦6.8m, which is the figure. ₦14,700,000 came out
     * ₦15m, which is not: it is ₦300,000 more than the person owes, and it
     * was painting on the move-in bar of the listing page directly under a
     * card reading ₦14,700,000, so the same screen stated two different
     * obligations. A reader cannot tell a short way of writing a number from
     * a different number, so the abbreviation has to hold its value.
     *
     * `maximumFractionDigits: 1` keeps the tenth on any figure that has one
     * and drops nothing that matters: ₦45k stays ₦45k, ₦1.2m stays ₦1.2m,
     * ₦14.7m stops being ₦15m. A figure whose tenth is zero still prints
     * whole, because the minimum is left at zero.
     */
    const compact = joinParts(
      moneyParts(major, locale, currency, {
        notation: "compact",
        /* The minimum is stated because `style: "currency"` defaults it to the
         currency's own two digits, and naming a maximum of 1 then clamps the
         minimum up to 1 as well: ₦45k came out ₦45.0k and ₦180m came out
         ₦180.0m. A whole figure prints whole. */
        minimumFractionDigits: 0,
        maximumFractionDigits: 1,
        /* UI-13: truncate, never round up across a boundary: ₦999,999.99 is
         "₦999.9k", not "₦1m". An abbreviation may hide the tail of a figure;
         it may not state a bigger one. */
        roundingMode: "trunc",
      } as Intl.NumberFormatOptions)
    );
    return compact.replace(/[A-Za-z]+$/, (suffix) => suffix.toLowerCase());
  }

  /*
   * Kobo shows when there is kobo, and never otherwise.
   *
   * A flat `maximumFractionDigits: 0` rounded ₦42,000.75 to ₦42,001, so the
   * wallet had to grow its own splitter to avoid misstating a balance by a
   * kobo. Nothing else on the platform used that splitter, which meant any
   * other surface handed a part-naira amount would quietly round it. Rounding
   * money is not a display choice.
   */
  const hasKobo = Math.abs(Math.round(minorUnits)) % 100 !== 0;
  return joinParts(
    moneyParts(major, locale, currency, {
      minimumFractionDigits: hasKobo ? 2 : 0,
      maximumFractionDigits: hasKobo ? 2 : 0,
    })
  );
}

/**
 * Money at a glance: compact once, and only once, the figure needs it.
 *
 * `{ compact: true }` is unconditional and belongs where the SPACE is fixed and
 * tiny: a map pin, a stat tile. A card in a scrolling list is different. A stay
 * at ₦95,000 a night must read ₦95,000, because that is the number somebody is
 * comparing against the card below it, but a rental at ₦4,500,000 a year is
 * written ₦4.5m by every Nigerian who has ever advertised one, and it was
 * arriving as seven digits and a slash and a word on a 390px card.
 *
 * One threshold, one million naira, applied in one place: a search page that
 * mixes nightly stays and yearly rents then gets both right with no per-card
 * decision anywhere.
 */
export const GLANCE_COMPACT_FROM_MINOR = 100_000_000;

/** The glance rule as a predicate, so a component can apply it itself. */
export function isGlanceCompact(minorUnits: number): boolean {
  return Math.abs(minorUnits) >= GLANCE_COMPACT_FROM_MINOR;
}

export function formatMoneyGlance(
  minorUnits: number,
  locale: Locale = DEFAULT_LOCALE,
  currency = "NGN"
): string {
  return formatMoney(minorUnits, locale, currency, {
    compact: Math.abs(minorUnits) >= GLANCE_COMPACT_FROM_MINOR,
  });
}

export function formatNumber(
  value: number,
  locale: Locale = DEFAULT_LOCALE,
  options: Intl.NumberFormatOptions = {}
): string {
  return new Intl.NumberFormat(intlTag[locale], options).format(value);
}

/**
 * One `Intl.PluralRules` per locale, built once.
 *
 * Constructing a formatter is the expensive part of `Intl`, and a booking board
 * renders a night count and a guest count on every card in a list. Four
 * instances for the life of the process is the whole cost.
 */
const pluralRules = new Map<Locale, Intl.PluralRules>();

export function rulesFor(locale: Locale): Intl.PluralRules {
  const cached = pluralRules.get(locale);
  if (cached) return cached;
  const built = new Intl.PluralRules(pluralTag[locale]);
  pluralRules.set(locale, built);
  return built;
}

/**
 * A counted phrase, in the form the locale actually uses.
 *
 * THIS EXISTS BECAUSE THE PLATFORM WAS RENDERING "1 adults, 1 children".
 * Every counted noun on the booking surfaces was either a hand-written
 * `n === 1 ? "night" : "nights"` ternary, which hardcodes English inflection
 * inside a product that ships in four languages, or a pair of `nights` and
 * `nightsOne` keys, which hardcodes the assumption that every language has
 * exactly two forms. Some of the pairs were then only half wired, which is how
 * an admin reading a stay for one adult was told there were "1 adults".
 *
 * The categories come from CLDR through `Intl`, resolved with `pluralTag`
 * (the reader's own language, which every engine carries for plural rules),
 * so this is driven by the locale rather than by an assumption about it.
 * English and Hausa select `one` or `other`; Yoruba and Igbo have a single
 * category and fall on `other` for every count, including one, which is
 * correct for both languages rather than a shortcut.
 *
 * `other` is the fallback for a category the dictionary has not filled in, so a
 * half-translated entry degrades to a readable phrase instead of an empty span.
 */
export function plural(
  count: number,
  forms: PluralForms,
  locale: Locale = DEFAULT_LOCALE
): string {
  const category = rulesFor(locale).select(count);
  const template = forms[category] ?? forms.other;
  return template.replace(/\{count\}/g, formatNumber(count, locale));
}

/** Each locale's own counted-noun table; English is the whole of it. */
const ownUnits: Record<
  Locale,
  Partial<Record<UnitNoun, Partial<PluralForms>>>
> = {
  en: unitsEn,
  yo: unitsYo,
  ha: unitsHa,
  ig: unitsIg,
};

/**
 * A counted phrase from the `units` tables: `countOf(3, "bedrooms", "en")` is
 * "3 bedrooms". The one door every component uses instead of writing
 * `n === 1 ? "x" : "xs"` itself.
 */
export function countOf(
  count: number,
  noun: UnitNoun,
  locale: Locale = DEFAULT_LOCALE
): string {
  const own = ownUnits[locale]?.[noun];
  /*
   * A unit the locale has not translated is English text, so it takes
   * English's categories: a Yoruba page still reads "1 bed" rather than the
   * "1 beds" Yoruba's single category would pick from English forms. The
   * number itself is always formatted for the page's locale.
   */
  const translated = locale === "en" || own?.other !== undefined;
  const forms: PluralForms = {
    ...unitsEn[noun],
    ...(translated ? own : undefined),
  };
  const template =
    forms[rulesFor(translated ? locale : "en").select(count)] ?? forms.other;
  return template.replace(/\{count\}/g, formatNumber(count, locale));
}

/**
 * The people on a stay, as one phrase.
 *
 * Adults are always stated. Children are stated only when there are any,
 * because "2 adults, 0 children" is noise on a card whose whole job is to be
 * read at a glance, and the absence of children is not information a host or an
 * operator is looking for.
 */
export function formatParty(
  adults: number,
  children: number,
  forms: CountForms,
  locale: Locale = DEFAULT_LOCALE
): string {
  const adultsPhrase = plural(adults, forms.adults, locale);
  if (children <= 0) return adultsPhrase;
  return forms.party
    .replace("{adults}", adultsPhrase)
    .replace("{children}", plural(children, forms.children, locale));
}

/**
 * A star rating, per locale.
 *
 * One decimal place, always, so 5 reads as "5.0" beside 4.8 rather than
 * jumping a character width. `toFixed(1)` was being called directly in six
 * places, which hardcodes a full stop as the decimal separator and an ASCII
 * digit set; this goes through `Intl` like every other number on the platform.
 */
export function formatRating(
  value: number,
  locale: Locale = DEFAULT_LOCALE
): string {
  return formatNumber(value, locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

/**
 * EVERY SHORT MONTH IS THREE LETTERS, SEPTEMBER INCLUDED.
 *
 * en-NG, the tag every locale here formats with, abbreviates September to
 * "Sept" and every other month to three letters. Two helpers inside the web
 * app already undid that by hand, each with its own copy of the rule
 * (`lib/format/when.ts`, `lib/money/dates.ts`), and the dozens of surfaces
 * that format a short month any other way kept "Sept". Measured in Chromium
 * in November 2026: an offer's timeline read "14 Sept 2026", a host's
 * earnings statement read "4 Sept" and "12 Sept", and the agent earnings
 * chart ticked "Sept", while a booking row, a message day divider and a
 * money history row on the same account read "Sep". One month, two
 * spellings, decided by which screen you happened to be on.
 *
 * The rule lives here now, where the tag is chosen, so it reaches everything
 * that formats through this module and the two hand copies have one
 * authority to point at. "September" is untouched: the word boundary after
 * "Sept" cannot match inside it.
 */
export function threeLetterMonth(text: string): string {
  return text.replace(/\bSept\b/g, "Sep");
}

/**
 * A date in words, the same from the server and from every phone: asked of
 * `intlTag`, and on Lagos time unless the options name another zone.
 */
export function formatDate(
  date: Date,
  locale: Locale = DEFAULT_LOCALE,
  options: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
    year: "numeric",
  }
): string {
  return threeLetterMonth(
    new Intl.DateTimeFormat(intlTag[locale], {
      timeZone: LAGOS_TIME_ZONE,
      ...options,
    }).format(date),
  );
}
