import type { Metadata } from "next";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { PageFrame } from "@/components/app/PageFrame";
import { GateHandshake } from "@/components/app/inspections/GateHandshake";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: getDictionary(await getLocale()).platform.gate.title,
    robots: { index: false, follow: false },
  };
}

/**
 * ONE INSPECTION'S GATE CODE, ON ITS OWN. V-35.
 *
 * Where a named delegate lands (the notification `name_inspection_delegate`
 * sends points here), because a delegate is not a party to the inspection
 * row and never sees it in a list. The lister and the renter reach the same
 * component inside the inspection sheet.
 *
 * The page renders nothing about the inspection on the server. The
 * component asks `inspection_handshake`, which answers `not_found` to anybody
 * who is not on it, so a guessed id shows the "no gate code on this phone"
 * sentence and nothing else. Nothing personal is in this document, which is
 * also why the service worker's no-HTML-on-disk rule is untouched: the pack
 * lives in IndexedDB and the offline page reads it from there.
 */
export default async function GatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const locale = await getLocale();
  const t = getDictionary(locale);
  return (
    <PageFrame title={t.platform.gate.title} fallback="/bookings?kind=inspection&from=property" width="narrow" testId="gate-page">
      <GateHandshake inspectionId={id} locale={locale} copy={t.platform.gate} />
    </PageFrame>
  );
}
