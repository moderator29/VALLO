import "@/app/s/door.css";

import { getDictionary } from "@vallo/i18n";
import { LogoMark } from "@/design-system/brand/Logo";
import { shareCardCopy } from "@/components/app/price/share-copy";
import { shareLines } from "@/lib/price-check/share-card";
import { doorCardFromRow, doorLines, type DoorRow } from "@/lib/share/door";
import {
  DoorAreaView,
  DoorExampleView,
  DoorListingView,
  DoorStateView,
} from "@/app/s/[token]/DoorViews";

/**
 * THE SHARE DOOR, EVERY STATE, AGAINST FIXTURES (V-07).
 *
 * The live door cannot draw a real listing's card until a real listing
 * exists (all 64 today are examples), so this harness draws each face from a
 * `DoorRow` fixture through the same `doorCardFromRow` and `doorLines` the
 * route uses. The listing fixture carries an address, a landmark and
 * coordinates on purpose: the card drawn from it must show none of them.
 *
 * `?state=` picks one face for a screenshot at phone width; with none, all
 * are drawn in a column.
 */

const FIXTURE = {
  state: "listing",
  listing_id: "3f0e1c1a-0000-4000-8000-000000000001",
  reference: "VL-7K4MQP",
  is_demo: false,
  title: "Two bedroom flat with a prepaid meter",
  area: "Yaba",
  city: "Lagos",
  state_name: "Lagos",
  property_type: "apartment",
  listing_intent: "rent",
  bedrooms: 2,
  rent_amount_minor: 250000000,
  rent_period: "year",
  caution_deposit_minor: 25000000,
  service_charge_minor: null,
  service_charge_period: null,
  agency_fee_minor: 25000000,
  legal_fee_minor: 25000000,
  agreement_fee_minor: null,
  total_move_in_cost_minor: 325000000,
  sale_price_minor: null,
  rate_minor: null,
  rate_period: null,
  photo_path: "/brand/photos/living-room-day-640.jpg",
  price_share_id: null,
  address: "14 Admiralty Way",
  landmark: "Opposite the filling station",
  latitude: 6.4412,
  longitude: 3.4721,
} as unknown as DoorRow;

export default async function DoorPreview({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  const { state } = await searchParams;
  const t = getDictionary("en");
  const copy = t.frontDoor.door;
  const listing = doorCardFromRow(FIXTURE);
  const example = doorCardFromRow({ ...FIXTURE, is_demo: true });
  const areaLines = shareLines(
    {
      id: "fixture",
      scope: "area_and_type",
      stateCode: "LA",
      lgaCode: null,
      area: "Yaba",
      propertyType: "apartment",
      listingIntent: "rent",
      bedrooms: 2,
      lowMinor: 180000000,
      midMinor: 220000000,
      highMinor: 260000000,
      listingCount: 6,
      oldestAt: "2026-03-02T00:00:00Z",
      newestAt: "2026-09-01T00:00:00Z",
      createdAt: "2026-09-20T00:00:00Z",
    },
    shareCardCopy(t),
    "en",
    "Lagos",
  );

  const faces: Record<string, React.ReactNode> = {
    listing:
      listing?.kind === "listing" ? (
        <DoorListingView card={listing} lines={doorLines(listing, copy, "en")} photo={listing.photoPath} copy={copy} />
      ) : null,
    example: example?.kind === "example" ? <DoorExampleView card={example} copy={copy} /> : null,
    area: <DoorAreaView card={{ kind: "price_area", shareId: "fixture" }} lines={areaLines} copy={copy} />,
    gone: <DoorStateView state="gone" copy={copy} />,
    missing: <DoorStateView state="missing" copy={copy} />,
    unreachable: <DoorStateView state="unreachable" copy={copy} />,
  };
  const shown = state && state in faces ? [state] : Object.keys(faces);

  return (
    <main className="nf-door">
      <div className="nf-sdoor__mark">
        <LogoMark size={40} title="Vallo" />
      </div>
      {shown.map((key) => (
        <div key={key} className="nf-door__stage" data-face={key}>
          {faces[key]}
        </div>
      ))}
    </main>
  );
}
