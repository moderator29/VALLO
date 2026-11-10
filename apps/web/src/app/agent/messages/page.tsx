import type { Metadata } from "next";
import { countOf, getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { AgentShell } from "@/components/agent/AgentShell";
import { PageFrame } from "@/components/app/PageFrame";
import { agentProfileFrom, getAgentContext } from "@/lib/agent/listings-queries";
import { getAgentInbox } from "@/lib/agent/messages-queries";
import { Unreachable } from "@/components/app/Unreachable";
import { ListingPitch } from "../list/ListingPitch";
import { AgentInbox, type InboxFilter } from "./AgentInbox";
import { readOpenQuestionsForLister } from "@/lib/availability/queries";
import { readDeskStages } from "@/lib/enquiry/queries";
import { stageFilter } from "@/lib/enquiry/stage";
import { readFollowups } from "@/lib/enquiry/followup-queries";
import { dueNowIds, groupFollowups } from "@/lib/enquiry/followup";
import { readBriefsForMe } from "@/lib/briefs/queries";
import { readMyListings } from "@/lib/agent/listings-queries";
import { BriefsDesk } from "@/components/agent/BriefsDesk";
import Link from "next/link";

export async function generateMetadata(): Promise<Metadata> {
  const t = getDictionary(await getLocale());
  return { title: t.agent.nav.messages, robots: { index: false, follow: false } };
}

/**
 * /agent/messages: the host side of conversations that were already live.
 *
 * Agents have been receiving real threads under RLS since messaging shipped and
 * could only read them at /messages, the guest surface, with no host framing.
 * Worse, the navigation carried a hardcoded unread badge of 3 pointing here, at
 * a placeholder, so every agent saw three unread messages permanently and could
 * never clear them. This closes both.
 *
 * Shaped like /agent/earnings and /agent/bookings: the server page resolves who
 * is asking, reads under their own RLS-bound client, and hands the result to a
 * plain rendering component. Replying happens on the existing thread route
 * through the existing sendMessage action, so there is no second composer and
 * no second write path to keep in step.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; stage?: string }>;
}) {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const { filter: filterParam, stage: stageParam } = await searchParams;
  const filter: InboxFilter = filterParam === "all" ? "all" : filterParam === "due" ? "due" : "waiting";

  const context = await getAgentContext();

  if (context.state === "signed-out" || context.state === "not-agent") {
    return (
      <AgentShell t={t} locale={locale} active="/agent/messages" profile={null}>
        <ListingPitch copy={t.agentListings.pitch} signedIn={context.state === "not-agent"} />
      </AgentShell>
    );
  }

  if (context.state === "unconfigured") {
    return (
      <AgentShell t={t} locale={locale} active="/agent/messages" profile={null} chromeBack={false}>
        {/* "Guest enquiries appear here the moment the platform keys land"
            stood here. It named a date nobody can name and it named our
            deployment while doing it. This branch is what an agent meets when
            the inbox cannot be read at all, which is a fault, not a launch.
            See F2-003. */}
        {/* The heading stays (the page frame's h1). `EmptyState` sets its
            title as a paragraph, deliberately, so the branch needs its own h1
            or this route has no heading at all for anybody reading it by
            landmark. */}
        <PageFrame title={t.agent.nav.messages} fallback="/agent/dashboard" width="wide">
          <Unreachable
            noun="inbox"
            icon="chat-duo"
            action={{ label: t.agent.nav.dashboard, href: "/agent/dashboard" }}
          />
        </PageFrame>
      </AgentShell>
    );
  }

  const profile = agentProfileFrom(context.agent);

  /* V-95: the Briefs filter draws the briefs this lister may answer. */
  if (filterParam === "briefs") {
    const [briefs, mine] = await Promise.all([
      readBriefsForMe(),
      /* A failed read is null, which the desk shows as unreachable, never as
         "no homes". */
      readMyListings(context.supabase, context.agent.id).catch(() => null),
    ]);
    const homes = mine === null ? null : mine.filter((one) => one.status === "PUBLISHED").map((one) => ({ id: one.id, title: one.title }));
    return (
      <AgentShell t={t} locale={locale} active="/agent/messages" profile={profile} chromeBack={false}>
        <PageFrame title={t.agent.nav.messages} fallback="/agent/dashboard" width="wide">
        <div>
        <Link href="/agent/messages?filter=all" className="nf-link-quiet nf-body-sm text-[var(--nf-content-link)]">
          {t.frontDoor.desk.all}
        </Link>
        <BriefsDesk briefs={briefs} homes={homes} copy={t.frontDoor.briefs} locale={locale} />
        </div>
        </PageFrame>
      </AgentShell>
    );
  }

  const [read, asked, stages, followups] = await Promise.all([
    getAgentInbox(),
    readOpenQuestionsForLister(),
    readDeskStages(),
    /* AGENT-01: the follow-up dates, for the "Due today" filter. */
    readFollowups(context.supabase),
  ]);
  /* Due today, or earlier and still open; Let and Lost enquiries are left out.
     Null (not an empty set) when the dates could not be read: no chip. */
  const dueIds = followups ? dueNowIds(groupFollowups(followups, stages, new Date())) : null;

  return (
    <AgentShell t={t} locale={locale} active="/agent/messages" profile={profile} chromeBack={false}>
      {/* The frame's header carries the one way back (Grade 1 page frame). */}
      <PageFrame
        title={t.agent.nav.messages}
        subtitle={
          read.state === "ready" && read.inbox.waitingCount > 0
            ? `${countOf(read.inbox.waitingCount, "enquiriesAre", locale)} waiting on your reply. Guests book the agents who answer.`
            : "Every guest enquiry about your listings, oldest wait first."
        }
        fallback="/agent/dashboard"
        width="wide"
      >
      <div>

      {read.state === "ready" ? (
        <AgentInbox
          inbox={read.inbox}
          filter={filter}
          asked={asked}
          askedLabel={t.frontDoor.available.inboxWaiting}
          stages={stages}
          stage={stageFilter(stageParam)}
          deskCopy={t.frontDoor.desk}
          briefsLabel={t.frontDoor.briefs.deskFilter}
          dueIds={dueIds}
          dueCopy={{ chip: t.workspaceDash.followup.dueChip, empty: t.workspaceDash.followup.dueEmpty, emptyBody: t.workspaceDash.followup.dueEmptyBody }}
          missedWords={{ VIDEO: t.calls.history.inboxMissedVideo, AUDIO: t.calls.history.inboxMissedVoice }}
        />
      ) : (
        /* The same state, hand-rolled a second time in one file with different
           words, different spacing and a different type size. `Unreachable` is
           the product's one answer to "we could not read it". */
        <Unreachable
          noun="inbox"
          icon="chat-duo"
          action={{ label: t.agent.nav.dashboard, href: "/agent/dashboard" }}
        />
      )}
      </div>
      </PageFrame>
    </AgentShell>
  );
}
