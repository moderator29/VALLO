"use client";

import { DuplicateListing } from "./DuplicateListing";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { type Dictionary, type Locale, formatMoneyGlance } from "@vallo/i18n/core";
import { fill } from "../_copy";
import {
  deleteListing,
  submitListing,
  unpublishListing,
} from "@/lib/agent/listings-actions";
import {
  MIN_DESCRIPTION_WORDS,
  MIN_PHOTOS,
  MIN_TITLE_LENGTH,
  type ListingStatus,
} from "@/lib/agent/listings-model";
import type { ListingSummary } from "@/lib/agent/listings-queries";
import { createUndoWindow, type UndoWindow } from "@/lib/ui/undo-window";
import { withDone } from "@/lib/ui/success-moments";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { Icon3D } from "@/components/ui/Icon3D";
import { RemoteImage } from "@/components/ui/RemoteImage";
import { Button, ButtonLink } from "@/components/ui/Button";
import { ShareToFeedButton } from "@/components/social/share/ShareToFeedButton";
import { Sheet } from "@/components/ui/Sheet";
import { StatusPill, toneForStatus } from "@/components/ui/StatusPill";
import { LISTING_STATUS_GLYPH, glyphSrc } from "@/design-system/icons/glyphs";
import { CloseListingSheet } from "./CloseListingSheet";
import { OwnerAskStrip } from "./OwnerAskStrip";
import { ListingMeter } from "@/components/agent/ListingMeter";
import { BulkBar } from "./BulkBar";
import { planBulk, rangeToggle } from "./bulk";
import { livePayoffFor, liveSeenKey } from "@/lib/agent/lister-live";
import { canPromote, promotionHref } from "@/lib/promotion/links";
import { markSeen, seenOnce } from "@/lib/ui/seen-once";
import { feedback } from "@/lib/ui/feedback";
import { motionQuiet } from "@/lib/motion/gate";
import "@/app/css/lister-live.css";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";
import { tapFailedOffline } from "@/lib/offline/tap-failed";
import { banner } from "@/lib/ui/toast";
import { listingStatsEn } from "@vallo/i18n/en/listing-stats";
import { agentStatItems, type StatsFigures } from "@/lib/listings/stats/format";
import { ListingStatsRow } from "@/components/app/listing/ListingStatsRow";

/**
 * The agent's listings workspace.
 *
 * Cards grouped by where each listing stands, because that is the question an
 * agent actually has: what is earning, what is waiting on us, what is waiting
 * on them. Sending for review and taking a listing down go through a confirm
 * sheet and then a router refresh, so the list always re-renders from the
 * database rather than from an optimistic guess. Unmet quality requirements
 * come back from the submit action and are shown in the sheet, in the same
 * words the wizard checklist uses.
 *
 * DELETING A DRAFT OPENS NOTHING (inbox item 26). It used to raise the same
 * confirm sheet, which asks the question in the wrong direction: a dialogue
 * defends against the tap somebody meant to make, and the tap that needs
 * defending against is the one they did not. The row leaves immediately, its
 * slot offers the way back for six seconds, and NOTHING REACHES THE SERVER
 * until that offer runs out. Which matters here more than it does on a
 * shortlist: the action deletes the row and its photos out of storage, so
 * there is nothing to put back afterwards. The undo has to come first or it
 * cannot exist.
 *
 * Leaving the screen inside the window commits the delete rather than
 * cancelling it, because the agent asked for it and walking away is not a
 * change of mind. Closing the tab outright is the one case that will not
 * land, and the draft simply survives.
 *
 * All copy arrives from the page as a dictionary slice, so the workspace reads
 * in the agent's language, including the status vocabulary.
 */

/**
 * How long the way back stands. Six seconds is long enough to notice the row
 * has gone and reach the control, short enough that nobody wonders whether the
 * delete happened.
 */
const UNDO_WINDOW_MS = 6000;

export type WorkspaceCopy = Dictionary["agentListings"];

/** V-48: the close sheet's words and the closed labels. */
type CloseCopy = Dictionary["landlord"]["close"];

type Group = {
  key: keyof WorkspaceCopy["workspace"]["groups"];
  statuses: ListingStatus[];
};

const GROUPS: Group[] = [
  { key: "live", statuses: ["PUBLISHED", "APPROVED"] },
  { key: "review", statuses: ["SUBMITTED", "UNDER_REVIEW"] },
  { key: "attention", statuses: ["MORE_INFO_REQUIRED", "REJECTED", "SUSPENDED"] },
  { key: "drafts", statuses: ["DRAFT"] },
];

const EDITABLE: ListingStatus[] = ["DRAFT", "MORE_INFO_REQUIRED", "REJECTED"];

type SheetKind = "submit" | "unpublish";

type SheetState = { kind: SheetKind; listing: ListingSummary };

/**
 * The submit gate's requirements, in the agent's language.
 *
 * The action returns which fields are unmet, keyed by field name. The counts it
 * carried are dropped on purpose: the requirement itself is what an agent needs
 * here, and the wizard shows the live tally. A field this map does not know
 * falls back to the message the action sent, so nothing is ever blank.
 */
function requirementText(
  copy: WorkspaceCopy,
  field: string,
  fallback: string,
  yearly: boolean,
): string {
  switch (field) {
    case "title":
      return fill(copy.gate.titleShort, { min: MIN_TITLE_LENGTH });
    case "description":
      return fill(copy.submit.checklist.description, { min: MIN_DESCRIPTION_WORDS });
    case "propertyType":
      return copy.gate.propertyType;
    case "photos":
      return fill(copy.submit.checklist.photos, { min: MIN_PHOTOS });
    case "stateCode":
      return copy.gate.stateCode;
    case "city":
      return copy.gate.city;
    case "area":
      return copy.gate.area;
    case "amenities":
      return copy.gate.amenities;
    /* The gate reports the money by which figure is missing; "price" is
       kept for an older server. Without these the sheet printed the gate's
       English fallback in every language. */
    case "price":
      return yearly ? copy.gate.priceYear : copy.gate.priceNight;
    /* The gate reports "rent" for a monthly or quarterly tenancy too, so it
       is not the yearly sentence. */
    case "rent":
      return copy.gate.rent;
    case "rate":
      return copy.gate.priceNight;
    case "bedrooms":
      return copy.gate.bedrooms;
    case "bathrooms":
      return copy.gate.bathrooms;
    case "maxGuests":
      return copy.gate.maxGuests;
    default:
      return fallback;
  }
}

function ConfirmSheet({
  t,
  state,
  onClose,
}: {
  t: WorkspaceCopy;
  state: SheetState;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useSafeTransition();
  const [unmet, setUnmet] = useState<string[]>([]);
  const copy = t.workspace.sheets[state.kind];

  function run() {
    setUnmet([]);
    startTransition(async () => {
      try {
        const input = { listingId: state.listing.id };
        const result =
          state.kind === "submit" ? await submitListing(input) : await unpublishListing(input);

        if (!result.ok) {
          /* The outcome goes to the banner; the requirements the gate names
             stay in the sheet, beside the listing they belong to. */
          banner.error(result.error, { retry: run });
          setUnmet(
            Object.entries(result.fieldErrors ?? {}).map(([field, message]) =>
              requirementText(t, field, message, state.listing.pricePeriod === "year"),
            ),
          );
          return;
        }
        banner.success(state.kind === "submit" ? "Sent for review" : "Taken down");
        onClose();
        if (state.kind === "submit") {
          router.replace(withDone("/agent/listings", "listing-submitted", { listing: state.listing.id }), { scroll: false });
        } else {
          router.refresh();
        }
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  }

  return (
    <Sheet
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={copy.title}
      footer={
        <div className="flex flex-wrap gap-md">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            {t.workspace.sheets.keep}
          </Button>
          {/*
            Deleting a listing and taking a live one down are destructive, and
            both used to confirm behind the same blue primary as submitting for
            review. Quiet danger rather than solid: this is the confirm step
            inside a sheet, where the sheet has already made the consequence
            plain and a solid red would shout louder than the decision needs.
          */}
          <Button
            variant={state.kind === "submit" ? "primary" : "dangerQuiet"}
            className="flex-1"
            onClick={run}
            loading={pending}
          >
            {copy.confirm}
          </Button>
        </div>
      }
    >
      <p className="text-[length:var(--nf-text-body-sm)] leading-relaxed text-[var(--nf-content-secondary)]">
        {copy.body}
      </p>
      <p className="mt-sm truncate text-[length:var(--nf-text-caption)] font-semibold">{state.listing.title}</p>

      {unmet.length > 0 && (
        <ul className="mt-xs space-y-xs">
          {unmet.map((message) => (
            <li
              key={message}
              className="flex items-start gap-xs text-[length:var(--nf-text-overline)] text-[var(--nf-content-secondary)]"
            >
              <span className="mt-2xs h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--nf-state-warning)]" />
              {message}
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}

/**
 * The slot a deleted draft leaves behind.
 *
 * It holds the row's own height so the list does not jump under a thumb, says
 * what happened in the past tense because from the agent's side it has, and
 * carries the way back. The bar underneath is the clock: without it nobody can
 * tell whether the offer stands for one more second or ten.
 */
function UndoStrip({
  t,
  title,
  onUndo,
}: {
  t: WorkspaceCopy;
  title: string;
  onUndo: () => void;
}) {
  const button = useRef<HTMLButtonElement>(null);

  /* The row that held focus has just been removed from the document, so focus
     would otherwise fall to the body and a keyboard user would lose both the
     place in the list and the only chance to take it back. */
  useEffect(() => {
    button.current?.focus();
  }, []);

  return (
    <li className="nf-panel nf-panel--card block overflow-hidden p-0" data-testid="draft-undo">
      <div className="flex items-center justify-between gap-md p-md" role="status">
        <span className="min-w-0 leading-tight">
          <span className="block text-[length:var(--nf-text-body-sm)] font-semibold">{t.workspace.undo.removed}</span>
          <span className="block truncate text-[length:var(--nf-text-caption)] text-[var(--nf-content-muted)]">
            {title}
          </span>
        </span>
        <Button
          ref={button}
          variant="secondary"
          size="sm"
          onClick={onUndo}
          data-testid="draft-undo-action"
        >
          <UiIcon name="arrow-left" size={16} />
          {t.workspace.undo.action}
        </Button>
      </div>
      <span
        aria-hidden="true"
        className="nf-undo-drain block h-0.5 bg-[var(--nf-brand-primary)]"
        style={{ ["--nf-undo-window" as string]: `${UNDO_WINDOW_MS}ms` }}
      />
    </li>
  );
}

function ListingRow({
  t,
  reference,
  listing,
  locale,
  onAction,
  onDelete,
  boardLabel,
  duplicateCopy,
  statusLabel,
  healthLabel,
  promoteLabel,
  closedReason,
  closeCopy,
  onCloseListing,
  ownerAsk = false,
  ownerCopy,
  selection,
  payoff,
  identityPending,
  stats,
}: {
  t: WorkspaceCopy;
  /** The lister's identity is not approved yet: a listing in review reads "Waiting on identity". */
  identityPending?: boolean | undefined;
  /**
   * Round 5: this listing just went live, by the server's row, and this device
   * has not seen it yet (lib/agent/lister-live.ts). The row plays the one
   * payoff: its Live mark pops, the hand feels one heavy beat as it does, and
   * the line under it says so. Present on one row at most, once.
   */
  payoff?: { title: string; body: string; open: string } | null | undefined;
  /** C5: present while selecting; draws the row's checkbox. */
  selection?: { selected: boolean; onToggle: (on: boolean, shift: boolean) => void } | undefined;
  /** V-08: the board action's words, when the board is switched on. */
  boardLabel?: string;
  /** V-29: "List another like this". */
  duplicateCopy?: Dictionary["frontDoor"]["duplicate"];
  /** V-71: "Share to Status". */
  statusLabel?: string;
  /** J4: "Health", the door to the listing's health page. */
  healthLabel?: string;
  /** D60: "Promote", the door to a live listing's promotion screen. */
  promoteLabel?: string;
  /* The listing code's own namespace, shared with the search page and the
     public listing page so one set of words governs the code everywhere. */
  reference: Dictionary["listingReference"];
  listing: ListingSummary;
  locale: Locale;
  onAction: (kind: SheetKind, listing: ListingSummary) => void;
  onDelete: (listing: ListingSummary) => void;
  /** V-48: why this listing was closed, when it was. */
  closedReason?: string | undefined;
  closeCopy?: CloseCopy | undefined;
  /** V-48: opens the close sheet. Present only where closing replaces taking down. */
  onCloseListing?: ((listing: ListingSummary) => void) | undefined;
  /** V-31: the owner of this listing has an open "still available?" question. */
  ownerAsk?: boolean;
  ownerCopy?: Dictionary["landlord"]["owner"] | undefined;
  /** Listing stats: this listing's own views and saves, and the time they were read. */
  stats?: { figures: StatsFigures; at: number } | null | undefined;
}) {
  const waitingOnIdentity = Boolean(identityPending) && (listing.status === "SUBMITTED" || listing.status === "UNDER_REVIEW" || listing.status === "APPROVED");
  const editable = EDITABLE.includes(listing.status) && !closedReason;
  const live = listing.status === "PUBLISHED" || listing.status === "APPROVED";
  /* A live RENTAL is closed with a reason rather than taken down. A stay or a
     sale keeps "Take down", which is the right control for them. */
  const closesWithReason = Boolean(onCloseListing && closeCopy && live && listing.intent === "rent");

  return (
    <li
      className={`nf-panel nf-panel--card block overflow-hidden p-0${payoff ? " nf-live-payoff" : ""}`}
      data-selected={selection?.selected ? "true" : undefined}
      data-testid={payoff ? "live-payoff" : undefined}
    >
      <div className="flex gap-4.5 p-md">
        {selection ? (
          <label className="-m-xs grid h-11 w-11 shrink-0 cursor-pointer place-items-center self-center">
            <input
              type="checkbox"
              className="h-5 w-5"
              checked={selection.selected}
              onChange={() => undefined}
              onClick={(event) => selection.onToggle(!selection.selected, event.shiftKey)}
              aria-label={`Select ${listing.title}`}
            />
          </label>
        ) : null}
        <span
          className="relative block h-[5.25rem] w-[5.25rem] shrink-0 overflow-hidden rounded-md"
          style={{ background: "var(--nf-surface-raised)" }}
        >
          {listing.coverUrl ? (
            /* THE COMMENT THAT USED TO BE HERE WAS OUT OF DATE, and it was
               costing real bandwidth. It said the storage bucket's public URL
               is "outside the image optimiser's allowed hosts"; the Supabase
               host has been derived into `next.config.ts`'s `remotePatterns`
               since, so a public object IS allowed and this thumbnail was
               shipping a full size upload into an 84px square. */
            <RemoteImage
              src={listing.coverUrl}
              alt=""
              width={84}
              height={84}
              sizes="84px"
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="grid h-full w-full place-items-center text-[var(--nf-content-muted)]">
              <UiIcon name="grid" size={24} />
            </span>
          )}
        </span>

        <div className="min-w-0 flex-1 leading-tight">
          {/*
            THE TITLE IS THE ROW, SO IT IS NEVER TRUNCATED TO MAKE ROOM FOR A
            PILL. It was `truncate` beside a `shrink-0` StatusPill, and at
            390px "More information needed" left three characters of the
            property's name: a workspace listing four properties showed
            "Fo...", "Mo..." and "Lu...". The pill takes its own line on a
            phone and comes back beside the title where there is room, and
            the title wraps to up to three lines rather than losing its words.
          */}
          <div className="flex flex-col items-start gap-2xs sm:flex-row sm:items-start sm:justify-between sm:gap-xs">
            <h3
              className="line-clamp-3 min-w-0 text-[length:var(--nf-text-body-sm)] font-semibold break-words"
              title={listing.title}
            >
              {listing.title}
            </h3>
            {closedReason && closeCopy ? (
              <StatusPill tone="neutral" className="shrink-0">
                {closeCopy.closedLabel.replace(
                  "{reason}",
                  closeCopy.closedReasons[closedReason as keyof CloseCopy["closedReasons"]] ?? closedReason,
                )}
              </StatusPill>
            ) : (
              <span
                className={`shrink-0${payoff ? " nf-live-payoff__mark" : ""}`}
                /* The heavy beat lands with the pop, not before it (CSS delays
                   the pop until the page has settled). */
                onAnimationStart={payoff ? (event) => event.animationName === "nf-success-payoff" && feedback("success") : undefined}
              >
                <span className="inline-flex items-center gap-2xs">
                  {LISTING_STATUS_GLYPH[listing.status] ? (
                    // eslint-disable-next-line @next/next/no-img-element -- a 256px transparent glyph at 24px
                    <img src={glyphSrc(LISTING_STATUS_GLYPH[listing.status]!)} alt="" width={24} height={24} decoding="async" className="size-6 object-contain" aria-hidden="true" />
                  ) : null}
                  <StatusPill tone={toneForStatus(listing.status)}>{t.workspace.status[listing.status]}</StatusPill>
                </span>
              </span>
            )}
          </div>

          {(listing.area || listing.city) && (
            <p className="mt-2xs flex items-center gap-xs text-[length:var(--nf-text-caption)] text-[var(--nf-content-muted)]">
              <UiIcon name="location" size={12} className="shrink-0" />
              <span
                className="min-w-0 line-clamp-2 break-words"
                title={[listing.area, listing.city].filter(Boolean).join(", ")}
              >
                {[listing.area, listing.city].filter(Boolean).join(", ")}
              </span>
            </p>
          )}

          <p className="mt-xs flex items-baseline gap-xs">
            <span className="nf-numeric text-[length:var(--nf-text-body-sm)] font-bold">
              {listing.priceMinor > 0
                ? formatMoneyGlance(listing.priceMinor, locale)
                : t.guestView.priceToSet}
            </span>
            {/*
              SIX PERIODS, NOT TWO. This was a ternary on "year", so a monthly
              rent read "per night", a quarterly one read "per night", and a
              ₦24,000,000 ASKING PRICE on a house for sale read "per night" on
              the agent's own workspace. `PERIOD_SUFFIX` in lib/listings has
              carried all six for a while; the words are now in the dictionary
              too, so the row says the right one in four languages.
            */}
            <span className="text-[length:var(--nf-text-overline)] text-[var(--nf-content-muted)]">
              {t.pricing.period[listing.pricePeriod]}
            </span>
          </p>

          <p className="mt-2xs text-[length:var(--nf-text-overline)] text-[var(--nf-content-muted)]">
            {listing.photoCount === 1
              ? t.workspace.photoCountOne
              : fill(t.workspace.photoCount, { count: listing.photoCount })}
          </p>

          {listing.completeness ? (
            <ListingMeter completeness={listing.completeness} listingId={listing.id} editable={editable} copy={t.workspace.completeness} locale={locale} />
          ) : null}

          {/* THE CODE, ON THE ROW, the moment the listing has one. This is
              where a lister will be standing when somebody asks them for it
              over the phone. A listing in review has none, because the
              database issues it at publish, and an absent code draws nothing
              rather than an empty field. */}
          {listing.reference && (
            <p className="mt-2xs text-[length:var(--nf-text-overline)] text-[var(--nf-content-muted)]">
              {reference.label}{" "}
              <span className="nf-numeric tracking-[0.08em] text-[var(--nf-content-secondary)]">
                {listing.reference}
              </span>
            </p>
          )}

          {/* Listing stats: only this lister's own figures (my_listing_stats),
              on a listing that has been live. Nothing when they could not be read. */}
          {stats && listing.publishedAt ? (
            <ListingStatsRow
              compact
              className="mt-2xs text-[length:var(--nf-text-overline)]"
              label={listingStatsEn.agentLabel}
              items={agentStatItems({ publishedAt: listing.publishedAt, figures: stats.figures, now: new Date(stats.at), locale })}
            />
          ) : null}
        </div>
      </div>

      {waitingOnIdentity && (
        <p className="nf-caption border-t border-[var(--nf-border-subtle)] px-md py-xs text-[var(--nf-content-secondary)]" data-testid="row-waiting-identity">
          Waiting on identity. It cannot go live until your identity is approved.{" "}
          <ButtonLink href="/verification" variant="quiet" size="sm">
            Verify your identity
          </ButtonLink>
        </p>
      )}
      {payoff && (
        <div className="nf-live-payoff__line flex flex-wrap items-center justify-between gap-xs border-t border-[var(--nf-border-subtle)] px-md py-sm" role="status">
          <p className="min-w-0 text-[length:var(--nf-text-body-sm)]">
            <span className="block font-semibold">{payoff.title}</span>
            <span className="block text-[length:var(--nf-text-caption)] text-[var(--nf-content-secondary)]">{payoff.body}</span>
          </p>
          <ButtonLink href={`/listing/${listing.id}`} variant="quiet" size="sm" arrow>
            {payoff.open}
          </ButtonLink>
        </div>
      )}

      {listing.reviewNotes && (
        <p className="border-t border-[var(--nf-border-subtle)] px-md py-sm text-[length:var(--nf-text-overline)] leading-relaxed text-[var(--nf-content-secondary)]">
          {listing.reviewNotes}
        </p>
      )}

      {ownerAsk && ownerCopy && live && !closedReason && (
        <OwnerAskStrip listingId={listing.id} copy={ownerCopy} onLet={() => onCloseListing?.(listing)} />
      )}

      {/* An in-review listing let by the year has no action at all now that
          the calendar is nightly only, and an empty bordered bar read as a
          broken row. The bar is drawn only when something is in it. */}
      {(editable ||
        live ||
        listing.status === "DRAFT" ||
        listing.pricePeriod === "night" ||
        Boolean(duplicateCopy) ||
        Boolean(healthLabel) ||
        Boolean(listing.listingRole && listing.listingRole !== "owner")) && (
      <div className="flex flex-wrap items-center gap-x-2xs border-t border-[var(--nf-border-subtle)] px-xs py-2xs">
        {listing.status === "PUBLISHED" && <ShareToFeedButton listingId={listing.id} />}
        {editable && (
          <ButtonLink href={`/agent/list?id=${listing.id}`} variant="quiet" size="sm" arrow>
            {t.workspace.actions.edit}
          </ButtonLink>
        )}
        {/* Closing nights only means anything on a listing let by the night.
            It was drawn on every row, so a yearly rental, an office or a
            house for sale offered a calendar of nights nobody can book. */}
        {listing.pricePeriod === "night" && (
          <ButtonLink href={`/agent/listings/${listing.id}/calendar`} variant="quiet" size="sm" leadingIcon="calendar-booking">
            Calendar
          </ButtonLink>
        )}
        {/* V-57: a nightly stay declares its charges at the door before it can be published. */}
        {listing.pricePeriod === "night" && (
          <ButtonLink href={`/agent/listings/${listing.id}/arrival`} variant="quiet" size="sm" leadingIcon="info">
            Charges at the door
          </ButtonLink>
        )}
        {/* SCUML item 17: an agent or firm listing goes live once the owner confirms the mandate. */}
        {listing.listingRole && listing.listingRole !== "owner" && (
          <ButtonLink href={`/agent/listings/${listing.id}/mandate`} variant="quiet" size="sm" leadingIcon="document" data-testid="listing-mandate">
            Owner&apos;s mandate
          </ButtonLink>
        )}
        {duplicateCopy && <DuplicateListing listingId={listing.id} copy={duplicateCopy} />}
        {/* V-71: a published listing's Status picture and the lister's own link. */}
        {statusLabel && listing.status === "PUBLISHED" && (
          <ButtonLink href={`/agent/listings/${listing.id}/status`} variant="quiet" size="sm" leadingIcon="share" data-testid="listing-status">
            {statusLabel}
          </ButtonLink>
        )}
        {/* Vallo Roommates: the lister says the home suits people renting it together. */}
        {!closedReason && (
          <ButtonLink href={`/agent/listings/${listing.id}/sharing`} variant="quiet" size="sm" leadingIcon="users" data-testid="listing-sharing-link">
            Good for sharing
          </ButtonLink>
        )}
        {/* J4: every listing the lister owns has a health page: what its
            record holds and what it is missing. An example listing's page
            says it is never measured, rather than this row guessing. */}
        {healthLabel && (
          <ButtonLink href={`/agent/listings/${listing.id}/health`} variant="quiet" size="sm" leadingIcon="file-search" data-testid="listing-health">
            {healthLabel}
          </ButtonLink>
        )}
        {/* D60: a live listing's promotion screen, its own last thirty days
            and the four tiers. Buying there says it is not on sale yet
            (`PROMOTION_NOT_ON_SALE`); this action only opens the screen. A
            draft or a listing in review has nothing a renter can see, so
            nothing to promote, and a closed one is finished. */}
        {promoteLabel && canPromote(listing) && !closedReason && (
          <ButtonLink href={promotionHref(listing.id)} variant="quiet" size="sm" leadingIcon="trending-up" data-testid="listing-promote">
            {promoteLabel}
          </ButtonLink>
        )}
        {/* V-08: a board needs a code, and a code needs a published listing. */}
        {boardLabel && listing.reference && listing.status === "PUBLISHED" && (
          <ButtonLink href={`/agent/listings/${listing.id}/board`} variant="quiet" size="sm" leadingIcon="document" data-testid="listing-board">
            {boardLabel}
          </ButtonLink>
        )}
        {editable && (
          <Button
            variant="quiet"
            size="sm"
            onClick={() => onAction("submit", listing)}
          >
            {t.workspace.actions.submit}
          </Button>
        )}
        {live && closesWithReason && (
          <Button
            variant="quiet"
            size="sm"
            /* min-w-11: in Yoruba the label is "Tì", a 38.8px target (auditFit, C1 sweep). */
            className="min-w-11"
            onClick={() => onCloseListing?.(listing)}
            data-testid="close-listing"
          >
            {closeCopy?.action}
          </Button>
        )}
        {/* Taking a listing down is also the only way to EDIT a live one
            (it returns to drafts). A live rental offered only Close, which is
            final, so its rent could never be corrected. Both are offered. */}
        {live && (
          <Button
            variant="quiet"
            size="sm"
            onClick={() => onAction("unpublish", listing)}
          >
            {t.workspace.actions.takeDown}
          </Button>
        )}
        {/*
          Delete was the lowest-contrast element in this row - muted grey text,
          quieter than every reversible action beside it, on the one action
          that cannot be undone. It is a real danger control now. Quiet rather
          than solid, because a solid red pill among four text links would make
          deletion the loudest thing on the card; the point is that it should
          be legible as destructive, not that it should be shouted.

          It no longer opens anything. The row leaves and offers its way back.
        */}
        {listing.status === "DRAFT" && (
          <Button variant="dangerQuiet" size="sm" onClick={() => onDelete(listing)}>
            {t.workspace.actions.delete}
          </Button>
        )}
      </div>
      )}
    </li>
  );
}

export function ListingsWorkspace({
  identityPending,
  t,
  reference,
  listings: all,
  locale,
  query = "",
  boardLabel,
  duplicateCopy,
  statusLabel,
  healthLabel,
  promoteLabel,
  closed = {},
  closeCopy,
  ownerAsks = [],
  ownerCopy,
  liveCopy,
  liveArrivalId,
  stats,
  statsAt = 0,
}: {
  identityPending?: boolean | undefined;
  t: WorkspaceCopy;
  /** Round 5: the live payoff's words. Absent (harnesses), no payoff plays. */
  liveCopy?: { title: string; body: string; open: string };
  /**
   * The listing the page's arrival sheet is announcing as live
   * (`?done=listing-live`, M4's surface). That sheet says it, so the row does
   * not say it again under it; it is marked seen all the same.
   */
  liveArrivalId?: string | undefined;
  reference: Dictionary["listingReference"];
  listings: ListingSummary[];
  locale: Locale;
  /** The page's search term (`?q=`). Narrows by title; empty shows everything. */
  query?: string;
  /**
   * V-08, "Print or paint your board". Present only while
   * `feature_flags.listing_board` is on; absent, no row draws the action.
   */
  boardLabel?: string;
  /** V-29, "List another like this". Absent in harnesses, which then draw no action. */
  duplicateCopy?: Dictionary["frontDoor"]["duplicate"];
  /** V-71, "Share to Status". */
  statusLabel?: string;
  /** J4, "Health". Absent in harnesses, which then draw no action. */
  healthLabel?: string;
  /** D60, "Promote". Absent in harnesses, which then draw no action. */
  promoteLabel?: string;
  /** V-48: closed listings and why, keyed by id. Absent draws what it drew before. */
  closed?: Record<string, string>;
  closeCopy?: CloseCopy;
  /** V-31: listings whose owner has an open "still available?" question. */
  ownerAsks?: string[];
  ownerCopy?: Dictionary["landlord"]["owner"];
  /** Listing stats: the lister's own views and saves by listing id; null or absent draws none. */
  stats?: Record<string, StatsFigures> | null;
  /** When the page read them, so the days live match between server and browser. */
  statsAt?: number;
}) {
  /* The bar's search lands here with `?q=`, so it is a real narrowing and
     not a field that does nothing. */
  const term = query.trim().toLowerCase();
  const listings = term ? all.filter((row) => row.title.toLowerCase().includes(term)) : all;
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [closing, setClosing] = useState<ListingSummary | null>(null);
  /* C5: select mode. The anchor is the last row toggled, for shift-click ranges. */
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const anchor = useRef<string | null>(null);

  /* Drafts whose delete is scheduled but has not been sent. A row in
     `pending` is off the screen and still in the database. */
  const [pending, setPending] = useState<string[]>([]);
  const router = useRouter();
  const undoWindow = useRef<UndoWindow | null>(null);

  /*
   * The timing lives in `createUndoWindow`, which owns one rule this component
   * must not get wrong: one delete per draft, ever, whichever of the three
   * paths reaches it first. Held in a ref, and built once, because the unmount
   * cleanup has to flush the CURRENT set rather than whatever was outstanding
   * when an effect last ran.
   */
  const send = useCallback(
    (id: string) => {
      void deleteListing({ listingId: id }).then((result) => {
        if (!result.ok) {
          /* Nothing was deleted, so the row comes back where it was and the
             banner says why, with the delete one tap away again. This is the
             only path that puts a listing back on screen without the agent
             asking. */
          setPending((prev) => prev.filter((p) => p !== id));
          banner.error(result.error, {
            retry: () => {
              setPending((prev) => (prev.includes(id) ? prev : [...prev, id]));
              undoWindow.current?.schedule(id);
            },
          });
          return;
        }
        router.refresh();
      });
    },
    [router],
  );

  /* The window is built once and outlives every render, so the indirection
     through a ref is what lets it call the current `send` rather than the one
     that existed when the first draft was deleted. */
  const sendRef = useRef(send);
  useEffect(() => {
    sendRef.current = send;
  }, [send]);

  undoWindow.current ??= createUndoWindow({
    windowMs: UNDO_WINDOW_MS,
    onCommit: (id) => sendRef.current(id),
  });

  const scheduleDelete = useCallback((listing: ListingSummary) => {
    setPending((prev) => (prev.includes(listing.id) ? prev : [...prev, listing.id]));
    undoWindow.current?.schedule(listing.id);
  }, []);

  const undoDelete = useCallback((id: string) => {
    undoWindow.current?.cancel(id);
    setPending((prev) => prev.filter((p) => p !== id));
  }, []);

  /* Leaving the screen commits what was scheduled. The agent asked for the
     delete; navigating away is not a change of mind, and a draft that quietly
     survived because somebody tapped Bookings would be the worse surprise. */
  useEffect(() => {
    const scheduled = undoWindow.current;
    return () => scheduled?.flush();
  }, []);

  /*
   * THE PAYOFF, ONCE (round 5). Decided after mount, from the rows the server
   * read, and only once per visit: a refresh after any action re-renders this
   * with new rows and must not decide again. The key is marked seen as it is
   * decided, so a second visit cannot replay it. A quiet reader (reduced
   * motion, Calm, Off) gets the settled state and the haptic at once; anyone
   * else feels it when the pop starts.
   */
  const [payoffId, setPayoffId] = useState<string | null>(null);
  const payoffDecided = useRef(false);
  useEffect(() => {
    if (payoffDecided.current || !liveCopy) return;
    payoffDecided.current = true;
    const due = livePayoffFor(listings.filter((l) => !(l.id in closed)), Date.now(), seenOnce);
    if (!due) return;
    markSeen(liveSeenKey(due));
    if (due.id === liveArrivalId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a latch decided once from the server's rows
    setPayoffId(due.id);
    if (motionQuiet()) feedback("success");
  }, [listings, closed, liveCopy, liveArrivalId]);

  if (listings.length === 0) {
    return (
      <div className="mx-auto max-w-md py-10 text-center">
        {/* The first-run card: the founder's 3D keys (30 September). */}
        <span className="mx-auto grid size-[5.5rem] place-items-center" aria-hidden="true" data-art="keys">
          <Icon3D name="keys" size={88} />
        </span>
        <h2 className="nf-h3 mt-5">{t.workspace.emptyTitle}</h2>
        <p className="mx-auto mt-xs max-w-[38ch] text-[length:var(--nf-text-body-sm)] text-[var(--nf-content-secondary)]">
          {t.workspace.emptyBody}
        </p>
        {/* The page header already carries this door as the screen's one
            primary (T-44), so the first-run card repeats it quietly. */}
        <ButtonLink href="/agent/list" variant="secondary" className="mt-lg">
          {t.workspace.start}
        </ButtonLink>
      </div>
    );
  }

  /* C5: the rows in the order the screen shows them, for shift-click ranges. */
  const order = GROUPS.flatMap((group) =>
    listings.filter((l) => group.statuses.includes(l.status) && !(l.id in closed) && !pending.includes(l.id)).map((l) => l.id),
  );
  const toggle = (id: string, on: boolean, shift: boolean) => {
    /* Read the anchor now: the updater runs later, after it has moved. */
    const from = anchor.current;
    setSelected((prev) => (shift ? rangeToggle(order, prev, from, id, on) : on ? [...prev, id] : prev.filter((s) => s !== id)));
    anchor.current = id;
  };
  const plan = planBulk(listings, selected);

  return (
    <div className="space-y-7">
      <div className="flex justify-end">
        <Button
          type="button"
          variant="quiet"
          size="sm"
          onClick={() => {
            setSelecting((on) => !on);
            setSelected([]);
            anchor.current = null;
          }}
          data-testid="bulk-select-toggle"
        >
          {selecting ? "Done selecting" : "Select"}
        </Button>
      </div>
      {GROUPS.map((group) => {
        const rows = listings.filter((l) => group.statuses.includes(l.status) && !(l.id in closed));
        if (rows.length === 0) return null;
        const heading = t.workspace.groups[group.key];
        /* A draft on its way out is not in the group any more, as far as the
           agent is concerned, so the count says what the list shows. */
        const count = rows.filter((l) => !pending.includes(l.id)).length;
        return (
          <section key={group.key}>
            <span className="flex items-center gap-xs">
              <h2 className="nf-h3">{heading.title}</h2>
              <span className="nf-count-badge">{count}</span>
            </span>
            <p className="mb-sm mt-2xs text-[length:var(--nf-text-overline)] text-[var(--nf-content-muted)]">
              {heading.blurb}
            </p>
            {selecting ? (
              <Button
                type="button"
                variant="quiet"
                size="sm"
                className="mb-xs"
                onClick={() => setSelected((prev) => [...new Set([...prev, ...rows.filter((l) => !pending.includes(l.id)).map((l) => l.id)])])}
              >
                {`Select all in ${heading.title}`}
              </Button>
            ) : null}
            <ul className="space-y-sm">
              {rows.map((listing) =>
                pending.includes(listing.id) ? (
                  <UndoStrip
                    key={listing.id}
                    t={t}
                    title={listing.title}
                    onUndo={() => undoDelete(listing.id)}
                  />
                ) : (
                  <ListingRow
                    key={listing.id}
                    t={t}
                    identityPending={identityPending}
                    reference={reference}
                    listing={listing}
                    locale={locale}
                    onAction={(kind, target) => setSheet({ kind, listing: target })}
                    onDelete={scheduleDelete}
                    boardLabel={boardLabel}
                    duplicateCopy={duplicateCopy}
                    statusLabel={statusLabel}
                    healthLabel={healthLabel}
                    promoteLabel={promoteLabel}
                    closeCopy={closeCopy}
                    onCloseListing={closeCopy ? setClosing : undefined}
                    ownerAsk={ownerAsks.includes(listing.id)}
                    ownerCopy={ownerCopy}
                    payoff={payoffId === listing.id ? liveCopy : null}
                    stats={stats?.[listing.id] ? { figures: stats[listing.id]!, at: statsAt } : null}
                    selection={
                      selecting
                        ? { selected: selected.includes(listing.id), onToggle: (on, shift) => toggle(listing.id, on, shift) }
                        : undefined
                    }
                  />
                ),
              )}
            </ul>
          </section>
        );
      })}

      {/* V-48: closed with a reason. Last, because nothing here needs doing. */}
      {closeCopy && listings.some((l) => l.id in closed) && (
        <section data-testid="closed-group">
          <span className="flex items-center gap-xs">
            <h2 className="nf-h3">{closeCopy.groupTitle}</h2>
            <span className="nf-count-badge">{listings.filter((l) => l.id in closed).length}</span>
          </span>
          <p className="mb-sm mt-2xs text-[length:var(--nf-text-overline)] text-[var(--nf-content-muted)]">
            {closeCopy.groupBlurb}
          </p>
          <ul className="space-y-sm">
            {listings
              .filter((l) => l.id in closed)
              .map((listing) => (
                <ListingRow
                  key={listing.id}
                  t={t}
                  identityPending={identityPending}
                  reference={reference}
                  listing={listing}
                  locale={locale}
                  onAction={(kind, target) => setSheet({ kind, listing: target })}
                  onDelete={scheduleDelete}
                  closedReason={closed[listing.id]}
                  closeCopy={closeCopy}
                  stats={stats?.[listing.id] ? { figures: stats[listing.id]!, at: statsAt } : null}
                />
              ))}
          </ul>
        </section>
      )}

      {selecting && selected.length > 0 ? (
        <BulkBar plan={plan} count={selected.length} onClear={() => setSelected([])} />
      ) : null}

      {sheet && <ConfirmSheet t={t} state={sheet} onClose={() => setSheet(null)} />}
      {closing && closeCopy && (
        <CloseListingSheet
          listingId={closing.id}
          title={closing.title}
          copy={closeCopy}
          onClose={() => setClosing(null)}
        />
      )}
    </div>
  );
}
