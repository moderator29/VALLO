import Link from "next/link";
import { formatMoney, type Dictionary, type Locale } from "@vallo/i18n/core";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { ownerConfirmedLine } from "@/lib/landlord/facts";
import { requestNow } from "@/lib/format/when";
import { readListingFactsFor, readPropertyOffers, type PropertyOffer } from "@/lib/landlord/queries";

type LandlordCopy = Dictionary["landlord"];

/**
 * V-31 ON THE LISTING PAGE: WHAT THE OWNER SAID, AND ONLY WHAT THE OWNER SAID.
 *
 * Streams in its own Suspense boundary so the listing page never waits for it,
 * and fails soft: a read that errors draws nothing, exactly as a listing with
 * no answer draws nothing.
 *
 * Three states and no fourth:
 *
 *   "Owner confirmed available 3 days ago"   the principal answered 1, from
 *                                            their own number or their own
 *                                            single-use link
 *   "Not reconfirmed"                        a question to them went 21 days
 *                                            unanswered; the listing sorts
 *                                            last and takes no new inspection
 *   nothing                                  every other case, including
 *                                            waiting, no consent, no mandate,
 *                                            and every example listing
 *
 * Colour is never the only signal: the line carries an icon and the words.
 */
export async function OwnerAvailabilityLine({
  listingId,
  isDemo,
  copy,
}: {
  listingId: string;
  isDemo: boolean;
  copy: LandlordCopy["listing"];
}) {
  if (isDemo) return null;
  const facts = (await readListingFactsFor([listingId])).get(listingId);
  if (!facts) return null;
  return (
    <OwnerAvailabilityView
      notReconfirmed={facts.notReconfirmed}
      line={ownerConfirmedLine(copy, facts.ownerConfirmedAt, requestNow())}
      copy={copy}
    />
  );
}

/** The drawing alone, so the preview harness can show every state. */
export function OwnerAvailabilityView({
  notReconfirmed,
  line,
  copy,
}: {
  notReconfirmed: boolean;
  line: string | null;
  copy: LandlordCopy["listing"];
}) {
  if (notReconfirmed) {
    return (
      <div className="mt-row flex items-start gap-xs" data-testid="landlord-not-reconfirmed">
        <UiIcon name="info" size={20} className="mt-3xs shrink-0 text-[var(--nf-state-warning)]" />
        <p className="text-[length:var(--nf-text-body-sm)] leading-relaxed">
          <span className="font-semibold text-[var(--nf-state-warning)]">{copy.notReconfirmed}.</span>{" "}
          <span className="text-[var(--nf-content-secondary)]">{copy.notReconfirmedBody}</span>
        </p>
      </div>
    );
  }
  if (!line) return null;
  return (
    <p className="mt-row flex items-center gap-xs text-[length:var(--nf-text-body-sm)]" data-testid="landlord-owner-confirmed">
      <UiIcon name="history" size={20} className="shrink-0 text-[var(--nf-status-verified)]" />
      <span className="font-normal text-[var(--nf-content-secondary)]">{line}</span>
    </p>
  );
}

/**
 * V-37 ON THE LISTING PAGE: EVERY OFFER ON THIS PROPERTY, SIDE BY SIDE.
 *
 * Drawn only when a reviewer has joined this listing to a property that has at
 * least one other published offer. One offer is not a comparison, so a
 * property of one draws nothing at all rather than a list of one. Each offer
 * shows its lister and its own move-in total, and this listing is marked
 * rather than linked. Nothing about the owner is ever shown here.
 *
 * A failed read draws one quiet sentence, because a renter comparing four
 * agents' prices should know the comparison did not load rather than believe
 * there is nothing to compare.
 */
export async function PropertyOffers({
  listingId,
  isDemo,
  copy,
  listingCopy,
  locale,
}: {
  listingId: string;
  isDemo: boolean;
  copy: LandlordCopy["offers"];
  listingCopy: LandlordCopy["listing"];
  locale: Locale;
}) {
  if (isDemo) return null;
  const offers = await readPropertyOffers(listingId);
  return <PropertyOffersView offers={offers} copy={copy} listingCopy={listingCopy} locale={locale} nowMs={requestNow()} />;
}

/** The drawing alone. `offers` null means the read failed. */
export function PropertyOffersView({
  offers,
  copy,
  listingCopy,
  locale,
  nowMs,
}: {
  offers: PropertyOffer[] | null;
  copy: LandlordCopy["offers"];
  listingCopy: LandlordCopy["listing"];
  locale: Locale;
  nowMs: number;
}) {
  if (offers === null) {
    return (
      <p className="nf-caption mt-md text-[var(--nf-content-muted)]" data-testid="property-offers-failed">
        {copy.failed}
      </p>
    );
  }
  if (offers.length < 2) return null;

  return (
    <section className="nf-panel nf-panel--card mt-md block p-md" aria-labelledby="property-offers-title" data-testid="property-offers">
      <h2 id="property-offers-title" className="nf-h3">
        {copy.title.replace("{n}", String(offers.length))}
      </h2>
      <p className="mt-2xs text-[length:var(--nf-text-body-sm)] leading-relaxed text-[var(--nf-content-secondary)]">{copy.lede}</p>
      <ul className="mt-sm divide-y divide-[var(--nf-border-subtle)]">
        {offers.map((offer) => {
          const confirmed = ownerConfirmedLine(listingCopy, offer.ownerConfirmedAt, nowMs);
          const body = (
            <>
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 block text-[length:var(--nf-text-body-sm)] font-semibold">
                  {offer.isThisListing ? copy.thisOne : offer.listerName ?? offer.title}
                </span>
                {confirmed && (
                  <span className="block text-[length:var(--nf-text-caption)] text-[var(--nf-content-muted)]">{confirmed}</span>
                )}
              </span>
              <span className="shrink-0 text-right">
                <span className="block text-[length:var(--nf-text-caption)] text-[var(--nf-content-muted)]">{copy.moveIn}</span>
                <span className="block text-[length:var(--nf-text-body-sm)] font-bold tabular-nums">
                  {offer.moveInMinor !== null && offer.moveInMinor > 0 ? formatMoney(offer.moveInMinor, locale) : copy.noMoveIn}
                </span>
              </span>
            </>
          );
          return (
            <li key={offer.listingId}>
              {offer.isThisListing ? (
                <div className="flex min-h-[44px] items-center gap-md py-sm" aria-current="page">
                  {body}
                </div>
              ) : (
                <Link
                  href={`/listing/${offer.listingId}`}
                  className="flex min-h-[44px] items-center gap-md py-sm"
                  aria-label={`${copy.view}: ${offer.listerName ?? offer.title}`}
                >
                  {body}
                  <UiIcon name="chevron-right" size={16} className="shrink-0 text-[var(--nf-content-muted)]" />
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
