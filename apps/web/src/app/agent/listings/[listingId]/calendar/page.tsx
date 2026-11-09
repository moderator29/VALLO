import type { Metadata } from "next";
import Link from "next/link";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { getAgentContext, agentProfileFrom } from "@/lib/agent/listings-queries";
import { getListingCalendar } from "@/lib/agent/calendar-queries";
import { AgentShell } from "@/components/agent/AgentShell";
import { PageFrame } from "@/components/app/PageFrame";
import { ListingPitch } from "../../../list/ListingPitch";
import { CalendarEditor } from "./CalendarEditor";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { IconPlate } from "@/components/ui/IconPlate";

export const metadata: Metadata = {
  title: "Listing calendar",
  robots: { index: false, follow: false },
};

/**
 * /agent/listings/[listingId]/calendar
 *
 * The first and only writer of availability_status 'unavailable'. Before this
 * screen the only rows in public.availability came from the bookings loop
 * marking nights 'booked', so a host could not close a weekend for repairs, for
 * a relative, or because they were away, and the third value of the enum had no
 * writer anywhere on the platform.
 *
 * Every state that is not "ready" is a designed screen with a way onward.
 */
export default async function Page({
  params,
}: {
  params: Promise<{ listingId: string }>;
}) {
  const { listingId } = await params;
  const locale = await getLocale();
  const t = getDictionary(locale);
  const read = await getListingCalendar(listingId);

  if (read.state === "signed-out" || read.state === "not-agent") {
    return (
      <AgentShell t={t} locale={locale} active="/agent/listings" profile={null}>
        <ListingPitch copy={t.agentListings.pitch} signedIn={read.state === "not-agent"} />
      </AgentShell>
    );
  }

  if (read.state === "unconfigured" || read.state === "missing" || read.state === "unavailable") {
    const copy =
      read.state === "unconfigured"
        ? {
            title: "We cannot reach your calendar right now",
            body: "This platform is still waiting on its keys, so there is no calendar to manage yet.",
          }
        : read.state === "missing"
          ? {
              title: "We could not find that listing",
              body: "It may belong to another account, or it may have been removed. Your listings are all in one place.",
            }
          : {
              title: "The calendar is unavailable for a moment",
              body: "Your listing and its nights are unchanged. Please try again shortly.",
            };

    return (
      <AgentShell t={t} locale={locale} active="/agent/listings" profile={null}>
        <div className="mx-auto max-w-md py-10 text-center">
          <IconPlate size="lg">
            <UiIcon name="calendar-clock" size={24} />
          </IconPlate>
          <h1 className="nf-h2 mt-5">{copy.title}</h1>
          <p className="mx-auto mt-sm max-w-[42ch] text-[var(--nf-content-secondary)]">
            {copy.body}
          </p>
          <Link href="/agent/listings" className="nf-btn nf-btn--glass mt-lg">
            My listings
          </Link>
        </div>
      </AgentShell>
    );
  }

  const context = await getAgentContext();
  const profile = context.state === "agent" ? agentProfileFrom(context.agent) : null;

  return (
    <AgentShell t={t} locale={locale} active="/agent/listings" profile={profile} chromeBack={false}>
      {/* The frame's header carries the one way back, to My listings, where
          the text link above the title used to. */}
      <PageFrame
        title="Calendar"
        subtitle={`${read.subject.title}. Close nights you cannot host, and reopen them whenever you like.`}
        fallback="/agent/listings"
        width="wide"
      >
        <div>
          <CalendarEditor subject={read.subject} nights={read.nights} />
        </div>
      </PageFrame>
    </AgentShell>
  );
}
