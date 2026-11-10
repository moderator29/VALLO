import Link from "next/link";
import type { ReactNode } from "react";
import type { Dictionary } from "@vallo/i18n/core";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { ButtonLink } from "@/components/ui/Button";
import { iconPlateClass } from "@/components/ui/IconPlate";
import { RemoteImage } from "@/components/ui/RemoteImage";
import { AuthGate } from "@/components/auth/AuthGate";
import { TierBadge } from "@/components/trust/TierBadge";
import { VerifiedAgentBadge } from "./VerifiedAgentBadge";
import { ListerRoleLine } from "./ListerRoleLine";
import { listerHeading } from "./lister-role";
import type { ListerCard } from "./lister-card";
import type { ListingRole } from "@/lib/supply/roles";
import "@/app/css/catalogue.css";

/**
 * The agent card of 9E8B56ED, with what the product can honestly say.
 *
 * The render shows a named agent with a star rating and a review count. The
 * listing read carries no rating for a lister, so that is not invented: the
 * "Verified agent" pill appears only when a person checked them, and the
 * control is the real one, the conversation. A phone number is never printed;
 * the conversation is where the platform protects both sides.
 *
 * ---------------------------------------------------------------------------
 * THE HEADING USED TO CONTRADICT THE LINE UNDER IT, ON EVERY OWNER LISTING
 *
 * The name fallback was `t.catalogue.detail.agentRole`, the words "Agent on
 * Vallo", printed for EVERY listing whatever its `listing_role`. On an owner's
 * listing that put "Agent on Vallo" directly above "Listed by the owner". One
 * of those two sentences is false on every owner listing, and it was the one
 * drawn in the heavier weight at the top of the card.
 *
 * So the fallback now MATCHES THE ROLE, and where a role has no honest noun it
 * prints nothing rather than a wrong one:
 *
 *   agent   "Agent on Vallo", which is exactly what that listing is.
 *   owner   NOTHING. There is no honest noun that is not simply a repeat of
 *           "Listed by the owner" on the line below, and the owner sentence
 *           names nobody on purpose: the offer IS that there is no
 *           intermediary.
 *   firm    NOTHING. We know it is a firm and not WHICH firm, "Agent on Vallo"
 *           is false, and a generic "registered firm" would borrow a
 *           trust word for a claim no member of staff has checked yet.
 *           `listing_role` stays a claim until `ownership_verified_at` or
 *           `mandate_verified_at` is dated beside it.
 *
 * AND WHEN THE ROLE IS ABSENT THE CARD DRAWS EXACTLY WHAT IT DREW BEFORE. A
 * listing with no `listingRole` is the seed catalogue or an external shape,
 * which is the pre Track G state; changing that would be a regression dressed
 * as a fix, on surfaces this change was never about.
 *
 * ---------------------------------------------------------------------------
 * A NAME IS NOT A CHECK
 *
 * When `name` is present it is the heading, and it comes from
 * `public.listing_lister`, which publishes a display name and nothing else. It
 * says WHO, never whether anybody verified them. The badge beside it is the
 * only thing on this card that means a person here looked at a document.
 *
 * ---------------------------------------------------------------------------
 * "LISTED BY", THE FOUNDER'S REFERENCE (13 October 2026)
 *
 * Given `lister` (the page's `readListerCard`), the card is the reference's
 * row: the photograph, the name with the published badge beside it
 * (`TierBadge`, from `person_badge`, never a guess), one role word under it
 * (Landlord, Agent or Agency), and two round monochrome buttons on the right,
 * call and message, on the solid plate: ink by day, paper at night. The person
 * is a link to their profile when they have claimed a handle.
 *
 * The name on this row is the lister's PUBLIC profile name, the same one their
 * `/u/<handle>` page already shows anybody, and the founder asked for it on the
 * owner's listing too ("Listed by" with the owner's name and Landlord). A firm
 * is drawn as the firm (see `lister-card.ts`).
 *
 *   Message   the listing's own conversation (`/messages/new?listing=`),
 *             gated to sign in like every other action a guest may see. Not
 *             governed by `contact_policy`, which is the profile's door only
 *             (`lib/social/message-door.ts`), exactly as before.
 *   Call      `call` when the page could place one (the `video_calls` switch,
 *             a signed-in reader and a thread that exists); otherwise the same
 *             conversation, labelled for what it is: message them first to
 *             arrange a call. A phone number is never printed.
 *
 * No "Online" dot and no rating: there is no presence signal and no person
 * rating behind either, so neither is drawn.
 */
export function ListingAgentCard({
  verified,
  t,
  messageHref,
  name,
  listingRole,
  lister,
  call,
  className,
  hours,
  mandate,
}: {
  verified: boolean;
  t: Dictionary;
  messageHref: string;
  /** The lister's display name, when the read carries one. */
  name?: string | null;
  /**
   * WHAT THE LISTER IS TO THIS PROPERTY: `listings.listing_role`.
   *
   * Optional, and the card draws exactly what it drew before when it is
   * absent. That is deliberate rather than lazy: the seed catalogue and the
   * external shapes have no such column, and a listing that cannot say what
   * its lister is must not be given a noun by this component.
   */
  listingRole?: ListingRole | null;
  /** The "Listed by" row (`readListerCard`). Absent draws the older card. */
  lister?: ListerCard | null;
  /** A live call button (`ListerCallButton`), when the page can place a call. */
  call?: ReactNode;
  className?: string;
  hours?: string | null;
  /** "This agent holds a signed sale mandate...", only when one is held. */
  mandate?: string | null;
}) {
  const copy = t.catalogue.detail;
  if (lister) {
    return <ListedByCard lister={lister} t={t} messageHref={messageHref} call={call} className={className} hours={hours ?? null} mandate={mandate ?? null} />;
  }
  /* THE RULE LIVES IN `lister-role.ts` AND NOT HERE, because nothing that
     imports a `.tsx` file can be tested under this vitest config, and a rule
     that can only be grepped for is a rule that drifts. */
  const heading = listerHeading(listingRole, name, copy.agentRole);

  return (
    <div
      className={`nf-agent-card ${className ?? ""}`.trimEnd()}
      data-testid="agent-card"
      /* THE AGENT NOUN, CARRIED SO A PROOF DOES NOT HAVE TO HARDCODE IT.
         `scripts/probes/track_g_the_sentence_on_a_screen.mjs` asserts the
         NEGATIVE on an owner's listing: that this noun appears nowhere on the
         card. A harness holding its own copy of the words would keep passing
         after a copy change, which is the blind light this whole track has
         produced three times. It reads the noun off the page instead. */
      data-agent-noun={copy.agentRole}
    >
      <span className="nf-agent-card__avatar" aria-hidden="true">
        <span className="nf-detail-avatar-glyph">
          <UiIcon name="user" size={24} />
        </span>
      </span>
      {/* `nf-agent-card__body`, not `flex-1`: the column holds 10rem before it
          shares a row with the button, so the badge is never run under it. */}
      <div className="nf-agent-card__body">
        {/* The paragraph is dropped entirely when there is neither a heading
            nor a badge, so an owner's card does not carry an empty line where
            a name used to be. */}
        {(heading !== null || verified) && (
          <p className="flex flex-wrap items-center gap-inline-tight">
            {heading !== null && (
              <span className="nf-body font-semibold text-[var(--nf-content-primary)]">
                {heading}
              </span>
            )}
            {/* The badge opens the ladder rather than standing there being
                trusted. See `VerifiedAgentBadge`: the one claim the product
                rests on had nowhere to go from the screen where it matters. */}
            {verified && <VerifiedAgentBadge label={copy.verifiedAgent} />}
          </p>
        )}
        {/*
          WHO PUT IT UP, ABOVE WHAT WE CHECKED ABOUT THEM.
          The role is the offer and the badge is the check, and the reader
          wants them in that order. Neither is allowed to imply the other:
          "Listed by the owner" says nothing about whether anybody looked at a
          document, and the verified badge still means a checked human only.
        */}
        {listingRole ? <ListerRoleLine role={listingRole} name={name} className="mt-3xs" /> : null}
        {/* In the reader's language: these two lines were English literals
            on every locale (listing page upgrade, 13 October 2026). */}
        <p className="nf-caption mt-3xs text-[var(--nf-content-muted)]">
          {verified ? copy.verifiedBeforeLive : copy.managesListing}
        </p>
        {mandate ? (
          <p className="nf-caption mt-3xs text-[var(--nf-content-muted)]" data-testid="lister-mandate">
            {mandate}
          </p>
        ) : null}
      </div>
      <AuthGate action="message">
        <ButtonLink href={messageHref} variant="secondary" leadingIcon="chat-bubble" className="nf-agent-card__cta shrink-0">
          {copy.message}
        </ButtonLink>
      </AuthGate>
    </div>
  );
}

/** "Listed by": the reference's row. See the note at the head of this file. */
function ListedByCard({
  lister,
  t,
  messageHref,
  call,
  className,
  hours,
  mandate,
}: {
  lister: ListerCard;
  t: Dictionary;
  messageHref: string;
  call?: ReactNode;
  className?: string;
  /** "Mon to Fri, 9:00 to 18:00." when the agent has set hours. */
  hours?: string | null;
  mandate?: string | null;
}) {
  const copy = t.catalogue.detail;
  const roleLabel = lister.role ? t.socialProfile.roleLine[lister.role] : null;
  const heading = lister.name ?? roleLabel;
  /* The name the buttons speak: theirs, or the role, or "the lister". */
  const who = lister.name ?? roleLabel ?? copy.theLister;
  const plate = iconPlateClass({ size: "md", tone: "solid", shape: "round", className: "nf-lister-act" });

  const identity = (
    <>
      <span className="nf-agent-card__avatar nf-lister__avatar" aria-hidden="true">
        {lister.avatarUrl ? (
          <RemoteImage
            src={lister.avatarUrl}
            alt=""
            width={48}
            height={48}
            sizes="48px"
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="nf-detail-avatar-glyph">
            <UiIcon name="user" size={22} />
          </span>
        )}
      </span>
      <span className="nf-lister__text">
        {heading && (
          <span className="nf-lister__name" data-testid="lister-name">
            <span className="min-w-0 truncate">{heading}</span>
            <TierBadge tier={lister.tier} size={16} />
          </span>
        )}
        {roleLabel && lister.name && (
          <span className="nf-lister__role" data-testid="lister-role-word" data-role={lister.role ?? undefined}>
            {roleLabel}
          </span>
        )}
        {hours && (
          <span className="nf-lister__role" data-testid="lister-hours">
            Usually available: {hours}
          </span>
        )}
        {mandate && (
          <span className="nf-lister__role" data-testid="lister-mandate">
            {mandate}
          </span>
        )}
      </span>
    </>
  );

  return (
    <div
      className={`nf-agent-card nf-lister ${className ?? ""}`.trimEnd()}
      data-testid="agent-card"
      data-agent-noun={copy.agentRole}
    >
      {lister.handle ? (
        <Link
          href={`/u/${lister.handle}`}
          className="nf-lister__who nf-tap"
          title={copy.openProfile.replace("{name}", who)}
          data-testid="lister-profile"
        >
          {identity}
        </Link>
      ) : (
        <div className="nf-lister__who">{identity}</div>
      )}
      <span className="nf-lister__acts">
        {call ?? (
          <AuthGate action="message">
            <Link
              href={messageHref}
              className={plate}
              aria-label={copy.callByMessage.replace("{name}", who)}
              data-testid="lister-call"
              data-call="message"
            >
              <UiIcon name="phone" size={20} />
            </Link>
          </AuthGate>
        )}
        <AuthGate action="message">
          <Link
            href={messageHref}
            className={plate}
            aria-label={copy.messageLister.replace("{name}", who)}
            data-testid="lister-message"
          >
            <UiIcon name="messages" size={20} />
          </Link>
        </AuthGate>
      </span>
    </div>
  );
}
