import { getDictionary, type Locale } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { ThreadView } from "@/app/(app)/messages/[id]/ThreadView";
import { HOTEL, PERSON } from "../../_fixtures/people";
import { BOOKING_CONTEXT, BOOKING_THREAD, CONVERSATION_ID } from "../fixtures";

/**
 * GOVERNING-chat-booking-card.png: the booking thread with the card. Seed
 * mode, so nothing writes; the same component the route renders.
 */
export const dynamic = "force-dynamic";

export default async function PreviewThreadBooking() {
  const locale: Locale = await getLocale();
  const t = getDictionary(locale);
  return (
    <main id="main" className="flex h-dvh flex-col">
      <ThreadView
        sheetCopy={{ unsafe: t.trustVisible.unsafe }}
        live={false}
        conversationId={CONVERSATION_ID}
        meId={PERSON.id}
        counterpartName={HOTEL.name}
        counterpartTier="gold"
        /* The render's call control. Null in a thread where the read withheld
           the number, and then the header simply carries the kebab alone. */
        counterpartPhone="+2348010000000"
        listing={{
          id: HOTEL.id,
          title: HOTEL.name,
          area: HOTEL.area,
          city: HOTEL.city,
          verified: true,
          approved: true,
          hue: 2,
        }}
        inspected={false}
        messages={BOOKING_THREAD}
        context={BOOKING_CONTEXT}
        role="guest"
        threadCopy={t.threads}
        locale={locale}
      />
    </main>
  );
}
