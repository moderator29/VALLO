import { countOf, formatMoney, type Locale } from "@vallo/i18n/core";
import type { ListingReviewView } from "@/lib/admin/queries";
import { CHECK_LABEL } from "@/lib/admin/listing-checks";
import { ListingDecision } from "../_components/AdminActions";
import { fill, type AdminCommon, type AdminCopy } from "../_components/copy";
import type { AdminUi } from "../_components/ui";
import { PERIOD_SUFFIX, SALE_STATUS_LABEL, TENURE_LABEL } from "@/lib/listings/pricing";
import { RemoteImage } from "@/components/ui/RemoteImage";
import {
  CONDITION_CHOICES,
  FURNISHING_CHOICES,
  POWER_BACKUP_CHOICES,
  POWER_GRID_CHOICES,
  WATER_SUPPLY_CHOICES,
} from "@/lib/agent/listings-model";

/**
 * The console says what the wizard said.
 *
 * Every label below is read from the wizard's own choice list rather than
 * retyped here, so a reviewer reads the exact words the lister was shown. A
 * second copy of "Band A feeder" in this file is a second copy that can drift,
 * and a reviewer judging a claim against different wording is the one thing
 * this screen cannot afford.
 */
function labelsOf<T extends string>(
  choices: readonly { value: T; label: string }[],
): Record<T, string> {
  return Object.fromEntries(choices.map((choice) => [choice.value, choice.label])) as Record<
    T,
    string
  >;
}

export const POWER_GRID_LABEL = labelsOf(POWER_GRID_CHOICES);
export const POWER_BACKUP_LABEL = labelsOf(POWER_BACKUP_CHOICES);
export const WATER_LABEL = labelsOf(WATER_SUPPLY_CHOICES);
export const CONDITION_LABEL = labelsOf(CONDITION_CHOICES);
export const FURNISHING_LABEL = labelsOf(FURNISHING_CHOICES);

/**
 * The admission checklist, matched to its translation.
 *
 * `lib/admin/queries` builds each check as a label and a detail with no stable
 * key on it, so the only thing available to match on is the English label it
 * ships. That is what this table does, and an unmatched label falls through to
 * the English it came with rather than rendering blank. Giving `QualityCheck` a
 * key would let this table go: it belongs on the queries module, which is
 * outside this surface's scope.
 */
export const CHECK_KEYS: Record<string, keyof AdminCopy["listings"]["checks"]> = {
  [CHECK_LABEL.photoCount]: "photoCount",
  [CHECK_LABEL.cover]: "cover",
  /* The title line is the submit gate's length rule now, not title case,
     which nobody asked of the lister (lib/admin/listing-checks.ts). */
  [CHECK_LABEL.titleLength]: "titleLength",
  [CHECK_LABEL.place]: "place",
  [CHECK_LABEL.price]: "price",
  [CHECK_LABEL.rooms]: "rooms",
  [CHECK_LABEL.amenities]: "amenities",
  [CHECK_LABEL.description]: "description",
  [CHECK_LABEL.clean]: "clean",
};

/**
 * Listing review: the last gate before a property reaches guests.
 *
 * Two steps on purpose. Approve says the submission passes the admission
 * checklist; publish is the separate act that puts it into public search, where
 * the listings RLS policy makes PUBLISHED rows readable by anyone. Nothing goes
 * live by accident, and the reviewer sees the photos and the quality checklist
 * from HYBRID_INVENTORY section 5 before either step.
 *
 * EXPORTED FOR THE PREVIEW HARNESS AND FOR NOTHING ELSE. This route gates on
 * `requireAdmin`, so the card cannot be photographed on a sandbox with no
 * session, and the existing admin preview draws the queue FRAME from fixture
 * rows rather than this card. Without a door in, the reviewer's console is the
 * one surface in this track with no proof of what it looks like, which is how
 * the utilities came to be missing from it for weeks in the first place.
 */
export function ListingCard({
  listing,
  copy,
  common,
  ui,
  locale,
  sqm,
}: {
  listing: ListingReviewView;
  copy: AdminCopy["listings"];
  common: AdminCommon;
  ui: AdminUi;
  locale: Locale;
  /** `m²`, from the catalogue's dictionary, so the console prints the unit the
      product prints rather than a second spelling of it. */
  sqm: string;
}) {
  const decidable = listing.status !== "PUBLISHED" && listing.status !== "REJECTED";
  const failing = listing.checks.filter((check) => !check.pass).length;
  const f = copy.fields;

  return (
    <li className="nf-panel nf-panel--card nf-admin-card p-md sm:p-lg">
      <div className="flex flex-wrap items-center gap-xs">
        <ui.StatusChip status={listing.status} />
        <ui.StatusChip label={copy.propertyType[listing.propertyType]} tone="neutral" />
        {failing > 0 && (
          <ui.StatusChip
            label={
              failing === 1
                ? copy.checklistLineOne
                : fill(copy.checklistLines, { count: failing })
            }
            tone="warning"
          />
        )}
        <span className="text-[length:var(--nf-text-overline)] text-[var(--nf-content-muted)]">
          {fill(copy.submittedWhen, { when: ui.when(listing.submittedAt) })}
        </span>
      </div>

      <h3 className="mt-xs text-[length:var(--nf-text-body-lg)] font-semibold text-[var(--nf-content-primary)]">
        {listing.title}
      </h3>
      {/* THE CODE, ONCE IT EXISTS. A listing in review has none: the database
          issues it at publish, so before that there is genuinely nothing to
          print and the row falls back to the id-derived short reference the
          queue has always used. */}
      {listing.reference && (
        <p className="mt-3xs text-[length:var(--nf-text-overline)] text-[var(--nf-content-muted)]">
          <span className="nf-numeric tracking-[0.08em]">{listing.reference}</span>
        </p>
      )}
      <p className="mt-3xs text-[length:var(--nf-text-caption)] text-[var(--nf-content-secondary)]">
        {[listing.area, listing.city, listing.stateCode].filter(Boolean).join(", ") ||
          copy.locationMissing}
        {" · "}
        {formatMoney(listing.priceMinor, locale)}{" "}
        {/* Six possible units now, not two. The dictionary carries the yearly
            and nightly wordings it was written for; the four the rent-and-sale
            model added read in English rather than being forced into one of
            those two, because printing "per night" beside an asking price is
            worse than printing an untranslated phrase. */}
        {listing.pricePeriod === "year"
          ? copy.perYear
          : listing.pricePeriod === "night"
            ? copy.perNight
            : PERIOD_SUFFIX[listing.pricePeriod]}
        {listing.intent === "sale" && listing.tenure ? (
          <>
            {" · "}
            {TENURE_LABEL[listing.tenure]}
          </>
        ) : null}
      </p>

      {/*
        What a tenant actually has to find, itemised.

        The reviewer approving a listing is the last person who can catch a
        4.5m yearly rent that quietly costs seven million at the door, and
        until now this screen showed them one figure and no breakdown at all.
      */}
      {listing.moveIn && (
        <div className="mt-xs rounded-[var(--nf-radius-md)] border border-[var(--nf-border-subtle)] p-sm">
          <p className="text-[length:var(--nf-text-overline)] font-semibold text-[var(--nf-content-primary)]">
            To move in: {formatMoney(listing.moveIn.totalMinor, locale)}
            <span className="ml-2xs font-normal text-[var(--nf-content-muted)]">
              {listing.moveIn.totalStated ? "as stated" : "summed from the parts"}
            </span>
          </p>
          <ul className="mt-2xs space-y-3xs">
            {listing.moveIn.parts.map((part) => (
              <li
                key={part.key}
                className="flex justify-between gap-sm text-[length:var(--nf-text-overline)] text-[var(--nf-content-secondary)]"
              >
                <span>{part.label}</span>
                <span className="nf-numeric">{formatMoney(part.minor, locale)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/*
        WHAT A BUYER ACTUALLY PAYS, itemised.

        The tenancy breakdown above has been on this card for weeks and the
        sale side had an asking price and nothing else, which is the same lie
        in a much bigger currency: agency and legal are conventionally five per
        cent each, and Governor's consent, stamp duty and registration run to
        several per cent more of the value of the land. The reviewer is the
        last person who can catch an attractive asking price with twenty
        million naira hiding behind it.
      */}
      {listing.purchase && (
        <div className="mt-xs rounded-[var(--nf-radius-md)] border border-[var(--nf-border-subtle)] p-sm">
          <p className="text-[length:var(--nf-text-overline)] font-semibold text-[var(--nf-content-primary)]">
            To buy: {formatMoney(listing.purchase.totalMinor, locale)}
            <span className="ml-2xs font-normal text-[var(--nf-content-muted)]">
              {listing.purchase.totalStated ? "as stated" : "summed from the parts"}
            </span>
          </p>
          <ul className="mt-2xs space-y-3xs">
            {listing.purchase.parts.map((part) => (
              <li
                key={part.key}
                className="flex justify-between gap-sm text-[length:var(--nf-text-overline)] text-[var(--nf-content-secondary)]"
              >
                <span>{part.label}</span>
                <span className="nf-numeric">{formatMoney(part.minor, locale)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* THE PHOTO STRIP PADS THE LIST AND NOT THE SCROLLPORT, and that is the
          whole of the change below. `.nf-scroll-x` gives every direct child
          `scroll-snap-align: start`, and a snap position aligns that child's
          start edge to the SCROLLPORT's start, ignoring the port's own padding
          unless `scroll-padding` says otherwise. With `px-2xs` on the scrolling
          div and one `<ul>` inside it, the only snap position was `scrollLeft`
          = the padding, so the strip ate its own inset the instant it settled:
          measured 4 against `padding-left` 4px on a production page. Padding
          the LIST puts the inset inside the scrolled content, where a snap
          cannot reach it, and it holds at both ends rather than only the left.
          Measured 0 after. Same shape as the three other markup-padded rails in
          the tree (`RecentStrip`, `/rent`), all of which
          measured 0 because they already do it this way. */}
      {listing.photos.length > 0 && (
        <div className="nf-scroll-x -mx-2xs mt-sm">
          <ul className="flex w-max gap-xs px-2xs">
            {listing.photos.map((photo, index) => (
              <li key={photo}>
                {/* These come from `photoUrl` in `lib/admin/queries.ts`,
                    which returns the bucket's PUBLIC url, not a signed one:
                    the note that used to sit here said a signed URL cannot go
                    through the optimiser, which is true and was about a
                    different code path. A reviewer opening a listing was
                    pulling every full size upload on it down a strip of 128px
                    thumbnails. `RemoteImage` keeps the signed case safe by
                    falling back rather than throwing. */}
                <RemoteImage
                  src={photo}
                  alt={fill(copy.photoAlt, { title: listing.title, number: index + 1 })}
                  loading="lazy"
                  width={128}
                  height={96}
                  sizes="128px"
                  className="h-24 w-32 rounded-[var(--nf-radius-md)] border border-[var(--nf-border-subtle)] object-cover"
                />
              </li>
            ))}
          </ul>
        </div>
      )}

      {/*
        THE WALKTHROUGH, WHICH NOBODY HAS EVER BEEN ABLE TO WATCH.

        Every layer behind this was finished weeks ago and the two a human
        touches were not: the bucket, the table with its three-per-listing
        ceiling, the Zod schemas, the actions, the repository join, the signed
        URL batching and the CSP entry all existed with zero callers. This is
        the reviewer's half. `controls` and `preload="none"` because a queue of
        thirty listings must not pull thirty videos down a reviewer's line.
      */}
      {listing.videos.length > 0 && (
        <div className="mt-sm">
          <p className="text-[length:var(--nf-text-overline)] font-semibold text-[var(--nf-content-primary)]">
            {countOf(listing.videos.length, "walkthroughVideos")}
          </p>
          <ul className="mt-2xs flex flex-wrap gap-xs">
            {listing.videos.map((video, index) => (
              <li key={video.url ?? `video-${index}`}>
                {video.url ? (
                  /* A walkthrough of an empty flat carries no speech, so
                     there is no track to caption. The reviewer is here to see
                     the rooms. */
                  <video
                    src={video.url}
                    poster={video.posterUrl ?? undefined}
                    controls
                    preload="none"
                    playsInline
                    className="h-40 w-64 rounded-[var(--nf-radius-md)] border border-[var(--nf-border-subtle)] object-cover"
                  />
                ) : (
                  <p className="text-[length:var(--nf-text-overline)] text-[var(--nf-content-muted)]">
                    This walkthrough could not be opened. The listing has one.
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/*
        LIGHT AND WATER, WHICH IS THE PART THAT DECIDES WHETHER ANYBODY WANTS
        IT.

        The lister answers five questions about power and water on a whole step
        of the wizard, and the reviewer could not see one of them: the read
        named neither `power_grid` nor `water_supply`. So a claim of "Band A,
        eighteen hours of generator" was being approved unread. Unanswered
        prints as unanswered and never as good news, which is the same rule the
        submit gate already holds to.
      */}
      <ui.DetailSection title="Light and water">
        <ui.DetailRow
          label="Grid supply"
          value={listing.utilities.powerGrid ? POWER_GRID_LABEL[listing.utilities.powerGrid] : null}
        />
        <ui.DetailRow
          label="Backup"
          value={
            listing.utilities.powerBackup
              ? [
                  POWER_BACKUP_LABEL[listing.utilities.powerBackup],
                  listing.utilities.powerBackupHours === null
                    ? null
                    : `${listing.utilities.powerBackupHours} hours a day`,
                ]
                  .filter(Boolean)
                  .join(" · ")
              : null
          }
        />
        <ui.DetailRow
          label="Water"
          value={
            listing.utilities.waterSupply ? WATER_LABEL[listing.utilities.waterSupply] : null
          }
        />
        <ui.DetailRow
          label="Meter"
          value={
            listing.utilities.prepaidMeter === null
              ? null
              : listing.utilities.prepaidMeter
                ? "Prepaid"
                : "Not prepaid"
          }
        />
      </ui.DetailSection>

      {/*
        THE PHYSICAL FACTS. `sizeSqm` is the whole specification of a plot of
        land, so a land submission could not be judged at all without it.
      */}
      <ui.DetailSection title="The property itself">
        {/* `m²` from the dictionary, which is where the catalogue's card and
            the listing page already read it, so the console and the product
            print the same unit. */}
        <ui.DetailRow
          label="Size"
          value={
            listing.facts.sizeSqm === null
              ? null
              : `${listing.facts.sizeSqm} ${sqm}`
          }
        />
        <ui.DetailRow
          label="Toilets"
          value={listing.facts.toilets === null ? null : String(listing.facts.toilets)}
        />
        <ui.DetailRow
          label="Parking"
          value={
            listing.facts.parkingSpaces === null
              ? null
              : countOf(listing.facts.parkingSpaces, "spaces")
          }
        />
        <ui.DetailRow
          label="Floor"
          value={
            listing.facts.floor === null
              ? null
              : listing.facts.totalFloors === null
                ? `Floor ${listing.facts.floor}`
                : `Floor ${listing.facts.floor} of ${listing.facts.totalFloors}`
          }
        />
        <ui.DetailRow
          label="Condition"
          value={
            [
              listing.facts.condition ? CONDITION_LABEL[listing.facts.condition] : null,
              listing.facts.yearBuilt === null ? null : `built ${listing.facts.yearBuilt}`,
            ]
              .filter(Boolean)
              .join(" · ") || null
          }
        />
        <ui.DetailRow
          label="Furnishing"
          value={listing.facts.furnished ? FURNISHING_LABEL[listing.facts.furnished] : null}
        />
        {/* THE GATE, COUNTED AND NOT QUOTED. The security desk number and the
            access code are the keys to somebody's home. A reviewer needs to
            know the block was answered, not what it says. */}
        <ui.DetailRow
          label="Gate and estate"
          value={
            listing.access.answered === 0
              ? null
              : [
                  listing.access.estateName,
                  `${listing.access.answered} of 4 access details given`,
                ]
                  .filter(Boolean)
                  .join(" · ")
          }
        />
      </ui.DetailSection>

      <ui.DetailSection title={copy.checklistTitle}>
        <ul className="mt-2xs">
          {listing.checks.map((check) => {
            const key = CHECK_KEYS[check.label];
            return (
              <ui.CheckRow
                key={check.label}
                label={key ? copy.checks[key] : check.label}
                pass={check.pass}
                detail={check.detail}
              />
            );
          })}
        </ul>
      </ui.DetailSection>

      <ui.DetailSection title={copy.submission}>
        <ui.DetailRow label={f.agent} value={listing.agentName} />
        {/* Guests and beds are no longer columns, so the dictionary's four-slot
            capacity sentence cannot be filled. Two facts stated plainly beat
            four with two of them invented. */}
        <ui.DetailRow
          label={f.capacity}
          value={`${listing.bedrooms} bedrooms, ${listing.bathrooms} bathrooms`}
        />
        {listing.intent === "sale" && (
          <ui.DetailRow
            label="Sale"
            value={[
              listing.tenure ? TENURE_LABEL[listing.tenure] : "No title stated",
              listing.saleStatus ? SALE_STATUS_LABEL[listing.saleStatus] : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          />
        )}
        <ui.DetailRow label={f.address} value={listing.address} />
        <ui.DetailRow
          label={f.amenities}
          value={fill(copy.amenitiesSelected, { count: listing.amenityCount })}
        />
        <ui.DetailRow label={f.description} value={listing.description} />
        {listing.reviewNotes && <ui.DetailRow label={f.lastNote} value={listing.reviewNotes} />}
        {listing.reviewedAt && (
          <ui.DetailRow label={f.lastReviewed} value={ui.when(listing.reviewedAt)} />
        )}
      </ui.DetailSection>

      {decidable ? (
        <ListingDecision
          listingId={listing.id}
          status={listing.status}
          title={listing.title}
          copy={copy}
          common={common}
        />
      ) : (
        <p className="mt-md text-[length:var(--nf-text-overline)] text-[var(--nf-content-muted)]">
          {listing.status === "PUBLISHED" ? copy.liveInSearch : copy.closed} {common.inAuditLog}
        </p>
      )}
    </li>
  );
}
