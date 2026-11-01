import type { Metadata } from "next";
import { flagIsOn, LISTER_FEE_GATE_BLOCKING_FLAG, NEIGHBOURS_FLAG } from "@/lib/flags/read";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { AgentShell } from "@/components/agent/AgentShell";
import {
  agentProfileFrom,
  getAgentContext,
  readAmenities,
  readDraft,
  readOpenDraft,
  readStates,
  type DraftRead,
} from "@/lib/agent/listings-queries";
import { AMENITY_CHOICES, STATE_CODES } from "@/lib/agent/listings-model";
import { readBroadcastMarks } from "@/lib/agent/broadcast-marks-queries";
import {
  DRAFT_READ_FAILED_SENTENCE,
  MISSING_LISTING_SENTENCE,
  lockedSentence,
  wizardOpening,
} from "@/lib/agent/listings-edit-state";
import { EmptyState } from "@/components/app/Screen";
import { ButtonLink } from "@/components/ui/Button";
import { ListingWizard } from "./ListingWizard";
import { ListingPitch } from "./ListingPitch";

export async function generateMetadata(): Promise<Metadata> {
  const t = getDictionary(await getLocale());
  return { title: t.agent.nav.listApartment, robots: { index: false, follow: false } };
}

/**
 * /agent/list: the supply loop's front door.
 *
 * Three honest states. An approved agent gets the seven step wizard, loaded
 * with the platform's states and amenities and, when `?id=` names one of their
 * drafts, with that draft restored. A signed-in visitor who is not an agent,
 * and anyone signed out, gets the pitch and a route to the application. When
 * the platform keys are not in place the wizard still opens, saving to the
 * device, with a calm banner saying what switches on later.
 *
 * WITH NO `?id=`, THIS RESUMES THE HOST'S MOST RECENT DRAFT rather than opening
 * a blank one. This route is the only entry the navigation offers ("List
 * Apartment"), so a blank form here was the default answer to "I came back to
 * finish my listing", and it was the wrong one twice over: the host saw none of
 * their work, and the wizard, having no id, filed a second listings row on the
 * next save while the photos they had already uploaded stayed attached to the
 * first. Two half listings and an apparent data loss, from closing a tab.
 * `readOpenDraft` explains which draft is chosen and why.
 *
 * `?new=1` is the way to a blank wizard, so resuming is never a trap. It is not
 * a dead end for anyone: a host who genuinely wants a second listing while one
 * is unfinished can reach it, and nothing about the resumed draft is hidden
 * from them, since the workspace lists every draft they own.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; new?: string }>;
}) {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const { id, new: startFresh } = await searchParams;
  const context = await getAgentContext();

  if (context.state === "signed-out" || context.state === "not-agent") {
    return (
      <AgentShell t={t} locale={locale} active="/agent/list" profile={null}>
        <ListingPitch
          copy={t.agentListings.pitch}
          signedIn={context.state === "not-agent"}
        />
      </AgentShell>
    );
  }

  // Without platform keys there is nothing to read, so the wizard opens on the
  // canonical reference lists and keeps the agent's work on their device.
  if (context.state === "unconfigured") {
    return (
      <AgentShell t={t} locale={locale} active="/agent/list" profile={null}>
        <ListingWizard
          success={t.success}
          copy={t.agentListings}
          shotsCopy={t.afterTheGate.shots}
          viewerCopy={t.chatPolish.viewer}
          reference={t.listingReference}
          moveInCopy={t.moveIn}
          compoundCopy={t.shape.compound}
          serviceCopy={t.shape.service}
          unitCopy={t.shape.unit}
          floodCopy={t.shape.neighbours}
          remainderCopy={t.afterTheGate.remainder}
          moneyMapCopy={t.afterTheGate.moneyMap}
          pathCopy={t.experienceFeatures.wizard}
          listerCopy={t.experienceLister}
          locale={locale}
          userId={null}
          states={STATE_CODES.map((code) => ({ code, name: code }))}
          amenities={AMENITY_CHOICES}
          initial={null}
          canPersist={false}
        />
      </AgentShell>
    );
  }

  const [states, amenities, draft] = await Promise.all([
    readStates(context.supabase),
    readAmenities(context.supabase),
    id
      ? readDraft(context.supabase, context.agent.id, id)
      : startFresh
        ? Promise.resolve<DraftRead>(null)
        : readOpenDraft(context.supabase, context.agent.id),
  ]);

  /* A live or reviewing listing is not opened as a form that refuses every
     save, and an id that names nothing does not open a blank form whose
     first save files a new listing. ONE EXCEPTION (round 5): a listing with
     the review team opens as the wizard's own "sent" chain, under its card,
     settled. Sending revalidates this route while the lister is still on it,
     so this is also what keeps the screen they just sent from being swapped
     for a lock screen under their thumb. */
  const opening = wizardOpening(id, draft);
  const inReview =
    opening.kind === "locked" && draft && draft !== "read-failed" && (draft.status === "SUBMITTED" || draft.status === "UNDER_REVIEW")
      ? { status: draft.status, submittedAt: draft.submittedAt ?? null }
      : null;
  if (!inReview && (opening.kind !== "edit" || draft === "read-failed")) {
    const failed = opening.kind === "failed";
    const retry = id ? `/agent/list?id=${encodeURIComponent(id)}` : "/agent/list";
    return (
      <AgentShell t={t} locale={locale} active="/agent/list" profile={agentProfileFrom(context.agent)}>
        <EmptyState
          icon="doc-lock"
          title={draft && draft !== "read-failed" ? draft.title : t.agent.nav.myListings}
          body={
            opening.kind === "locked"
              ? lockedSentence(opening.status)
              : failed
                ? DRAFT_READ_FAILED_SENTENCE
                : MISSING_LISTING_SENTENCE
          }
          action={
            <ButtonLink href={failed ? retry : "/agent/listings"} variant="primary">
              {failed ? "Try again" : t.agent.nav.myListings}
            </ButtonLink>
          }
          data-testid={opening.kind === "locked" ? "listing-locked" : failed ? "listing-read-failed" : "listing-missing"}
        />
      </AgentShell>
    );
  }

  /* V-09: which figures from a pasted message are still unchecked, as the
     server holds them for this draft. */
  const shown = draft === "read-failed" ? null : draft;
  const unconfirmed = shown?.id ? await readBroadcastMarks(context.supabase, shown.id) : [];

  return (
    <AgentShell
      t={t}
      locale={locale}
      active="/agent/list"
      profile={agentProfileFrom(context.agent)}
      /* The wizard's own step footer owns the bottom edge: no main dock under it. */
      flow
    >
      <ListingWizard
        success={t.success}
        copy={t.agentListings}
          shotsCopy={t.afterTheGate.shots}
          viewerCopy={t.chatPolish.viewer}
        reference={t.listingReference}
        moveInCopy={t.moveIn}
        compoundCopy={t.shape.compound}
        serviceCopy={t.shape.service}
        unitCopy={t.shape.unit}
        floodCopy={t.shape.neighbours}
        floodOpen={await flagIsOn(NEIGHBOURS_FLAG)}
        /* D60: only the blocking is flagged, fail closed; the fee screen is drawn either way. */
        feeGateBlocking={await flagIsOn(LISTER_FEE_GATE_BLOCKING_FLAG)}
        remainderCopy={t.afterTheGate.remainder}
        moneyMapCopy={t.afterTheGate.moneyMap}
        pathCopy={t.experienceFeatures.wizard}
        listerCopy={t.experienceLister}
        sentFrom={inReview}
        locale={locale}
        userId={context.user.id}
        states={states.length > 0 ? states : STATE_CODES.map((code) => ({ code, name: code }))}
        amenities={amenities}
        initial={shown}
        canPersist
        broadcastCopy={t.frontDoor.broadcast}
        guideCopy={t.frontDoor.guide}
        initialUnconfirmed={unconfirmed}
        demandCopy={t.frontDoor.demand}
      />
    </AgentShell>
  );
}
