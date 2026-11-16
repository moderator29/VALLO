import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { HostShell } from "@/components/host/HostShell";
import { PageFrame } from "@/components/app/PageFrame";
import { HostStandingBody } from "@/app/host/HostStandingBody";
import { DeskFigure } from "@/components/workspace/DeskFigure";
import { emptyHostDraft } from "@/lib/host/onboarding";
import { hostToday, lagosDay } from "@/app/host/today";

/**
 * Where a host stands: one application in progress, one business on record,
 * and the workspace home's figures computed by the real `hostToday` from
 * fixture rows (a request waiting, a guest arriving today, one staying).
 * The figures are fixtures and say nothing about any real host.
 */
export const dynamic = "force-dynamic";

export default async function PreviewHostLanding() {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const now = new Date();
  /* Fixture room bookings for the figure card, hours back from the render. */
  const bookingRows = [2, 9, 28, 44, 70, 96, 140, 190, 260, 330, 410, 520, 640].map((hours) => ({
    at: new Date(now.getTime() - hours * 3_600_000).toISOString(),
  }));
  const day = lagosDay(now);
  const shift = (days: number) => lagosDay(new Date(now.getTime() + days * 86_400_000));
  const row = (id: string, status: string, checkIn: string, checkOut: string, guestName: string) => ({
    id,
    status,
    checkIn,
    checkOut,
    guestName,
    hotel: "Grand Vista Hotel",
    room: "Deluxe king",
    createdAt: new Date(now.getTime() - 3 * 3_600_000).toISOString(),
  });
  const today = hostToday({
    now,
    rooms: {
      waiting: [row("w1", "PENDING", shift(5), shift(7), "Seyi Omojuni")],
      upcoming: [
        row("a1", "CONFIRMED", day, shift(2), "Tunde Adebayo"),
        row("s1", "CONFIRMED", shift(-2), shift(1), "Adaora Nwosu"),
        row("f1", "CONFIRMED", shift(9), shift(12), "Kemi Bello"),
        row("f2", "CONFIRMED", shift(14), shift(15), "Ifeanyi Obi"),
      ],
      past: [row("p1", "COMPLETED", shift(-20), shift(-18), "Bola Ade"), row("p2", "COMPLETED", shift(-9), shift(-7), "Zainab Musa")],
    },
    tables: null,
    unread: 3,
    businesses: [
      { id: "b1", name: "Grand Vista Hotel", status: "PUBLISHED" },
      { id: "b2", name: "The Harbour Kitchen", status: "MORE_INFO_REQUIRED" },
    ],
    draft: null,
  });
  return (
    <HostShell logoLabel={t.a11y.logoHome} wide chromeBack={false} nav>
      <PageFrame title={t.hostNav.overview} back={false} width="wide">
      <HostStandingBody
        figure={<DeskFigure rows={bookingRows} kind="bookings" t={t} locale={locale} now={now} />}
        businesses={[
          {
            id: "00000000-0000-4000-8000-00000000h001",
            name: "Grand Vista Hotel",
            slug: "grand-vista-hotel",
            kind: "hotel",
            status: "PUBLISHED",
            hostType: "business",
            verificationTier: 3,
            verified: true,
            submittedAt: "2026-05-02T09:00:00.000Z",
            reviewedAt: "2026-05-06T09:00:00.000Z",
            reviewNotes: null,
            createdAt: "2026-05-01T09:00:00.000Z",
          },
          {
            id: "00000000-0000-4000-8000-00000000h002",
            name: "The Harbour Kitchen",
            slug: "the-harbour-kitchen",
            kind: "restaurant",
            status: "MORE_INFO_REQUIRED",
            hostType: "business",
            verificationTier: 1,
            verified: false,
            submittedAt: "2026-06-10T09:00:00.000Z",
            reviewedAt: "2026-06-12T09:00:00.000Z",
            reviewNotes:
              "The hygiene certificate has expired. Send the current one and we will finish the check the same day.",
            createdAt: "2026-06-09T09:00:00.000Z",
          },
        ]}
        draft={{
          ...emptyHostDraft(),
          businessId: "00000000-0000-4000-8000-00000000h003",
          status: "DRAFT",
          hostType: "business",
          kind: "guest_house",
          name: "Ikoyi Guest House",
        }}
        today={today}
        t={t}
      />
      </PageFrame>
    </HostShell>
  );
}
