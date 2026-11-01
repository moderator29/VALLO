import { PersonTier } from "@/app/admin/_components/PersonTier";
import { payeeCaption, type MoneyMapCopy, type PayeeContext } from "@/lib/listings/money-map";
import type { ReactNode } from "react";
import { countOf, formatDate, formatMoney, getDictionary, type Dictionary, type Locale } from "@vallo/i18n";
import { StatusTrack, type TrackStep } from "@/components/app/status/StatusTrack";
import { listingTrack } from "./listing-track";
import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";
import { RemoteImage } from "@/components/ui/RemoteImage";
import type { ListingReviewView } from "@/lib/admin/queries";
import { SALE_STATUS_LABEL, TENURE_LABEL } from "@/lib/listings/pricing";
import { compoundFacts } from "@/lib/listings/compound";
import type { AdminCopy } from "../../_components/copy";
import { Avatar, Badge, DeskHead, Panel, RoleTag, SectionList, type SectionLink } from "../../_review/parts";
import { BackControl } from "@/components/ui/BackControl";
import type { ListingReviewExtras } from "../../_review/contracts";
import { tileMosaic } from "../../_review/map-tiles";
import {
  CHECK_KEYS,
  CONDITION_LABEL,
  FURNISHING_LABEL,
  POWER_BACKUP_LABEL,
  POWER_GRID_LABEL,
  WATER_LABEL,
} from "../ListingCard";
import { placeLine, priceLine } from "../rows";
import { mergeMedia } from "@/lib/listings/media-order";
import { SafeVideo } from "@/components/app/media/SafeVideo";

/**
 * The listing under review, C1D98B3C panel 2, with the flow of
 * GOVERNING-12 panel 2 (photos with the walkthrough, the facts, the price
 * breakdown, the description, then Approve, Ask for more, Reject).
 *
 * Presentational. The listing is `ListingReviewView`; the map pin,
 * amenity names, availability date, example flag and the lister's
 * verification are `getListingReviewExtras` (lib/admin/reads/listings.ts).
 * When that read fails, `extras` is null and those panels say so.
 */

export type ListingReviewProps = {
  listing: ListingReviewView;
  extras: ListingReviewExtras | null;
  reference: string;
  copy: AdminCopy["listings"];
  locale: Locale;
  sqm: string;
  statusLabel: (status: string) => string;
  /**
   * Unused since the desk's second back arrow went (29 September 2026): the
   * console bar's back control is the one way back, and it returns to the
   * filtered queue through history. Kept so callers need not change.
   */
  backHref?: string;
  /** Map tile template and credit, from the product's own provider (dark only). */
  tiles: { dark: string; credit: string };
  /** The action bar, or the closed notice for a decided listing. */
  actions: ReactNode;
  /**
   * Whose money each cost line is, in the product's own words ("Paid to the
   * agent", "Paid to the landlord", "Paid to the state"). The render prints
   * "Agency fee (10%)" with no owner, which reads as the platform's; Vallo
   * charges no platform fee and this screen must not imply one (rule 15).
   */
  keepers: {
    moveIn: Dictionary["moveIn"];
    purchase: Dictionary["purchase"];
    /**
     * V-46: who a rent listing's lines are paid to, by the same rule as the
     * listing page. Without it the rent and caution lines carry no caption
     * rather than naming a landlord no record stands behind.
     */
    payee?: { ctx: PayeeContext; copy: MoneyMapCopy } | null;
  };
  /** Said above everything when the listing may be an example (AR-10). */
  exampleNote?: ReactNode;
  /** V-45: the photograph comparison, drawn under the photographs. */
  photoProvenance?: ReactNode;
  /** V-28: the compound's words, for the reviewer's view of the five answers. */
  compoundCopy?: Dictionary["shape"]["compound"];
  /** Set on a section's own page; absent on the hub. */
  section?: "photos" | "details" | "location" | "costs" | "lister" | "checklist" | "fees" | "matches" | "notes";
  /** Where the hub is, for the back control on a section page. */
  hubHref?: string;
  /** The section rows the hub lists, in order. */
  sectionLinks?: readonly SectionLink[];
  /** Server-built panels the page hands in: the three section bodies, and extras for the hub. */
  sectionSlots?: { fees?: ReactNode; matches?: ReactNode; notes?: ReactNode; hub?: ReactNode };
};

/** The payee of each cost line, keyed as `lib/listings/pricing` keys them. */
export function keeperFor(
  intent: string,
  key: string,
  words: ListingReviewProps["keepers"],
): string | null {
  if (intent === "sale") {
    if (key === "price") return words.purchase.keptBySeller;
    if (key === "agency" || key === "legal") return words.purchase.keptByAgent;
    if (key === "consent" || key === "stamp" || key === "registration") return words.purchase.keptByState;
    return null;
  }
  if (words.payee) return payeeCaption(key, words.payee.ctx, words.payee.copy) ?? null;
  // No payee context: never name a landlord no record stands behind.
  if (key === "rent" || key === "caution") return null;
  if (key === "agency" || key === "legal" || key === "agreement") return words.moveIn.keptByAgent;
  if (key === "service") return words.moveIn.keptByEstate;
  return null;
}

/** Small tiles beside the lead photo and the walkthrough: four columns, two rows. */
const SMALL_TILES = 8;

export function ListingReview(props: ListingReviewProps) {
  const {
    listing,
    extras,
    reference,
    copy,
    locale,
    sqm,
    statusLabel,
    tiles,
    actions,
    keepers,
    exampleNote,
    photoProvenance,
    section,
    hubHref,
    sectionLinks,
    sectionSlots,
  } = props;
  const type = copy.propertyType[listing.propertyType];
  const summary = [
    listing.bedrooms > 0 ? `${listing.bedrooms} bedroom ${type.toLowerCase()}` : type,
    placeLine(listing) || copy.locationMissing,
    priceLine(listing, copy, locale),
  ].join(" \u00b7 ");

  /* ------------------------------------------------- a section, on its own page */
  if (section) {
    const heading = sectionLinks?.find((link) => link.key === section)?.title ?? "Listing";
    return (
      <div className="nf-rv">
        <DeskHead
          lead={<BackControl fallback={hubHref ?? "/admin/listings"} label="Back to the listing" />}
          title={heading}
          trail={<Badge status={listing.status}>{statusLabel(listing.status)}</Badge>}
          sub={`${reference} \u00b7 ${listing.title}`}
        />
        {section === "photos" ? (
          <>
            <MediaStrip listing={listing} copy={copy} />
            {photoProvenance}
          </>
        ) : null}
        {section === "details" ? (
          <>
            <div className="nf-rv-grid2">
        <Panel title="Property details" labelledBy="rv-details">
          <dl className="nf-rv-facts">
            <Fact icon="house" label="Property type" value={type} />
            <Fact icon="bed" label="Bedrooms" value={String(listing.bedrooms)} />
            <Fact icon="bath" label="Bathrooms" value={String(listing.bathrooms)} />
            <Fact icon="bath" label="Toilets" value={num(listing.facts.toilets)} />
            <Fact
              icon="grid"
              label="Size"
              value={listing.facts.sizeSqm === null ? null : `${listing.facts.sizeSqm} ${sqm}`}
            />
            <Fact
              icon="sliders"
              label="Furnishing"
              value={listing.facts.furnished ? FURNISHING_LABEL[listing.facts.furnished] : null}
            />
            <Fact
              icon="building-apartment"
              label="Floor"
              value={
                listing.facts.floor === null
                  ? null
                  : listing.facts.totalFloors === null
                    ? `Floor ${listing.facts.floor}`
                    : `Floor ${listing.facts.floor} of ${listing.facts.totalFloors}`
              }
            />
            <Fact
              icon="verified"
              label="Condition"
              value={
                [
                  listing.facts.condition ? CONDITION_LABEL[listing.facts.condition] : null,
                  listing.facts.yearBuilt === null ? null : `built ${listing.facts.yearBuilt}`,
                ]
                  .filter(Boolean)
                  .join(", ") || null
              }
            />
            <Fact
              icon="parking"
              label="Parking"
              value={
                listing.facts.parkingSpaces === null
                  ? null
                  : countOf(listing.facts.parkingSpaces, "spaces")
              }
            />
            <Fact
              icon="calendar-booking"
              label="Availability"
              value={extras ? (extras.availableFrom ?? null) : "Could not be read"}
            />
            {listing.intent === "sale" ? (
              <Fact
                icon="key"
                label="Title"
                value={[
                  listing.tenure ? TENURE_LABEL[listing.tenure] : "No title stated",
                  listing.saleStatus ? SALE_STATUS_LABEL[listing.saleStatus] : null,
                ]
                  .filter(Boolean)
                  .join(", ")}
              />
            ) : null}
          </dl>
        </Panel>


        <div className="nf-rv-stack">
          {/* V-28 review: the five compound answers, as the renter reads them. */}
          {props.compoundCopy ? (
            <Panel title={props.compoundCopy.title} labelledBy="rv-compound">
              {compoundFacts(listing.compound ?? undefined, props.compoundCopy).length > 0 ? (
                <ul className="nf-rv-utils">
                  {compoundFacts(listing.compound ?? undefined, props.compoundCopy).map((fact) => (
                    <li key={fact.key}>{fact.label}</li>
                  ))}
                </ul>
              ) : (
                <p className="nf-caption text-[var(--nf-content-muted)]">{props.compoundCopy.unanswered}</p>
              )}
            </Panel>
          ) : null}
          <Panel title="Power and water" labelledBy="rv-utilities">
            <ul className="nf-rv-utils">
              <Utility
                icon="bolt"
                label="Electricity"
                value={
                  [
                    listing.utilities.powerGrid ? POWER_GRID_LABEL[listing.utilities.powerGrid] : null,
                    listing.utilities.prepaidMeter === null
                      ? null
                      : listing.utilities.prepaidMeter
                        ? "prepaid meter"
                        : "not prepaid",
                  ]
                    .filter(Boolean)
                    .join(", ") || null
                }
              />
              <Utility
                icon="bolt"
                label="Backup power"
                value={
                  listing.utilities.powerBackup
                    ? [
                        POWER_BACKUP_LABEL[listing.utilities.powerBackup],
                        listing.utilities.powerBackupHours === null
                          ? null
                          : `${listing.utilities.powerBackupHours} hrs`,
                      ]
                        .filter(Boolean)
                        .join(" ")
                    : null
                }
              />
              <Utility
                icon="droplet"
                label="Water"
                value={
                  listing.utilities.waterSupply ? WATER_LABEL[listing.utilities.waterSupply] : null
                }
              />
            </ul>
          </Panel>

          <Panel title="Amenities" labelledBy="rv-amenities">
            {extras ? (
              extras.amenities.length > 0 ? (
                <ul className="nf-rv-ticks">
                  {extras.amenities.map((amenity) => (
                    <li key={amenity}>
                      <UiIcon name="verified" size={16} />
                      {amenity}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="nf-rv-msg">The lister chose none.</p>
              )
            ) : (
              <>
                <p className="nf-rv-msg" style={{ marginBottom: "var(--nf-space-xs)" }}>
                  {countOf(listing.amenityCount, "amenitiesChosen")}
                </p>
                <p className="nf-rv-panel__note">Their names could not be read just now.</p>
              </>
            )}
          </Panel>
        </div>

            </div>
      {listing.description ? (
        <Panel title="Description" labelledBy="rv-description">
          <p className="nf-rv-msg" style={{ whiteSpace: "pre-wrap", color: "var(--nf-content-primary)" }}>
            {listing.description}
          </p>
        </Panel>
      ) : null}


          </>
        ) : null}
        {section === "location" ? (
          <div className="nf-rv-grid2">
        <Panel title="Location" labelledBy="rv-location">
          <LocationMap
            place={placeLine(listing) || copy.locationMissing}
            latitude={extras?.latitude ?? null}
            longitude={extras?.longitude ?? null}
            tiles={tiles}
          />
          {listing.address ? (
            <p className="nf-rv-msg" style={{ marginTop: "var(--nf-space-xs)" }}>
              {listing.address}
            </p>
          ) : null}
          {extras && (extras.latitude === null || extras.longitude === null) ? (
            <p className="nf-rv-panel__note" style={{ marginTop: "var(--nf-space-2xs)" }}>
              The lister did not drop a pin, so there is no point to show.
            </p>
          ) : null}
        </Panel>


          </div>
        ) : null}
        {section === "costs" ? (
        <Panel title={listing.intent === "sale" ? "Purchase costs" : "Move-in costs"} labelledBy="rv-costs">
          <MoneyBlock listing={listing} locale={locale} keepers={keepers} />
        </Panel>

        ) : null}
        {section === "lister" ? (
          <>
        <Panel title="Lister verification" labelledBy="rv-lister">
          <ListerBlock listing={listing} extras={extras} />
        </Panel>


        <Panel title="Reason for review" labelledBy="rv-reason-panel">
          <ReasonBlock listing={listing} copy={copy} locale={locale} />
        </Panel>

          </>
        ) : null}
        {section === "checklist" ? (
          <>
      <Panel title={copy.checklistTitle} labelledBy="rv-checklist">
        <ul className="nf-rv-ticks">
          {listing.checks.map((check) => {
            const key = CHECK_KEYS[check.label];
            return (
              <li key={check.label} style={{ alignItems: "flex-start" }}>
                <span
                  style={{ color: check.pass ? "var(--nf-state-success)" : "var(--nf-state-error)", display: "flex" }}
                  aria-hidden="true"
                >
                  <UiIcon name={check.pass ? "verified" : "close"} size={16} />
                </span>
                <span>
                  <span style={{ display: "block", fontWeight: 600 }}>
                    {key ? copy.checks[key] : check.label}
                    <span className="sr-only">{check.pass ? ", passes" : ", needs a look"}</span>
                  </span>
                  <span className="nf-rv-table__muted" style={{ overflowWrap: "anywhere" }}>
                    {check.detail}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
        {listing.access.answered > 0 ? (
          <p className="nf-rv-panel__note" style={{ marginTop: "var(--nf-space-sm)" }}>
            Gate and estate: {[listing.access.estateName, `${listing.access.answered} of 4 access details given`].filter(Boolean).join(", ")}.
            The details themselves stay with the lister.
          </p>
        ) : null}
      </Panel>

          </>
        ) : null}
        {section === "fees" || section === "matches" || section === "notes" ? sectionSlots?.[section] ?? null : null}
      </div>
    );
  }

  /* ------------------------------------------------- the hub: the decision, then the sections */
  return (
    <div className="nf-rv">
      <DeskHead
        title="Listing under review"
        trail={<Badge status={listing.status}>{statusLabel(listing.status)}</Badge>}
      />

      <div className="nf-rv-lead">
        <p className="nf-rv-idline">{reference}</p>
        <p className="nf-rv-summary">{summary}</p>
        <p className="nf-rv-panel__note">{listing.title}</p>
      </div>

      {exampleNote}

      {actions}

      {sectionLinks ? <SectionList items={sectionLinks} label="Parts of this listing" /> : null}

      {sectionSlots?.hub ?? null}
    </div>
  );
}

function num(value: number | null): string | null {
  return value === null ? null : String(value);
}

export function Fact({ icon, label, value }: { icon: UiIconName; label: string; value: string | null }) {
  return (
    <div>
      {/* The glyph is inside the dt: a group div may hold only dt and dd. */}
      <dt>
        <UiIcon name={icon} size={16} />
        {label}
      </dt>
      <dd>{value ?? <span style={{ color: "var(--nf-content-muted)" }}>Not given</span>}</dd>
    </div>
  );
}

function Utility({ icon, label, value }: { icon: UiIconName; label: string; value: string | null }) {
  return (
    <li>
      <span className="nf-rv-plate" aria-hidden="true">
        <UiIcon name={icon} size={16} />
      </span>
      <span>
        <span className="nf-rv-utils__label">{label}</span>
        <span className="nf-rv-utils__value">
          {value ?? <span style={{ color: "var(--nf-content-muted)" }}>Not answered</span>}
        </span>
      </span>
    </li>
  );
}

function MediaStrip({ listing, copy }: { listing: ListingReviewView; copy: AdminCopy["listings"] }) {
  /* ONE ROW, IN THE LISTER'S ORDER (founder, 13 October): the photos and the
     videos as the renter will swipe through them, cover first, rather than
     the photos with the videos set beside them. Every video plays here; a
     reviewer approving a video has to be able to watch it. */
  const row = mergeMedia(
    listing.photos.map((src, position) => ({ src, position })),
    listing.videos.map((video, index) => ({ ...video, position: video.position ?? index + 1 })),
  );
  const videoCount = listing.videos.length;
  let photoNumber = 0;
  let videoNumber = 0;
  let smallPhotos = 0;
  let hidden = 0;

  if (row.length === 0) {
    return (
      <Panel>
        <p className="nf-rv-msg">No photos or videos were uploaded with this listing.</p>
      </Panel>
    );
  }

  return (
    <div className="nf-panel nf-rv-panel" style={{ padding: "var(--nf-space-sm)" }}>
      {/* Focusable: on a phone the strip scrolls sideways, and a keyboard must
          be able to scroll it (axe scrollable-region-focusable, C1 sweep). */}
      <ul className="nf-rv-media" role="list" aria-label="Photos and videos" tabIndex={0}>
        {row.map((entry, index) => {
          if (entry.kind === "video") {
            videoNumber += 1;
            const video = entry.item;
            return (
              <li key={`video-${index}`} className="nf-rv-media__lead" data-testid="rv-video">
                {video.url ? (
                  /* A walkthrough of an empty flat carries no speech, so there
                     is no track to caption. preload none: a reviewer's line is
                     not spent on a video nobody pressed play on. */
                  <SafeVideo
                    src={video.url}
                    poster={video.posterUrl ?? undefined}
                    controls
                    preload="none"
                    playsInline
                    aria-label={`Video ${videoNumber} of ${videoCount}${video.durationSeconds ? `, ${video.durationSeconds} seconds` : ""}`}
                  />
                ) : (
                  <div
                    className="nf-rv-media__video-off"
                    style={video.posterUrl ? { backgroundImage: `url(${video.posterUrl})` } : undefined}
                  >
                    <span className="nf-rv-media__play" aria-hidden="true">
                      <UiIcon name="arrow-right" size={20} />
                    </span>
                    <span className="nf-rv-media__caption">This video could not be opened. The listing has it.</span>
                  </div>
                )}
              </li>
            );
          }
          photoNumber += 1;
          const alt = copy.photoAlt.replace("{title}", listing.title).replace("{number}", String(photoNumber));
          if (index === 0) {
            return (
              <li key={`photo-${index}`} className="nf-rv-media__lead">
                <RemoteImage src={entry.item.src} alt={alt} width={320} height={200} sizes="(min-width: 900px) 22vw, 50vw" />
              </li>
            );
          }
          smallPhotos += 1;
          if (smallPhotos > SMALL_TILES) {
            hidden += 1;
            return null;
          }
          return (
            /* Keyed by place as well as address, so two photographs that share
               an address cannot drop one another from the strip. */
            <li key={`photo-${index}`}>
              <RemoteImage src={entry.item.src} alt={alt} width={160} height={128} sizes="120px" loading="lazy" />
            </li>
          );
        })}
        {hidden > 0 ? (
          <li className="nf-rv-media__more" aria-label={`${hidden} more not shown`}>
            +{hidden}
          </li>
        ) : null}
      </ul>
    </div>
  );
}

function LocationMap({
  place,
  latitude,
  longitude,
  tiles,
}: {
  place: string;
  latitude: number | null;
  longitude: number | null;
  tiles: { dark: string; credit: string };
}) {
  const dark = latitude !== null && longitude !== null ? tileMosaic(latitude, longitude, tiles.dark) : null;

  return (
    <div className="nf-rv-map">
      {dark ? (
        <>
          {[{ mosaic: dark, cls: "nf-rv-map__tiles" }].map(({ mosaic, cls }) => (
            <div
              key={cls}
              className={cls}
              aria-hidden="true"
              style={{ left: `calc(50% - ${mosaic.pointX}px)`, top: `calc(50% - ${mosaic.pointY}px)` }}
            >
              {/* Backgrounds, not images: a tile the provider cannot serve
                  leaves the panel's own ground rather than a broken-image mark. */}
              {mosaic.urls.map((url) => (
                <span key={url} style={{ backgroundImage: `url(${url})` }} />
              ))}
            </div>
          ))}
          <span className="nf-rv-map__pin" aria-hidden="true">
            <UiIcon name="location" size={28} filled />
          </span>
          <span className="nf-rv-map__credit">{tiles.credit}</span>
        </>
      ) : (
        <span className="nf-rv-map__pin" aria-hidden="true" style={{ opacity: 0.5 }}>
          <UiIcon name="location" size={28} />
        </span>
      )}
      <p className="nf-rv-map__place">{place}</p>
    </div>
  );
}

export function MoneyBlock({
  listing,
  locale,
  keepers,
}: {
  listing: ListingReviewView;
  locale: Locale;
  keepers: ListingReviewProps["keepers"];
}) {
  const block = listing.intent === "sale" ? listing.purchase : listing.moveIn;
  if (!block) {
    /* The note is a paragraph, which a `dl` cannot hold: it sits under the
       list in a plain wrapper, with no gap, exactly where it was in the grid. */
    return (
      <div>
        <dl className="nf-rv-money">
          <div className="nf-rv-money__total">
            <dt>{listing.intent === "sale" ? "Asking price" : "Headline price"}</dt>
            <dd>{formatMoney(listing.priceMinor, locale)}</dd>
          </div>
        </dl>
        <p className="nf-rv-panel__note">The lister stated no other costs.</p>
      </div>
    );
  }
  return (
    <div>
      <dl className="nf-rv-money">
        {block.parts.map((part) => {
          const keeper = part.minor > 0 ? keeperFor(listing.intent, part.key, keepers) : null;
          return (
            <div key={part.key}>
              <dt>
                {part.label}
                {keeper ? <span className="nf-rv-keeper">{keeper}</span> : null}
              </dt>
              <dd>{formatMoney(part.minor, locale)}</dd>
            </div>
          );
        })}
        <div className="nf-rv-money__total">
          <dt>{listing.intent === "sale" ? "Total to buy" : "Total to move in"}</dt>
          <dd>{formatMoney(block.totalMinor, locale)}</dd>
        </div>
      </dl>
      <p className="nf-rv-panel__note">
        {block.totalStated ? "Total as the lister stated it." : "Total summed from the parts."}
      </p>
    </div>
  );
}

const RUNG_WORD: Record<string, string> = {
  identity: "ID",
  address: "Address",
  payout: "Bank",
  in_person: "Met in person",
};

const ROLE_WORD: Record<string, string> = { owner: "Owner", agent: "Agent", firm: "Firm" };

function ListerBlock({
  listing,
  extras,
}: {
  listing: ListingReviewView;
  extras: ListingReviewExtras | null;
}) {
  const lister = extras?.lister ?? null;
  const name = lister?.name ?? listing.agentName ?? "Not recorded";
  return (
    <div style={{ display: "grid", gap: "var(--nf-space-sm)" }}>
      <div className="nf-rv-person">
        <Avatar name={name} src={lister?.avatarUrl ?? null} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{ margin: 0, fontWeight: 600, color: "var(--nf-content-primary)" }}>
            {name}
            <PersonTier tier={lister?.badge ?? null} />
          </p>
          {lister?.role ? <RoleTag>{ROLE_WORD[lister.role]}</RoleTag> : null}
        </div>
        {lister ? (
          <div style={{ textAlign: "right" }}>
            <Badge tone={lister.verified ? "success" : "warning"}>
              {lister.verified ? "Verified" : "Not verified"}
            </Badge>
            <p className="nf-rv-panel__note" style={{ marginTop: "var(--nf-space-2xs)" }}>
              Tier {lister.tier}
              {lister.rungs
                .filter((rung) => rung.status === "passed")
                .map((rung) => ` · ${RUNG_WORD[rung.kind] ?? rung.kind} verified`)
                .join("")}
            </p>
          </div>
        ) : null}
      </div>
      {!lister ? (
        <p className="nf-rv-panel__note">The lister&apos;s verification could not be read just now.</p>
      ) : null}
    </div>
  );
}

const STATUS_REASON: Record<string, string> = {
  SUBMITTED: "Submitted and waiting for its first decision.",
  UNDER_REVIEW: "Picked up for review.",
  MORE_INFO_REQUIRED: "Sent back for changes. It is with the lister until they resubmit.",
  APPROVED: "Passed review. It goes into search only when somebody publishes it.",
  PUBLISHED: "Live in search.",
  REJECTED: "Did not pass review. The lister can edit it and submit again.",
  SUSPENDED: "Taken out of search.",
};

/**
 * The status track (reference 7118): only for a listing whose status sits on
 * the approval flow, only with the times the record keeps (`listing-track.ts`).
 */
function ListingFlow({ listing, locale }: { listing: ListingReviewView; locale: Locale }) {
  const model = listingTrack({
    status: listing.status,
    submittedAt: listing.submittedAt,
    reviewedAt: listing.reviewedAt,
    publishedAt: listing.publishedAt,
  });
  if (!model) return null;
  const w = getDictionary(locale).experienceAdmin.listingTrack;
  const day = (iso: string | null) =>
    iso
      ? formatDate(new Date(iso), locale, { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" })
      : null;
  const label: Record<string, string> = { submitted: w.submitted, review: w.review, decision: w.decision, live: w.live };
  const steps: TrackStep[] = model.map((step) => ({
    key: step.key,
    label: label[step.key] ?? step.key,
    when: day(step.at),
    note:
      step.key === "review" && listing.status === "MORE_INFO_REQUIRED" && step.state === "current"
        ? w.sentBack
        : step.key === "live" && step.state === "current"
          ? w.notYetLive
          : step.key === "decision" && step.state === "failed"
            ? w.rejected
            : null,
    state: step.state,
  }));
  return <StatusTrack steps={steps} label={w.label} title={w.title} testId="listing-flow" />;
}

function ReasonBlock({
  listing,
  copy,
  locale,
}: {
  listing: ListingReviewView;
  copy: AdminCopy["listings"];
  locale: Locale;
}) {
  const failing = listing.checks.filter((check) => !check.pass);
  return (
    <div style={{ display: "grid", gap: "var(--nf-space-xs)" }}>
      <ListingFlow listing={listing} locale={locale} />
      <p className="nf-rv-msg" style={{ color: "var(--nf-brand-secondary)" }}>
        {STATUS_REASON[listing.status] ?? listing.status}
      </p>
      {failing.length > 0 ? (
        <ul className="nf-rv-ticks">
          {failing.map((check) => {
            const key = CHECK_KEYS[check.label];
            return (
              <li key={check.label}>
                <span style={{ color: "var(--nf-state-error)", display: "flex" }} aria-hidden="true">
                  <UiIcon name="close" size={16} />
                </span>
                {key ? copy.checks[key] : check.label}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="nf-rv-msg">Every line of the admission checklist passes.</p>
      )}
      {listing.reviewNotes ? (
        <p className="nf-rv-panel__note">Last note to the lister: {listing.reviewNotes}</p>
      ) : null}
    </div>
  );
}
