import { STAYS_INSTANT_PAY_FLAG, flagIsOn } from "@/lib/flags/read";
import type { Metadata } from "next";
import { ArrivalChargesLine } from "@/components/stays/ArrivalChargesLine";
import { readDeclaration } from "@/lib/stays/arrival-queries";
import { toDoorCharges } from "@/lib/stays/door-total";
import { redirect } from "next/navigation";
import { listingById } from "@/lib/listings/listing-by-id";
import { isPropertyMarket, marketOf } from "@/lib/listings/market";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { StayDetailView } from "./StayDetailView";
import { readStayDates } from "@/components/app/stays/model";
import type { StayDetail } from "./detail-model";

/* About a kilometre: two decimal places. The Map tab draws an area, never the door. */
function areaPoint(lat: number | null, lng: number | null): { lat: number; lng: number } | null {
  if (lat === null || lng === null || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat: Math.round(lat * 100) / 100, lng: Math.round(lng * 100) / 100 };
}
import { getStayDetail } from "@/lib/stays/queries";
import { listSavedPlaces } from "@/lib/saved/places-actions";
import { isSaved, savedKeySet } from "@/lib/saved/places";
import { accommodationPhotoUrl } from "@/lib/stays/photos";
import { siteUrl } from "@/lib/site";
import { resolveSession } from "@/lib/actions/session";
import ListingPage, { generateMetadata as listingMetadata } from "../../listing/[id]/page";

type Params = Promise<{ id: string }>;
type Search = Promise<Record<string, string | string[] | undefined>>;

/**
 * The business-grade record behind this URL, in the shape the showcase draws.
 *
 * `lib/stays/queries.ts` returns the rows as the database holds them, named
 * after their own columns; this route's `detail-model.ts` is the view model
 * the screen was built and tested against. The two are deliberately different
 * and this function is the only place they meet, so neither side has to learn
 * the other's vocabulary and a column rename cannot reach the markup.
 *
 * Null means no accommodation row exists for this id, which is the honest
 * answer while hosts are still onboarding: the route then delegates to the
 * catalogue listing rather than drawing an error, so the two URLs never drift.
 */
async function readStayDetail(id: string): Promise<StayDetail | null> {
  const detail = await getStayDetail(id);
  if (!detail) return null;

  const { accommodation } = detail;
  const isExample = accommodation.is_demo === true || detail.business.is_demo === true;
  return {
    id: accommodation.id,
    name: accommodation.name,
    description: accommodation.description,
    starRating: accommodation.star_rating,
    city: accommodation.city,
    area: accommodation.area,
    areaPoint: areaPoint(accommodation.latitude, accommodation.longitude),
    checkInFrom: accommodation.check_in_from,
    checkOutBy: accommodation.check_out_by,
    houseRules: accommodation.house_rules,
    /* Position decides the cover, exactly as it does for a listing. */
    photos: [...detail.photos]
      .sort((a, b) => a.position - b.position)
      .map((photo) => ({ url: accommodationPhotoUrl(photo.storage_path), alt: null })),
    /* The human label, never the code: "Air conditioning", not "ac". */
    amenities: detail.amenities.map((amenity) => amenity.label),
    roomTypes: detail.room_types.map((room) => ({
      id: room.id,
      name: room.name,
      category: room.category,
      description: room.description,
      sleeps: room.sleeps,
      baseRateMinor: room.base_rate_minor,
      sizeSqm: room.size_sqm,
      ratePlans: room.rate_plans.map((plan) => ({
        id: plan.id,
        name: plan.name,
        mealPlan: plan.meal_plan,
        rateMinor: plan.rate_minor,
        minStayNights: plan.min_stay_nights,
        maxStayNights: plan.max_stay_nights,
        policy: plan.policy
          ? {
              id: plan.policy.id,
              name: plan.policy.name,
              summary: plan.policy.summary,
              freeUntilHours: plan.policy.is_free_until_hours,
              rules: plan.policy.rules,
            }
          : null,
      })),
    })),
    policy: detail.policy
      ? {
          id: detail.policy.id,
          name: detail.policy.name,
          summary: detail.policy.summary,
          freeUntilHours: detail.policy.is_free_until_hours,
          rules: detail.policy.rules,
        }
      : null,
    businessKind: detail.business.kind,
    hostName: detail.business.name,
    businessId: detail.business.id,
    /*
     * THE SHIELD MEANS A HUMAN WAS CHECKED (ledger rule 12), AND THE SHELF
     * DECIDES IT.
     *
     * This used to be `source === "first_party" && !is_demo`, computed here.
     * That is not the same test the shelf card applies: `catalogue_entries.verified`
     * for an accommodation is first party, AND not an example, AND the owning
     * agent carrying a verified badge. A first-party hotel whose agent has not
     * been checked would have worn a shield on this page and none on the card
     * that led here, which is exactly the claim rule 12 forbids. So the
     * projection's own column is read (`getStayDetail`) and used verbatim; no
     * projection row means no shield.
     */
    /* D24: an example row is never drawn as a checked one, whatever the
       projection says; the label is gone from the page and this is what
       keeps that safe. Same for the rating below. */
    hostVerified: !isExample && detail.catalogue?.verified === true,
    isExample,
    /*
     * THE RATING IS THE PROJECTION'S, AND TODAY THE PROJECTION HAS NONE.
     *
     * `reviews.listing_id` is a foreign key to `listings`, so an accommodation
     * id matches no review row and the M9 refresh writes `rating_avg = null,
     * rating_count = 0` for every accommodation. The face therefore draws no
     * rating at all, which is the honest answer rather than a zero or an empty
     * star. Nothing here invents a number and nothing has to change the day
     * reviews can key on a stay: the refresh averages them and this lights up.
     */
    rating:
      !isExample && detail.catalogue && detail.catalogue.rating_avg !== null && detail.catalogue.rating_count > 0
        ? { average: detail.catalogue.rating_avg, count: detail.catalogue.rating_count }
        : null,
  };
}

/**
 * THE SHARE CARD, which this route had none of (R3 finding F-10).
 *
 * A stay forwarded into WhatsApp unfurled as the generic site card, in a
 * market where the forwarded link is the growth loop. The shape is the one
 * `lib/listings/syndication.ts` sets for a property: type, title, description,
 * the canonical url, and the first photograph where there is one, with the
 * twitter card falling back to `summary` when there is not so the unfurl never
 * reserves space for an image that will not arrive.
 *
 * `accommodationPhotoUrl` already returns an absolute public storage URL, so
 * the image needs no resolution against `metadataBase`.
 */
export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const detail = await readStayDetail(id);
  if (!detail) return listingMetadata({ params });
  const where = [detail.area, detail.city].filter(Boolean).join(", ");
  const title = where ? `${detail.name}, ${where}` : detail.name;
  const share = getDictionary(await getLocale()).experienceDetail.stay;
  const description = detail.description ?? (where ? share.shareWhere.replace("{where}", where) : share.shareNone);
  const url = `${siteUrl().replace(/\/+$/, "")}/stay/${detail.id}`;
  const cover = detail.photos[0]?.url;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      title,
      description,
      url,
      ...(cover ? { images: [cover] } : {}),
    },
    twitter: {
      card: cover ? "summary_large_image" : "summary",
      title,
      description,
      ...(cover ? { images: [cover] } : {}),
    },
  };
}

export default async function StayDetailPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  const { id } = await params;
  const detail = await readStayDetail(id);

  /* No accommodation row: the catalogue listing, in the Stays shell. The
     address's dates and party size are handed on, so the reserve panel and
     the pinned bar open on the stay the visitor searched for. */
  if (!detail) {
    /* UX-10 / UX-04: a listing let on a tenancy or sold is Property, whatever
       its kind. An old link to /stay/<id> for it moves to /listing/<id>, so it
       is drawn under the rental template and does not turn the app to Stays. */
    const listing = await listingById(id);
    if (listing && isPropertyMarket(marketOf(listing))) redirect(`/listing/${id}`);
    return <ListingPage params={params} searchParams={searchParams} />;
  }

  const [locale, query, savedPlaces, session, instant, declared] = await Promise.all([
    getLocale(),
    searchParams,
    /* THE HEART'S RESTING STATE, read on the server so it survives a reload.
       This face drew an empty heart on every visit because it never asked the
       shortlist, and an accommodation's shortlist is `saved_places`. Keys
       alone; `isSaved` decides this one card. */
    listSavedPlaces(),
    resolveSession(),
    /* D73: words only. The database decides whether each booking is instant. */
    flagIsOn(STAYS_INSTANT_PAY_FLAG),
    /* Every charge the host declared for the door, so the cost a guest reads
       before booking is the whole cost (founder decision A). It needs only
       the stay's id, so it goes out with the other reads instead of waiting
       for all of them: one round trip fewer before the page can draw. */
    readDeclaration({ accommodationId: detail.id }),
  ]);
  const t = getDictionary(locale);
  const { checkIn, checkOut, nights, guests } = readStayDates(query);
  const doorCharges = toDoorCharges(declared, t.afterTheGate.arrival);
  const saved = isSaved(
    savedKeySet(savedPlaces.ok ? savedPlaces.data : []),
    "accommodation",
    detail.id,
  );

  return (
    <StayDetailView
      detail={detail}
      nights={nights}
      checkIn={checkIn}
      checkOut={checkOut}
      guests={guests}
      locale={locale}
      copy={t.stayDetail}
      t={t}
      /* UX-08: the dates are picked here, on this stay, not on search. */
      datesHref="#stay-dates"
      reserve={{ stayId: detail.id, checkIn, checkOut, guests }}
      saved={saved}
      signedIn={session.state === "signed-in"}
      instant={instant}
      arrival={<ArrivalChargesLine listingId={null} accommodationId={detail.id} locale={locale} />}
      door={doorCharges}
    />
  );
}
