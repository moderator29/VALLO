import type { Metadata } from "next";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { resolveSession } from "@/lib/actions/session";
import { getMyBusinesses, getPrimaryAccommodation } from "@/lib/host/queries";
import { listBusinessPhotos, type BusinessPhoto } from "@/lib/stays/business-photos";
import {
  listAccommodationPhotos,
  type AccommodationPhoto,
} from "@/lib/stays/accommodation-photos";
import { authHref, returnHref } from "@/components/auth/auth-intent";
import { EmptyState } from "@/components/app/Screen";
import { ButtonLink } from "@/components/ui/Button";
import { HostShell } from "@/components/host/HostShell";
import { HostPhotosBody } from "./HostPhotosBody";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getDictionary(await getLocale()).experienceHost.screens.photos, robots: { index: false, follow: false } };
}

export const dynamic = "force-dynamic";

/**
 * /host/photos: where an owner's own photographs go up.
 *
 * WHY THIS IS A ROUTE OF ITS OWN RATHER THAN A STEP IN THE WIZARD. The wizard
 * is an application, and an application closes when it is sent: every write
 * behind it runs through `editableBusiness`, which refuses once a business is
 * SUBMITTED. Photographs are not an answer on a form, they are the venue's
 * content, and the onboarding script promises an owner they can go live the
 * day they sign and send their pictures during the week. A photograph surface
 * that shut the moment the application was sent would be shut for the entire
 * period the photographs actually arrive in.
 *
 * So the write path is `addBusinessPhoto`, which gates on ownership at any
 * status rather than on editability, and this screen is reachable from the
 * host's own standing page for every venue on the account.
 *
 * AND IT NOW SERVES BOTH SPINES, which is the whole reason a hotel could not
 * go live. A restaurant's photographs hang on its `businesses` row; a hotel's
 * or a shortlet's hang on the `accommodations` row under it, in
 * `accommodation_photos`, which had a table, a bucket, four storage policies
 * and a catalogue trigger and no writer anywhere in the application. The
 * submission gate refuses an accommodation with no photograph, so every hotel
 * and every shortlet stopped dead at the review step. One door, two spines,
 * decided by which table the chosen business's photographs actually live in,
 * because a second route would have been a second place for the cover rule to
 * drift.
 */
export default async function HostPhotosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const session = await resolveSession();

  if (session.state !== "signed-in") {
    const next = returnHref("/host/photos", "", "list");
    return (
      <HostShell logoLabel={t.a11y.logoHome} fallback="/host">
        <EmptyState
          icon="camera"
          title={t.hostWorkspace.photos.signedOutTitle}
          body={t.hostWorkspace.photos.signedOutBody}
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

  const businesses = await getMyBusinesses();
  const chosen = businesses.find((row) => row.id === wanted) ?? businesses[0] ?? null;

  /* WHICH SPINE THIS VENUE'S PHOTOGRAPHS LIVE ON is decided by whether it has
     a property under it, not by its kind: a business of a stays kind that has
     not saved its property yet has nowhere to hang a photograph, and is told
     so rather than being shown a drop target that would fail on the server. */
  const accommodation =
    chosen && chosen.kind !== "restaurant" ? await getPrimaryAccommodation(chosen.id) : null;
  const photos: BusinessPhoto[] =
    chosen && !accommodation && chosen.kind === "restaurant"
      ? await listBusinessPhotos(chosen.id)
      : [];
  const propertyPhotos: AccommodationPhoto[] = accommodation
    ? await listAccommodationPhotos(accommodation.id)
    : [];

  return (
    /* The body's page frame carries the one way back; the bar keeps the
       host's destinations. */
    <HostShell logoLabel={t.a11y.logoHome} fallback="/host" chromeBack={false} nav>
      <HostPhotosBody
        copy={t.hostWorkspace}
        words={t.experienceHost}
        locale={locale}
        userId={session.user.id}
        businesses={businesses}
        chosen={chosen}
        photos={photos}
        accommodation={accommodation}
        propertyPhotos={propertyPhotos}
      />
    </HostShell>
  );
}
