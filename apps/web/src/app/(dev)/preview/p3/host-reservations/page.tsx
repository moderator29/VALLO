import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { HostShell } from "@/components/host/HostShell";
import { HostTablesBody } from "@/app/host/reservations/HostTablesBody";
import { P3_TABLE_BOARD } from "../fixtures";

/**
 * The venue's own table board, from a fixture board: two requests waiting on
 * an answer, one accepted table tonight, and one the guest called off.
 */
export const dynamic = "force-dynamic";

export default async function PreviewHostReservations() {
  const t = getDictionary(await getLocale());
  return (
    <HostShell logoLabel={t.a11y.logoHome} fallback="/host" chromeBack={false} nav>
      <HostTablesBody board={P3_TABLE_BOARD} />
    </HostShell>
  );
}
