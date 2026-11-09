import type { Metadata } from "next";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { AgentShell } from "@/components/agent/AgentShell";
import { PageFrame } from "@/components/app/PageFrame";
import { agentProfileFrom, getAgentContext } from "@/lib/agent/listings-queries";
import { readHostBookings, type HostBookingBoard } from "@/lib/agent/bookings-queries";
import { ListingPitch } from "../list/ListingPitch";
import { BookingsWorkspace } from "./BookingsWorkspace";
import { ReservationsBoard } from "./ReservationsBoard";
import {
  readHostReservations,
  EMPTY_RESERVATION_BOARD,
} from "@/lib/agent/reservations-queries";
import { ButtonLink } from "@/components/ui/Button";
import { ListerTenancies } from "@/components/app/tenancy/ListerTenancies";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { IconPlate } from "@/components/ui/IconPlate";

export async function generateMetadata(): Promise<Metadata> {
  const t = getDictionary(await getLocale());
  return { title: t.agentBookings.title, robots: { index: false, follow: false } };
}

const EMPTY_BOARD: HostBookingBoard = {
  requests: [],
  upcoming: [],
  completed: [],
  cancelled: [],
  total: 0,
};

/**
 * /agent/bookings: the host's queue of requests and stays.
 *
 * Shaped the same way /agent/listings is: the server page resolves who is
 * asking and reads under their own RLS-bound client, then hands the board to
 * a client workspace that owns the tabs and the accept/decline sheets. Those
 * actions revalidate this path themselves, and the workspace calls
 * router.refresh() after every decision so the list always re-renders from
 * the database rather than an optimistic guess.
 */
export default async function Page() {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const context = await getAgentContext();

  if (context.state === "signed-out" || context.state === "not-agent") {
    return (
      <AgentShell t={t} locale={locale} active="/agent/bookings" profile={null}>
        <ListingPitch copy={t.agentListings.pitch} signedIn={context.state === "not-agent"} />
      </AgentShell>
    );
  }

  if (context.state === "unconfigured") {
    return (
      <AgentShell t={t} locale={locale} active="/agent/bookings" profile={null}>
        <div className="mx-auto max-w-md py-10 text-center">
          <IconPlate size="lg">
            <UiIcon name="calendar-check" size={24} />
          </IconPlate>
          <h1 className="nf-h2 mt-5">{t.agentBookings.title}</h1>
          <p className="mx-auto mt-sm max-w-[42ch] text-[var(--nf-content-secondary)]">
            {t.agentBookings.unconfigured}
          </p>
          <ButtonLink href="/agent/dashboard" variant="secondary" className="mt-lg">
            {t.agent.nav.dashboard}
          </ButtonLink>
        </div>
      </AgentShell>
    );
  }

  /* Both boards, in parallel. A restaurant reservation and a stay are separate
     tables with separate policies, so neither read can answer for the other,
     and an agent who lets flats and runs a restaurant needs both on one screen
     rather than a second console to remember. */
  const [board, tables] = await Promise.all([
    readHostBookings(context).catch(() => EMPTY_BOARD),
    readHostReservations(context).catch(() => EMPTY_RESERVATION_BOARD),
  ]);

  return (
    <AgentShell
      t={t}
      locale={locale}
      active="/agent/bookings"
      profile={agentProfileFrom(context.agent)}
      /* The frame's header carries the one way back (Grade 1 page frame). */
      chromeBack={false}
    >
      <PageFrame title={t.agentBookings.title} subtitle={t.agentBookings.lede} fallback="/agent/dashboard" width="wide">
      <div>
      <BookingsWorkspace t={t.agentBookings} board={board ?? EMPTY_BOARD} locale={locale} />

      {/* V-47: the lister's way into the tenancy files. Nothing when there are none. */}
      <ListerTenancies locale={locale} />

      {/* Renders nothing at all for an agent with no restaurant, rather than
          three empty headings explaining a product they do not sell. */}
      <ReservationsBoard board={tables} />
      </div>
      </PageFrame>
    </AgentShell>
  );
}
