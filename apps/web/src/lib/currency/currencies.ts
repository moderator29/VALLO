/**
 * THE CURRENCIES A READER MAY SEE A PRICE GUIDE IN. Client-safe, no I/O.
 *
 * ===========================================================================
 * READ THIS BEFORE "SIMPLIFYING" ANYTHING IN lib/currency.
 * ===========================================================================
 *
 * NAIRA IS THE PRICE OF RECORD, AND NOTHING IN THIS FOLDER CHANGES THAT.
 *
 * Every price on Vallo is set by a lister in naira and every payment is
 * charged in naira through the existing processor. A figure in any other
 * currency is a reading aid for somebody who thinks in pounds or dollars: it
 * is worked out from a published daily rate, it is approximate, and it is
 * never what anybody pays. So:
 *
 *   1. A converted figure is always written as approximate ("about £2,516")
 *      and always sits BESIDE the naira amount, never instead of it.
 *   2. Money screens never convert: checkout, payment, wallet, receipts,
 *      refunds, payouts, offers and agreements, the move-in ledger, anything
 *      a person signs or pays. They show naira exactly as before.
 *   3. A lister can never enter, store or publish a price in another
 *      currency. Nothing here writes a price; there is no foreign-currency
 *      price field anywhere, and there must never be one.
 *
 * WHY, IN LAW. Domestic prices in Nigeria are quoted and settled in naira:
 * the Central Bank of Nigeria Act 2007 (section 20) makes the naira the legal
 * tender in Nigeria, and the Central Bank has directed more than once that
 * domestic transactions, rents and property included, are not to be priced
 * or demanded in a foreign currency. (This note is the engineering reason
 * for the design, not legal advice; counsel confirms the citation.) A rent or a night's stay
 * in Lagos priced "in pounds" would be exactly that. A converted figure
 * presented as an offer ("£2,516 a year") would read as one. So the naira
 * figure is the offer, the converted figure is labelled a guide every time it
 * appears, and the person is told they pay in naira and confirm the exact
 * amount at checkout. Turning this into multi-currency pricing is not a
 * refactor; it is a legal and product decision for the founder, with advice.
 *
 * THE RATES are display rates only (`public.display_exchange_rates`, filled by
 * `/api/cron/display-rates`, read by `rates-store.ts`). They are never used to
 * charge, refund, pay out or reconcile anything.
 *
 * ---------------------------------------------------------------------------
 * The list: naira; the four the founder named (US dollar, British pound,
 * euro); the currencies of the places Vallo's people actually live and move
 * between (Canada, Ghana, South Africa, Kenya, the UAE); and two more for the
 * Nigerian diaspora: the West African CFA franc (Benin and Togo, the largest
 * cross-border community, students and traders, and six more countries) and
 * the Australian dollar (a large and growing diaspora).
 *
 * SYMBOLS are Vallo's own and deliberately unambiguous: "$" alone is never
 * written, because a reader cannot tell US, Canadian and Australian dollars
 * apart from it. DECIMALS are the ISO 4217 minor units (the CFA franc has
 * none). GROUPING is the platform's one convention, commas between thousands
 * and a point before the fraction, in every language (the "Numbers" line on
 * /settings/region says so).
 */

export const DISPLAY_CURRENCIES = [
  "NGN",
  "USD",
  "GBP",
  "EUR",
  "CAD",
  "GHS",
  "ZAR",
  "KES",
  "AED",
  "XOF",
  "AUD",
] as const;

export type DisplayCurrency = (typeof DISPLAY_CURRENCIES)[number];

/** The stored choice: a currency, or "auto" (decided from the request). */
export type CurrencyChoice = DisplayCurrency | "auto";

export const AUTO_CURRENCY = "auto" as const;

export type CurrencyMeta = {
  code: DisplayCurrency;
  /** English name, as a settings list shows it. */
  name: string;
  /** The sign Vallo writes before a figure. Never a bare "$". */
  symbol: string;
  /** ISO 4217 minor-unit digits. */
  decimals: 0 | 2;
  /** Said to the ear after a number ("2,516 British pounds"). */
  spoken: string;
};

export const CURRENCY_META: Readonly<Record<DisplayCurrency, CurrencyMeta>> = {
  NGN: { code: "NGN", name: "Nigerian naira", symbol: "₦", decimals: 2, spoken: "naira" },
  USD: { code: "USD", name: "US dollar", symbol: "US$", decimals: 2, spoken: "US dollars" },
  GBP: { code: "GBP", name: "British pound", symbol: "£", decimals: 2, spoken: "British pounds" },
  EUR: { code: "EUR", name: "Euro", symbol: "€", decimals: 2, spoken: "euros" },
  CAD: { code: "CAD", name: "Canadian dollar", symbol: "CA$", decimals: 2, spoken: "Canadian dollars" },
  GHS: { code: "GHS", name: "Ghanaian cedi", symbol: "GH₵", decimals: 2, spoken: "Ghanaian cedis" },
  ZAR: { code: "ZAR", name: "South African rand", symbol: "R", decimals: 2, spoken: "South African rand" },
  KES: { code: "KES", name: "Kenyan shilling", symbol: "KSh", decimals: 2, spoken: "Kenyan shillings" },
  AED: { code: "AED", name: "UAE dirham", symbol: "AED", decimals: 2, spoken: "UAE dirhams" },
  XOF: { code: "XOF", name: "West African CFA franc", symbol: "CFA", decimals: 0, spoken: "CFA francs" },
  AUD: { code: "AUD", name: "Australian dollar", symbol: "A$", decimals: 2, spoken: "Australian dollars" },
};

const CODES: ReadonlySet<string> = new Set(DISPLAY_CURRENCIES);

export function isDisplayCurrency(value: unknown): value is DisplayCurrency {
  return typeof value === "string" && CODES.has(value);
}

export function isCurrencyChoice(value: unknown): value is CurrencyChoice {
  return value === AUTO_CURRENCY || isDisplayCurrency(value);
}

/** The currencies a rate is needed for: every one but naira itself. */
export const FOREIGN_CURRENCIES: readonly Exclude<DisplayCurrency, "NGN">[] = DISPLAY_CURRENCIES.filter(
  (code): code is Exclude<DisplayCurrency, "NGN"> => code !== "NGN",
);
