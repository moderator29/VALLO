import type { Metadata } from "next";
import { forPickers } from "@/components/app/welcome/welcome-copy";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { PageFrame } from "@/components/app/PageFrame";
import { resolveSession } from "@/lib/actions/session";
import { withNext } from "@/lib/auth/next-link";
import { listStates, readLocalGovernment, readOccupation } from "@/lib/places/queries";
import { PlaceForm } from "./PlaceForm";
import { EmptyState } from "@/components/app/Screen";
import { EmptyActions } from "@/components/app/EmptyActions";

export async function generateMetadata(): Promise<Metadata> {
  // Static metadata cannot read the locale cookie, and this tab title is the
  // same sentence as the page heading, so the two would have disagreed.
  return {
    title: getDictionary(await getLocale()).settings.place.screenTitle,
    robots: { index: false, follow: false },
  };
}

export const dynamic = "force-dynamic";

/**
 * Where you are, and what you do.
 *
 * Its own screen rather than three more rows crammed into the profile card.
 * The owner asked for this twice: not jam-packed. Three questions, each with
 * room to breathe, each backed by a real table, and the whole thing saves as
 * one write because the database checks the state and the local government
 * against each other.
 *
 * Reached from the chevron beside the city on home, and from the settings
 * screen. A person who is not signed in is told what this screen is for and
 * given the way in, rather than being shown an empty form that cannot save.
 */
export default async function PlacePage() {
  const t = getDictionary(await getLocale());
  const session = await resolveSession();
  const states = await listStates();

  const copy = t.settings.place;

  if (session.state !== "signed-in") {
    return (
      <PageFrame title={copy.screenTitle} fallback="/settings" width="narrow">
        <EmptyState
          icon="location"
          title={copy.accountTitle}
          body={session.state === "unconfigured" ? copy.accountBodyUnconfigured : copy.accountBodySignedOut}
          {...(session.state === "signed-out"
            ? { action: <EmptyActions primary={{ label: t.common.signIn, href: withNext("/sign-in", "/settings/place") }} /> }
            : {})}
        />
      </PageFrame>
    );
  }

  const { data: profile } = await session.supabase
    .from("profiles")
    .select("state_code, lga_code, occupation_code")
    .eq("id", session.user.id)
    .maybeSingle();

  const stateCode = profile?.state_code ?? "";
  const lgaCode = profile?.lga_code ?? "";
  const occupationCode = profile?.occupation_code ?? "";

  const [lga, occupation] = await Promise.all([
    lgaCode ? readLocalGovernment(lgaCode) : Promise.resolve(null),
    occupationCode ? readOccupation(occupationCode) : Promise.resolve(null),
  ]);

  return (
    <PageFrame title={copy.screenTitle} subtitle={copy.screenSubtitle} fallback="/settings" width="narrow">
      {states.length === 0 && (
        <p className="nf-panel nf-panel--card block p-md text-[length:var(--nf-text-caption)] leading-relaxed text-[var(--nf-content-muted)]">
          {copy.statesUnavailable}
        </p>
      )}

      <PlaceForm
        t={forPickers(t)}
        states={states}
        initial={{ stateCode, lgaCode, occupationCode }}
        initialLabels={{
          lgaName: lga?.name ?? "",
          occupationName: occupation?.name ?? "",
        }}
      />
    </PageFrame>
  );
}
