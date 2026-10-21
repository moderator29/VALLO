import "@/app/css/price-check.css";

import { getDictionary } from "@vallo/i18n";
import { Amount } from "@/components/ui/Amount";
import { Section, Stack, TYPE } from "@/components/app/Screen";
import { AreaReport } from "@/components/app/price/AreaPanel";
import { Disclaimer, PriceCheckMark } from "@/components/app/price/ResultPanel";
import { ShareAreaButton } from "@/components/app/price/ShareAreaButton";
import { shareAreaCopy, shareCardCopy } from "@/components/app/price/share-copy";
import { shareLines } from "@/lib/price-check/share-card";
import { cardFromAreaRow, sealWithServerKey } from "@/lib/price-check/share-seal";
import type { AreaShare } from "@/lib/price-check/types";

/**
 * THE SHARE SURFACE, BOTH HALVES, AGAINST FIXTURES.
 *
 * ---------------------------------------------------------------------------
 * WHY A HARNESS IS NOT OPTIONAL FOR THIS ONE.
 *
 * Every per-property check on this platform refuses, because all 64 published
 * listings are examples and `is_demo = false` sits inside the comparables
 * predicate, and the area report is empty nearly everywhere for the same
 * reason. So the ANSWERED half of this surface - the button, the sheet, the
 * card and the image - cannot be reached from the live product at all. A
 * surface that cannot be reached is a surface nobody has looked at, which is
 * how a share enum, a share table and a server action shipped with no button,
 * no destination and no image in the first place.
 *
 * Both states are drawn side by side, deliberately: the one a person meets
 * today, and the one the feature is for.
 *
 * ---------------------------------------------------------------------------
 * THE BUTTON HERE WRITES TO THE LIVE TABLE, AND THAT IS CORRECT.
 *
 * `shareAreaPrices` is the real server action, so pressing it mints a real
 * row. That is the point: a preview whose control is stubbed proves the
 * layout and nothing else, and the thing worth proving here is that the whole
 * path works and that the artefact it produces carries no address. The row it
 * writes carries a neighbourhood name, a type, a bedroom count and three
 * figures, because that is all `price_check_shares` has columns for.
 */

const FIXTURE: AreaShare = {
  id: "00000000-0000-4000-8000-00000000cafe",
  scope: "area_and_type",
  stateCode: "LA",
  lgaCode: null,
  area: "Lekki Phase 1",
  propertyType: "apartment",
  listingIntent: "rent",
  bedrooms: 3,
  lowMinor: 750_000_000,
  midMinor: 820_000_000,
  highMinor: 900_000_000,
  listingCount: 9,
  oldestAt: "2026-02-04T00:00:00Z",
  newestAt: "2026-09-02T00:00:00Z",
  createdAt: "2026-09-23T00:00:00Z",
};

export default async function PreviewPriceShare() {
  const t = getDictionary("en");
  const copy = t.priceCheck;
  const lines = shareLines(FIXTURE, shareCardCopy(t), "en", "Lagos");
  const share = shareAreaCopy(t);

  const typeNames = {
    apartment: copy.subject.apartment,
    home: copy.subject.home,
    shop: copy.subject.shop,
    office: copy.subject.office,
  };

  return (
    <main className="nf-shell py-section">
      <h1 className="nf-h2">The share surface</h1>
      <p className="mt-inline nf-body-sm text-[var(--nf-content-muted)]">
        A card is area level and type level. It never carries an address, for anybody, and the
        three walls that make that true are in the database rather than in this page.
      </p>

      <div className="mt-section">
        <Stack>
          {/* ------------------------------------------------ the destination */}
          <Section title="The destination, /price/area/[id]">
            <article className="nf-pc-card" data-testid="nf-pc-share-card">
              <PriceCheckMark />
              <h2 className={`${TYPE.sectionTitle} mt-block`}>{lines.headline}</h2>
              <p className="nf-pc-range mt-block">
                <Amount minorUnits={FIXTURE.lowMinor} locale="en" glance className="nf-h1" />
                <span className="nf-pc-range__join nf-h3">to</span>
                <Amount minorUnits={FIXTURE.highMinor} locale="en" glance className="nf-h1" />
                <span className="nf-pc-range__suffix nf-body-sm">{copy.result.perYear}</span>
              </p>
              <p className="nf-pc-basis nf-body-sm">{lines.basis}</p>
              <p className="mt-block nf-caption text-[var(--nf-content-muted)]">{lines.footer}</p>
            </article>
            <Disclaimer />
          </Section>

          {/* ---------------------------------------- the control, with figures */}
          <Section
            title="The control, where there is something to share"
            description="Pressing this mints a real row. The sheet says the rule out loud before it gives the link."
          >
            <ShareAreaButton
              card={{
                seal: sealWithServerKey({
                  scope: "area_and_type",
                  stateCode: "LA",
                  area: "Lekki Phase 1",
                  propertyType: "apartment",
                  listingIntent: "rent",
                  bedrooms: 3,
                  lowMinor: FIXTURE.lowMinor,
                  midMinor: FIXTURE.midMinor,
                  highMinor: FIXTURE.highMinor,
                  listingCount: FIXTURE.listingCount,
                  oldestAt: FIXTURE.oldestAt ?? undefined,
                  newestAt: FIXTURE.newestAt ?? undefined,
                }),
              }}
              copy={share}
              variant="primary"
            />
          </Section>

          {/* ------------------------------- the control, where there is nothing */}
          <Section
            title="The control, where there is nothing: what a person meets today"
            description="Not a disabled button. A disabled control teaches nobody why it cannot be pressed."
          >
            <ShareAreaButton
              card={null}
              copy={share}
            />
          </Section>

          {/* ---------------------------------- the area report, with the rows */}
          <Section title="Per area row, because a card names one type and one bedroom count">
            <AreaReport
              rows={[
                { scope: "area", propertyType: "apartment", bedrooms: 2, listingCount: 7, p25Minor: 450_000_000, medianMinor: 520_000_000, p75Minor: 600_000_000, sizedCount: 4, medianPerSqmMinor: 4_800_000, oldestAt: "2026-03-04T00:00:00Z", newestAt: "2026-08-21T00:00:00Z" },
                { scope: "area", propertyType: "apartment", bedrooms: 3, listingCount: 12, p25Minor: 770_000_000, medianMinor: 800_000_000, p75Minor: 950_000_000, sizedCount: 2, medianPerSqmMinor: null, oldestAt: "2026-02-11T00:00:00Z", newestAt: "2026-09-02T00:00:00Z" },
              ]}
              census={{ realCount: 19, demoCount: 0, locatedCount: 19, sizedCount: 6 }}
              locale="en"
              copy={copy.area}
              typeNames={typeNames}
              renderShare={(row) => (
                <ShareAreaButton
                  card={
                    row === null
                      ? null
                      : {
                          seal: sealWithServerKey(
                            cardFromAreaRow(
                              { stateCode: "LA", lgaCode: null, area: "Lekki Phase 1", intent: "rent" },
                              row,
                            ),
                          ),
                        }
                  }
                  copy={share}
                />
              )}
            />
          </Section>

          {/* ------------------------------ the area report, as it really is */}
          <Section
            title="The area report as it really is on this estate"
            description="All 64 published listings are examples, so this is the branch a reader meets."
          >
            <AreaReport
              rows={[]}
              census={{ realCount: 0, demoCount: 14, locatedCount: 14, sizedCount: 3 }}
              locale="en"
              copy={copy.area}
              typeNames={typeNames}
              renderShare={() => (
                <div className="mt-block">
                  <ShareAreaButton
                    card={null}
                    copy={share}
                  />
                </div>
              )}
            />
          </Section>
        </Stack>
      </div>
    </main>
  );
}
