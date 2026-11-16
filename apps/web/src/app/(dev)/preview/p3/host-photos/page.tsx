import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { HostShell } from "@/components/host/HostShell";
import { HostPhotosBody } from "@/app/host/photos/HostPhotosBody";
import { P3_PHOTOS } from "../fixtures";

/**
 * The owner's photograph manager with three photographs on record.
 *
 * The images are the filed photo plates rather than bucket objects,
 * because this sandbox has no session and therefore no uploads. What is being
 * read here is the surface: the cover's place in the grid, the take-down
 * control beside each one, and the drop target under them.
 */
export const dynamic = "force-dynamic";

const VENUE = {
  id: "00000000-0000-4000-8000-0000000p3001",
  name: "Yellow Chilli Ikoyi",
  slug: "yellow-chilli-ikoyi",
  kind: "restaurant" as const,
  status: "PUBLISHED" as const,
  hostType: "restaurant" as const,
  verificationTier: 1,
  verified: false,
  submittedAt: "2026-09-18T10:03:00.000Z",
  reviewedAt: "2026-09-19T08:30:00.000Z",
  reviewNotes: null,
  createdAt: "2026-09-18T09:40:00.000Z",
};

export default async function PreviewHostPhotos() {
  const t = getDictionary(await getLocale());
  return (
    <HostShell logoLabel={t.a11y.logoHome} fallback="/host" chromeBack={false} nav>
      <HostPhotosBody
        userId="00000000-0000-4000-8000-0000000p3010"
        businesses={[VENUE]}
        chosen={VENUE}
        photos={P3_PHOTOS.map((photo, index) => ({
          id: photo.id,
          storagePath: photo.url,
          url: photo.url,
          position: index,
        }))}
      />
    </HostShell>
  );
}
