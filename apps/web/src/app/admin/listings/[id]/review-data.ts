import { readPayeeContext } from "@/lib/after-gate/payee";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { getListingSubmissions, type ListingReviewView } from "@/lib/admin/queries";
import { getListingReviewExtras } from "@/lib/admin/reads/listings";
import { tileProvider } from "@/lib/maps/tiles";
import { adminUi } from "../../_components/ui";
import { readQueueQuery } from "../../_components/QueueFilters";
import { queueHrefFrom } from "../tabs";
import { readClosedReasons } from "@/lib/landlord/queries";
import { readFeeAcceptance } from "@/lib/admin/desk-reads/fee-acceptance-read";
import { readPhotoProvenance } from "@/lib/photo-hash/matches-read";

/**
 * Everything one listing review reads, once, for the hub and for every section
 * page under it, so each page opens on the same facts. `found` is undefined
 * when the listing could not be opened; the page says so in its own words.
 */
export async function loadListingReview(
  id: string,
  rawSearch: Record<string, string | string[] | undefined>,
) {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const query = readQueueQuery(rawSearch);
  const queueHref = queueHrefFrom(query);

  const extras = await getListingReviewExtras(id, query.status);
  const extra = extras.state === "ok" ? extras.data : null;

  let found: ListingReviewView | undefined;
  if (extra) {
    const read = await getListingSubmissions({ status: extra.status, q: extra.title });
    if (read.state === "ok") {
      found = [...read.data.waiting, ...read.data.decided].find((listing) => listing.id === id);
    }
  }

  const base = { locale, t, copy: t.admin.listings, common: t.admin.common, ui: adminUi(t, locale), query, queueHref, extras, extra };
  if (!found) return { ...base, found: undefined };

  const [payeeCtx, closedReasons, provenance, feeAcceptance] = await Promise.all([
    found.intent === "sale" ? Promise.resolve(null) : readPayeeContext(found.id),
    readClosedReasons([found.id]),
    readPhotoProvenance(found.id),
    readFeeAcceptance(found.id),
  ]);
  const closedReason = closedReasons[found.id] ?? null;
  const decidable = found.status !== "PUBLISHED" && found.status !== "REJECTED" && closedReason === null;
  /* The Location panel's mosaic needs raster tiles. OpenFreeMap serves vector
     tiles only, so with no MapTiler key the template is empty, the mosaic has
     no images and no credit is owed for imagery that is not drawn. */
  const dark = tileProvider("dark");
  return {
    ...base,
    found,
    payeeCtx,
    provenance,
    feeAcceptance,
    closedReason,
    decidable,
    nextId: extra?.nextId ?? null,
    tiles: dark.url
      ? { dark: dark.url, credit: dark.credits.map((credit) => credit.label).join(", ") }
      : { dark: "", credit: "" },
  };
}

export type ListingReviewData = Awaited<ReturnType<typeof loadListingReview>>;

/** The sections a listing review opens on their own pages. */
export const LISTING_SECTIONS = ["photos", "details", "location", "costs", "lister", "checklist", "fees", "matches", "notes"] as const;
export type ListingSection = (typeof LISTING_SECTIONS)[number];
export const isListingSection = (value: string): value is ListingSection =>
  (LISTING_SECTIONS as readonly string[]).includes(value);
