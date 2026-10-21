import type { Metadata } from "next";
import { forPriceCheck } from "@/lib/i18n/slice";
import { randomUUID } from "node:crypto";
import { areaPaid } from "@/lib/after-gate/paid-queries";
import { PaidPanel } from "@/components/app/price/PaidPanel";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { PageHeader } from "@/components/app/PageHeader";
import { Icon3D } from "@/components/ui/Icon3D";
import { resolveSession } from "@/lib/actions/session";
import { listLocalGovernments, listStates } from "@/lib/places/queries";
import { emptySubject } from "@/lib/price-check/address";
import { priceCheckOutcome } from "@/lib/price-check/gate";
import {
  areaAsking,
  areaCensus,
  comparablesFor,
  runPriceCheck,
  utilityFacts,
} from "@/lib/price-check/queries";
import { REFUSALS } from "@/lib/price-check/refusals";
import { cardFromAnswer, cardFromAreaRow, sealWithServerKey } from "@/lib/price-check/share-seal";
import type {
  Comparable,
  ListingIntent,
  PriceCheckPropertyType,
  RentPeriod,
} from "@/lib/price-check/types";
import { PriceCheckScreen } from "@/components/app/price/PriceCheckScreen";

/**
 * `/price`. What property near here is ASKING.
 *
 * ---------------------------------------------------------------------------
 * THE ROUTE SEGMENT IS `price` AND IT MAY NOT BE ANYTHING ELSE.
 *
 * "The route is never /valuation" is the first line of the ruling's own list
 * of places the regulated word may not appear, and
 * `scripts/check-valuation-words.mjs` walks directory names for exactly that
 * reason: no linter does, and a route segment is a public claim about what
 * this page is.
 *
 * ---------------------------------------------------------------------------
 * THE ANSWER IS COMPUTED HERE, ON THE SERVER, INCLUDING THE REFUSAL.
 *
 * The refusal IS the product on this platform today: 64 of the 64 listings are
 * examples and `is_demo = false` sits inside the comparables predicate, so
 * every per-property check refuses. A refusal that arrives after a client
 * fetch and a spinner reads as a broken screen; one that arrives with the HTML
 * reads as an answer, which is what it is.
 *
 * ---------------------------------------------------------------------------
 * `metadata` CARRIES NO FIGURE AND NO PLACE.
 *
 * A machine-readable tag is a claim the product has to be able to stand
 * behind, which `lib/listings/syndication.ts` already holds the line on. A
 * title built from the query string would put somebody's own neighbourhood
 * into a page title and into whatever crawls it, so the title is static.
 */
export const metadata: Metadata = {
  title: "Price Check",
  description:
    "What are properties near here asking? A range built from what similar properties are currently advertised for on Vallo, or an honest refusal when there is not enough to say.",
};

const SUPPORTED: readonly PriceCheckPropertyType[] = ["apartment", "home", "shop", "office"];

function readType(value: string | undefined): PriceCheckPropertyType {
  return SUPPORTED.includes(value as PriceCheckPropertyType)
    ? (value as PriceCheckPropertyType)
    : "apartment";
}

function readIntent(value: string | undefined): ListingIntent {
  return value === "sale" ? "sale" : "rent";
}

function readPeriod(value: string | undefined): RentPeriod {
  return value === "month" || value === "quarter" ? value : "year";
}

function readNumber(value: string | undefined): number | null {
  if (value === undefined || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function PriceCheckPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [locale, params, session] = await Promise.all([
    getLocale(),
    searchParams,
    resolveSession(),
  ]);
  const t = getDictionary(locale);

  const stateCode = (one(params.state) ?? "").trim().toUpperCase();
  const lgaCode = (one(params.lga) ?? "").trim() || null;
  const area = (one(params.area) ?? "").trim() || null;
  const lat = readNumber(one(params.lat));
  const lng = readNumber(one(params.lng));
  const propertyType = readType(one(params.type));
  const intent = readIntent(one(params.intent));
  const rentPeriod = readPeriod(one(params.period));
  const bedrooms = readNumber(one(params.beds));
  const sizeSqm = readNumber(one(params.size));

  const subject = {
    ...emptySubject(stateCode),
    lat,
    lng,
    lgaCode,
    area,
    propertyType,
    intent,
    rentPeriod,
    bedrooms: bedrooms === null ? null : Math.round(bedrooms),
    sizeSqm,
  };

  /*
   * Everything at once. The area report and the facts panel do not depend on
   * the gate and must not wait behind it: on the day this ships the gate
   * refuses every call, and those two panels are what the reader came for.
   */
  const [states, lgas, check, rows, census, facts, paid] = await Promise.all([
    listStates(),
    stateCode ? listLocalGovernments(stateCode) : Promise.resolve([]),
    lat !== null && lng !== null
      ? runPriceCheck(subject)
      : Promise.resolve({ verdict: null, supply: null, reachable: true }),
    stateCode ? areaAsking(stateCode, null, area, intent, null, null) : Promise.resolve(null),
    stateCode ? areaCensus(stateCode, null, area, intent) : Promise.resolve(null),
    stateCode ? utilityFacts(stateCode, null, area) : Promise.resolve(null),
    // V-39: what tenancies here actually settled at, beside the asking report.
    stateCode && area ? areaPaid(stateCode, area) : Promise.resolve(undefined),
  ]);

  const result =
    lat !== null && lng !== null
      ? priceCheckOutcome(subject, check.verdict, check.supply)
      : null;

  /*
   * The comparables are fetched only where the screen will actually draw them,
   * which is an answered figure and the two refusals that show their working.
   * Fetching them for `demo_only` would be a round trip for a list the gate
   * has already said is empty.
   */
  let comparables: Comparable[] = [];
  const drawsComparables =
    result !== null &&
    (result.kind === "answered" ||
      (result.kind === "refused" &&
        (REFUSALS[result.code].showsComparables || REFUSALS[result.code].showsStripPlot)));

  if (drawsComparables && lat !== null && lng !== null) {
    comparables = await comparablesFor(
      lat,
      lng,
      propertyType,
      intent,
      subject.bedrooms,
      result.kind === "answered" ? result.radiusM : 3000,
    );
  }

  /*
   * THE CARDS THIS ANSWER MAY MINT, SEALED HERE WHERE THE FIGURES WERE
   * COMPUTED. The share action takes only a seal, so a card can carry no
   * figure, count or place this page did not produce (`share-seal.ts`).
   */
  const place = { stateCode, lgaCode, area, intent };
  const shareSeals = {
    answered:
      result !== null && result.kind === "answered"
        ? sealWithServerKey(
            cardFromAnswer({ ...place, propertyType, bedrooms: subject.bedrooms }, result),
          )
        : null,
    rows: (rows ?? []).map((row) => sealWithServerKey(cardFromAreaRow(place, row))),
  };

  return (
    // A form page reads at a measure on a wide screen, as Settings and Saved do,
    // instead of stretching its fields across 1100px (pixel polish).
    <div className="mx-auto max-w-3xl">
      <PageHeader variant="large" title={t.priceCheck.title} subtitle={t.priceCheck.lead} fallback="/home" />
      {/* The founder's 3D price tag (30 September) beside the intro. */}
      <div className="flex items-center gap-md">
        <p className="nf-body min-w-0 flex-1 text-[var(--nf-content-secondary)]">{t.priceCheck.intro}</p>
        <span className="grid size-16 shrink-0 place-items-center" aria-hidden="true" data-art="price-tag">
          <Icon3D name="price-tag" size={64} priority />
        </span>
      </div>
      <div className="mt-section-tight">
        <PriceCheckScreen
          locale={locale}
          t={forPriceCheck(t)}
          states={states.map((row) => ({ code: row.code, name: row.name }))}
          lgas={lgas.map((row) => ({ code: row.code, name: row.name }))}
          query={{
            stateCode,
            lgaCode,
            area,
            lat,
            lng,
            propertyType,
            intent,
            rentPeriod,
            bedrooms: subject.bedrooms,
            sizeSqm,
          }}
          result={result}
          comparables={comparables}
          areaRows={rows}
          shareSeals={shareSeals}
          areaCensus={census}
          facts={facts}
          signedIn={session.state === "signed-in"}
          /* One check is one id, minted per render rather than per session, so
             the stages of one check join to each other and to no person. */
          checkId={randomUUID()}
          chartCopy={t.experienceDiscover.price.chart}
        />
      </div>
      {stateCode && (
        <div className="mt-section-tight">
          <PaidPanel
            rows={paid}
            locale={locale}
            copy={t.afterTheGate.paid}
            typeNames={{
              apartment: t.priceCheck.subject.apartment,
              home: t.priceCheck.subject.home,
              shop: t.priceCheck.subject.shop,
              office: t.priceCheck.subject.office,
            }}
          />
        </div>
      )}
    </div>
  );
}
