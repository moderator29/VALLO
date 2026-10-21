import "@/app/css/price-check.css";

import { getDictionary } from "@vallo/i18n";
import { Section, Stack } from "@/components/app/Screen";
import { AnsweredResult, ComparablesRail } from "@/components/app/price/ResultPanel";
import { NextActions } from "@/components/app/price/NextActions";
import { ShareAreaButton } from "@/components/app/price/ShareAreaButton";
import { cardFromAnswer, sealWithServerKey } from "@/lib/price-check/share-seal";
import { shareAreaCopy } from "@/components/app/price/share-copy";
import { resolveSession } from "@/lib/actions/session";
import type { Comparable } from "@/lib/price-check/types";

/**
 * AN ANSWERED RANGE, WHICH NO LIVE CHECK CAN PRODUCE TODAY.
 *
 * Every listing on this project is an example and `is_demo = false` sits in the
 * comparables predicate, so the answered branch of this surface is
 * unreachable in the product until real supply arrives in one place. It is
 * still a designed screen and it is drawn here.
 *
 * WHAT TO LOOK AT, because it is the ruling rather than a preference: THE
 * MIDPOINT IS NOT SET LARGER THAN THE BOUNDS. A range whose middle is
 * emphasised is a point estimate with decoration, which is the thing this
 * feature refuses to build. The basis line sits directly under the figure at
 * body-small and is never behind a tap. The confidence row is one blue at two
 * fills and a muted outline, never green, amber and red.
 */

const COMPARABLES: Comparable[] = [
  { id: "1", title: "", area: "Lekki Phase 1", city: "Lagos", bedrooms: 3, bathrooms: 3, sizeSqm: 120, publishedAt: "", ageDays: 32, distanceM: 210, priceMinor: 770_000_000, priceBasis: "advertised_rent_year", pricePerSqmMinor: null },
  { id: "2", title: "", area: "Lekki Phase 1", city: "Lagos", bedrooms: 3, bathrooms: 3, sizeSqm: null, publishedAt: "", ageDays: 48, distanceM: 330, priceMinor: 780_000_000, priceBasis: "advertised_rent_year", pricePerSqmMinor: null },
  { id: "3", title: "", area: "Lekki Phase 1", city: "Lagos", bedrooms: 4, bathrooms: 4, sizeSqm: 160, publishedAt: "", ageDays: 61, distanceM: 420, priceMinor: 800_000_000, priceBasis: "advertised_rent_year", pricePerSqmMinor: null },
  { id: "4", title: "", area: "Lekki Phase 1", city: "Lagos", bedrooms: 3, bathrooms: 2, sizeSqm: 110, publishedAt: "", ageDays: 70, distanceM: 510, priceMinor: 820_000_000, priceBasis: "advertised_rent_year", pricePerSqmMinor: null },
  { id: "5", title: "", area: "Lekki Phase 1", city: "Lagos", bedrooms: 2, bathrooms: 2, sizeSqm: null, publishedAt: "", ageDays: 90, distanceM: 640, priceMinor: 830_000_000, priceBasis: "advertised_rent_year", pricePerSqmMinor: null },
];

export default async function PreviewPriceAnswered() {
  const t = getDictionary("en");
  const copy = t.priceCheck;
  /* Track L: the next steps under the answer, with the real share control
     and the real saved-search action, as the signed-in reader would get them. */
  const signedIn = (await resolveSession()).state === "signed-in";

  return (
    <main className="nf-shell py-section">
      <h1 className="nf-h2">An answered range</h1>
      <p className="mt-inline nf-body text-[var(--nf-content-secondary)]">
        Three bedroom flat, Lekki Phase 1, Lagos.
      </p>

      <div className="mt-section">
        <Stack>
          <Section>
            <AnsweredResult
              result={{
                kind: "answered",
                basis: "per_property",
                lowMinor: 770_000_000,
                midMinor: 800_000_000,
                highMinor: 830_000_000,
                dispersion: 0.075,
                confidence: "medium",
                radiusM: 750,
                comparableCount: 9,
                medianAgeDays: 61,
                medianDistanceM: 420,
                comparableIds: [],
                sizedShortfall: true,
              }}
              locale="en"
              copy={copy.result}
              intent="rent"
            />
          </Section>
          <Section>
            <NextActions
              facts={{ intent: "rent", propertyType: "apartment", bedrooms: 3, area: "Lekki Phase 1", lgaName: "Eti-Osa", stateName: "Lagos" }}
              copy={copy.next}
              signedIn={signedIn}
              share={
                <ShareAreaButton
                  card={{
                    seal: sealWithServerKey(
                      cardFromAnswer(
                        { stateCode: "LA", lgaCode: null, area: "Lekki Phase 1", intent: "rent", propertyType: "apartment", bedrooms: 3 },
                        { lowMinor: 770_000_000, midMinor: 800_000_000, highMinor: 830_000_000, comparableCount: 9 },
                      ),
                    ),
                  }}
                  copy={shareAreaCopy(t)}
                />
              }
            />
          </Section>
          <Section>
            <ComparablesRail comparables={COMPARABLES} locale="en" copy={copy.result} />
          </Section>
        </Stack>
      </div>
    </main>
  );
}
