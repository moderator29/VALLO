import { State } from "@/components/ui/State";
import { Amount } from "@/components/ui/Amount";
import { EmptyState, Section, TYPE } from "@/components/app/Screen";
import { DiscoveryEmpty } from "@/components/app/search/DiscoveryEmpty";
import { LAGOS_TIME_ZONE, intlTag, type Locale } from "@vallo/i18n/core";
import { factLabel } from "@/lib/price-check/facts-labels";
import type { AreaAskingRow, AreaCensus, AreaUtilityFacts } from "@/lib/price-check/types";

/**
 * THE AREA REPORT AND THE NEIGHBOURHOOD FACTS: what stage one actually is.
 *
 * ---------------------------------------------------------------------------
 * THE AREA REPORT MAKES A SMALLER CLAIM THAN A PER PROPERTY FIGURE AND SAYS SO.
 *
 * Three listings rather than five, because the sentence is weaker and true:
 * "three two-bed flats in Yaba are currently asking between X and Y" is a
 * statement about three listings, not an estimate of anything. Every row
 * carries its count and the months its listings were published in, and that
 * sentence beside every figure IS the product in stage one.
 *
 * ---------------------------------------------------------------------------
 * AND THE FACTS PANEL NEEDS NO PRICES AT ALL, WHICH IS WHY IT IS HERE.
 *
 * `power_grid`, `power_backup`, `water_supply`, `prepaid_meter` and
 * `has_estate_access` are collected structurally on every listing and nobody
 * else in this market captures them. On the day Price Check ships every per
 * property call refuses, and this panel is real value that does not depend on
 * the gate opening at all.
 *
 * EVERY FIGURE IN IT IS A COUNT, NEVER A PERCENTAGE. "7 of 19" is honest
 * about the sample it came from; "37 per cent" over nineteen listings is a
 * figure pretending to be a survey. The basis line says the same thing in
 * words: this is what the listings we hold say about themselves, not a survey
 * of the neighbourhood.
 */

export type AreaCopy = {
  heading: string;
  subheading: string;
  askingFor: string;
  studioFor: string;
  basis: string;
  perSqm: string;
  perSqmCoverage: string;
  noPerSqm: string;
  emptyTitle: string;
  emptyBody: string;
  demoOnlyTitle: string;
  demoOnlyBody: string;
  unreachableTitle: string;
  unreachableBody: string;
};

export type FactsCopy = {
  heading: string;
  basis: string;
  grid: string;
  backup: string;
  water: string;
  prepaid: string;
  estate: string;
  ofListings: string;
  mostCommon: string;
  empty: string;
} & Record<string, string>;

export type TypeNames = Record<string, string>;

function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    key in values ? String(values[key]) : whole,
  );
}

/** "March 2026". Month and year only: a day is precision we did not earn. */
function monthYear(iso: string, locale: Locale): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(intlTag[locale], {
    month: "long",
    year: "numeric",
    timeZone: LAGOS_TIME_ZONE,
  }).format(date);
}

export function AreaReport({
  rows,
  census,
  locale,
  copy,
  typeNames,
  renderShare,
  chart,
}: {
  /** Null means we could not read, which is different from "there is nothing". */
  rows: AreaAskingRow[] | null;
  census: AreaCensus | null;
  locale: Locale;
  copy: AreaCopy;
  typeNames: TypeNames;
  /**
   * THE SHARE CONTROL, RENDERED BY THE CALLER, ONCE PER ROW AND ONCE FOR NONE.
   *
   * It is a prop rather than an import because this file is presentational and
   * the button is a client component holding a server action: this panel is
   * drawn on three surfaces and only one of them can mint a card.
   *
   * It is called with a ROW where there is one, and with `null` in each of the
   * three empty states, because "there is nothing to share here yet" is the
   * answer a person will actually meet on this platform today and it belongs
   * on the screen rather than being the absence of a control. A share surface
   * that simply vanishes when there is no data is a share surface nobody knows
   * exists.
   */
  renderShare?: (row: AreaAskingRow | null) => React.ReactNode;
  /**
   * The figure and chart that lead the report when there are rows
   * (`AreaAskingChart`, Session 3, W2). A slot rather than an import because
   * the chart is a client component and this panel is drawn on surfaces that
   * do not all ship one.
   */
  chart?: React.ReactNode;
}) {
  /*
   * THREE EMPTY STATES AND THEY ARE NOT THE SAME SENTENCE.
   *
   * "We could not read the listings" is about us. "Everything here is an
   * example" is about our supply. "Nothing here yet" is about the
   * neighbourhood. Printing any of them in place of another would be a
   * statement about our own data that we had not checked, which is the
   * invented figure of rule 15 with the numbers left out.
   */
  if (rows === null) {
    /* NO SHARE CONTROL HERE, and this is the one empty state that gets none.
       The other two are statements about our supply; this one is a statement
       about us being unable to read it, and offering a card off the back of a
       failed read would be offering something we cannot say anything about. */
    return (
      <EmptyState
        icon="report-stats"
        title={copy.unreachableTitle}
        body={copy.unreachableBody}
        data-testid="nf-pc-area-unreachable"
      />
    );
  }

  if (rows.length === 0) {
    const examplesOnly = census !== null && census.realCount === 0 && census.demoCount > 0;
    return (
      <>
        {/* Stage 5: the empty report is the current product nearly
            everywhere, so the object settles in (the matte bars, the chart
            that is waiting for figures) and the reason is the true one. */}
        <DiscoveryEmpty
          object={examplesOnly ? "info-disc" : "bars-chart"}
          title={examplesOnly ? copy.demoOnlyTitle : copy.emptyTitle}
          body={examplesOnly ? copy.demoOnlyBody : copy.emptyBody}
          data-testid={examplesOnly ? "nf-pc-area-demo-only" : "nf-pc-area-empty"}
        />
        {renderShare?.(null)}
      </>
    );
  }

  return (
    <Section title={copy.heading} description={copy.subheading}>
      {chart}
      <div>
        {rows.map((row) => {
          const typeName = typeNames[row.propertyType] ?? row.propertyType;
          const what =
            row.bedrooms > 0
              ? fill(copy.askingFor, { bedrooms: row.bedrooms, type: typeName })
              : fill(copy.studioFor, { type: typeName });

          return (
            <div key={`${row.propertyType}-${row.bedrooms}`} className="nf-pc-area-row">
              <div className="nf-pc-area-row__what">
                <p className="nf-body font-semibold">{what}</p>
                <p className="nf-pc-area-row__basis nf-caption">
                  {fill(copy.basis, {
                    count: row.listingCount,
                    from: monthYear(row.oldestAt, locale),
                    to: monthYear(row.newestAt, locale),
                  })}
                </p>
                {/* THE COVERAGE IS PRINTED BESIDE EVERY PER SQUARE METRE
                    FIGURE, and where there is no figure the reason is printed
                    instead. Size is optional on a listing and the publish gate
                    asks for none, so a per square metre number exists only on a
                    self-selected subset and saying so is the difference between
                    a fact and an impression. */}
                {row.medianPerSqmMinor !== null && row.sizedCount >= 3 ? (
                  <p className="nf-pc-area-row__basis nf-caption">
                    <Amount
                      minorUnits={Math.round(row.medianPerSqmMinor)}
                      locale={locale}
                      compact
                    />{" "}
                    {fill(copy.perSqmCoverage, {
                      sized: row.sizedCount,
                      count: row.listingCount,
                    })}
                  </p>
                ) : (
                  <p className="nf-pc-area-row__basis nf-caption">{copy.noPerSqm}</p>
                )}
              </div>
              <p className="nf-pc-area-row__range nf-body-sm">
                <Amount minorUnits={row.p25Minor} locale={locale} glance />
                {" to "}
                <Amount minorUnits={row.p75Minor} locale={locale} glance />
              </p>
              {/* PER ROW, because a card names one type and one bedroom count:
                  "Three bedroom flats in Lekki Phase 1". A single control over
                  the whole panel would have to pick one of them for the
                  reader, and picking would be inventing. */}
              {renderShare === undefined ? null : (
                <div className="nf-pc-area-row__share">{renderShare(row)}</div>
              )}
            </div>
          );
        })}
      </div>
    </Section>
  );
}

/**
 * The enum label, from `lib/price-check/facts-labels.ts`.
 *
 * It is a plain module rather than a helper in this file because a `.tsx`
 * cannot be imported by this project's vitest suite at all - the config
 * aliases react at its react-server entry and nothing in the suite renders a
 * component - and this is the part that can be wrong in silence. It already
 * was: `BAND_A` resolved to nothing, and the panel rendered with its three
 * most important rows simply absent and no error anywhere.
 */
function enumWord(value: string | null, prefix: string, copy: FactsCopy): string | null {
  return factLabel(value, prefix, copy as unknown as Record<string, string>);
}

export function NeighbourhoodFacts({
  facts,
  copy,
}: {
  facts: AreaUtilityFacts | null;
  copy: FactsCopy;
}) {
  if (facts === null || facts.listingCount === 0) {
    return (
      <Section title={copy.heading}>
        <State compact kind="empty" icon="report-stats" title={copy.empty} className="" />
      </Section>
    );
  }

  const grid = enumWord(facts.powerGrid, "grid", copy);
  const backup = enumWord(facts.powerBackup, "backup", copy);
  const water = enumWord(facts.waterSupply, "water", copy);

  const cells: { label: string; value: string; count: string }[] = [];
  if (grid) {
    cells.push({
      label: copy.grid,
      value: grid,
      count: fill(copy.ofListings, {
        count: facts.powerGridCount ?? 0,
        total: facts.listingCount,
      }),
    });
  }
  if (backup) {
    cells.push({
      label: copy.backup,
      value: backup,
      count: fill(copy.ofListings, {
        count: facts.powerBackupCount ?? 0,
        total: facts.listingCount,
      }),
    });
  }
  if (water) {
    cells.push({
      label: copy.water,
      value: water,
      count: fill(copy.ofListings, {
        count: facts.waterSupplyCount ?? 0,
        total: facts.listingCount,
      }),
    });
  }
  /* A boolean gets its own DENOMINATOR, because "4 of 19" and "4 of 6 that
     said" are different facts and only the second one is true of a column
     nobody is required to fill in. */
  if (facts.prepaidMeterKnown > 0) {
    cells.push({
      label: copy.prepaid,
      value: fill(copy.ofListings, {
        count: facts.prepaidMeterCount,
        total: facts.prepaidMeterKnown,
      }),
      count: "",
    });
  }
  if (facts.estateAccessKnown > 0) {
    cells.push({
      label: copy.estate,
      value: fill(copy.ofListings, {
        count: facts.estateAccessCount,
        total: facts.estateAccessKnown,
      }),
      count: "",
    });
  }

  return (
    <Section title={copy.heading}>
      <p className={`mb-block ${TYPE.rowMeta}`}>
        {fill(copy.basis, { count: facts.listingCount })}
      </p>
      <div className="nf-pc-facts">
        {cells.map((cell) => (
          <div key={cell.label} className="nf-pc-fact">
            <span className="nf-pc-fact__label nf-caption">{cell.label}</span>
            <span className="nf-pc-fact__value nf-body-sm">{cell.value}</span>
            {cell.count && <span className="nf-pc-fact__count nf-caption">{cell.count}</span>}
          </div>
        ))}
      </div>
    </Section>
  );
}
