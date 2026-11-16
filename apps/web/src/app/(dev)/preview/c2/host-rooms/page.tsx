import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { HostShell } from "@/components/host/HostShell";
import { HostRoomsBody } from "@/app/host/rooms/HostRoomsBody";
import { C2_HOTEL, C2_HOTEL_PROPERTY, C2_ROOM_TYPES } from "../fixtures";

/**
 * The host's room and night console, with one room on the shelf and one not.
 *
 * What is being read here is the surface: the two sentences a host needs, one
 * counting the nights actually on sale and one naming the room that has none,
 * and the run-of-nights control under each.
 */
export const dynamic = "force-dynamic";

export default async function PreviewC2HostRooms() {
  const locale = await getLocale();
  const t = getDictionary(locale);
  return (
    <HostShell logoLabel={t.a11y.logoHome} fallback="/host" chromeBack={false} nav>
      <HostRoomsBody
        businesses={[C2_HOTEL]}
        chosen={C2_HOTEL}
        accommodation={C2_HOTEL_PROPERTY}
        rooms={C2_ROOM_TYPES}
        locale={locale}
      />
    </HostShell>
  );
}
