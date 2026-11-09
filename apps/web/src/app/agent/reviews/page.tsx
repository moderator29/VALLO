import type { Metadata } from "next";
import { countOf, getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { AgentShell } from "@/components/agent/AgentShell";
import { PageFrame } from "@/components/app/PageFrame";
import { agentProfileFrom, getAgentContext } from "@/lib/agent/listings-queries";
import { getAgentReviews } from "@/lib/agent/reviews-queries";
import { Unreachable } from "@/components/app/Unreachable";
import { ListingPitch } from "../list/ListingPitch";
import { ReviewsWorkspace, type ReviewsFilter } from "./ReviewsWorkspace";

export async function generateMetadata(): Promise<Metadata> {
  const t = getDictionary(await getLocale());
  return { title: t.agent.nav.reviews, robots: { index: false, follow: false } };
}

/**
 * /agent/reviews: what guests said, and the host's answer to it.
 *
 * Reviews became real when the write path shipped, and the host's side of them
 * did not: the rating landed on the public listing page, the host saw it there
 * like any visitor, and this route was an eleven-line coming-soon stub. There
 * was no way to answer a review anywhere on the platform.
 *
 * Shaped like /agent/messages and /agent/bookings: the server page resolves
 * who is asking, reads under their own RLS-bound client, and hands the result
 * to a rendering component with one client leaf for the reply form.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const { filter: filterParam } = await searchParams;
  const filter: ReviewsFilter = filterParam === "all" ? "all" : "unanswered";

  const context = await getAgentContext();

  if (context.state === "signed-out" || context.state === "not-agent") {
    return (
      <AgentShell t={t} locale={locale} active="/agent/reviews" profile={null}>
        <ListingPitch copy={t.agentListings.pitch} signedIn={context.state === "not-agent"} />
      </AgentShell>
    );
  }

  if (context.state === "unconfigured") {
    return (
      <AgentShell t={t} locale={locale} active="/agent/reviews" profile={null} chromeBack={false}>
        {/* "Guest reviews of your stays appear here the moment the platform
            keys land" stood here: a schedule nobody can keep, wrapped around a
            deployment detail an agent has no use for. This branch is a failure
            state, not a pre-launch one, and `Unreachable` is the one answer the
            product gives to it. See F2-003. */}
        {/* The heading stays (the page frame's h1). `EmptyState` sets its
            title as a paragraph, deliberately, so the branch needs its own h1
            or this route has no heading at all for anybody reading it by
            landmark. */}
        <PageFrame title={t.agent.nav.reviews} fallback="/agent/dashboard" width="wide">
          <Unreachable
            noun="reviews"
            icon="reviews"
            action={{ label: t.agent.nav.dashboard, href: "/agent/dashboard" }}
          />
        </PageFrame>
      </AgentShell>
    );
  }

  const read = await getAgentReviews(locale);
  const profile = agentProfileFrom(context.agent);

  return (
    <AgentShell t={t} locale={locale} active="/agent/reviews" profile={profile} chromeBack={false}>
      {/* The frame's header carries the one way back (Grade 1 page frame). */}
      <PageFrame
        title={t.agent.nav.reviews}
        subtitle={
          read.state === "ready" && read.summary.unanswered > 0
            ? `${countOf(read.summary.unanswered, "reviewsAre", locale)} waiting on your answer. Your reply is public, and the next guest reads it.`
            : "What guests said about your stays, and what you said back."
        }
        fallback="/agent/dashboard"
        width="wide"
      >
      <div>

      {read.state === "ready" ? (
        <ReviewsWorkspace
          reviews={read.reviews}
          summary={read.summary}
          filter={filter}
          locale={locale}
        />
      ) : (
        /* The second hand-rolled unreachable state in this file, off the
           spacing scale and off the type scale, saying a different sentence
           about the same situation. One component answers it. */
        <Unreachable
          noun="reviews"
          icon="reviews"
          action={{ label: t.agent.nav.dashboard, href: "/agent/dashboard" }}
        />
      )}
      </div>
      </PageFrame>
    </AgentShell>
  );
}
