import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { HostShell } from "@/components/host/HostShell";
import { HostSettingsBody } from "@/app/host/settings/HostSettingsBody";

/** The host workspace's own settings, from fixtures: a hotel and a restaurant. */
export const dynamic = "force-dynamic";

export default async function PreviewHostSettings() {
  const t = getDictionary(await getLocale());
  return (
    <HostShell fallback="/host" chromeBack={false} nav>
      <HostSettingsBody
        t={t}
        notifications={{ bookings: true, messages: true, wallet: true, marketing: false }}
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
            status: "APPROVED",
            hostType: "business",
            verificationTier: 2,
            verified: false,
            submittedAt: "2026-06-10T09:00:00.000Z",
            reviewedAt: "2026-06-12T09:00:00.000Z",
            reviewNotes: null,
            createdAt: "2026-06-01T09:00:00.000Z",
          },
        ]}
      />
    </HostShell>
  );
}
