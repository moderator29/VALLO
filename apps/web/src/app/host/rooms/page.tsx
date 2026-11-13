import type { Metadata } from "next";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { resolveSession } from "@/lib/actions/session";
import { getMyBusinesses, getMyRoomTypes, getPrimaryAccommodation } from "@/lib/host/queries";
import { authHref, returnHref } from "@/components/auth/auth-intent";
import { EmptyState } from "@/components/app/Screen";
import { ButtonLink } from "@/components/ui/Button";
import { HostShell } from "@/components/host/HostShell";
import { HostInnerNav } from "@/components/host/HostInnerNav";
import { hostInnerNavCopy } from "@/components/host/host-inner-nav";
import { HostRoomsBody } from "./HostRoomsBody";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getDictionary(await getLocale()).experienceHost.rooms.title, robots: { index: false, follow: false } };
}

export const dynamic = "force-dynamic";

/**
 * /host/rooms: how far ahead a hotel is bookable, and by how many rooms.
 *
 * THE QUESTION THIS SURFACE ANSWERS COULD NOT BE ASKED BEFORE IT.
 * `room_inventory` is one row per room type per night, and `stays_search`
 * treats a missing row as NOT OFFERED rather than as available, deliberately.
 * The table was created in M5 with its oversell lock, its two triggers and its
 * RLS, and no application file ever wrote to it or read from it: the only two
 * mentions in `apps/web/src` were comments. So every hotel on the platform was
 * invisible to every search that carried dates, and no host had any way to see
 * that, let alone change it.
 *
 * WHAT IS HONEST HERE. The night count is counted from the rows, never
 * inferred from the horizon constant: what the screen prints is what the table
 * holds. A room type with no rate plan is drawn as not on sale with the reason,
 * because the publish gate will not put it on the shelf and a host should learn
 * that here rather than from a reviewer. And the status of a room type is
 * shown as it is: DRAFT until the property is published, which is the reviewer's
 * act and not the host's.
 */
export default async function HostRoomsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const session = await resolveSession();

  if (session.state !== "signed-in") {
    const next = returnHref("/host/rooms", "", "list");
    return (
      <HostShell logoLabel={t.a11y.logoHome} fallback="/host">
        <EmptyState
          heading="h1"
          icon="hotel"
          title={t.hostWorkspace.rooms.signedOutTitle}
          body={t.hostWorkspace.rooms.signedOutBody}
          action={
            <ButtonLink href={authHref(next, "sign-in")} variant="primary" size="lg">
              {t.common.signIn}
            </ButtonLink>
          }
        />
      </HostShell>
    );
  }

  const params = await searchParams;
  const asked = params.business;
  const wanted = Array.isArray(asked) ? asked[0] : asked;

  const businesses = (await getMyBusinesses()).filter((row) => row.kind !== "restaurant");
  const chosen = businesses.find((row) => row.id === wanted) ?? businesses[0] ?? null;
  const accommodation = chosen ? await getPrimaryAccommodation(chosen.id) : null;
  const rooms = accommodation ? await getMyRoomTypes(accommodation.id) : [];

  return (
    /* The body's page frame carries the one way back; the bar keeps the
       host's destinations. */
    <HostShell logoLabel={t.a11y.logoHome} fallback="/host" chromeBack={false} nav>
      <HostInnerNav active="rooms" {...hostInnerNavCopy(t)} />
      <HostRoomsBody
        copy={t.hostWorkspace}
        words={t.experienceHost.rooms}
        businesses={businesses}
        chosen={chosen}
        accommodation={accommodation}
        rooms={rooms}
        locale={locale}
      />
    </HostShell>
  );
}
