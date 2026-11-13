import { readMyRoutingFirms } from "@/lib/firm/queries";
import type { Metadata } from "next";
import { listingBoardIsOn } from "@/lib/listings/board-queries";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { AgentShell } from "@/components/agent/AgentShell";
import { PageFrame } from "@/components/app/PageFrame";
import {
  agentProfileFrom,
  getAgentContext,
  readMyListings,
} from "@/lib/agent/listings-queries";
import { ListingPitch } from "../list/ListingPitch";
import { ListingsWorkspace } from "./ListingsWorkspace";
import { IdentityNotice } from "./IdentityNotice";
import { identityGateApplies, listerIdentityStatus } from "@/lib/verification/lister-identity";
import { ButtonLink } from "@/components/ui/Button";
import { SuccessFromFlag } from "@/components/ui/SuccessFromFlag";
import { readDone } from "@/lib/ui/success-moments";
import { listingArrival } from "@/lib/ui/arrival-moments";
import { readClosedReasons, readOpenOwnerHeartbeats } from "@/lib/landlord/queries";

export async function generateMetadata(): Promise<Metadata> {
  const t = getDictionary(await getLocale());
  return { title: t.agent.nav.myListings, robots: { index: false, follow: false } };
}

/**
 * /agent/listings: everything the agent owns, in every status.
 *
 * The list is read on the server through the agent's own RLS-bound client, so
 * what renders is exactly what the database will let them manage. Actions live
 * in the client workspace and refresh this page after every state change.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[]; done?: string | string[]; listing?: string | string[] }>;
}) {
  const { q, done: doneParam, listing: listingParam } = await searchParams;
  const query = Array.isArray(q) ? (q[0] ?? "") : (q ?? "");
  const locale = await getLocale();
  const t = getDictionary(locale);
  const context = await getAgentContext();

  if (context.state === "signed-out" || context.state === "not-agent") {
    return (
      <AgentShell t={t} locale={locale} active="/agent/listings" profile={null}>
        <ListingPitch
          copy={t.agentListings.pitch}
          signedIn={context.state === "not-agent"}
        />
      </AgentShell>
    );
  }

  if (context.state === "unconfigured") {
    return (
      <AgentShell t={t} locale={locale} active="/agent/listings" profile={null}>
        <ListingsUnreachable t={t} />
      </AgentShell>
    );
  }

  const listings = await readMyListings(context.supabase, context.agent.id);
  const identity = (await identityGateApplies(context.user.id)) ? await listerIdentityStatus(context.user.id) : null;
  if (listings === null) {
    return (
      <AgentShell
        t={t}
        locale={locale}
        active="/agent/listings"
        profile={agentProfileFrom(context.agent)}
      >
        <ListingsUnreachable t={t} />
      </AgentShell>
    );
  }
  /* V-48: which of these were closed with a reason, read beside the list and
     failing soft into "none", which draws the workspace as it was. V-08: and
     whether the board flag is on. */
  const [closed, ownerAsks, boardOn, routingFirms] = await Promise.all([
    readClosedReasons(listings.map((listing) => listing.id)),
    readOpenOwnerHeartbeats(),
    listingBoardIsOn(),
    /* V-99: the way to the firm desk, for a principal or coordinator. */
    readMyRoutingFirms(),
  ]);

  /*
   * THE LISTER'S SUCCESS MOMENT (docs/SUCCESS_MOMENTS.md). The flag comes from
   * the workspace's own submit or from the approval notice, and names a
   * listing; the sheet opens only when that listing is one of THESE and its
   * status says the moment is true now.
   */
  const done = readDone(doneParam);
  const namedId = Array.isArray(listingParam) ? listingParam[0] : listingParam;
  const named = listings.find((row) => row.id === namedId);
  const arrival = listingArrival(listings, done, namedId);

  return (
    <AgentShell
      t={t}
      locale={locale}
      active="/agent/listings"
      profile={agentProfileFrom(context.agent)}
      /* The frame's header carries the one way back (Grade 1 page frame). */
      chromeBack={false}
    >
      <SuccessFromFlag
        copy={t.success}
        show={arrival !== null}
        moment={arrival ?? "listingSubmitted"}
        strip={["listing"]}
        details={named ? [{ label: t.success.detail.for, value: named.title }] : undefined}
        /* A notice read later is not the moment it happened in. */
        haptic={done === "listing-submitted" ? undefined : false}
      />
      <PageFrame
        title={t.agentListings.workspace.title}
        subtitle={t.agentListings.workspace.lede}
        fallback="/agent/dashboard"
        width="wide"
        actions={
          <>
            <ButtonLink href="/agent/list" variant="primary">
              {t.agentListings.workspace.start}
            </ButtonLink>
            {routingFirms && routingFirms.length > 0 && (
              <ButtonLink href="/agent/firm" variant="secondary">
                {t.frontDoor.firm.title}
              </ButtonLink>
            )}
          </>
        }
      >
      <div>

      {identity ? <IdentityNotice status={identity.status} /> : null}

      {/* The search that used to sit in the workspace bar, on the one screen
          it ever searched. A real GET form, so `?q=` narrows server side. */}
      <form action="/agent/listings" method="get" role="search" className="nf-agent-find">
        <UiIcon name="search" size={20} className="nf-agent-find__glyph" />
        <input
          type="search"
          enterKeyHint="search"
          name="q"
          defaultValue={query}
          aria-label={t.common.search}
          placeholder={`${t.common.search} ${t.agent.nav.myListings.toLowerCase()}`}
        />
      </form>

      <ListingsWorkspace
        identityPending={identity !== null && identity.status !== "approved"}
        t={t.agentListings}
        reference={t.listingReference}
        listings={listings}
        locale={locale}
        query={query}
        boardLabel={boardOn ? t.frontDoor.board.action : undefined}
        duplicateCopy={t.frontDoor.duplicate}
        statusLabel={t.frontDoor.status.action}
        healthLabel={t.experienceFeatures.health.open}
        promoteLabel={t.experienceFeatures.promotion.promote}
        closed={closed}
        closeCopy={t.landlord.close}
        ownerAsks={ownerAsks}
        ownerCopy={t.landlord.owner}
        /* Round 5: the payoff the day a listing is live, from the rows above. */
        liveCopy={{
          title: t.success.moments.listingLive.title,
          body: t.success.moments.listingLive.body,
          open: t.experienceLister.live.open,
        }}
        liveArrivalId={arrival === "listingLive" ? namedId : undefined}
      />
      </div>
      </PageFrame>
    </AgentShell>
  );
}

/** The listings could not be read: say so, and keep the way to start one. */
function ListingsUnreachable({ t }: { t: ReturnType<typeof getDictionary> }) {
  return (
    <div className="mx-auto max-w-md py-10 text-center">
      <h1 className="nf-h2">{t.agentListings.workspace.title}</h1>
      <p className="mx-auto mt-sm max-w-[40ch] text-[var(--nf-content-secondary)]">
        {t.agentListings.workspace.unconfigured}
      </p>
      <ButtonLink href="/agent/list" variant="primary" className="mt-lg">
        {t.agentListings.workspace.start}
      </ButtonLink>
    </div>
  );
}
