import type { Metadata } from "next";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { resolveSession } from "@/lib/actions/session";
import { readHostRoomBookings } from "@/lib/host/room-bookings";
import { roomDeadline, sortByDeadline } from "@/lib/host/decide";
import { requestNow } from "@/lib/format/when";
import { authHref, returnHref } from "@/components/auth/auth-intent";
import { EmptyState } from "@/components/app/Screen";
import { ButtonLink } from "@/components/ui/Button";
import { HostShell } from "@/components/host/HostShell";
import { DecideView, type DecideRowData } from "@/components/host/DecideView";
import { readHostTableBoard } from "../reservations/board";
import "../host-desk.css";
import { HostInnerNav } from "@/components/host/HostInnerNav";
import { hostInnerNavCopy } from "@/components/host/host-inner-nav";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getDictionary(await getLocale()).experienceHost.decide.metaTitle, robots: { index: false, follow: false } };
}

export const dynamic = "force-dynamic";

/**
 * /host/decide: ONE LIST OF EVERYTHING WAITING FOR THE HOST'S ANSWER, WITH
 * THE CLOCK SHOWING (C3, 30 September 2026).
 *
 * Room requests (`/host/bookings`) and table requests (`/host/reservations`)
 * used to sit on two pages with two looks, and neither said by when the host
 * had to answer. Here they are one list, soonest to lapse first, each with
 * its clock (`lib/host/decide.ts`) and its answer inline, through the same
 * actions and the same confirm panel those two pages use. Nothing here is a
 * second decision path.
 */


export default async function HostDecidePage() {
  const locale = await getLocale();
  const session = await resolveSession();
  if (session.state !== "signed-in") {
    const t = getDictionary(locale);
    return (
      <HostShell fallback="/host">
        <EmptyState
          icon="hourglass"
          title={t.experienceHost.decide.signedOutTitle}
          body={t.experienceHost.decide.signedOutBody}
          action={
            <ButtonLink href={authHref(returnHref("/host/decide", "", "list"), "sign-in")} variant="primary" size="lg">
              {t.common.signIn}
            </ButtonLink>
          }
        />
      </HostShell>
    );
  }

  const now = requestNow();
  const [rooms, tables] = await Promise.all([readHostRoomBookings(), readHostTableBoard(new Date(now))]);
  const tableRequests = tables.state === "ok" ? tables.board.requests : [];

  /* When each table request was made, read under the host's own RLS, so its
     clock runs from the request and not from a guess. */
  const made = new Map<string, string>();
  if (tableRequests.length > 0) {
    const { data } = await session.supabase
      .from("reservations")
      .select("id, created_at")
      .in(
        "id",
        tableRequests.map((t) => t.id),
      );
    for (const row of data ?? []) made.set(row.id, row.created_at);
  }

  const items: DecideRowData[] = [
    ...(rooms.state === "ok" ? rooms.waiting : []).map<DecideRowData>((booking) => ({
      kind: "room",
      id: booking.id,
      openedAt: booking.createdAt,
      deadline: roomDeadline(booking.createdAt),
      booking,
    })),
    ...tableRequests.map<DecideRowData>((table) => ({
      kind: "table",
      id: table.id,
      openedAt: made.get(table.id) ?? table.reservedFor,
      deadline: table.reservedFor,
      table,
    })),
  ];
  const sorted = sortByDeadline(items, now);
  const unreadable = rooms.state === "unavailable" || tables.state === "unavailable";

  return (
    <HostShell fallback="/host" wide>
      <HostInnerNav active="decide" {...hostInnerNavCopy(getDictionary(locale))} />
      <DecideView rows={sorted} now={now} locale={locale} unreadable={unreadable} />
    </HostShell>
  );
}
